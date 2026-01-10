// =========================
// 設定
// =========================
const STORAGE_KEY = "pastq_state_v2";

// 回ごとの公式解説ページURL（今は使っていないが残しておく）
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

// { [id]: { a:bool, b:bool, c:bool, sel:number|null, wrong:bool } }
let state = loadState();

// =========================
// DOM 要素
// =========================
const elYear     = document.getElementById("yearFilter");
const elExam     = document.getElementById("examFilter");
const elSort     = document.getElementById("sortMode");
const elOnly     = document.getElementById("onlyChecked");
const elList     = document.getElementById("list");
const elProgress = document.getElementById("progress");
const elReset    = document.getElementById("reset-answers"); // ←追加

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

// 指定した回の「正解数 / 全問題数」を計算
function getExamStats(examNo) {
  const all = window.QUESTIONS.filter(q => q.exam === examNo);
  const exMap = window.EXPLANATIONS || {};

  let correct = 0;

  all.forEach(q => {
    const s = state[q.id];
    if (!s || typeof s.sel !== "number") return; // 未回答

    const ex = exMap[q.id];
    if (!ex || ex.answer == null) return;

    const num = parseInt(ex.answer, 10);
    if (isNaN(num)) return;

    const correctIndex = num - 1;
    if (s.sel === correctIndex) correct++;
  });

  return {
    total: all.length,
    correct
  };
}

// 全体の「正解数 / 全問題数」
function getOverallStats() {
  const exMap = window.EXPLANATIONS || {};
  let total = 0;
  let correct = 0;

  window.QUESTIONS.forEach(q => {
    total++;
    const s = state[q.id];
    if (!s || typeof s.sel !== "number") return;

    const ex = exMap[q.id];
    if (!ex || ex.answer == null) return;

    const num = parseInt(ex.answer, 10);
    if (isNaN(num)) return;
    const correctIndex = num - 1;
    if (s.sel === correctIndex) correct++;
  });

  return { total, correct };
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
// 正答率メータ描画
// =========================
function renderProgress() {
  if (!elProgress) return;

  const examVal = elExam.value || "ALL";

  if (examVal !== "ALL") {
    // 特定の「第◯回」のみ
    const examNo = Number(examVal);
    const { total, correct } = getExamStats(examNo);

    if (!total) {
      elProgress.textContent = `第${examNo}回：問題データなし`;
      return;
    }

    const rate = Math.round((correct / total) * 100);
    elProgress.textContent = `第${examNo}回：${correct}/${total}問正解（正答率${rate}%）`;
  } else {
    // 全体
    const { total, correct } = getOverallStats();
    if (!total) {
      elProgress.textContent = "";
      return;
    }
    const rate = Math.round((correct / total) * 100);
    elProgress.textContent = `全体：${correct}/${total}問正解（正答率${rate}%）`;
  }
}

// =========================
// 一覧描画
// =========================
function render() {
  const yearVal     = elYear.value || "ALL";
  const examVal     = elExam.value || "ALL";
  const sortMode    = elSort.value || "no";
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

  // 正答率メータも更新
  renderProgress();
}

// =========================
// カードHTML
// =========================
function cardHTML(q) {
  const s     = state[q.id] || {};
  const score = getScore(q.id);

  const exMap = window.EXPLANATIONS || {};
  const ex    = exMap[q.id] || {};
  const ans   = (ex.answer !== undefined && ex.answer !== null)
    ? String(ex.answer)
    : "（未登録）";
  const exp   = (ex.explanation !== undefined && ex.explanation !== null)
    ? String(ex.explanation)
    : "（未登録）";

  const selectedIndex = (typeof s.sel === "number") ? s.sel : null;

  const choicesHtml = (q.choices || []).map((c, idx) => {
    const label = ["①","②","③","④"][idx] || `${idx + 1}.`;
    const checkedAttr = (selectedIndex === idx) ? "checked" : "";
    return `
      <div class="choice-item">
        <input type="checkbox"
               class="choice-check"
               data-id="${q.id}"
               data-index="${idx}"
               ${checkedAttr}>
        <div class="choice-label">${label}</div>
        <div class="choice-text">${escapeHTML(c)}</div>
      </div>
    `;
  }).join("");

  return `
  <section class="card" id="card-${q.id}">
    <div class="qrow" data-toggle="${q.id}">
      <div class="meta-row">
        <div class="meta">
          【第${q.exam}回 / 第${q.no}問 / ${q.year}】
          <span class="badge">チェック合計：${score}</span>
        </div>
        <div class="checks" data-stop>
          <input type="checkbox" data-check="a" data-id="${q.id}" ${s.a ? "checked" : ""}>
          <input type="checkbox" data-check="b" data-id="${q.id}" ${s.b ? "checked" : ""}>
          <input type="checkbox" data-check="c" data-id="${q.id}" ${s.c ? "checked" : ""}>
        </div>
      </div>

      <div class="question">${escapeHTML(q.question)}</div>
      ${choicesHtml ? `<div class="choices">${choicesHtml}</div>` : ""}
    </div>

    <div class="detail" id="detail-${q.id}" hidden>
      <h3>答え</h3>
      <p>${escapeHTML(ans)}</p>

      <h3>解説</h3>
      <p>${escapeHTML(exp)}</p>
    </div>
  </section>`;
}

// =========================
// カードのイベントひも付け
// =========================
function bindCard(q) {
  const card   = document.getElementById(`card-${q.id}`);
  const detail = document.getElementById(`detail-${q.id}`);

  const choiceChecks = card.querySelectorAll(".choice-check");
  const choiceTexts  = card.querySelectorAll(".choice-text");

  // ---- 選択肢のチェック（1つだけ選ばれるようにする） ----
  choiceChecks.forEach(cb => {
    cb.addEventListener("change", (e) => {
      const id  = e.target.dataset.id;
      const idx = Number(e.target.dataset.index);

      // 1つだけにする
      choiceChecks.forEach(other => {
        if (other !== cb) other.checked = false;
      });

      const checked = cb.checked;
      state[id] = state[id] || { a:false, b:false, c:false, sel:null, wrong:false };
      state[id].sel = checked ? idx : null;
      saveState(state);

      // 回答を変えたら、正答率も再計算
      renderProgress();
    });
  });

  // ---- タップで答え＆解説の開閉＋正解ハイライト ----
  card.querySelector("[data-toggle]").addEventListener("click", (e) => {
    // 右上3つのチェック欄は除外
    if (e.target.closest("[data-stop]")) return;

    const exMap = window.EXPLANATIONS || {};
    const ex    = exMap[q.id] || {};
    const ans   = (ex.answer !== undefined && ex.answer !== null)
      ? String(ex.answer)
      : "";
    const num   = parseInt(ans, 10);
    const correctIndex = (!isNaN(num)) ? (num - 1) : null;

    const willOpen = detail.hidden;

    if (willOpen) {
      // 開くとき：正解を赤字に
      detail.hidden = false;

      if (correctIndex !== null && choiceTexts[correctIndex]) {
        choiceTexts[correctIndex].classList.add("correct");
      }

      // 「wrong」フラグも一応更新しておく（将来使うかもなので）
      let selectedIdx = null;
      choiceChecks.forEach(cb => {
        if (cb.checked) {
          selectedIdx = Number(cb.dataset.index);
        }
      });

      state[q.id] = state[q.id] || { a:false, b:false, c:false, sel:null, wrong:false };

      if (selectedIdx !== null && correctIndex !== null) {
        state[q.id].wrong = (selectedIdx !== correctIndex);
        saveState(state);
      }

    } else {
      // 閉じるとき：選択肢チェックと色をリセット
      detail.hidden = true;

      choiceTexts.forEach(t => t.classList.remove("correct"));
      choiceChecks.forEach(cb => { cb.checked = false; });

      state[q.id] = state[q.id] || { a:false, b:false, c:false, sel:null, wrong:false };
      state[q.id].sel = null;
      saveState(state);

      // 正答率を再計算（選択を消したので）
      renderProgress();
    }
  });

  // ---- 右上3つの自由チェックボックス（復習用） ----
  card.querySelectorAll(".checks input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const id  = e.target.dataset.id;
      const key = e.target.dataset.check; // a / b / c
      state[id] = state[id] || { a:false, b:false, c:false, sel:null, wrong:false };
      state[id][key] = e.target.checked;
      saveState(state);
      render(); // スコア＆並び順を更新（＝正答率も更新される）
    });
  });
}

// =========================
// イベント
// =========================
elYear.addEventListener("change", render);
elExam.addEventListener("change", render);
elSort.addEventListener("change", render);
elOnly.addEventListener("change", render);
if (elReset) {
  elReset.addEventListener("click", resetAllAnswers); 
}

// =========================
// 全回答リセット
// =========================
function resetAllAnswers() {
  // 状態を空にして保存
  state = {};
  saveState(state);

  // 一覧を描画し直し（チェックも正答率も全部クリア）
  render();
}

// =========================
// 初期処理
// =========================
renderFilters();
render();

// Service Worker 登録（失敗しても無視）
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
