import { validateHeader } from "./rules.js";

export const STORAGE_KEY = "requestKitState";
export const DEMO_HOST = "api.example.com";
export const GLOBAL_HOST = "*";

const demoRules = [
  {
    id: "authorization",
    name: "Authorization",
    value: "Bearer eyJhbGciOiJiUzI1NilsInR5cCI6IkpXVCJ9",
    enabled: true,
  },
  {
    id: "environment",
    name: "X-Environment",
    value: "production",
    enabled: true,
  },
  { id: "api-version", name: "X-API-Version", value: "v2", enabled: true },
  { id: "request-id", name: "X-Request-Id", value: "{{uuid}}", enabled: false },
  { id: "debug", name: "X-Debug", value: "true", enabled: false },
  {
    id: "language",
    name: "Accept-Language",
    value: "zh-CN,zh;q=0.9,en;q=0.8",
    enabled: true,
  },
];

export function createProfile(hostname, rules = []) {
  return {
    hostname,
    enabled: true,
    rules,
    updatedAt: Date.now(),
  };
}

export function createGlobalProfile(rules = []) {
  return createProfile(GLOBAL_HOST, rules);
}

export function createEmptyState() {
  return {
    version: 1,
    revision: 0,
    mode: "site",
    globalProfile: createGlobalProfile(),
    profiles: {},
  };
}

export function createDemoState() {
  return {
    version: 1,
    revision: 0,
    mode: "site",
    globalProfile: createGlobalProfile(),
    profiles: {
      [DEMO_HOST]: createProfile(DEMO_HOST, demoRules),
    },
  };
}

function normalizeProfile(hostname, profile) {
  const rules = Array.isArray(profile?.rules)
    ? profile.rules.map((rule) => {
        const normalizedRule = {
          id: String(rule?.id ?? crypto.randomUUID()),
          name: String(rule?.name ?? ""),
          value: String(rule?.value ?? ""),
          enabled: Boolean(rule?.enabled),
        };
        const error = validateHeader(normalizedRule.name, normalizedRule.value);
        return error ? { ...normalizedRule, enabled: false } : normalizedRule;
      })
    : [];

  return {
    hostname,
    enabled: profile ? Boolean(profile.enabled) : true,
    rules,
    updatedAt: Number(profile?.updatedAt) || Date.now(),
  };
}

export function normalizeState(value) {
  if (
    !value ||
    value.version !== 1 ||
    !value.profiles ||
    typeof value.profiles !== "object" ||
    Array.isArray(value.profiles)
  ) {
    return createEmptyState();
  }

  const profiles = {};
  for (const [hostname, profile] of Object.entries(value.profiles)) {
    profiles[hostname] = normalizeProfile(hostname, profile);
  }

  const revision = Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0;
  return {
    version: 1,
    revision,
    mode: value.mode === "global" ? "global" : "site",
    globalProfile: normalizeProfile(GLOBAL_HOST, value.globalProfile),
    profiles,
  };
}

export function advanceStateRevision(currentState, candidateState, expectedRevision) {
  const current = normalizeState(currentState);
  if (current.revision !== expectedRevision) return null;
  const candidate = normalizeState(candidateState);
  return { ...candidate, revision: current.revision + 1 };
}

export function hasExtensionRuntime() {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

export async function getActiveSite() {
  if (!hasExtensionRuntime() || !chrome.tabs?.query) {
    return { hostname: DEMO_HOST, supported: true, demo: true };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const url = new URL(tab?.url ?? "");
    const supported = url.protocol === "http:" || url.protocol === "https:";
    return {
      hostname: supported ? url.hostname : "当前页面",
      supported,
      demo: false,
    };
  } catch {
    return { hostname: "当前页面", supported: false, demo: false };
  }
}

export async function loadState() {
  if (hasExtensionRuntime()) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeState(result[STORAGE_KEY]);
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return createDemoState();

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return createDemoState();
  }
}

export async function saveState(state) {
  if (hasExtensionRuntime()) {
    const response = await chrome.runtime.sendMessage({
      type: "REQUESTKIT_SAVE_STATE",
      expectedRevision: state.revision ?? 0,
      state,
    });
    if (!response?.ok) {
      const error = new Error(response?.error || "请求头规则同步失败");
      error.code = response?.code;
      error.latestState = response?.state ? normalizeState(response.state) : undefined;
      throw error;
    }
    return normalizeState(response.state);
  }

  const nextState = { ...normalizeState(state), revision: (state.revision ?? 0) + 1 };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export async function syncState() {
  if (!hasExtensionRuntime()) return;
  const response = await chrome.runtime.sendMessage({ type: "REQUESTKIT_SYNC" });
  if (!response?.ok) {
    throw new Error(response?.error || "请求头规则同步失败");
  }
}
