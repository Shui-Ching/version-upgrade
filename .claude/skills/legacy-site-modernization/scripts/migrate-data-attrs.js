#!/usr/bin/env node
/**
 * BS4 → BS5：data-* → data-bs-* 批次替換
 *
 * 同時處理 HTML 屬性與 CSS 屬性選擇器。
 * 只改 CSS 而漏掉 HTML（或反過來）是升級後「樣式吃不到」的頭號原因，
 * 所以本腳本刻意把兩者綁在一起做。
 *
 * 用法（工作目錄是使用者的專案，所以要寫完整路徑）：
 *   node .claude/skills/legacy-site-modernization/scripts/migrate-data-attrs.js <專案目錄> [--dry]
 *
 * 先跑 --dry 確認影響範圍，再實際執行。
 *
 * 與三支 audit-*.js 不同，本腳本會遞迴子資料夾（見下方 walk()），
 * 並跳過 node_modules／.git／vendor。所以 vendor 底下第三方套件自己的
 * data-toggle 不會被動到——那是對的，但也表示那些套件若依賴 BS4 的
 * data 屬性，要另外處理。
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const dryRun = process.argv.includes('--dry');

if (!dir || !fs.existsSync(dir)) {
  console.error('用法：node migrate-data-attrs.js <專案目錄> [--dry]');
  process.exit(1);
}

// slide-to 必須排在 slide 之前，否則會被 slide 先吃掉而產生 data-bs-slide-to 以外的錯誤結果
const ATTRS = [
  'toggle', 'target', 'dismiss', 'parent', 'ride', 'slide-to', 'slide', 'spy',
  // 選項類屬性同樣要加前綴，漏掉會讓 modal/carousel 的設定失效
  'backdrop', 'keyboard', 'focus', 'show', 'interval', 'pause', 'wrap', 'touch',
  'delay', 'placement', 'container', 'boundary', 'html', 'trigger', 'content',
  'animation', 'selector', 'offset', 'display', 'reference', 'autohide'
];

// HTML：屬性名後接 =，避免動到 data-slick-index、data-step 等自訂屬性
const reHtml = new RegExp(`\\bdata-(${ATTRS.join('|')})=`, 'g');
// CSS：屬性選擇器，比對 [ 之後的屬性名（允許 [data-toggle='x'] 與 [data-toggle] 兩種）
const reCss = new RegExp(`\\[data-(${ATTRS.join('|')})(?=\\s*[~|^$*]?[=\\]])`, 'g');

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    // 不動第三方套件
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'vendor'].includes(e.name)) continue;
      walk(p, acc);
    } else {
      acc.push(p);
    }
  }
  return acc;
}

const results = { html: [], css: [] };

for (const file of walk(dir)) {
  const ext = path.extname(file).toLowerCase();
  const isHtml = ext === '.html' || ext === '.htm';
  const isCss = ext === '.css' || ext === '.scss';
  if (!isHtml && !isCss) continue;

  const src = fs.readFileSync(file, 'utf8');
  let out = src;
  let hits = 0;

  if (isHtml) {
    // HTML 檔同時可能含內嵌 <style>，兩種規則都套
    out = out.replace(reHtml, (m, a) => { hits++; return `data-bs-${a}=`; });
    out = out.replace(reCss, (m, a) => { hits++; return `[data-bs-${a}`; });
  } else {
    out = out.replace(reCss, (m, a) => { hits++; return `[data-bs-${a}`; });
  }

  if (!hits) continue;
  if (!dryRun) fs.writeFileSync(file, out, 'utf8');   // 明確 UTF-8，避免中文亂碼
  results[isHtml ? 'html' : 'css'].push(`${path.relative(dir, file)}: ${hits}`);
}

const sum = k => results[k].reduce((n, s) => n + Number(s.split(': ').pop()), 0);

console.log(`${dryRun ? '[DRY RUN] ' : ''}HTML — ${results.html.length} 檔、${sum('html')} 處`);
results.html.forEach(r => console.log('  ' + r));
console.log(`${dryRun ? '[DRY RUN] ' : ''}CSS  — ${results.css.length} 檔、${sum('css')} 處`);
results.css.forEach(r => console.log('  ' + r));

if (!results.css.length) {
  console.log('\n⚠ CSS 完全沒有命中。若站上有手風琴／展開鈕的箭頭樣式，');
  console.log('  請確認是否用了別的寫法（例如 aria-expanded 或自訂 class），再人工確認一次。');
}
