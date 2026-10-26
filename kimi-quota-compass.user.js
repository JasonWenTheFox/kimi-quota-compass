// ==UserScript==
// @name         Kimi Quota Compass
// @name:zh-CN   Kimi 用量罗盘
// @namespace    https://github.com/JasonWenTheFox
// @version      0.9.0
// @description  Kimi membership quota panel: monthly pool, Kimi Code 5h/7d windows, per-action ledger with full-cycle backfill, cycle snapshots, suspected official reset grants, and CSV/JSON export
// @description:zh-CN  Kimi 会员用量面板：月度额度池、Kimi Code 5小时/7天窗口、逐条额度流水（支持全周期回填、周期快照、疑似官方重置与额度增量、导出）
// @author       JW
// @match        https://www.kimi.com/*
// @match        https://kimi.com/*
// @match        https://www.kimi.ai/*
// @match        https://kimi.ai/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        unsafeWindow
// @homepageURL  https://github.com/JasonWenTheFox/kimi-quota-compass
// @supportURL   https://github.com/JasonWenTheFox/kimi-quota-compass/issues
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  // Tampermonkey sandbox window is a proxy; the real page window is unsafeWindow.
  const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

  // ---------- i18n ----------
  const LANG = /^zh/i.test(pageWindow.navigator.language || "") ? "zh" : "en";
  const T = {
    btn: { zh: "Kimi 用量", en: "Kimi Usage" },
    title: { zh: "Kimi 用量罗盘", en: "Kimi Quota Compass" },
    monthlyUsed: { zh: "月度额度池已用", en: "Monthly pool used" },
    localStats: { zh: "本地累计 {n} 条，自 {d}（仅本浏览器）", en: "Local ledger: {n} entries since {d} (this browser only)" },
    notCaptured: { zh: "插件未捕获", en: "Not captured" },
    official: { zh: "官方", en: "official" },
    local: { zh: "本地", en: "local" },
    completeness: { zh: "本周期数据完整度 {v}", en: "Cycle completeness {v}" },
    rateNote: { zh: "金额换算（可选）", en: "Amounts (optional)" },
    planLabel: { zh: "订阅套餐", en: "Plan" },
    planNone: { zh: "未选择（可选）", en: "not set (optional)" },
    planOld: { zh: "已实测", en: "measured" },
    planExtrap: { zh: "按倍数推算", en: "extrapolated" },
    planNew: { zh: "未实测", en: "not measured" },
    planHintOld: { zh: "参考值：Allegretto 为实测（Code ¥21 / 其他 ¥6 每 1%）；其余老档位按官方额度倍数等比推算，未实测。", en: "Defaults: Allegretto is measured (Code ¥21 / other ¥6 per 1%); other old tiers are extrapolated from the official quota multipliers, not measured." },
    planHintNew: { zh: "新套餐取消了 Code 额度补贴，老套餐的参考值不适用；请自行校准，或留空不显示金额。", en: "New plans dropped the Code quota discount, so the old defaults do not apply. Calibrate yourself or leave blank." },
    fillRef: { zh: "填入参考值", en: "Fill defaults" },
    rateManualHint: { zh: "当前为自定义值；切换套餐不会覆盖，点「填入参考值」可重置。", en: "Custom values; switching plans will not overwrite them. Use Fill defaults to reset." },
    rateEmptyHint: { zh: "留空则不显示任何金额。", en: "Leave blank to hide all amounts." },
    noRecord: { zh: "官方终值未捕获", en: "official end value not captured" },
    localOnly: { zh: "本地已记录 {v}（非周期总量）", en: "local ledger {v} (not the cycle total)" },
    tailDiff: { zh: "官方尾差 {v}", en: "official rounding gap {v}" },
    rateHint: {
      zh: "金额 = 额度百分比 × 每 1% 的 API 等价值，按公开牌价折算，非官方账单。",
      en: "Amount = quota % × API-equivalent per 1%. Converted from public list prices, not official billing.",
    },
    w5h: { zh: "Code 5 小时窗口", en: "Code 5h window" },
    w7d: { zh: "Code 7 天窗口", en: "Code 7d window" },
    quotaUnits: { zh: "{u} / {l}（内部额度单位）· 剩余 {r}", en: "{u} / {l} (internal quota units) · {r} left" },
    resetAt: { zh: "重置时间：{v}（本地时区）", en: "Resets: {v} (local)" },
    monthlyUsedOfficialCurrent: { zh: "月度额度池已用（官方当前）", en: "Monthly pool used (official now)" },
    cycleCumulative: { zh: "本周期累计 {used} / 总额度 {limit}（{rate}）", en: "Cycle total {used} / limit {limit} ({rate})" },
    cycleCumulativeLabel: { zh: "本周期累计", en: "Cycle total" },
    cycleLimitOnly: { zh: "总额度 {limit} · {n} 次重置", en: "Cycle limit {limit} · {n} reset(s)" },
    cycleTotalTag: { zh: "累计 {used} / 额度 {limit}", en: "total {used} / limit {limit}" },
    cumulativeBreakdown: { zh: "本周期累计明细（含重置前）", en: "cycle total breakdown (incl. pre-reset)" },
    officialCumulative: { zh: "官方累计", en: "official total" },
    cycleRange: { zh: "本周期：{v}", en: "Cycle: {v}" },
    cycleDays: { zh: "{v} 天", en: "{v} days" },
    lastSuspectedReset: { zh: "本次疑似官方重置：{v}", en: "Suspected official reset: {v}" },
    nextBilling: { zh: "下个标准账单日：{v}", en: "Next billing day: {v}" },
    cycleEndLine: { zh: "本周期结束：{v}", en: "Cycle ends: {v}" },
    resetLog: { zh: "重置记录", en: "Reset log" },
    resetCount: { zh: "{n} 次", en: "{n} time(s)" },
    suspectedReset: { zh: "疑似官方重置", en: "suspected official reset" },
    resetCancelled: { zh: "已取消", en: "cancelled" },
    resetSourceSnapshot: { zh: "快照捕获", en: "captured by snapshot" },
    resetSourceLedger: { zh: "本地推断", en: "inferred locally" },
    resetTimeUnknown: { zh: "检测到重置，实际时间未知", en: "reset detected, exact time unknown" },
    resetDetectedAt: { zh: "检测于 {v}", en: "detected at {v}" },
    resetBracket: { zh: "{from} → {to}", en: "{from} → {to}" },
    resetAmount: { zh: "+{v}", en: "+{v}" },
    resetCodeAmount: { zh: "Code +{v}", en: "Code +{v}" },
    cancelResetBtn: { zh: "取消此重置", en: "Cancel reset" },
    restoreResetBtn: { zh: "恢复", en: "Restore" },
    cancelResetConfirm: {
      zh: "确定取消这次「疑似官方重置」吗？\n\n请先核对 Kimi 官方公告 / 新闻，确认这次不是官方重置。取消后，这次额度增量将不再计入本周期总额度；快照和流水记录会保留，之后可以恢复。",
      en: "Cancel this suspected official reset?\n\nCheck Kimi's official announcement/news first and confirm this was not an official reset. The quota grant will no longer count toward this cycle; snapshots and ledger evidence are kept and can be restored later.",
    },
    resetDismissedWarn: { zh: "已取消；本地明细仍比官方多 {v}，如果这不是退款，可能还有未记录的重置。", en: "Cancelled; local ledger is still {v} above the official reading. If this was not a refund, another reset may be unrecorded." },
    officialEndValue: { zh: "官方期末读数 {v}", en: "official end value {v}" },
    ofWhich: { zh: "其中", en: "of which" },
    estShort: { zh: "估算 {v}", en: "est. {v}" },
    ledger: { zh: "额度流水", en: "Balance actions" },
    thTime: { zh: "时间（本地时区）", en: "Time (local)" },
    thFeature: { zh: "功能", en: "Feature" },
    thTitle: { zh: "条目", en: "Title" },
    thUsed: { zh: "消耗", en: "Used" },
    thEst: { zh: "估算金额", en: "Est. amount" },
    cycle: { zh: "计费周期", en: "Cycle" },
    cycleAll: { zh: "全部", en: "All" },
    cycleEndValue: { zh: "官方终值 {v}", en: "official end {v}" },
    exportJson: { zh: "导出 JSON", en: "Export JSON" },
    exportCsv: { zh: "导出 CSV", en: "Export CSV" },
    refreshBtn: { zh: "刷新", en: "Refresh" },
    loadMore: { zh: "显示更多", en: "Show more" },
    shownRows: { zh: "显示 {a} / {b} 条", en: "Showing {a} / {b}" },
    canary: {
      zh: "检测到 Kimi 网页响应开始返回 Token Usage，请检查插件更新",
      en: "Token usage detected in Kimi web responses - check for script updates",
    },
    footer: {
      zh: "流水来自 Kimi 服务器（每页 20 条，插件已按 pageToken 自动翻页回填）。服务端只保留当前计费周期，历史只能靠本地累积，因此每周期会写入一份官方快照。若官方在周期中重置额度，插件会记录「疑似官方重置」并把实际降幅加回本周期总额度；官方当前读数仍以接口为准。5h/7d 的 used/limit 为内部额度单位，非 Token。金额为按公开牌价折算的估算值。",
      en: "Actions come from Kimi's server (20 per page; the script follows pageToken to backfill). The server keeps only the current cycle, so cycles are snapshotted locally. If Kimi resets quota mid-cycle, the script logs a suspected official reset and adds the observed drop to the cycle limit; the official current reading still comes from the API. 5h/7d used/limit are internal quota units, not tokens. Amounts are estimates at public list prices.",
    },
    loading: { zh: "加载中…", en: "loading..." },
    err: { zh: "KQC 错误", en: "KQC error" },
    noLogin: { zh: "未找到 access_token，请先登录 Kimi", en: "access_token not found (not logged in?)" },
    exported: { zh: "已导出 {n} 条流水、{m} 条快照、{r} 条重置事件", en: "Exported {n} actions, {m} snapshots, {r} reset events" },
    tipBody: {
      zh: `<b>这是什么？</b>官方接口只提供百分比，不提供金额。<br><br><b>换算方式：</b>金额 = 额度百分比 × 每 1% 的 API 等价值。<br>用真实请求反推：Kimi Code 每 1% 约合公开 API 价 ¥21；网页 Agent / Kimi Work 类每 1% 约 ¥3–9（同样 token 量下扣费更高）。<br><br><b>K3 公开 API 价目</b>（每百万 token）：缓存命中 ¥2 / 未命中 ¥20 / 输出 ¥100。k3 在上下文超过 256K 后额度消耗约翻倍。<br><br>不同功能、不同缓存命中率的换算差别很大，全部金额仅为估算。`,
      en: `<b>What is this?</b> Official APIs only expose percentages, never amounts.<br><br><b>Conversion:</b> amount = quota % × API-equivalent value per 1%.<br>Measured from real requests: ~¥21 per 1% for Kimi Code; ~¥3–9 per 1% for web Agent / Kimi Work (same tokens cost more quota there).<br><br><b>K3 public API pricing</b> (per 1M tokens): cache hit ¥2 / miss ¥20 / output ¥100. k3 roughly doubles quota use above 256K context.<br><br>Rates differ per feature and cache-hit ratio; every amount is an estimate.`,
    },
  };
  const t = (k, vars) => {
    let s = (T[k] && (T[k][LANG] || T[k].en)) || k;
    if (vars) for (const [kk, vv] of Object.entries(vars)) s = s.split("{" + kk + "}").join(String(vv));
    return s;
  };
  // 所有进入 innerHTML 的服务端动态字符串必须先转义
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- debug state ----------
  pageWindow.__KQC = { log: [], streamUsageDetected: false };
  const debug = (msg) => {
    pageWindow.__KQC.log.push(`${new Date().toISOString()} ${msg}`);
    if (pageWindow.__KQC.log.length > 200) pageWindow.__KQC.log.shift();
  };

  // ---------- official APIs ----------
  const origFetch = pageWindow.fetch.bind(pageWindow);
  async function apiPost(path, body = {}) {
    const token = pageWindow.localStorage.getItem("access_token");
    if (!token) throw new Error(t("noLogin"));
    const res = await origFetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (res.status === 401) throw new Error(t("noLogin") + " (401)");
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  const API = {
    stats: "/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats",
    sub: "/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscription",
    actions: "/apiv2/kimi.gateway.membership.v2.MembershipService/ListBalanceActions",
    usages: "/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages",
  };

  // ---------- stream usage canary (fail-open, fetch-only) ----------
  // 目的：监视 Kimi 将来是否开始在网页响应中返回逐请求 token usage。
  // 只包装 window.fetch，用 response.clone() 旁路检查，不改动返回给页面的对象；
  // 任何异常都吞掉（fail-open）。注意：Kimi 前端可能持有自己的 fetch 引用，
  // 因此该探针是尽力而为，不保证覆盖所有请求。
  const USAGE_FIELD_RE =
    /"(?:prompt_tokens|promptTokens|input_tokens|inputTokens|completion_tokens|completionTokens|output_tokens|outputTokens|cached_tokens|cachedTokens|cache_read_tokens)"/;
  const CANARY_MAX = 200000;
  const markStreamUsage = (text) => {
    if (pageWindow.__KQC.streamUsageDetected) return;
    pageWindow.__KQC.streamUsageDetected = true;
    const fields = [...new Set((text.match(/"[A-Za-z_]*[Tt]okens?"/g) || []).slice(0, 10))];
    console.warn("[KQC] Token usage detected in Kimi web response. Fields:", fields.join(", "));
    debug("stream usage DETECTED: " + fields.join(","));
  };
  try {
    pageWindow.fetch = function (...args) {
      const p = origFetch.apply(this, args);
      try {
        const url = typeof args[0] === "string" ? args[0] : args[0] && args[0].url ? args[0].url : "";
        if (!/kimi\.(com|ai)\/(apiv2|v2|api)\//.test(url)) return p;
        p.then((res) => {
          if (!res || !res.ok || !res.body || res.body.locked) return;
          const ct = (res.headers && res.headers.get("content-type")) || "";
          if (!/json|connect|event-stream/i.test(ct)) return;
          const mirror = res.clone();
          const rd = mirror.body.getReader();
          const dec = new TextDecoder();
          let acc = "";
          const pump = (v) => {
            if (v.done) {
              if (USAGE_FIELD_RE.test(acc)) markStreamUsage(acc);
              return;
            }
            acc += dec.decode(v.value, { stream: true });
            if (acc.length > CANARY_MAX) acc = acc.slice(-Math.floor(CANARY_MAX / 2));
            return rd.read().then(pump);
          };
          rd.read().then(pump).catch(() => {});
        }).catch(() => {});
      } catch {}
      return p;
    };
    debug("usage canary installed (fetch-only, fail-open)");
  } catch (e) {
    debug("canary err: " + e);
  }

  // ---------- local store ----------
  // 刻意不升级老库 kqc_ledger 的版本：v0.7.x 的用户库里已有上千条流水，
  // 升 version 会被其它仍开着的标签页阻塞（onblocked），风险不值当。
  // actions 继续留 v1；新增的快照/周期表放到独立的 kqc_meta 库里。
  const idb = pageWindow.indexedDB;
  const DB_LEDGER = "kqc_ledger";
  const DB_META = "kqc_meta";
  const S_ACTIONS = "actions";
  const S_SNAPSHOTS = "snapshots";
  const S_CYCLES = "cycles";
  const S_RESETS = "resets";
  const STORE_DB = { [S_ACTIONS]: DB_LEDGER, [S_SNAPSHOTS]: DB_META, [S_CYCLES]: DB_META, [S_RESETS]: DB_META };

  const openCache = {};

  const NEEDED_STORES = { [DB_LEDGER]: [S_ACTIONS], [DB_META]: [S_SNAPSHOTS, S_CYCLES, S_RESETS] };

  function createStores(db, name) {
    const need = NEEDED_STORES[name] || [];
    for (const st of need) {
      if (db.objectStoreNames.contains(st)) continue;
      if (st === S_ACTIONS) db.createObjectStore(st, { keyPath: "id" });
      else if (st === S_SNAPSHOTS) db.createObjectStore(st, { keyPath: "ts" }).createIndex("cycle", "cycle");
      else if (st === S_RESETS) db.createObjectStore(st, { keyPath: "key" });
      else db.createObjectStore(st, { keyPath: "cycle" });
    }
  }

  function rawOpen(name, version) {
    return new Promise((res, rej) => {
      const r = version ? idb.open(name, version) : idb.open(name);
      r.onupgradeneeded = () => createStores(r.result, name);
      r.onsuccess = () => {
        const db = r.result;
        // 其它标签页要求升级时主动让路，避免把别人卡在 onblocked
        db.onversionchange = () => {
          try { db.close(); } catch {}
          delete openCache[name];
        };
        res(db);
      };
      r.onerror = () => rej(r.error);
      r.onblocked = () => debug("idb blocked: " + name);
    });
  }

  function dbOpenFor(store) {
    const name = STORE_DB[store] || DB_LEDGER;
    if (!openCache[name]) {
      openCache[name] = (async () => {
        // 先按现有版本打开（新库会在 onupgradeneeded 里建表），
        // 再检查该库需要的全部 store；缺任何一个才升版本补齐。
        let db = await rawOpen(name);
        const need = NEEDED_STORES[name] || [];
        const missing = need.filter((st) => !db.objectStoreNames.contains(st));
        if (missing.length) {
          const next = (db.version || 1) + 1;
          db.close();
          db = await rawOpen(name, next);
        }
        return db;
      })().catch((e) => {
        delete openCache[name]; // 失败不缓存，下次还能重试
        throw e;
      });
    }
    return openCache[name];
  }

  async function dbGet(store, key) {
    const db = await dbOpenFor(store);
    return new Promise((res, rej) => {
      const rq = db.transaction(store, "readonly").objectStore(store).get(key);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  async function dbGetAll(store) {
    const db = await dbOpenFor(store);
    return new Promise((res, rej) => {
      const rq = db.transaction(store, "readonly").objectStore(store).getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => rej(rq.error);
    });
  }
  async function dbPut(store, value) {
    const db = await dbOpenFor(store);
    return new Promise((res, rej) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function dbPutAll(entries) {
    if (!entries.length) return 0;
    const db = await dbOpenFor(S_ACTIONS);
    return new Promise((res, rej) => {
      const tx = db.transaction(S_ACTIONS, "readwrite");
      const st = tx.objectStore(S_ACTIONS);
      for (const e of entries) st.put(e);
      tx.oncomplete = () => res(entries.length);
      tx.onerror = () => rej(tx.error);
    });
  }

  // 同一周期最后一条快照：用来做“重置前 vs 重置后”的比较。
  // 优先走 cycle 索引的 prev 游标，避免每次把整张快照表读进内存。
  async function dbGetLastSnapshot(cycle) {
    if (!cycle) return null;
    const db = await dbOpenFor(S_SNAPSHOTS);
    const store = db.transaction(S_SNAPSHOTS, "readonly").objectStore(S_SNAPSHOTS);
    if (!store.indexNames.contains("cycle")) {
      const all = await dbGetAll(S_SNAPSHOTS);
      return (
        all
          .filter((s) => s.cycle === cycle)
          .sort((a, b) => (a.ts < b.ts ? 1 : -1))[0] || null
      );
    }
    return new Promise((res, rej) => {
      const Range = pageWindow.IDBKeyRange || IDBKeyRange;
      const rq = store.index("cycle").openCursor(Range.only(cycle), "prev");
      rq.onsuccess = () => {
        const c = rq.result;
        res(c ? c.value : null);
      };
      rq.onerror = () => rej(rq.error);
    });
  }

  const pct = (r) => ((r ?? 0) * 100).toFixed(2) + "%";
  const stripFeature = (f) => String(f || "").replace(/^FEATURE_/, "");

  // 官方前端对撤销/退回的流水不计入消耗；这里按 status 过滤（实测 UNDO 的 ratio 均为 0，
  // 但语义上不应累计，避免未来出现非零撤销记录时多算）。
  const normAction = (a) => ({
    id: a.id,
    feature: stripFeature(a.feature),
    title: a.title || "",
    timestamp: a.timestamp,
    ratio: (a.items && a.items[0] ? Number(a.items[0].amountRatio) || 0 : 0),
    status: a.status || "DONE",
  });

  // ---------- capture (paged backfill) ----------
  // 服务端每页固定 20 条；pageToken 可一直翻到当前计费周期起点。
  // 每次抓取从最新往前翻，遇到"库里已有的 id"即停，保证增量抓取的成本随新增条数线性增长。
  const CAPTURE_MIN_MS = 55 * 1000;
  // 一个完整周期的流水上限实测约 2500 条（Code 高峰期 640 次/天）。
  // 回填上限取 250 页 = 5000 条，保证"整周期没开页面"也能一次补齐。
  const MAX_PAGES_INCREMENTAL = 40; // 800 条
  const MAX_PAGES_BACKFILL = 250; // 5000 条，首次/长时间未开页时使用
  const LAST_CAPTURE_KEY = "kqc_last_capture";
  // v0.7.x 的本地历史是稀疏的（只抓首页），升级后必须无条件走一次全量回填，
  // 否则"遇到已有 id 就停"会永远停在最新那条，旧缺口补不回来。
  const BACKFILL_DONE_KEY = "kqc_backfill_v2";

  let captureInFlight = null;
  let lastCapture = 0;

  async function knownIdsOnPage(acts) {
    const db = await dbOpenFor(S_ACTIONS);
    return new Promise((res) => {
      const out = new Set();
      if (!acts.length) return res(out);
      const store = db.transaction(S_ACTIONS, "readonly").objectStore(S_ACTIONS);
      let pending = acts.length;
      const done = () => {
        if (--pending === 0) res(out);
      };
      for (const a of acts) {
        const rq = store.get(a.id);
        rq.onsuccess = () => {
          if (rq.result) out.add(a.id);
          done();
        };
        rq.onerror = done;
      }
    });
  }

  async function captureLedger(force = false) {
    const now = Date.now();
    if (captureInFlight) return captureInFlight;
    if (!force && now - lastCapture < CAPTURE_MIN_MS) return 0;

    const lastSeen = Number(pageWindow.localStorage.getItem(LAST_CAPTURE_KEY) || 0);
    const stale = !lastSeen || now - lastSeen > 30 * 60 * 1000;
    const needFullBackfill = !pageWindow.localStorage.getItem(BACKFILL_DONE_KEY);
    const maxPages = stale || needFullBackfill ? MAX_PAGES_BACKFILL : MAX_PAGES_INCREMENTAL;

    captureInFlight = (async () => {
      let token = null;
      let pages = 0;
      let added = 0;
      try {
        while (pages < maxPages) {
          const body = token ? { pageSize: 20, pageToken: token } : { pageSize: 20 };
          const resp = await apiPost(API.actions, body);
          const acts = resp.actions || [];
          if (!acts.length) break;

          const known = await knownIdsOnPage(acts);
          let hitKnown = false;
          for (const a of acts) if (known.has(a.id)) hitKnown = true;
          // 全部 upsert：服务端可能修正同一条记录的状态/金额（如 DONE→UNDO）
          await dbPutAll(acts.map(normAction));
          added += acts.length - known.size;

          token = resp.nextPageToken;
          pages++;
          if (!token) {
            if (needFullBackfill) pageWindow.localStorage.setItem(BACKFILL_DONE_KEY, "1");
            break;
          }
          if (hitKnown && !needFullBackfill) break; // 已经追上本地记录
        }
        if (pages >= maxPages && token) debug(`backfill truncated at ${pages} pages`);
        debug(`ledger captured: +${added} in ${pages} page(s)`);
        pageWindow.localStorage.setItem(LAST_CAPTURE_KEY, String(Date.now()));
        return added;
      } catch (e) {
        debug("captureLedger err: " + e);
        return added;
      } finally {
        lastCapture = Date.now();
        captureInFlight = null;
      }
    })();
    return captureInFlight;
  }

  // ---------- snapshots ----------
  // 官方百分比只有"当下"，重置即消失。每页面加载/刷新都写一条快照（按分钟去重），
  // 同一周期内官方读数突然下降时，记一条"疑似官方重置"及其额度增量。
  const SNAP_MIN_MS = 60 * 1000;
  let lastSnapAt = 0;

  // 重置识别：全额归零看绝对降幅，部分重置看降幅 + 相对比例。
  const RESET_MIN_BEFORE = 0.005; // 0.5pp 以下不值得记
  const RESET_FULL_AFTER = 0.001; // 0.1pp 以内视作归零
  const RESET_PARTIAL_MIN = 0.05; // 5pp
  const RESET_PARTIAL_REL = 0.25; // 前值的 25%
  // 正常月切前后 48 小时内不记"月中重置"，等 currentStartTime 变化
  const RESET_BOUNDARY_GUARD_MS = 48 * 3600 * 1000;
  // 两条快照相隔 1 小时以内才认为时间"精确"
  const RESET_PRECISE_MS = 60 * 60 * 1000;
  // 本地流水合计与官方读数的差额超过 0.5pp 才当作未记录的增量
  const GRANT_RECONCILE_MIN = 0.005;

  const isoOf = (ms) => new Date(ms).toISOString();
  const resetKeyOf = (cycle, atIso) => `${cycle || ""}|${atIso || ""}`;

  function isGrantDrop(prev, cur) {
    if (!prev || !cur || prev.cycle !== cur.cycle) return false;
    const before = Number(prev.used) || 0;
    const after = Number(cur.used) || 0;
    const drop = before - after;
    if (before < RESET_MIN_BEFORE) return false;
    if (after <= RESET_FULL_AFTER) return true;
    return drop >= RESET_PARTIAL_MIN && drop >= RESET_PARTIAL_REL * before;
  }

  function isNearCycleBoundary(snap, fallbackEnd) {
    if (!snap) return false;
    const endIso = snap.cycleEnd || fallbackEnd;
    if (!endIso) return false;
    const end = Date.parse(endIso);
    return !isNaN(end) && Math.abs(end - snap.at) <= RESET_BOUNDARY_GUARD_MS;
  }

  async function findOverlappingReset(cycle, fromAt, toAt) {
    const all = await dbGetAll(S_RESETS);
    const f = Date.parse(fromAt);
    const t = Date.parse(toAt);
    return (
      all.find((r) => {
        if (r.cycle !== cycle) return false;
        const rf = Date.parse((r.bracket && r.bracket.fromAt) || r.at);
        const rt = Date.parse((r.bracket && r.bracket.toAt) || r.at);
        if (isNaN(rf) || isNaN(rt)) return false;
        return rf <= t && rt >= f;
      }) || null
    );
  }

  // 快照里抓到的下降：记录"重置前最高的读数 → 重置后最低的读数"。
  // 多标签页可能各自看到相邻区间，用重叠合并，避免同一事件记两条。
  async function recordGrantEvent(prev, cur) {
    const cycle = cur.cycle;
    if (!cycle) return null;
    const fromAt = isoOf(prev.at);
    const toAt = isoOf(cur.at);
    let existing = await findOverlappingReset(cycle, fromAt, toAt);
    // 已取消的事件只接受"同一事件"的重扫；如果新下降明显更晚，说明是另一次重置，
    // 不能把它并进已取消的记录里，否则新重置会被静默吃掉。
    if (existing && existing.dismissed) {
      const oldTo = Date.parse((existing.bracket && existing.bracket.toAt) || existing.at);
      if (!isNaN(oldTo) && Date.parse(toAt) - oldTo > 10 * 60 * 1000) existing = null;
    }
    const oldFrom = existing && existing.bracket ? Date.parse(existing.bracket.fromAt) : NaN;
    const oldTo = existing && existing.bracket ? Date.parse(existing.bracket.toAt) : NaN;
    const mergedFrom = Math.min(isNaN(oldFrom) ? Date.parse(fromAt) : oldFrom, Date.parse(fromAt));
    const mergedTo = Math.max(isNaN(oldTo) ? Date.parse(toAt) : oldTo, Date.parse(toAt));
    const fromUsed = Math.max(
      Number(existing && existing.bracket && existing.bracket.fromUsed) || 0,
      Number(prev.used) || 0,
    );
    const toUsed = Math.min(
      existing && existing.bracket && existing.bracket.toUsed != null ? Number(existing.bracket.toUsed) : 1,
      Number(cur.used) || 0,
    );
    const amount = Math.max(0, fromUsed - toUsed);
    const codeAmount = Math.max(
      Number(existing && existing.codeAmount) || 0,
      Math.max(0, (Number(prev.code) || 0) - (Number(cur.code) || 0)),
    );
    const existingAt = existing && existing.at ? Date.parse(existing.at) : NaN;
    const atMs = Math.min(isNaN(existingAt) ? Date.parse(toAt) : existingAt, Date.parse(toAt));
    const bracketMs = mergedTo - mergedFrom;
    const rec = {
      key: existing ? existing.key : resetKeyOf(cycle, toAt),
      cycle,
      at: isoOf(atMs),
      bracket: {
        fromAt: isoOf(mergedFrom),
        fromUsed,
        toAt: isoOf(mergedTo),
        toUsed,
      },
      amount,
      codeAmount,
      source: "snapshot",
      confidence: bracketMs <= RESET_PRECISE_MS ? "high" : "low",
      detectedAt: (existing && existing.detectedAt) || new Date().toISOString(),
      dismissed: !!(existing && existing.dismissed),
      note: (existing && existing.note) || "",
      h5: cur.h5 != null ? cur.h5 : existing ? existing.h5 : null,
      d7: cur.d7 != null ? cur.d7 : existing ? existing.d7 : null,
      balanceId: cur.balanceId || (existing && existing.balanceId) || null,
    };
    await dbPut(S_RESETS, rec);
    debug(`grant event: +${(amount * 100).toFixed(2)}pp (${rec.confidence})`);
    return rec;
  }

  // 回推历史快照里的跳水：用户升级脚本时，最新快照可能已经是重置后的 0%，
  // 只在“写新快照”时比较上一条会漏掉这次重置。启动和打开面板时各扫一遍，幂等。
  async function syncGrantEventsFromSnapshots(snaps, curCycle, curCycleEnd) {
    if (!Array.isArray(snaps) || snaps.length < 2) return 0;
    const byCycle = {};
    for (const s of snaps) {
      if (!s || !s.cycle || s.at == null) continue;
      (byCycle[s.cycle] = byCycle[s.cycle] || []).push(s);
    }
    let found = 0;
    for (const cycle of Object.keys(byCycle)) {
      const own = byCycle[cycle].sort((a, b) => a.at - b.at);
      const fallbackEnd = cycle === curCycle ? curCycleEnd : null;
      let cycleFound = false;
      for (let i = 1; i < own.length; i++) {
        const prev = own[i - 1];
        const cur = own[i];
        if (!isGrantDrop(prev, cur)) continue;
        if (isNearCycleBoundary(cur, fallbackEnd)) continue;
        await recordGrantEvent(prev, cur).catch((e) => debug("sync grant err: " + e));
        cycleFound = true;
        found++;
      }
      // 如果这个周期已经关账，补上/校正 totalGranted 等字段（只改计算字段，不删记录）
      if (cycleFound) await refreshCycleRecord(cycle).catch((e) => debug("refresh cycle err: " + e));
    }
    if (found) debug(`grant sync: ${found} drop(s) checked`);
    return found;
  }

  async function bootstrapGrantsFromSnapshots() {
    try {
      const [snaps, sub] = await Promise.all([
        dbGetAll(S_SNAPSHOTS),
        apiPost(API.sub).catch(() => null),
      ]);
      const startIso = sub && sub.subscription && sub.subscription.currentStartTime;
      const curCycle = startIso ? cycleOf(startIso) : null;
      const endIso =
        (sub && sub.subscription && (sub.subscription.nextBillingTime || sub.subscription.currentEndTime)) || null;
      await syncGrantEventsFromSnapshots(snaps, curCycle, endIso);
    } catch (e) {
      debug("bootstrap grants err: " + e);
    }
  }

  async function recordSnapshot(stats, sub) {
    const bal = stats && stats.subscriptionBalance;
    if (!bal) return;
    const startIso = (sub && sub.subscription && sub.subscription.currentStartTime) || "";
    if (startIso) addCycleStart(startIso);
    const cycle = cycleOf(startIso || new Date().toISOString()) || "";
    const minMs = pageWindow.__KQC && pageWindow.__KQC.snapMinMs != null ? pageWindow.__KQC.snapMinMs : SNAP_MIN_MS;
    const now = Date.now();
    const cycleChanged = pageWindow.__KQC.lastSnapCycle !== cycle;
    if (!cycleChanged && now - lastSnapAt < minMs) return;
    lastSnapAt = now;
    pageWindow.__KQC.lastSnapCycle = cycle;

    const minute = new Date(now).toISOString().slice(0, 16);
    const cycleEnd =
      (sub && sub.subscription && (sub.subscription.nextBillingTime || sub.subscription.currentEndTime)) ||
      (bal && bal.expireTime) ||
      null;
    const rec = {
      // 主键带上周期：跨周期同一分钟的两条快照不会互相覆盖
      ts: cycle ? `${cycle}|${minute}` : minute,
      minute,
      cycle,
      cycleStart: startIso || null,
      cycleEnd,
      used: Number(bal.amountUsedRatio) || 0,
      code: Number(bal.kimiCodeUsedRatio) || 0,
      h5: Number(stats && stats.ratelimitCode5h && stats.ratelimitCode5h.ratio) || 0,
      d7: Number(stats && stats.ratelimitCode7d && stats.ratelimitCode7d.ratio) || 0,
      balanceId: bal.id || null,
      planTitle: (sub && sub.subscription && sub.subscription.goods && sub.subscription.goods.title) || null,
      at: now,
    };
    try {
      // 先读同周期最后一条，再写本次快照：这样比较的是"写之前"的状态
      const prev = await dbGetLastSnapshot(cycle).catch(() => null);
      await dbPut(S_SNAPSHOTS, rec);
      if (prev && isGrantDrop(prev, rec) && !isNearCycleBoundary(rec)) {
        await recordGrantEvent(prev, rec).catch((e) => debug("grant err: " + e));
      }
      if (startIso) await closePreviousCycle(startIso);
    } catch (e) {
      debug("snapshot err: " + e);
    }
  }

  // 本地流水合计应该 ≈ 官方当前已用 + 历次增量。
  // 差额明显大于已记录增量时，补一条（或校正最近一条）"本地推断"的重置事件。
  async function reconcileGrants(cycle, officialUsed, officialCode, entries) {
    if (!cycle || officialUsed == null) return;
    const local = entries.filter((e) => ((e.status || "DONE") === "DONE") && cycleOf(e.timestamp) === cycle);
    const localSum = local.reduce((a, e) => a + (Number(e.ratio) || 0), 0);
    const localCode = local
      .filter((e) => e.feature === "CODING")
      .reduce((a, e) => a + (Number(e.ratio) || 0), 0);
    const grantInv = Math.max(0, localSum - officialUsed);
    if (grantInv < GRANT_RECONCILE_MIN) return;
    const all = await dbGetAll(S_RESETS);
    const owns = all.filter((r) => r.cycle === cycle);
    const explained = owns.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const delta = grantInv - explained;
    if (delta <= GRANT_RECONCILE_MIN) return;
    const codeInv = Math.max(0, localCode - (officialCode == null ? 0 : Number(officialCode)));
    const codeExplained = owns.reduce((a, r) => a + (Number(r.codeAmount) || 0), 0);
    const codeDelta = Math.max(0, codeInv - codeExplained);
    const codeAdd = codeDelta > GRANT_RECONCILE_MIN ? codeDelta : 0;
    const active = owns.filter((r) => !r.dismissed).sort((a, b) => (a.at < b.at ? -1 : 1));
    const nowIso = new Date().toISOString();
    const latest = active[active.length - 1];
    const recent = latest && Math.abs(Date.now() - Date.parse(latest.at)) < 60 * 60 * 1000;
    // 只有一条快照事件时，小差额当作同一事件漏记（重置后的用量落在两次快照之间）；
    // 大差额且事件较旧，说明可能是另一次没被快照抓到的重置。
    const canCorrect = latest && (recent || (active.length === 1 && delta < 0.05));
    if (canCorrect) {
      latest.amount = (Number(latest.amount) || 0) + delta;
      latest.codeAmount = (Number(latest.codeAmount) || 0) + codeAdd;
      latest.note = "按本地流水差额校正";
      latest.correctedAt = nowIso;
      await dbPut(S_RESETS, latest);
      debug(`grant corrected: +${(delta * 100).toFixed(2)}pp`);
    } else {
      const rec = {
        key: resetKeyOf(cycle, nowIso),
        cycle,
        at: nowIso,
        bracket: null,
        amount: delta,
        codeAmount: codeAdd,
        source: "ledger",
        confidence: "low",
        detectedAt: nowIso,
        dismissed: false,
        note: "按本地流水差额推断",
        h5: null,
        d7: null,
        balanceId: null,
      };
      await dbPut(S_RESETS, rec);
      debug(`grant inferred: +${(delta * 100).toFixed(2)}pp`);
    }
  }

  async function refreshCycleRecord(cycle) {
    const rec = await dbGet(S_CYCLES, cycle);
    if (!rec) return;
    const all = await dbGetAll(S_RESETS);
    const active = all.filter((r) => r.cycle === cycle && !r.dismissed);
    const totalGranted = active.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const totalCodeGranted = active.reduce((a, r) => a + (Number(r.codeAmount) || 0), 0);
    rec.totalGranted = totalGranted;
    rec.totalCodeGranted = totalCodeGranted;
    rec.totalConsumed = (Number(rec.used) || 0) + totalGranted;
    rec.effectiveLimit = 1 + totalGranted;
    rec.resetCount = active.length;
    await dbPut(S_CYCLES, rec);
  }

  async function closePreviousCycle(currentStart) {
    const snaps = await dbGetAll(S_SNAPSHOTS);
    if (!snaps.length) return;
    const starts = [...new Set(snaps.map((s) => s.cycleStart || s.cycle).filter(Boolean))].sort();
    const resetsAll = await dbGetAll(S_RESETS).catch(() => []);
    for (const c of starts) {
      if (c >= currentStart) continue;
      const key = cycleKeyOf(c);
      if (await dbGet(S_CYCLES, key)) continue;
      const own = snaps
        .filter((s) => (s.cycleStart || s.cycle) === c)
        .sort((a, b) => (a.ts < b.ts ? -1 : 1));
      if (!own.length) continue;
      const last = own[own.length - 1];
      const active = resetsAll.filter((r) => r.cycle === key && !r.dismissed);
      const totalGranted = active.reduce((a, r) => a + (Number(r.amount) || 0), 0);
      const totalCodeGranted = active.reduce((a, r) => a + (Number(r.codeAmount) || 0), 0);
      await dbPut(S_CYCLES, {
        cycle: key,
        cycleStart: c,
        cycleEnd: currentStart || last.cycleEnd || null,
        closedAt: last.ts,
        used: last.used,
        code: last.code,
        totalGranted,
        totalCodeGranted,
        totalConsumed: (Number(last.used) || 0) + totalGranted,
        effectiveLimit: 1 + totalGranted,
        resetCount: active.length,
        samples: own.length,
      });
      debug("cycle closed: " + key);
    }
  }

  // ---------- display helpers ----------
  // API 返回的是 UTC 时间，展示时转换为用户本地时区
  const fmtLocal = (iso, withSec = false) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d)) return "-";
    const p = (x) => String(x).padStart(2, "0");
    const base =
      d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    return withSec ? base + ":" + p(d.getSeconds()) : base;
  };

  // 计费周期的权威来源是官方 GetSubscription().currentStartTime；
  // 只有拿不到官方边界的老数据，才退回"每月 19 日 02:02 UTC"的经验规则。
  const CYCLE_START_DAY = 19;
  const CYCLE_START_UTC_H = 2;
  const CYCLE_START_UTC_M = 2;
  let cycleStarts = [];

  const cycleKeyOf = (iso) => String(iso || "").slice(0, 10);
  function setCycleStarts(list) {
    cycleStarts = [...new Set(list.filter(Boolean))].sort();
  }
  function addCycleStart(iso) {
    if (!iso || cycleStarts.includes(iso)) return;
    cycleStarts = [...cycleStarts, iso].sort();
  }

  function ruleCycleOf(isoLike) {
    const d = new Date(isoLike);
    if (isNaN(d)) return null;
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const afterReset =
      d.getUTCDate() > CYCLE_START_DAY ||
      (d.getUTCDate() === CYCLE_START_DAY &&
        (d.getUTCHours() > CYCLE_START_UTC_H ||
          (d.getUTCHours() === CYCLE_START_UTC_H && d.getUTCMinutes() >= CYCLE_START_UTC_M)));
    const base = afterReset ? new Date(Date.UTC(y, m, CYCLE_START_DAY)) : new Date(Date.UTC(y, m - 1, CYCLE_START_DAY));
    return base.toISOString().slice(0, 10);
  }

  // 落在已知周期起点之后的第一条，决定它属于哪个周期；更早的记录用经验规则兜底
  function cycleOf(isoLike) {
    const t = Date.parse(isoLike);
    if (isNaN(t)) return null;
    let best = null;
    for (const s of cycleStarts) {
      const st = Date.parse(s);
      if (!isNaN(st) && st <= t) best = s;
    }
    if (best) return cycleKeyOf(best);
    // 早于已知最早周期起点的记录归到上一个周期：
    // 官方起点是 02:02:15，按分钟规则会把重置前 15 秒的流水错算进新周期
    if (cycleStarts.length) {
      const first = Date.parse(cycleStarts[0]);
      if (!isNaN(first) && t < first && first - t < 24 * 3600 * 1000) return ruleCycleOf(new Date(first - 1000).toISOString());
    }
    return ruleCycleOf(isoLike);
  }

  // 官方周期是按天算的（这次是 10/19 10:02 → 11/18 10:02，刚好 30 天），
  // 不能按"自然月 +1"推，否则会多显示一天。历史周期没有 cycleEnd 时退回 +30 天。
  const DAY_MS = 86400000;
  function cycleBounds(key, cyclesMap, curCycle, sub) {
    let start = null;
    let end = null;
    if (key === curCycle && sub && sub.subscription) {
      start = sub.subscription.currentStartTime || null;
      end = sub.subscription.nextBillingTime || sub.subscription.currentEndTime || null;
    }
    const rec = cyclesMap && cyclesMap[key];
    if (!start && rec && rec.cycleStart) start = rec.cycleStart;
    if (!end && rec && rec.cycleEnd) end = rec.cycleEnd;
    if (!start) start = key + "T00:00:00Z";
    if (!end) end = new Date(Date.parse(start) + 30 * DAY_MS).toISOString();
    return { start, end };
  }
  function cycleLabel(key, cyclesMap, curCycle, sub) {
    if (!key) return "-";
    const { start, end } = cycleBounds(key, cyclesMap, curCycle, sub);
    return `${fmtLocal(start).slice(5, 10)} – ${fmtLocal(end).slice(5, 10)}`;
  }
  function cycleRangeText(key, cyclesMap, curCycle, sub) {
    if (!key) return "-";
    const { start, end } = cycleBounds(key, cyclesMap, curCycle, sub);
    const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS));
    return `${fmtLocal(start).slice(5)} – ${fmtLocal(end).slice(5)}（${t("cycleDays", { v: days })}）`;
  }

  function resetIsPrecise(r) {
    if (!r || !r.bracket) return false;
    const f = Date.parse(r.bracket.fromAt);
    const to = Date.parse(r.bracket.toAt);
    return r.confidence === "high" && !isNaN(f) && !isNaN(to) && to - f <= RESET_PRECISE_MS;
  }
  function resetWhenText(r) {
    if (!r) return "-";
    return resetIsPrecise(r) ? fmtLocal(r.at).slice(5) : t("resetTimeUnknown");
  }
  function resetSourceText(r) {
    if (!r) return "";
    if (r.source === "snapshot" && r.bracket) {
      if (resetIsPrecise(r)) {
        return `${t("resetSourceSnapshot")} · ${fmtLocal(r.bracket.fromAt).slice(5)} ${pct(r.bracket.fromUsed)} → ${fmtLocal(
          r.bracket.toAt,
        ).slice(5)} ${pct(r.bracket.toUsed)}`;
      }
      return `${t("resetSourceSnapshot")} · ${t("resetDetectedAt", { v: fmtLocal(r.at).slice(5) })}`;
    }
    return `${t("resetSourceLedger")} · ${t("resetDetectedAt", { v: fmtLocal(r.at).slice(5) })}`;
  }

  // 功能显示名。WORK 的子服务（Search/Fetch/Media）由 title 体现，不单独分类。
  const FEAT_NAMES = {
    CODING: { zh: "Kimi Code", en: "Kimi Code" },
    WORK: { zh: "Kimi Work", en: "Kimi Work" },
    WEBSITES: { zh: "网站构建", en: "Websites" },
    SWARM: { zh: "Agent Swarm", en: "Agent Swarm" },
    AGENT: { zh: "Agent", en: "Agent" },
    CHAT: { zh: "Chat", en: "Chat" },
    MY_KIMI: { zh: "My Kimi", en: "My Kimi" },
    PLUGIN: { zh: "插件", en: "Plugin" },
    SLIDES: { zh: "PPT", en: "Slides" },
    SLIDES_NBP: { zh: "PPT", en: "Slides" },
    K2D8_PREVIEW: { zh: "K2.8 预览", en: "K2.8 Preview" },
    CLAW: { zh: "Claw", en: "Claw" },
  };
  const titleCase = (x) => x.toLowerCase().replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const featName = (f) => {
    const raw = String(f || "");
    if (FEAT_NAMES[raw]) return FEAT_NAMES[raw][LANG] || FEAT_NAMES[raw].en;
    return titleCase(raw.replace(/_/g, " "));
  };

  // ---------- calibration ----------
  // 每 1% 月池对应的公开 API 等价值（元）。Code 与网页/Work 类实测差 3–7 倍，分开记。
  const RATE_CODE_KEY = "kqc_rate_code";
  const RATE_OTHER_KEY = "kqc_rate_other";
  const LEGACY_POOL_KEY = "kqc_pool_value_cny";
  const LEGACY_POOL_USD_KEY = "kqc_pool_value_usd";
  const PLAN_KEY = "kqc_plan";
  // 用户手动改过费率后置 1：切换套餐不再覆盖，避免把自校准值冲掉
  const RATE_MANUAL_KEY = "kqc_rate_manual";

  // 套餐只用来给"参考值"和实测/未实测标记，本身不参与计算
  // 参考值只对 Allegretto 实测过（Code 21 / 其他 6）。
  // 其余老档位按"Code 月额度倍数"（第三方口径 28M/108M/540M/1600M）等比推算：
  // rate = 21 × (该档 Code 额度 / Allegretto 540M)；"其他"按实测比例 code/3.5。
  // 新套餐取消了 Code 补贴，不适用这套倍数，因此不给参考值。
  const PLANS = [
    { id: "andante", group: "old", label: "Andante ¥49", ref: { c: 1.1, o: 0.3 }, measured: false },
    { id: "moderato", group: "old", label: "Moderato ¥99", ref: { c: 4.2, o: 1.2 }, measured: false },
    { id: "allegretto", group: "old", label: "Allegretto ¥199", ref: { c: 21, o: 6 }, measured: true },
    { id: "allegro", group: "old", label: "Allegro ¥699", ref: { c: 62, o: 18 }, measured: false },
    { id: "go", group: "new", label: "Go ¥49", ref: null, measured: false },
    { id: "plus", group: "new", label: "Plus ¥99", ref: null, measured: false },
    { id: "pro", group: "new", label: "Pro ¥199", ref: null, measured: false },
    { id: "max", group: "new", label: "Max ¥699", ref: null, measured: false },
    { id: "ultra", group: "new", label: "Ultra ¥1399", ref: null, measured: false },
    { id: "custom", group: "custom", label: "自定义", ref: null, measured: false },
  ];
  const planInfo = () => PLANS.find((p) => p.id === pageWindow.localStorage.getItem(PLAN_KEY)) || null;

  function migrateLegacyRates() {
    const ls = pageWindow.localStorage;
    if (ls.getItem(RATE_CODE_KEY) != null || ls.getItem(RATE_OTHER_KEY) != null) return;
    const cur = ls.getItem("kqc_currency") === "USD" ? "USD" : "CNY";
    const cny = Number(ls.getItem(LEGACY_POOL_KEY));
    const usd = Number(ls.getItem(LEGACY_POOL_USD_KEY));
    let code = null;
    // 旧版按 kqc_currency 决定生效的是哪个币种，迁移必须跟随
    if (cur === "USD" && usd > 0) code = (usd * 7.1) / 100;
    else if (cny > 0) code = cny / 100;
    else if (usd > 0) code = (usd * 7.1) / 100;
    // 没有历史校准值就保持为空：金额默认不显示
    if (code != null) {
      ls.setItem(RATE_CODE_KEY, String(+code.toFixed(2)));
      ls.setItem(RATE_OTHER_KEY, String(+Math.max(1, code / 3.5).toFixed(2)));
    }
  }

  // 费率是可选项：未填返回 null，全站不显示任何金额
  const rateCode = () => {
    const v = Number(pageWindow.localStorage.getItem(RATE_CODE_KEY));
    return v > 0 ? v : null;
  };
  const rateOther = () => {
    const v = Number(pageWindow.localStorage.getItem(RATE_OTHER_KEY));
    return v > 0 ? v : null;
  };
  const rateFor = (feat) => (String(feat).toUpperCase() === "CODING" ? rateCode() : rateOther());

  // ---------- panel ----------
  GM_addStyle(`
    #kqc-btn { position: fixed; bottom: 20px; right: 20px; z-index: 10000; padding: 10px 20px;
      background: #7c5cff; color: #fff; border: none; border-radius: 8px; cursor: pointer;
      font-weight: 600; font-family: -apple-system, system-ui, sans-serif; }
    #kqc-root { position: fixed; top: 4%; left: 50%; transform: translateX(-50%); width: 860px;
      max-height: 92vh; overflow-y: auto; background: #fff; border-radius: 12px;
      box-shadow: 0 10px 50px rgba(0,0,0,.3); z-index: 10001; padding: 22px; display: none;
      flex-direction: column; border: 1px solid #e5e5e5; color: #333;
      font-family: -apple-system, system-ui, sans-serif; }
    .kqc-card { background:#f9f9f9; border:1px solid #eee; border-radius:8px; padding:12px; }
    .kqc-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:14px; }
    .kqc-label { font-size:12px; color:#666; margin-bottom:4px; }
    .kqc-value { font-size:15px; font-weight:bold; color:#7c5cff; }
    table.kqc-table { width:100%; border-collapse:collapse; font-size:12px; }
    .kqc-table th { text-align:left; padding:6px 8px; border-bottom:1px solid #eee; color:#666; background:#f5f5f5;
      position:sticky; top:0; }
    .kqc-table td { padding:5px 8px; border-bottom:1px solid #f0f0f0; font-family:monospace; }
    .kqc-close { cursor:pointer; font-size:26px; color:#999; line-height:1; }
    .kqc-tip { position:relative; display:inline-block; color:#e02020; font-weight:bold; cursor:help; margin-left:4px; }
    .kqc-tipbox { display:none; position:absolute; right:0; top:22px; z-index:10002; width:420px;
      background:#333; color:#fff; font-size:12px; font-weight:normal; line-height:1.7;
      padding:12px 14px; border-radius:8px; box-shadow:0 6px 24px rgba(0,0,0,.4); }
    .kqc-tip:hover .kqc-tipbox { display:block; }
    .kqc-tipbox code { background:#555; padding:1px 5px; border-radius:4px; }
    .kqc-est { font-size:11px; color:#999; }
    .kqc-foot { font-size:11px; color:#999; margin-top:10px; line-height:1.6; }
    .kqc-canary { background:#fff3cd; border:1px solid #f0d47a; color:#856404; border-radius:8px;
      padding:10px 12px; font-size:12px; margin-bottom:14px; }
    .kqc-btn2 { border:1px solid #ddd; background:#fff; border-radius:6px; padding:4px 10px;
      font-size:12px; cursor:pointer; color:#444; }
    .kqc-btn2:hover { border-color:#7c5cff; color:#7c5cff; }
    .kqc-input { width:56px; font-size:12px; padding:2px 4px; border:1px solid #ddd; border-radius:4px; }
    .kqc-pill { display:inline-block; background:#efeaff; color:#5b40cc; border-radius:10px;
      padding:1px 8px; font-size:11px; margin-left:6px; }
    .kqc-cycleinfo { flex:1 1 260px; min-width:220px; line-height:1.55; padding:2px 0; }
    .kqc-ci-main { font-size:12px; color:#3a3a3a; font-weight:600; }
    .kqc-ci-sub { font-size:11px; color:#9a9a9a; }
    .kqc-ci-reset { font-size:11px; color:#a56b00; }
    .kqc-cum { font-size:12px; color:#3a3a3a; background:#f4f1ff; border-radius:6px;
      padding:4px 8px; margin:5px 0 2px; font-weight:600; }
    .kqc-sublabel { font-size:11px; color:#777; margin-top:6px; }
    .kqc-resets { background:#fff8e8; border:1px solid #f0d9a8; border-radius:8px;
      padding:8px 10px; margin-bottom:10px; }
    .kqc-resets-title { font-size:12px; font-weight:600; color:#8a5a00; margin-bottom:2px; }
    .kqc-reset-row { display:flex; flex-wrap:wrap; gap:4px 10px; align-items:center;
      font-size:11px; color:#555; padding:4px 0; border-top:1px dashed #eedcb8; }
    .kqc-reset-row:first-of-type { border-top:none; }
    .kqc-reset-row.is-off { color:#aaa; }
    .kqc-reset-tag { background:#fff0c2; color:#8a5a00; border-radius:8px; padding:1px 6px; }
    .kqc-reset-row.is-off .kqc-reset-tag { background:#eee; color:#999; }
    .kqc-reset-amt { font-family:monospace; font-weight:600; color:#c0392b; }
    .kqc-reset-row.is-off .kqc-reset-amt { color:#aaa; text-decoration:line-through; }
    .kqc-reset-src { color:#999; }
    .kqc-shown { font-size:11px; color:#555; }
    .kqc-reset-warn { font-size:11px; color:#b26a00; margin-top:4px; }
  `);

  const state = { entries: [], cycles: {}, resets: [], viewCycle: null, rows: 300 };
  pageWindow.__KQC.state = state;

  // v 是 0–1 的比例，费率是"元 / 1%"（可选项），所以要 ×100
  const money = (v, feat) => {
    const r = rateFor(feat);
    return r == null ? "" : "¥" + (v * 100 * r).toFixed(2);
  };

  function renderPanel(stats, usages, sub) {
    const root = document.getElementById("kqc-root");
    const bal = stats && stats.subscriptionBalance;
    const coding = usages && usages.usages && usages.usages[0];
    const weekly = coding && coding.detail;
    const h5 = coding && coding.limits && coding.limits[0] && coding.limits[0].detail;
    const total = usages && usages.totalQuota;
    const n = (x) => Number(x || 0);
    const usedRatio = bal ? Number(bal.amountUsedRatio) || 0 : 0;
    const codeOfficial = bal && bal.kimiCodeUsedRatio != null ? Number(bal.kimiCodeUsedRatio) : null;

    const cycleStart = (sub && sub.subscription && sub.subscription.currentStartTime) || null;
    const curCycle = cycleOf(cycleStart || new Date().toISOString());
    const isDone = (e) => !e.status || e.status === "DONE";

    const cycleKeys = [
      ...new Set([
        ...state.entries.map((e) => cycleOf(e.timestamp)),
        ...Object.keys(state.cycles),
        ...state.resets.map((r) => r.cycle),
        curCycle,
      ].filter(Boolean)),
    ].sort().reverse();
    const view = state.viewCycle || curCycle;
    const isCurrent = view === curCycle;
    const closed = state.cycles[view] || null;

    const viewResets = state.resets
      .filter((r) => r.cycle === view)
      .sort((a, b) => (a.at < b.at ? -1 : 1));
    const activeResets = viewResets.filter((r) => !r.dismissed);
    const totalGranted = activeResets.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const totalCodeGranted = activeResets.reduce((a, r) => a + (Number(r.codeAmount) || 0), 0);
    const hasReset = activeResets.length > 0;
    const effectiveLimit = 1 + totalGranted;

    const viewEntries = state.entries.filter((e) => (view === "ALL" ? true : cycleOf(e.timestamp) === view) && isDone(e));

    const featSums = {};
    for (const e of viewEntries) {
      const raw = String(e.feature).toUpperCase();
      if (raw === "CODING") continue;
      featSums[raw] = (featSums[raw] || 0) + (e.ratio || 0);
    }
    const featOrder = ["WORK", "WEBSITES", "AGENT", "SWARM", "CHAT"];
    const featKeys = [
      ...featOrder.filter((k) => featSums[k] != null),
      ...Object.keys(featSums)
        .filter((k) => !featOrder.includes(k))
        .sort((a, b) => featSums[b] - featSums[a]),
    ];
    const localNonCode = featKeys.reduce((a, k) => a + featSums[k], 0);
    const localCode = viewEntries.filter((e) => e.feature === "CODING").reduce((a, e) => a + e.ratio, 0);

    // 官方读数只认接口：当期用实时值，历史周期用快照里固化的期末读数。
    // 有重置时，本周期累计消耗 = 官方当前读数 + 历次实际降幅；总额度 = 100% + 降幅之和。
    // 没有重置时 totalGranted=0，这两个值和旧逻辑完全一致。
    const officialTotal = isCurrent ? usedRatio : closed && closed.used != null ? Number(closed.used) : null;
    const codeBase = isCurrent ? codeOfficial : closed && closed.code != null ? Number(closed.code) : null;
    const codeIsOfficial = codeBase != null;
    const codeVal = codeBase != null ? codeBase + totalCodeGranted : localCode;
    const totalConsumed = officialTotal != null ? officialTotal + totalGranted : null;
    const localSum = codeVal + localNonCode;
    const localSumForCompleteness = localCode + localNonCode;
    // 用户手动取消掉唯一的重置后，主面板回到"官方当前 vs 本地累计"的旧口径；
    // 这时差异通常很大，不把完整度/尾差显示成正常值，只在重置记录里提醒。
    const dismissedMismatch =
      !hasReset && viewResets.length > 0 && officialTotal != null && localSum - officialTotal > 0.005;
    const completeness =
      totalConsumed && !dismissedMismatch ? Math.min(1, localSumForCompleteness / totalConsumed) : null;
    const cumulativeRate = totalConsumed != null && effectiveLimit > 0 ? totalConsumed / effectiveLimit : null;

    const moneyOn = rateCode() != null || rateOther() != null;

    const featLines = [];
    if (hasReset) featLines.push(`<div class="kqc-sublabel">${esc(t("cumulativeBreakdown"))}</div>`);
    {
      const m = money(codeVal, "CODING");
      const codeSrc = codeIsOfficial ? (hasReset ? t("officialCumulative") : t("official")) : t("local");
      featLines.push(
        `<div class="kqc-label" style="margin-top:2px">${t("ofWhich")} <b>${esc(featName("CODING"))}</b> <b>${pct(codeVal)}</b>（${esc(codeSrc)}）${m ? " · " + m : ""}</div>`,
      );
    }
    for (const k of featKeys) {
      const m = money(featSums[k], k);
      featLines.push(
        `<div class="kqc-label" style="margin-top:2px">${esc(featName(k))} <b>${pct(featSums[k])}</b>${m ? " · " + m : ""}</div>`,
      );
    }
    if (totalConsumed != null) {
      const miss = totalConsumed - localSum;
      if (miss > 0.0005) {
        const m = money(miss, "OTHER");
        featLines.push(
          `<div class="kqc-label" style="margin-top:2px">${esc(t("notCaptured"))} <b>${pct(miss)}</b>${m ? " · " + m : ""}</div>`,
        );
      } else if (Math.abs(miss) > 1e-6 && !dismissedMismatch) {
        // 官方总量与明细本身就有 ±0.02~0.03pp 的尾差，不能当成漏抓
        featLines.push(
          `<div class="kqc-label" style="margin-top:2px;color:#aaa">${esc(t("tailDiff", { v: (miss > 0 ? "+" : "") + (miss * 100).toFixed(2) + "%" }))}</div>`,
        );
      }
    }
    if (!isCurrent && view !== "ALL" && officialTotal == null) {
      featLines.push(
        `<div class="kqc-label" style="margin-top:2px;color:#aaa">${esc(t("localOnly", { v: pct(localSumForCompleteness) }))}</div>`,
      );
    }

    const showTotalMoney =
      rateCode() != null && rateOther() != null && (totalConsumed != null || view === "ALL");
    const totalMoney = showTotalMoney
      ? codeVal * 100 * rateCode() +
        Math.max(0, (totalConsumed != null ? totalConsumed : localSum) - codeVal) * 100 * rateOther()
      : null;

    const earliest = state.entries.length
      ? state.entries.reduce((m, e) => (e.timestamp < m ? e.timestamp : m), state.entries[0].timestamp)
      : null;
    const localStatsLine = state.entries.length
      ? `<div class="kqc-label" style="margin-top:6px">${t("localStats", { n: state.entries.length, d: fmtLocal(earliest).slice(0, 10) })}</div>`
      : "";

    // 大数字：没有重置时保持旧版（只显示官方读数）；
    // 有重置时，当前周期主数字仍是官方当前值，历史周期主数字换成"本周期累计"。
    let bigLabel;
    let bigValue;
    let bigSuffix = "";
    if (view === "ALL") {
      bigLabel = t("cycleAll");
      bigValue = pct(localSumForCompleteness);
    } else if (hasReset && totalConsumed != null) {
      if (isCurrent) {
        bigLabel = t("monthlyUsedOfficialCurrent");
        bigValue = pct(officialTotal);
        if (total) bigSuffix = ' <span style="font-weight:400;font-size:12px;color:#666">(' + n(total.used) + "/" + n(total.limit) + ")</span>";
      } else {
        bigLabel = t("cycleCumulativeLabel");
        bigValue = pct(totalConsumed);
      }
    } else if (officialTotal != null) {
      bigLabel = isCurrent ? t("monthlyUsed") : cycleLabel(view, state.cycles, curCycle, sub);
      bigValue = pct(officialTotal);
      if (isCurrent && total) bigSuffix = ' <span style="font-weight:400;font-size:12px;color:#666">(' + n(total.used) + "/" + n(total.limit) + ")</span>";
    } else {
      bigLabel = cycleLabel(view, state.cycles, curCycle, sub);
      bigValue = `<span style="font-size:15px;color:#c0392b">${esc(t("noRecord"))}</span>`;
    }

    const cumulativeLine =
      hasReset && totalConsumed != null
        ? `<div class="kqc-cum">${esc(
            isCurrent
              ? t("cycleCumulative", { used: pct(totalConsumed), limit: pct(effectiveLimit), rate: pct(cumulativeRate) })
              : t("cycleLimitOnly", { limit: pct(effectiveLimit), n: activeResets.length }),
          )}</div>`
        : "";
    const officialEndLine =
      hasReset && !isCurrent && officialTotal != null
        ? `<div class="kqc-ci-sub" style="margin-top:2px">${esc(t("officialEndValue", { v: pct(officialTotal) }))}</div>`
        : "";

    const shown = viewEntries.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, state.rows);
    const rows = shown
      .map((a) => {
        const m = money(a.ratio, a.feature);
        return `<tr>
        <td>${fmtLocal(a.timestamp, true)}</td>
        <td>${esc(featName(a.feature))}</td>
        <td style="font-family:inherit">${esc(String(a.title || "").slice(0, 52))}</td>
        <td>${pct(a.ratio)}</td>
        ${moneyOn ? `<td>${m || "-"}</td>` : ""}
      </tr>`;
      })
      .join("");
    const cycleOptions = [
      `<option value="ALL" ${view === "ALL" ? "selected" : ""}>${t("cycleAll")} (${state.entries.length})</option>`,
      ...cycleKeys.map((k) => {
        const c = state.cycles[k];
        let tag = "";
        if (c) {
          if ((c.resetCount || 0) > 0 || (c.totalGranted || 0) > 0) {
            tag = ` · ${t("cycleTotalTag", {
              used: pct(c.totalConsumed != null ? c.totalConsumed : c.used),
              limit: pct(c.effectiveLimit != null ? c.effectiveLimit : 1),
            })}`;
          } else {
            tag = ` · ${t("cycleEndValue", { v: pct(c.used) })}`;
          }
        }
        return `<option value="${esc(k)}" ${view === k ? "selected" : ""}>${cycleLabel(k, state.cycles, curCycle, sub)}${esc(tag)}</option>`;
      }),
    ].join("");

    // 套餐 / 费率
    const plan = planInfo();
    const planGroup = plan ? plan.group : null;
    const planOptions = [
      `<option value="">${esc(t("planNone"))}</option>`,
      ...PLANS.map((p) => `<option value="${esc(p.id)}" ${plan && plan.id === p.id ? "selected" : ""}>${esc(p.label)}</option>`),
    ].join("");
    const planBadge = !plan
      ? ""
      : plan.measured
        ? `<span class="kqc-pill" style="background:#e6f7ec;color:#1e7e43">${esc(t("planOld"))}</span>`
        : planGroup === "old"
          ? `<span class="kqc-pill" style="background:#fff4e5;color:#a56b00">${esc(t("planExtrap"))}</span>`
          : planGroup === "new"
            ? `<span class="kqc-pill" style="background:#f0f0f0;color:#888">${esc(t("planNew"))}</span>`
            : "";
    const rateManual = pageWindow.localStorage.getItem(RATE_MANUAL_KEY) === "1";
    const planHint = planGroup === "old" ? t("planHintOld") : planGroup === "new" ? t("planHintNew") : t("rateHint");

    const canaryBanner = pageWindow.__KQC.streamUsageDetected ? `<div class="kqc-canary">⚠ ${esc(t("canary"))}</div>` : "";
    const win5Line = h5 ? t("quotaUnits", { u: n(h5.used), l: n(h5.limit), r: n(h5.remaining) }) : "";
    const win7Line = weekly ? t("quotaUnits", { u: n(weekly.used), l: n(weekly.limit), r: n(weekly.remaining) }) : "";
    const nextBillingIso =
      (sub && sub.subscription && (sub.subscription.nextBillingTime || sub.subscription.currentEndTime)) ||
      (bal && bal.expireTime) ||
      null;
    const latestActive = activeResets[activeResets.length - 1] || null;
    const cycleInfo =
      view === "ALL"
        ? ""
        : `<div class="kqc-cycleinfo">
            <div class="kqc-ci-main">${esc(t("cycleRange", { v: cycleRangeText(view, state.cycles, curCycle, sub) }))}</div>
            ${latestActive ? `<div class="kqc-ci-reset">${esc(t("lastSuspectedReset", { v: resetWhenText(latestActive) }))}</div>` : ""}
            <div class="kqc-ci-sub">${esc(
              isCurrent
                ? t("nextBilling", { v: fmtLocal(nextBillingIso).slice(5) })
                : t("cycleEndLine", { v: fmtLocal(cycleBounds(view, state.cycles, curCycle, sub).end).slice(5) }),
            )}</div>
          </div>`;

    const resetRow = (r) => {
      const off = !!r.dismissed;
      const amt = (Number(r.amount) || 0) * 100;
      const codeAmt = (Number(r.codeAmount) || 0) * 100;
      return `<div class="kqc-reset-row${off ? " is-off" : ""}">
        <span>${esc(resetWhenText(r))}</span>
        <span class="kqc-reset-tag">${esc(off ? t("resetCancelled") : t("suspectedReset"))}</span>
        <span class="kqc-reset-amt">${esc(t("resetAmount", { v: amt.toFixed(2) + "pp" }))}</span>
        ${codeAmt > 0 ? `<span class="kqc-reset-src">${esc(t("resetCodeAmount", { v: codeAmt.toFixed(2) + "pp" }))}</span>` : ""}
        <span class="kqc-reset-src">${esc(resetSourceText(r))}</span>
        <button class="kqc-btn2" data-reset-key="${esc(r.key)}" data-reset-restore="${off ? "1" : "0"}">${esc(
          off ? t("restoreResetBtn") : t("cancelResetBtn"),
        )}</button>
      </div>`;
    };
    // 取消后主面板回到"无重置"口径；如果本地明细仍明显高于官方，给一条提醒，不自动加回。
    const dismissedWarn = dismissedMismatch
      ? `<div class="kqc-reset-warn">${esc(t("resetDismissedWarn", { v: pct(localSum - officialTotal) }))}</div>`
      : "";
    const resetBlock = viewResets.length
      ? `<div class="kqc-resets">
          <div class="kqc-resets-title">${esc(t("resetLog"))}${activeResets.length ? ` · ${esc(t("resetCount", { n: activeResets.length }))}` : ""}</div>
          ${viewResets.map(resetRow).join("")}
          ${dismissedWarn}
        </div>`
      : "";

    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:18px;font-weight:600">${t("title")} <span style="font-size:12px;color:#999">v${GM_info.script.version}</span>
          <span class="kqc-pill">${esc(cycleLabel(curCycle, state.cycles, curCycle, sub))}</span></div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="kqc-btn2" id="kqc-export-json">${t("exportJson")}</button>
          <button class="kqc-btn2" id="kqc-export-csv">${t("exportCsv")}</button>
          <button class="kqc-btn2" id="kqc-refresh">${t("refreshBtn")}</button>
          <div class="kqc-close" id="kqc-close">&times;</div>
        </div>
      </div>
      ${canaryBanner}
      <div class="kqc-grid">
        <div class="kqc-card"><div class="kqc-label">${bigLabel}</div>
          <div class="kqc-value">${bigValue}${bigSuffix}</div>
          ${cumulativeLine}
          ${officialEndLine}
          ${featLines.join("")}
          ${showTotalMoney ? `<div class="kqc-label" style="margin-top:8px;border-top:1px solid #eee;padding-top:6px">合计 ≈ <b>¥${totalMoney.toFixed(2)}</b>${completeness != null ? ` · ${esc(t("completeness", { v: Math.round(completeness * 100) + "%" }))}` : ""}</div>` : completeness != null ? `<div class="kqc-label" style="margin-top:8px;border-top:1px solid #eee;padding-top:6px">${esc(t("completeness", { v: Math.round(completeness * 100) + "%" }))}</div>` : ""}
          ${localStatsLine}
        </div>
        <div class="kqc-card">
          <div class="kqc-label">${t("planLabel")}${planBadge}</div>
          <select id="kqc-plan" style="font-size:12px;max-width:220px;margin-bottom:6px">${planOptions}</select>
          <div class="kqc-label" style="line-height:1.5">${esc(planHint)}</div>
          <div class="kqc-label" style="margin-top:8px;border-top:1px solid #eee;padding-top:6px">${t("rateNote")}<span class="kqc-tip">!<span class="kqc-tipbox">${t("tipBody")}</span></span></div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px">
            <label>Code <input class="kqc-input" id="kqc-rate-code" type="number" step="0.1" min="0" placeholder="—" value="${rateCode() == null ? "" : rateCode()}"></label>
            <label>${LANG === "zh" ? "其他" : "Other"} <input class="kqc-input" id="kqc-rate-other" type="number" step="0.1" min="0" placeholder="—" value="${rateOther() == null ? "" : rateOther()}"></label>
            ${plan && plan.ref ? `<button class="kqc-btn2" id="kqc-fill">${t("fillRef")}${plan.measured ? "" : " *"}</button>` : ""}
          </div>
          <div class="kqc-label" style="margin-top:4px;color:#aaa">${esc(rateManual ? t("rateManualHint") : t("rateEmptyHint"))}</div>
        </div>
        <div class="kqc-card"><div class="kqc-label">${t("w5h")}</div>
          <div class="kqc-value">${pct(stats?.ratelimitCode5h?.ratio ?? 0)}</div>
          ${win5Line ? `<div class="kqc-label" style="margin-top:2px">${win5Line}</div>` : ""}
          <div class="kqc-label" style="margin-top:2px">${t("resetAt", { v: fmtLocal(h5?.resetTime || stats?.ratelimitCode5h?.resetTime).slice(5) })}</div></div>
        <div class="kqc-card"><div class="kqc-label">${t("w7d")}</div>
          <div class="kqc-value">${pct(stats?.ratelimitCode7d?.ratio ?? 0)}</div>
          ${win7Line ? `<div class="kqc-label" style="margin-top:2px">${win7Line}</div>` : ""}
          <div class="kqc-label" style="margin-top:2px">${t("resetAt", { v: fmtLocal(weekly?.resetTime || stats?.ratelimitCode7d?.resetTime).slice(5) })}</div></div>
      </div>
      ${resetBlock}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:12px;flex-wrap:wrap">
        <div style="font-weight:600;font-size:13px;white-space:nowrap">${t("ledger")}</div>
        ${cycleInfo}
        <div style="display:flex;gap:10px;align-items:center;margin-left:auto">
          <span class="kqc-est">${esc(t("cycle"))}</span>
          <select id="kqc-cycle" style="font-size:12px;max-width:300px">${cycleOptions}</select>
        </div>
      </div>
      <div style="max-height:320px;overflow-y:auto;border:1px solid #eee;border-radius:6px">
        <table class="kqc-table">
          <thead><tr><th>${t("thTime")}</th><th>${t("thFeature")}</th><th>${t("thTitle")}</th><th>${t("thUsed")}</th>${moneyOn ? `<th>${t("thEst")}</th>` : ""}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <div class="kqc-shown">${esc(t("shownRows", { a: shown.length, b: viewEntries.length }))}</div>
        ${viewEntries.length > shown.length ? `<button class="kqc-btn2" id="kqc-more">${t("loadMore")}</button>` : ""}
      </div>
      <div class="kqc-foot">${t("footer")}</div>`;
    root.style.display = "flex";

    root.querySelectorAll("[data-reset-key]").forEach((btn) => {
      btn.onclick = () =>
        toggleReset(btn.getAttribute("data-reset-key"), btn.getAttribute("data-reset-restore") === "1", stats, usages, sub);
    });

    document.getElementById("kqc-close").onclick = () => (root.style.display = "none");
    document.getElementById("kqc-refresh").onclick = () => run(true);
    document.getElementById("kqc-export-json").onclick = () => exportData("json");
    document.getElementById("kqc-export-csv").onclick = () => exportData("csv");
    const moreBtn = document.getElementById("kqc-more");
    if (moreBtn) moreBtn.onclick = () => { state.rows += 300; renderPanel(stats, usages, sub); };
    const cySel = document.getElementById("kqc-cycle");
    if (cySel) cySel.onchange = () => { state.viewCycle = cySel.value; state.rows = 300; renderPanel(stats, usages, sub); };
    const plSel = document.getElementById("kqc-plan");
    if (plSel)
      plSel.onchange = () => {
        if (plSel.value) pageWindow.localStorage.setItem(PLAN_KEY, plSel.value);
        else pageWindow.localStorage.removeItem(PLAN_KEY);
        // 没手动改过费率时，切换套餐就跟着换成该档参考值（新套餐没有参考值则清空）
        if (pageWindow.localStorage.getItem(RATE_MANUAL_KEY) !== "1") {
          const info = planInfo();
          if (info && info.ref) {
            pageWindow.localStorage.setItem(RATE_CODE_KEY, String(info.ref.c));
            pageWindow.localStorage.setItem(RATE_OTHER_KEY, String(info.ref.o));
          } else {
            pageWindow.localStorage.removeItem(RATE_CODE_KEY);
            pageWindow.localStorage.removeItem(RATE_OTHER_KEY);
          }
        }
        renderPanel(stats, usages, sub);
      };
    const fillBtn = document.getElementById("kqc-fill");
    if (fillBtn)
      fillBtn.onclick = () => {
        const info = planInfo();
        if (info && info.ref) {
          pageWindow.localStorage.setItem(RATE_CODE_KEY, String(info.ref.c));
          pageWindow.localStorage.setItem(RATE_OTHER_KEY, String(info.ref.o));
        }
        pageWindow.localStorage.removeItem(RATE_MANUAL_KEY); // 重新跟随套餐
        renderPanel(stats, usages, sub);
      };
    const rc = document.getElementById("kqc-rate-code");
    if (rc)
      rc.onchange = () => {
        const v = Number(rc.value);
        if (v > 0) pageWindow.localStorage.setItem(RATE_CODE_KEY, String(v));
        else pageWindow.localStorage.removeItem(RATE_CODE_KEY);
        pageWindow.localStorage.setItem(RATE_MANUAL_KEY, "1");
        renderPanel(stats, usages, sub);
      };
    const ro = document.getElementById("kqc-rate-other");
    if (ro)
      ro.onchange = () => {
        const v = Number(ro.value);
        if (v > 0) pageWindow.localStorage.setItem(RATE_OTHER_KEY, String(v));
        else pageWindow.localStorage.removeItem(RATE_OTHER_KEY);
        pageWindow.localStorage.setItem(RATE_MANUAL_KEY, "1");
        renderPanel(stats, usages, sub);
      };
  }

  // 取消/恢复只改 dismissed 标记，不删除快照、流水或事件本身。
  async function toggleReset(key, restore, stats, usages, sub) {
    const ev = state.resets.find((r) => r.key === key);
    if (!ev) return;
    if (!restore && !pageWindow.confirm(t("cancelResetConfirm"))) return;
    ev.dismissed = !restore;
    ev.dismissedAt = new Date().toISOString();
    try {
      await dbPut(S_RESETS, ev);
      await refreshCycleRecord(ev.cycle);
      const rec = await dbGet(S_CYCLES, ev.cycle);
      if (rec) state.cycles[ev.cycle] = rec;
    } catch (e) {
      debug("toggleReset err: " + e);
    }
    renderPanel(stats, usages, sub);
  }

  // ---------- export ----------
  function csvCell(v, guardFormula) {
    let s = String(v ?? "");
    // 文本列防电子表格公式注入（JSON 导出保留原始文本）
    if (guardFormula && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  async function exportData(kind = "json") {
    try {
      const entries = (await dbGetAll(S_ACTIONS)).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      const snaps = (await dbGetAll(S_SNAPSHOTS)).sort((a, b) => (a.ts < b.ts ? 1 : -1));
      const cycles = await dbGetAll(S_CYCLES);
      const resets = await dbGetAll(S_RESETS);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      if (kind === "json") {
        const json = {
          exportedAt: new Date().toISOString(),
          scriptVersion: GM_info.script.version,
          rates: { codePerPct: rateCode(), otherPerPct: rateOther() },
        plan: pageWindow.localStorage.getItem(PLAN_KEY) || null,
          cycles,
          resets,
          entries,
          snapshots: snaps,
        };
        download(`kimi-quota-${stamp}.json`, JSON.stringify(json, null, 1), "application/json");
      }

      const head = "id,timestamp_utc,timestamp_local,feature,title,ratio_pct,rate_cny_per_pct,est_cny,status\n";
      const body = entries
        .map((e) =>
          [
            e.id,
            e.timestamp,
            fmtLocal(e.timestamp, true),
            e.feature,
            e.title,
            (e.ratio * 100).toFixed(4),
            rateFor(e.feature),
            (e.ratio * 100 * rateFor(e.feature)).toFixed(2),
            e.status || "DONE",
          ].map(csvCell).join(","),
        )
        .join("\n");
      if (kind === "csv") download(`kimi-quota-${stamp}.csv`, head + body, "text/csv");
      alert(t("exported", { n: entries.length, m: snaps.length, r: resets.length }));
    } catch (e) {
      alert(t("err") + ": " + e.message);
    }
  }

  function download(name, content, mime) {
    // Tampermonkey 沙箱里 Blob/URL 可能来自沙箱 realm，跨 realm 传给页面会报 "not a Blob"；
    // 统一用 pageWindow 构造，保证与页面下载逻辑同一 realm。
    const BlobCtor = pageWindow.Blob || Blob;
    const URLCtor = pageWindow.URL || URL;
    const blob = new BlobCtor([content], { type: mime + ";charset=utf-8" });
    const url = URLCtor.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URLCtor.revokeObjectURL(url);
      a.remove();
    }, 1000);
  }

  // 快照不能只在打开面板时写：用户正常用 Kimi 但不开面板时，
  // 官方百分比会随着周期重置永久丢失。这里独立轮询，4 分钟一次。
  let lastStatsPoll = 0;
  async function pollStats(force = false) {
    const now = Date.now();
    if (!force && now - lastStatsPoll < 4 * 60 * 1000) return;
    lastStatsPoll = now;
    try {
      const [stats, sub] = await Promise.all([apiPost(API.stats), apiPost(API.sub).catch(() => null)]);
      await recordSnapshot(stats, sub);
    } catch (e) {
      debug("pollStats err: " + e);
    }
  }

  // 调试/回归入口：在页面控制台可手动重扫历史快照
  pageWindow.__KQC.bootstrapGrants = bootstrapGrantsFromSnapshots;
  pageWindow.__KQC.syncGrants = syncGrantEventsFromSnapshots;

  // ---------- main ----------
  async function run(full = true) {
    const btn = document.getElementById("kqc-btn");
    if (btn) btn.innerText = t("loading");
    try {
      await captureLedger(true);
      const [stats, entries, sub] = await Promise.all([
        apiPost(API.stats),
        dbGetAll(S_ACTIONS).catch(() => []),
        apiPost(API.sub).catch(() => null),
      ]);
      let usages = null;
      try {
        usages = await apiPost(API.usages, { scope: ["FEATURE_CODING"] });
      } catch (e) {
        debug("GetUsages err: " + e);
      }
      await recordSnapshot(stats, sub).catch(() => {});
      const [cyclesArr, snapsAll] = await Promise.all([
        dbGetAll(S_CYCLES).catch(() => []),
        dbGetAll(S_SNAPSHOTS).catch(() => []),
      ]);
      setCycleStarts([
        ...(sub && sub.subscription ? [sub.subscription.currentStartTime] : []),
        ...cyclesArr.map((c) => c.cycleStart),
        ...snapsAll.map((x) => x.cycleStart),
      ]);
      const bal = stats && stats.subscriptionBalance;
      const usedRatio = bal ? Number(bal.amountUsedRatio) || 0 : null;
      const codeOfficial = bal && bal.kimiCodeUsedRatio != null ? Number(bal.kimiCodeUsedRatio) : null;
      const curCycle = cycleOf(
        (sub && sub.subscription && sub.subscription.currentStartTime) || new Date().toISOString(),
      );
      const cycleEndIso =
        (sub && sub.subscription && (sub.subscription.nextBillingTime || sub.subscription.currentEndTime)) || null;
      // 先回推历史快照里的跳水（升级用户的最新快照可能已经是 0%），再做流水差额校正。
      if (curCycle) {
        await syncGrantEventsFromSnapshots(snapsAll, curCycle, cycleEndIso).catch((e) => debug("sync err: " + e));
      }
      // 快照没抓到（页面当时没开）时，用本地流水合计与官方读数的差额补一条低置信度事件。
      if (curCycle) await reconcileGrants(curCycle, usedRatio, codeOfficial, entries).catch((e) => debug("reconcile err: " + e));
      const [resetsArr, cyclesFresh] = await Promise.all([
        dbGetAll(S_RESETS).catch(() => []),
        dbGetAll(S_CYCLES).catch(() => cyclesArr),
      ]);
      state.entries = entries;
      state.cycles = {};
      for (const c of cyclesFresh) state.cycles[c.cycle] = c;
      state.resets = resetsArr;
      state.viewCycle = null;
      state.rows = 300;
      renderPanel(stats, usages, sub);
    } catch (e) {
      if (full) alert(t("err") + ": " + e.message);
      debug("run err: " + e);
    } finally {
      if (btn) btn.innerText = t("btn");
    }
  }

  const boot = () => {
    if (document.getElementById("kqc-btn")) return;
    migrateLegacyRates();
    const btn = document.createElement("button");
    btn.id = "kqc-btn";
    btn.innerText = t("btn");
    btn.onclick = () => run(true);
    document.body.appendChild(btn);
    const root = document.createElement("div");
    root.id = "kqc-root";
    document.body.appendChild(root);
    // 抓取时机：页面打开立即（含分页回填）、切回页面立即、前台每 60 秒
    captureLedger(true);
    pollStats(true);
    // 页面重新打开时，历史快照里可能已经有"重置前 → 重置后"的跳水；
    // 等首轮快照写完后回推一次，不依赖用户点开面板。
    setTimeout(() => bootstrapGrantsFromSnapshots(), 3000);
    setInterval(() => {
      captureLedger();
      pollStats();
    }, 60 * 1000);
    pageWindow.addEventListener("focus", () => {
      captureLedger();
      pollStats();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        captureLedger();
        pollStats();
      } else captureLedger(); // 离开前也补一次，减少长时间离开造成的空档
    });
    pageWindow.addEventListener("pagehide", () => captureLedger());
  };

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
