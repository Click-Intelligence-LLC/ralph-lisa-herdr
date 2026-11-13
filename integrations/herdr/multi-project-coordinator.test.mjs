import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(root, "../../cli/dist/cli.js");
const coordinator = path.join(root, "coordinator.mjs");

function command(args, env = process.env) {
  return spawnSync(process.execPath, args, { env, encoding: "utf8", timeout: 30000 });
}

function waitForOutput(child, predicate, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => finish(new Error(
      `coordinator output timeout; stdout=${stdout}; stderr=${stderr}`)), timeoutMs);
    function finish(error, value) {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.stderr.off("data", onError);
      child.off("close", onClose);
      if (error) reject(error); else resolve(value);
    }
    function onError(chunk) { stderr += chunk.toString(); }
    function onClose(code) {
      finish(new Error(`coordinator exited ${code}; stdout=${stdout}; stderr=${stderr}`));
    }
    function onData(chunk) {
      stdout += chunk.toString();
      const lines = stdout.split("\n");
      stdout = lines.pop();
      for (const line of lines) {
        if (!line) continue;
        const value = JSON.parse(line);
        if (predicate(value)) return finish(null, value);
      }
    }
    child.stdout.on("data", onData);
    child.stderr.on("data", onError);
    child.on("close", onClose);
  });
}

async function eventually(read, predicate, message, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const value = read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(message);
}

test("one Herdr server isolates two projects, four targets, and bidirectional handoffs", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "rll-herdr-multiproject-"));
  const fakeState = path.join(temp, "herdr-state.json");
  const fakeHerdr = path.join(temp, "herdr");
  const fakeClaude = path.join(temp, "claude");
  const fakeCodex = path.join(temp, "codex");
  const pluginState = path.join(temp, "plugin-state");
  const projects = {
    a: path.join(temp, "project-a"),
    b: path.join(temp, "project-b"),
  };
  const configs = {
    a: path.join(temp, "config-a"),
    b: path.join(temp, "config-b"),
  };
  for (const dir of [...Object.values(projects), ...Object.values(configs), pluginState])
    fs.mkdirSync(dir);
  fs.writeFileSync(fakeState, JSON.stringify({ next_workspace: 1, workspaces: {},
    panes: {}, agents: {}, prompts: [] }));
  fs.writeFileSync(fakeHerdr, `#!${process.execPath}\n` +
    `const fs=require('node:fs');const a=process.argv.slice(2);` +
    `const file=process.env.FAKE_HERDR_STATE;const read=()=>JSON.parse(fs.readFileSync(file));` +
    `const save=(s)=>{const temp=file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify(s));fs.renameSync(temp,file);};` +
    `const out=(result)=>console.log(JSON.stringify({result}));` +
    `if(a[0]==='--version')console.log('herdr 0.9.4');` +
    `else if(a[0]==='integration')console.log('claude: current (v10)\\ncodex: current (v9)');` +
    `else if(a[0]==='workspace'&&a[1]==='create'){const s=read(),id='w'+s.next_workspace++,cwd=a[a.indexOf('--cwd')+1],pane=id+':p1',terminal='term-'+id+'-p1';s.workspaces[id]={workspace_id:id,cwd};s.panes[pane]={workspace_id:id,pane_id:pane,terminal_id:terminal,cwd,agent:null};save(s);out({workspace:s.workspaces[id],root_pane:s.panes[pane]});}` +
    `else if(a[0]==='workspace'&&a[1]==='get'){const s=read(),workspace=s.workspaces[a[2]];if(workspace)out({workspace});else{console.error(JSON.stringify({error:{code:'workspace_not_found'}}));process.exitCode=1;}}` +
    `else if(a[0]==='pane'&&a[1]==='split'){const s=read(),source=s.panes[a[2]],pane=source.workspace_id+':p2',cwd=a[a.indexOf('--cwd')+1],terminal='term-'+source.workspace_id+'-p2';s.panes[pane]={workspace_id:source.workspace_id,pane_id:pane,terminal_id:terminal,cwd,agent:null};save(s);out({pane:s.panes[pane]});}` +
    `else if(a[0]==='pane'&&a[1]==='get'){const s=read(),pane=s.panes[a[2]];if(pane)out({pane});else{console.error(JSON.stringify({error:{code:'pane_not_found'}}));process.exitCode=1;}}` +
    `else if(a[0]==='agent'&&a[1]==='start'){const s=read(),target=a[2],kind=a[4],pane=s.panes[a[6]];const agent={name:target,agent:kind,workspace_id:pane.workspace_id,pane_id:pane.pane_id,terminal_id:pane.terminal_id,cwd:pane.cwd,agent_session:{agent:kind,kind:'id',source:'herdr:'+kind,value:'session-'+target},interactive_ready:true,agent_status:'idle'};s.agents[target]=agent;pane.agent=target;save(s);out({agent});}` +
    `else if(a[0]==='agent'&&a[1]==='get'){const s=read(),agent=s.agents[a[2]];if(agent)out({agent});else{console.error(JSON.stringify({error:{code:'agent_not_found'}}));process.exitCode=1;}}` +
    `else if(a[0]==='agent'&&a[1]==='prompt'){const s=read(),agent=s.agents[a[2]];s.prompts.push({target:a[2],project:agent.cwd,message:a[3]});save(s);out({type:'agent_prompted',agent:{...agent,agent_status:'working'}});}` +
    `else process.exitCode=2;\n`);
  fs.writeFileSync(fakeClaude, `#!${process.execPath}\nconsole.log('{"loggedIn":true}');\n`);
  fs.writeFileSync(fakeCodex, `#!${process.execPath}\nconsole.log('Logged in using ChatGPT');\n`);
  for (const file of [fakeHerdr, fakeClaude, fakeCodex]) fs.chmodSync(file, 0o700);

  const children = [];
  const envs = {};
  try {
    for (const key of ["a", "b"]) {
      fs.writeFileSync(path.join(configs[key], "settings.json"), JSON.stringify({
        project: projects[key], rll_cli_argv: [process.execPath, cli],
      }));
      const initialized = command([cli, "init", "--minimal", projects[key]]);
      assert.equal(initialized.status, 0, initialized.stdout + initialized.stderr);
      envs[key] = { ...process.env, HERDR_BIN_PATH: fakeHerdr,
        CLAUDE_BIN_PATH: fakeClaude, CODEX_BIN_PATH: fakeCodex,
        HERDR_PLUGIN_CONFIG_DIR: configs[key], HERDR_PLUGIN_STATE_DIR: pluginState,
        HERDR_WORKSPACE_ID: `context-${key}`,
        HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({ workspace_id: `context-${key}`,
          workspace_cwd: projects[key] }), FAKE_HERDR_STATE: fakeState };
    }

    const started = {};
    for (const key of ["a", "b"]) {
      const child = spawn(process.execPath, [coordinator, "start"], {
        env: envs[key], stdio: ["ignore", "pipe", "pipe"],
      });
      children.push(child);
      started[key] = await waitForOutput(child, (value) =>
        value.status === "started" || value.status === "needs_reconcile");
      assert.equal(started[key].status, "started", JSON.stringify(started[key]));
    }

    const host = async (key, action, args = []) => {
      for (let attempt = 0; attempt < 40; attempt++) {
        const result = command([cli, "host", action, "--project", projects[key],
          ...args, "--json"], envs[key]);
        const value = JSON.parse(result.stdout);
        if (["HOST_BUSY", "RECOVERY_STATE_CHANGED"].includes(value.code)) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }
        assert.equal(result.status, 0, result.stdout + result.stderr);
        return value;
      }
      assert.fail(`${key} host ${action} remained busy`);
    };
    const snapshots = { a: await host("a", "snapshot"), b: await host("b", "snapshot") };
    const targets = {};
    for (const key of ["a", "b"]) {
      targets[key] = {
        ralph: snapshots[key].seats.ralph.agent_target,
        lisa: snapshots[key].seats.lisa.agent_target,
      };
      assert.match(targets[key].ralph, /^ralph_[0-9a-f]{16}$/);
      assert.match(targets[key].lisa, /^lisa_[0-9a-f]{16}$/);
    }
    assert.equal(new Set(Object.values(targets).flatMap(Object.values)).size, 4);
    const initialHerdr = JSON.parse(fs.readFileSync(fakeState, "utf8"));
    assert.deepEqual(Object.keys(initialHerdr.agents).sort(),
      Object.values(targets).flatMap(Object.values).sort());
    assert.deepEqual(initialHerdr.prompts.map((row) => row.target),
      [targets.a.ralph, targets.b.ralph]);

    const submit = async (key, role, generation, content) => {
      const candidateId = randomUUID();
      const requestId = randomUUID();
      const filename = `candidate-${generation}.md`;
      fs.writeFileSync(path.join(projects[key], filename), content);
      await host(key, "propose", ["--role", role, "--file", filename,
        "--candidate-id", candidateId]);
      const args = ["--lease-id", started[key].lease_id, "--request-id", requestId,
        "--candidate-id", candidateId, "--expected-generation", String(generation),
        "--expected-binding-generation", String(started[key].binding_generation)];
      const checked = await host(key, "commit-check", args);
      assert.equal(checked.status, "awaiting_source_confirmation");
      await host(key, "confirm-candidate", [...args,
        "--expected-content-sha256", checked.content_sha256,
        "--decision", "reviewed_candidate_source"]);
      const committed = await host(key, "commit", args);
      assert.equal(committed.status, "committed");
      return committed;
    };
    const promptCount = () => JSON.parse(fs.readFileSync(fakeState, "utf8")).prompts.length;
    const waitForPrompt = (count) => eventually(promptCount, (value) => value === count,
      `expected ${count} prompts, got ${promptCount()}`);

    await submit("a", "ralph", 0, "[PLAN] Project A plan.\n\nTest Plan: npm test\n");
    await waitForPrompt(3);
    assert.equal((await host("b", "snapshot")).generation, 0);
    await submit("b", "ralph", 0, "[PLAN] Project B plan.\n\nTest Plan: npm test\n");
    await waitForPrompt(4);
    assert.equal((await host("a", "snapshot")).generation, 1);
    await submit("a", "lisa", 1,
      "[NEEDS_WORK] Project A review.\n\n- Fix the A-only issue.\n");
    await waitForPrompt(5);
    assert.equal((await host("b", "snapshot")).generation, 1);
    await submit("b", "lisa", 1,
      "[NEEDS_WORK] Project B review.\n\n- Fix the B-only issue.\n");
    await waitForPrompt(6);
    assert.equal((await host("a", "snapshot")).generation, 2);
    assert.equal((await host("b", "snapshot")).generation, 2);
    const promptTargets = JSON.parse(fs.readFileSync(fakeState, "utf8")).prompts
      .map((row) => row.target);
    assert.deepEqual(promptTargets, [targets.a.ralph, targets.b.ralph,
      targets.a.lisa, targets.b.lisa, targets.a.ralph, targets.b.ralph]);

    const stopA = command([coordinator, "stop"], envs.a);
    assert.equal(stopA.status, 0, stopA.stdout + stopA.stderr);
    assert.equal((await host("a", "snapshot")).host_state, "unclaimed");
    const bAfterAStop = await host("b", "snapshot");
    assert.equal(bAfterAStop.host_state, "claimed");
    assert.equal(bAfterAStop.generation, 2);
    const guardedRestart = command([coordinator, "start"], envs.a);
    assert.equal(guardedRestart.status, 3, guardedRestart.stdout + guardedRestart.stderr);
    assert.equal(JSON.parse(guardedRestart.stdout).code, "EXISTING_GENERATION_REQUIRES_RECOVERY");
    assert.equal((await host("b", "snapshot")).generation, 2);

    const stopB = command([coordinator, "stop"], envs.b);
    assert.equal(stopB.status, 0, stopB.stdout + stopB.stderr);
    assert.equal((await host("b", "snapshot")).host_state, "unclaimed");
  } finally {
    for (const child of children) child.kill("SIGTERM");
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
