import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { claimHost } from "../host/lease.js";
import { snapshotProject } from "../host/snapshot.js";
import { launchHerdrTask, HerdrLaunchError } from "../herdr/launch.js";
import { createLaunchIntent, readLaunchResult, readLaunchWorkspace, readProjectLaunchIntent,
  recordLaunchPane, recordLaunchWorkspace } from "../herdr/launch-record.js";
import { initSessionIfAbsent } from "../herdr/session-init.js";
import { targetsForSession } from "../herdr/seat-target.js";

function prepare(project: string) {
  const requestId = crypto.randomUUID();
  const sessionId = initSessionIfAbsent(project, "Write a README", requestId);
  createLaunchIntent(project, sessionId, requestId, true, "cli_auto_host_herdr");
  const targets = targetsForSession(sessionId);
  recordLaunchWorkspace(project, requestId, "w1", "w1:p1", "term-r", targets);
  recordLaunchPane(project, requestId, "w1:p3");
  fs.writeFileSync(path.join(project, ".dual-agent", "herdr-launch-result.json"),
    `${JSON.stringify({ schema: 1, request_id: requestId, status: "needs_reconcile",
      code: "AGENT_READY_TIMEOUT" })}\n`);
  return { requestId, sessionId, targets };
}

function fakeHerdr(root: string, project: string): string {
  const file = path.join(root, "herdr-fake.js");
  fs.writeFileSync(file, `#!${process.execPath}\n` +
    `const fs=require('node:fs'),path=require('node:path');let a=process.argv.slice(2);` +
    `if(a[0]==='--session')a=a.slice(2);const project=process.env.TEST_PROJECT;` +
    `const state=path.join(project,'.dual-agent');` +
    `if(a[0]==='--version')console.log('herdr 0.9.4');` +
    `else if(a.join(' ')==='status server --json')console.log(JSON.stringify({status:'running',running:true}));` +
    `else if(a.join(' ')==='plugin list --json')console.log(JSON.stringify({result:{plugins:[{plugin_id:'ralph-lisa.loop',version:'0.1.9',enabled:true,panes:[{id:'coordinator'}]}]}}));` +
    `else if(a[0]==='workspace'&&a[1]==='get'&&a[2]==='w1')console.log(JSON.stringify({result:{workspace:{workspace_id:'w1'}}}));` +
    `else if(a[0]==='pane'&&a[1]==='get'&&a[2]==='w1:p1')console.log(JSON.stringify({result:{pane:{pane_id:'w1:p1',workspace_id:'w1',terminal_id:'term-r',cwd:project}}}));` +
    `else if(a[0]==='plugin'&&a[1]==='pane'&&a[2]==='open'){` +
    `const result=path.join(state,'herdr-launch-result.json');` +
    `fs.renameSync(result,path.join(state,'herdr-launch-result-retry-evidence.json'));` +
    `const request=JSON.parse(fs.readFileSync(path.join(state,'herdr-launch-intent.json'),'utf8')).request_id;` +
    `fs.writeFileSync(result,JSON.stringify({schema:1,request_id:request,status:'started'})+'\\n');` +
    `fs.appendFileSync(process.env.TEST_CALLS,'coordinator-open\\n');` +
    `console.log(JSON.stringify({result:{type:'plugin_pane_opened',plugin_pane:{pane:{pane_id:'w1:p4',workspace_id:'w1'}}}}));}` +
    `else{console.error(JSON.stringify({error:{code:'unexpected_command',args:a}}));process.exitCode=2;}\n`);
  fs.chmodSync(file, 0o700);
  return file;
}

describe("Herdr failed preclaim launch retry", () => {
  it("reuses the original request, session, Workspace and targets after read-only checks", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "rll-herdr-retry-"));
    const project = path.join(root, "project");
    fs.mkdirSync(project);
    const original = prepare(project);
    const calls = path.join(root, "calls.log");
    const herdr = fakeHerdr(root, project);
    const previous = { bin: process.env.HERDR_BIN_PATH, session: process.env.RLL_HERDR_SESSION,
      entry: process.env.RLL_HERDR_START_ENTRYPOINT, project: process.env.TEST_PROJECT,
      calls: process.env.TEST_CALLS };
    Object.assign(process.env, { HERDR_BIN_PATH: herdr, RLL_HERDR_SESSION: "retry-test",
      RLL_HERDR_START_ENTRYPOINT: "cli_auto_host_herdr", TEST_PROJECT: project,
      TEST_CALLS: calls });
    try {
      const before = snapshotProject(project);
      assert.equal(before.session_id, original.sessionId);
      assert.equal(before.host_state, "unclaimed");
      assert.equal(before.binding_state, "unbound");
      assert.equal(before.generation, null);
      assert.equal(before.last_receipt_id, null);
      assert.equal(before.candidate_count, 0);
      const intent = readProjectLaunchIntent(project);
      assert.equal(intent.session_id, original.sessionId);
      assert.equal(intent.permission_profile, "full_auto");
      assert.equal(intent.auto_commit, true);
      assert.equal(intent.auto_commit_granted_via, "cli_auto_host_herdr");
      assert.deepEqual(readLaunchWorkspace(project, original.requestId).agent_targets,
        original.targets);
      assert.equal(readLaunchResult(project, original.requestId)?.status, "needs_reconcile");
      const taskFile = fs.readFileSync(path.join(project, ".dual-agent", "task.md"), "utf8");
      assert.equal(taskFile.slice("# Task\n\n".length,
        taskFile.lastIndexOf("\n\n---\nCreated: ")), "Write a README");
      assert.equal(fs.lstatSync(path.join(project, ".dual-agent",
        "herdr-launch-result.json")).isFile(), true);
      const receipt = await launchHerdrTask({ project, task: "Write a README", fullAuto: true });
      assert.equal(receipt.status, "started");
      assert.equal(receipt.request_id, original.requestId);
      assert.equal(receipt.session_id, original.sessionId);
      assert.equal(receipt.workspace_id, "w1");
      assert.equal(receipt.coordinator_pane_id, "w1:p4");
      assert.equal(fs.readFileSync(calls, "utf8"), "coordinator-open\n");
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(project, ".dual-agent",
        "herdr-launch-workspace.json"), "utf8")).agent_targets, original.targets);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        const name = key === "bin" ? "HERDR_BIN_PATH" : key === "session" ? "RLL_HERDR_SESSION" :
          key === "entry" ? "RLL_HERDR_START_ENTRYPOINT" : key === "project" ? "TEST_PROJECT" : "TEST_CALLS";
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves the scene when the task or host state changed", async () => {
    for (const unsafe of ["task", "claimed"] as const) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "rll-herdr-retry-blocked-"));
      const project = path.join(root, "project");
      fs.mkdirSync(project);
      prepare(project);
      if (unsafe === "claimed") claimHost(project, "herdr", crypto.randomUUID());
      const sentinel = fs.readFileSync(path.join(project, ".dual-agent", "session.json"));
      try {
        await assert.rejects(
          launchHerdrTask({ project, task: unsafe === "task" ? "Different task" : "Write a README",
            fullAuto: true }),
          (error: unknown) => error instanceof HerdrLaunchError && error.code === "RECOVERY_REQUIRED");
        assert.deepEqual(fs.readFileSync(path.join(project, ".dual-agent", "session.json")), sentinel);
      } finally { fs.rmSync(root, { recursive: true, force: true }); }
    }
  });
});
