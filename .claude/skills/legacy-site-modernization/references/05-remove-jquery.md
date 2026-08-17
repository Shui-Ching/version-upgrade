# 節點 8 專章：移除 jQuery 依賴，改寫成原生 JS

**前提：節點 7（升級到 BS5）必須先完成。** 理由寫在 `02-modernize.md`：BS5 本身不需要 jQuery，先升級完，剩下的 jQuery 呼叫才分得清哪些是 Bootstrap 元件的舊寫法（會被 BS5 原生 API 連帶取代）、哪些是頁面自己的邏輯（要一行行重寫）。順序反過來會同時除錯兩種失效，分不出問題出在哪一邊。

這一章的核心不是「查對照表把 `$()` 換掉」——那張表網路上到處都有。真正會讓改寫出錯的是 **jQuery 與原生 API 語意不一樣**的地方：集合 vs 單一、事件委派、動畫、AJAX 的錯誤處理。那些寫在[語意陷阱](#語意陷阱對照表換得掉語意換不掉)一節，改寫前先看過。

**改寫後的變數宣告一律用 `const`／`let`，不要用 `var`。** 這個階段的專案已經完成節點 7（升級到 BS5.3.7），BS5 官方本身就不支援 IE11、原始碼也用 ES6 語法——能跑這個專案的瀏覽器環境早就允許 ES6，用 `var` 沒有換到任何相容性，純粹是舊習慣殘留。判斷原則：函式內沒有被重新賦值的變數用 `const`，會被重新賦值的用 `let`（例如 debounce／節流用的旗標、跨函式共用的可變狀態）。這條只適用於這次改寫或新增的程式碼——第三方套件檔案（尤其是已經壓縮成一行的 vendor 檔）不在此列，不要為了套用這條規則去動壓縮過的第三方原始碼。

## 目錄

- [步驟 1：盤點所有 jQuery 使用](#步驟-1盤點所有-jquery-使用)
- [步驟 2：分成三類，先處理擋路的那一類](#步驟-2分成三類先處理擋路的那一類)
- [步驟 3：基本對照表](#步驟-3基本對照表)
- [語意陷阱（對照表換得掉、語意換不掉）](#語意陷阱對照表換得掉語意換不掉)
- [步驟 4：什麼時候可以真的把 jQuery 標籤刪掉](#步驟-4什麼時候可以真的把-jquery-標籤刪掉)
- [步驟 5：驗收](#步驟-5驗收)

---

## 步驟 1：盤點所有 jQuery 使用

先把範圍量出來再決定怎麼做。**不要邊掃邊改**——jQuery 常常在多支檔案裡互相依賴（`init.js` 定義的函式被頁面內的程式碼呼叫），先看到全貌才知道哪裡可以獨立改。

```bash
# jQuery 的載入來源（本地檔案與 CDN 都要）
grep -rEn 'jquery[^"'"'"']*\.(min\.)?js|jquery@[0-9.]+' --include='*.html' -i .

# 呼叫點：$( 與 jQuery( 開頭，含 $. 靜態方法
grep -rEon '\$\(|jQuery\(|\$\.[a-zA-Z]+' --include='*.html' --include='*.js' . | wc -l

# 依檔案分佈，看重心在哪
grep -rEc '\$\(|jQuery\(|\$\.[a-zA-Z]+' --include='*.js' --include='*.html' . | grep -v ':0$' | sort -t: -k2 -rn
```

掃描時記得**節點 5 已經把 inline `<script>` 搬進 `.js` 檔案了**，所以重心應該在 `js/` 底下；如果 HTML 裡還有大量命中，代表節點 5 沒做完或後來又寫回去了，先回頭處理。

`$` 這個符號有兩個誤判來源，看到命中不要馬上當成 jQuery：

- 樣板字串裡的 `${...}` 插值。
- 其他函式庫也用 `$` 當簡寫（少見，但舊站什麼都可能有）。

---

## 步驟 2：分成三類，先處理擋路的那一類

把步驟 1 的命中逐一歸類。順序很重要：**第三類是 blocker，沒解決之前不能動另外兩類。**

### 第一類：Bootstrap 元件的 jQuery 呼叫

`$('#myModal').modal('show')`、`$('[data-toggle="tooltip"]').tooltip()` 這種。節點 7 的步驟 2-3 應該已經改成 BS5 的原生 API 了；這裡只是確認沒有漏網的。**不需要額外重寫邏輯**，因為 Bootstrap 自己提供了原生替代。

### 第二類：頁面自己寫的 jQuery

DOM 操作、事件綁定、AJAX、動畫效果。這才是真正要一行行重寫的部分，看[步驟 3](#步驟-3基本對照表)與[語意陷阱](#語意陷阱對照表換得掉語意換不掉)。

### 第三類：第三方套件把 jQuery 當依賴

舊版 fancybox、jQuery UI、各種 `jquery.xxx.js` 外掛、有些輪播與燈箱套件。**只要還有一個這種套件在用，jQuery 就拔不掉**——先解決它們，這一節點才有可能收尾。

```bash
# 檔名帶 jquery 的外掛
grep -rEn '<script[^>]*src="[^"]*jquery[^"]*"' --include='*.html' -i . | grep -v 'jquery-[0-9]\|jquery\.min\|jquery@'
```

每個命中的套件，照這個順序判斷：

1. **它是不是已經在節點 2 被判定為死碼？** 如果站上根本沒有用到它的功能，直接刪掉，這是最省事的結果。節點 2 掃過一輪但沒刪的套件，值得在這裡用「它的 class／初始化函式有沒有在頁面出現」再確認一次。
2. **它有沒有不依賴 jQuery 的新版本？** 有些套件自己出過 vanilla 版（fancybox 5、部分燈箱／輪播套件），升版就解決。這會連帶進入節點 9 的範圍，兩邊要一起做不要各做一次。
3. **有沒有現代替代品？** 例如 jQuery 輪播換成 Swiper、jQuery 燈箱換成 GLightbox。但**替代品的 DOM 結構、class 命名、選項名稱通常整組不同，等於這個功能重做**，而且視覺與互動細節會變。這是產品決策：先問使用者這個功能還要不要、能接受多大的外觀變動，不要自己選一套換下去。
4. **以上都不成立**（套件沒有替代品、功能又必須留）→ 這一輪就無法完全移除 jQuery。**這是可以接受的結論，不要為了「達成目標」硬拆。** 正確做法是把第二類改寫完（減少 jQuery 的使用面），把 jQuery 保留為單一套件的依賴，在收尾報告裡明講「因為 X 套件還吃 jQuery，jQuery 保留；要完全移除需要先處理 X」，讓使用者決定要不要為此另開一輪。

### 走到第 3 條時的汰換對照

這幾組是實務上最常遇到的，替代品都沒有 jQuery 相依。列在這裡是為了**估工作量**，不是叫你直接換——選哪一套仍然是上面第 3 條講的產品決策：

| 舊套件 | 替代 | 要注意什麼 |
|---|---|---|
| slick | Swiper | DOM 結構要改：多一層 `swiper-wrapper`／`swiper-slide` 包裹 |
| magnific-popup／lightcase／fancybox | GLightbox | 連結掛 `.glightbox` 加 `data-gallery` |
| bootstrap-datepicker | flatpickr | 日期格式與 locale 設定要重新對過 |

引入 CDN 一律**鎖定版本並補 SRI**，流程照節點 6（確認路徑存在 → 下載實檔 → 算 sha384），不要沿用舊 hash：

```html
<script src="https://cdn.jsdelivr.net/npm/swiper@14.0.6/swiper-bundle.min.js"
        integrity="sha384-..." crossorigin="anonymous"></script>
```

**汰換是獨立工作，不要和 Bootstrap 升級（節點 7）混在同一筆 commit**——兩者都會動版面，出問題時分不出是誰造成的。這條與 SKILL.md 的「節點與節點之間不要疊在一個 commit 裡」是同一個理由。

### 移除套件之後，務必掃一次殘留呼叫

這是汰換最容易出事的地方，而且症狀完全不指向根因。

套件刪掉了，但 `theme.js` 裡還留著一段 `.slick()` 呼叫。執行到那一行時 jQuery 物件上沒有這個方法，直接丟 `TypeError`，**連帶讓同一支檔案後面所有 IIFE 都不執行**。

```bash
# 換成實際移除的套件方法名
grep -rEn '[.](slick|magnificPopup|lightcase|fancybox)[[:space:]]*[(]' --include='*.html' --include='*.js' .
```

兩件事讓它特別難查：

- **症狀是「一堆不相干的功能同時壞掉」**，因為壞的是同一支檔案裡排在後面的程式碼，跟被刪掉的套件沒有任何表面關聯。
- **殘留呼叫常出現在死碼裡**——對應的 HTML 早就不存在了（例如全站已無 `.bar-button` 的側邊欄），畫面上看不到，所以盤點時最容易被漏掉。

失效的機制與下一節「混裝檔案」講的是同一件事（未捕捉的例外中斷同一支 script 剩下的執行），差別只在觸發原因：那邊是 jQuery 被拿掉造成 `ReferenceError`，這邊是套件被拿掉造成 `TypeError`。

找到之後**直接刪整段，不要只註解掉**——註解掉的死碼會在下一輪盤點時再被當成「還在用」看一次。

### 還有一種容易漏掉的情況：套件檔案是「混裝」的

上面四點都假設一個檔案（或一個 `<script>` 標籤）對應一個套件，是全有全無的判斷。但舊站常見的 `helper-plugins.js`、`vendor.js` 這類「把一堆外掛打包成單一檔案」的產物，實際上可能是**吃 jQuery 的外掛跟不吃 jQuery 的原生函式庫，用好幾段未保護的頂層陳述句混在同一支檔案裡**——例如一個檔案前段是 `(function($){ ... })(jQuery)` 包起來的外掛，後段是完全獨立、不依賴任何函式庫的原生工具（背景色偵測、圖片 lazy load 之類）。

這種情況下，jQuery 一旦被拿掉，**檔案前段的 jQuery 外掛會在自己的頂層陳述句直接丟出 `ReferenceError: jQuery is not defined`，中斷這支 script 剩下的執行**——JavaScript 的同步執行在遇到未捕捉的例外時，同一支 `<script>` 裡排在後面的陳述句一律不會再跑。後段那個完全不吃 jQuery、原本工作正常的原生函式庫，會因此永遠不會被註冊成全域變數，而且**不會有任何指向這裡的錯誤訊息**——console 只會看到前段外掛的 `ReferenceError`，看起來像是「這個外掛壞了」，很容易忽略掉它其實牽連了後面完全無關的程式碼。

判斷方法：對這種打包檔案，不要只看它「是不是套件」，要看它**裡面有幾段獨立的頂層程式碼、各自吃不吃 jQuery**。找到吃 jQuery 但確定死碼可以整段刪除的部分之後，剩下還在用、且不吃 jQuery 的部分要拆成獨立檔案，跟吃 jQuery 、必須保留或還沒處理完的部分分開載入——不能靠「這個檔案裡有些東西還要留著」就整包留下 `<script>` 標籤，那樣會連帶留下已經確認是死碼的 jQuery 外掛。

---

## 步驟 3：基本對照表

| jQuery | 原生 JS |
|---|---|
| `$(document).ready(fn)` / `$(fn)` | `document.addEventListener('DOMContentLoaded', fn)`（注意時序，見陷阱 3） |
| `$(window).on('load', fn)` | `window.addEventListener('load', fn)` |
| `$(sel)` | `document.querySelector(sel)`（單一）／`querySelectorAll(sel)`（集合，見陷阱 1） |
| `$(el).find(sel)` | `el.querySelectorAll(sel)` |
| `$(el).closest(sel)` | `el.closest(sel)` |
| `$(el).parent()` | `el.parentElement` |
| `$(el).children()` | `el.children` |
| `$(el).siblings()` | `[...el.parentElement.children].filter(n => n !== el)` |
| `$(sel).on('click', fn)` | `el.addEventListener('click', fn)` |
| `$(sel).off('click', fn)` | `el.removeEventListener('click', fn)`（要傳同一個函式參考，匿名函式移不掉） |
| `$(document).on('click', '.x', fn)` | 事件委派，沒有一行對應，見陷阱 2 |
| `$(sel).trigger('click')` | `el.click()`／`el.dispatchEvent(new Event('click'))` |
| `$(sel).addClass/removeClass/toggleClass` | `el.classList.add/remove/toggle` |
| `$(sel).hasClass(c)` | `el.classList.contains(c)` |
| `$(sel).attr(k)` / `.attr(k, v)` | `el.getAttribute(k)` / `el.setAttribute(k, v)` |
| `$(sel).removeAttr(k)` | `el.removeAttribute(k)` |
| `$(sel).data(k)` | `el.dataset[camelCaseKey]`（見陷阱 7） |
| `$(sel).prop('checked')` | `el.checked` |
| `$(sel).val()` / `.val(v)` | `el.value` / `el.value = v` |
| `$(sel).text()` / `.text(v)` | `el.textContent` |
| `$(sel).html()` / `.html(v)` | `el.innerHTML`（**寫入前先看陷阱 8 的 XSS 說明**） |
| `$(sel).append(node)` | `el.append(node)` |
| `$(sel).prepend(node)` | `el.prepend(node)` |
| `$(sel).before/after(node)` | `el.before(node)` / `el.after(node)` |
| `$(sel).remove()` | `el.remove()` |
| `$(sel).empty()` | `el.replaceChildren()` |
| `$(sel).css('color', v)` | `el.style.color = v`（能改走 class 切換就別直接寫 style） |
| `$(sel).show()` / `.hide()` | 加減一個 `.is-hidden` class，由 CSS 控制 `display`（見陷阱 4） |
| `$(sel).offset()` | `el.getBoundingClientRect()` 加上 `window.scrollY`／`scrollX` |
| `$(sel).width()` / `.height()` | `el.clientWidth` / `clientHeight`（含 padding，見陷阱 6） |
| `$.each(arr, fn)` | `arr.forEach(fn)`（**參數順序相反**，見陷阱 5） |
| `$.ajax` / `$.get` / `$.post` | `fetch(url, options)`（**錯誤處理不同**，見陷阱 9） |
| `$(form).serialize()` | `new URLSearchParams(new FormData(form)).toString()` |
| `$(sel).animate()` / `.fadeIn()` / `.slideToggle()` | 沒有一行替代，改成 CSS `transition`／`animation` 由 class 驅動（見陷阱 4） |
| `$.extend({}, a, b)` | `Object.assign({}, a, b)` 或 `{ ...a, ...b }` |
| `$.isArray(x)` | `Array.isArray(x)` |
| `$.trim(s)` | `s.trim()` |
| `$.parseJSON(s)` | `JSON.parse(s)` |

---

## 語意陷阱（對照表換得掉、語意換不掉）

這一節是這個節點真正的難處。上面的表照著換，程式碼會「看起來對」但行為不一樣，而且多半不會噴錯——只是某個功能在某些情況下不動了。

### 陷阱 1：jQuery 物件是集合，原生 `querySelector` 是單一元素

`$('.item').addClass('is-active')` 會作用在**所有**符合的元素上；`document.querySelector('.item').classList.add('is-active')` 只作用在**第一個**。這是最常見的改寫錯誤，而且在測試資料只有一筆時完全看不出來。

```js
// ✗ 只改到第一個
document.querySelector('.item').classList.add('is-active');

// ✓
document.querySelectorAll('.item').forEach(el => el.classList.add('is-active'));
```

反過來也有陷阱：**`$('.item')` 在找不到元素時是空集合，後續呼叫安靜地什麼都不做**；`document.querySelector('.item')` 找不到時回傳 `null`，接著存取屬性會直接丟 `TypeError` 中斷整支腳本。舊站常有「這段程式碼只在某幾頁需要、其他頁面找不到元素也無所謂」的寫法，直譯成原生後會在那些頁面把整支 JS 打斷，連帶讓後面不相干的功能一起失效。所以單一元素的取用一律要先判斷：

```js
const el = document.querySelector('.item');
if (!el) return;
```

用 `querySelectorAll().forEach()` 沒有這個問題（空集合 forEach 零次），這也是它常常比 `querySelector` 更接近原本 jQuery 行為的原因。

### 陷阱 2：事件委派沒有一行對應

`$(document).on('click', '.btn-delete', fn)` 的意思是「不管 `.btn-delete` 是現在就存在、還是等一下才被插入 DOM，點到都會觸發」。舊站用它來處理 AJAX 載入進來的內容。原生要自己在事件處理器裡判斷來源：

```js
document.addEventListener('click', event => {
	const target = event.target.closest('.btn-delete');
	if (!target) return;
	// 這裡的 target 等同 jQuery 版本裡的 this
});
```

用 `closest()` 而不是 `event.target.matches()`，因為點擊可能落在按鈕內部的 `<span>`／`<i>` 圖示上，`event.target` 會是那個子元素，`matches()` 就判斷失敗——現象是「點文字有反應、點圖示沒反應」，很容易被當成偶發問題。

**判斷要不要用委派**：如果元素是頁面載入時就存在、之後不會重建，直接對元素 `addEventListener` 更清楚；只有動態插入的內容才需要委派。不要因為原本寫委派就照抄委派。

### 陷阱 3：`DOMContentLoaded` 已經觸發過就不會再觸發

`$(fn)` 的行為是「DOM 準備好時執行，如果**已經**準備好了就立刻執行」。`document.addEventListener('DOMContentLoaded', fn)` 沒有這個補償——事件早就過去了的話，這個 `fn` 永遠不會跑。

腳本用 `defer`、`async`、或動態插入時就會踩到。安全寫法：

```js
function onReady(fn) {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', fn);
	} else {
		fn();
	}
}
```

如果專案的 `<script>` 全部放在 `</body>` 之前同步載入（舊站常見），DOM 其實已經解析完了，這時候最簡單的做法是**直接把 `$(fn)` 的包裹層拿掉、內容拉平**，不需要換成 `DOMContentLoaded`。少一層包裹也少一個出錯的地方。

### 陷阱 4：`.show()`／`.hide()`／動畫改寫時，「原本的 display 值」會遺失

`$(el).hide()` 記住元素原本的 `display` 值再設成 `none`，`$(el).show()` 還原它。直譯成 `el.style.display = 'none'` / `= 'block'` 的話，原本是 `flex`、`inline-block`、`table-row` 的元素會被錯誤地變成 `block`——版面壞掉但不噴錯。

正確做法是**不要用 JS 直接寫 `display`，改成加減 class**，由 CSS 決定：

```css
.is-hidden { display: none !important; }
```

```js
el.classList.toggle('is-hidden', shouldHide);
```

`.fadeIn()`／`.slideToggle()` 同理，改成 CSS `transition` 驅動：JS 只負責加減 class，過渡效果寫在 SCSS。要注意 `display: none` 的元素無法過渡，需要「先移除 `display: none` → 下一個 frame 再改 `opacity`／`max-height`」的兩段式處理，或改用 `visibility` + `opacity` 組合。這比 jQuery 的一行呼叫麻煩，但換來的是效果寫在樣式層、可以被設計系統統一管理——class 命名與過渡時間的 token 依 `frontend-standards` skill。

**改寫前先判斷：這個顯示／隱藏效果現在到底是 CSS 在管，還是 jQuery 外掛在執行期動態塞 inline style 管的？** 這一點在遇到「畫面看起來像是 CSS `:hover`／`:focus` 就會自動顯示某個區塊」時特別容易判斷錯——很直覺地以為那個效果就是純 CSS，把控制它的 jQuery 外掛呼叫直接刪掉，結果那個區塊變成永遠展開、每個頁面都跑版。查證方法很簡單：**去讀（編譯前的）CSS 原始碼，找那個元素的預設狀態有沒有明確寫 `display:none`／`visibility:hidden` 之類的隱藏規則。** 找得到，才可以放心說「CSS 自己會管，jQuery 呼叫可以刪」；找不到（尤其是看到一行被註解掉的隱藏規則，那通常就是外掛接手之前、原作者手動控制的殘跡），代表隱藏狀態是 jQuery 外掛在初始化時用 inline style 動態塞的，直接刪掉呼叫會讓元素永遠可見。

### 陷阱 5：`$.each` 與 `forEach` 的參數順序相反

```js
$.each(list, function (index, item) { ... });   // 索引在前
list.forEach(function (item, index) { ... });   // 值在前
```

直接把函式主體搬過去、參數名稱沒改，兩個變數就對調了。這種錯誤在 `list` 是字串陣列時會產出「用數字當內容、用內容當索引」的荒謬結果，通常一跑就發現；但如果剛好兩者都是數字，會安靜地算出錯的答案。改寫時逐個確認參數名稱。

`$.each` 還能吃物件（`$.each(obj, fn)` 走 key/value），對應的是 `Object.entries(obj).forEach(([key, value]) => ...)`，不是 `forEach`。

### 陷阱 6：`.width()`／`.height()` 的盒模型定義不同

jQuery 的 `.width()` 回傳的是 **content box**（不含 padding、border），`.innerWidth()` 含 padding，`.outerWidth()` 再含 border。原生的 `el.clientWidth` 含 padding 不含 border，`el.offsetWidth` 含 padding 與 border。

| jQuery | 原生 |
|---|---|
| `.width()` | `el.getBoundingClientRect().width` 扣掉 padding 與 border，或直接用 `getComputedStyle` 讀 `width` |
| `.innerWidth()` | `el.clientWidth` |
| `.outerWidth()` | `el.offsetWidth` |

拿來算版面位置時差幾十 px，現象是「元素定位偏移一點點」。改寫前先確認這段程式碼在意的是哪一種寬度，不要看到 `width` 就配 `clientWidth`。

### 陷阱 7：`.data()` 不等於 `dataset`

`$(el).data('userId')` 第一次讀取會從 `data-user-id` 屬性取值，**並且把值快取在 jQuery 內部**；之後 `$(el).data('userId', 123)` 寫入時只改快取、不會改 DOM 屬性。原生的 `el.dataset.userId` 永遠直接讀寫 DOM 屬性。

差別會在兩種情況顯現：程式碼寫入後又用 `getAttribute` 讀（jQuery 版讀到舊值、原生版讀到新值），或反過來。另外 jQuery 的 `.data()` 會嘗試把 `"123"` 自動轉成數字、`"true"` 轉成布林，`dataset` 一律回傳字串——`if (el.dataset.enabled)` 對 `data-enabled="false"` 會判定為 true，因為 `"false"` 是非空字串。要自己轉型。

### 陷阱 8：`.html()` 換成 `innerHTML` 時要檢查資料來源（資安）

`$(el).html(data)` 與 `el.innerHTML = data` 一樣危險：只要 `data` 含有使用者可控的內容（網址參數、表單輸入、後端回傳的使用者資料），就是 XSS 破口。改寫是重新檢視每一處的機會，不要無腦一對一換。

判斷方式：這個字串是不是完全由程式碼寫死？

- **是**（固定的樣板字串、沒有變數插值）→ `innerHTML` 可以用。
- **否**（有任何來自外部的變數）→ 只要插入的是純文字就改用 `textContent`；一定要組結構的話，用 `document.createElement()` 逐個建立元素、文字部分用 `textContent` 設定。

依全域規則，發現既有程式碼有這類風險要明確指出並提修正方案，不能因為「原本就這樣寫」而沿用。

### 陷阱 9：`fetch` 對 HTTP 錯誤狀態不會 reject

`$.ajax` 的 `error` callback 會在 4xx／5xx 時被呼叫。`fetch` 只有在**網路層失敗**（斷線、CORS 被擋、DNS 解析失敗）才 reject；伺服器回 404 或 500 一樣進 `.then()`，`response.ok` 是 `false` 但程式照走成功路徑。直譯過來的結果是「伺服器出錯時，前端當成成功、拿一份 HTML 錯誤頁去 `JSON.parse`」，錯誤訊息會指向解析失敗而不是真正的原因。

```js
fetch(url)
	.then(response => {
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return response.json();
	})
	.then(data => { /* ... */ })
	.catch(error => { /* 對應原本的 error callback */ });
```

其他幾個對不上的地方：

- `$.ajax` 預設會帶同源 cookie，`fetch` 在較舊的規範下不帶——明確寫 `credentials: 'same-origin'`（或依需求 `'include'`）比較保險。
- `$.post(url, data)` 預設用 `application/x-www-form-urlencoded` 送出並自動序列化物件；`fetch` 要自己決定 `headers` 與 `body`（`new URLSearchParams(data)` 對應舊行為，`JSON.stringify(data)` 搭配 `Content-Type: application/json` 則是換了一種格式——**換格式等於後端也要跟著改**，除非確認後端兩種都收，否則沿用原本的格式）。
- `$.ajax` 的 `dataType: 'json'` 會自動解析，`fetch` 要自己呼叫 `response.json()`。

### 陷阱 10：jQuery 專屬的選擇器不是 CSS 標準

`$(':visible')`、`$(':hidden')`、`$(':contains("文字")`）、`$(':checkbox')`、`$('div:first')`、`$('li:eq(2)')` 這些丟給 `querySelectorAll` 會直接丟 `SyntaxError`。改寫要自己實作條件：

| jQuery 選擇器 | 原生做法 |
|---|---|
| `:visible` | `el.offsetParent !== null`（或依實際需求判斷 `getComputedStyle(el).display !== 'none'`） |
| `:contains("x")` | `[...els].filter(el => el.textContent.includes('x'))` |
| `:first` / `:last` | `els[0]` / `els[els.length - 1]` |
| `:eq(n)` | `els[n]` |
| `:checkbox` / `:radio` | `input[type="checkbox"]` / `input[type="radio"]`（這兩個有標準寫法） |

好消息是它們會直接噴錯，不是安靜失敗——改寫時漏掉會馬上發現。

### 陷阱 11：鏈式呼叫要拆開

`$(sel).addClass('a').attr('b', 'c').on('click', fn)` 是 jQuery 的鏈式 API，原生沒有。拆成多行、用一個區域變數承接元素即可。拆開時注意如果原本是集合，每一步都要在 `forEach` 裡做，不要拆成「第一步對集合、第二步對第一個」。

### 陷阱 12：CSS `:hover` 改寫成「桌機 hover、觸控裝置點擊」雙軌時，click 會跟 hover 打架

下拉選單這類效果，原本整個顯示／隱藏都是 jQuery 外掛在管的話，改寫成原生通常會變成「桌機用 CSS `:hover` 展開、觸控裝置沒有 hover，另外補 JS 監聽 `click` 切換一個 class」的混合寫法。這裡容易漏掉的地方是：**如果 click 處理器沒有限制只在觸控裝置寬度生效，桌機滑鼠也會觸發它**——使用者滑鼠移到選單上（`:hover` 展開）→ 點一下連結（click 處理器把 class 加上去）→ 移開滑鼠（`:hover` 條件消失，但 JS 加的 class 還在）。結果是**選單卡在展開狀態，怎麼移開滑鼠都收不回去**，而且不會有任何錯誤訊息，只有實際操作滑鼠才看得出來（純粹檢查「hover 之後有沒有展開」的測試不會發現這個問題，因為只測了展開沒測收合）。

修法是在 click 處理器裡用 `window.matchMedia('(max-width: 992px)').matches` 之類的條件做寬度判斷（斷點值跟著專案既有的 CSS 斷點走），只有在觸控裝置的寬度範圍內才讓 click 真的切換 class；桌機寬度下讓 CSS `:hover` 單獨負責，click 什麼都不做。這個判斷要放在 click 處理器**內部、每次點擊時**檢查，不要在綁定事件的當下判斷一次就定型——使用者旋轉手機或縮放視窗跨過斷點時，行為才會跟著正確切換。

### 陷阱 13：把 jQuery `.slideToggle()` / 動畫外掛改寫成 CSS `animation-name`，卻忘了 `animation-duration`

原本用 jQuery（或 SuperFish 這類外掛）做的滑動、淡入效果，改寫成「JS 只切換一個 class，實際動畫交給 CSS」是常見寫法：CSS 裡寫 `.is-open { animation-name: fadeInDown; }`，JS 只需要 `classList.toggle('is-open')`，看起來乾淨又對。**但如果沒有一併寫 `animation-duration`，這個屬性的規格預設值是 `0s`——動畫會瞬間播完，畫面上等於完全沒有動畫效果，展開/收合是直接跳過去的。**

這個陷阱特別陰險的地方：`animation-name` 有寫、選擇器也對、class 也有正確切換，用瀏覽器開發者工具檢查 computed style 甚至能看到 `animation-name` 生效了——唯獨少了 `animation-duration`（或 `animation-fill-mode`，沒設的話動畫結束後可能跳回起始畫格）這件事很容易被忽略，因為「這一行沒寫」不會報錯、不會有任何提示，只有實際用眼睛看效果才發現「怎麼都沒有滑動感」。

改寫檢查清單：
- 每一個新寫的 `animation-name` 宣告，旁邊一定要有對應的 `animation-duration`（沒特別要求的話，微互動抓 `.2s`～`.3s` 之間就夠）。
- 如果動畫結束後要停在最後一格（例如展開選單維持展開），要加 `animation-fill-mode: both`，否則動畫播完會回到 `0%` 的起始格。
- 驗收時不要只看「class 有沒有切換對」，要實際觸發一次操作、用眼睛確認動畫真的有播放。

### 陷阱 14：`class + animation-name` 只能做「出現」動畫，做不出「消失」動畫

陷阱 13 提醒過忘記寫 `animation-duration` 的後果，但即使 `animation-duration`、`animation-fill-mode` 都寫對，這個替換法本身還有一個更前面的結構性限制：**keyframe animation 是靠選擇器匹配觸發播放的，class 被移除的那一刻沒有任何機制能反向播放它**。`.is-open { animation-name: fadeInDown; }` 只能在「加上 `.is-open`」的瞬間播放一次進場動畫；「移除 `.is-open`」不會觸發任何動畫，元素只會照 CSS 的預設規則（通常是 `display:none`）瞬間消失。

這個限制特別容易被忽略，因為**展開的體驗完全正常**——正是這一點讓人誤以為整個效果都是動畫在管。收合當下不會有任何錯誤訊息，開發者工具裡也確實能看到 `animation-name` 生效過，唯獨少了「反向」這件事，只有實際點擊收合、用眼睛看才發現「怎麼是瞬間消失」。

判斷方法：檢查 CSS 裡負責收合的規則長什麼樣子。如果動畫只寫在 `.is-open{ animation-name: ...}` 這一條、收合是靠移除 `.is-open`、退回預設的 `display:none`，那就一定沒有收合動畫——不用實際點擊測試，光看程式碼就能判斷出來。

**修法**：改用 JS 量測實際高度、驅動 `height` 的 `transition`（而不是 `animation-name`），開合兩個方向天生就是同一組 transition 的正反向，不需要額外處理反向動畫。以下是驗證過可以直接用的寫法（來源：TCnews5.3.7 手機選單改寫，效果對齊 jQuery 已移除的 `.slideToggle()`）：

```js
// el._slideTimer 記錄計時器，讓連續點擊時能取消上一輪還沒跑完的動畫收尾，
// 避免舊的 setTimeout 在新一輪動畫開始後才觸發、蓋掉新設定的 inline style。
function slideOpen(el, duration) {
  clearTimeout(el._slideTimer);
  el.style.display = 'block';
  const target = el.scrollHeight;
  el.style.height = '0px';
  el.style.overflow = 'hidden';
  el.style.transition = 'height ' + duration + 'ms ease';
  void el.offsetHeight; // 強制 reflow，見下方說明
  el.style.height = target + 'px';
  el._slideTimer = setTimeout(function() {
    el.style.removeProperty('height');
    el.style.removeProperty('overflow');
    el.style.removeProperty('transition');
  }, duration);
}
function slideClose(el, duration, onDone) {
  clearTimeout(el._slideTimer);
  el.style.height = el.scrollHeight + 'px';
  el.style.overflow = 'hidden';
  el.style.transition = 'height ' + duration + 'ms ease';
  void el.offsetHeight; // 強制 reflow，見下方說明
  el.style.height = '0px';
  el._slideTimer = setTimeout(function() {
    el.style.display = 'none';
    el.style.removeProperty('height');
    el.style.removeProperty('overflow');
    el.style.removeProperty('transition');
    if (onDone) onDone();
  }, duration);
}
```

`void el.offsetHeight` 這行是關鍵：瀏覽器會把同一個 frame 內對同一個屬性的多次寫入合併成一次，如果不強制讀一次觸發 reflow，起始高度跟目標高度會被合併，動畫直接跳過去，效果跟完全沒寫 `transition` 一樣——這是另一個「程式碼看起來對、要實際看效果才發現沒有動畫感」的陷阱，成因跟陷阱 13（漏寫 duration）不同，但外顯症狀一樣。

改寫檢查清單：
- 判斷這個效果需不需要「兩個方向都動畫」：只出現一次、不會被使用者重複觸發收合的（例如頁面載入時的一次性淡入）才適合用 `animation-name`；使用者能重複開合的（選單、手風琴、對話框）一律用上面的 `transition` 寫法，不要用 class + animation-name。
- 驗收時不能只點開來看——**收合也要實際點一次，用眼睛確認高度是平滑變化、不是瞬間消失**。跟陷阱 12 一樣，只測了一半的操作會漏掉另一半的問題。

---

## 步驟 4：什麼時候可以真的把 jQuery 標籤刪掉

**改寫完成不等於可以刪。** 順序是：

1. 步驟 2 的三類全部處理完（第三類若無法處理，就不進行刪除，見步驟 2 第 4 點）。
2. 步驟 5 的靜態掃描歸零。
3. **先把 jQuery 的 `<script>` 標籤註解掉、跑一次執行期驗證**，確認沒有 `$ is not defined` 之類的錯誤，再真正刪除檔案。這一步不能省——靜態掃描抓不到字串組出來的呼叫（`window['$']`）、也抓不到第三方套件內部對 `window.jQuery` 的檢查。

刪除的範圍有三處，容易只刪一處：

- HTML 裡的 `<script src="js/jquery-x.x.x.min.js">`（節點 3 做過共用區抽取的話，也可能在 `components/` 裡）。
- `js/` 底下的 jQuery 檔案本身。
- 如果專案有 npm（節點 5 導入過），`package.json` 的 `dependencies` 也要移除，並重跑 `npm install` 更新 `package-lock.json`。

依 `02-modernize.md` 的安全邊界，**不確定的檔案先搬到 `_deprecated/` 觀察一輪再刪**，jQuery 尤其適用——它是全站最多東西依賴的單一檔案。

---

## 步驟 5：驗收

### 5-1 靜態掃描

```bash
# 應為 0 筆：jQuery 呼叫
grep -rEon '\$\(|jQuery\(|\$\.[a-zA-Z]+' --include='*.html' --include='*.js' . 

# 應為 0 筆：jQuery 載入
grep -rEn 'jquery' --include='*.html' --include='*.json' -i .
```

第一個指令會誤命中樣板字串的 `${}`，逐筆看過即可（依 `02-modernize.md` 開頭的原則，掃描是第一輪篩選不是驗收證明）。

### 5-2 執行期驗證

沿用節點 6 的 Playwright 流程，重點看兩件事：

1. **console 與 `pageerror`**：`$ is not defined`、`jQuery is not defined`、`xxx is not a function`——這些代表有漏改的呼叫點，或某個第三方套件其實還在找 jQuery。
2. **實際互動一遍**：這個節點改的是行為不是外觀，**截圖看不出來**。點擊每一個改寫過的互動（選單展開、modal 開關、表單送出、輪播切換、AJAX 載入更多），確認有反應。改寫過程中最常見的失效是陷阱 1（只作用在第一個元素）與陷阱 2（動態內容點不到），這兩種都要在有多筆資料、且有動態載入內容的情況下才看得出來——測試時刻意找那樣的頁面。

### 5-3 收尾報告要寫的事

- 三類各處理了什麼，尤其**第三類是否有套件擋住、jQuery 最後有沒有真的移除**。沒移除就直說原因與後續條件，不要含糊寫成「大部分已移除」。
- 改寫過程中發現的行為差異（例如原本 `.show()` 用的 `display` 值其實是 `flex`、原本某段 AJAX 沒有錯誤處理），以及你怎麼處理的。
- 依全域資安規則：改寫過程若發現 `.html()` / `innerHTML` 的 XSS 風險（陷阱 8），即使超出這次改動範圍也要列出來，說明風險與修正方案，由使用者決定要不要一起修。
- 要手動點過的互動清單，照節點 9 的兩層寫法列出頁面與具體檢查項目。
