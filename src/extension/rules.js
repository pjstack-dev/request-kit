const PAGE_RESOURCE_TYPES = [
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other",
];

const MAIN_FRAME_RESOURCE_TYPES = ["main_frame"];
const GLOBAL_RESOURCE_TYPES = [...MAIN_FRAME_RESOURCE_TYPES, ...PAGE_RESOURCE_TYPES];
const GLOBAL_URL_PATTERN = "^(?:https?|wss?)://";

export const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
export const UNSAFE_HEADER_NAMES = new Set([
  "connection",
  "content-length",
  "host",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
]);

function headerAction(rules) {
  return {
    type: "modifyHeaders",
    requestHeaders: rules.map((rule) => ({
      header: rule.name,
      operation: "set",
      value: rule.value,
    })),
  };
}

function exactHostnamePattern(hostname) {
  const escapedHostname = hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^https?://${escapedHostname}(?::\\d+)?(?:[/?#]|$)`;
}

function enabledHeaderRules(profile) {
  if (!profile?.enabled) return [];

  const uniqueRules = new Map();
  for (const rule of profile.rules ?? []) {
    if (!rule.enabled || validateHeader(rule.name, rule.value)) continue;
    uniqueRules.set(rule.name.toLowerCase(), rule);
  }
  return [...uniqueRules.values()];
}

export function buildSessionRules(state, tabs) {
  const sessionRules = [];
  let id = 1;

  if (state?.mode === "global") {
    const enabledRules = enabledHeaderRules(state.globalProfile);
    if (!enabledRules.length) return sessionRules;
    return [
      {
        id,
        priority: 1,
        action: headerAction(enabledRules),
        condition: {
          regexFilter: GLOBAL_URL_PATTERN,
          resourceTypes: GLOBAL_RESOURCE_TYPES,
        },
      },
    ];
  }

  const sortedTabs = [...(tabs ?? [])].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  for (const tab of sortedTabs) {
    if (!Number.isInteger(tab.id)) continue;

    let hostname;
    try {
      const url = new URL(tab.url ?? "");
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      hostname = url.hostname;
    } catch {
      continue;
    }

    const profile = state?.profiles?.[hostname];
    if (!profile) continue;
    const enabledRules = enabledHeaderRules(profile);
    if (!enabledRules.length) continue;

    sessionRules.push({
      id: id++,
      priority: 1,
      action: headerAction(enabledRules),
      condition: {
        tabIds: [tab.id],
        resourceTypes: PAGE_RESOURCE_TYPES,
      },
    });

    sessionRules.push({
      id: id++,
      priority: 1,
      action: headerAction(enabledRules),
      condition: {
        tabIds: [tab.id],
        regexFilter: exactHostnamePattern(hostname),
        resourceTypes: MAIN_FRAME_RESOURCE_TYPES,
      },
    });
  }

  return sessionRules;
}

export function validateHeader(name, value) {
  const trimmedName = name.trim();
  if (!trimmedName) return "请输入请求头名称";
  if (!HEADER_NAME_PATTERN.test(trimmedName)) return "请求头名称格式不正确";
  if (UNSAFE_HEADER_NAMES.has(trimmedName.toLowerCase())) {
    return "浏览器不允许修改这个请求头";
  }
  if (!value.trim()) return "请输入请求头值";
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return "请求头值不能包含控制字符或换行";
  }
  return "";
}
