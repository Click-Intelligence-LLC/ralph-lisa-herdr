import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyTargets, targetsForSession, validSeatTargets } from "./seat-targets.mjs";

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
