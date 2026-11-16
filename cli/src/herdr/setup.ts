import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const PLUGIN_ID = "ralph-lisa.loop";
const PLUGIN_SOURCE = "Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr";
const PLUGIN_REF = "v0.1.9";
const MIN_HERDR = [0, 9, 4] as const;
const MIN_PLUGIN = [0, 1, 9] as const;

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
};

type Plugin = {
  plugin_id?: unknown;
  version?: unknown;
  enabled?: unknown;
  plugin_root?: unknown;
  source?: {
    kind?: unknown;
    owner?: unknown;
    repo?: unknown;
    subdir?: unknown;
    requested_ref?: unknown;
    resolved_commit?: unknown;
  };
  actions?: Array<{ id?: unknown; command?: unknown }>;
};

export class HerdrSetupError extends Error {
  constructor(public readonly code: string) { super(code); }
}

function run(argv: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): CommandResult {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: 120000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { status: result.status, stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "", error: result.error };
}

function herdr(args: string[]): CommandResult {
  return run([process.env.HERDR_BIN_PATH || "herdr", ...args]);
}

function parsedVersion(value: unknown): number[] | null {
  if (typeof value !== "string") return null;
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function atLeast(actual: number[] | null, minimum: readonly number[]): boolean {
  if (!actual) return false;
  for (let index = 0; index < 3; index++) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index];
  }
  return true;
}

function listPlugins(): Plugin[] {
  const result = herdr(["plugin", "list", "--json"]);
  if (result.error?.code === "ENOENT") throw new HerdrSetupError("HERDR_NOT_FOUND");
  if (result.status !== 0) throw new HerdrSetupError("HERDR_PLUGIN_LIST_FAILED");
  try {
    const value = JSON.parse(result.stdout);
    const plugins = value?.result?.plugins;
    if (!Array.isArray(plugins)) throw new Error("invalid list");
    return plugins;
  } catch { throw new HerdrSetupError("HERDR_PLUGIN_LIST_INVALID"); }
}

function expectedSource(plugin: Plugin): boolean {
  return plugin.source?.kind === "github" &&
    plugin.source.owner === "Click-Intelligence-LLC" &&
    plugin.source.repo === "ralph-lisa-herdr" &&
    plugin.source.subdir === "integrations/herdr";
}

function installedPlugin(): Plugin | null {
  const matches = listPlugins().filter((plugin) => plugin.plugin_id === PLUGIN_ID);
  if (matches.length > 1) throw new HerdrSetupError("HERDR_PLUGIN_DUPLICATED");
  return matches[0] ?? null;
}

function validateHerdrVersion(): string {
  const result = herdr(["--version"]);
  if (result.error?.code === "ENOENT") throw new HerdrSetupError("HERDR_NOT_FOUND");
  const version = parsedVersion(result.stdout);
  if (result.status !== 0 || !atLeast(version, MIN_HERDR))
    throw new HerdrSetupError("HERDR_VERSION_REQUIRED");
  return version!.slice(0, 3).join(".");
}

function installPlugin(): void {
  const result = herdr(["plugin", "install", PLUGIN_SOURCE, "--ref", PLUGIN_REF, "--yes"]);
  if (result.status !== 0) throw new HerdrSetupError("HERDR_PLUGIN_INSTALL_FAILED");
}

function enablePlugin(): void {
  const result = herdr(["plugin", "enable", PLUGIN_ID]);
  if (result.status !== 0) throw new HerdrSetupError("HERDR_PLUGIN_ENABLE_FAILED");
}

function doctor(plugin: Plugin): Record<string, unknown> {
  if (typeof plugin.plugin_root !== "string" || !path.isAbsolute(plugin.plugin_root))
    throw new HerdrSetupError("HERDR_PLUGIN_ROOT_INVALID");
  const action = plugin.actions?.find((item) => item.id === "doctor");
  if (!Array.isArray(action?.command) || action.command.length < 1 ||
      !action.command.every((item) => typeof item === "string" && item.length > 0))
    throw new HerdrSetupError("HERDR_PLUGIN_DOCTOR_MISSING");
  let root: string;
  try {
    root = fs.realpathSync.native(plugin.plugin_root);
    if (!fs.statSync(root).isDirectory()) throw new Error("not a directory");
  } catch { throw new HerdrSetupError("HERDR_PLUGIN_ROOT_INVALID"); }
  const config = herdr(["plugin", "config-dir", PLUGIN_ID]);
  if (config.status !== 0 || !path.isAbsolute(config.stdout))
    throw new HerdrSetupError("HERDR_PLUGIN_CONFIG_INVALID");
  const result = run(action.command as string[], { cwd: root, env: {
    ...process.env,
    HERDR_BIN_PATH: process.env.HERDR_BIN_PATH || "herdr",
    HERDR_PLUGIN_ID: PLUGIN_ID,
    HERDR_PLUGIN_ROOT: root,
    HERDR_PLUGIN_CONFIG_DIR: config.stdout,
  } });
  try {
    const value = JSON.parse(result.stdout);
    if (!value || value.schema !== 1 || !["ready", "needs_setup"].includes(value.status))
      throw new Error("invalid doctor result");
    return value;
  } catch { throw new HerdrSetupError("HERDR_PLUGIN_DOCTOR_FAILED"); }
}

export function reportHerdrSetup(): void {
  const herdrVersion = validateHerdrVersion();
  let plugin = installedPlugin();
  if (plugin && !expectedSource(plugin))
    throw new HerdrSetupError("HERDR_PLUGIN_SOURCE_CONFLICT");
  const version = parsedVersion(plugin?.version);
  const newer = atLeast(version, [0, 1, 10]);
  const pinnedCurrent = atLeast(version, MIN_PLUGIN) && plugin?.source?.requested_ref === PLUGIN_REF;
  if (!plugin || (!newer && !pinnedCurrent)) {
    installPlugin();
    plugin = installedPlugin();
  }
  if (!plugin || !expectedSource(plugin) || !atLeast(parsedVersion(plugin.version), MIN_PLUGIN))
    throw new HerdrSetupError("HERDR_PLUGIN_INSTALL_UNVERIFIED");
  if (plugin.enabled !== true) {
    enablePlugin();
    plugin = installedPlugin();
  }
  if (!plugin || plugin.enabled !== true)
    throw new HerdrSetupError("HERDR_PLUGIN_ENABLE_UNVERIFIED");
  const diagnosis = doctor(plugin);
  const ready = diagnosis.status === "ready";
  process.stdout.write(`${JSON.stringify({ schema: 1,
    status: ready ? "ready" : "needs_setup",
    herdr_version: herdrVersion,
    plugin: {
      id: PLUGIN_ID,
      version: plugin.version,
      requested_ref: plugin.source?.requested_ref ?? null,
      resolved_commit: plugin.source?.resolved_commit ?? null,
      enabled: true,
    },
    checks: diagnosis.checks ?? null,
    code: diagnosis.code ?? null,
  })}\n`);
  if (!ready) process.exitCode = 3;
}
