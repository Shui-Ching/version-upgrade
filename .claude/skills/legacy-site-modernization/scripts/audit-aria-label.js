#!/usr/bin/env node
/**
 * 掃描（或批次修補）沒有可及名稱的 icon-only 按鈕。
 * 用法：node audit-aria-label.js <目錄> [--fix] [--rules=path]
 *
 * 比對不到規則的一律跳過並回報——猜出來的 label 比留空更難被發現。
 * 只修 <button>；當按鈕用的 <a>/<span> 僅回報（先改標籤，見 references/03-a-to-button.md，節點 4）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith('--')) || '.';
const fix = args.includes('--fix');
const rulesArg = args.find((a) => a.startsWith('--rules='));
const rulesPath = rulesArg
  ? rulesArg.slice('--rules='.length)
  : path.join(__dirname, 'label-rules.json');

const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out);
    } else if (e.name.endsWith('.html')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

/** 取屬性值，單雙引號都接受 */
function attrValue(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] !== undefined ? m[2] : m[3]) : null;
}

/** 剝掉標籤與實體後判斷是否真的沒有文字 */
function hasText(inner) {
  return (
    inner
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&[a-z]+;/gi, 'x')
      .trim().length > 0
  );
}

function hasName(attrs, inner) {
  // 空字串的 aria-label / title 等於沒有
  for (const a of ['aria-label', 'aria-labelledby', 'title']) {
    const v = attrValue(attrs, a);
    if (v !== null && v.trim()) return true;
  }
  // 視覺隱藏文字也算有名稱
  if (/class\s*=\s*["'][^"']*\b(sr-only|visually-hidden)\b/i.test(inner)) return true;
  // 內部圖片的 alt 會參與名稱計算
  const imgAlt = inner.match(/<img\b[^>]*\balt\s*=\s*("([^"]+)"|'([^']+)')/i);
  if (imgAlt) return true;
  return hasText(inner);
}

function pickLabel(attrs, inner) {
  const cls = attrValue(attrs, 'class') || '';
  for (const [key, label] of Object.entries(rules.byClass || {})) {
    if (cls.includes(key)) return label;
  }
  const iconTag = inner.match(/<i\b([^>]*)>/i);
  const iconCls = iconTag ? attrValue(iconTag[1], 'class') || '' : '';
  for (const [key, label] of Object.entries(rules.byIcon || {})) {
    if (iconCls.includes(key)) return label;
  }
  return null;
}

/** icon 是裝飾性的，名稱已由 aria-label 提供；aria-hidden 只能加在 <i> 上 */
function hideIcons(inner) {
  return inner.replace(/<i\b([^>]*)>/gi, (m, a) =>
    /aria-hidden/i.test(a) ? m : `<i${a} aria-hidden="true">`
  );
}

function lineOf(src, offset) {
  return src.slice(0, offset).split('\n').length;
}

const BTN_RE = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
// 當按鈕用但標籤還沒改的元素——只回報，不修（要先走節點 4 把標籤改成 <button>）
const FAKE_BTN_RE =
  /<(a|span)\b[^>]*(role\s*=\s*["']button["']|onclick|href\s*=\s*["'](javascript:;?|#)["'][^>]*data-)[^>]*>/gi;

let missing = 0;
let patched = 0;
const unresolved = [];
const fakeButtons = [];

for (const file of walk(root)) {
  const src = fs.readFileSync(file, 'utf8');
  let changed = false;

  const out = src.replace(BTN_RE, (whole, attrs, inner, offset) => {
    if (hasName(attrs, inner)) return whole;
    missing++;

    const line = lineOf(src, offset);
    const label = pickLabel(attrs, inner);
    if (!label) {
      unresolved.push(`${file}:${line}  ${whole.replace(/\s+/g, ' ').slice(0, 100)}`);
      return whole;
    }
    if (!fix) {
      console.log(`${file}:${line}  → aria-label="${label}"`);
      return whole;
    }
    changed = true;
    patched++;
    // 清掉空值的 aria-label / title，避免補上後屬性重複
    const cleaned = attrs.replace(/\s*(aria-label|title)\s*=\s*(""|'')/gi, '');
    return `<button${cleaned} aria-label="${label}">${hideIcons(inner)}</button>`;
  });

  for (const m of src.matchAll(FAKE_BTN_RE)) {
    fakeButtons.push(`${file}:${lineOf(src, m.index)}  ${m[0].replace(/\s+/g, ' ').slice(0, 100)}`);
  }

  if (changed) fs.writeFileSync(file, out, 'utf8');
}

console.log(`\n缺可及名稱的 button：${missing} 處${fix ? `，已修補 ${patched} 處` : ''}`);
if (unresolved.length) {
  console.log(`\n對照不到規則、需人工判斷（${unresolved.length} 處）：`);
  unresolved.forEach((u) => console.log('  ' + u));
}
if (fakeButtons.length) {
  console.log(`\n疑似當按鈕用的 <a>/<span>，先改標籤再補 label（${fakeButtons.length} 處，見節點 4：references/03-a-to-button.md）：`);
  fakeButtons.forEach((u) => console.log('  ' + u));
}
process.exit(missing - patched > 0 ? 1 : 0);
