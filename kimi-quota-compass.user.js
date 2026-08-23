// ==UserScript==
// @name         Kimi Quota Compass
// @name:zh-CN   Kimi 用量罗盘
// @namespace    https://github.com/JasonWenTheFox
// @version      0.7.0
// @description  Kimi membership quota panel: monthly pool, Kimi Code 5h/7d windows, per-action ledger with calibrated PAYG-equivalent estimates
// @description:zh-CN  Kimi 会员用量面板：月度额度池、Kimi Code 5小时/7天窗口、逐条额度流水（含可校准的 PAYG 等价估算）
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
    poolValue: { zh: "月池 PAYG 等价值", en: "Monthly pool PAYG-equivalent" },
    poolUsed: { zh: "本月已用约 {v}（估算）", en: "used this month ~{v} (estimate)" },
    calibDefault: { zh: "参考默认值（未校准）", en: "Reference default (not calibrated)" },
    calibUser: { zh: "用户校准值", en: "User-calibrated" },
    caliber: { zh: "校准口径：K3-256K", en: "Calibrated for: K3-256K" },
    k3oneM: { zh: "K3 1M 等价 ≈ {v}（官方称约 2× 额度消耗）", en: "K3 1M equivalent ≈ {v} (official: ~2× quota use)" },
    w5h: { zh: "Code 5 小时窗口", en: "Code 5h window" },
    w7d: { zh: "Code 7 天窗口", en: "Code 7d window" },
    quotaUnits: { zh: "{u} / {l}（内部额度单位）· 剩余 {r}", en: "{u} / {l} (internal quota units) · {r} left" },
    resetAt: { zh: "重置时间：{v}（本地时区）", en: "Resets: {v} (local)" },
    ofWhich: { zh: "其中", en: "of which" },
    estShort: { zh: "估算 {v}", en: "est. {v}" },
    ledger: { zh: "额度流水（本地累计，官方数据）", en: "Balance actions (local accumulation, official data)" },
    thTime: { zh: "时间（本地时区）", en: "Time (local)" },
    thFeature: { zh: "功能", en: "Feature" },
    thTitle: { zh: "条目", en: "Title" },
    thUsed: { zh: "消耗", en: "Used" },
    thEst: { zh: "估算金额", en: "Est. amount" },
    estNote: { zh: "金额均为按校准系数换算的估算值，非官方账单", en: "Amounts are estimates from the calibration constant, not official billing" },
    canary: {
      zh: "检测到 Kimi 网页响应开始返回 Token Usage，请检查插件更新",
      en: "Token usage detected in Kimi web responses - check for script updates",
    },
    footer: {
      zh: "额度流水来自 Kimi 服务器，接口单次最多返回约 20 条；插件在打开 Kimi 页面时自动抓取、页面切回时立即抓取、前台期间每 5 分钟轮询，按记录 id 去重后累积保存在本浏览器 IndexedDB（不跨设备同步，长时间不打开 Kimi 页面仍可能漏抓）。分类中 Code 使用官方比例，其余为本地累计；\"插件未捕获\"为官方月度总量减去官方 Code 与本地非 Code 之和（安装前历史或漏抓）。5h/7d 窗口的 used/limit 为 Kimi 内部额度单位，非 Token。月池 PAYG 等价值与币种存于 localStorage（kqc_* 键）。所有金额均为估算，非官方账单。",
      en: "Balance actions come from Kimi's server (about 20 entries per call at most). This script captures on page load, on tab refocus, and every 5 minutes while visible, deduplicating by record id into this browser's IndexedDB (not synced across devices; gaps possible if no Kimi page is open for long). Code ratio is official; other features are local sums; \"Not captured\" = official monthly total - official Code - local non-Code (pre-install history or missed captures). 5h/7d used/limit are Kimi internal quota units, not tokens. Pool value and currency are stored in localStorage (kqc_* keys). All amounts are estimates, not official billing.",
    },
    loading: { zh: "加载中…", en: "loading..." },
    err: { zh: "KQC 错误", en: "KQC error" },
    noLogin: { zh: "未找到 access_token，请先登录 Kimi", en: "access_token not found (not logged in?)" },
    tipBody: {
      zh: `<b>这是什么？</b>官方接口只提供百分比。"月池 PAYG 等价值"是把一次<b>已知成本的请求</b>与其额度扣减比例对照反推出的<b>估算值</b>，不是官方余额：<br><code>等价值 = 请求成本 ÷ 消耗比例</code><br>例：成本 ¥3.72 的请求扣了 0.24% → 等价值 ≈ ¥1550。<br><br><b>K3 公开 API 价目（按每 100 万 token 计价，与上下文长度版本无关）</b>：缓存命中 ¥2 / 缓存未命中 ¥20 / 输出 ¥100（$0.3 / $3 / $15）。k3-256k 没有单独的公开价目；会员额度池中，完整版 k3 的消耗官方约为 k3-256k 的 2 倍。缓存命中约节省 10 倍。<br><br>不同模型/功能倍率不同，建议用与你主要用途同类的请求校准。官方接口只返回百分比，一切绝对金额都是估算。`,
      en: `<b>What is this?</b> Official APIs only expose percentages. The "PAYG-equivalent value" is an <b>estimate</b> reverse-engineered by matching one request of known cost against its quota drain ratio - not an official balance:<br><code>equivalent = request cost ÷ drain ratio</code><br>e.g. cost $0.526, drained 0.24% → ≈ $219.<br><br><b>Public K3 API pricing (per 1M tokens billed, regardless of context-length variant)</b>: cache hit $0.3 / cache miss $3 / output $15 (¥2 / ¥20 / ¥100). k3-256k has no separate public price; inside the membership pool, full k3 officially consumes about 2x the quota of k3-256k. Cache hits save ~10x.<br><br>Rates differ per model/feature; calibrate with a request similar to your main workload. All absolute amounts are estimates.`,
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
    return res.json();
  }

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

  // ---------- local ledger store (IndexedDB, dedup by id) ----------
  const idb = pageWindow.indexedDB;
  const DB_NAME = "kqc_ledger", STORE = "actions";
  const dbOpen = () =>
    new Promise((res, rej) => {
      const r = idb.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  async function dbPutAll(entries) {
    if (!entries.length) return;
    const db = await dbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      const st = tx.objectStore(STORE);
      for (const e of entries) st.put(e);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function dbGetAll() {
    const db = await dbOpen();
    return new Promise((res, rej) => {
      const rq = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => rej(rq.error);
    });
  }

  const pct = (r) => ((r ?? 0) * 100).toFixed(2) + "%";
  const stripFeature = (f) => String(f || "").replace(/^FEATURE_/, "");
  const normAction = (a) => ({
    id: a.id,
    feature: stripFeature(a.feature),
    title: a.title || "",
    timestamp: a.timestamp,
    // 观测样本中每个 action 恰好一个 item；多 item 的求和语义未经官方确认，
    // 故稳健地取首个 item，缺失时记 0（如未来出现多 item 需重新评估）。
    ratio: a.items && a.items[0] ? Number(a.items[0].amountRatio) || 0 : 0,
  });

  // 抓取流水（带最小间隔节流，避免多事件短时间内重复请求）
  let lastCapture = 0;
  const CAPTURE_MIN_MS = 45 * 1000;
  async function captureLedger(force = false) {
    const now = Date.now();
    if (!force && now - lastCapture < CAPTURE_MIN_MS) return false;
    lastCapture = now;
    try {
      const resp = await apiPost(
        "/apiv2/kimi.gateway.membership.v2.MembershipService/ListBalanceActions",
        { pageSize: 200 },
      );
      const acts = resp.actions || [];
      await dbPutAll(acts.map(normAction));
      debug("ledger captured: " + acts.length);
      return true;
    } catch (e) {
      debug("captureLedger err: " + e);
      return false;
    }
  }

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

  // ---------- panel ----------
  GM_addStyle(`
    #kqc-btn { position: fixed; bottom: 20px; right: 20px; z-index: 10000; padding: 10px 20px;
      background: #7c5cff; color: #fff; border: none; border-radius: 8px; cursor: pointer;
      font-weight: 600; font-family: -apple-system, system-ui, sans-serif; }
    #kqc-root { position: fixed; top: 5%; left: 50%; transform: translateX(-50%); width: 780px;
      max-height: 90vh; overflow-y: auto; background: #fff; border-radius: 12px;
      box-shadow: 0 10px 50px rgba(0,0,0,.3); z-index: 10001; padding: 24px; display: none;
      flex-direction: column; border: 1px solid #e5e5e5; color: #333;
      font-family: -apple-system, system-ui, sans-serif; }
    .kqc-card { background:#f9f9f9; border:1px solid #eee; border-radius:8px; padding:12px; }
    .kqc-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:18px; }
    .kqc-label { font-size:12px; color:#666; margin-bottom:4px; }
    .kqc-value { font-size:15px; font-weight:bold; color:#7c5cff; }
    table.kqc-table { width:100%; border-collapse:collapse; font-size:12px; }
    .kqc-table th { text-align:left; padding:6px 8px; border-bottom:1px solid #eee; color:#666; background:#f5f5f5; }
    .kqc-table td { padding:6px 8px; border-bottom:1px solid #f0f0f0; font-family:monospace; }
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
  `);

  const POOL_CNY_KEY = "kqc_pool_value_cny";
  const POOL_USD_KEY = "kqc_pool_value_usd";
  const CUR_KEY = "kqc_currency";
  const poolKey = (cur) => (cur === "USD" ? POOL_USD_KEY : POOL_CNY_KEY);
  const getPoolValue = (cur) =>
    Number(pageWindow.localStorage.getItem(poolKey(cur))) || (cur === "USD" ? 225 : 1600);
  const poolIsUserSet = (cur) => pageWindow.localStorage.getItem(poolKey(cur)) != null;
  const getCur = () => (pageWindow.localStorage.getItem(CUR_KEY) === "USD" ? "USD" : "CNY");

  function renderPanel(stats, usages, entries, cycleStart) {
    const root = document.getElementById("kqc-root");
    const bal = stats && stats.subscriptionBalance;
    const coding = usages && usages.usages && usages.usages[0];
    const weekly = coding && coding.detail;
    const h5 = coding && coding.limits && coding.limits[0] && coding.limits[0].detail;
    const total = usages && usages.totalQuota;
    const n = (x) => Number(x || 0);
    const cur = getCur();
    const poolValue = getPoolValue(cur);
    const userSet = poolIsUserSet(cur);
    const sym = cur === "USD" ? "$" : "¥";
    const fmtMoney = (v) => sym + Number(v).toFixed(2);
    const usedEst = bal ? fmtMoney(bal.amountUsedRatio * poolValue) : "-";
    const r5 = stats?.ratelimitCode5h?.ratio ?? 0;
    const r7 = stats?.ratelimitCode7d?.ratio ?? 0;

    // 月度分类：官方 Code 比例 + 本地非 Code 累计（避免 Code 双重计入）
    const FEAT_NAMES = { CODING: "Code", CHAT: "Chat", AGENT: "Agent", SWARM: "Swarm" };
    const featName = (f) => FEAT_NAMES[f] || f;
    const cycEntries = cycleStart ? entries.filter((e) => e.timestamp >= cycleStart) : entries.slice();
    const codeOfficial = bal && bal.kimiCodeUsedRatio != null ? bal.kimiCodeUsedRatio : null;
    let codeLocal = 0;
    const featSums = {};
    for (const e of cycEntries) {
      if (String(e.feature).toUpperCase() === "CODING") {
        codeLocal += e.ratio || 0;
        continue;
      }
      const key = featName(e.feature);
      featSums[key] = (featSums[key] || 0) + (e.ratio || 0);
    }
    const featOrder = ["Chat", "Agent", "Swarm"];
    const featKeys = [
      ...featOrder.filter((k) => featSums[k] != null),
      ...Object.keys(featSums).filter((k) => !featOrder.includes(k)),
    ];
    const localNonCodeSum = featKeys.reduce((acc, k) => acc + featSums[k], 0);
    const codeVal = codeOfficial != null ? codeOfficial : codeLocal;
    const codeTag = codeOfficial != null ? t("official") : t("local");
    const featLines = [];
    featLines.push(
      `<div class="kqc-label" style="margin-top:2px">${t("ofWhich")} Code <b>${pct(codeVal)}</b>（${esc(codeTag)}）${LANG === "zh" ? "，" : ", "}${t("estShort", { v: fmtMoney(codeVal * poolValue) })}</div>`,
    );
    for (const k of featKeys)
      featLines.push(
        `<div class="kqc-label" style="margin-top:2px">${esc(k)} <b>${pct(featSums[k])}</b>${LANG === "zh" ? "，" : ", "}${t("estShort", { v: fmtMoney(featSums[k] * poolValue) })}</div>`,
      );
    if (bal && bal.amountUsedRatio != null) {
      const notCaptured = bal.amountUsedRatio - codeVal - localNonCodeSum;
      if (notCaptured > 1e-9)
        featLines.push(
          `<div class="kqc-label" style="margin-top:2px">${esc(t("notCaptured"))} <b>${pct(notCaptured)}</b>${LANG === "zh" ? "，" : ", "}${t("estShort", { v: fmtMoney(notCaptured * poolValue) })}</div>`,
        );
    }
    const earliest = entries.length
      ? entries.reduce((m, e) => (e.timestamp < m ? e.timestamp : m), entries[0].timestamp)
      : null;
    const localStatsLine = entries.length
      ? `<div class="kqc-label" style="margin-top:6px">${t("localStats", { n: entries.length, d: fmtLocal(earliest) })}</div>`
      : "";
    const featLinesHtml = featLines.join("");

    const sorted = cycEntries.slice().sort((x, y) => (x.timestamp < y.timestamp ? 1 : -1));
    const rows = sorted
      .slice(0, 300)
      .map(
        (a) => `<tr>
        <td>${fmtLocal(a.timestamp, true)}</td>
        <td>${esc(featName(a.feature))}</td>
        <td style="font-family:inherit">${esc(String(a.title || "").slice(0, 44))}</td>
        <td>${pct(a.ratio)}</td>
        <td>${fmtMoney(a.ratio * poolValue)}</td>
      </tr>`,
      )
      .join("");

    const canaryBanner = pageWindow.__KQC.streamUsageDetected
      ? `<div class="kqc-canary">⚠ ${esc(t("canary"))}</div>`
      : "";
    const win5Line = h5 ? t("quotaUnits", { u: n(h5.used), l: n(h5.limit), r: n(h5.remaining) }) : "";
    const win7Line = weekly ? t("quotaUnits", { u: n(weekly.used), l: n(weekly.limit), r: n(weekly.remaining) }) : "";

    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:18px;font-weight:600">${t("title")} v${GM_info.script.version}</div>
        <div class="kqc-close" id="kqc-close">&times;</div>
      </div>
      ${canaryBanner}
      <div class="kqc-grid">
        <div class="kqc-card"><div class="kqc-label">${t("monthlyUsed")}</div>
          <div class="kqc-value">${bal ? pct(bal.amountUsedRatio) : "-"}${total ? ' <span style="font-weight:400;font-size:12px;color:#666">(' + n(total.used) + "/" + n(total.limit) + ")</span>" : ""}</div>
          ${featLinesHtml}
          ${localStatsLine}
        </div>
        <div class="kqc-card"><div class="kqc-label">${t("poolValue")}<span class="kqc-tip">!<span class="kqc-tipbox">${t("tipBody")}</span></span></div>
          <div class="kqc-value" style="font-size:13px;font-weight:400">
            <select id="kqc-cur" style="font-size:12px">
              <option value="CNY" ${cur === "CNY" ? "selected" : ""}>CNY ¥</option>
              <option value="USD" ${cur === "USD" ? "selected" : ""}>USD $</option>
            </select>
            <input id="kqc-poolval" type="number" step="10" value="${poolValue}" style="width:76px;font-size:13px">
          </div>
          <div class="kqc-label" style="margin-top:2px">${userSet ? esc(t("calibUser")) : esc(t("calibDefault"))} · ${esc(t("caliber"))}</div>
          <div class="kqc-label" style="margin-top:2px">${t("poolUsed", { v: usedEst })}</div>
          <div class="kqc-label" style="margin-top:2px">${t("k3oneM", { v: fmtMoney(poolValue / 2) })}</div></div>
        <div class="kqc-card"><div class="kqc-label">${t("w5h")}</div>
          <div class="kqc-value">${pct(r5)}</div>
          ${win5Line ? `<div class="kqc-label" style="margin-top:2px">${win5Line}</div>` : ""}
          <div class="kqc-label" style="margin-top:2px">${t("resetAt", { v: fmtLocal(h5?.resetTime || stats?.ratelimitCode5h?.resetTime).slice(5) })}</div></div>
        <div class="kqc-card"><div class="kqc-label">${t("w7d")}</div>
          <div class="kqc-value">${pct(r7)}</div>
          ${win7Line ? `<div class="kqc-label" style="margin-top:2px">${win7Line}</div>` : ""}
          <div class="kqc-label" style="margin-top:2px">${t("resetAt", { v: fmtLocal(weekly?.resetTime || stats?.ratelimitCode7d?.resetTime).slice(5) })}</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
        <div style="font-weight:600;font-size:13px">${t("ledger")}</div>
        <div class="kqc-est">${t("estNote")}</div>
      </div>
      <div style="max-height:280px;overflow-y:auto;border:1px solid #eee;border-radius:6px">
        <table class="kqc-table">
          <thead><tr><th>${t("thTime")}</th><th>${t("thFeature")}</th><th>${t("thTitle")}</th><th>${t("thUsed")}</th><th>${t("thEst")}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="kqc-foot">${t("footer")}</div>`;
    root.style.display = "flex";
    document.getElementById("kqc-close").onclick = () => (root.style.display = "none");
    const pv = document.getElementById("kqc-poolval");
    if (pv)
      pv.onchange = () => {
        const v = Number(pv.value);
        if (v > 0) {
          pageWindow.localStorage.setItem(poolKey(cur), String(v));
          run();
        }
      };
    const cs = document.getElementById("kqc-cur");
    if (cs)
      cs.onchange = () => {
        pageWindow.localStorage.setItem(CUR_KEY, cs.value);
        run();
      };
  }

  async function run() {
    const btn = document.getElementById("kqc-btn");
    btn.innerText = t("loading");
    try {
      await captureLedger(true);
      const [stats, entriesRaw, sub] = await Promise.all([
        apiPost("/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats"),
        dbGetAll().catch(() => []),
        apiPost("/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscription").catch(() => null),
      ]);
      let usages = null;
      try {
        usages = await apiPost("/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages", {
          scope: ["FEATURE_CODING"],
        });
      } catch (e) {
        debug("GetUsages err: " + e);
      }
      const cycleStart = sub?.subscription?.currentStartTime || null;
      renderPanel(stats, usages, entriesRaw, cycleStart);
    } catch (e) {
      alert(t("err") + ": " + e.message);
    } finally {
      btn.innerText = t("btn");
    }
  }

  const boot = () => {
    if (document.getElementById("kqc-btn")) return;
    const btn = document.createElement("button");
    btn.id = "kqc-btn";
    btn.innerText = t("btn");
    btn.onclick = run;
    document.body.appendChild(btn);
    const root = document.createElement("div");
    root.id = "kqc-root";
    document.body.appendChild(root);
    // 抓取时机：页面打开立即、切回页面立即（focus / visibilitychange）、前台每 5 分钟
    captureLedger(true);
    setInterval(() => captureLedger(), 5 * 60 * 1000);
    pageWindow.addEventListener("focus", () => captureLedger());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") captureLedger();
    });
  };

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
