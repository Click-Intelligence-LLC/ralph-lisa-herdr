import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyTargets, targetsForSession, targetsFromPlan,
  validSeatTargets } from "./seat-targets.mjs";

test("plugin target generation matches the CLI contract fixture", () => {
  const targets = targetsForSession("6eac48cf-7590-4052-8aa9-b6882a9dcf12");
  assert.deepEqual(targets, {
    ralph: "ralph_6eac48cf75904052",
    lisa: "lisa_6eac48cf75904052",
  });
  assert.equal(validSeatTargets(targets), true);
  assert.equal(validSeatTargets(legacyTargets()), false);
  assert.equal(validSeatTargets(legacyTargets(), true), true);
  assert.throws(() => targetsForSession("invalid"), /AGENT_TARGET_INVALID/);
});

test("recovery derives the exact persisted targets from a binding plan", () => {
  const targets = targetsForSession("6eac48cf-7590-4052-8aa9-b6882a9dcf12");
  assert.deepEqual(targetsFromPlan({ seats: {
    ralph: { agent_target: targets.ralph }, lisa: { agent_target: targets.lisa },
  } }), targets);
  assert.deepEqual(targetsFromPlan({ seats: {
    ralph: { agent_target: "ralph" }, lisa: { agent_target: "lisa" },
  } }), legacyTargets());
  assert.throws(() => targetsFromPlan({ seats: {
    ralph: { agent_target: targets.ralph }, lisa: { agent_target: "lisa" },
  } }), /AGENT_TARGET_INVALID/);
});
