import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  DotsThreeVertical,
  GlobeSimple,
  Info,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  createEmptyState,
  createGlobalProfile,
  createProfile,
  hasExtensionRuntime,
  loadState,
  normalizeState,
  saveState,
  STORAGE_KEY,
} from "../extension/state.js";
import { validateHeader } from "../extension/rules.js";

const FILTERS = {
  all: "全部状态",
  enabled: "已启用",
  disabled: "已停用",
};

function createPreviewState() {
  const today = new Date();
  const at = (daysAgo, hour, minute) => {
    const value = new Date(today);
    value.setDate(value.getDate() - daysAgo);
    value.setHours(hour, minute, 0, 0);
    return value.getTime();
  };

  return {
    version: 1,
    revision: 0,
    mode: "site",
    globalProfile: {
      ...createGlobalProfile([
        {
          id: "global-client",
          name: "X-RequestKit-Client",
          value: "browser-extension",
          enabled: true,
        },
      ]),
      updatedAt: at(0, 9, 30),
    },
    profiles: {
      "admin.example.com": {
        ...createProfile("admin.example.com", [
          {
            id: "admin-authorization",
            name: "Authorization",
            value: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9",
            enabled: true,
          },
          {
            id: "admin-environment",
            name: "X-Environment",
            value: "staging",
            enabled: true,
          },
          {
            id: "admin-debug",
            name: "X-Debug-Mode",
            value: "true",
            enabled: false,
          },
        ]),
        updatedAt: Date.now() - 2 * 60 * 1000,
      },
      "api.example.com": {
        ...createProfile("api.example.com", [
          {
            id: "api-key",
            name: "X-API-Key",
            value: "rk_live_7v2q9k6m",
            enabled: true,
          },
          {
            id: "api-version",
            name: "X-API-Version",
            value: "v2",
            enabled: false,
          },
        ]),
        updatedAt: at(0, 10, 24),
      },
      localhost: {
        ...createProfile("localhost", [
          { id: "local-env", name: "X-Environment", value: "local", enabled: true },
          { id: "local-debug", name: "X-Debug", value: "true", enabled: true },
          { id: "local-user", name: "X-Debug-User", value: "developer", enabled: true },
          { id: "local-locale", name: "Accept-Language", value: "zh-CN", enabled: true },
        ]),
        updatedAt: at(1, 18, 10),
      },
      "staging.requestkit.dev": {
        ...createProfile("staging.requestkit.dev", [
          { id: "stage-env", name: "X-Environment", value: "staging", enabled: true },
          { id: "stage-debug", name: "X-Debug", value: "true", enabled: true },
        ]),
        enabled: false,
        updatedAt: at(2, 14, 30),
      },
      "docs.example.com": {
        ...createProfile("docs.example.com", [
          { id: "docs-locale", name: "Accept-Language", value: "zh-CN", enabled: true },
        ]),
        updatedAt: at(4, 9, 12),
      },
    },
  };
}

function Switch({ checked, disabled = false, label, onChange }) {
  return (
    <button
      type="button"
      className="options-switch"
      data-checked={checked}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function IconButton({ label, tone = "default", children, ...props }) {
  return (
    <button
      type="button"
      className="options-icon-button"
      data-tone={tone}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

function DialogShell({ children, onClose, labelledBy, className = "" }) {
  return (
    <div className="options-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`options-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}

function DialogHeading({ disabled = false, eyebrow, title, titleId, onClose }) {
  return (
    <div className="options-dialog-heading">
      <div>
        <p>{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
      </div>
      <IconButton label="关闭" disabled={disabled} onClick={onClose}>
        <X size={20} weight="bold" />
      </IconButton>
    </div>
  );
}

function RuleEditor({ initialRule, hostname, onClose, onSave }) {
  const [name, setName] = useState(initialRule?.name ?? "");
  const [value, setValue] = useState(initialRule?.value ?? "");
  const [enabled, setEnabled] = useState(initialRule?.enabled ?? true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateHeader(name, value);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    const saved = await onSave({
      id: initialRule?.id ?? crypto.randomUUID(),
      name: name.trim(),
      value: value.trim(),
      enabled,
    });
    if (!saved) setSubmitting(false);
  }

  return (
    <div
      className="options-dialog-backdrop"
      role="presentation"
      onMouseDown={submitting ? undefined : onClose}
    >
      <form
        className="options-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="options-rule-editor-title"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeading
          eyebrow={hostname}
          title={initialRule ? "编辑请求头" : "添加请求头"}
          titleId="options-rule-editor-title"
          disabled={submitting}
          onClose={onClose}
        />

        <label className="options-field">
          <span>请求头名称</span>
          <input
            autoFocus
            disabled={submitting}
            value={name}
            placeholder="例如 Authorization"
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
        </label>

        <label className="options-field">
          <span>请求头值</span>
          <textarea
            rows="4"
            disabled={submitting}
            value={value}
            placeholder="例如 Bearer eyJhbGci..."
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
          />
        </label>

        <div className="options-enable-row">
          <div>
            <strong>保存后启用</strong>
            <span>后续请求将立即使用这个值</span>
          </div>
          <Switch
            checked={enabled}
            disabled={submitting}
            label="保存后启用"
            onChange={setEnabled}
          />
        </div>

        {error ? (
          <p className="options-form-error" role="alert">
            <WarningCircle size={17} weight="fill" />
            {error}
          </p>
        ) : null}

        <div className="options-dialog-actions">
          <button
            type="button"
            className="options-button-secondary"
            disabled={submitting}
            onClick={onClose}
          >
            取消
          </button>
          <button type="submit" className="options-button-primary" disabled={submitting}>
            <Check size={18} weight="bold" />
            {initialRule ? "保存修改" : "添加并应用"}
          </button>
        </div>
      </form>
    </div>
  );
}

function normalizeHostname(value) {
  const candidate = value.trim().toLowerCase();
  if (!candidate) return "";
  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    return url.hostname;
  } catch {
    return "";
  }
}

function SiteEditor({ initialHostname = "", profiles, onClose, onSave }) {
  const [value, setValue] = useState(initialHostname);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const hostname = normalizeHostname(value);
    if (!hostname) {
      setError("请输入有效的站点主机名");
      return;
    }
    if (hostname !== initialHostname && profiles[hostname]) {
      setError("这个站点已经存在");
      return;
    }
    setSubmitting(true);
    const saved = await onSave(hostname);
    if (!saved) setSubmitting(false);
  }

  return (
    <div
      className="options-dialog-backdrop"
      role="presentation"
      onMouseDown={submitting ? undefined : onClose}
    >
      <form
        className="options-dialog options-site-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="options-site-editor-title"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeading
          eyebrow="站点配置"
          title={initialHostname ? "编辑主机名" : "添加站点"}
          titleId="options-site-editor-title"
          disabled={submitting}
          onClose={onClose}
        />
        <label className="options-field">
          <span>站点主机名</span>
          <input
            autoFocus
            disabled={submitting}
            value={value}
            placeholder="例如 api.example.com"
            autoComplete="off"
            spellCheck="false"
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
          />
        </label>
        <p className="options-field-note">只匹配这个主机名，不包含路径和子域名。</p>
        {error ? (
          <p className="options-form-error" role="alert">
            <WarningCircle size={17} weight="fill" />
            {error}
          </p>
        ) : null}
        <div className="options-dialog-actions">
          <button
            type="button"
            className="options-button-secondary"
            disabled={submitting}
            onClick={onClose}
          >
            取消
          </button>
          <button type="submit" className="options-button-primary" disabled={submitting}>
            <Check size={18} weight="bold" />
            {initialHostname ? "保存修改" : "添加站点"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteProfileDialog({ busy, globalMode, hostname, onCancel, onConfirm }) {
  return (
    <DialogShell
      onClose={busy ? undefined : onCancel}
      labelledBy="options-delete-profile-title"
      className="options-confirm-dialog"
    >
      <span className="options-confirm-icon">
        <Trash size={24} weight="duotone" />
      </span>
      <h2 id="options-delete-profile-title">
        {globalMode ? "清空所有站点规则？" : "删除此站点规则？"}
      </h2>
      <p>
        {globalMode ? (
          "将清空所有站点模式下的全部请求头规则，此操作无法撤销。"
        ) : (
          <>
            将删除 <strong>{hostname}</strong> 的全部请求头规则，此操作无法撤销。
          </>
        )}
      </p>
      <div className="options-dialog-actions">
        <button
          type="button"
          className="options-button-secondary"
          disabled={busy}
          onClick={onCancel}
        >
          取消
        </button>
        <button
          type="button"
          className="options-button-danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {globalMode ? "清空规则" : "删除站点"}
        </button>
      </div>
    </DialogShell>
  );
}

function activeRuleCount(profile) {
  if (!profile?.enabled) return 0;
  return profile.rules.filter((rule) => rule.enabled).length;
}

function formatUpdatedAt(timestamp) {
  const value = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - value.getTime();
  if (diff >= 0 && diff < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(diff / (60 * 1000)));
    return `${minutes} 分钟前`;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const dayDiff = Math.round((today.getTime() - targetDay.getTime()) / 86400000);
  if (dayDiff === 0) {
    return `今天 ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (dayDiff === 1) return "昨天";
  return `${value.getMonth() + 1}月${value.getDate()}日`;
}

function previewValue(rule) {
  if (/authorization|api[-_]?key|token|cookie/i.test(rule.name)) {
    const prefix = rule.value.split(/\s+/)[0];
    return `${prefix} ••••••••`;
  }
  return rule.value;
}

function matchesSearch(profile, search) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  if (profile.hostname.toLowerCase().includes(query)) return true;
  return profile.rules.some(
    (rule) =>
      rule.name.toLowerCase().includes(query) || rule.value.toLowerCase().includes(query),
  );
}

export function OptionsApp() {
  const [state, setState] = useState(null);
  const [selectedHostname, setSelectedHostname] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [ruleEditor, setRuleEditor] = useState(null);
  const [siteEditor, setSiteEditor] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ruleMenuId, setRuleMenuId] = useState("");
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const mutationLockRef = useRef(false);

  useEffect(() => {
    let active = true;
    loadState().then((loadedState) => {
      if (!active) return;
      const nextState =
        !hasExtensionRuntime() && Object.keys(loadedState.profiles).length <= 1
          ? createPreviewState()
          : loadedState;
      const firstHostname = Object.keys(nextState.profiles)[0] ?? "";
      setState(nextState);
      setSelectedHostname(firstHostname);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasExtensionRuntime() || !chrome.storage?.onChanged) return undefined;

    function handleStorageChange(changes, areaName) {
      if (areaName === "local" && changes[STORAGE_KEY]) {
        setState(normalizeState(changes[STORAGE_KEY].newValue));
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      if (mutationLockRef.current) return;
      setRuleEditor(null);
      setSiteEditor(null);
      setDeleteOpen(false);
      setMenuOpen(false);
      setRuleMenuId("");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const profiles = state?.profiles ?? {};
  const selectedProfile = profiles[selectedHostname];
  const globalMode = state?.mode === "global";
  const activeProfile = globalMode ? state?.globalProfile : selectedProfile;

  useEffect(() => {
    if (!state) return;
    if (selectedHostname && state.profiles[selectedHostname]) return;
    setSelectedHostname(Object.keys(state.profiles)[0] ?? "");
  }, [selectedHostname, state]);

  const visibleProfiles = useMemo(() => {
    return Object.values(profiles)
      .filter((profile) => matchesSearch(profile, search))
      .filter((profile) => {
        if (filter === "enabled") return profile.enabled;
        if (filter === "disabled") return !profile.enabled;
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [filter, profiles, search]);

  const commitState = useCallback(
    async (updateState, message) => {
      if (mutationLockRef.current) return false;
      mutationLockRef.current = true;
      setSaving(true);
      try {
        let previousState;
        try {
          previousState = hasExtensionRuntime()
            ? await loadState()
            : state ?? createEmptyState();
        } catch {
          setToast({ message: "读取最新规则失败，请重试", tone: "error" });
          return false;
        }

        const nextState =
          typeof updateState === "function" ? updateState(previousState) : updateState;
        if (!nextState) {
          setToast({ message: "规则已在其他页面发生变化，请重试", tone: "error" });
          return false;
        }

        setState(nextState);
        try {
          const savedState = await saveState(nextState);
          setState(savedState);
          setToast({ message, tone: "success" });
          return true;
        } catch (error) {
          if (error?.code === "STATE_CONFLICT") {
            setState(error.latestState ?? previousState);
            setToast({
              message: "规则已在其他页面更新，请重试本次操作",
              tone: "error",
            });
            return false;
          }
          setState(previousState);
          setToast({
            message:
              error?.code === "ROLLBACK_FAILED"
                ? "保存和恢复均失败，请重新加载扩展"
                : "保存失败，已恢复原设置",
            tone: "error",
          });
          return false;
        }
      } finally {
        mutationLockRef.current = false;
        setSaving(false);
      }
    },
    [state],
  );

  function updateProfile(hostname, updater, message) {
    return commitState(
      (currentState) => {
        const current = currentState.profiles[hostname];
        if (!current) return null;
        const updatedProfile = updater(current);
        if (!updatedProfile) return null;
        const nextProfile = { ...updatedProfile, updatedAt: Date.now() };
        return {
          ...currentState,
          profiles: { ...currentState.profiles, [hostname]: nextProfile },
        };
      },
      message,
    );
  }

  function updateGlobalProfile(updater, message) {
    return commitState(
      (currentState) => {
        const current = currentState.globalProfile ?? createGlobalProfile();
        const updatedProfile = updater(current);
        if (!updatedProfile) return null;
        return {
          ...currentState,
          globalProfile: { ...updatedProfile, updatedAt: Date.now() },
        };
      },
      message,
    );
  }

  function updateActiveProfile(updater, message) {
    return globalMode
      ? updateGlobalProfile(updater, message)
      : updateProfile(selectedHostname, updater, message);
  }

  async function handleModeChange(mode) {
    if (mode === state.mode) return true;
    setMenuOpen(false);
    setRuleMenuId("");
    const saved = await commitState(
      (currentState) => ({ ...currentState, mode }),
      mode === "global" ? "已切换为所有站点模式" : "已切换为按站点模式",
    );
    return saved;
  }

  async function handleSaveRule(rule) {
    if (!activeProfile) return false;
    const exists = activeProfile.rules.some((item) => item.id === rule.id);
    const saved = await updateActiveProfile(
      (profile) => {
        if (validateHeader(rule.name, rule.value)) return null;
        const nextRules = profile.rules.some((item) => item.id === rule.id)
          ? profile.rules.map((item) => (item.id === rule.id ? rule : item))
          : [...profile.rules, rule];
        return { ...profile, rules: nextRules };
      },
      exists ? "规则已更新" : "请求头已添加",
    );
    if (saved) setRuleEditor(null);
    return saved;
  }

  function handleDeleteRule(ruleId) {
    return updateActiveProfile(
      (profile) => ({ ...profile, rules: profile.rules.filter((rule) => rule.id !== ruleId) }),
      "规则已删除",
    );
  }

  async function handleSaveSite(hostname) {
    const initialHostname = siteEditor?.hostname ?? "";
    if (!initialHostname) {
      const saved = await commitState(
        (currentState) => {
          if (currentState.profiles[hostname]) return null;
          return {
            ...currentState,
            profiles: {
              ...currentState.profiles,
              [hostname]: createProfile(hostname),
            },
          };
        },
        "站点已添加",
      );
      if (saved) {
        setSelectedHostname(hostname);
        setSearch("");
        setFilter("all");
        setSiteEditor(null);
      }
      return saved;
    } else if (initialHostname !== hostname) {
      const saved = await commitState((currentState) => {
        const current = currentState.profiles[initialHostname];
        if (!current || currentState.profiles[hostname]) return null;
        const nextProfiles = { ...currentState.profiles };
        delete nextProfiles[initialHostname];
        nextProfiles[hostname] = { ...current, hostname, updatedAt: Date.now() };
        return { ...currentState, profiles: nextProfiles };
      }, "主机名已更新");
      if (saved) {
        setSelectedHostname(hostname);
        setSiteEditor(null);
      }
      return saved;
    }

    setSiteEditor(null);
    return true;
  }

  async function handleDeleteSite() {
    const hostname = selectedHostname;
    const saved = await commitState((currentState) => {
      if (!currentState.profiles[hostname]) return null;
      const nextProfiles = { ...currentState.profiles };
      delete nextProfiles[hostname];
      return { ...currentState, profiles: nextProfiles };
    }, "站点规则已删除");
    if (saved) {
      setSelectedHostname("");
      setDeleteOpen(false);
    }
    return saved;
  }

  async function handleClearGlobalRules() {
    const saved = await updateGlobalProfile(
      (profile) => ({ ...profile, rules: [] }),
      "所有站点规则已清空",
    );
    if (saved) setDeleteOpen(false);
    return saved;
  }

  if (!state) {
    return (
      <main className="options-loading">
        <img src="/icons/icon-128.png" alt="" />
        <span>正在读取站点规则…</span>
      </main>
    );
  }

  return (
    <main className="options-shell" aria-busy={saving}>
      <header className="options-topbar">
        <div className="options-brand">
          <img src="/icons/icon-128.png" alt="" />
          <span>RequestKit</span>
        </div>
        <div className="rule-mode-tabs" role="group" aria-label="规则生效模式">
          <button
            type="button"
            data-active={!globalMode}
            aria-pressed={!globalMode}
            disabled={saving}
            onClick={() => void handleModeChange("site")}
          >
            按站点
          </button>
          <button
            type="button"
            data-active={globalMode}
            aria-pressed={globalMode}
            disabled={saving}
            onClick={() => void handleModeChange("global")}
          >
            所有站点
          </button>
        </div>
      </header>

      <section className="options-workspace">
        {globalMode ? (
          <aside className="site-sidebar global-scope-sidebar" aria-label="所有站点规则范围">
            <div className="site-sidebar-heading">
              <h1>所有站点模式</h1>
              <p>一套请求头，统一应用到所有网站。</p>
            </div>
            <div className="global-scope-card">
              <span className="global-scope-icon">
                <GlobeSimple size={30} weight="duotone" />
              </span>
              <div className="global-scope-copy">
                <strong>所有 HTTP / HTTPS 站点</strong>
                <span>
                  <i data-active={activeProfile?.enabled} />
                  {activeRuleCount(activeProfile)} / {activeProfile?.rules.length ?? 0} 条规则启用
                </span>
              </div>
              <Switch
                checked={Boolean(activeProfile?.enabled)}
                disabled={saving}
                label={activeProfile?.enabled ? "停用所有站点规则" : "启用所有站点规则"}
                onChange={(enabled) =>
                  void updateGlobalProfile(
                    (profile) => ({ ...profile, enabled }),
                    enabled ? "所有站点规则已启用" : "所有站点规则已停用",
                  )
                }
              />
            </div>
            <div className="global-scope-note">
              <Info size={18} weight="bold" />
              <p>切回“按站点”时，原有站点配置仍会保留。</p>
            </div>
          </aside>
        ) : (
          <aside className="site-sidebar" aria-label="站点规则列表">
            <div className="site-sidebar-heading">
              <h1>所有站点规则</h1>
            </div>

            <div className="site-toolbar">
              <label className="site-search">
                <MagnifyingGlass size={18} />
                <input
                  value={search}
                  placeholder="搜索站点"
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search ? (
                  <button type="button" aria-label="清空搜索" onClick={() => setSearch("")}>
                    <X size={15} weight="bold" />
                  </button>
                ) : null}
              </label>

              <label className="site-filter">
                <span className="sr-only">筛选站点状态</span>
                <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                  {Object.entries(FILTERS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="site-list">
              {visibleProfiles.length ? (
                visibleProfiles.map((profile) => {
                  const activeCount = activeRuleCount(profile);
                  const selected = profile.hostname === selectedHostname;
                  return (
                    <article
                      className="site-list-item"
                      data-selected={selected}
                      key={profile.hostname}
                    >
                      <button
                        type="button"
                        className="site-select-button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => setSelectedHostname(profile.hostname)}
                      >
                        <span className="site-list-icon">
                          <GlobeSimple size={27} weight="duotone" />
                        </span>
                        <span className="site-list-copy">
                          <strong title={profile.hostname}>{profile.hostname}</strong>
                          <small>
                            <i data-active={profile.enabled} />
                            {activeCount} / {profile.rules.length}
                            <b>·</b>
                            {formatUpdatedAt(profile.updatedAt)}
                          </small>
                        </span>
                      </button>
                      <Switch
                        checked={profile.enabled}
                        disabled={saving}
                        label={`${profile.enabled ? "停用" : "启用"} ${profile.hostname}`}
                        onChange={(enabled) =>
                          void updateProfile(
                            profile.hostname,
                            (current) => ({ ...current, enabled }),
                            enabled ? "站点规则已启用" : "站点规则已停用",
                          )
                        }
                      />
                    </article>
                  );
                })
              ) : (
                <div className="site-list-empty">
                  <MagnifyingGlass size={24} />
                  <strong>没有匹配的站点</strong>
                  <span>试试调整搜索词或筛选条件。</span>
                </div>
              )}
            </div>

            <div className="site-sidebar-footer">
              <button
                type="button"
                className="add-site-button"
                disabled={saving}
                onClick={() => setSiteEditor({ hostname: "" })}
              >
                <Plus size={21} weight="bold" />
                添加站点
              </button>
            </div>
          </aside>
        )}

        <section className="site-detail" aria-label={globalMode ? "所有站点规则详情" : "站点规则详情"}>
          {activeProfile ? (
            <>
              <div className="site-detail-header">
                <div className="site-detail-identity">
                  <span className="site-detail-icon">
                    <GlobeSimple size={38} weight="duotone" />
                  </span>
                  <div>
                    <h2>{globalMode ? "所有站点" : activeProfile.hostname}</h2>
                    <p data-active={activeProfile.enabled}>
                      <i />
                      {activeProfile.enabled
                        ? globalMode
                          ? "已启用 · 作用于所有网站"
                          : "已启用 · 作用于此站点"
                        : "已停用 · 不会修改请求头"}
                    </p>
                  </div>
                </div>
                <div className="site-detail-actions">
                  <button
                    type="button"
                    className="detail-add-button"
                    disabled={saving}
                    onClick={() => setRuleEditor({ rule: undefined })}
                  >
                    <Plus size={16} weight="bold" />
                    添加请求头
                  </button>
                  <span className="site-detail-divider" />
                  <Switch
                    checked={activeProfile.enabled}
                    disabled={saving}
                    label={`${activeProfile.enabled ? "停用" : "启用"}${globalMode ? "所有站点" : "此站点"}规则`}
                    onChange={(enabled) =>
                      void updateActiveProfile(
                        (profile) => ({ ...profile, enabled }),
                        enabled
                          ? globalMode
                            ? "所有站点规则已启用"
                            : "站点规则已启用"
                          : globalMode
                            ? "所有站点规则已停用"
                            : "站点规则已停用",
                      )
                    }
                  />
                  {!globalMode ? (
                    <div className="options-menu-anchor">
                      <IconButton
                        label="更多站点操作"
                        disabled={saving}
                        onClick={() => setMenuOpen((open) => !open)}
                      >
                        <DotsThreeVertical size={22} weight="bold" />
                      </IconButton>
                      {menuOpen ? (
                        <div className="options-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            disabled={saving}
                            onClick={() => {
                              setSiteEditor({ hostname: selectedHostname });
                              setMenuOpen(false);
                            }}
                          >
                            <PencilSimple size={17} />
                            编辑主机名
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="options-menu-danger"
                            disabled={saving}
                            onClick={() => {
                              setDeleteOpen(true);
                              setMenuOpen(false);
                            }}
                          >
                            <Trash size={17} />
                            删除此站点
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="detail-rules">
                <div className="detail-table-head" aria-hidden="true">
                  <span>请求头</span>
                  <span>值（预览）</span>
                  <span>启用</span>
                  <span>操作</span>
                </div>
                <div className="detail-rule-list">
                  {activeProfile.rules.length ? (
                    activeProfile.rules.map((rule) => (
                      <article className="detail-rule-row" data-enabled={rule.enabled} key={rule.id}>
                        <strong title={rule.name}>{rule.name}</strong>
                        <span>{previewValue(rule)}</span>
                        <Switch
                          checked={rule.enabled}
                          disabled={saving || !activeProfile.enabled}
                          label={`${rule.enabled ? "停用" : "启用"} ${rule.name}`}
                          onChange={(enabled) =>
                            void updateActiveProfile(
                              (profile) => ({
                                ...profile,
                                rules: profile.rules.map((item) =>
                                  item.id === rule.id ? { ...item, enabled } : item,
                                ),
                              }),
                              enabled ? `${rule.name} 已启用` : `${rule.name} 已停用`,
                            )
                          }
                        />
                        <div className="detail-rule-actions">
                          <IconButton
                            label={`编辑 ${rule.name}`}
                            disabled={saving}
                            onClick={() => setRuleEditor({ rule })}
                          >
                            <PencilSimple size={18} weight="bold" />
                          </IconButton>
                          <div className="options-rule-menu-anchor">
                            <IconButton
                              label={`${rule.name} 更多操作`}
                              disabled={saving}
                              onClick={() =>
                                setRuleMenuId((current) => (current === rule.id ? "" : rule.id))
                              }
                            >
                              <DotsThreeVertical size={19} weight="bold" />
                            </IconButton>
                            {ruleMenuId === rule.id ? (
                              <div className="options-rule-menu" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={saving}
                                  onClick={async () => {
                                    const deleted = await handleDeleteRule(rule.id);
                                    if (deleted) setRuleMenuId("");
                                  }}
                                >
                                  <Trash size={17} />
                                  删除规则
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="detail-empty-state">
                      <span>
                        <Plus size={24} weight="duotone" />
                      </span>
                      <strong>为{globalMode ? "所有站点" : "这个站点"}添加第一条规则</strong>
                      <p>新请求会自动带上你设置的请求头。</p>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setRuleEditor({ rule: undefined })}
                      >
                        添加请求头
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <p className="detail-helper">
                <Info size={18} weight="bold" />
                {globalMode
                  ? "所有网站的新请求都会自动带上已启用的请求头。"
                  : "新请求会自动带上已启用的请求头。"}
              </p>
            </>
          ) : (
            <div className="no-site-state">
              <span>
                <GlobeSimple size={30} weight="duotone" />
              </span>
              <h2>还没有站点规则</h2>
              <p>添加一个站点，然后为它配置需要附加的请求头。</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => setSiteEditor({ hostname: "" })}
              >
                <Plus size={19} weight="bold" />
                添加站点
              </button>
            </div>
          )}
        </section>
      </section>

      <footer className="options-footer">
        <p>
          <Info size={19} weight="bold" />
          规则仅保存在此浏览器中
        </p>
        {activeProfile ? (
          <button type="button" disabled={saving} onClick={() => setDeleteOpen(true)}>
            <Trash size={20} weight="bold" />
            {globalMode ? "清空所有站点规则" : "删除此站点规则"}
          </button>
        ) : null}
      </footer>

      {ruleEditor ? (
        <RuleEditor
          initialRule={ruleEditor.rule}
          hostname={globalMode ? "所有站点规则" : selectedHostname}
          onClose={() => setRuleEditor(null)}
          onSave={handleSaveRule}
        />
      ) : null}
      {siteEditor ? (
        <SiteEditor
          initialHostname={siteEditor.hostname}
          profiles={profiles}
          onClose={() => setSiteEditor(null)}
          onSave={handleSaveSite}
        />
      ) : null}
      {deleteOpen && activeProfile ? (
        <DeleteProfileDialog
          busy={saving}
          globalMode={globalMode}
          hostname={selectedHostname}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={globalMode ? handleClearGlobalRules : handleDeleteSite}
        />
      ) : null}
      {toast ? (
        <div className="options-toast" data-tone={toast.tone} role="status">
          {toast.tone === "error" ? (
            <WarningCircle size={17} weight="fill" />
          ) : (
            <Check size={17} weight="bold" />
          )}
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
