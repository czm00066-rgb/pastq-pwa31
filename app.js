// =========================
// 設定
// =========================
const STORAGE_KEY = "pastq_state_v1";

// 回ごとの公式解説ページURL（お好みで利用）
const EXPLAIN_URLS = {
  30: "https://careerconsultant-study.com/category/pastquestions/30/",
  29: "https://careerconsultant-study.com/category/pastquestions/29/",
  28: "https://careerconsultant-study.com/category/pastquestions/28/"
};

// =========================
// 状態の保存／読み込み
// =========================
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// { [id]: { a: boolean, b: boolean, c: boolean } }
let state = loadState();

// =========================
// DOM 要素
// =========================
const elYear  = document.getElementById("yearFilter");
const elExam  = document.getElementById("examFilter");
const elSort  = document.getElementById("sortMode");
const elOnly  = document.getElementById("onlyChecked");
const elReset = document.getElementById("reset");
const elList  = document.getElementById("list");

// =========================
// ヘルパー
// =========================
function getYears() {
  const years = [...new Set(window.QUESTIONS.map(q => q.year))];
  years.sort((a, b) => b - a);
  return years;
}

function getExams() {
  const exams = [...new Set(window.QUESTIONS.map(q => q.exam))];
  exams.sort((a, b) => b - a);
  return exams;
}

function getScore(id) {
  const s = state[id] || {};
  return (s.a ? 1 : 0) + (s.b ? 1 : 0) + (s.c ? 1 : 0);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =========================
// フィルタの初期描画
// =========================
function renderFilters() {
  const years = getYears();
  const exams = getExams();

  elYear.innerHTML =
    `<option value="ALL">年度：すべて</option>` +
    years.map(y => `<option value="${y}">年度：${y}</option>`).join("");

  elExam.innerHTML =
    `<option value="ALL">第○回：すべて</option>` +
    exams.map(e => `<option value="${e}">第${e}回のみ</option>`).join("");
}

// =========================
// 一覧描画
// =========================
function render() {
  const yearVal    = elYear.value || "ALL";
  const examVal    = elExam.value || "ALL";
  const sortMode   = elSort.value || "no";
  const onlyChecked = elOnly.checked;

  let items = window.QUESTIONS.slice();

  // 絞り込み
  if (yearVal !== "ALL") {
    const y = Number(yearVal);
    items = items.filter(q => q.year === y);
  }
  if (examVal !== "ALL") {
    const e = Number(examVal);
    items = items.filter(q => q.exam === e);
  }
  if (onlyChecked) {
    items = items.filter(q => getScore(q.id) > 0);
  }

  // 並び替え
  if (sortMode === "score") {
    items.sort((x, y) => {
      const ds = getScore(y.id) - getScore(x.id);
      if (ds !== 0) return ds;
      if (y.exam !== x.exam) return y.exam - x.exam;
      return x.no - y.no;
    });
  } else {
    // デフォルト：回が新しい順 → 問番号昇順
    items.sort((x, y) => (y.exam - x.exam) || (x.no - y.no));
  }

  // HTML生成
  elList.innerHTML = items.map(q => cardHTML(q)).join("");

  // イベント付与
  items.forEach(q => bindCard(q));
}

// =========================
// カードHTML
// =========================
function cardHTML(q) {
  const s = state[q.id] || {};
  const score = getScore(q.id);

  // answers & explanations 取得
  const exMap = window.EXPLANATIONS || {};
  const ex    = exMap[q.id] || {};
  const ans   = (ex.answer !== undefined && ex.answer !== null)
    ? String(ex.answer)
    : "（未登録）";
  const exp   = (ex.explanation !== undefined && ex.explanation !== null)
    ? String(ex.explanation)
    : "（未登録）";

  const choicesHtml = (q.choices || []).map((c, idx) => {
    const label = ["①","②","③","④"][idx] || `${idx + 1}.`;
    return `
      <div class="choice-item">
        <div>${label}</div>
        <div>${escapeHTML(c)}</div>
      </div>
    `;
  }).join("");

  const explainLink = EXPLAIN_URLS[q.exam];

  return `
  <section class="card" id="card-${q.id}">
    <div class="qrow" data-toggle="${q.id}">
      <div class="qtext">
        <div class="meta">
          【第${q.exam}回 / 第${q.no}問 / ${q.year}】
          <span class="badge">チェック合計：${score}</span>
        </div>
        <div class="question">${escapeHTML(q.question)}</div>
        ${choicesHtml ? `<div class="choices">${choicesHtml}</div>` : ""}
      </div>

      <div class="checks" data-stop>
        <label><input type="checkbox" data-check="a" data-id="${q.id}" ${s.a ? "checked" : ""}>✓1</label>
        <label><input type="checkbox" data-check="b" data-id="${q.id}" ${s.b ? "checked" : ""}>✓2</label>
        <label><input type="checkbox" data-check="c" data-id="${q.id}" ${s.c ? "checked" : ""}>✓3</label>
      </div>
    </div>

    <div class="detail" id="detail-${q.id}" hidden>
      <h3>答え</h3>
      <p>${escapeHTML(ans)}</p>

      <h3>解説</h3>
      <p>${escapeHTML(exp)}</p>

      ${explainLink ? `
        <p class="muted">
          もっと詳しい公式解説：
          <a href="${escapeHTML(explainLink)}" target="_blank" rel="noopener">
            第${q.exam}回 解説ページ
          </a>
        </p>` : ""}
    </div>
  </section>`;
}

// =========================
// カードのイベントひも付け
// =========================
function bindCard(q) {
  const card   = document.getElementById(`card-${q.id}`);
  const detail = document.getElementById(`detail-${q.id}`);

  // タップで答え＆解説の開閉（チェック欄は除外）
  card.querySelector("[data-toggle]").addEventListener("click", (e) => {
    if (e.target.closest("[data-stop]")) return;
    detail.hidden = !detail.hidden;
  });

  // チェックボックスの変更
  card.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const id  = e.target.dataset.id;
      const key = e.target.dataset.check; // a / b / c
      state[id] = state[id] || { a:false, b:false, c:false };
      state[id][key] = e.target.checked;
      saveState(state);
      render(); // スコア＆並び順を更新
    });
  });
}

// =========================
// イベント
// =========================
elReset.addEventListener("click", () => {
  if (!confirm("チェックを全てリセットします。よろしいですか？")) return;
  state = {};
  saveState(state);
  render();
});

elYear.addEventListener("change", render);
elExam.addEventListener("change", render);
elSort.addEventListener("change", render);
elOnly.addEventListener("change", render);

// =========================
// 初期処理
// =========================
renderFilters();
render();

// Service Worker 登録（失敗しても無視）
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
