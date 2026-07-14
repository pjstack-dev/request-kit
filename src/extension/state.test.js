import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceStateRevision,
  getActiveSite,
  normalizeState,
  saveState,
} from "./state.js";

test("uses the active Chrome tab as the production site context", async (t) => {
  const previousChrome = globalThis.chrome;
  t.after(() => {
    globalThis.chrome = previousChrome;
  });

  globalThis.chrome = {
    storage: { local: {} },
    tabs: { query: async () => [{ url: "https://api.example.com/dashboard" }] },
  };

  assert.deepEqual(await getActiveSite(), {
    hostname: "api.example.com",
    supported: true,
    demo: false,
  });
});

test("delegates versioned state commits to the background owner", async (t) => {
  const previousChrome = globalThis.chrome;
  const messages = [];
  t.after(() => {
    globalThis.chrome = previousChrome;
  });

  globalThis.chrome = {
    storage: { local: {} },
    runtime: {
      sendMessage: async (message) => {
        messages.push(message);
        return { ok: true, state: { ...message.state, revision: 4 } };
      },
    },
  };

  const state = { version: 1, revision: 3, profiles: {} };
  assert.equal((await saveState(state)).revision, 4);
  assert.deepEqual(messages, [
    {
      type: "REQUESTKIT_SAVE_STATE",
      expectedRevision: 3,
      state,
    },
  ]);
});

test("surfaces background revision conflicts with the latest state", async (t) => {
  const previousChrome = globalThis.chrome;
  t.after(() => {
    globalThis.chrome = previousChrome;
  });

  globalThis.chrome = {
    storage: { local: {} },
    runtime: {
      sendMessage: async () => ({
        ok: false,
        code: "STATE_CONFLICT",
        error: "conflict",
        state: { version: 1, revision: 5, profiles: {} },
      }),
    },
  };

  await assert.rejects(
    () => saveState({ version: 1, revision: 4, profiles: {} }),
    (error) => error.code === "STATE_CONFLICT" && error.latestState.revision === 5,
  );
});

test("advances only the expected storage revision", () => {
  const current = { version: 1, revision: 7, profiles: {} };
  const candidate = { version: 1, revision: 7, profiles: {} };

  assert.equal(advanceStateRevision(current, candidate, 6), null);
  assert.equal(advanceStateRevision(current, candidate, 7).revision, 8);
});

test("keeps duplicate stored rules enabled while disabling invalid rules", () => {
  const state = normalizeState({
    version: 1,
    profiles: {
      "example.com": {
        enabled: true,
        rules: [
          { id: "one", name: "X-Test", value: "yes", enabled: true },
          { id: "two", name: "x-test", value: "duplicate", enabled: true },
          { id: "three", name: "X-Bad", value: "line\nbreak", enabled: true },
        ],
      },
    },
  });

  assert.deepEqual(
    state.profiles["example.com"].rules.map((rule) => rule.enabled),
    [true, true, false],
  );
});

test("keeps legacy state in site mode and initializes an empty global profile", () => {
  const state = normalizeState({
    version: 1,
    profiles: {},
  });

  assert.equal(state.mode, "site");
  assert.equal(state.globalProfile.hostname, "*");
  assert.equal(state.globalProfile.enabled, true);
  assert.deepEqual(state.globalProfile.rules, []);
});

test("falls back to an empty state for malformed profile collections", () => {
  const state = normalizeState({ version: 1, profiles: null });

  assert.equal(state.mode, "site");
  assert.deepEqual(state.profiles, {});
  assert.deepEqual(state.globalProfile.rules, []);
});

test("normalizes global mode rules independently from site profiles", () => {
  const state = normalizeState({
    version: 1,
    mode: "global",
    globalProfile: {
      enabled: true,
      rules: [
        { id: "global-one", name: "X-Shared", value: "yes", enabled: true },
        { id: "global-two", name: "x-shared", value: "duplicate", enabled: true },
      ],
    },
    profiles: {},
  });

  assert.equal(state.mode, "global");
  assert.deepEqual(
    state.globalProfile.rules.map((rule) => rule.enabled),
    [true, true],
  );
});
