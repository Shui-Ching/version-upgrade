# 節點 4：按鈕語意改 `<button>`

把切版專案裡「當按鈕用的 `<a>` 與 `<span>`」改成語意正確的 `<button>`，並以 CSS 補回外觀、不動既有版面。

**為什麼排在節點 3 之後**：共用區（header/footer）抽取完成後，共用元件裡的按鈕只要改一次，不用在十幾支 HTML 裡各改一遍。

**為什麼排在節點 5 之前**：這個節點會大量動到 CSS 選擇器，先改完再轉 SCSS，SCSS 只需要寫一次。

## 判準：改的是「動作」，不是「導航」

| 元素行為 | 正解 |
|---|---|
| 開 modal、展開手風琴、切 tab、送出表單、刪除項目、複製連結、切換密碼顯示 | `<button>` |
| 登出（會清 session，是動作不是導航） | `<button>` |
| 換頁、跳錨點、開新分頁看文件 | 維持 `<a href>` |
| 行內文字連結（服務條款、隱私權政策） | 維持 `<a href>` |

實務上要改的多半長這樣——`href` 是假的，或根本沒有 `href`：

```bash
# 假 href 的 <a>（javascript:; / javascript:void(0) / #）
grep -rEon '<a[[:space:]][^>]*>' --include='*.html' . | grep -E 'href="(javascript:;?|javascript:void\(0\);?|#)"'

# 完全沒有 href、卻掛了 data-* 或 onclick 的 <a>
grep -rEon '<a[[:space:]][^>]*>' --include='*.html' . | grep -E 'data-|onclick' | grep -v 'href='

# 當按鈕用的 <span>
grep -rEon '<span[[:space:]][^>]*>' --include='*.html' . | grep -E 'onclick|data-toggle|data-bs-toggle'
```

沒有 `href` 的 `<a>` **不可聚焦、鍵盤 Tab 不到、Enter／Space 也不會觸發**，等於功能只對滑鼠開放；要補 `tabindex="0"` 加鍵盤事件監聽才勉強堪用，而 `<button>` 原生就有這些行為。`<span>` 更是連 role 都沒有。這是這個節點真正的價值——不是語意好看，是無障礙，外觀完全不變。

## 判定「維持 `<a>`」的同時，`target="_blank"` 一律補 `rel="noopener noreferrer"`

這個節點是全站唯一一次把每個 `<a>` 都逐一看過的機會，被判定為「維持 `<a href>`」的那批不要看完就放過——順手把開新分頁的連結補上 `rel`，之後不會再有成本這麼低的時機。這條屬於資安把關範疇，不是可選的加分項。

兩個值各自擋掉一件事：

- **`noopener`**：沒有它，被開啟的新分頁可以透過 `window.opener` 反向操作原分頁。最典型的攻擊是把原分頁導去釣魚頁——使用者切回原本那個分頁時，網址列看起來沒變過，卻已經是假的登入或捐款頁面。近幾年的桌機瀏覽器多數已經對 `target="_blank"` 隱含套用 `noopener`，但舊版瀏覽器與各家 App 內建的 WebView 不保證跟上，而且這是「靠環境幫忙」不是「程式碼自己安全」，明寫的成本是零。
- **`noreferrer`**：連 `Referer` 標頭都不送，對方站台就不知道使用者是從我方哪一頁點過去的。

兩個一起寫的理由不是慣例，而是讓意圖留在程式碼裡：只寫 `noreferrer` 在現代瀏覽器同樣擋得住 `window.opener`，但下一個維護的人可能為了讓對方站台看得到來源而把它拿掉，連帶把防護一起拿掉，而且拿掉後不會有任何錯誤訊息。

兩個例外情況：

- **站內同域連結開新分頁**：`noopener` 照樣要加（風險低但沒有成本）；`noreferrer` 會讓自家分析工具看不到站內來源路徑，如果有在追這個數據，只寫 `noopener` 即可。
- **原本已經有 `rel` 值**（例如 `rel="nofollow"`）：用空白串接成 `rel="nofollow noopener noreferrer"`，不要整個覆寫掉原本的值。

JS 動態開新視窗的寫法同樣要處理：`window.open(url, '_blank')` 要改成 `window.open(url, '_blank', 'noopener')`，否則回傳的 window 物件一樣握有 `opener` 參考。執行節點 4 的時候這類程式碼多半還內聯在 HTML 裡（節點 5 才會搬進 `.js`），所以掃描要同時掃兩種副檔名。

```bash
# 驗收 1：開新分頁卻完全沒有 rel
grep -rEon '<a[[:space:]][^>]*>' --include='*.html' . | grep '_blank' | grep -v 'rel='

# 驗收 2：有 rel 但裡面沒有 noopener／noreferrer（例如只寫了 nofollow）
grep -rEon '<a[[:space:]][^>]*>' --include='*.html' . | grep '_blank' | grep 'rel=' | grep -vE 'noopener|noreferrer'

# 驗收 3：window.open 少了第三參數（節點 4 階段內聯腳本還在 HTML 裡，兩種副檔名都要掃）
grep -rEn 'window\.open\([^)]*_blank[^)]*\)' --include='*.html' --include='*.js' . | grep -v 'noopener'
```

## `type` 必須逐顆判斷，不可一律 `submit`，也不可一律 `button`

`<button>` 在 `<form>` 內的預設 `type` 就是 `submit`——**沒寫 `type` 等於誤送表單**，這是這類重構最常見的回歸災情。但反過來一律寫 `type="button"` 也會壞事：真正的送出鈕被改成 `button` 之後，表單就送不出去了。

| 情況 | type | 說明 |
|---|---|---|
| 真的要送出表單（登入、確認修改、送出註冊） | `submit` | |
| 走 AJAX 的動作（發送驗證碼、加入購物車） | `button` | 設 submit 會連整張表單一起送出 |
| 開 modal／展開／切換 | `button` | |
| 切版稿的 demo 跳轉 | `button` + `onclick="location.href='…'"` | 用 submit 會重載頁面導致跳轉失效 |

```bash
# 驗收：所有 button 都要標 type
grep -rEon '<button[^>]*>' --include='*.html' . | grep -v 'type='
```

節點 5 會把 `onclick` 這類內聯事件屬性搬進 `.js` 用 `addEventListener` 綁定，這裡先寫在 HTML 上沒關係，但要記得列進待辦，不要以為節點 4 做完就結束了。

## 只有 icon 的按鈕一律補 `aria-label`

按鈕的**可及名稱**（accessible name）是螢幕閱讀器唸出來的那串字，計算順序是
`aria-labelledby` → `aria-label` → 元素內的文字內容。分享、移除、密碼眼睛這類只有 icon 的按鈕三者皆空，讀屏唸出來是「按鈕」，或更糟——icon font 靠 `::before` 的 `content: "e996"` 塞私用區字元顯示，瀏覽器會把生成內容送進無障礙樹，讀屏可能唸出無意義的字碼。

所以要補的是兩件事，缺一不可：

```html
<button type="button" class="cart-remove" aria-label="移除商品">
  <i class="fa fa-times" aria-hidden="true"></i>
</button>
```

1. `<button>` 上補 `aria-label`。
2. 裡面的 `<i>` 補 `aria-hidden="true"`。名稱既然已由 `aria-label` 決定（名稱計算不會再往子節點看），icon 就純屬裝飾，該從無障礙樹隱藏。這一項常被當成可有可無，實際上它才是擋掉唸出亂碼的那一半。

**`aria-hidden` 絕不能加在 `<button>` 自己身上**——那會讓整顆按鈕從無障礙樹消失，比沒名稱更糟。舊切版稿常見把 `aria-hidden="true"` 寫在當按鈕用的 `<a>` 上（原意是想隱藏裡面的裝飾 icon，卻寫錯了層級），改標籤時要一併移除。

### 命名規則

- **講這顆按鈕會做什麼，不是它長什麼樣**。「移除商品」不是「叉叉」「垃圾桶」。
- **短，且在該頁面唯一可辨識**。讀屏使用者常用「列出所有按鈕」瀏覽，一頁出現 12 個「移除」，不如「移除商品」／「移除優惠碼」分得清楚。
- **不要寫「按鈕」兩個字**。role 本身就會唸出來，否則變成「移除商品按鈕按鈕」。
- **同一個功能全站用同一個說法**。同動作在不同頁換講法，等於讓使用者多學一次。

### 哪些不用補

補過頭會讓讀屏更吵，動手前先確認不是這幾類：

- **已有可見文字**——文字本身就是名稱。再加 `aria-label` 會蓋掉它，造成語音與畫面不一致（語音操作的使用者唸畫面上的字會叫不動按鈕）。
- **有 `.sr-only` / `.visually-hidden` 的隱藏文字**，或已有 `aria-labelledby` / `title`。
- **modal 關閉鈕**——Bootstrap 樣板多半已經帶了 `aria-label="Close"`，先掃再說，不要無條件覆寫。
- **純裝飾、不可互動的元素**——那不是按鈕，該確認的是它沒有 `role="button"`、沒有 `tabindex`，而不是給它名稱。
- **有實際文字或圖片 `alt` 的導航 `<a>`**。

判斷「有沒有名稱」時，空字串的 `aria-label=""` 視同沒有（無障礙掃描器也是這樣算），`<img alt="…">` 與 `.sr-only` 隱藏文字則視同有。

### 切換型按鈕的名稱是動態的

密碼眼睛、收合展開、加入／移除收藏這類按鈕，**狀態變了名稱就要跟著變**，否則使用者聽到的永遠是「顯示密碼」，即使密碼已經顯示中：

```js
btn.setAttribute('aria-label', isText ? '隱藏密碼' : '顯示密碼');
```

切版稿只能給**初始狀態**的名稱。真正的切換邏輯常在工程端——正式機是後端輸出的那段 JS 在切 `input` 的 `type`，切版稿裡根本找不到。動手前先確認那段邏輯在哪一端，不要因為切版稿的 js 裡沒有就斷定「功能不存在」；確認在工程端的話，**要把上面那行明確列進交接事項**，否則 label 會永遠停在初始值，而且切版稿上測不出來。

若專案允許動 HTML 結構，`aria-pressed` 比動態 label 更精準（名稱固定為功能名，狀態交給 `aria-pressed`），但那需要工程端一起維護狀態值，通常不是切版端單方面能決定的。

### 驗收要用腳本，`grep` 不夠

「按鈕內沒有文字」不是單行正則判得出來的：內容可能跨行、可能包著 `<span>`、可能只有 `&nbsp;`。要先抓出整顆 button、剝掉標籤、還原實體、trim，才知道是不是真的空的。用同層的 [`../scripts/audit-aria-label.js`](../scripts/audit-aria-label.js)：

```bash
node .claude/skills/legacy-site-modernization/scripts/audit-aria-label.js .        # 只列出缺名稱的按鈕
node .claude/skills/legacy-site-modernization/scripts/audit-aria-label.js . --fix  # 依規則表批次補上
```

它做四件事：找出無可及名稱的 `<button>`、依規則表對照命名、把該顆按鈕裡的 `<i>` 補上 `aria-hidden="true"`、**比對不到規則的一律跳過並列出來讓人判斷**。另外會回報「疑似當按鈕用的 `<a>`／`<span>`」但**不修**——那些要先照本節點改標籤，直接在錯的標籤上補 label 只是掩蓋問題。

規則表在 [`../scripts/label-rules.json`](../scripts/label-rules.json)，形式是「class 或 icon class → label」，比對順序是元素自身 class 優先於內部 `<i>` 的 class。**接新專案第一件事就是改這張表**，裡面現有的值來自另一個實際專案（購物車、優惠碼、數量增減、密碼眼睛），不保證適用。

腳本有三個已知界限，會落在人工那一欄：

- 只處理它「這次補上名稱」的那幾顆按鈕的 `<i>`。**原本就有 `aria-label` 的按鈕，裡面的 `<i>` 不會被補 `aria-hidden`**，那批要另外掃。
- **不會移除誤寫在 `<button>`／`<a>` 本體上的 `aria-hidden="true"`**，那要人工拿掉。
- 猜不出名稱時寧可回報也不亂填——這是刻意的。生出 12 個「按鈕」「操作」這種等於沒說的 label，比留空更難被發現。

跨檢查可以用 Lighthouse 或 axe 的 `button-name` 規則，但它們只查靜態 HTML，動態 label 那一項只有人工測得出來。

## CSS 一律「並列」，不要把 `a` 改寫成 `button`

這是本節點最重要的一條。既有選擇器往往**同時服務改與不改的兩批元素**：

```css
/* ✗ 取代：footer 的官方社群帳號（仍是 <a>）會失去樣式 */
.social-icons li button { ... }

/* ✓ 並列 */
.social-icons li a,
.social-icons li button { ... }
```

判斷方式是先確認該選擇器目前命中哪些地方，只要有任何一處要保留 `<a>`，就必須並列。分享按鈕、下拉選單、購物車項目這幾類幾乎都是混用的。

**把標籤名稱整個拿掉也是一種解法，但前提是「還留著別的鑑別條件」**：

```css
/* ✓ 安全：屬性選擇器本身就足以鑑別，拿掉 a 才能同時命中 button */
.faq-item [data-bs-toggle='collapse'] { ... }

/* ✗ 危險：拿掉 a 之後會命中 li 本身與裡面所有元素 */
.social-icons li { ... }
```

所以規則是：**要嘛並列 `a, button`，要嘛確認拿掉標籤後選擇器仍有 class 或屬性在鑑別**。不要為了少打幾個字就把鑑別條件一起刪掉。

## `button` 需要補的 reset

`<button>` 不是 `<a>`，瀏覽器預設樣式差很多。以下是實際踩過的：

```css
button.那個 class {
  font-family: inherit;   /* button 不繼承字體，會變成系統預設字型 */
  text-align: left;       /* button 預設 center，靠左的選單項目會跑掉 */
  background: none;
  border: 0;
  padding: 0;             /* 見下方「小尺寸圖示鈕」 */
  cursor: pointer;
}
```

四個容易漏的細節：

- **`display: flex` 的 button 不會自動撐滿父寬**。原本 `<a>` 是 block 佔滿一行，改 button 後要補 `width: 100%`（手風琴標題最常見）。
- **小尺寸圖示鈕會被預設 padding 撐爆**。像 14×14 的移除鈕，沒清 `padding` / `border` 就會撐破外框線。**絕對定位的圖示鈕**（數量增減鈕那種 `position: absolute` ＋固定 `width`／`height`）還要多清 `background`，否則會冒出瀏覽器預設的灰底。這三行直接加進並列後的基礎規則即可，對還留著的 `<a>`／`<span>` 無害。
- **`inline-flex` 會吃掉 icon 與文字之間的空白節點**，原本靠 HTML 空白撐開的間距要改用 `gap`。
- **`vertical-align`**：button 預設基線與 `<a>` 不同，行內排列的按鈕可能上下偏移，必要時補 `line-height: 1` + `vertical-align: baseline`。

這批 reset 會在節點 5 轉 SCSS 時整理進對應的 partial，兩個節點可以在同一輪一起看。

## 權重陷阱：取值要擴充基礎規則本身，不能用 `inherit`

改完後常見「字級或顏色跑掉」，原因是那個值來自更上層的基礎規則：

```css
/* 基礎規則：手機選單所有連結 */
header .header-mobile__navbar > ul li a { font-size: 17px; color: #333; }
```

`<a>` 改成 `<button>` 後就吃不到這條。此時**必須擴充這條規則本身**：

```css
header .header-mobile__navbar > ul li a,
header .header-mobile__navbar > ul li button { font-size: 17px; color: #333; }
```

**不要改用 `font-size: inherit`** —— 那會取到 `li` 的值，而不是設計稿指定的 17px，看起來像是「差不多」但其實錯了。

同理，不要靠 `!important` 解決權重問題；既有選擇器多半已有足夠權重，並列就夠了。

## 與 Bootstrap 升級（節點 7）同時進行時

- **BS5 的 `.btn` 有自己的 `padding` / `border-radius` / `--bs-btn-*`**。專案自訂的 `.btn` 原本套在 `<a>` 上不受影響，改成 `<button>` 後會同時吃到框架樣式，按鈕尺寸可能跑掉，要實測。
- `data-toggle` → `data-bs-toggle` 的全站替換（含 CSS 屬性選擇器）屬於節點 7，做法見 `02-modernize.md` 的節點 7，這裡不重複。但兩個節點如果同一輪做，記得屬性選擇器裡的 `a` 要一起拿掉才能同時命中 button（見上方「並列」一節）。
- 若某個 modal 是用 JS 原生 API 開的，改成 button 的觸發元素**不要**又加 `data-bs-toggle`，會開兩次。

## 完工檢查

- [ ] 每顆 `<button>` 都有 `type`，且 AJAX 動作不是 `submit`、真正的送出鈕不是 `button`
- [ ] 所有 `target="_blank"` 都帶 `rel="noopener noreferrer"`（站內連結至少帶 `noopener`），JS 的 `window.open` 也帶了 `'noopener'`
- [ ] 只有 icon 的按鈕都有 `aria-label`（用 `scripts/audit-aria-label.js` 掃到 0 處，不是用 grep），裡面的 `<i>` 都有 `aria-hidden="true"`，且 `<button>` 自己**沒有**
- [ ] 切換型按鈕（密碼眼睛、收藏）切換後名稱有跟著變；若切換邏輯在工程端，已列入交接事項
- [ ] 鍵盤 Tab 可聚焦、`Enter`／`Space` 可觸發，modal 可用 `Esc` 關閉
- [ ] 桌機與手機各斷點的按鈕外觀與改動前一致（字體、字級、對齊、尺寸）
- [ ] 沒有任何 `!important` 是本次新加的
- [ ] 保留 `<a>` 的區塊（footer 社群、行內文字連結）樣式未受影響

## 移交提醒

`onclick="location.href='…'"` 這種 demo 跳轉，以及未綁動作的確認鈕，交付時要明確列給工程師，否則會被當成已完成的功能。

**改動元素標籤會讓工程端的事件綁定失效，這是本節點最容易漏講的一項。** `.quantity span` 改成 `.quantity button` 之後，後端那支 JS 的 selector 不改就完全沒反應——而 CSS 因為採「並列」所以外觀完全正常，**壞掉的只有功能**，切版稿上還測不出來（切版稿本來就沒有那段邏輯）。凡是動到標籤的，commit 訊息都要開一段「工程端配合事項」：

```
工程端配合事項：
- 數量增減的事件綁定選擇器由 .quantity span 改為 .quantity button
- 密碼顯示切換時請一併更新 aria-label（顯示密碼／隱藏密碼）：
  btn.setAttribute('aria-label', isText ? '隱藏密碼' : '顯示密碼')
- 後端輸出的 icon-only 按鈕請比照補上 aria-label（規則見 scripts/label-rules.json）
```

這幾條最後會進收尾的交付報告，做法見 `commit-delivery-report` skill。
