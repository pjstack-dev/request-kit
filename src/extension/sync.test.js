import assert from "node:assert/strict";
import test from "node:test";
import {
  createSyncQueue,
  removeLegacyDynamicRules,
  replaceSessionRules,
} from "./sync.js";

test("removeLegacyDynamicRules clears persisted domain-wide rules", async () => {
  const calls = [];
  const api = {
    async getDynamicRules() {
      return [{ id: 4 }, { id: 9 }];
    },
    async updateDynamicRules(update) {
      calls.push(update);
    },
  };

  await removeLegacyDynamicRules(api);
  assert.deepEqual(calls, [{ removeRuleIds: [4, 9] }]);
});

test("replaceSessionRules removes the previous rules before adding the latest tab rules", async () => {
  const calls = [];
  const api = {
    async getSessionRules() {
      return [{ id: 91 }, { id: 92 }];
    },
    async updateSessionRules(update) {
      calls.push(update);
    },
  };

  await replaceSessionRules(
    api,
    {
      profiles: {
        "example.com": {
          hostname: "example.com",
          enabled: true,
          rules: [{ name: "X-Test", value: "yes", enabled: true }],
        },
      },
    },
    [{ id: 7, url: "https://example.com" }],
  );

  assert.deepEqual(calls[0].removeRuleIds, [91, 92]);
  assert.equal(calls[0].addRules.length, 2);
});

test("createSyncQueue serializes overlapping requests and lets the latest state finish last", async () => {
  let currentVersion = 1;
  const applied = [];
  let releaseFirst;
  let markFirstStarted;
  const firstBlocked = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const firstStarted = new Promise((resolve) => {
    markFirstStarted = resolve;
  });

  const queueSync = createSyncQueue(async () => {
    const version = currentVersion;
    if (version === 1) {
      markFirstStarted();
      await firstBlocked;
    }
    applied.push(version);
  });

  const first = queueSync();
  await firstStarted;
  currentVersion = 2;
  const second = queueSync();
  releaseFirst();
  await Promise.all([first, second]);

  assert.deepEqual(applied, [1, 2]);
});
