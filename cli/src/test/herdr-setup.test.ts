import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const alias = path.join(__dirname, "..", "herdr-rll.js");

type FixtureOptions = {
  installed?: boolean;
  enabled?: boolean;
  sourceKind?: "github" | "link";
  doctorReady?: boolean;
};

function fixture(options: FixtureOptions = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rll-setup-"));
  const state = path.join(root, "state.json");
  const log = path.join(root, "commands.jsonl");
  const pluginRoot = path.join(root, "plugin");
  const config = path.join(root, "config");
  fs.mkdirSync(pluginRoot);
  fs.mkdirSync(config);
  fs.writeFileSync(log, "");
  fs.writeFileSync(state, JSON.stringify({
    installed: options.installed ?? false,
    enabled: options.enabled ?? true,
    sourceKind: options.sourceKind ?? "github",
  }));
  const doctor = path.join(pluginRoot, "doctor.js");
  fs.writeFileSync(doctor, `console.log(JSON.stringify({
  schema: 1,
  status: ${options.doctorReady === false ? '"needs_setup"' : '"ready"'},
  code: ${options.doctorReady === false ? '"AGENT_LOGIN_REQUIRED"' : "null"},
  checks: { herdr: { ok: true }, rll_cli: { ok: true },
    integrations: { claude: true, codex: true },
    login: { claude: ${options.doctorReady === false ? '"not_logged_in"' : '"logged_in"'},
      codex: "logged_in" } }
}));\n`);
  const fakeHerdr = path.join(root, "herdr.js");
  fs.writeFileSync(fakeHerdr, `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(args) + "\\n");
const read = () => JSON.parse(fs.readFileSync(process.env.FAKE_STATE));
const write = (value) => fs.writeFileSync(process.env.FAKE_STATE, JSON.stringify(value));
const plugin = (value) => ({ plugin_id: "ralph-lisa.loop", version: "0.1.10",
  enabled: value.enabled, plugin_root: process.env.FAKE_PLUGIN_ROOT,
  source: value.sourceKind === "github" ? { kind: "github",
    owner: "Click-Intelligence-LLC", repo: "ralph-lisa-herdr",
    subdir: "integrations/herdr", requested_ref: "v0.1.10",
    resolved_commit: "a32005abfb9be1ff2f4bd2512c1e225895ca8e63" } :
    { kind: "link" },
  actions: [{ id: "doctor", command: [process.execPath, process.env.FAKE_DOCTOR] }]
});
if (args.join(" ") === "--version") console.log("herdr 0.9.4");
else if (args.join(" ") === "plugin list --json") {
  const value = read();
  console.log(JSON.stringify({ result: { plugins: value.installed ? [plugin(value)] : [] } }));
} else if (args[0] === "plugin" && args[1] === "install") {
  if (args.join(" ") !== "plugin install Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr --ref v0.1.10 --yes") process.exit(9);
  else { const value = read(); value.installed = true; value.enabled = true;
    value.sourceKind = "github"; write(value); console.log("Installed"); }
} else if (args.join(" ") === "plugin enable ralph-lisa.loop") {
  const value = read(); value.enabled = true; write(value);
} else if (args.join(" ") === "plugin config-dir ralph-lisa.loop")
  console.log(process.env.FAKE_CONFIG);
else process.exit(8);
`);
  fs.chmodSync(fakeHerdr, 0o700);
  const env = { ...process.env, HERDR_BIN_PATH: fakeHerdr, FAKE_STATE: state,
    FAKE_LOG: log, FAKE_PLUGIN_ROOT: pluginRoot, FAKE_DOCTOR: doctor,
    FAKE_CONFIG: config };
  const run = (...args: string[]) => spawnSync(process.execPath, [alias, ...args],
    { cwd: root, env, encoding: "utf8", timeout: 15000 });
  const commands = () => fs.readFileSync(log, "utf8").trim().split("\n")
    .filter(Boolean).map((line) => JSON.parse(line) as string[]);
  return { root, run, commands };
}

describe("herdr-rll setup", () => {
  it("installs the pinned public plugin and runs its doctor", () => {
    const test = fixture();
    try {
      const result = test.run("setup");
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, "ready");
      assert.equal(output.herdr_version, "0.9.4");
      assert.equal(output.plugin.version, "0.1.10");
      assert.equal(output.plugin.requested_ref, "v0.1.10");
      assert.ok(test.commands().some((args) => args.join(" ") ===
        "plugin install Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr --ref v0.1.10 --yes"));
    } finally { fs.rmSync(test.root, { recursive: true, force: true }); }
  });

  it("enables an installed pinned plugin without reinstalling it", () => {
    const test = fixture({ installed: true, enabled: false });
    try {
      const result = test.run("setup");
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.ok(test.commands().some((args) => args.join(" ") ===
        "plugin enable ralph-lisa.loop"));
      assert.equal(test.commands().some((args) => args[1] === "install"), false);
    } finally { fs.rmSync(test.root, { recursive: true, force: true }); }
  });

  it("refuses to replace a locally linked plugin", () => {
    const test = fixture({ installed: true, sourceKind: "link" });
    try {
      const result = test.run("setup");
      assert.equal(result.status, 2);
      assert.match(result.stderr, /HERDR_PLUGIN_SOURCE_CONFLICT/);
      assert.equal(test.commands().some((args) => args[1] === "install"), false);
    } finally { fs.rmSync(test.root, { recursive: true, force: true }); }
  });

  it("reports doctor setup requirements without hiding them", () => {
    const test = fixture({ installed: true, doctorReady: false });
    try {
      const result = test.run("setup");
      assert.equal(result.status, 3, result.stdout + result.stderr);
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, "needs_setup");
      assert.equal(output.code, "AGENT_LOGIN_REQUIRED");
      assert.equal(output.checks.login.claude, "not_logged_in");
    } finally { fs.rmSync(test.root, { recursive: true, force: true }); }
  });

  it("rejects unsupported setup arguments before calling Herdr", () => {
    const test = fixture();
    try {
      const result = test.run("setup", "--ref", "main");
      assert.equal(result.status, 2);
      assert.match(result.stderr, /SETUP_USAGE_INVALID/);
      assert.equal(fs.readFileSync(path.join(test.root, "commands.jsonl"), "utf8"), "");
    } finally { fs.rmSync(test.root, { recursive: true, force: true }); }
  });
});
