import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { recoverySeats } from "./recovery-seats.mjs";

test("recovery observes each seat through its bound opaque Agent target", () => {
  const project = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "rll-recovery-seat-")));
  try {
    for (const targets of [
      { ralph: "ralph_6eac48cf75904052", lisa: "lisa_6eac48cf75904052" },
      { ralph: "ralph", lisa: "lisa" },
    ]) {
      const requested = [];
      const invoke = (_herdr, args) => {
        const target = args[2];
        requested.push(target);
        const role = target === targets.ralph ? "ralph" : "lisa";
        return { code: 0, stdout: JSON.stringify({ result: { agent: {
          name: target, agent: role === "ralph" ? "claude" : "codex",
          workspace_id: "w1", pane_id: role === "ralph" ? "p1" : "p2",
          terminal_id: role === "ralph" ? "t1" : "t2", cwd: project,
          agent_status: "idle", interactive_ready: true,
        } } }) };
      };
      const seats = recoverySeats(invoke, ["herdr"], project, { workspace_id: "w1", seats: {
        ralph: { pane_id: "p1", terminal_id: "t1", agent_target: targets.ralph },
        lisa: { pane_id: "p2", terminal_id: "t2", agent_target: targets.lisa },
      } });
      assert.deepEqual(requested, [targets.ralph, targets.lisa]);
      assert.equal(seats.ralph.observation, "matches_binding");
      assert.equal(seats.lisa.observation, "matches_binding");
    }
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test("recovery rejects a plan without a persisted Agent target", () => {
  assert.throws(() => recoverySeats(() => ({ code: 1, stdout: "" }), ["herdr"], "/tmp", {
    workspace_id: "w1", seats: { ralph: { pane_id: "p1" }, lisa: { pane_id: "p2" } },
  }), /PLUGIN_RECORD_INVALID/);
});
