---
name: legacy-browser-notice
description: >
  在靜態切版專案加上「不支援舊版瀏覽器（IE）」的提示列：以 UA 判斷 IE、
  由共用 js 統一注入提示、CSS 寫成 IE 也不會整條作廢的雙重宣告，並處理破快取。
  涵蓋為什麼不能用條件註解、為什麼不逐頁寫 inline script、
  為什麼每個顏色都要先寫靜態值再寫 var()/color-mix、
  提示列的 z-index 與 iPhone 底部安全區、外站連結為何要另開視窗，
  以及改完之後哪些檔案要跟著更新版本號。
  觸發情境：使用者說「加舊版瀏覽器提示」「IE 提示」「不支援 IE」
  「提醒使用者換瀏覽器」「IE 版面整個爛掉」「舊版瀏覽器提示可以寫到 js 嗎」
  「這個提示要全站共用」，或升級 Bootstrap 5 後發現 IE 開起來是裸文字；
  也是 `legacy-site-modernization` skill 節點 11（加上不支援 IE 提示）的做法來源。
  不適用於：真的要讓網站在 IE 正常運作（那要 polyfill 或降版，本 skill 不處理）、
  React/Vue 專案的瀏覽器偵測、或針對特定 Chrome 版本的功能偵測。
---

# 舊版瀏覽器提示

給 Bootstrap 5 之後的靜態站：IE 不支援 CSS 自訂屬性（`var()`），BS5 幾乎所有元件的
顏色與間距都靠它，在 IE 開起來會是沒有樣式的裸文字，而且沒有可行的 polyfill。
與其假裝支援，不如明白告訴使用者換瀏覽器。

## 判斷條件：用 UA，不要用條件註解

`<!--[if IE]>` 從 IE10 起就失效，IE11 會直接忽略，所以只剩 UA 特徵字串可用：

```js
/MSIE |Trident\//.test(navigator.userAgent)
```

`MSIE ` 涵蓋 IE10 以下，`Trident/` 涵蓋 IE11（它的 UA 偽裝成 Gecko，只有 Trident 這個
渲染引擎字串留著）。UA sniffing 平常是壞習慣，但這裡沒有可靠的功能偵測替代：
要偵測的不是單一 API，而是「整套 CSS 變數不支援」這件事。

## 放哪裡：共用 js，不要逐頁 inline

一站幾十頁，inline script 等於同一段程式碼複製幾十份，日後改文案要逐頁改。
放進專案既有的共用 js（通常是 `theme.js` 之類全頁面都會載入的那支）：

```js
/* 舊版瀏覽器提示：BS5 大量使用 CSS 自訂屬性，IE 無法正常顯示且無可行的 polyfill */
(function () {
    // IE11 會忽略條件註解，只能靠 UA 特徵字串判斷
    if (!/MSIE |Trident\//.test(navigator.userAgent)) return;

    function show() {
        document.body.insertAdjacentHTML('afterbegin',
            '<div class="legacy-browser-notice">' +
            '為提供更佳的瀏覽體驗，本站不支援 IE 瀏覽器，建議使用 ' +
            '<a href="https://www.microsoft.com/zh-tw/edge" class="notice-link" target="_blank" rel="noopener">Microsoft Edge</a>、' +
            'Chrome 或 Firefox 開啟，謝謝。' +
            '</div>');
    }

    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show);
})();
```

**警語文案沒有固定版本，以上是通用版預設文案**：「為提供更佳的瀏覽體驗，本站不支援
IE 瀏覽器，建議使用 Microsoft Edge、Chrome 或 Firefox 開啟，謝謝。」電商類站台（有結帳
流程）常見會改強調交易安全，例如「為保障交易安全與流暢的購物體驗，本站不支援 IE 瀏覽器，
建議您改用 Microsoft Edge、Chrome 或 Firefox 開啟網頁，謝謝。」兩者擇一套用即可，套用前
跟使用者確認要用哪一版措辭。

幾個刻意的選擇：

- **非 IE 直接 return**：包在 IIFE 裡先做這一判斷，現代瀏覽器的成本趨近於零，
  不會為了一個沒人看得到的提示多跑 DOM 操作。
- **`document.body` 判斷**：共用 js 通常掛在 `</body>` 前，body 已存在可直接插入；
  但日後若有人把它移到 `<head>`，沒有這道 fallback 就會 silent fail。
- **字串串接而非樣板字面值**：這段要在 IE 上執行，樣板字面值（`` ` ``）與箭頭函式
  IE11 是在**解析階段**就 SyntaxError，會讓整支 js 陣亡、連提示列自己都跑不出來。
  `const`/`let` 則沒問題，IE11 支援（有作用域 bug，但不影響解析）。

  所以放進共用 js 之前，先確認那支檔案裡沒有箭頭函式和樣板字面值：

  ```bash
  grep -nE '=>|`' js/theme.js
  ```

  有輸出就把提示列抽成獨立的 ES5 小 js 單獨載入；沒有就可以直接放進去，
  不必為此多開一支檔案與改動所有頁面的 `<script>`。
- **`target="_blank" rel="noopener"`**：使用者可能正在結帳流程中，同頁跳轉到
  微軟官網等於把人踢出網站。`rel="noopener"` IE 不認得但無害。

## CSS：每個顏色先寫靜態值，再寫 var()／color-mix

這是最容易踩的坑。IE 遇到看不懂的屬性值會**整條宣告作廢**，
所以只寫 `color: var(--x)` 的話，在 IE 上這個顏色等於沒設定——
提示列會變成沒有背景、沒有邊框的一段裸文字，正好是它最需要被看見的時候。

解法是同一個屬性寫兩次，靜態值在前、變數在後。現代瀏覽器後者覆蓋前者，
IE 丟掉後者留下前者：

下面這段的 `--p-focus-color` 是**佔位符，不是通用的變數名**——它來自寫出這段樣式的那個專案。
套用時換成你專案自己的警示色／主色變數（例如 `--bs-danger`、`--brand-warning`），
並把靜態值一併換成該變數實際算出來的顏色。照抄不換的話不會有錯誤訊息，
只會得到「靜態值生效、`var()` 那幾行全部無效」的結果，現代瀏覽器上看起來就是顏色不對。

```scss
/* 僅 IE 觸發。每個顏色都先寫靜態值再寫 color-mix：
   IE 讀不懂 var()/color-mix 會整條作廢，沒有 fallback 就會變成裸文字。
   --p-focus-color 是佔位符，換成專案自己的警示色變數。 */
.legacy-browser-notice {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1030; /* 依專案實際堆疊調整，見下方 */
    padding: 0.75rem 1rem;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    text-align: center;
    line-height: 1.6;
    background-color: #fee8e7;
    background-color: color-mix(in srgb, var(--p-focus-color) 12%, #fff);
    border-top: 1px solid #f44336;
    border-top-color: var(--p-focus-color);
    color: #b73228;
    color: color-mix(in srgb, var(--p-focus-color) 75%, #000);
}

.legacy-browser-notice a {
    color: #f44336;
    color: var(--p-focus-color);
    font-weight: 500;
    text-decoration: underline;
}
```

靜態值請用「該變數在預設主題下算出來的實際色」，不要隨手填一個近似色——
現代瀏覽器上這行雖然會被覆蓋，但它同時也是主題變數失效時的最後防線。

其他細節：

- **z-index**：不要憑感覺填。先看專案裡已存在的固定元素（回頂端按鈕、
  吸底購買列、modal），提示列要壓在它們之上、但**低於 modal**
  （Bootstrap 的 `.modal` 是 1055、backdrop 1050），否則使用者開了 modal
  還會被提示列擋住。`grep -rn "z-index" scss/` 一次看清楚再決定。
- **`env(safe-area-inset-bottom)`**：`position: fixed; bottom: 0` 在 iPhone 上
  會被底部的 home indicator 蓋掉一截。IE 不認 `env()`，
  但這條規則是為現代瀏覽器留的（提示列本身雖只在 IE 顯示，
  同一段樣式若日後改為提示其他舊瀏覽器仍會用到）。
- **`position: fixed` 而非 `sticky`**：提示列插在 body 最前面，
  用 fixed 才不會把整頁內容往下推、破壞既有版面。

## 收尾：破快取

改完之後，被改到的檔案要讓瀏覽器重新抓：

1. **共用 js**：全站頁面的 `<script src="js/theme.js?20260818a">` 版本號要一起更新。
   ```bash
   # *.html 只涵蓋當前目錄那一層；頁面散在子目錄的站要改成下面這行
   perl -pi -e 's{js/theme\.js\?[^"]*}{js/theme.js?20260818a}g' *.html
   find . -name '*.html' -not -path './vendor/*' -exec perl -pi -e 's{js/theme\.js\?[^"]*}{js/theme.js?20260818a}g' {} +
   ```
   改完用 `grep -rn 'theme\.js?' --include='*.html' .` 看一次，版本號應該全站一致；
   還有舊值代表那幾頁沒被上面的路徑涵蓋到。
2. **CSS**：新增了 `.legacy-browser-notice` 樣式，編譯產物也變了，
   同樣更新各頁的 `css/main.min.css?` 版本號。
3. **include 片段**：如果提示列是寫在 `page-header.html` 這類被 fetch 進來的片段裡
   （本 skill 不建議這樣做，但若專案已如此），要改的是 **include.js 內部的
   `VERSION` 常數**——那個值才是掛在片段 URL 上的參數；
   各頁 `include.js?` 的版本號只管 include.js 自己，兩者都要動。

版本號格式跟隨專案既有慣例（常見是 `YYYYMMDD` + 當日流水字母）。

## 驗收

沒有 IE 可測時，用瀏覽器 DevTools 的「Network conditions／網路狀況」面板暫時把
User agent 換成 `Internet Explorer 8` 之類含 `MSIE`／`Trident` 的字串，重新整理頁面看
提示列有沒有正確出現；確認完記得改回瀏覽器預設值。另外檢查：

```bash
# 1. 確認沒有殘留的逐頁 inline script，應該沒有輸出。
#    用 --include 而不是 *.html：後者只掃當前目錄那一層，子目錄裡的頁面會被漏掉。
grep -rln "legacy-browser-notice" --include='*.html' .

# 2. 對照組：先用一個一定會命中的字串跑一次，確認上面那道指令的路徑與語法真的抓得到東西。
#    路徑打錯時 grep 不會報錯，只會安靜地回報 0 筆——那跟「乾淨」長得一模一樣。
grep -rln "<html" --include='*.html' . | head -3

# 3. 確認提示列的每個顏色都有靜態 fallback（人工看一眼）。
#    樣式檔的位置依專案結構調整，這裡假設 SCSS 都放在 scss/ 底下。
grep -rn -A30 "legacy-browser-notice" --include='*.scss' scss/
```

第 1 道應該**沒有輸出**——提示列的 HTML 只該由共用 js 產生。但這個結論只有在第 2 道
真的列出檔案時才成立：兩道用的是同一組路徑與參數，第 2 道有輸出才證明第 1 道的 0 筆
是「真的沒有」，而不是指令本身沒掃到任何檔案。
