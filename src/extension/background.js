import {
  advanceStateRevision,
  normalizeState,
  STORAGE_KEY,
} from "./state.js";
import {
  createTaskQueue,
  removeLegacyDynamicRules,
  replaceSessionRules,
} from "./sync.js";

async function readState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(result[STORAGE_KEY]);
}

async function syncState(state) {
  const tabs = await chrome.tabs.query({});
  await removeLegacyDynamicRules(chrome.declarativeNetRequest);
  await replaceSessionRules(chrome.declarativeNetRequest, state, tabs);
  await Promise.allSettled(tabs.map((tab) => updateBadge(tab, state)));
}

async function syncLatestState() {
  await syncState(await readState());
}

async function commitState(candidateState, expectedRevision) {
  const previousState = await readState();
  const nextState = advanceStateRevision(
    previousState,
    candidateState,
    expectedRevision,
  );
  if (!nextState) {
    return { conflict: true, state: previousState };
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: nextState });
  try {
    await syncState(nextState);
    return { conflict: false, state: nextState };
  } catch (syncError) {
    let rollbackSucceeded = true;
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: previousState });
      await syncState(previousState);
    } catch {
      rollbackSucceeded = false;
    }
    const error = new Error(
      syncError instanceof Error ? syncError.message : String(syncError),
    );
    error.code = rollbackSucceeded ? "SYNC_FAILED" : "ROLLBACK_FAILED";
    throw error;
  }
}

const queueTask = createTaskQueue();
const queueSync = () => queueTask(syncLatestState);
const queueCommit = (state, expectedRevision) =>
  queueTask(() => commitState(state, expectedRevision));

async function updateBadge(tab, currentState) {
  let text = "";

  try {
    const url = new URL(tab?.url ?? "");
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported");
    const state = currentState ?? (await readState());
    const profile = state.mode === "global" ? state.globalProfile : state.profiles[url.hostname];
    const activeCount = profile?.enabled
      ? profile.rules.filter((rule) => rule.enabled).length
      : 0;
    text = activeCount ? String(activeCount) : "";
  } catch {
    text = "";
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#5260F3" });
  await chrome.action.setBadgeText({ tabId: tab?.id, text });
}

chrome.runtime.onInstalled.addListener(() => {
  void queueSync().catch(console.error);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "REQUESTKIT_SAVE_STATE") {
    queueCommit(message.state, message.expectedRevision)
      .then((result) => {
        if (result.conflict) {
          sendResponse({
            ok: false,
            code: "STATE_CONFLICT",
            error: "规则已在其他页面更新",
            state: result.state,
          });
          return;
        }
        sendResponse({ ok: true, state: result.state });
      })
      .catch((error) =>
        sendResponse({
          ok: false,
          code: error?.code || "SYNC_FAILED",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  }

  if (message?.type !== "REQUESTKIT_SYNC") return false;

  queueSync()
    .then(() => sendResponse({ ok: true }))
    .catch((error) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    void queueSync().catch(console.error);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await updateBadge(tab);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "loading") {
    void queueSync().catch(console.error);
  }
  if (changeInfo.url || changeInfo.status === "complete") {
    void updateBadge(tab).catch(console.error);
  }
});

chrome.tabs.onRemoved.addListener(() => {
  void queueSync().catch(console.error);
});

void queueSync().catch(console.error);
