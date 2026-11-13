const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENT_TARGET = /^(?:ralph|lisa)_[0-9a-f]{16}$/;

export type HerdrSeatTargets = { ralph: string; lisa: string };

export function targetsForSession(sessionId: string): HerdrSeatTargets {
  if (!UUID.test(sessionId)) throw new Error("AGENT_TARGET_INVALID");
  const token = sessionId.replaceAll("-", "").toLowerCase().slice(0, 16);
  return { ralph: `ralph_${token}`, lisa: `lisa_${token}` };
}

export function validAgentTarget(value: unknown): value is string {
  return typeof value === "string" && AGENT_TARGET.test(value);
}

export function validSeatTargets(value: unknown): value is HerdrSeatTargets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const targets = value as Record<string, unknown>;
  return validAgentTarget(targets.ralph) && validAgentTarget(targets.lisa) &&
    targets.ralph !== targets.lisa;
}
