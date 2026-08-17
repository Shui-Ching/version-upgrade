#!/usr/bin/env node
/**
 * BS5 元件變數化稽核（對應 references/08-bs5-behavior-traps.md 的第 4 項）
 *
 * BS5.3 把大量元件改成 --bs-* 變數驅動。關鍵在於舊版這些元件多半「沒有指定」
 * color／background，文字色是從外層繼承下來的（即專案自訂的字色）；
 * BS5 給了變數預設值，等於憑空多出一層宣告，把繼承來的樣式蓋掉。
 *
 * 用法（工作目錄是使用者的專案，所以要寫完整路徑）：
 *   git show HEAD:vendor/bootstrap/css/bootstrap.css > /tmp/bs4.css
 *   node .claude/skills/legacy-site-modernization/scripts/audit-bs5-component-vars.js \
 *       <專案目錄> /tmp/bs4.css
 *
 * 只比對顏色類變數。同一章第 7 項（.card-body 因 --bs-card-spacer-* 取不到值而
 * padding 歸零）屬於尺寸類變數，本腳本掃不到，要照該章的做法人工確認。
 *
 * 風險分級：
 *   ⚠ 高 — 站上有用、BS4 未指定、且專案自己也沒設過該元件顏色 → 顏色會變
 *   ○ 低 — 專案已大量自訂該元件，BS5 的變數預設值會被蓋過去
 *
 * 只修「高」的那些，不要盲目對「低」的加覆蓋，會改壞原本正常的地方。
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const bs4Path = process.argv[3];
if (!dir || !bs4Path || !fs.existsSync(bs4Path)) {
  console.error('用法：node .claude/skills/legacy-site-modernization/scripts/audit-bs5-component-vars.js <專案目錄> <bs4.css>');
  console.error('取得 bs4.css：git show HEAD:vendor/bootstrap/css/bootstrap.css > /tmp/bs4.css');
  process.exit(1);
}

const bs5 = fs.readFileSync(path.join(dir, 'vendor/bootstrap/css/bootstrap.css'), 'utf8');
const bs4 = fs.readFileSync(bs4Path, 'utf8');

// 站上實際使用的 class
const used = new Set();
for (const f of fs.readdirSync(dir)) {
  if (!/\.html?$/i.test(f)) continue;
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const m of src.matchAll(/class="([^"]+)"/g))
    for (const c of m[1].trim().split(/\s+/)) used.add(c);
}

// 自家 CSS（判斷是否已自訂該元件顏色）
const ownCss = [];
const cssDir = path.join(dir, 'css');
if (fs.existsSync(cssDir)) {
  for (const f of fs.readdirSync(cssDir)) {
    if (!f.endsWith('.css') || f.endsWith('.min.css')) continue;
    if (f === 'bs4-compat.css' || f.includes('bootstrap') || f.includes('swiper')) continue;
    ownCss.push(fs.readFileSync(path.join(cssDir, f), 'utf8'));
  }
}
const ownText = ownCss.join('\n');

// 狀態 class：專案幾乎都有自己的 .active / .show / .current，
// 不能拿來當作「有使用該 BS 元件」的證據
const STATE_CLASSES = new Set([
  'active', 'show', 'showing', 'hide', 'hiding', 'disabled', 'collapsed', 'collapsing',
  'fade', 'selected', 'current', 'open', 'invalid', 'valid', 'is-valid', 'is-invalid',
  'was-validated', 'first', 'last', 'prev', 'next'
]);

const comps = new Map();   // 元件根 → { vars, examples }

for (const m of bs5.matchAll(/(^|\n|\})([^{}\n]+)\{([^}]*)\}/g)) {
  const sel = m[2].trim();
  const body = m[3];
  if (sel.startsWith('@') || sel.startsWith(':root')) continue;

  for (const p of ['color', 'background-color']) {
    // 只看「用 --bs-* 變數指定」的宣告
    const re = new RegExp(`(^|;|\\s)${p}:\\s*var\\(--bs-([\\w-]+)\\)`);
    const hit = body.match(re);
    if (!hit) continue;

    // 站上有沒有用到這條規則？——必須看「選擇器裡的元件 class」。
    // 兩個容易誤判的地方：
    //   1. 不能拿變數名推導出的字串去比對——.text-info-emphasis 的變數是
    //      --bs-info-text-emphasis，專案若有自訂的 class="info" 就會誤判。
    //   2. 狀態 class（active/show/disabled…）幾乎每個專案都有自己的用法，
    //      不能當作「有用到這個 BS 元件」的證據。
    const selClasses = [...sel.matchAll(/\.([\w-]+)/g)].map(x => x[1])
      .filter(c => !STATE_CLASSES.has(c));
    if (!selClasses.some(c => used.has(c))) continue;

    // 覆蓋建議用的元件根：從變數名推導（--bs-modal-color → modal），
    // 比從選擇器猜可靠（選擇器可能是 .modal-content、.active 等狀態 class）
    const varName = hit[2];
    const root = varName.split('-')[0];
    if (!root || ['body', 'emphasis', 'secondary', 'tertiary', 'link', 'border'].includes(root)) continue;

    // BS4 同一選擇器有沒有指定同樣的屬性？有的話兩版行為一致，不是風險
    const escSel = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    const hit4 = bs4.match(new RegExp(`(^|\\n|})\\s*${escSel}\\s*\\{([^}]*)\\}`));
    if (hit4 && new RegExp(`(^|;|\\s)${p}:`).test(hit4[2])) continue;

    if (!comps.has(root)) comps.set(root, { vars: new Set(), examples: [] });
    const c = comps.get(root);
    c.vars.add(`--bs-${varName}`);
    if (c.examples.length < 3) c.examples.push(`${sel} { ${p} }`);
  }
}

if (!comps.size) {
  console.log('✅ 未發現被 BS5 變數預設值蓋掉的元件');
  process.exit(0);
}

// 依「自家是否已自訂該元件顏色」分級
const rows = [...comps].map(([root, c]) => {
  const reOwn = new RegExp(`(^|\\n|\\})[^{}\\n]*\\.${root}\\b[^{}\\n]*\\{[^}]*(?<!-)(color|background-color)\\s*:`, 'g');
  const ownHits = (ownText.match(reOwn) || []).length;
  return { root, ...c, ownHits };
});

const high = rows.filter(r => !r.ownHits);
const low = rows.filter(r => r.ownHits);

if (high.length) {
  console.log(`⚠ 高風險 ${high.length} 個——BS4 靠繼承、專案也沒自訂，顏色會變：\n`);
  for (const r of high) {
    console.log(`■ .${r.root}`);
    r.examples.forEach(e => console.log(`    ${e}`));
    console.log(`    → 覆蓋：.${r.root} { ${[...r.vars][0]}: var(<專案 token>); }\n`);
  }
} else {
  console.log('✅ 無高風險元件\n');
}

if (low.length) {
  console.log(`○ 低風險 ${low.length} 個——專案已自訂，BS5 預設值會被蓋過去：`);
  console.log('  ' + low.map(r => `.${r.root}(${r.ownHits}處)`).join('、') + '\n');
}

console.log('提醒：只修高風險的；低風險的不要盲目加覆蓋，會改壞原本正常的地方。');
if (high.length) process.exitCode = 1;
