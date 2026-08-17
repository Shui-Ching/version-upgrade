#!/usr/bin/env node
/**
 * BS4 → BS5「class 還在但行為變了」稽核
 *
 * audit-bs4-classes.js 只驗證 class 是否存在，抓不到預設值改變的情況。
 * 本腳本針對五個實戰踩過的行為差異做針對性檢查，動工時就該跑，
 * 不要等使用者逐頁回報跑版。
 *
 * 用法（工作目錄是使用者的專案，所以要寫完整路徑）：
 *   node .claude/skills/legacy-site-modernization/scripts/audit-behavior-changes.js <專案目錄>
 *
 * 輸出分兩類：
 *   ⚠ 待處理  — 需要修的風險點
 *   ✓ 已處理  — 站上確實依賴該機制，但相容層已補回（保留供回歸時重點確認）
 *
 * 涵蓋範圍：對應 references/08-bs5-behavior-traps.md 的第 1、2、3、5、6、8 項，
 * 外加該章沒有獨立列項的「a 預設有底線」。第 4 項（元件 --bs-* 變數）要另跑
 * audit-bs5-component-vars.js；第 7 項（.card-body padding 歸零）與第 9 項
 * （特異度反超）兩支腳本都掃不到，只能照該章的做法人工確認。
 *
 * 限制（會安靜地假陰性）：假設扁平結構——只讀 <專案目錄>/*.html（不遞迴）、
 * <專案目錄>/css/*.css、<專案目錄>/js/*.js，且相容層固定找 css/bs4-compat.css。
 * 路徑對不上的專案不會報錯，只會少掃檔案然後回報乾淨。
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('用法：node .claude/skills/legacy-site-modernization/scripts/audit-behavior-changes.js <專案目錄>');
  process.exit(1);
}

// 註解裡常留有「原為 var(--red)」這類說明，不去掉會誤報
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

const cssDir = path.join(dir, 'css');
const ownCss = [];
if (fs.existsSync(cssDir)) {
  for (const f of fs.readdirSync(cssDir)) {
    if (!f.endsWith('.css')) continue;
    // 排除相容層、第三方，以及編譯產物（.min 會與來源檔重複回報）
    if (f === 'bs4-compat.css' || f.endsWith('.min.css')) continue;
    if (f.includes('bootstrap') || f.includes('swiper')) continue;
    ownCss.push({ name: f, text: stripComments(fs.readFileSync(path.join(cssDir, f), 'utf8')) });
  }
}
const htmlFiles = fs.readdirSync(dir).filter(f => /\.html?$/i.test(f))
  .map(f => ({ name: f, text: stripComments(fs.readFileSync(path.join(dir, f), 'utf8')) }));

const compatPath = path.join(cssDir, 'bs4-compat.css');
const compat = fs.existsSync(compatPath) ? stripComments(fs.readFileSync(compatPath, 'utf8')) : '';

const todo = [];   // 待處理
const done = [];   // 已由相容層處理，但回歸時值得確認
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

// ① BS4 :root 變數（BS5 已加 --bs- 前綴）——無法用相容層安全補回，一律列為待處理
const BS4_VARS = ['blue','indigo','purple','pink','red','orange','yellow','green','teal','cyan',
  'white','gray','gray-dark','primary','secondary','success','info','warning','danger','light','dark',
  'breakpoint-xs','breakpoint-sm','breakpoint-md','breakpoint-lg','breakpoint-xl',
  'font-family-sans-serif','font-family-monospace'];
const reVar = new RegExp(`var\\(\\s*--(${BS4_VARS.join('|')})\\s*[,)]`, 'g');
for (const f of [...ownCss, ...htmlFiles]) {
  for (const m of f.text.matchAll(reVar)) {
    todo.push({ n: 1, at: `${f.name}:${lineOf(f.text, m.index)}`,
      msg: `var(--${m[1]}) 已失效（BS5 為 --bs-${m[1]}）；建議改用專案自己的設計 token` });
  }
}

// ② 自家動過表單 padding → .form-control 少了 height 會塌
const compatHasHeight = /\.form-control\s*\{[^}]*height\s*:/.test(compat);
const padHits = [];
for (const f of ownCss) {
  for (const m of f.text.matchAll(/([^{}]*(?:\.form-control|\binput\b)[^{}]*)\{([^}]*)\}/g)) {
    if (/padding\s*:\s*0(?:\s|;|})/.test(m[2]) && !/height\s*:/.test(m[2])) {
      padHits.push({ at: `${f.name}:${lineOf(f.text, m.index)}`, sel: m[1].trim().replace(/\s+/g, ' ') });
      break;
    }
  }
}
for (const h of padHits) {
  (compatHasHeight ? done : todo).push({ n: 2, at: h.at,
    msg: `「${h.sel}」把表單 padding 歸零，依賴 BS4 的 .form-control 固定 height` });
}
if (padHits.length && !compatHasHeight) {
  todo.push({ n: 2, at: 'css/bs4-compat.css', msg: '相容層尚未補回 .form-control { height: calc(1.5em + .75rem + 2px) }' });
}

// ③ col 內絕對定位（BS5 的 col 不再 position: relative）
const compatHasRelative = /\.(row|form-row)\s*>\s*\*/.test(compat) && /position\s*:\s*relative/.test(compat);
const absHits = [];
for (const f of ownCss) {
  for (const m of f.text.matchAll(/([^{}\n]*(?:form-row|\bcol-|\.col\b)[^{}\n]*)\{([^}]*)\}/g)) {
    if (/position\s*:\s*absolute/.test(m[2])) {
      absHits.push({ at: `${f.name}:${lineOf(f.text, m.index)}`, sel: m[1].trim().replace(/\s+/g, ' ') });
    }
  }
}
for (const h of absHits) {
  (compatHasRelative ? done : todo).push({ n: 3, at: h.at,
    msg: `「${h.sel}」用絕對定位，依賴 col 的 position: relative` });
}
if (absHits.length && !compatHasRelative) {
  todo.push({ n: 3, at: 'css/bs4-compat.css', msg: '相容層尚未補回 .row > *, .form-row > * { position: relative }' });
}

// ④ textarea min-height 權重不足（正解是改自家 CSS 提權重，不是改相容層）
//
// BS5 的 textarea.form-control 權重是 (0,1,1)。自家規則只要任一個逗號分段
// 帶有 1 個以上的 class／屬性／偽類，權重就 >= (0,1,1)，再靠載入順序即可取勝；
// 只有「純元素選擇器」（如 textarea{}）才真的會被壓過。
const classCount = sel => (sel.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) || []).length;
for (const f of ownCss) {
  for (const m of f.text.matchAll(/(?:^|\n|\})([^{}\n]*\btextarea\b[^{}]*)\{([^}]*)\}/g)) {
    if (!/min-height\s*:/.test(m[2])) continue;
    const sel = m[1].trim().replace(/\s+/g, ' ');
    // 同一宣告塊只要有任一分段達到權重，整條就有效
    const safe = sel.split(',').some(s => classCount(s) >= 1);
    if (!safe) {
      todo.push({ n: 4, at: `${f.name}:${lineOf(f.text, m.index)}`,
        msg: `「${sel}」是純元素選擇器 (0,0,1)，min-height 會被 BS5 的 ` +
             `textarea.form-control (0,1,1) 壓過；請在選擇器補上 textarea.form-control ` +
             `（改自家 CSS 提權重，不要改相容層——100px 這類值是專案設計值，不是框架預設值）` });
    }
  }
}

// ⑤ a 底線
const hasLinkReset = [...ownCss, { name: 'bs4-compat.css', text: compat }].some(f =>
  /(?:^|\n|\})\s*a\s*(?:,[^{}]*)?\{[^}]*text-decoration\s*:\s*none/.test(f.text));
if (!hasLinkReset) {
  todo.push({ n: 5, at: '（全站）', msg: 'BS5 的 a 預設有底線，未見任何 text-decoration: none 還原' });
}

// ⑦ select 的原生下拉箭頭（BS5 的 .form-control 新增 appearance: none）
const selectCount = htmlFiles.reduce((n, f) =>
  n + [...f.text.matchAll(/<select[^>]*class="[^"]*\bform-control\b/g)].length, 0);
if (selectCount) {
  const restored = /select\.form-control[^{]*\{[^}]*appearance\s*:\s*(auto|menulist)/.test(compat);
  const hasOwnArrow = ownCss.some(f =>
    /select[^{}]*\{[^}]*background-image\s*:/.test(f.text));
  if (!restored && !hasOwnArrow) {
    todo.push({ n: 7, at: `（${selectCount} 處 select.form-control）`,
      msg: 'BS5 的 .form-control 有 appearance:none，select 原生箭頭會消失；' +
           '相容層加 select.form-control{appearance:auto}（只針對 select，不要動 input）' });
  }
}

// ⑧ scroll-behavior: smooth 與既有 JS 捲動動畫衝突
const jsFiles = [];
const jsDir = path.join(dir, 'js');
if (fs.existsSync(jsDir)) {
  for (const f of fs.readdirSync(jsDir)) {
    if (f.endsWith('.js') && !f.endsWith('.min.js'))
      jsFiles.push({ name: `js/${f}`, text: fs.readFileSync(path.join(jsDir, f), 'utf8') });
  }
}
const reScrollAnim = /\.animate\(\s*\{[^}]*scrollTop/;
for (const f of [...jsFiles, ...htmlFiles]) {
  if (!reScrollAnim.test(f.text)) continue;
  const disabled = /:root[^{]*\{[^}]*scroll-behavior\s*:\s*auto/.test(compat);
  if (!disabled) {
    todo.push({ n: 8, at: f.name,
      msg: 'jQuery animate({scrollTop}) 會與 BS5 新增的 :root{scroll-behavior:smooth} ' +
           '互相追逐而頓挫；相容層加 :root{scroll-behavior:auto}，或把 JS 改為原生 scrollTo' });
  }
  break;
}

// 輸出
const TITLES = {
  1: ':root 變數已加 --bs- 前綴',
  2: '.form-control 移除固定 height',
  3: 'col 不再是定位基準',
  4: 'textarea.form-control min-height 權重',
  5: 'a 預設改為有底線',
  7: 'select 的 appearance: none',
  8: 'scroll-behavior 與 JS 動畫衝突'
};
const render = (list, mark) => {
  for (const n of [1, 2, 3, 4, 5, 7, 8]) {
    const g = list.filter(f => f.n === n);
    if (!g.length) continue;
    console.log(`【${n}】${TITLES[n]}`);
    g.forEach(f => console.log(`    ${mark} ${f.at}\n      ${f.msg}`));
    console.log('');
  }
};

if (!todo.length) {
  console.log('✅ 本腳本涵蓋的七項行為差異均無待處理項目\n' +
              '   （元件 --bs-* 變數請另跑 audit-bs5-component-vars.js；\n' +
              '    .card-body padding 與特異度反超兩項腳本掃不到，見 08-bs5-behavior-traps.md）\n');
} else {
  console.log(`⚠ 待處理 ${todo.length} 項：\n`);
  render(todo, '⚠');
}

if (done.length) {
  console.log(`✓ 已由相容層處理 ${done.length} 項（回歸時仍建議重點確認）：\n`);
  render(done, '✓');
}

console.log('注意：這是啟發式檢查，仍需目視回歸表單、Reboot、Grid 三塊。');
if (todo.length) process.exitCode = 1;
