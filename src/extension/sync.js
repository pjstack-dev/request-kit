import { buildSessionRules } from "./rules.js";

export async function removeLegacyDynamicRules(api) {
  const legacyRules = await api.getDynamicRules();
  if (!legacyRules.length) return;
  await api.updateDynamicRules({
    removeRuleIds: legacyRules.map((rule) => rule.id),
  });
}

export async function replaceSessionRules(api, state, tabs) {
  const existingRules = await api.getSessionRules();
  await api.updateSessionRules({
    removeRuleIds: existingRules.map((rule) => rule.id),
    addRules: buildSessionRules(state, tabs),
  });
}

export function createSyncQueue(syncLatestState) {
  const queueTask = createTaskQueue();

  return function queueSync() {
    return queueTask(syncLatestState);
  };
}

export function createTaskQueue() {
  let tail = Promise.resolve();

  return function queueTask(task) {
    const queued = tail.catch(() => undefined).then(task);
    tail = queued;
    return queued;
  };
}
