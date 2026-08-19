---
name: legacy-site-modernization
description: 舊版靜態網站（純 HTML/CSS/JS，無 npm/build tool）的整體改版健檢流程：除去廢 code、共用元件化、CSS 轉 SCSS、語意化修正、CDN 化、Bootstrap 升級（起點可能是 BS3 或 BS4，終點都是 5.3.7）、移除 jQuery 改寫成原生 JS、第三方套件升級。當使用者說「整體版更」「除去廢code」「清一下舊專案」「接手舊站要不要重構」「套件太舊要升級」「Bootstrap 3 升 5」「BS4 升 BS5」「把 jQuery 拿掉」「改成原生 JS」「bootstrap 5.3.7」時一律使用，並主動照完整節點清單走過一輪，不要只做使用者明講的單一節點就結束——這些節點彼此有依賴順序，跳著做會讓後面的節點誤判死碼、誤刪還在用的東西。升級**之後**才回報症狀時同樣使用，因為根因多半在這裡：「升級後版面跑掉」「CSS 吃不到」「modal 打不開」「手風琴箭頭不見」「間距忽然變大」「卡片內文貼齊邊框」「select 沒有箭頭」「捲動變得卡卡的」——這些都是 class 名稱沒變、但 Bootstrap 預設值改了造成的，見 `references/08-bs5-behavior-traps.md`。
---

# 舊站整體版更

把「接手一個舊版純靜態網站，要整理到能放心維護、能通過資安檢測」這件事拆成 10 個有順序依賴的節點。這套流程是從 `tpl_fortune_tcnews` 專案實際跑出來的（節點 1、2 已有對應 commit：`d2d49b2`、`5304016`；節點 5「CSS 轉 SCSS + 導入 npm/sass 建置工具」對應 commit `75cb025`），下一個類似的舊專案可以直接照這份清單走。

## 適用範圍

純靜態 HTML/CSS/JS 舊專案，**沒有** npm、沒有 build tool、沒有前端框架。這是本 skill 假設的起始狀態。

（這是**起始**狀態，不是全程狀態：節點 5 若經使用者同意導入了 npm + sass，之後的節點就會在「有 `package.json`、有 SCSS 編譯」的前提下運作——節點 10 的 `npm audit`、節點 7 的 Sass 變數覆寫層都預期這種情況。判斷當下該用哪種做法，看專案現在有什麼，不要看這一節寫的起始狀態。）

如果專案其實已經有 `package.json`、Vue/React、或既有的 build pipeline，先停下來跟使用者確認技術棧再套用——節點 5（CSS 轉 SCSS 的編譯方式）、節點 6（CDN 或改用套件管理器）在有建置工具的專案裡做法不同，不要照抄本 skill 針對純靜態站寫的做法。

## 節點總覽與順序

原則是「先清場 → 再重組結構 → 最後升級外部依賴 → 用掃描收尾驗收」。順序本身是有依賴關係的，不是任意排列：

| # | 節點 | 對應使用者的分類 | 為什麼放這個位置 |
|---|---|---|---|
| 1 | 移除沒用的檔案（html/Templates 資料夾、XML、php） | 除去廢 code | 資料夾等級的死碼，先清掉不影響任何後續判斷 |
| 2 | 掃出沒引用的 css/js 並刪除（含第三方套件） | 除去廢 code | 死碼多會讓「有沒有被引用」的判斷失真，要在乾淨基礎上做 |
| 3 | 挖出共用區（header/footer） | 整體版更 | 結構要先穩定，才不會把已刪除的死碼一起抽進共用元件 |
| 4 | 全站按鈕語意 `<a>`／`<span>` 改 `<button>`，保留的 `<a target="_blank">` 補 `rel`；順便逐一看過全站每個 `<img>`，加上 `loading="lazy"` | 整體版更 | 排在共用區抽取之後，共用元件裡的按鈕與圖示只要改一次；這也是唯一一次逐一看過全站每個 `<a>`／`<img>` 的機會 |
| 5 | 刪除沒用的 css、把 inline JS／CSS 搬出 HTML、改成 scss | 整體版更 | HTML 結構此時已底定，SCSS 才不會因結構後續變動要重寫 |
| 6 | 內部資源改成 CDN | 整體版更 | 結構穩定後，才知道哪些第三方套件真的還在用、該鎖哪個版本 |
| 7 | 升級 Bootstrap 到 5.3.7（起點可能是 BS3 或 BS4） | 整體版更 | CDN 化之後直接換版本號最單純，不用在 vendor 資料夾手動置換檔案 |
| 8 | 移除 jQuery 依賴，改寫成原生 JS | 整體版更 | 必須在 BS5 升級之後，才分得清楚哪些 jQuery 用法是 Bootstrap 要的（直接砍），哪些是頁面自己寫的（要重寫） |
| 9 | 升級第三方套件 | 整體版更 | 留到最後，因為前面步驟（尤其移除 jQuery）可能讓某些套件變得不再需要 |
| 10 | 修復弱點掃描與原始碼掃描的發現項 | 資安驗收 | 必須排在 7、8、9 之後——套件升級本身就會消掉一大批 CVE 類發現項，先修再升等於白做，而且會分不清剩下的發現項是不是升級造成的 |

每個節點各自對應一個 git commit，commit message 用中文描述做了什麼（沿用 `掃出沒引用的css、js 並刪除(套件)` 這種寫法），方便之後回退到任一節點之前的狀態。**節點與節點之間不要疊在一個 commit 裡**——尤其節點 4、5、7 三個都會動到 CSS/HTML，混在一起除錯時分不出是哪個改動造成的跑版。

## 硬約束：畫面樣式不得改變（節點 6 之後全部適用）

多數舊站版更的實際來由，是「要通過資安檢測、要升套件版本」，而不是「要改版面」。這種情境下**畫面維持原樣是驗收條件，不是加分項**——使用者端不會有人為版面變動背書，任何一處跑版都會被當成這次改動造成的迴歸。

這條約束把節點 7、8、9 的性質整個改掉，讀那三個節點的細節之前先建立這個認知：

- **「升級成功」的定義是「跑得動且畫面沒變」**，不是「換成新版本的官方寫法」。BS5 的官方建議寫法（例如用 `.d-grid` 取代 `.btn-block`）如果會讓按鈕的外觀差一點點，那就要補一層樣式把它調回去，而不是接受新外觀。
- **框架升級一定會動到全域預設值**，這是最大的風險來源，而且 grep 抓不到。BS4 起把基礎字級從 14px 改成 16px、單位改成 rem、Reboot 重寫過——沒有任何一個 class 壞掉，但全站字級、行高、間距、表單元件高度會整體位移。BS3 起點等於一次吃下兩代的變更。做法是用框架自己的 Sass 變數把預設值改回舊值（覆寫層），細節見 `references/04-bootstrap-upgrade.md` 的「視覺零變更」一節。
- **要有可比對的基準，而且要能並排比**：把升級前那份用 `git archive HEAD` 匯出、另外起一台本機伺服器，跟工作區同時跑，用同一個瀏覽器、同一次執行拍兩邊。**不要用「先存一批截圖、改完再跟存檔比」**——存檔基準隔一段時間再比，字型快取、瀏覽器版本、系統縮放任何一項不同都會製造假差異。方法、腳本與量測本身的陷阱見 `references/07-visual-regression-verification.md`。
- **驗收看三層，順序是「靜態掃描 → 幾何不變量 → 逐屬性與逐像素」**。中間那層最便宜也最有診斷價值卻最常被跳過：頁面總高與水平溢出量只要對不上，就是版面真的變了。**「grep 乾淨」不能當成驗收通過**——框架換代最貴的那批差異（clearfix 被移除、flex 取代 float、行框空隙）是「同一個 class 行為定義不同」，HTML 完全不用改，靜態掃描結構上就抓不到。
- **必然改變、無法完全復原的項目要事前列出來讓使用者拍板**，不要改完才報告。例如 BS3 的 `bootstrap-theme` 按鈕漸層、Glyphicons 換成別的圖示庫——這兩項在新版沒有等價物，只能「盡量做像」或「接受變化」，屬於使用者的決定。

## 安全邊界（每個節點都適用）

- **不確定某個檔案/class/套件有沒有被引用時，先搬到 `_deprecated/` 之類的暫存位置觀察一輪，不要直接 `rm`**。靜態掃描抓不到動態插入的 `<script>`、JS 動態組出來的 class 名稱、或只在特定活動頁才會用到的舊套件。
- **每個節點做完都應該能獨立驗證**——至少手動點過幾個關鍵頁面確認沒壞，不要 10 個節點一次做完才發現節點 3 就已經斷了。
- **inline JS／CSS 為永久禁止項**：節點 5 的搬移只是把既有的技術債清乾淨，不代表清完之後就可以再寫回去。這條規則對「之後任何新增的程式碼」一樣適用——不管是後續加的頁面、活動樣板、還是修 bug 時的小改動，一律不寫 `style="..."`、頁面內 `<style>`、`onclick="..."` 等內聯屬性，也不寫頁面內 `<script>...</script>`，一律進對應的 `.scss`／`.js` 檔案。

## 掃描指令的寫法（各節點共用）

**寫進文件、要人貼到終端機執行的指令一律用 GNU grep，不要寫 `rg`（ripgrep）**。理由是 ripgrep 不是預設安裝的工具，Windows 的 Git Bash 沒有它——直接貼上會得到 `unknown option -- glob` 這種看起來像語法錯誤、其實是工具不存在的訊息。GNU grep 在 Git Bash、macOS、Linux 都有，貼上就能跑。對應寫法是 `rg -n 'x' --glob '*.html'` → `grep -rEn 'x' --include='*.html' .`。

這條只約束「寫成文字的指令」。agent 在 Claude Code 裡執行時，直接用內建的 Grep 工具即可（它本身就是 ripgrep，而且是 harness 建議的路徑），不需要為了遵守這條而改去 shell 呼叫 grep。

還有一個模式值得每次都用：**用 `-o` 把標籤逐個切出來再過濾，不要整行比對**。

```bash
# ✗ 行為單位：一行裡有兩個 <a>、或旁邊剛好有 <link rel="...">，就會誤判成通過
grep -rn '_blank' --include='*.html' . | grep -v 'rel='

# ✓ 標籤為單位：-o 讓每個 <a ...> 各自成為一筆，過濾條件才對得準
grep -rEon '<a[[:space:]][^>]*>' --include='*.html' . | grep '_blank' | grep -v 'rel='
```

舊站的手寫 HTML 常常整段擠在一行，行為單位的比對在這種檔案上幾乎必然誤判。`-o` 仍有一個限制：屬性被換行拆開的標籤（`<a\n  href="...">`）切不出來，所以掃描結果是**第一輪篩選，不是驗收證明**，命中的區塊仍要肉眼看過。

### 回報 0 筆的指令，可能是指令本身壞了

**凡是用來證明「沒有問題」的掃描，先拿一個已知會命中的字串跑一次**，確認指令真的抓得到東西，再相信它回報的 0。

這條是踩過才寫的：一道用來檢查「SCSS 有沒有鎖定 `col-*` class」的 grep 回報 0 筆，據此判定「改 grid class 名稱不會影響專案樣式」——實際上有 22 條。原因是正則語法在該環境的 grep 實作下不成立，而 grep 沒有報錯、只是安靜地不匹配。**一道壞掉的掃描指令和一個乾淨的專案，輸出長得一模一樣。**

連帶的一條：**複雜的長正則（很多 `|` 分支、`\b` 邊界、跳脫字元混用）在不同 grep 實作下的行為不一樣**，拆成幾道簡單指令比湊一道漂亮的可靠。這個限制不適用於 agent 在 Claude Code 裡用內建的 Grep 工具（它的正則行為是固定的），但寫進文件要人貼到終端機的指令一律照這條。

### Windows 環境的兩個實務限制

舊站的 HTML／CSS 幾乎都含中文，而這兩件事在 Windows 上會安靜地把檔案弄壞：

- **批次改含中文的檔案不要用 PowerShell 寫入。** `Set-Content`／`Add-Content` 預設走系統 ANSI 編碼（繁中環境是 cp950），寫回去的中文會變亂碼，而且不會有任何錯誤訊息。一律用 Node 或 Python 腳本明確以 UTF-8 讀寫（本 skill 附的腳本都是這樣寫的），或直接用編輯工具改。
- **下載或覆蓋 vendor 檔案時遇到 `being used by another process`**，是編輯器或 Live Sass Compiler 鎖住了檔案，不是權限問題。先下載到暫存目錄再複製過去即可繞開。

## 各節點詳細指引

節點內容拆到 `references/`，用到哪個節點就讀對應那份，不要一次全部載入：

- [`references/01-cleanup.md`](references/01-cleanup.md) — 節點 1、2（除去廢 code）：怎麼安全判定「沒被引用」、危險地帶清單
- [`references/02-modernize.md`](references/02-modernize.md) — 節點 3～9（整體版更）：共用元件化、CSS→SCSS、inline JS／CSS 搬出 HTML、CDN 化、第三方套件升級。節點 4、7、8 在這裡只有摘要與示警，細節見下面的專章
- [`references/03-a-to-button.md`](references/03-a-to-button.md) — 節點 4 專章（按鈕語意改 `<button>`）：動作 vs 導航的判準、保留的 `<a target="_blank">` 補 `rel="noopener noreferrer"`、`type` 逐顆判斷表、CSS「並列而非取代」、`<button>` 的 reset 清單、`inherit` 權重陷阱、`aria-label` 與驗收 grep
- [`references/04-bootstrap-upgrade.md`](references/04-bootstrap-upgrade.md) — 節點 7 專章（升級到 BS 5.3.7）：**起點是 BS3 還是 BS4 的兩層偵測方法**、混用狀態的處理、規模估算與三種策略選項、共通工作（`data-bs-*` 命名空間、Popper 2、原生 API）、BS4→BS5 差異清單、BS3→BS5 額外差異清單（含斷點位移換算）、視覺零變更的覆寫層做法、驗收
- [`references/05-remove-jquery.md`](references/05-remove-jquery.md) — 節點 8 專章（移除 jQuery 改原生 JS）：盤點指令、三分類與處理順序（含套件檔案「混裝」吃 jQuery 與不吃 jQuery 程式碼的判斷）、基本對照表、十二個語意陷阱（集合 vs 單一、事件委派、`display` 值遺失、CSS hover 改雙軌點擊時的卡住 bug、`fetch` 不 reject 4xx、`innerHTML` 的 XSS 等）、刪除 jQuery 標籤的時機、驗收
- [`references/06-security-scan-fixes.md`](references/06-security-scan-fixes.md) — 節點 10 專章（弱點掃描與原始碼掃描的修復）：兩種掃描的差異、發現項分類與處理順序、常見項目的修法（相依套件 CVE、安全標頭、XSS sink、SRI、cookie 屬性、資訊洩漏）、誤報的處理、複掃與交付
- [`references/07-visual-regression-verification.md`](references/07-visual-regression-verification.md) — **跨節點（6～10）的視覺回歸驗收方法**：怎麼建立可並排比對的「升級前」環境、三層驗收的順序、量測本身的五個陷阱（整頁截圖的擷取假象、字型就緒、凍結輪播、屬性清單要含 width、可見性影響量值）、判讀差異的順序、掃描指令要先自我驗證。**只要這次的約束是「畫面不能變」就一定要讀**
- [`references/08-bs5-behavior-traps.md`](references/08-bs5-behavior-traps.md) — 節點 7 附章（**同名 class 的行為改變，元件層級**）：class 名稱兩版都在、靜態掃描一定通過、但預設值改了的九項（`.form-control` 移除固定 height、`.col-*` 失去 `position: relative`、`textarea` 新增 min-height 的權重問題、元件 `--bs-*` 變數蓋掉繼承色、`select` 因 `appearance: none` 失去箭頭、`scroll-behavior: smooth` 與 jQuery 捲動動畫打架、`.card-body` padding 因變數作用域**歸零**、`:root` 變數加 `--bs-` 前綴、**專案原本靠後代選擇器寫的覆寫被 BS5 元件的多層 class 選擇器特異度反超而失效**）。附「這一項該修在覆寫層還是專案自己的 CSS」的判準。**最後那一項 grep 與稽核腳本都抓不到**，只能用瀏覽器 devtools 的 Computed 面板逐條核對。**跑完 04 的 4-7 之後接著讀這一份**

- [`references/09-bs4-compat-layer.md`](references/09-bs4-compat-layer.md) — 節點 7 附章（**相容層策略**）：不動 utility class、改用一支 CSS 把 BS5 移除掉的定義補回來的低風險路線。含什麼時候該選它（04 步驟 1 選項 3 的執行手法之一）、它與 parity 覆寫層的分工、盤點指令、四支稽核腳本的用法與界限、`assets/bs4-compat.css` 樣板的刪減方式、`.form-row` 的 gutter 跑版、版本號破快取、相容層的退場路徑。**BS3 起點只能用它的一半**（navbar／`.panel`→`.card`／表單結構是 DOM 重寫，補 CSS 補不出來）

### 附帶的工具

**視覺回歸量測（需要 playwright，裝在暫存的 venv，不要動專案的 `package.json`）：**

- [`scripts/dump-computed-style.py`](scripts/dump-computed-style.py) — 傾印瀏覽器實際算出來的樣式並比對前後差異，回答「變的是**哪一個屬性**、從什麼變成什麼」。也用來在動手前找出「專案的覆寫其實沒生效」這類既有 bug（判讀見 `references/04-bootstrap-upgrade.md` 的「先確認舊版套件現在到底蓋掉了什麼」）。
- [`scripts/compare-screenshots.py`](scripts/compare-screenshots.py) — 同時開「升級前」與「升級後」兩台本機伺服器逐段捲動比對，回答「**哪一塊**、多大範圍變了」，並一併回報頁面總高與水平溢出量這兩個不變量。

兩支要搭配著用：只做像素比對會卡在「知道不對但不知道改哪裡」，只做屬性比對會漏掉版面位移這種不歸屬於單一元素的變化。

**Bootstrap 升級稽核（只需要 Node，不需要安裝任何東西）：**

- [`scripts/migrate-data-attrs.js`](scripts/migrate-data-attrs.js) — 批次把 `data-*` 改成 `data-bs-*`，HTML 與 CSS 一起改。會遞迴子資料夾、跳過 `vendor/`。先跑 `--dry`。
- [`scripts/audit-bs4-classes.js`](scripts/audit-bs4-classes.js) — 找出「HTML 使用中 × 舊版有定義 × BS5 沒有 × 自家 CSS 未接手」的漏網 class。**只驗證 class 是否存在。**
- [`scripts/audit-behavior-changes.js`](scripts/audit-behavior-changes.js) — 掃 `08-bs5-behavior-traps.md` 的第 1、2、3、5、6、8 項與「`a` 預設有底線」。
- [`scripts/audit-bs5-component-vars.js`](scripts/audit-bs5-component-vars.js) — 掃該章第 4 項（元件 `--bs-*` 變數蓋掉繼承色），只比對顏色類變數。

**三支 `audit-*.js` 假設扁平結構**（只讀 `<專案目錄>/*.html` 不遞迴、`<專案目錄>/css/*.css`），路徑對不上的專案不會報錯、只會回報乾淨——照上面「回報 0 筆的指令，可能是指令本身壞了」那條，跑之前先確認路徑。該章第 7、9 項兩支腳本都掃不到，只能人工。

附帶的樣板：

- [`assets/bs4-compat.css`](assets/bs4-compat.css) — 相容層起手樣板，數值取自 BS 4.6.2。**用刪的不要用加的**，用法見 `references/09-bs4-compat-layer.md`。

## 搬到下一個專案時要先確認的事

這份 checklist 是從實際專案（jQuery + 舊版 Bootstrap + 手刻 CSS 的活動樣板站）長出來的，不是每個舊專案的起始狀態都一樣。套用到新專案前，先跟使用者確認：

1. **現有 Bootstrap／jQuery 版本**——用 `references/04-bootstrap-upgrade.md` 的「步驟 0：判定起始版本（兩層偵測）」實際掃一次，不要看 CDN 網址的版本號就下結論：「載入哪一版」和「markup 寫成哪一版的樣子」是兩件會不一致的事，前手升過檔案卻沒改 HTML、或只升了幾支頁面都很常見。若專案本來就是 BS5 且 markup 也是 BS5，節點 7 可以跳過，但節點 8 仍要確認有沒有殘留的 jQuery。
   同時要在這裡確認**這次版更的來由**：如果是為了通過資安檢測／弱掃／原碼掃描（相當常見），那麼「畫面樣式不得改變」是硬約束，節點 7 之後的做法會跟「單純想現代化」差很多，見上面的「硬約束」一節。
2. **有沒有後端渲染能力**（Apache SSI、PHP include、Node 後端等）——這決定節點 3「共用區」要用 SSI/後端 include 還是純前端 JS fetch 注入，兩者的 SEO 與首屏閃爍風險不同，見 `references/02-modernize.md`。
3. **CDN 化的資源是不是被客製修改過**——如果 vendor 套件裡有專案自己的 patch，不能直接換成官方 CDN 版本，這點在 `references/02-modernize.md` 節點 6 有寫。
4. **有沒有掃描報告、是誰出的**——節點 10 要對著實際的弱點掃描／原始碼掃描報告做，不是憑空想像可能有哪些問題。先確認：報告在不在手上、用哪個工具掃的（不同工具的規則名稱與誤報型態差很多）、有沒有複掃的時間點與次數限制。**同時要確認你對主機設定有沒有權限**——弱掃有一大半的發現項修在伺服器層（安全標頭、目錄列表、TLS），沒有權限的話那些項目只能整理成清單交給主機管理者，這會影響整個節點的排程與交付形式。
5. **是否已有 SCSS/建置流程**——如果專案完全沒有建置工具，節點 5 預設是「手動編譯或請使用者自己跑 sass CLI」；若使用者願意額外導入 npm + sass（`tpl_fortune_tcnews` 已跑過一次完整配方，commit `75cb025`），`references/02-modernize.md` 節點 5 底下的「若使用者同意導入 npm + sass 建置工具」一節有完整可沿用的資料夾結構、`@use` 順序陷阱、資源路徑重算方法與收尾檢查清單——但仍然要先問使用者要不要做，這改變了專案「純靜態、雙擊即用」的性質，不能因為已經有配方就跳過詢問直接加。
