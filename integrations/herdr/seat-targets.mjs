const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENT_TARGET = /^(?:ralph|lisa)_[0-9a-f]{16}$/;

export function targetsForSession(sessionId) {
  if (!UUID.test(sessionId)) throw new Error("AGENT_TARGET_INVALID");
  const token = sessionId.replaceAll("-", "").toLowerCase().slice(0, 16);
  return { ralph: `ralph_${token}`, lisa: `lisa_${token}` };
}

export function legacyTargets() {
  return { ralph: "ralph", lisa: "lisa" };
}

export function validSeatTargets(value, allowLegacy = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const scoped = AGENT_TARGET.test(value.ralph) && AGENT_TARGET.test(value.lisa);
  const legacy = allowLegacy && value.ralph === "ralph" && value.lisa === "lisa";
  return scoped || legacy;
}

export function targetsFromEnvironment(sessionId = null) {
  const raw = process.env.RLL_AGENT_TARGETS_JSON;
  if (!raw) return sessionId ? targetsForSession(sessionId) : legacyTargets();
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error("AGENT_TARGET_INVALID"); }
  if (!validSeatTargets(value, true)) throw new Error("AGENT_TARGET_INVALID");
  return { ralph: value.ralph, lisa: value.lisa };
}

export function targetForRole(plan, role) {
  if (!["ralph", "lisa"].includes(role)) throw new Error("AGENT_TARGET_INVALID");
  return targetsFromPlan(plan)[role];
}

export function targetsFromPlan(plan) {
  const targets = {
    ralph: plan?.seats?.ralph?.agent_target,
    lisa: plan?.seats?.lisa?.agent_target,
  };
  if (!validSeatTargets(targets, true))
    throw new Error("AGENT_TARGET_INVALID");
  return targets;
}
