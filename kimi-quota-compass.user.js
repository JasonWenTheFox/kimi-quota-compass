// ==UserScript==
// @name         Kimi Quota Compass
// @name:zh-CN   Kimi 用量罗盘
// @namespace    https://github.com/JasonWenTheFox
// @version      0.5.4
// @description  Kimi membership quota panel: monthly pool, Kimi Code 5h/7d windows, per-action ledger with calibrated value estimates
// @description:zh-CN  Kimi 会员用量面板：月度额度池、Kimi Code 5小时/7天窗口、逐条额度流水（含可校准的金额估算）
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
    ofWhichCode: { zh: "其中 Kimi Code", en: "of which Kimi Code" },
    poolValue: { zh: "月度额度池总值", en: "Monthly pool total value" },
    poolUsed: { zh: "本月已用约 {v}（估算）", en: "used this month ~{v} (estimate)" },
    w5h: { zh: "Code 5 小时窗口", en: "Code 5h window" },
    w7d: { zh: "Code 7 天窗口", en: "Code 7d window" },
    precise: { zh: "精确 {v}", en: "precise {v}" },
    resetAt: { zh: "重置时间：{v}（本地时区）", en: "Resets: {v} (local)" },
    estUsed: { zh: "估算已用 {v}", en: "est. used {v}" },
    ofWhich: { zh: "其中", en: "of which" },
    estShort: { zh: "估算 {v}", en: "est. {v}" },
    ledger: { zh: "额度流水（官方服务端数据）", en: "Balance actions (official server data)" },
    thTime: { zh: "时间（本地时区）", en: "Time (local)" },
    thFeature: { zh: "功能", en: "Feature" },
    thTitle: { zh: "条目", en: "Title" },
    thUsed: { zh: "消耗", en: "Used" },
    thEst: { zh: "估算金额", en: "Est. amount" },
    estNote: { zh: "以下金额均为估算值，非官方账单", en: "Amounts are estimates, not official billing" },
    footer: {
      zh: "额度流水来自 Kimi 服务器（账号级）：换设备、卸载重装插件均不受影响，安装插件之前的历史同样会显示。接口可能仅返回近期流水，因此分类占比（Code 除外）为近期汇总，\"其他（历史）\"为月度总量与已列分类之差。仅\"月度额度池总值\"与币种设置保存在本地浏览器（localStorage 的 kqc_* 键，清除即重置）。所有金额均为按校准系数换算的估算值，非官方账单。",
      en: "Balance actions come from Kimi's server (account level): unaffected by device or reinstall; history before installing this script is included. The API may return only recent actions, so per-feature ratios (except Code) are recent sums, and \"Other (history)\" is the difference between the official monthly total and the listed features. Only the monthly pool total value and currency are stored locally (localStorage kqc_* keys). All amounts are estimates, not official billing.",
    },
    loading: { zh: "加载中…", en: "loading..." },
    err: { zh: "KQC 错误", en: "KQC error" },
    noLogin: { zh: "未找到 access_token，请先登录 Kimi", en: "access_token not found (not logged in?)" },
    tipBody: {
      zh: `<b>校准方法</b>：找一次已知成本的请求（你本地统计工具里任意一条，能看到输入/输出/缓存 token），用下方价目算出它的等效成本，再在本面板流水中找到该请求对应的消耗百分比，然后：<br><code>池子总值 = 请求成本 ÷ 消耗比例</code><br>例：成本 ¥3.72 的请求扣了 0.24% → 总值 = 3.72 / 0.0024 ≈ ¥1550。<br><br><b>K3 参考价目（每百万 token）</b>：输入 ¥20 / 缓存命中 ¥2 / 输出 ¥100（$3 / $0.3 / $15）。<br>缓存命中约节省 10 倍。不同模型/功能的池子倍率可能不同，建议用与你主要用途同类的请求来校准。官方接口只返回百分比，一切绝对金额都是估算。`,
      en: `<b>Calibration</b>: take one request with known cost (any entry in your local stats tool showing input/output/cache tokens), compute its cost with the price table below, find its drain percentage in the ledger, then:<br><code>pool total = request cost ÷ drain ratio</code><br>e.g. cost $0.526, drained 0.24% → total = 0.526 / 0.0024 ≈ $219.<br><br><b>K3 reference pricing (per 1M tokens)</b>: input $3 / cache-read $0.3 / output $15 (¥20 / ¥2 / ¥100).<br>Cache reads save ~10x. Pool drain rates may differ per model/feature; calibrate with a request similar to your main workload. The official API only exposes percentages; all absolute amounts are estimates.`,
    },
  };
  const t = (k, vars) => {
    let s = (T[k] && (T[k][LANG] || T[k].en)) || k;
    if (vars) for (const v of Object.values(vars)) s = s.replace("{v}", v);
    return s;
  };

  // ---------- stream observers (kept for future-proofing; web chat streams verified to carry no usage) ----------
  pageWindow.__KQC = { records: [], log: [], counts: { asyncIter: 0, getReader: 0, arrayBuffer: 0, text: 0, json: 0 } };
  const debug = (msg) => {
    pageWindow.__KQC.log.push(`${new Date().toISOString()} ${msg}`);
    if (pageWindow.__KQC.log.length > 200) pageWindow.__KQC.log.shift();
  };

  const num = (s) => (s == null ? 0 : Number(s) || 0);
  const extractUsage = (usageJson) => {
    const pick = (names) => {
      for (const n of names) {
        const m = usageJson.match(new RegExp(`"${n}"\\s*:\\s*"?([0-9]+(?:\\.[0-9]+)?)"?`));
        if (m) return m[1];
      }
      return null;
    };
    const prompt = pick(["prompt_tokens", "promptTokens", "input_tokens", "inputTokens"]);
    const completion = pick(["completion_tokens", "completionTokens", "output_tokens", "outputTokens"]);
    const cached = pick(["cached_tokens", "cachedTokens", "cache_read_tokens"]);
    const total = pick(["total_tokens", "totalTokens"]);
    if (prompt == null && completion == null && total == null) return null;
    return { prompt: num(prompt), completion: num(completion), cached: num(cached), total: num(total) };
  };
  const processStreamText = (text) => {
    const usageRe = /"usage"\s*:\s*\{[^{}]*\}/g;
    let m;
    while ((m = usageRe.exec(text))) {
      const u = extractUsage(m[0]);
      if (!u) continue;
      const modelM = text.match(/"model"\s*:\s*"([^"]+)"/);
      try {
        const recs = JSON.parse(pageWindow.localStorage.getItem("kqc_usage_records_v1") || "[]");
        recs.push({ t: Date.now(), model: modelM ? modelM[1] : "", ...u });
        pageWindow.localStorage.setItem("kqc_usage_records_v1", JSON.stringify(recs.slice(-5000)));
      } catch {}
      pageWindow.__KQC.records.push({ ...u });
    }
  };

  try {
    const RSProto = pageWindow.ReadableStream.prototype;
    const streamNotes = new WeakMap();
    const noteChunk = (stream, value) => {
      if (!value || !value.length) return;
      let n = streamNotes.get(stream);
      if (!n) {
        n = { dec: new TextDecoder(), acc: "", bytes: 0 };
        streamNotes.set(stream, n);
      }
      n.bytes += value.length;
      n.acc += n.dec.decode(value, { stream: true });
      if (n.acc.length > 300000) n.acc = n.acc.slice(-150000);
    };
    const finalizeStream = (stream) => {
      const n = streamNotes.get(stream);
      if (!n) return;
      streamNotes.delete(stream);
      if (n.acc.indexOf("usage") >= 0) processStreamText(n.acc);
    };
    const hookIteratorSource = (orig) =>
      function (...args) {
        pageWindow.__KQC.counts.asyncIter++;
        const it = orig.apply(this, args);
        const stream = this;
        const origNext = it.next.bind(it);
        it.next = async function () {
          const r = await origNext();
          if (r && r.done) finalizeStream(stream);
          else if (r && r.value) noteChunk(stream, r.value);
          return r;
        };
        return it;
      };
    if (typeof RSProto.values === "function") RSProto.values = hookIteratorSource(RSProto.values);
    if (RSProto[Symbol.asyncIterator] && RSProto[Symbol.asyncIterator] !== RSProto.values)
      RSProto[Symbol.asyncIterator] = hookIteratorSource(RSProto[Symbol.asyncIterator]);
    const origGetReader = RSProto.getReader;
    RSProto.getReader = function (...args) {
      pageWindow.__KQC.counts.getReader++;
      const reader = origGetReader.apply(this, args);
      const stream = this;
      const origRead = reader.read.bind(reader);
      reader.read = async function (...a) {
        const r = await origRead(...a);
        if (r && r.done) finalizeStream(stream);
        else if (r && r.value) noteChunk(stream, r.value);
        return r;
      };
      return reader;
    };
    const RespProto = pageWindow.Response.prototype;
    const origAB = RespProto.arrayBuffer;
    RespProto.arrayBuffer = function (...args) {
      pageWindow.__KQC.counts.arrayBuffer++;
      return origAB.apply(this, args).then((buf) => {
        try {
          if (buf && buf.byteLength > 0) {
            const txt = new TextDecoder().decode(new Uint8Array(buf));
            if (txt.indexOf("usage") >= 0) processStreamText(txt);
          }
        } catch {}
        return buf;
      });
    };
    const origText = RespProto.text;
    RespProto.text = function (...args) {
      pageWindow.__KQC.counts.text++;
      return origText.apply(this, args).then((txt) => {
        try {
          if (txt && txt.indexOf("usage") >= 0) processStreamText(txt);
        } catch {}
        return txt;
      });
    };
    const origJson = RespProto.json;
    RespProto.json = function (...args) {
      pageWindow.__KQC.counts.json++;
      return origJson.apply(this, args);
    };
    debug("observer hooks installed (page realm)");
  } catch (e) {
    debug("hook err: " + e);
  }

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

  const pct = (r) => ((r ?? 0) * 100).toFixed(2) + "%";
  // API 返回的是 UTC 时间，展示时转换为用户本地时区
  const fmtLocal = (iso, withSec = false) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d)) return "-";
    const p = (x) => String(x).padStart(2, "0");
    const base = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    return withSec ? base + ":" + p(d.getSeconds()) : base;
  };
  const stripFeature = (f) => String(f || "").replace(/^FEATURE_/, "");

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
    .kqc-tipbox { display:none; position:absolute; left:0; top:22px; z-index:10002; width:420px;
      background:#333; color:#fff; font-size:12px; font-weight:normal; line-height:1.7;
      padding:12px 14px; border-radius:8px; box-shadow:0 6px 24px rgba(0,0,0,.4); }
    .kqc-tip:hover .kqc-tipbox { display:block; }
    .kqc-tipbox code { background:#555; padding:1px 5px; border-radius:4px; }
    .kqc-est { font-size:11px; color:#999; }
    .kqc-foot { font-size:11px; color:#999; margin-top:10px; line-height:1.6; }
  `);

  const POOL_CNY_KEY = "kqc_pool_value_cny";
  const POOL_USD_KEY = "kqc_pool_value_usd";
  const CUR_KEY = "kqc_currency";
  const getPoolValue = (cur) =>
    Number(pageWindow.localStorage.getItem(cur === "USD" ? POOL_USD_KEY : POOL_CNY_KEY)) ||
    (cur === "USD" ? 225 : 1600);
  const getCur = () => (pageWindow.localStorage.getItem(CUR_KEY) === "USD" ? "USD" : "CNY");

  function renderPanel(stats, actions, usages) {
    const root = document.getElementById("kqc-root");
    const bal = stats && stats.subscriptionBalance;
    const coding = usages && usages.usages && usages.usages[0];
    const weekly = coding && coding.detail;
    const h5 = coding && coding.limits && coding.limits[0] && coding.limits[0].detail;
    const total = usages && usages.totalQuota;
    const n = (x) => Number(x || 0);
    const cur = getCur();
    const poolValue = getPoolValue(cur);
    const sym = cur === "USD" ? "$" : "¥";
    const fmtMoney = (v) => sym + Number(v).toFixed(2);
    const usedEst = bal ? fmtMoney(bal.amountUsedRatio * poolValue) : "-";
    const r5 = stats?.ratelimitCode5h?.ratio ?? 0;
    const r7 = stats?.ratelimitCode7d?.ratio ?? 0;
    // per-feature drain: Code from official ratio; Chat/Agent/others summed from ledger
    // 分类命名统一（CODING→Code 等）；Code 以官方比例为准，其余由近期流水汇总
    const FEAT_NAMES = { CODING: "Code", CHAT: "Chat", AGENT: "Agent", SWARM: "Swarm" };
    const featName = (f) => FEAT_NAMES[f] || f;
    const featSums = {};
    for (const a of actions.actions || []) {
      const key = featName(stripFeature(a.feature));
      featSums[key] = (featSums[key] || 0) + (a.items?.[0]?.amountRatio || 0);
    }
    if (bal && bal.kimiCodeUsedRatio != null) featSums["Code"] = bal.kimiCodeUsedRatio;
    const featOrder = ["Code", "Chat", "Agent", "Swarm"];
    const featKeys = [...featOrder.filter((k) => featSums[k] != null), ...Object.keys(featSums).filter((k) => !featOrder.includes(k))];
    const listedSum = featKeys.reduce((acc, k) => acc + featSums[k], 0);
    if (bal && bal.amountUsedRatio != null && listedSum < bal.amountUsedRatio - 1e-9) {
      const otherKey = LANG === "zh" ? "其他（历史）" : "Other (history)";
      featSums[otherKey] = bal.amountUsedRatio - listedSum;
      featKeys.push(otherKey);
    }
    const featLines = featKeys
      .map((k, i) => {
        const first = i === 0;
        const line = `${first ? t("ofWhich") + " " : ""}${k} <b>${pct(featSums[k])}</b>${LANG === "zh" ? "，" : ", "}${t("estShort", { v: fmtMoney(featSums[k] * poolValue) })}`;
        return `<div class="kqc-label" style="margin-top:2px">${line}</div>`;
      })
      .join("");

    const rows = (actions.actions || []).slice(0, 50).map((a) => {
      const r = a.items?.[0]?.amountRatio;
      return `<tr>
        <td>${fmtLocal(a.timestamp, true)}</td>
        <td>${stripFeature(a.feature)}</td>
        <td style="font-family:inherit">${(a.title || "").slice(0, 44)}</td>
        <td>${r != null ? pct(r) : "0%"}</td>
        <td>${r != null ? fmtMoney(r * poolValue) : fmtMoney(0)}</td>
      </tr>`;
    }).join("");

    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:18px;font-weight:600">${t("title")} v${GM_info.script.version}</div>
        <div class="kqc-close" id="kqc-close">&times;</div>
      </div>
      <div class="kqc-grid">
        <div class="kqc-card"><div class="kqc-label">${t("monthlyUsed")}</div>
          <div class="kqc-value">${bal ? pct(bal.amountUsedRatio) : "-"}${total ? ' <span style="font-weight:400;font-size:12px;color:#666">(' + n(total.used) + "/" + n(total.limit) + ")</span>" : ""}</div>
          ${featLines}
        </div>
        <div class="kqc-card"><div class="kqc-label">${t("poolValue")}<span class="kqc-tip">!<span class="kqc-tipbox">${t("tipBody")}</span></span></div>
          <div class="kqc-value" style="font-size:13px;font-weight:400">
            <select id="kqc-cur" style="font-size:12px">
              <option value="CNY" ${cur === "CNY" ? "selected" : ""}>CNY ¥</option>
              <option value="USD" ${cur === "USD" ? "selected" : ""}>USD $</option>
            </select>
            <input id="kqc-poolval" type="number" step="10" value="${poolValue}" style="width:76px;font-size:13px">
          </div>
          <div class="kqc-label" style="margin-top:2px">${t("poolUsed", { v: usedEst })}</div></div>
        <div class="kqc-card"><div class="kqc-label">${t("w5h")}</div>
          <div class="kqc-value">${pct(r5)}</div>
          <div class="kqc-label" style="margin-top:2px">${t("estUsed", { v: fmtMoney(r5 * 0.04 * poolValue) + " / " + fmtMoney(0.04 * poolValue) })}</div>
          <div class="kqc-label" style="margin-top:2px">${t("resetAt", { v: fmtLocal(h5?.resetTime || stats?.ratelimitCode5h?.resetTime).slice(5) })}</div></div>
        <div class="kqc-card"><div class="kqc-label">${t("w7d")}</div>
          <div class="kqc-value">${pct(r7)}</div>
          <div class="kqc-label" style="margin-top:2px">${t("estUsed", { v: fmtMoney(r7 * 0.2 * poolValue) + " / " + fmtMoney(0.2 * poolValue) })}</div>
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
          pageWindow.localStorage.setItem(cur === "USD" ? POOL_USD_KEY : POOL_CNY_KEY, String(v));
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
      const stats = await apiPost("/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats");
      const actions = await apiPost("/apiv2/kimi.gateway.membership.v2.MembershipService/ListBalanceActions", { pageSize: 200 });
      let usages = null;
      try {
        usages = await apiPost("/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages", {
          scope: ["FEATURE_CODING"],
        });
      } catch (e) {
        debug("GetUsages err: " + e);
      }
      renderPanel(stats, actions, usages);
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
  };

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
