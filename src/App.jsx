import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  DotsThreeVertical,
  GearSix,
  GlobeSimple,
  Info,
  Lightning,
  PencilSimple,
  Plus,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  createEmptyState,
  createProfile,
  getActiveSite,
  loadState,
  saveState,
  syncState,
} from "./extension/state.js";
import { validateHeader } from "./extension/rules.js";

function Switch({ checked, disabled = false, label, onChange }) {
  return (
    <button
      type="button"
      className="switch"
      data-checked={checked}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

function IconButton({ label, children, tone = "default", ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      data-tone={tone}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

function RuleEditor({ initialRule, scopeLabel, onClose, onSave }) {
  const [name, setName] = useState(initialRule?.name ?? "");
  const [value, setValue] = useState(initialRule?.value ?? "");
  const [enabled, setEnabled] = useState(initialRule?.enabled ?? true);
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateHeader(name, value);
    if (validationError) {
      setError(validationError);
      return;
    }

    onSave({
      id: initialRule?.id ?? crypto.randomUUID(),
      name: name.trim(),
      value: value.trim(),
      enabled,
    });
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">{scopeLabel}</p>
            <h2 id="editor-title">{initialRule ? "编辑请求头" : "添加请求头"}</h2>
          </div>
          <IconButton label="关闭" onClick={onClose}>
            <X size={18} weight="bold" />
          </IconButton>
        </div>

        <label className="field">
          <span>请求头名称</span>
          <input
            autoFocus
            value={name}
            placeholder="例如 Authorization"
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
        </label>

        <label className="field">
          <span>请求头值</span>
          <textarea
            rows="3"
            value={value}
            placeholder="例如 Bearer eyJhbGci..."
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
          />
        </label>

        <div className="enable-row">
          <div>
            <strong>保存后启用</strong>
            <span>后续请求将立即使用这个值</span>
          </div>
          <Switch checked={enabled} label="保存后启用" onChange={setEnabled} />
        </div>

        {error ? (
          <p className="form-error" role="alert">
            <WarningCircle size={16} weight="fill" />
            {error}
          </p>
        ) : null}

        <div className="dialog-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="button-primary">
            <Check size={17} weight="bold" />
            {initialRule ? "保存修改" : "添加并应用"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDialog({ globalMode, onCancel, onConfirm }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="dialog confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon">
          <Trash size={22} weight="duotone" />
        </div>
        <h2 id="confirm-title">清空{globalMode ? "所有站点" : "当前站点"}规则？</h2>
        <p>
          这会移除{globalMode ? "所有站点模式下" : "当前站点"}的全部请求头规则，操作无法撤销。
        </p>
        <div className="dialog-actions">
          <button type="button" className="button-secondary" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="button-danger" onClick={onConfirm}>
            清空规则
          </button>
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [state, setState] = useState(null);
  const [site, setSite] = useState({ hostname: "正在读取…", supported: true });
  const [editorRule, setEditorRule] = useState(undefined);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const mutationLockRef = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([getActiveSite(), loadState()]).then(([nextSite, nextState]) => {
      if (!active) return;
      setSite(nextSite);
      setState(nextState);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setEditorOpen(false);
      setConfirmOpen(false);
      setMenuOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const profile = useMemo(() => {
    if (!state) return createProfile(site.hostname);
    return state.mode === "global"
      ? state.globalProfile
      : state.profiles[site.hostname] ?? createProfile(site.hostname);
  }, [site.hostname, state]);

  const globalMode = state?.mode === "global";
  const scopeSupported = globalMode || site.supported;

  const activeCount = profile.enabled
    ? profile.rules.filter((rule) => rule.enabled).length
    : 0;

  const commitState = useCallback(
    async (createNextState, message) => {
      if (mutationLockRef.current) return;
      mutationLockRef.current = true;
      const previousState = state ?? createEmptyState();
      const nextState = createNextState(previousState);
      setState(nextState);
      setSyncing(true);
      try {
        const savedState = await saveState(nextState);
        setState(savedState);
        setToast({ message, tone: "success" });
      } catch (error) {
        setState(error?.latestState ?? previousState);
        setToast({
          message:
            error?.code === "STATE_CONFLICT"
              ? "规则已在其他页面更新，请重试"
              : error?.code === "ROLLBACK_FAILED"
                ? "规则应用失败，请从更多菜单重新同步"
                : "规则应用失败，已恢复原设置",
          tone: "error",
        });
      } finally {
        mutationLockRef.current = false;
        setSyncing(false);
      }
    },
    [state],
  );

  const commitProfile = useCallback(
    (nextProfile, message) =>
      commitState(
        (previousState) => ({
          ...previousState,
          ...(globalMode
            ? { globalProfile: { ...nextProfile, updatedAt: Date.now() } }
            : {
                profiles: {
                  ...(previousState.profiles ?? {}),
                  [site.hostname]: { ...nextProfile, updatedAt: Date.now() },
                },
              }),
        }),
        message,
      ),
    [commitState, globalMode, site.hostname],
  );

  function handleModeChange(mode) {
    if (mode === state.mode || syncing) return;
    setMenuOpen(false);
    void commitState(
      (previousState) => ({ ...previousState, mode }),
      mode === "global" ? "已切换为所有站点模式" : "已切换为按站点模式",
    );
  }

  function openEditor(rule) {
    setEditorRule(rule);
    setEditorOpen(true);
  }

  function handleSaveRule(rule) {
    const exists = profile.rules.some((item) => item.id === rule.id);
    const rules = exists
      ? profile.rules.map((item) => (item.id === rule.id ? rule : item))
      : [...profile.rules, rule];
    void commitProfile({ ...profile, rules }, exists ? "规则已更新" : "请求头已添加");
    setEditorOpen(false);
  }

  function handleDelete(ruleId) {
    const rules = profile.rules.filter((rule) => rule.id !== ruleId);
    void commitProfile({ ...profile, rules }, "规则已删除");
  }

  function handleClear() {
    void commitProfile(
      { ...profile, rules: [] },
      globalMode ? "所有站点规则已清空" : "当前站点规则已清空",
    );
    setConfirmOpen(false);
  }

  async function handleResync() {
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setSyncing(true);
    try {
      await syncState();
      setToast({ message: "规则已重新同步", tone: "success" });
    } catch {
      setToast({ message: "规则同步失败，请重试", tone: "error" });
    } finally {
      mutationLockRef.current = false;
      setSyncing(false);
    }
  }

  if (!state) {
    return (
      <main className="app-shell loading-screen">
        <img src="/icons/icon-128.png" alt="" />
        <span>正在读取当前站点…</span>
      </main>
    );
  }

  return (
    <main className="app-shell" aria-busy={syncing}>
      <header className="app-header">
        <div className="brand-lockup">
          <img src="/icons/icon-128.png" alt="" />
          <span>RequestKit</span>
        </div>
        <div className="popup-mode-tabs" role="group" aria-label="规则生效模式">
          <button
            type="button"
            data-active={!globalMode}
            aria-pressed={!globalMode}
            disabled={syncing}
            onClick={() => handleModeChange("site")}
          >
            按站点
          </button>
          <button
            type="button"
            data-active={globalMode}
            aria-pressed={globalMode}
            disabled={syncing}
            onClick={() => handleModeChange("global")}
          >
            所有站点
          </button>
        </div>
        <div className="header-actions">
          <IconButton
            label="所有站点规则"
            onClick={() => {
              if (
                typeof chrome !== "undefined" &&
                chrome.runtime?.getURL &&
                chrome.windows?.create
              ) {
                void chrome.windows.create({
                  url: chrome.runtime.getURL("options.html"),
                  type: "popup",
                  width: 880,
                  height: 640,
                  focused: true,
                });
              } else {
                const managerWindow = window.open(
                  "/options.html",
                  "requestkit-manager",
                  "popup,width=880,height=640",
                );
                if (!managerWindow) window.location.assign("/options.html");
              }
            }}
          >
            <GearSix size={20} weight="bold" />
          </IconButton>
          <div className="menu-anchor">
            <IconButton label="更多操作" onClick={() => setMenuOpen((open) => !open)}>
              <DotsThreeVertical size={21} weight="bold" />
            </IconButton>
            {menuOpen ? (
              <div className="overflow-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  disabled={syncing}
                  onClick={() => {
                    void handleResync();
                    setMenuOpen(false);
                  }}
                >
                  <Lightning size={16} />
                  重新同步规则
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="danger-menu-item"
                  disabled={syncing || !profile.rules.length}
                  onClick={() => {
                    setConfirmOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Trash size={16} />
                  清空{globalMode ? "所有站点" : "当前站点"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="site-panel" aria-label="当前站点">
        <div className="site-identity">
          <span className="site-icon">
            <GlobeSimple size={25} weight="duotone" />
          </span>
          <div className="site-copy">
            <strong title={globalMode ? "所有站点" : site.hostname}>
              {globalMode ? "所有站点" : site.hostname}
            </strong>
            <span data-supported={scopeSupported}>
              <i />
              {globalMode
                ? "全局模式 · 作用于所有网站"
                : site.supported
                  ? "已连接 · 作用于当前站点"
                  : "此页面不支持修改请求头"}
            </span>
          </div>
        </div>
        <div className="master-control">
          <span>总开关</span>
          <Switch
            checked={profile.enabled}
            disabled={!scopeSupported || syncing}
            label={globalMode ? "启用所有站点规则" : "启用当前站点规则"}
            onChange={(enabled) =>
              void commitProfile(
                { ...profile, enabled },
                enabled
                  ? globalMode
                    ? "所有站点规则已启用"
                    : "当前站点规则已启用"
                  : globalMode
                    ? "所有站点规则已暂停"
                    : "当前站点规则已暂停",
              )
            }
          />
        </div>
      </section>

      <section className="status-strip" aria-live="polite">
        <Lightning size={17} weight="fill" />
        <span>
          {syncing
            ? "正在应用请求头规则…"
            : activeCount
              ? `${activeCount} 条${globalMode ? "全局" : "站点"}规则已启用，请求头修改已即时生效`
              : profile.rules.length
                ? "规则已暂停，不会修改后续请求"
                : "还没有规则，添加后会立即应用"}
        </span>
      </section>

      <div className="table-head" aria-hidden="true">
        <span>请求头</span>
        <span>值（预览）</span>
        <span>启用</span>
        <span />
      </div>

      <section className="rule-list" aria-label="请求头规则">
        {profile.rules.length ? (
          profile.rules.map((rule) => (
            <article className="rule-row" key={rule.id} data-enabled={rule.enabled}>
              <strong title={rule.name}>{rule.name}</strong>
              <span className="rule-value" title={rule.value}>
                {rule.value}
              </span>
              <Switch
                checked={rule.enabled}
                disabled={syncing || !profile.enabled || !scopeSupported}
                label={`${rule.enabled ? "停用" : "启用"} ${rule.name}`}
                onChange={(enabled) => {
                  const rules = profile.rules.map((item) =>
                    item.id === rule.id ? { ...item, enabled } : item,
                  );
                  void commitProfile(
                    { ...profile, rules },
                    enabled ? `${rule.name} 已启用` : `${rule.name} 已停用`,
                  );
                }}
              />
              <div className="row-actions">
                <IconButton
                  label={`编辑 ${rule.name}`}
                  disabled={syncing}
                  onClick={() => openEditor(rule)}
                >
                  <PencilSimple size={17} weight="bold" />
                </IconButton>
                <IconButton
                  label={`删除 ${rule.name}`}
                  tone="danger"
                  disabled={syncing}
                  onClick={() => handleDelete(rule.id)}
                >
                  <Trash size={17} weight="bold" />
                </IconButton>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Lightning size={22} weight="duotone" />
            </span>
            <strong>为{globalMode ? "所有站点" : "这个站点"}添加第一条规则</strong>
            <p>新请求会自动带上你设置的请求头。</p>
          </div>
        )}
      </section>

      <footer className="app-footer">
        <button
          type="button"
          className="add-button"
          disabled={!scopeSupported || syncing}
          onClick={() => openEditor(undefined)}
        >
          <Plus size={21} weight="bold" />
          添加请求头
        </button>
        <p>
          <Info size={16} weight="bold" />
          {globalMode ? "对所有网站生效，切换模式不会丢失规则。" : "仅对当前站点生效，规则会持续保留。"}
        </p>
      </footer>

      {editorOpen ? (
        <RuleEditor
          initialRule={editorRule}
          scopeLabel={globalMode ? "所有站点规则" : "当前站点规则"}
          onClose={() => setEditorOpen(false)}
          onSave={handleSaveRule}
        />
      ) : null}
      {confirmOpen ? (
        <ConfirmDialog
          globalMode={globalMode}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleClear}
        />
      ) : null}
      {toast ? (
        <div className="toast" data-tone={toast.tone} role="status">
          {toast.tone === "error" ? (
            <WarningCircle size={16} weight="fill" />
          ) : (
            <Check size={16} weight="bold" />
          )}
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
