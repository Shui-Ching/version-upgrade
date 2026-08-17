# 節點 7 附章：相容層策略（不動 utility class，用 CSS 補回被移除的定義）

`04-bootstrap-upgrade.md` 步驟 3 給的做法是逐處把 BS4 的 class 改成 BS5 的寫法
（`.ml-3` → `.ms-3`、刪掉 `.form-group` 補 `.mb-3`）。這一章給的是**同一個目標的另一條路**：
utility class 一律不動，改寫一支 CSS 把 BS5 移除掉的定義補回來。

兩條路不是誰對誰錯，是規模與後續維護的取捨。這一章先講什麼時候該選它，再講怎麼做。

## 目錄

- [什麼時候選這條路](#什麼時候選這條路)
- [適用邊界：BS4 起點可行，BS3 起點只能做一半](#適用邊界bs4-起點可行bs3-起點只能做一半)
- [相容層與 parity 覆寫層是同一支檔案的兩個章節](#相容層與-parity-覆寫層是同一支檔案的兩個章節)
- [動工前：先盤點，不要憑印象補 class](#動工前先盤點不要憑印象補-class)
- [四支稽核腳本各自回答什麼](#四支稽核腳本各自回答什麼)
- [產生 bs4-compat.css：從樣板刪減，不要從零寫](#產生-bs4-compatcss從樣板刪減不要從零寫)
- [相容層要補什麼](#相容層要補什麼)
- [`.form-row` 是最大的跑版風險](#form-row-是最大的跑版風險)
- [版本號 query：改了沒反應的頭號原因](#版本號-query改了沒反應的頭號原因)
- [執行順序](#執行順序)
- [收尾：相容層是暫時的，要寫下退場路徑](#收尾相容層是暫時的要寫下退場路徑)

---

## 什麼時候選這條路

這不是第三種策略，是 [`04-bootstrap-upgrade.md` 步驟 1](04-bootstrap-upgrade.md#步驟-1估規模確認策略與升級路徑) 那三個選項裡
**選項 3（分批：先升到「載入 BS5 且不壞」的最小狀態）的具體執行手法**。
判斷順序照步驟 1 走：先做 A／B／C 分類，再看下面兩個條件。

同時滿足這幾項時，相容層比逐處改名划算：

- **起點是 BS4**（BS3 起點的限制見下一節）。
- **頁數多、沒有共用區**。步驟 3 的 A 類改名數量通常是「頁數 × 每頁幾十處」，
  幾十頁的站等於上千處逐一確認，而每一處都是一次改壞版面的機會。
  反過來說，如果專案已經做過節點 3（共用區抽取），逐處改名的量會小很多，這條路的優勢就變薄。
- **沒有 SCSS 原始碼**，或 Bootstrap 走 CDN 沒有編進專案的輸出檔——
  這種情況下 Sass 變數覆寫用不了（判斷依據見
  [04 的「覆寫層放哪裡」](04-bootstrap-upgrade.md#覆寫層放哪裡看-bootstrap-有沒有被編進專案的輸出檔)）。
- **「畫面樣式不得改變」是驗收條件**。相容層直接還原舊定義，比改成新寫法再調回舊外觀少一層轉換。

反過來，**不要選這條路的情況**：站小（十頁以內）、已有共用區、或使用者的意圖本來就包含
「順便換成 BS5 的官方寫法」。那些情況下相容層只是多養一支要維護的檔案。

## 適用邊界：BS4 起點可行，BS3 起點只能做一半

相容層能還原的是**被移除或改名的 class 定義**。BS3 起點最大的那幾塊不屬於這一類：

| BS3 起點的項目 | 相容層能不能處理 |
|---|---|
| `.pull-left`、`.img-responsive`、`.center-block` 等純改名 utility | **可以**，跟 BS4 的方向性 utility 同一個做法 |
| grid 斷點位移（`col-sm-*` 的生效點從 768px 變 576px） | **勉強可以**，但要重寫整組 media query，比照 [04 的 4-1](04-bootstrap-upgrade.md#4-1-grid-斷點整體位移bs3-起點最高風險的一項) 換算 class 名稱通常更清楚 |
| navbar、`.panel` → `.card`、表單結構 | **不行。這是 DOM 重寫，補 CSS 補不出來** |
| Glyphicons | **不行**，要換圖示庫 |
| `.container` clearfix、`.row` 改 flex 這類結構性差異 | 屬於 parity 覆寫層的範圍，見 [04 的 4-7](04-bootstrap-upgrade.md#4-7-結構性差異class-掃描抓不到但會動到整頁的那一批) |

所以 BS3 起點的正確理解是：**相容層可以縮小工作量，但消不掉 DOM 重寫那一塊**。
估時的時候要分開講，不要讓使用者以為「用相容層就不必動 HTML 了」。

## 相容層與 parity 覆寫層是同一支檔案的兩個章節

這兩個東西很容易被做成兩支互相打架的檔案，先把關係講清楚：

| | parity 覆寫層 | 相容層（`bs4-compat.css`） |
|---|---|---|
| 補什麼 | 框架**還在**、但預設值改了的項目（字級、行高、gutter、`a` 底線、`.form-control` 高度） | 框架**已移除**的 class 定義（`.form-row`、`.ml-*`、`.close`） |
| 資料來源 | 舊版檔案裡的實際數值 | 舊版檔案裡的實際規則 |
| 層疊位置 | Bootstrap 之後、站台自己的樣式之前 | **同上** |

**層疊位置是同一個**，理由與實測數字見
[04 的「覆寫層要放在層疊順序的哪個位置」](04-bootstrap-upgrade.md#覆寫層要放在層疊順序的哪個位置最容易做錯的一步)——
直覺會想「要蓋掉 Bootstrap 所以排最後」，那是錯的，會連站台自己刻意寫的覆寫一起蓋掉。

既然位置相同，就**做成同一支檔案的兩個章節**，不要開兩支。開兩支的下場是同一個屬性在兩處被設定，
之後沒有人說得出哪一條該贏。

兩個章節共用同一條准入判準，就是
[08 開頭那條](08-bs5-behavior-traps.md#先講一個判準這一項該修在哪裡)：

> **值是框架預設值 → 進這支檔案；值是專案設計值 → 留在專案自己的 CSS，把選擇器補到同權重。**

最常見的違規是把 `textarea { min-height: 100px }` 這種專案設計值塞進相容層。
因為相容層排在專案樣式**之前**，塞進去只會讓相容層自己贏過專案那條，結果一樣矮
（完整說明見 [08 第 3 項](08-bs5-behavior-traps.md#3-新增-textareaform-control-的-min-height)）。

## 動工前：先盤點，不要憑印象補 class

**不要憑記憶寫相容層的數值。** 先從版控取回舊版原始碼，逐條核對真實定義：

```bash
git show HEAD:vendor/bootstrap/css/bootstrap.css > /tmp/bs4.css
```

然後只補「站上真的有用到」的。全站沒用到 `.no-gutters`、`.sr-only`、`.badge-pill` 就不要補——
**相容層越小越好維護，每一條都要說得出為什麼存在。**

用量統計（照 SKILL.md 的規定用 GNU grep）。單字邊界一律寫 `\<`／`\>` 而不是 `\b`：
`\<`／`\>` 是 GNU grep 的原生語法、在 BRE 與 ERE 下行為一致，
而 `\b` 在不同 grep 實作下的支援程度不一定——
[08 有一份實測記錄](08-bs5-behavior-traps.md#本章-grep-指令的寫法限制實測)量到 `\b` 安靜地回 0 筆。
**下面每一道指令都在 Git Bash 的 GNU grep 3.0 底下實跑驗證過**，
但換一台機器前仍請照 SKILL.md 的規定，先用一個「一定命中」的字串確認指令本身會動。

```bash
# 方向性間距 utility
grep -rEoh '\<m[lr]-(sm|md|lg|xl)?-?(auto|n?[0-5])\>' --include='*.html' . | sort | uniq -c

# BS5 移除的表單包裹層
grep -rEoh '\<(form-row|form-group|form-inline|input-group-append|input-group-prepend)\>' --include='*.html' . | sort | uniq -c

# 其餘改名或移除的
grep -rEoh '\<(close|float-left|float-right|text-left|text-right|no-gutters|sr-only|btn-block)\>' --include='*.html' . | sort | uniq -c
```

同時確認**用到哪些 JS 元件**——這決定要不要 Popper：

```bash
grep -rEoh 'data-toggle="(modal|tab|pill|collapse|dropdown|tooltip|popover|carousel)"' --include='*.html' . | sort | uniq -c
```

沒有 dropdown／tooltip／popover 就**不需要 Popper**，可沿用 `bootstrap.min.js`，
HTML 的 `<script>` 標籤連改都不用改（有的話照
[04 的 2-1](04-bootstrap-upgrade.md#2-1-換掉載入的檔案) 換成 bundle 版）。

### 先清死碼，縮小要驗的面積

這一步就是節點 1、2，**在換框架之前**做完並獨立成一筆 commit。順序反過來的話，
會花時間去修根本沒人用的頁面，回歸測試也得多驗一輪。

```bash
# 逐一確認 vendor 下每個套件是否真的被引用
for d in vendor/*/; do
  n=$(basename "$d")
  echo "$n: $(grep -rl "vendor/$n" --include='*.html' . | wc -l) 頁"
done

# 找沒有任何觸發者的 modal
grep -rEoh 'id="[^"]*modal[^"]*"' --include='*.html' . | sort -u
```

## 四支稽核腳本各自回答什麼

| 腳本 | 回答什麼 | 界限 |
|---|---|---|
| `migrate-data-attrs.js` | 批次把 `data-*` 改成 `data-bs-*`，**HTML 與 CSS 一起改** | 會遞迴子資料夾，跳過 `vendor/`／`node_modules/`／`.git/`。先跑 `--dry` |
| `audit-bs4-classes.js` | 「HTML 使用中 × 舊版有定義 × BS5 沒有 × 自家 CSS 未接手」的漏網 class | **只驗證 class 是否存在**，抓不到同名但行為改變 |
| `audit-behavior-changes.js` | [08](08-bs5-behavior-traps.md) 的第 1、2、3、5、6、8 項，加上該章沒獨立列項的「`a` 底線」 | 啟發式檢查 |
| `audit-bs5-component-vars.js` | [08 的第 4 項](08-bs5-behavior-traps.md#4-元件改用---bs--變數蓋掉原本靠繼承的樣式)（元件 `--bs-*` 變數蓋掉繼承的顏色） | **只比對顏色類變數** |

**兩項腳本都掃不到，只能人工確認**：[08 第 7 項](08-bs5-behavior-traps.md#7-card-body-的-padding-可能整個歸零)
（`.card-body` 因尺寸類變數取不到值而 padding 歸零）與
[第 9 項](08-bs5-behavior-traps.md#9-舊專案的覆寫規則被-bs5-官方元件選擇器的特異度反超)（特異度反超）。

**三支 `audit-*.js` 假設扁平結構**：只讀 `<專案目錄>/*.html`（不遞迴）、`<專案目錄>/css/*.css`，
BS5 檔案預設找 `vendor/bootstrap/css/bootstrap.css`。
頁面放在 `pages/` 或樣式放在 `assets/css/` 的專案跑起來**不會報錯，只會回報乾淨**——
這正是最貴的那種假陰性。跑之前先確認路徑對得上，或直接改腳本裡的 `readdirSync` 目標。

```bash
node .claude/skills/legacy-site-modernization/scripts/migrate-data-attrs.js <專案目錄> --dry
node .claude/skills/legacy-site-modernization/scripts/audit-bs4-classes.js <專案目錄> /tmp/bs4.css
node .claude/skills/legacy-site-modernization/scripts/audit-behavior-changes.js <專案目錄>
node .claude/skills/legacy-site-modernization/scripts/audit-bs5-component-vars.js <專案目錄> /tmp/bs4.css
```

## 產生 bs4-compat.css：從樣板刪減，不要從零寫

[`assets/bs4-compat.css`](../assets/bs4-compat.css) 是已在實戰專案驗證過的起手樣板，
數值取自 BS 4.6.2 原始碼。複製到專案的 `css/` 之後**用刪的，不要用加的**：

1. 依盤點結果**刪掉站上沒用到的段落**。
2. 標【專案專屬】的段落必須改寫或刪除（元件 `--bs-*` 變數要指回專案自己的 token）。
3. 最下方的方向性 utility 是完整對照表，只留盤點有命中的；間距類的階數與斷點變體要自行展開。
4. 補上稽核腳本抓到、樣板未涵蓋的風險點。
5. **逐條把數值換成從 `/tmp/bs4.css` 讀出來的實際值**——樣板寫的是 4.6.2 的預設值，
   專案若載入過客製主題檔（BS3 站的 `bootstrap-theme.css` 是典型），實際生效的值會不一樣。
   這個陷阱在 [04 的「要調回哪些值」](04-bootstrap-upgrade.md#要調回哪些值從專案自己的舊檔案讀不要背表) 有實例。

樣板每一段的註解都寫了「什麼情況下不需要補」，刪之前先讀——例如 `.card-body` 那段只在站上有
「`.card-body` 沒有 `.card` 祖先」的結構時才需要，`:root { scroll-behavior }` 只在有 JS 捲動動畫時才需要。

## 相容層要補什麼

以下是 BS5 移除／改名、實務上最常用到的。**數值一律以 `/tmp/bs4.css` 為準**，這裡只列對應關係：

| BS4 | BS5 | 備註 |
|---|---|---|
| `.form-row` | 移除（改 `.row.g-2`） | **最大跑版風險**，見下節 |
| `.form-group` | 移除（改 `.mb-3`） | 承擔的是 `margin-bottom` |
| `.form-inline` | 移除 | |
| `.input-group-append` / `.input-group-prepend` | 移除（不再需要包裹層） | |
| `.close` | `.btn-close` | 外觀改 SVG 背景，自帶 `×` 子元素的寫法會變空白 |
| `.ml-*` / `.mr-*` | `.ms-*` / `.me-*` | 邏輯屬性命名 |
| `.pl-*` / `.pr-*` | `.ps-*` / `.pe-*` | |
| `.text-left` / `.text-right` | `.text-start` / `.text-end` | |
| `.float-left` / `.float-right` | `.float-start` / `.float-end` | |
| `.no-gutters` | `.g-0` | |
| `.sr-only` | `.visually-hidden` | |
| `.badge-*` | `.bg-*` | |
| `.custom-select` | `.form-select` | |
| `.custom-control` 系列 | `.form-check` 系列 | |
| `.btn-block` | `.d-grid` 包裹 | |
| `.jumbotron`／`.media`／`.card-deck` | 移除 | |

完整清單見 [04 步驟 3](04-bootstrap-upgrade.md#步驟-3bs4--bs5-差異清單)；這裡只列相容層實際會補到的那些。

`.close` 那列常會連帶引發另一件事：舊站的關閉鈕多半是無 `href` 的 `<a>`，
一併改成 `<button>` 才有鍵盤操作。那是節點 4 的工作，見
[`03-a-to-button.md`](03-a-to-button.md)——**不要和 Bootstrap 升級混在同一筆 commit**。

## `.form-row` 是最大的跑版風險

BS4 的 `.form-row` gutter 是 **5px**，會覆蓋 `.row` 的 15px。`class="form-row row"` 這種寫法
在 BS4 下實際生效的是 5px；BS5 移除 `.form-row` 之後回到 `.row` 預設的 **1.5rem（24px）**，
間距瞬間變成快 5 倍，整頁表單都會鬆掉。

相容層要同時處理「單獨用」和「配 `.row` 用」兩種：

```css
.form-row {
  display: flex;
  flex-wrap: wrap;
  margin-right: -5px;
  margin-left: -5px;
}

.form-row > .col,
.form-row > [class*="col-"] {
  padding-right: 5px;
  padding-left: 5px;
}

/* 同時掛 .row 時，BS5 以 --bs-gutter-x 計算，一併對齊避免兩套邏輯打架 */
.form-row.row {
  --bs-gutter-x: 10px;
}
```

`--bs-gutter-x: 10px` 會讓 BS5 算出 margin `-5px`、padding `5px`，與 BS4 等效——
比硬寫 margin 更貼合框架機制。

## 版本號 query：改了沒反應的頭號原因

`vendor/bootstrap` 的檔案內容換掉了，但**引用網址的 query 版本號沒改**，
使用者的瀏覽器會繼續吃快取裡的舊版。症狀是「明明改了卻沒反應」，而且只發生在
回訪的使用者身上——開發者自己按 Ctrl+F5 反而看不到。

```html
<link rel="stylesheet" href="vendor/bootstrap/css/bootstrap.min.css?20260727">
```

新加入的 `bs4-compat.css` 同樣要帶版本號，之後每次改它都要更新。
走 CDN 的專案不會有這個問題（版本號在網址裡），但**要照節點 6 的流程重算 SRI**。

## 執行順序

0. **先清死碼**（節點 1、2）：零引用的 vendor 套件、無觸發者的 modal，獨立成一筆 commit。
1. 從版控備份舊版原始碼（`git show HEAD:...`）供核對。
2. 盤點：用量統計 ＋ 用到哪些 JS 元件 ＋ jQuery 相依套件（見 [`05-remove-jquery.md`](05-remove-jquery.md)）。
3. **先跑兩支行為稽核**（`audit-behavior-changes.js`、`audit-bs5-component-vars.js`），
   把行為陷阱的風險點先抓出來納入這次範圍——這步最容易被跳過，
   跳過的代價是後面逐頁踩、逐頁修。
4. 下載 BS5 dist 覆蓋 `vendor/bootstrap`（不含 `.map`，那是弱掃項目）。
5. 批次替換 `data-*` → `data-bs-*`（`migrate-data-attrs.js`），**HTML 與 CSS 一起**。
6. 產生 `bs4-compat.css`，插入各頁正確位置（Bootstrap 之後、站台樣式之前）。
7. 更新版本號 query。
8. 修 jQuery 外掛介面呼叫（`$('#m').modal('show')` → `bootstrap.Modal.getOrCreateInstance(el).show()`，
   見 [04 的 2-3](04-bootstrap-upgrade.md#2-3-js-呼叫改成-bs5-的原生-api)）。
9. `audit-bs4-classes.js` 與 `audit-behavior-changes.js` 各再跑一次。
10. **三層驗收**：照 [`07-visual-regression-verification.md`](07-visual-regression-verification.md) 走，
    不要因為稽核腳本回報乾淨就宣稱完成。

## 收尾：相容層是暫時的，要寫下退場路徑

相容層讓這次升級的風險降到最低，代價是專案多了一支「模擬舊框架」的檔案。
交付時要在檔案開頭寫清楚三件事，否則下一個維護的人不知道能不能刪：

1. **這支檔案的存在理由**是維持升級前的外觀，不是專案的設計。
2. **每一段對應哪一個 BS4 class**，之後某一區塊改成 BS5 原生寫法時，可以同步刪掉對應段落。
3. **退場方式是逐段刪，不是整支刪**——一次刪光等於把整站的版面一起改掉。

這也是為什麼盤點階段要堅持「只補站上真的用到的」：相容層越小，退場越容易。
