import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionRules, validateHeader } from "./rules.js";

test("builds deterministic tab-scoped rules for each enabled header set", () => {
  const rules = buildSessionRules(
    {
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: true,
          rules: [
            { name: "X-Environment", value: "qa", enabled: true },
            { name: "X-Debug", value: "1", enabled: true },
          ],
        },
      },
    },
    [{ id: 7, url: "https://example.com/dashboard" }],
  );

  assert.equal(rules.length, 2);
  assert.deepEqual(rules.map((rule) => rule.id), [1, 2]);
  assert.deepEqual(rules[0].condition.tabIds, [7]);
  assert.equal(rules[0].condition.initiatorDomains, undefined);
  assert.equal(rules[0].condition.requestDomains, undefined);
  assert.ok(rules[0].condition.resourceTypes.includes("stylesheet"));
  assert.ok(rules[0].condition.resourceTypes.includes("script"));
  assert.ok(rules[0].condition.resourceTypes.includes("xmlhttprequest"));
  assert.equal(
    rules[1].condition.regexFilter,
    "^https?://example\\.com(?::\\d+)?(?:[/?#]|$)",
  );
  assert.equal(rules[0].action.requestHeaders[0].header, "X-Environment");
  assert.equal(rules[0].action.requestHeaders[1].header, "X-Debug");
});

test("applies site headers to third-party resources loaded inside the matching tab", () => {
  const rules = buildSessionRules(
    {
      profiles: {
        "app.example.com": {
          hostname: "app.example.com",
          enabled: true,
          rules: [{ name: "X-Environment", value: "qa", enabled: true }],
        },
      },
    },
    [{ id: 17, url: "https://app.example.com/dashboard" }],
  );

  const subresourceRule = rules[0];
  assert.deepEqual(subresourceRule.condition.tabIds, [17]);
  assert.equal(subresourceRule.condition.initiatorDomains, undefined);
  assert.equal(subresourceRule.condition.requestDomains, undefined);
  assert.ok(subresourceRule.condition.resourceTypes.includes("script"));
  assert.ok(subresourceRule.condition.resourceTypes.includes("stylesheet"));
  assert.ok(subresourceRule.condition.resourceTypes.includes("image"));
  assert.ok(subresourceRule.condition.resourceTypes.includes("font"));
  assert.ok(subresourceRule.condition.resourceTypes.includes("websocket"));
  assert.ok(subresourceRule.condition.resourceTypes.includes("webtransport"));
  assert.ok(subresourceRule.condition.resourceTypes.includes("webbundle"));
  assert.ok(subresourceRule.condition.resourceTypes.includes("csp_report"));
});

test("ignores a disabled site profile", () => {
  const rules = buildSessionRules(
    {
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: false,
          rules: [{ name: "X-Debug", value: "1", enabled: true }],
        },
      },
    },
    [{ id: 7, url: "https://example.com" }],
  );

  assert.deepEqual(rules, []);
});

test("skips invalid stored headers instead of rejecting the full ruleset", () => {
  const rules = buildSessionRules(
    {
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: true,
          rules: [
            { name: "X-Good", value: "yes", enabled: true },
            { name: "X-Bad", value: "line\nbreak", enabled: true },
          ],
        },
      },
    },
    [{ id: 7, url: "https://example.com" }],
  );

  assert.equal(rules[0].action.requestHeaders.length, 1);
  assert.equal(rules[0].action.requestHeaders[0].header, "X-Good");
});

test("uses the last enabled rule when header names are duplicated", () => {
  const rules = buildSessionRules(
    {
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: true,
          rules: [
            { name: "X-Environment", value: "qa", enabled: true },
            { name: "X-Debug", value: "1", enabled: true },
            { name: "x-environment", value: "production", enabled: true },
          ],
        },
      },
    },
    [{ id: 7, url: "https://example.com" }],
  );

  assert.deepEqual(rules[0].action.requestHeaders, [
    { header: "x-environment", operation: "set", value: "production" },
    { header: "X-Debug", operation: "set", value: "1" },
  ]);
});

test("uses only the exact hostname profile for a child-domain tab", () => {
  const rules = buildSessionRules(
    {
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: true,
          rules: [{ name: "Authorization", value: "parent", enabled: true }],
        },
        "api.example.com": {
          hostname: "api.example.com",
          enabled: true,
          rules: [{ name: "Authorization", value: "api", enabled: true }],
        },
      },
    },
    [{ id: 21, url: "https://api.example.com/v1" }],
  );

  assert.equal(rules.length, 2);
  assert.equal(rules[0].action.requestHeaders[0].value, "api");
  assert.deepEqual(rules[0].condition.tabIds, [21]);
});

test("main-frame matching excludes subdomains during navigation", () => {
  const rules = buildSessionRules(
    {
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: true,
          rules: [{ name: "Authorization", value: "parent", enabled: true }],
        },
      },
    },
    [{ id: 7, url: "https://example.com" }],
  );

  const pattern = new RegExp(rules[1].condition.regexFilter);
  assert.equal(pattern.test("https://example.com/dashboard"), true);
  assert.equal(pattern.test("https://example.com:8443/dashboard"), true);
  assert.equal(pattern.test("https://example.com?next=/dashboard"), true);
  assert.equal(pattern.test("https://example.com#section"), true);
  assert.equal(pattern.test("https://api.example.com/dashboard"), false);
});

test("creates independent rules for matching tabs and ignores unsupported pages", () => {
  const rules = buildSessionRules(
    {
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: true,
          rules: [{ name: "X-Test", value: "yes", enabled: true }],
        },
      },
    },
    [
      { id: 3, url: "https://example.com/one" },
      { id: 4, url: "https://example.com/two" },
      { id: 5, url: "chrome://extensions" },
    ],
  );

  assert.equal(rules.length, 4);
  assert.deepEqual(
    rules.map((rule) => rule.condition.tabIds[0]),
    [3, 3, 4, 4],
  );
});

test("builds one browser-wide global rule without requiring existing tabs", () => {
  const rules = buildSessionRules(
    {
      mode: "global",
      globalProfile: {
        hostname: "*",
        enabled: true,
        rules: [{ name: "X-Shared", value: "all-sites", enabled: true }],
      },
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: true,
          rules: [{ name: "X-Site-Only", value: "ignored", enabled: true }],
        },
      },
    },
    [],
  );

  assert.equal(rules.length, 1);
  assert.equal(rules[0].condition.tabIds, undefined);
  assert.equal(rules[0].condition.regexFilter, "^(?:https?|wss?)://");
  assert.equal(rules[0].action.requestHeaders[0].header, "X-Shared");
  assert.ok(rules[0].condition.resourceTypes.includes("main_frame"));
  assert.ok(rules[0].condition.resourceTypes.includes("xmlhttprequest"));
});

test("ignores site profiles when the global profile is disabled", () => {
  const rules = buildSessionRules(
    {
      mode: "global",
      globalProfile: {
        hostname: "*",
        enabled: false,
        rules: [{ name: "X-Shared", value: "all-sites", enabled: true }],
      },
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: true,
          rules: [{ name: "X-Site-Only", value: "site", enabled: true }],
        },
      },
    },
    [{ id: 8, url: "https://example.com" }],
  );

  assert.deepEqual(rules, []);
});

test("validates header names and values while allowing duplicate names", () => {
  assert.equal(validateHeader("X-Environment", "qa"), "");
  assert.equal(validateHeader("Bad Header", "qa"), "请求头名称格式不正确");
  assert.equal(validateHeader("Host", "example.com"), "浏览器不允许修改这个请求头");
  assert.equal(
    validateHeader("X-Test", "valid\r\ninjected"),
    "请求头值不能包含控制字符或换行",
  );
  assert.equal(
    validateHeader("x-environment", "prod", [
      { id: "one", name: "X-Environment", value: "qa", enabled: true },
    ]),
    "",
  );
});
