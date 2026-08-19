# 節點 3～9：整體版更

對應使用者分類「整體版更」。這七個節點把清完場的舊站，重組成結構乾淨、依賴新版的狀態。

## 目錄

- [節點 3：挖出共用區（header/footer）](#節點-3挖出共用區headerfooter)
- [節點 4：按鈕語意改 `<button>`](#節點-4按鈕語意改-button)
- [節點 5：刪除沒用的 css，改成 scss](#節點-5刪除沒用的-css改成-scss)
- [節點 6：內部資源改成 CDN](#節點-6內部資源改成-cdn)
- [節點 7：升級 Bootstrap 到 5.3.7](#節點-7升級-bootstrap-到-537)
- [節點 8：移除 jQuery 依賴](#節點-8移除-jquery-依賴)
- [節點 9：升級第三方套件](#節點-9升級第三方套件)

---

## 節點 3：挖出共用區（header/footer）

目標：多支 HTML 裡重複貼上的 header、footer、meta 標籤、共用 script 引用，抽成一份共用來源，改一次全站生效。

**沒有 build tool 的靜態站要先選一種實作方式**，這是專案環境決定的，不要自己選，先問使用者：

| 做法 | 適用情境 | 代價 |
|---|---|---|
| Server-Side Include（Apache `.shtml`/`mod_include` 或 Nginx SSI） | 主機是 Apache/Nginx 且能開 SSI | 需要主機權限確認，副檔名可能要改（`.html`→`.shtml`） |
| PHP include | 主機還在跑 PHP | 如果專案正朝「移除 PHP」方向走（見節點 1），這個做法與大方向衝突，通常不建議 |
| 前端 JS `fetch()` 注入 | 純靜態、無後端渲染能力 | 有 FOUC（Flash of Unstyled Content）與 SEO 風險——搜尋引擎爬蟲抓到的是注入前的空殼，header/footer 內的連結不會被視為站內連結權重來源。若 header/footer 不含重要 SEO 內容（純導覽/版權），風險可接受 |
| 輕量 build（11ty、gulp-file-include 等） | 使用者願意導入建置工具 | 超出「純靜態無 build tool」的預設範圍，等於同時改變了專案性質，要先跟使用者確認要不要做這個決定，不要順手加 |

抽取時要注意：**先確認所有頁面的 header/footer 是不是真的完全一樣**。舊站常見「某幾頁的 footer 少了一段活動宣傳」「內頁 header 多一個麵包屑」這種細微差異，直接抽成單一共用檔案會讓那些頁面跑版或掉功能。做法是先逐頁比對差異，把差異處理成共用元件裡的條件區塊或參數，而不是硬把最常見的那份當成唯一版本。

比對做法：把每支頁面的 header／footer 區塊各自存成暫存檔，用 `sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//'` 去掉行首行尾空白後再 `diff`，排除縮排差異的干擾，只看真正的內容差異。若比對出的差異是「內容不一樣、連結對不上現有頁面」（常見於舊樣版留下的殘留區塊，例如某幾頁的選單還連去已經不存在的頁面、聯絡資訊是另一個單位的），**不要自己選一份當標準**，把差異攤開給使用者看，問要以哪一份為準；等使用者決定後才動手覆蓋其他頁面。

### 選定「前端 JS fetch() 注入」時的參考實作

以下是實際跑過、可直接沿用的配方，對應上表「前端 JS `fetch()` 注入」那一列。

**檔案結構**：

```
components/
  header.html      ← 純標記，不含 <script>
  footer.html
js/
  include.js       ← 唯一的引入邏輯，檔名本身就是給 RD 的線索
```

共用元件檔只放 HTML 結構，不要放 `<script>`——`outerHTML`／`innerHTML` 插入的內容裡，瀏覽器規範上不會自動執行內嵌的 `<script>` 標籤，放了也不會跑，等於是死碼。若元件原本內嵌了第三方 SDK 載入邏輯（例如 FB SDK 的 `fbAsyncInit` 那段），把它搬進 `include.js`、用 `document.createElement('script')` 手動建立並插入，注入完成後再呼叫。

**頁面裡的寫法**：共用區的位置只留佔位元素，不要在旁邊放 script 標籤：

```html
<div id="site-header"></div>
<!-- ... -->
<div id="site-footer"></div>
```

`include.js` 只在 `</body>` 前引入一次，且要排在 `init.js`（或任何會操作 header／footer 內部元素的腳本）之前：

```html
<script src="js/include.js"></script>
<script src="js/init.js"></script>
```

**腳本標籤不需要貼著佔位元素**，這是容易誤解的地方。`include.js` 內部用 `document.getElementById('site-header')`／`getElementById('site-footer')` 各自判斷該佔位元素存不存在，只要元素在 DOM 裡（不管腳本標籤寫在文件的哪個位置），就抓得到、就會注入；元素不存在就直接 `return`，不會報錯。也因為這樣，兩個共用區不需要各自配一支 `<script src="js/include.js">`，合併成 `</body>` 前的單一一支即可——這樣才符合「CSS 進 `<head>`、JS 統一放 `</body>` 前」的慣例，不需要為了共用元件注入而把 JS 穿插在內容中間。

真正的位置限制不是「貼著佔位元素」，而是**時序**：任何依賴 header／footer 內部元素的腳本，必須排在 `include.js` 之後執行。舊站常見的 `init.js` 通常會有類似「抓 `.site-header` 綁吸頂效果」的邏輯，而且多半用 `if (!el) return;` 這種防呆寫法——如果 `include.js` 排在它後面，等於 header 還沒注入就先跑吸頂綁定，`el` 抓到 `null`，函式直接放棄，**不會噴任何錯誤，效果卻默默失效**，是很難聯想到根因的陷阱。動手前先掃一次舊站既有的 JS，找出所有查詢 `.site-header`／`.site-footer`／或元件內部 class 的地方，確認 `include.js` 排在它們全部之前。

**用同步 XHR，不是 `document.write()`，也不是單純的非同步 `fetch()`**：舊站常見的寫法是把 jQuery、外掛、`init.js`（負責選單 hover 展開、漢堡選單點擊）全部用一長串 `<script src>` 放在 `</body>` 前同步載入，`init.js` 通常在 `DOMContentLoaded` 觸發時就去綁定選單事件。如果共用區用非同步 `fetch()` 注入，實務上多數情況下 header 這種小檔案會比後面十幾支腳本先載入完成，但這只是「機率上通常沒事」，不是時序保證——一旦選單綁定搶在 header 注入之前執行，選單元素就抓不到、hover 展開直接失效，而且只會在網路較慢或快取冷啟動時偶發，很難重現除錯。改用同步 XHR（`xhr.open('GET', url, false)`）可以讓瀏覽器在共用區注入完成前暫停解析，代價是主執行緒被短暫阻塞（對一個幾 KB 的本機元件檔而言可忽略）、且瀏覽器主控台會出現「不建議同步 XHR」的資訊性警告，但換來時序正確、不需要去改 vendor 的 `init.js`。`document.write()` 雖然一樣能保證時序，但只能在頁面同步解析階段呼叫，且會把元件內容直接寫死進頁面來源，不利於之後要在注入完成後做額外處理（例如手動重掛第三方 SDK）；同步 XHR 給的是一份可操作的字串，注入時機與後續處理都更彈性。「排在 `init.js` 之前」的時序要求，同步 XHR 本身不會自動保證——它保證的是「`include.js` 這支腳本執行完才會往下解析後面的 HTML／腳本」，你仍然要負責把它排在正確的位置。

**`include.js` 骨架**：

```js
(function () {
	includeComponent('site-header', 'components/header.html', afterHeaderInjected);
	includeComponent('site-footer', 'components/footer.html');

	function includeComponent(placeholderId, url, afterInject) {
		var placeholder = document.getElementById(placeholderId);
		if (!placeholder) return;

		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, false);
		xhr.send(null);

		if (xhr.status !== 200) {
			console.error(url + ' 載入失敗：', xhr.status);
			return;
		}

		placeholder.outerHTML = xhr.responseText;
		if (typeof afterInject === 'function') afterInject();
	}

	function afterHeaderInjected() {
		// 例如手動掛載 header.html 裡拿掉的第三方 SDK 載入邏輯
	}
})();
```

**適用前提**：這個配方假設使用者是用支援 http(s) 的方式預覽與部署（VS Code 的 Live Server 之類的本機伺服器、之後 FTP 上傳到真正的 web 主機），不是直接雙擊開 `file://`。同步 XHR 讀取本機檔案在 `file://` 協定下會被部分瀏覽器（尤其 Chrome）的安全限制擋下，注入會整個失效。動手前先跟使用者確認預覽與部署方式，不要預設一定能用。

## 節點 4：按鈕語意改 `<button>`

把「當按鈕用的 `<a>` 與 `<span>`」改成 `<button>`，並以 CSS 補回外觀。

**判斷標準**：有 `href` 且指向真實 URL 或頁內錨點（`#section-id`）→ 保持 `<a>`；沒有實質 `href`（`href="#"`、`href="javascript:void(0)"`）、只靠 `onclick` 或綁定的 JS 事件觸發行為（開 modal、送表單、切換 tab）→ 改成 `<button>`。

**為什麼要做這個改動**：`<a>` 沒有 `href` 時，鍵盤使用者預設無法用 Tab 聚焦、無法用 Enter/Space 觸發；`<button>` 原生就支援這些。這是這個節點在「版更」之外真正的價值——無障礙，不只是語意好看。

這個節點的細節比其他節點多（`type` 要逐顆判斷、CSS 選擇器要並列而非取代、`<button>` 有六項預設樣式要 reset、取值有 `inherit` 權重陷阱），全部寫在 [`03-a-to-button.md`](03-a-to-button.md)，動手前讀那份。

兩個最容易造成回歸的點，先在這裡示警：

1. **`type` 不能一律填同一個值**。`<button>` 在 `<form>` 裡預設 `type="submit"`，漏寫會誤送表單；但一律寫 `type="button"` 又會讓真正的送出鈕失效。要逐顆判斷，判準表在 `03-a-to-button.md`。
2. **CSS 選擇器鎖定標籤名稱**：`.btn a`、`a.btn-primary`、`nav a` 這類選擇器在改標籤後會全部失效。原則是並列（`.btn a, .btn button`）而不是把 `a` 換成 `button`，因為同一條選擇器往往同時服務要改和要留的兩批元素。

這個節點還包含一件容易被當成「不是這輪的事」而略過的資安工作：**被判定為維持 `<a>` 的連結，只要有 `target="_blank"` 就要補 `rel="noopener noreferrer"`**。理由與例外情況（站內連結、原本已有 `rel` 值、JS 的 `window.open`）寫在 `03-a-to-button.md`。放在這個節點是因為它是全站唯一一次逐一檢視每個 `<a>` 的機會，分開做等於把同一批檔案再掃一遍。

`<button>` 的 reset 範圍與節點 5「轉 SCSS」重疊，兩個節點可以在同一輪一起看。

### 順便清：圖片加上 `loading="lazy"`

跟上面 `rel="noopener noreferrer"` 同樣的邏輯：這是全站唯一一次逐一檢視每個 `<img>` 的機會，分開做等於把同一批檔案再掃一遍。原則是「內容圖片延遲載入，首屏與外掛依賴的圖片維持原樣」，排除以下三類：

1. **首屏／Hero 輪播的第一張圖**：這通常是 LCP（Largest Contentful Paint）候選，加 `loading="lazy"` 會延誤它的載入時機，反而讓效能變差。維持預設載入（不寫 `loading` 屬性），有條件的話可以額外加 `fetchpriority="high"` 提示瀏覽器優先抓取；輪播裡其餘不會第一眼看到的圖片才加 `loading="lazy"`。
2. **共用元件裡的常駐圖示**：header 的 logo、固定按鈕（回頂部、線上客服之類）的圖示——這些每一頁載入時都在首屏範圍內，delay 它們沒有效能收益，反而可能讓使用者看到短暫的圖示缺漏。
3. **餵給第三方套件當「頁面」用的圖片**：常見於翻頁書、輪播、圖表類外掛，這些外掛經常在初始化當下就讀取所有來源 `<img>` 的尺寸來排版（例如算出書本翻頁的頁面尺寸、輪播每一張的定位）。`loading="lazy"` 會延後圖片真正開始下載的時機，若外掛的初始化邏輯沒有等圖片載完才讀尺寸，會讀到 0 或不正確的值，導致排版跑掉或效果失敗。動手前**先讀套件原始碼確認它的初始化時機**，不確定就先跳過這批圖片，不要當成單純的效能改動直接套用。

**這個改動不影響版面**：`loading="lazy"` 只改變圖片何時開始下載，不改變 DOM 結構、CSS、或圖片本身佔用的版面空間，因此不會觸發節點 6 之後「畫面樣式不得改變」的硬約束，也不需要跑 [`07-visual-regression-verification.md`](07-visual-regression-verification.md) 那套三層視覺回歸驗收。驗收方式改成功能性檢查即可：捲動到該圖片時有正常顯示、瀏覽器 console 沒有因此新增錯誤。

## 節點 5：刪除沒用的 css，改成 scss

判斷「沒用的 css」的方法跟節點 2 類似（掃描 HTML/JS 裡實際用到的 class），但多一個陷阱：**JS 動態加減的 class（`is-active`、`is-open` 這類狀態 class）不能只靠靜態掃描判斷有沒有用到**，因為它們不會寫死在 HTML 裡，而是執行期才被加上去。掃描時要連 JS 裡 `classList.add/remove/toggle` 或 jQuery 的 `.addClass/.toggleClass` 一起搜，不能只看 HTML 檔案。

轉 SCSS 的命名、模組結構、斷點表、Token 階層寫法，全部依 `frontend-standards` skill 的規範，不在本 skill 重複——直接呼叫那支 skill，尤其是它的「`main.scss` 入口結構」與「響應式斷點」兩節。

這個節點建議放在節點 3、4 之後才做（而不是先做），因為共用區抽取跟按鈕語意修正都會動到 HTML 結構，如果先寫好 SCSS 再改 HTML，很可能要回頭補 selector；反過來，HTML 結構先穩定，SCSS 只需要寫一次。

### 順便清：inline JS／CSS 一律搬出 HTML

同一輪掃描順便處理掉 HTML 裡直接寫的樣式與程式碼，不留在原地：

- `style="..."` 屬性、頁面 `<style>` 區塊 → 併入對應的 `.scss` partial。這條 `frontend-standards` skill 已經定為硬性規則（例外只有第三方元件的官方渲染快照，例如 reCAPTCHA），這裡是照做，不是本 skill 另立新規。
- 頁面內的 `<script>...</script>` 內聯程式碼 → 搬到對應的 `.js` 檔案；`onclick="..."`、`onload="..."` 這類內聯事件屬性 → 改成在 `.js` 裡用 `addEventListener` 綁定。

理由跟 CSS 一樣：樣式/邏輯散落在每一頁的 HTML 裡，就無法從單一檔案掌握全站實際用了什麼，之後要改一個效果得先搜過所有 HTML 才找得齊。

### 順便清：過時的瀏覽器前綴語法

同一輪掃描順便處理掉 `animation-*`、`transition`、`transform`、`box-shadow`、`border-radius` 這類屬性上的 `-webkit-`／`-moz-`／`-o-` 前綴。舊站常見這四組寫在一起，但現在的瀏覽器支援狀況是：

- `-moz-`、`-o-` 前綴幾乎從來沒有必要留到現在——Firefox 16（2012 年）、Opera 12.1（2012 年）之後就只認無前綴版本，這兩組前綴留著純粹是死碼。
- `-webkit-` 情況分屬性：`transform`／`box-shadow`／`border-radius` 這類早就不需要前綴；但 `animation`／`transition`／`backdrop-filter` 這幾個要抓專案實際要支援的最舊 Safari 版本才能判斷是否還需要（例如 `animation` 從 Safari 9〔2015 年〕才不需要前綴）——不確定的話用 [caniuse.com](https://caniuse.com) 查該屬性的無前綴支援版本，再對照專案的瀏覽器支援門檻。

判斷可以刪的方法：先確認專案的瀏覽器支援門檻（通常會在既有的 Bootstrap 版本、`package.json` 的 `browserslist`，或需求文件裡找到），再對照 caniuse 逐一確認每個前綴屬性；沒有明確門檻、且專案本身沒有極端的舊瀏覽器支援需求（例如政府標案常見的 IE11 相容要求）時，預設可以視為只需支援近幾年的主流瀏覽器，直接清掉。

**這是死碼清理，不是行為變更**——前綴版本跟無前綴版本本來就會同時寫在規則裡、瀏覽器只認得懂它支援的那一組，刪掉瀏覽器本來就不會用到的那幾行，畫面不會有任何變化。但如果專案有選擇器層級的 `animation-duration`／`animation-fill-mode` 之類屬性只寫了無前綴版本、前綴版本反而是缺漏的情況（例如只寫了 `-webkit-animation-name` 但漏了 `animation-duration`），那是另一個問題，屬於 `05-remove-jquery.md` 陷阱 13 的範疇，不要混在一起處理。

### 若使用者同意導入 npm + sass 建置工具

以下配方在 `tpl_fortune_tcnews` 實際跑過（commit `75cb025`），可直接沿用。**動手前一定要先問使用者**——這個決定會讓專案從「純靜態、雙擊打開就能看」變成「要跑過編譯指令才有最新樣式」，是專案性質的改變，不是純技術選擇。

**檔案結構**：依「第三方框架／基礎樣式／站台客製」分三個資料夾，`main.scss` 只負責決定 `@use` 順序，不寫任何樣式規則：

```
scss/
  vendor/   ← 第三方框架與圖示庫（bootstrap、font-awesome、line-icons…）
  base/     ← 網站主體樣式、動態效果
  theme/    ← 站台客製與頁面樣式
  main.scss
```

`@use` 順序要**完整比照原本 HTML `<link>` 標籤與 CSS 內 `@import` 展開後的層疊順序**，不要憑直覺重排——舊站的 CSS 常常沒有變數系統，後面的檔案能蓋掉前面的檔案全靠載入順序，順序錯了會導致原本生效的樣式被反過來蓋掉，而且是那種「整體看起來差不多、細節某幾處顏色/間距跑掉」的難抓 bug。

三個編譯期才會踩到的具體陷阱：

1. **`@use` 必須寫在檔案最上方，遠端 `@import`（例如 Google Fonts）要整段搬出 SCSS**。舊站的 CSS 常見在檔案開頭用 `@import url('https://fonts.googleapis.com/...')` 掛外部字型，這在純 CSS 沒問題，但 Sass 規定 `@use` 必須在檔案最上方、其他規則之前，若把這類 `@import` 留在 `@use` 之後，編譯出的 CSS 會讓 `@import` 落到其他規則後面，違反 CSS 規範、被瀏覽器整段忽略、字型直接失效。解法是把這些遠端字型 `@import` 移出 SCSS，改成 HTML `<head>` 裡獨立的 `<link rel="stylesheet">`，效果不變。
2. **partial 的資料夾深度一旦改變，`url()` 相對路徑要重新推算，不能整段複製**。舊站的第三方套件常常自帶一層目錄結構（例如 `css/font-awesome/css/font-awesome.css` 用 `../fonts/xxx.woff2` 指向 `css/font-awesome/fonts/`）。搬進 `scss/vendor/_font-awesome.scss` 之後，編譯輸出的位置通常是 `css/main.min.css`（跟原本站台既有的 `css/*.css` 同一層），此時原本的 `../fonts/` 會指向錯誤的上層目錄，要改成從新的輸出位置往下算的正確相對路徑（此例是 `font-awesome/fonts/`）。判斷方法：**只要 partial 原本檔案所在的目錄深度，跟編譯輸出檔案的目錄深度不一樣，該 partial 裡所有 `url()` 都要重新核對**；深度相同的 partial（例如站台自己的 `custom.css` 本來就跟輸出檔同層）則不用動。動手前先用 `grep -n "url("` 把每個來源檔案的資源引用抓出來列表，逐一標記「深度不變／深度改變」，深度改變的才需要重寫。
3. **編譯前跑得動不代表沒問題，舊 CSS 裡的語法錯誤瀏覽器會默默吞掉，Sass 編譯器不會**。瀏覽器對無效的 CSS 宣告（例如打字打重複的 `color:##999;`）是整條丟棄、不影響其他規則；但同一段丟進 Sass 編譯會直接報錯中斷，逼你處理。處理原則：**只修到能編譯通過為止，不要順手多改**，而且要具體算出「這個修正會不會讓一條原本被瀏覽器丟棄、因此沒有生效的規則變成生效」——會的話，這就是一個會實際改變畫面的行為變更，必須在收尾報告裡明講改了哪一行、原本視覺上是什麼樣子、改完後變成什麼樣子，不能含糊帶過。

### 全部整合進單一 CSS 檔的取捨：CDN 外掛套件的層疊順序

如果目標是「HTML 只載入一支編譯後的 CSS」，要先掃一次本地 CSS 裡有沒有選擇器命中 CDN 外掛套件（swiper、glightbox、fancybox、mediaelement 之類）的 class：

```bash
grep -c "swiper\|glightbox\|fancybox\|mediaelement\|mejs" scss/**/*.scss
```

舊站常見的寫法是外掛的 CDN `<link>` 插在兩段本地 CSS 之間——前面幾支本地檔案故意排在 CDN 之前（讓 CDN 蓋過去，等於沒作用/僅提供 fallback），後面幾支則故意排在 CDN 之後（用來覆寫外掛預設外觀，例如輪播高度、按鈕 hover 顏色）。一旦把所有本地 CSS 合併成一支檔案，就無法再維持「CDN 前幾支、CDN 後幾支」的交錯順序，只能整包放在 CDN 連結的前面或後面二選一——不管選哪邊都會讓「本來設計成放在另一側」的那些規則行為反過來。這不是技術對錯，是舊站原始設計裡混雜了兩種意圖，合併後必然要犧牲一邊。

抓到這種選擇器時，**不要自己選一邊，把兩種選項的影響攤開問使用者**：放 CDN 之後可以保留「刻意覆寫外掛外觀」的規則（通常數量較多、視覺上較容易被注意到），代價是原本被 CDN 蓋過而不生效的零星規則會反過來生效；放 CDN 之前則相反。決定之後把取捨原因寫進 commit message 或收尾報告，方便日後排查「為什麼這個外掛的顏色跟以前不一樣」。

**收尾要做的事**：

- `.gitignore` 加上 `node_modules/`——這是工具本身，能靠 `package.json` + `package-lock.json` 完全重建，不需要進版控。
- **編譯出來的 `css/main.min.css` 要進版控**，`package-lock.json` 也要進版控。純靜態站沒有部署時自動編譯的流程，若只提交 SCSS 原始碼不提交編譯結果，網站部署出去會直接讀不到樣式。之後每次改 SCSS，要記得重新跑編譯指令再一起 commit 編譯結果，不能只 commit 原始碼。
- 提供 `npm run build:css`（編一次）與 `npm run watch:css`（開發時持續監看）兩個指令，寫進 `package.json` 的 `scripts`，讓使用者知道怎麼在改完 SCSS 後重新編譯。

## 節點 6：內部資源改成 CDN

**適用範圍**：只限「未經客製修改的第三方套件原版」（Bootstrap、jQuery、Font Awesome 官方發行版）。如果 `vendor/` 裡的某個套件有專案自己 patch 過的程式碼（改過原始碼、修過 bug、加過功能），**不能直接換成 CDN 版本**——CDN 上是官方原版，換過去等於把客製的修改全部蓋掉。先確認每個要 CDN 化的套件是不是原封不動的官方版本。

寫 CDN 網址之前，先確認這個網址真的存在，不要套版猜檔名。官方文件的 CDN 範例常常沒跟著套件版本一起更新——例如 Swiper 官方 get-started 頁面的範例還寫著 `@12`，但套件實際最新版本已經是 `14.1.0`；GLightbox、MediaElement.js 這類套件的官方頁面則常常只給「CDN 瀏覽頁」的根目錄連結，不會列出完整檔名路徑（該套件的 min 檔到底放在 `dist/js/`、`dist/`、還是 `build/` 底下，每個套件不一樣）。猜錯路徑的後果是瀏覽器對這個網址回應 404，畫面上不會有明顯錯誤訊息，只會安靜地少載入這個檔案，很容易到上線後才被發現。

用 jsDelivr 的檔案列表 API 實際查一次該版本底下有哪些檔案，取代用「常見慣例」猜檔名：

```
https://data.jsdelivr.com/v1/package/npm/<套件名稱>@<版本號>/flat
```

回傳的 JSON 會列出該版本 npm 套件裡的完整檔案樹，找到要用的 `.min.js`／`.min.css` 之後，把完整路徑接在 `https://cdn.jsdelivr.net/npm/<套件名稱>@<版本號>/` 後面，就是可以放心寫進 `<script src>`／`<link href>` 的網址。這個查證步驟要排在下面「鎖版本號」與「加 SRI」之前做——版本號跟雜湊值都是根據這個查證出來的正確網址去產生的，順序反過來就會鎖錯版本或算錯雜湊。

三個資安/穩定性要求，屬於資安把關範疇，不能省略：

1. **鎖死版本號**：CDN URL 要指向具體版本（例如 `bootstrap@5.3.7`），不要用 `latest` 或不帶版號的路徑。不鎖版本的話，上游套件哪天發新版，網站會在使用者完全不知情、沒有經過測試的狀況下直接套用新版本，可能一夜之間跑版或壞掉。
2. **加 SRI（Subresource Integrity）雜湊，且必須與 `crossorigin="anonymous"` 成對出現**：`<script>`/`<link>` 標籤帶上 `integrity` 屬性，瀏覽器會驗證下載回來的檔案雜湊值是否跟預期一致，避免 CDN 供應商被入侵或中間人攻擊時被偷換成惡意程式碼。雜湊值不要用網頁擷取工具去抄 CDN 介紹頁上列的值——那類頁面常常沒跟著版本更新，或乾脆沒列出你要的那個確切版本，抄錯即等於整包資源被瀏覽器拒絕套用。可靠做法見下方「實跑補充」第 1 點：直接下載真實檔案、本機算雜湊。
   **只寫 `integrity` 而漏掉 `crossorigin="anonymous"` 會直接把資源弄壞，不是「檢查失效」而已**：跨網域請求在沒有 CORS 標頭的情況下拿回來的是 opaque response，瀏覽器讀不到內容就算不出雜湊值，於是判定驗證失敗、拒絕套用該檔案。實際現象是整包 Bootstrap CSS 或 JS 靜悄悄地沒生效、版面全垮，而 console 的錯誤訊息不會直接指向 `crossorigin`，很容易被誤判成 CDN 掛了或版本不相容。正確寫法：
   ```html
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css" integrity="sha384-..." crossorigin="anonymous">
   ```
   同域資源沒有 opaque response 的問題，`crossorigin` 可加可不加；但這個節點處理的全都是跨網域的 CDN 資源，所以在本節點的範圍內，「有 `integrity` 就要有 `crossorigin="anonymous"`」是無例外的規則。
3. **考慮離線 fallback**：CDN 掛掉或被特定網路環境封鎖時，網站的核心功能（尤其 Bootstrap 的版面、jQuery 若還沒移除）會直接失效。做法是偵測關鍵全域物件是否存在（例如 `window.bootstrap`），不存在就動態插入本地備份的 script。是否需要這層 fallback 取決於網站的可用性要求，先問使用者網站的重要程度，不要自己假設一定要做。本地 vendor 檔案要刪除、保留當 fallback、還是保留但先不接 fallback 邏輯，這是三個實質不同的結果，直接列成選項問使用者，不要用一句開放式「要不要留」帶過。

### 實跑補充：CDN 化的具體操作細節

以下是從 `tpl_fortune_tcnews` 實際跑過一輪 Bootstrap CDN 化才浮現的細節，前面的原則段落沒涵蓋，容易在下一個專案重新踩一次：

1. **雜湊值自己下載檔案來算，不要仰賴網頁文字**：流程是先用前面「用 jsDelivr 的檔案列表 API 查一次」確認路徑存在，再用 `curl -sL <cdn 網址> -o <檔名>` 把該版本的實際檔案抓下來，最後 `openssl dgst -sha384 -binary <檔名> | openssl base64 -A` 算出雜湊值，組成 `sha384-<結果>`。順手比對下載檔案的位元組數跟 jsDelivr flat API 回傳的 `size` 欄位是否一致，能在算雜湊之前就抓到下載不完整的問題。

2. **浮動版號（`@11`、`@7` 這種只帶主版號、不帶完整版號的路徑）跟 SRI 天生互斥，要先解析成確切版本才能算雜湊**：SRI 雜湊綁定的是單一檔案的位元組內容，浮動版號背後的實際檔案會隨上游發新版而改變，雜湊算了也會失效。jsDelivr 的 `resolve` API（`data.jsdelivr.com/v1/package/resolve/npm/<pkg>/<range>`）實測會回 400，不可靠；改查 npm registry（`registry.npmjs.org/<套件名稱>`）拿到的 `versions` 物件，篩出符合主版號的版本、取最新一筆（或直接看 `dist-tags.latest` 是否落在這個主版號範圍內），鎖定成具體版本號後才進行第 1 點的雜湊計算。掃描既有 HTML 時，只要看到 CDN 網址帶的是單一整數版號（`@11`、`@7`），就代表這個資源之前從來沒有被真正鎖死過，是一個現成的修復機會，值得跟這次要處理的套件一起問使用者要不要順便補齊。

3. **專案如果已經做過節點 5（CSS 轉 SCSS）,CDN 化不能只照抄 HTML `<link>` 的既有順序**：本地套件如果是透過 `@use` 被編譯進單一輸出檔（例如 `main.min.css`），它在最終頁面裡的層疊優先權，是看「整份輸出檔在 `<head>` 裡排第幾個 `<link>`」，不是看它在 `main.scss` 的 `@use` 清單裡排第幾行。從 SCSS 抽出來、改成獨立 CDN `<link>` 之後，正確位置是「原本編譯進同一份輸出檔時，這個套件相對於其他外部 CDN 資源的順序」，不是隨手把新 `<link>` 貼在原本 `<link href="css/main.min.css">` 前面就好——後者可能把層疊順序整個顛倒，讓原本被蓋掉的規則反過來生效。判斷方法：先列出 `@use` 清單裡這個套件前後分別是哪些 partial，那些 partial 裡有沒有選擇器覆寫了要 CDN 化的這個套件的 class；有的話，CDN `<link>` 要放在編譯輸出檔（也就是那些覆寫規則所在的檔案）的 `<link>` 之前。

4. **驗證本地檔案是不是未客製官方版本，優先找一份可以直接 `diff` 的副本**：節點 5 做 SCSS 化時，常見做法是把原始 `.css` 複製一份進 `scss/vendor/` 再包裝成 `.scss`（內容不變，只是副檔名跟外層包裝不同）。這種情況下，直接 `diff` 這兩份檔案，完全一致就代表轉檔過程沒有動過內容，可以放心當成未客製的官方版本處理。如果專案裡只有單一份檔案、沒有另一份可比對，才需要退而求其次去下載對應版本的官方 CDN 檔案來 `diff`。

5. **收尾驗證要能看到畫面、也要能看到請求失敗**：起一個本機靜態伺服器（`python -m http.server <port>`），用 Playwright 開無頭瀏覽器（裝在暫存目錄，不要動專案本身的 `package.json`／`node_modules`，這不是專案要長期依賴的套件）跑過去，同時做兩件事——監聽 `console`（含 `pageerror`）與 `requestfailed` 事件、對頁面截圖。這兩者缺一不可：**SRI 雜湊不符時，瀏覽器是「安靜拒絕套用」該資源，不會有一句明確指向 `integrity` 或 `crossorigin` 的錯誤訊息**，唯一看得出來的訊號就是畫面跑版（截圖才看得到）或者該資源出現在 `requestfailed`／`console --errors` 清單裡，兩者要對照著看，不能只看其中一種。

## 節點 7：升級 Bootstrap 到 5.3.7

**前提**：這個節點排在 CDN 化（節點 6）之後執行最單純——CDN 版本要升級只需要改版本號跟 SRI hash，不用在 `vendor/` 資料夾裡手動置換一堆檔案。如果專案沒有走 CDN，一樣可行，只是要手動下載新版檔案取代舊檔。

**這個節點的起點不是固定的**：有的舊站停在 BS3、有的停在 BS4，也有被前手半升級過、兩代寫法混在同一份 HTML 裡的。終點都是 5.3.7，但起點不同工作量差一個數量級，所以第一件事是判版本、第二件事是估規模並跟使用者確認策略，不是一進來就套表改 class。完整流程（兩層版本偵測、規模估算與三種策略選項、BS4→BS5 與 BS3→BS5 的差異清單、驗收）寫在 [`04-bootstrap-upgrade.md`](04-bootstrap-upgrade.md)，動手前讀那份。

三個最容易造成回歸的點，先在這裡示警：

1. **`data-*` 屬性全部要加上 `bs` 命名空間**（`data-toggle` → `data-bs-toggle`、`data-target` → `data-bs-target`）。遺漏的話該元件會直接失效但不會噴任何錯誤訊息，只能靠 grep 收尾，肉眼看不出來。JS 裡用屬性選擇器抓元素的地方（`$('[data-toggle="tab"]')`）**以及 CSS 裡用屬性選擇器上樣式的地方**（`.btndrop[data-toggle='collapse'] span:after`，手風琴箭頭很常這樣寫）同樣要改——後者漏改的症狀是「箭頭不見了」而不是「元件失效」，更難聯想到原因。完整的掃描指令與判準見 `04-bootstrap-upgrade.md` 的步驟 2-2。
2. **BS3 起點不能只查 BS4→BS5 的清單**。BS3→BS4 與 BS4→BS5 的改動幾乎不重疊，而且有些 class 被改名兩次（`.pull-left` → `.float-left` → `.float-start`），只看後半段會把前半段的舊寫法當成「與 Bootstrap 無關的自訂 class」放過去。BS3 起點還有一個 grep 抓不到的高風險項：BS4 新增 `sm`（576px）造成同名 tier 的斷點值整體位移，`col-sm-*` 的生效點會從 768px 悄悄變成 576px。兩者都在 `04-bootstrap-upgrade.md` 步驟 4。
3. **BS3 的 `bootstrap-theme.min.css` 在 BS4 之後不存在**。照「改版本號」的直覺去動它會得到 404 的網址，而依節點 6 講的，SRI 加在載不到的資源上是安靜失敗。要整行刪掉，並告訴使用者原本的漸層／立體按鈕外觀會消失。

## 節點 8：移除 jQuery 依賴

**前提**：BS5 升級（節點 7）必須先完成。理由是 BS5 本身已經不需要 jQuery，升級完之後，剩下還在呼叫 jQuery 的程式碼，可以明確分成兩類：

1. **Bootstrap 元件的 jQuery 呼叫寫法**（`$('.modal').modal()` 這類）——升級後這些呼叫要改成 BS5 的原生 API，等於是連帶被取代掉，不需要額外重寫邏輯。
2. **頁面自己寫的 jQuery**（AJAX 請求、DOM 操作、動畫效果）——這些才是真正需要一行行重寫成原生 JS 的部分。

如果順序反過來（先移除 jQuery 再升 BS5），這兩類會混在一起，同時除錯 Bootstrap 元件失效與頁面邏輯失效，很難分辨問題出在哪一邊。

完整流程（盤點指令、三分類的處理順序、對照表、十一個語意陷阱、刪除 jQuery 標籤的時機、驗收）寫在 [`05-remove-jquery.md`](05-remove-jquery.md)，動手前讀那份。這個節點真正的難處不是查對照表，而是 jQuery 與原生 API **語意不同**的地方——集合 vs 單一元素、事件委派、`display` 值遺失、`fetch` 對 4xx 不 reject——照表直譯會產出「看起來對、行為不一樣」而且不噴錯的程式碼。

兩個先在這裡示警的點：

1. **第三方套件若還吃 jQuery 當依賴**（舊版 fancybox、jQuery UI、各種 `jquery.xxx.js` 外掛），jQuery 就拔不掉，要先處理套件。處理不了就保留 jQuery 並在報告裡講清楚原因，不要為了「達成目標」硬拆。
2. **`$(sel)` 是集合、`document.querySelector(sel)` 是單一元素**。直譯會變成「只有第一個元素生效」，而且在測試資料只有一筆時完全看不出來。

## 節點 9：升級第三方套件

留到最後執行，因為前面的節點（尤其節點 8 移除 jQuery）可能讓某些套件的存在必要性改變——原本要花力氣升級的套件，可能因為移除 jQuery 而變成根本不需要了。

**如果這次版更的來由是資安檢測**（要修弱點掃描／原始碼掃描的發現項），這個節點的優先序判準就不是「哪個套件最舊」，而是「哪個套件有被報出來的 CVE」——先照掃描報告上的項目排，沒被報到的套件是否要順便升級屬於另一個決定。做完這個節點才接節點 10，見 [`06-security-scan-fixes.md`](06-security-scan-fixes.md)。

對每個還留著的第三方套件：

1. 查是否有官方仍在維護的最新版本，還是這個套件已經停止維護（GitHub 幾年沒更新、issue 沒人回）。
2. 如果套件已經停止維護，評估是否有更輕量、仍在維護的替代品可以取代它的功能——但**不要自行決定砍掉某個功能改用替代品**，功能取捨屬於產品決策，先問使用者是否還需要這個功能，再討論用什麼替代。
3. 升級版本號，同步節點 6 的 CDN 版本鎖定與 SRI hash 一起更新，不要漏掉其中一邊。
4. **收尾時列出受影響頁面，提醒使用者手動預覽**：grep 只能確認「舊套件的 class／檔案引用有沒有殘留」，確認不了「換了套件之後畫面看起來對不對」——尤其是像 FlexSlider→Swiper 這種連 DOM 結構、CSS class 命名都整組換掉的情況，靜態掃描看不出視覺上是否跑版、動畫效果是否正常、console 有沒有噴錯。這個環境通常沒有瀏覽器可以截圖驗證，所以收尾報告要明確列出兩層清單，而不是籠統說「請自行測試」：
   - **有實際套件畫面在跑的頁面**：這層一定要看，列出頁面路徑與具體檢查項目（畫面有沒有跑版、互動有沒有反應、console 有沒有錯誤）。
   - **只是共用了同一支 CSS／JS／CDN 引用、但頁面本身沒有該套件畫面的頁面**：這層風險較低，但因為共用樣式檔被動到，仍要提醒看一眼有沒有被連帶波及。
   
   共用 header/footer 元件如果本身沒有用到該套件，可以註明「已確認無關，看過清單裡任一頁即等於看過」，不必重複列成獨立項目。
