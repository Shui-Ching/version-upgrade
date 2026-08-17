#!/usr/bin/env node
/**
 * BS4 → BS5 升級稽核
 *
 * 找出「HTML 使用中 × BS4 有定義 × BS5 沒有 × 自家 CSS 未接手」的 class，
 * 也就是升級後會失去樣式、需要補進相容層的漏網之魚。
 *
 * 用法（工作目錄是使用者的專案，所以要寫完整路徑）：
 *   git show HEAD:vendor/bootstrap/css/bootstrap.css > /tmp/bs4.css
 *   node .claude/skills/legacy-site-modernization/scripts/audit-bs4-classes.js \
 *       <專案目錄> /tmp/bs4.css [bs5.css 路徑]
 *
 * 界限一（重要）：本稽核只驗證「class 是否存在」，抓不到「同名但行為改變」。
 * BS5 在 .form-control 高度與 focus、.btn line-height、.table 改用 CSS 變數、
 * Reboot 對 label/legend 的處理上都有差異，那些只能目視回歸。
 * 稽核通過 ≠ 升級完成。
 *
 * 界限二（會安靜地假陰性）：本腳本假設扁平結構——HTML 只讀 <專案目錄>/*.html
 * 不遞迴子資料夾，自家 CSS 只讀 <專案目錄>/css/*.css。頁面放在 pages/ 或
 * 樣式放在 assets/css/ 的專案跑起來不會報錯，只會少掃一堆檔案然後回報乾淨。
 * 跑之前先確認這兩個路徑對得上你的專案，或改掉下面的 readdirSync 目標。
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const bs4Path = process.argv[3];
const bs5Path = process.argv[4] || path.join(dir, 'vendor/bootstrap/css/bootstrap.css');

if (!dir || !bs4Path || !fs.existsSync(bs4Path) || !fs.existsSync(bs5Path)) {
  console.error('用法：node .claude/skills/legacy-site-modernization/scripts/audit-bs4-classes.js <專案目錄> <bs4.css> [bs5.css]');
  console.error('取得 bs4.css：git show HEAD:vendor/bootstrap/css/bootstrap.css > /tmp/bs4.css');
  process.exit(1);
}

const bs4 = fs.readFileSync(bs4Path, 'utf8');
const bs5 = fs.readFileSync(bs5Path, 'utf8');

// 自家樣式（含升級時新寫的相容層）——這些 class 已有人接手，不算漏網
const own = fs.readdirSync(path.join(dir, 'css'))
  .filter(f => f.endsWith('.css'))
  .map(f => fs.readFileSync(path.join(dir, 'css', f), 'utf8'))
  .join('\n');

// 收集 HTML 中實際使用的 class
const used = new Map();
for (const name of fs.readdirSync(dir)) {
  if (!/\.html?$/i.test(name)) continue;
  const src = fs.readFileSync(path.join(dir, name), 'utf8');
  for (const m of src.matchAll(/class="([^"]+)"/g)) {
    for (const c of m[1].trim().split(/\s+/)) {
      if (!c || c.includes('{')) continue;      // 濾掉樣板語法殘留
      if (!used.has(c)) used.set(c, new Set());
      used.get(c).add(name);
    }
  }
}

const defined = (css, cls) =>
  new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(css);

const risk = [];
for (const [cls, files] of used) {
  if (!defined(bs4, cls)) continue;   // 不是 BS4 的 class
  if (defined(bs5, cls)) continue;    // BS5 仍有，安全
  if (defined(own, cls)) continue;    // 自家 CSS 或相容層已接手
  risk.push({ cls, count: files.size, files: [...files] });
}

risk.sort((a, b) => b.count - a.count);

if (!risk.length) {
  console.log('✅ 無漏網：所有 BS4 專有 class 都已由 BS5 或相容層涵蓋');
  console.log('   注意：這不涵蓋「同名但行為改變」的差異，仍需目視回歸。');
} else {
  console.log(`⚠ 尚未涵蓋的 BS4 class 共 ${risk.length} 個，需補進相容層：\n`);
  for (const r of risk) {
    const where = r.count <= 3 ? '  → ' + r.files.join(', ') : '';
    console.log(`  .${r.cls}  （${r.count} 頁）${where}`);
  }
  console.log('\n數值請從 bs4.css 取，不要憑印象填。');
  process.exitCode = 1;
}
