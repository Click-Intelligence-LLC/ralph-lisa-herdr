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
  const valid = (role) => typeof value[role] === "string" &&
    (AGENT_TARGET.test(value[role]) || allowLegacy && value[role] === role);
  return valid("ralph") && valid("lisa") && value.ralph !== value.lisa;
}

export function targetsFromEnvironment() {
  const raw = process.env.RLL_AGENT_TARGETS_JSON;
  if (!raw) return legacyTargets();
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error("AGENT_TARGET_INVALID"); }
  if (!validSeatTargets(value, true)) throw new Error("AGENT_TARGET_INVALID");
  return { ralph: value.ralph, lisa: value.lisa };
}

export function targetForRole(plan, role) {
  const target = plan?.seats?.[role]?.agent_target;
  if (typeof target !== "string" || !target) throw new Error("AGENT_TARGET_INVALID");
  return target;
}

export function targetsFromPlan(plan) {
  const targets = {
    ralph: plan?.seats?.ralph?.agent_target,
    lisa: plan?.seats?.lisa?.agent_target,
  };
  const legacyCount = Number(targets.ralph === "ralph") + Number(targets.lisa === "lisa");
  if (!validSeatTargets(targets, true) || legacyCount === 1)
    throw new Error("AGENT_TARGET_INVALID");
  return targets;
}
