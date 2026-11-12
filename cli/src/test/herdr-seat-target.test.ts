import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { targetsForSession, validAgentTarget, validSeatTargets } from "../herdr/seat-target.js";

describe("Herdr session-scoped seat targets", () => {
  it("creates stable distinct targets without project information", () => {
    const targets = targetsForSession("6eac48cf-7590-4052-8aa9-b6882a9dcf12");
    assert.deepEqual(targets, {
      ralph: "ralph_6eac48cf75904052",
      lisa: "lisa_6eac48cf75904052",
    });
    assert.deepEqual(targetsForSession("6eac48cf-7590-4052-8aa9-b6882a9dcf12"), targets);
    assert.notDeepEqual(targetsForSession("f501d9cc-8426-4d91-a111-aaaaaaaaaaaa"), targets);
    assert.equal(validSeatTargets(targets), true);
    assert.equal(validAgentTarget(targets.ralph), true);
    assert.doesNotMatch(JSON.stringify(targets), /project|fugur/);
  });

  it("rejects malformed session ids and target pairs", () => {
    assert.throws(() => targetsForSession("not-a-session"), /AGENT_TARGET_INVALID/);
    assert.equal(validSeatTargets({ ralph: "ralph", lisa: "lisa" }), false);
    assert.equal(validSeatTargets({
      ralph: "ralph_6eac48cf75904052", lisa: "ralph_6eac48cf75904052",
    }), false);
  });
});
