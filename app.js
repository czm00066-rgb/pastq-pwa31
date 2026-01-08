// ====== 設定 ======
const STORAGE_KEY = "pastq_state_v1";

// ====== 状態の保存／読み込み ======
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
let state = loadState(); // { [id]: { a:boolean, b:boolean, c:boolean } }

// ====== 要素取得 ======
const elYear = document.getElementById("yearFilter");
const elExam = document.getElementById("examFilter");
const elSort = document.getElementById("sortMode");
const elOnly = document.getElementById("onlyChecked");
const elReset = document.getElementById("reset");
const elList = document.getElementById("list");

// ====== ヘルパ ======
function getYears() {
  const years = [...new Set(window.QUESTIONS.map(q => q.year))].sort((a,b)=>b-a);
  return years;
}
function getExams() {
  const exams = [...new Set(window.QUESTIONS.map(q => q.exam))].sort((a,b)=>b-a);
  return exams;
}
function getScore(id) {
  const s = state[id] || {};
  return (s.a ? 1 : 0) + (s.b ? 1 : 0) + (s.c ? 1 : 0);
}
function escapeHTML(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

// ====== フィルタ初期化 ======
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

// ====== 一覧描画 ======
function render() {
  const yearVal = elYear.value || "ALL";
  const examVal = elExam.value || "ALL";
  const sortMode = elSort.value || "no";
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
    items.sort((x,y) => {
      const ds = getScore(y.id) - getScore(x.id);
      if (ds !== 0) return ds;
      if (y.exam !== x.exam) return y.exam - x.exam;
      return x.no - y.no;
    });
  } else {
    items.sort((x,y) => (y.exam - x.exam) || (x.no - y.no));
  }

  // HTML化
  elList.innerHTML = items.map(q => cardHTML(q)).join("");

  // イベントひも付け
  items.forEach(q => bindCard(q));
}

function cardHTML(q) {
  const s = state[q.id] || {};
  const score = getScore(q.id);

  const choicesHtml = (q.choices || []).map((c,idx) => {
    const label = ["①","②","③","④"][idx] || `${idx+1}.`;
    return `
      <div class="choice-item">
        <div>${label}</div>
        <div>${escapeHTML(c)}</div>
      </div>
    `;
  }).join("");

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
        <label><input type="checkbox" data-check="a" data-id="${q.id}" ${s.a?"checked":""}>✓1</label>
        <label><input type="checkbox" data-check="b" data-id="${q.id}" ${s.b?"checked":""}>✓2</label>
        <label><input type="checkbox" data-check="c" data-id="${q.id}" ${s.c?"checked":""}>✓3</label>
      </div>
    </div>

    <div class="detail" id="detail-${q.id}" hidden>
      <h3>解説</h3>
      <p class="muted">この問題の解説はWebまたは別資料で確認してください。</p>
    </div>
  </section>`;
}

function bindCard(q) {
  const card = document.getElementById(`card-${q.id}`);
  const detail = document.getElementById(`detail-${q.id}`);

  // タップで開閉（チェックは除外）
  card.querySelector('[data-toggle]').addEventListener("click", (e) => {
    if (e.target.closest("[data-stop]")) return;
    detail.hidden = !detail.hidden;
  });

  // チェック保存
  card.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const id = e.target.dataset.id;
      const key = e.target.dataset.check; // a/b/c
      state[id] = state[id] || { a:false, b:false, c:false };
      state[id][key] = e.target.checked;
      saveState(state);
      render(); // スコア＆並び替え更新
    });
  });
}

// ====== イベント ======
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

// ====== 初期処理 ======
renderFilters();
render();

// Service Worker 登録（オフライン用・失敗しても無視）
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
