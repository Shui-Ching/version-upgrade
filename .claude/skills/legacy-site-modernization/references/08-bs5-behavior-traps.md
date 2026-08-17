# 節點 7 附章：同名 class 的行為改變（元件層級）

這一章收的是**最難查的一類升級風險：class 名稱兩版都存在，靜態掃描一定通過，但預設值改了**。
`04-bootstrap-upgrade.md` 步驟 5-1 的 grep 只驗證「舊 class 有沒有殘留」，對這一類完全無效；
截圖比對看得到後果，但看不出原因，容易繞遠路去猜是自己哪裡改壞了。

**與 `04-bootstrap-upgrade.md` 的 4-7 的分工**：4-7 是**格線與容器層級**的結構性差異
（`.container` clearfix、`.row` 改 flex、欄位等高與 `width: 100%`），後果是整頁位移；
本章是**元件層級**的預設值改變，後果通常侷限在某一類元件，但同樣掃描不到。
兩章要一起查，順序上先 4-7（整頁的先排除）再本章（元件的再逐項看）。

**起點適用範圍**：第 1～7 項 BS3、BS4 起點都會遇到，第 8 項只有 BS4 起點適用，第 9 項主要是 BS3 起點才會踩到（BS4 的元件選擇器已經跟 BS5 走同一套多層 class 疊加的寫法，特異度落差通常不大）。

## 目錄

- [先講一個判準：這一項該修在哪裡](#先講一個判準這一項該修在哪裡)
- [1. `.form-control` 移除固定 height](#1-form-control-移除固定-height)
- [2. `.col-*` 不再是定位基準](#2-col--不再是定位基準)
- [3. 新增 `textarea.form-control` 的 min-height](#3-新增-textareaform-control-的-min-height)
- [4. 元件改用 `--bs-*` 變數，蓋掉原本靠繼承的樣式](#4-元件改用---bs--變數蓋掉原本靠繼承的樣式)
- [5. `.form-control` 新增 `appearance: none`，select 箭頭消失](#5-form-control-新增-appearance-noneselect-箭頭消失)
- [6. Reboot 新增 `scroll-behavior: smooth`](#6-reboot-新增-scroll-behavior-smooth)
- [7. `.card-body` 的 padding 可能整個歸零](#7-card-body-的-padding-可能整個歸零)
- [8. `:root` 變數加上 `--bs-` 前綴（僅 BS4 起點）](#8-root-變數加上---bs--前綴僅-bs4-起點)
- [9. 舊專案的覆寫規則被 BS5 官方元件選擇器的特異度反超](#9-舊專案的覆寫規則被-bs5-官方元件選擇器的特異度反超)
- [本章 grep 指令的寫法限制（實測）](#本章-grep-指令的寫法限制實測)
- [查這一批的順序](#查這一批的順序)

---

## 先講一個判準：這一項該修在哪裡

底下每一項都要決定「補在 parity 覆寫層」還是「改專案自己的 CSS」，選錯的話症狀不會消失。判準只有一句：

> **值是框架預設值 → 進 parity 覆寫層；值是專案設計值 → 留在專案自己的 CSS，把選擇器補到同權重。**

理由要接著 [`04-bootstrap-upgrade.md` 的「覆寫層要放在層疊順序的哪個位置」](04-bootstrap-upgrade.md#覆寫層要放在層疊順序的哪個位置最容易做錯的一步)一起看：
覆寫層排在專案樣式**之前**（它在模擬舊版框架的位置），所以覆寫層贏不過專案自己的規則，
也不應該贏——把專案的設計值塞進覆寫層，等於讓覆寫層去跟專案自己打架，結果是兩邊都不對。

那一節結尾說的「覆寫層也要直接寫實際屬性、用對等的權重」講的是**另一半情況**：
要還原的是框架預設值，但新框架的 `--bs-*` 變數餵不進去（被專案的同權重規則蓋掉），
所以覆寫層要放棄變數、直接寫屬性。兩句話不衝突，分界就是上面那條判準——
**先問這個值屬於誰**，再問用什麼手段寫。

底下第 1 項與第 3 項是這條判準的正反兩個例子，可以對照著看。

## 1. `.form-control` 移除固定 height

| | |
|---|---|
| BS3／BS4 | `.form-control` 有寫死的 `height`（BS3 走 `@input-height-base`，BS4 是 `calc()` 算式）→ **從專案手上的舊檔讀出實際值** |
| BS5 | 沒有 `height`，改由 `padding` + `line-height` 撐出 |

單獨看沒事。**風險在於它與專案既有 CSS 的交互作用**：只要專案自己動過表單的 padding
（`input, .form-control { padding: 0 5px }` 這種很常見），BS5 下高度就只剩行高加邊框，
全站 input／select 整批縮水，欄位內絕對定位的 icon 也會跟著對不齊。

```bash
grep -rEn '(input|\.form-control)[^{}]*\{[^}]*padding' --include='*.css' --include='*.scss' .
```

`height` 是框架預設值，依判準**補在覆寫層**（數值從舊檔讀）。注意舊版通常另有一條
讓 `textarea` 不吃固定高度的規則，補的時候要一起帶上，否則多行輸入框會被壓成單行高度。

## 2. `.col-*` 不再是定位基準

BS3、BS4 的每個 `.col-*` 都帶 `position: relative`；BS5 的 `.row > *` **沒有**。

站上只要有「欄位內用 `position: absolute` 疊放元素」——輸入框內的 icon、角落的錯誤訊息、
卡片角標——定位基準就會往上找到更外層的祖先，元素直接飛到別的地方。

```bash
grep -rEn 'col-[a-z0-9-]*[^{}]*\{[^}]*position:[[:space:]]*absolute' --include='*.css' --include='*.scss' .
```

覆寫層補回：

```scss
.row > * { position: relative; }
```

**限定 `.row` 的直接子元素，不要寫 `[class*='col-']`**——那會誤傷 `.col-form-label`
這類名字裡有 `col-` 但不是格線欄位的 class。

BS4 起點另有 `.form-row`（BS5 移除），要多補一組 `.form-row > *`；BS3 沒有這個 class，可省。

**與 4-7 的相依**：4-7 若已把 `.row` 改回 `display: block` 加浮動，這一條仍然需要——
兩者處理的是不同屬性，不會互相取代。

## 3. 新增 `textarea.form-control` 的 min-height

BS5 有 `textarea.form-control { min-height: ... }`，BS3、BS4 都沒有這條。

問題不在數值，在**權重**：專案常寫 `textarea { min-height: 100px }`（權重 0,0,1），
被 BS5 的 class＋元素選擇器（0,1,1）壓過，多行輸入框塌成一行高。

**這裡不能靠覆寫層把它改成 `auto` 或 `0`**——覆寫層排在專案樣式之前，
把它調成 `auto` 只會讓覆寫層自己贏過專案的 100px，結果一樣矮。
100px 是**專案的設計值**，依判準要留在專案自己的 CSS，把選擇器補到同權重：

```scss
textarea,
textarea.form-control { min-height: 100px; }   // 改專案自己的 CSS，不是改覆寫層
```

## 4. 元件改用 `--bs-*` 變數，蓋掉原本靠繼承的樣式

BS 5.3 把大量元件改成變數驅動（`--bs-modal-color`、`--bs-card-color`、`--bs-table-color`、
`--bs-accordion-*`、`--bs-pagination-*`…）。

關鍵在於：**舊版這些元件多半沒有指定 `color`／`background`，文字色是從外層繼承下來的**
（也就是專案自訂的字色）。BS5 給了變數預設值，等於憑空多出一層宣告，把繼承來的樣式蓋掉。

症狀是「某個元件的文字或背景顏色跟以前不一樣」，但那個元件的 class 完全沒動過。

注意這與 `04-bootstrap-upgrade.md` 覆寫層那節講的是**相反方向**：那節講的是
「設了 `--bs-*` 變數卻被專案的同權重規則蓋掉、餵不進去」；這裡是
「沒人去設 `--bs-*` 變數，它的預設值反而蓋掉了原本的繼承」。兩種都要查。

修法是**覆寫變數，不要硬寫 `.modal-content { color: ... }`**——變數是 BS5 建議的施力點，
不必跟框架比選擇器權重：

```scss
.modal { --bs-modal-color: var(--專案字色 token); }
.card  { --bs-card-color:  var(--專案字色 token); }
```

**先過濾再修，不要整批加覆蓋。** 只有同時滿足兩個條件的元件才會真的變色：
舊版的 CSS 對該選擇器**沒有**指定該屬性，而且專案自己也**沒有**設過該元件的顏色。
專案若已大量自訂該元件（例如 `.table` 有上百處覆寫），BS5 的變數預設值會被蓋過去，
屬於低風險，盲目補覆蓋反而會改壞原本正常的地方。

人工過濾的做法：先列出站上實際用到的 BS 元件 class，再逐個回舊版 CSS 檔查該選擇器有沒有設色。

```bash
# 站上用到哪些元件（再逐個回舊檔查）
grep -rEoh 'class="[^"]*"' --include='*.html' . \
  | grep -Eo '(modal|card|table|accordion|pagination|list-group|dropdown|nav|breadcrumb)(-[a-z]+)*' \
  | sort -u
```

## 5. `.form-control` 新增 `appearance: none`，select 箭頭消失

舊版的 `.form-control` 沒有 `appearance`，所以 `<select class="form-control">`
用的是瀏覽器原生的下拉箭頭。BS5 加了 `appearance: none`，因為它預期 select 改掛
`.form-select`（自帶 SVG 箭頭）——舊寫法就變成一個看不出是下拉選單的空框。

```bash
grep -rEn '<select[^>]*form-control' --include='*.html' .
```

覆寫層只針對 select 還原：

```scss
select.form-control {
	-webkit-appearance: auto;
	-moz-appearance: auto;
	appearance: auto;
}
```

**不要全面還原 `appearance`。** `input[type='number']` 的 spinner、`[type='date']` 的日曆圖示
常常是專案刻意用 `appearance: none` 藏掉的，一併還原會把那些設計改壞。

另一條路是把這些 select 改掛 `.form-select`，但那是 BS5 的新外觀（SVG 箭頭），
在「畫面不能變」的前提下不成立。

## 6. Reboot 新增 `scroll-behavior: smooth`

BS5 新增（BS3、BS4 都沒有），由 `$enable-smooth-scroll` 控制、預設開啟：

```css
@media (prefers-reduced-motion: no-preference) {
	:root { scroll-behavior: smooth; }
}
```

舊站的「回頂端」與頁內錨點多半是 jQuery 逐幀動畫（`animate({ scrollTop: 0 })`，
或 `scrollTo`／`localScroll` 這類外掛）。jQuery 每一幀都設定一次 `scrollTop`，
而原生 smooth 對**每一次**設定都要再補一段平滑過渡——兩套動畫互相追逐，
結果是明顯的頓挫感。

**症狀是「卡卡的」而不是「位置不對」，很容易被誤判成效能問題或瀏覽器問題。**
而且這是**動態行為不是版面差異，像素比對與 computed style 傾印都抓不到**，
只能人工點一次頁內錨點連結確認。

```bash
grep -rEn 'scrollTop|localScroll|[.]scrollTo[(]' --include='*.js' --include='*.html' .
```

覆寫層關掉原生的、回到舊版行為：

```scss
:root { scroll-behavior: auto; }
```

媒體查詢不影響權重，兩邊都是 `:root`，靠載入順序即可覆蓋。

**副作用要主動跟使用者說**：關掉之後所有錨點跳轉（`href="#x"`）也會回到即時跳。
那正是升級前的行為，但它是一個看得見的變化。

另一個方向是保留 BS5 的 smooth、把 JS 改成原生 `window.scrollTo({ behavior: 'smooth' })`，
效能較好但 easing 曲線會變，而且要動 JS——那屬於節點 8 的範圍，升級階段先用覆寫層。

## 7. `.card-body` 的 padding 可能整個歸零

| | |
|---|---|
| 舊版 | `.panel-body`（BS3）／`.card-body`（BS4）的 padding 是寫死的 → **從專案手上的舊檔讀出實際值** |
| BS5 | `.card-body { padding: var(--bs-card-spacer-y) var(--bs-card-spacer-x) }` |

關鍵是**那組變數定義在 `.card` 上，不在 `.card-body` 上**。只要站上有「`.card-body`
沒有 `.card` 祖先」的結構，變數取不到值，整條 `padding` 宣告失效——**不是變小，是歸零**，
文字直接貼齊邊框。

這在 BS3 起點特別容易踩：`.panel-body` → `.card-body` 是逐處改名的，改的人只換 class 名稱、
沒有一併補上 `.card` 外層時就會中。手風琴是最常見的來源，很多舊寫法根本沒有 `.card` 這一層。

```bash
# 逐一確認上層有沒有 .card
grep -rEon 'class="[^"]*card-body[^"]*"' --include='*.html' .
```

覆寫層補回舊版的固定值即可。**不要在 `.card-body` 上補宣告那組變數**——那等於把框架的
作用域設計改掉，日後更難維護。同一個機制也會發生在 `.accordion-*`、`.list-group-*`、
`.pagination` 這些「變數定義在父層 class、子層才使用」的元件上。

**這一項和第 4 項要分開理解**：第 4 項是變數**有**預設值、蓋掉原本繼承的顏色；
這一項是變數**取不到值**、讓整條宣告失效。

## 8. `:root` 變數加上 `--bs-` 前綴（僅 BS4 起點）

BS4 的 `:root` 定義了 `--red`、`--primary`、`--danger`、`--breakpoint-md`、
`--font-family-sans-serif` 等變數，BS5 全部改名成 `--bs-` 開頭。專案 CSS 若寫
`color: var(--red)` 會直接失效，顏色掉回繼承值。

**BS3 沒有 CSS 自訂屬性（Less 編譯、輸出裡沒有 `:root` 區塊），純 BS3 起點可跳過這一項。**
但若前手半升級過、站上已有 BS4 的檔案（見步驟 0 的兩層偵測），仍要掃一次：

```bash
grep -rEn 'var[(][[:space:]]*--(blue|indigo|purple|pink|red|orange|yellow|green|teal|cyan|white|gray|primary|secondary|success|info|warning|danger|light|dark|breakpoint-[a-z]+|font-family-[a-z-]+)[[:space:]]*[,)]' --include='*.css' --include='*.scss' --include='*.html' .
```

**修法建議改用專案自己的設計 token，不要補回 BS4 的變數名。**
依賴框架內部變數本來就是脆弱的做法，補回去只是把同一個問題留到下一次升級再壞一次。

## 9. 舊專案的覆寫規則被 BS5 官方元件選擇器的特異度反超

BS3、BS4 起點的專案常見一種手法：用後代選擇器（`.pagination > .active > a`、`.list-group > .active` 這類 2～3 層 combinator）蓋過框架的預設樣式，不加 `!important`，單靠選擇器層數贏過框架自己相對單純的規則。

這招在 BS3／BS4 底下多半成立，因為那兩代的元件選擇器通常比較簡單。但 BS 5.3 把不少元件的 active／hover／focus 狀態改寫成**多層 class 疊加**的複合選擇器——分頁是 `.page-item.active .page-link`，三個 class 組成，特異度比專案原本那條「2 個 class＋1 個標籤」的舊選擇器更高。搬到 BS5 之後，框架的選擇器反而贏，專案的覆寫悄悄失效，但不會有任何錯誤訊息，`grep` 也抓不到——class 名稱都對得上，只是誰蓋過誰變了，這正是本章開頭說的「靜態掃描一定通過」那一類。

`tpl_fortune_tcnews` 的例子：`_color1.scss` 裡 `.pagination > .active > a, .pagination > .active > span { border-color: #0e6133 }`（特異度 2 class＋1 標籤）沒加 `!important`；BS5 官方對應的 `.page-item.active .page-link { border-color: var(--bs-pagination-active-border-color) }` 有 3 個 class，特異度更高，贏過專案這條，active 分頁項目的邊框因此變回 BS5 預設藍，不是專案原本要的品牌綠。同一區塊裡另一條 `background-color: #0e6133 !important` 因為有 `!important` 不受影響——一個區塊裡兩條規則、class 都沒改過，一條中一條沒中，很容易被誤判成「這個 class 沒問題」。

```bash
# 找出專案裡沒有 !important、選擇器層數只有 2 個 class（或更少）的舊式覆寫，是高風險名單
grep -rEn '\.[a-zA-Z-]+[[:space:]]*>[[:space:]]*\.[a-zA-Z-]+[[:space:]]*>' --include='*.scss' --include='*.css' . | grep -v '!important'
```

抓出來的清單不代表全部有問題——BS5 對應選擇器的特異度要逐條核對，最快的方法是直接打開瀏覽器 devtools 的 Computed 面板看是哪一條規則實際生效，比手算特異度快也不容易算錯。**修法優先加 `!important`，不要試著疊更多層選擇器去贏**——那條路線在下一次框架升級可能又要重比一次特異度。這裡跟本章開頭判準討論的「值屬於誰」是兩回事：這裡的值（品牌綠）是專案自己的設計值，不是框架預設值，所以直接留在專案 CSS、只是補權重，不必搬進 parity 覆寫層。

## 本章 grep 指令的寫法限制（實測）

本章的指令都在 Git Bash 的 GNU grep 3.0 底下實跑驗證過。過程中發現一個會讓掃描
**安靜失效**的環境差異，寫在這裡，因為它的失敗方式正好是「回傳 0 筆」——看起來就像掃乾淨了：

> **這個 grep 不支援 `\b`，要用 `\<` 與 `\>`。**

實測（純 ASCII 測試檔、`LC_ALL` 分別為預設／`C`／`C.UTF-8` 都一樣）：

| pattern | 命中 |
|---|---|
| `nav` | 2（`nav`、`navbar`） |
| `\<nav\>` | 1 ← 正確的單字邊界 |
| `\bnav\b` | **0** ← 安靜失效 |

`grep -P`（PCRE，`\b` 在那裡是支援的）在這台機器上會回
`grep: -P supports only unibyte and UTF-8 locales`，也走不通。

所以本章所有指令一律不用 `\b`。需要單字邊界時用 `\<`／`\>`；不需要精確邊界的就不加，
改用「先用寬鬆 pattern 撈出來、再人工看過」的兩段式（第 4 項的指令就是這樣寫的）。

這一條呼應 [`07-visual-regression-verification.md` 的「掃描指令要先自我驗證」](07-visual-regression-verification.md#掃描指令要先自我驗證)：
**任何回傳 0 筆的掃描，先用一個「一定命中」的簡化 pattern 確認指令本身會動**，
再把 0 筆當成結論。

## 查這一批的順序

1. **先跑 4-7**（格線與容器層級），把整頁位移的原因排除掉。整頁都在動的時候，
   逐個元件去查是浪費時間。
2. **再用上面每一項的 grep 篩出「站上有沒有這個結構」**。沒命中的項目直接跳過，
   不要為了完整性把用不到的規則寫進覆寫層——覆寫層越小越好維護，
   每一條都要說得出為什麼存在。
3. **命中的項目逐一套判準**決定修在覆寫層還是專案自己的 CSS。
4. **第 6 項要單獨人工驗**（點一次頁內錨點）。其餘各項都會反映在像素比對或
   computed style 傾印上，照 [`07-visual-regression-verification.md`](07-visual-regression-verification.md) 的三層驗收走。
5. **第 9 項抓出高風險名單後，逐條用瀏覽器 devtools 的 Computed 面板核對**，
   不要只憑 grep 命中就動手補 `!important`——特異度沒真的輸的規則補了也是白補，
   還會多留一筆說不出理由的技術債。
