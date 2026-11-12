import * as fs from "node:fs";
import { nativeSessionReference } from "./native-session.mjs";

function readJson(result) {
  try { return JSON.parse(result.stdout); }
  catch { return null; }
}

export function recoverySeats(invoke, herdr, projectRealpath, recordPlan) {
  if (!recordPlan?.seats || !recordPlan.workspace_id) return null;
  const seats = {};
  for (const [role, kind] of [["ralph", "claude"], ["lisa", "codex"]]) {
    const target = recordPlan.seats[role]?.agent_target;
    if (typeof target !== "string" || !target) throw new Error("PLUGIN_RECORD_INVALID");
    const result = invoke(herdr, ["agent", "get", target]);
    const agent = readJson(result)?.result?.agent;
    let cwd = null;
    try { cwd = fs.realpathSync.native(agent.cwd); } catch { /* Unavailable is not proof of exit. */ }
    const nativeSession = nativeSessionReference(result.code === 0 ? agent : null, kind);
    const recordedFingerprint = recordPlan.seats[role]?.native_session_fingerprint_sha256;
    seats[role] = { observation: result.code !== 0 || !agent ? "unavailable" :
      agent.name === target && agent.agent === kind &&
      agent.workspace_id === recordPlan.workspace_id &&
      agent.pane_id === recordPlan.seats[role]?.pane_id && cwd === projectRealpath ?
        (recordPlan.seats[role]?.terminal_id &&
          agent.terminal_id !== recordPlan.seats[role].terminal_id ?
            "terminal_changed" : "matches_binding") :
        "identity_changed",
      status: agent?.agent_status ?? null,
      interactive_ready: agent?.interactive_ready === true,
      pane_id: agent?.pane_id ?? null,
      terminal_id: agent?.terminal_id ?? null,
      native_session: { ...nativeSession,
        continuity: recordedFingerprint ?
          nativeSession.fingerprint_sha256 === recordedFingerprint ?
            "matches_record" : "changed_or_missing" : "not_recorded" } };
  }
  return seats;
}
