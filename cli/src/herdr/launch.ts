import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { acquireSessionCommandLock } from "../host/guard.js";
import { canonicalProject } from "../host/inspect.js";
import { snapshotProject } from "../host/snapshot.js";
import { stateDir } from "../state.js";
import { initSessionIfAbsent } from "./session-init.js";
import { createLaunchIntent, readLaunchResult, readLaunchWorkspace, readProjectLaunchIntent,
  recordLaunchPane, recordLaunchWorkspace, type LaunchWorkspace } from "./launch-record.js";
import type { HerdrLaunchOptions } from "./options.js";
import { targetsForSession, type HerdrSeatTargets } from "./seat-target.js";

type HerdrResponse = { result?: Record<string, any>; running?: boolean; status?: string };

export class HerdrLaunchError extends Error {
  constructor(public readonly code: string, public readonly requestId?: string) { super(code); }
}

function existingState(project: string): boolean {
  try { fs.lstatSync(stateDir(project)); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function command(args: string[], timeout = 15000): HerdrResponse {
  const session = process.env.RLL_HERDR_SESSION;
  if (session && !/^[a-zA-Z0-9_-]{1,48}$/.test(session)) throw new HerdrLaunchError("HERDR_SESSION_INVALID");
  const prefix = session ? ["--session", session] : [];
  const result = spawnSync(process.env.HERDR_BIN_PATH || "herdr", [...prefix, ...args],
    { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || result.status !== 0) throw new HerdrLaunchError("HERDR_COMMAND_FAILED");
  try { return JSON.parse(result.stdout.trim()) as HerdrResponse; }
  catch { throw new HerdrLaunchError("HERDR_RESPONSE_INVALID"); }
}

function atLeastVersion(actual: string, minimum: [number, number, number]): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(actual);
  if (!match) return false;
  const found = match.slice(1).map(Number);
  for (let i = 0; i < 3; i++) {
    if (found[i] !== minimum[i]) return found[i] > minimum[i];
  }
  return true;
}

function preflight(): void {
  const version = spawnSync(process.env.HERDR_BIN_PATH || "herdr", ["--version"],
    { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] });
  const found = version.stdout?.match(/(\d+)\.(\d+)\.(\d+)/);
  if (version.status !== 0 || !found ||
      [Number(found[1]), Number(found[2]), Number(found[3])].join(".") === "0.0.0" ||
      Number(found[1]) === 0 && (Number(found[2]) < 9 || Number(found[2]) === 9 && Number(found[3]) < 4))
    throw new HerdrLaunchError("HERDR_VERSION_REQUIRED");
  const server = command(["status", "server", "--json"]);
  if (server.running !== true || server.status !== "running")
    throw new HerdrLaunchError("HERDR_SERVER_NOT_RUNNING");
  const listing = command(["plugin", "list", "--json"]);
  const plugins = listing.result?.plugins;
  if (!Array.isArray(plugins)) throw new HerdrLaunchError("PLUGIN_LIST_INVALID");
  const plugin = plugins.find((item: any) => item.plugin_id === "ralph-lisa.loop" && item.enabled === true);
  if (!plugin) throw new HerdrLaunchError("HERDR_PLUGIN_REQUIRED");
  if (typeof plugin.version !== "string" || !atLeastVersion(plugin.version, [0, 1, 9]))
    throw new HerdrLaunchError("HERDR_PLUGIN_VERSION_REQUIRED");
  if (!Array.isArray(plugin.panes) || !plugin.panes.some((pane: any) => pane.id === "coordinator"))
    throw new HerdrLaunchError("PLUGIN_LAUNCH_ENTRYPOINT_REQUIRED");
}

function validOpaqueId(value: string): boolean {
  return value.length > 0 && value.length <= 512 && value.trim() === value &&
    !/[\x00-\x1f\x7f]/.test(value);
}

function reusableWorkspace(project: string): string | null {
  const id = process.env.RLL_HERDR_REUSE_WORKSPACE_ID ||
    (process.env.HERDR_ENV === "1" ? process.env.HERDR_WORKSPACE_ID : undefined);
  if (!id) return null;
  // Herdr documents public IDs as opaque stable handles. Do not assume that a
  // Workspace ID uses a decimal suffix (real servers may return values such as
  // `wB`); validate only the safe opaque-string boundary before passing it as
  // an argv element and then verify it against the live server response.
  if (!validOpaqueId(id)) throw new HerdrLaunchError("WORKSPACE_ID_INVALID");
  const observed = command(["workspace", "get", id]);
  if (observed.result?.workspace?.workspace_id !== id)
    throw new HerdrLaunchError("WORKSPACE_NOT_FOUND");
  const panes = command(["pane", "list", "--workspace", id]).result?.panes;
  if (!Array.isArray(panes)) throw new HerdrLaunchError("WORKSPACE_PANES_INVALID");
  const containsProject = panes.some((pane: any) => {
    try { return fs.realpathSync.native(pane.cwd) === project; }
    catch { return false; }
  });
  if (!containsProject) throw new HerdrLaunchError("WORKSPACE_PROJECT_MISMATCH");
  return id;
}

export type HerdrLaunchReceipt = {
  status: "started" | "needs_input" | "needs_reconcile" | "not_ready" | "pending";
  auto_commit: true;
  source_verification: "unverified";
  permission_profile: "interactive" | "full_auto";
  request_id: string;
  project_realpath: string;
  session_id: string;
  workspace_id: string;
  coordinator_pane_id: string;
  blocked_role?: "ralph" | "lisa";
  blocked_pane_id?: string;
  code?: string;
};

function blockedAgent(workspaceId: string, project: string, targets: HerdrSeatTargets):
  { role: "ralph" | "lisa"; paneId: string } | null {
  for (const [role, kind] of [["ralph", "claude"], ["lisa", "codex"]] as const) {
    let agent: any;
    try { agent = command(["agent", "get", targets[role]], 5000).result?.agent; }
    catch { continue; }
    let cwd: string | null = null;
    try { cwd = fs.realpathSync.native(agent?.cwd); } catch { /* Ignore unrelated agents. */ }
    if (agent?.name === targets[role] && agent?.agent === kind &&
        agent?.workspace_id === workspaceId && cwd === project &&
        agent?.agent_status === "blocked" && typeof agent.pane_id === "string")
      return { role, paneId: agent.pane_id };
  }
  return null;
}

function launchGrantVia(): "cli_auto_host_herdr" | "plugin_start_task" {
  return process.env.RLL_HERDR_START_ENTRYPOINT === "plugin_start_task"
    ? "plugin_start_task" : "cli_auto_host_herdr";
}

function taskFromState(project: string): string {
  const value = fs.readFileSync(path.join(stateDir(project), "task.md"), "utf8");
  const prefix = "# Task\n\n";
  const marker = "\n\n---\nCreated: ";
  const end = value.lastIndexOf(marker);
  if (!value.startsWith(prefix) || end < prefix.length) throw new Error("TASK_RECORD_INVALID");
  return value.slice(prefix.length, end);
}

function resultVersion(project: string): string | null {
  const file = path.join(stateDir(project), "herdr-launch-result.json");
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("LAUNCH_RESULT_INVALID");
    return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function acquireLaunchRetryLock(project: string): () => void {
  const file = path.join(stateDir(project), "herdr-launch-retry.lock");
  let fd: number;
  try { fd = fs.openSync(file, "wx", 0o600); }
  catch { throw new HerdrLaunchError("RECOVERY_REQUIRED"); }
  try { fs.writeFileSync(fd, `${JSON.stringify({ schema: 1, pid: process.pid })}\n`); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  return () => {
    try { fs.unlinkSync(file); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  };
}

async function waitForLaunchResult(project: string, requestId: string,
  previousVersion: string | null = null) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const version = resultVersion(project);
    if (version !== null && version !== previousVersion) {
      const result = readLaunchResult(project, requestId);
      if (result) return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const version = resultVersion(project);
  return version !== null && version !== previousVersion
    ? readLaunchResult(project, requestId) : null;
}

function recoverableLaunch(options: HerdrLaunchOptions, project: string): {
  requestId: string; sessionId: string; workspace: LaunchWorkspace;
  previousResultVersion: string;
} {
  try {
    const intent = readProjectLaunchIntent(project);
    const workspace = readLaunchWorkspace(project, intent.request_id);
    const result = readLaunchResult(project, intent.request_id);
    const snapshot = snapshotProject(project);
    const expectedTargets = targetsForSession(intent.session_id);
    if (taskFromState(project) !== options.task ||
        intent.permission_profile !== (options.fullAuto ? "full_auto" : "interactive") ||
        intent.auto_commit !== true || intent.auto_commit_granted_via !== launchGrantVia() ||
        !workspace.agent_targets || workspace.agent_targets.ralph !== expectedTargets.ralph ||
        workspace.agent_targets.lisa !== expectedTargets.lisa ||
        !result || !["not_ready", "needs_reconcile"].includes(result.status) ||
        snapshot.session_id !== intent.session_id || snapshot.host_state !== "unclaimed" ||
        snapshot.binding_state !== "unbound" || snapshot.generation !== null ||
        snapshot.last_receipt_id !== null || snapshot.candidate_count !== 0) {
      throw new Error("RECOVERY_REQUIRED");
    }
    const previousResultVersion = resultVersion(project);
    if (!previousResultVersion) throw new Error("RECOVERY_REQUIRED");
    return { requestId: intent.request_id, sessionId: intent.session_id, workspace,
      previousResultVersion };
  } catch (error) {
    if (error instanceof HerdrLaunchError) throw error;
    throw new HerdrLaunchError("RECOVERY_REQUIRED");
  }
}

function verifyRecoverableWorkspace(project: string, workspace: LaunchWorkspace): void {
  try {
    const observed = command(["workspace", "get", workspace.workspace_id]);
    if (observed.result?.workspace?.workspace_id !== workspace.workspace_id)
      throw new Error("workspace changed");
    const pane = command(["pane", "get", workspace.root_pane_id]).result?.pane;
    let cwd: string | null = null;
    try { cwd = fs.realpathSync.native(pane?.cwd); } catch { /* Fail closed. */ }
    if (pane?.pane_id !== workspace.root_pane_id ||
        pane?.workspace_id !== workspace.workspace_id ||
        pane?.terminal_id !== workspace.root_terminal_id || cwd !== project)
      throw new Error("pane changed");
  } catch {
    throw new HerdrLaunchError("RECOVERY_REQUIRED");
  }
}

async function resumeHerdrTask(options: HerdrLaunchOptions, project: string,
  authorization: Pick<HerdrLaunchReceipt, "auto_commit" | "source_verification" | "permission_profile">):
  Promise<HerdrLaunchReceipt> {
  const release = acquireLaunchRetryLock(project);
  try {
    const retry = recoverableLaunch(options, project);
    preflight();
    verifyRecoverableWorkspace(project, retry.workspace);
    const opened = command(["plugin", "pane", "open", "--plugin", "ralph-lisa.loop",
      "--entrypoint", "coordinator", "--placement", "tab",
      "--workspace", retry.workspace.workspace_id,
      "--env", `RLL_LAUNCH_REQUEST_ID=${retry.requestId}`, "--no-focus"]);
    const pane = opened.result?.plugin_pane?.pane;
    if (opened.result?.type !== "plugin_pane_opened" || !pane?.pane_id ||
        pane.workspace_id !== retry.workspace.workspace_id)
      throw new HerdrLaunchError("COORDINATOR_PANE_UNCERTAIN", retry.requestId);
    const result = await waitForLaunchResult(project, retry.requestId,
      retry.previousResultVersion);
    if (result) return { ...authorization, status: result.status,
      request_id: retry.requestId, project_realpath: project, session_id: retry.sessionId,
      workspace_id: retry.workspace.workspace_id, coordinator_pane_id: pane.pane_id,
      ...(result.code ? { code: result.code } : {}) };
    const targets = retry.workspace.agent_targets!;
    const blocked = blockedAgent(retry.workspace.workspace_id, project, targets);
    if (blocked) return { ...authorization, status: "pending",
      code: "AGENT_BLOCKED_UNCONFIRMED", request_id: retry.requestId,
      project_realpath: project, session_id: retry.sessionId,
      workspace_id: retry.workspace.workspace_id, coordinator_pane_id: pane.pane_id,
      blocked_role: blocked.role, blocked_pane_id: blocked.paneId };
    return { ...authorization, status: "pending", code: "START_OUTCOME_UNKNOWN",
      request_id: retry.requestId, project_realpath: project, session_id: retry.sessionId,
      workspace_id: retry.workspace.workspace_id, coordinator_pane_id: pane.pane_id };
  } finally { release(); }
}

/** One launch request; an uncertain Herdr response must be inspected, never blindly retried. */
export async function launchHerdrTask(options: HerdrLaunchOptions): Promise<HerdrLaunchReceipt> {
  const authorization = { auto_commit: true as const,
    source_verification: "unverified" as const,
    permission_profile: options.fullAuto ? "full_auto" as const : "interactive" as const };
  const project = canonicalProject(path.resolve(options.project));
  if (existingState(project)) return resumeHerdrTask(options, project, authorization);
  preflight();
  const reuseWorkspaceId = reusableWorkspace(project);
  const requestId = crypto.randomUUID();
  let sessionId: string;
  const release = acquireSessionCommandLock(stateDir(project));
  try {
    if (existingState(project)) throw new HerdrLaunchError("SESSION_EXISTS");
    sessionId = initSessionIfAbsent(project, options.task, requestId);
    createLaunchIntent(project, sessionId, requestId, options.fullAuto,
      launchGrantVia());
  } finally { release(); }
  const agentTargets = targetsForSession(sessionId);

  const created = reuseWorkspaceId
    ? command(["tab", "create", "--workspace", reuseWorkspaceId,
      "--cwd", project, "--label", "Ralph-Lisa agents", "--focus"])
    : command(["workspace", "create", "--cwd", project,
      "--label", `Ralph-Lisa ${path.basename(project)}`, "--focus"]);
  const workspaceId = reuseWorkspaceId || created.result?.workspace?.workspace_id;
  const rootPane = created.result?.root_pane;
  if (created.result?.type !== (reuseWorkspaceId ? "tab_created" : "workspace_created") ||
      !workspaceId || !rootPane?.pane_id || !rootPane?.terminal_id ||
      rootPane.workspace_id !== workspaceId)
    throw new HerdrLaunchError("WORKSPACE_CREATE_UNCERTAIN", requestId);
  recordLaunchWorkspace(project, requestId, workspaceId, rootPane.pane_id,
    rootPane.terminal_id, agentTargets);

  const opened = command(["plugin", "pane", "open", "--plugin", "ralph-lisa.loop",
    "--entrypoint", "coordinator", "--placement", "tab", "--workspace", workspaceId,
    "--env", `RLL_LAUNCH_REQUEST_ID=${requestId}`, "--no-focus"]);
  const pane = opened.result?.plugin_pane?.pane;
  if (opened.result?.type !== "plugin_pane_opened" || !pane?.pane_id ||
      pane.workspace_id !== workspaceId)
    throw new HerdrLaunchError("COORDINATOR_PANE_UNCERTAIN", requestId);
  recordLaunchPane(project, requestId, pane.pane_id);

  const result = await waitForLaunchResult(project, requestId);
  // Herdr can classify a working Agent as blocked even while the coordinator
  // continues. Only a durable coordinator result can finalize launch status.
  if (result) return { ...authorization, status: result.status, request_id: requestId, project_realpath: project,
    session_id: sessionId, workspace_id: workspaceId, coordinator_pane_id: pane.pane_id,
    ...(result.code ? { code: result.code } : {}) };
  const blocked = blockedAgent(workspaceId, project, agentTargets);
  if (blocked) return { ...authorization, status: "pending", code: "AGENT_BLOCKED_UNCONFIRMED",
    request_id: requestId, project_realpath: project, session_id: sessionId,
    workspace_id: workspaceId, coordinator_pane_id: pane.pane_id,
    blocked_role: blocked.role, blocked_pane_id: blocked.paneId };
  return { ...authorization, status: "pending", code: "START_OUTCOME_UNKNOWN", request_id: requestId,
    project_realpath: project, session_id: sessionId,
    workspace_id: workspaceId, coordinator_pane_id: pane.pane_id };
}

export function reportHerdrLaunch(options: HerdrLaunchOptions): void {
  launchHerdrTask(options).then((receipt) => {
    process.stdout.write(`${JSON.stringify({ schema: 1, ...receipt })}\n`);
    if (receipt.status !== "started") process.exitCode = receipt.status === "pending" ? 7 : 3;
  }).catch((error) => {
    const code = error instanceof HerdrLaunchError ? error.code :
      error instanceof Error ? error.message : "HERDR_LAUNCH_FAILED";
    process.stderr.write(`Herdr launch stopped: ${code}${error instanceof HerdrLaunchError && error.requestId ? ` (request ${error.requestId})` : ""}\n`);
    process.exitCode = ["SESSION_EXISTS", "RECOVERY_REQUIRED"].includes(code) ? 4 : 3;
  });
}
