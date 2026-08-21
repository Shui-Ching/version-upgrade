# 節點 7 專章：升級 Bootstrap 到 5.3.7（起點可能是 BS3 或 BS4）

舊站的 Bootstrap 起始版本不是固定的：有的專案停在 BS3，有的停在 BS4，也有被前手半升級過、兩代寫法混在同一份 HTML 裡的。終點都是 5.3.7，但**起點不同，工作量差一個數量級**，所以這一章的順序是「先判起點 → 先估規模 → 才動手」，不是一進來就套表改 class。

## 目錄

- [步驟 0：判定起始版本（兩層偵測）](#步驟-0判定起始版本兩層偵測)
- [步驟 1：估規模、確認策略與升級路徑](#步驟-1估規模確認策略與升級路徑)
  - [選項 3 的兩種執行手法：改 markup 還是補相容層](#選項-3-的兩種執行手法改-markup-還是補相容層)
  - [1-1 BS3 起點：要不要中途經過 BS4？](#1-1-bs3-起點要不要中途經過-bs4)
  - [1-2 用「並存寫法」縮小原子切換的範圍](#1-2-用並存寫法縮小原子切換的範圍)
- [步驟 2：共通工作（BS3、BS4 起點都要做）](#步驟-2共通工作bs3bs4-起點都要做)
- [步驟 3：BS4 → BS5 差異清單](#步驟-3bs4--bs5-差異清單)
- [步驟 4：BS3 → BS5 額外差異清單](#步驟-4bs3--bs5-額外差異清單)
  - [4-7 結構性差異：class 掃描抓不到的那一批](#4-7-結構性差異class-掃描抓不到但會動到整頁的那一批)
- [視覺零變更：當「畫面不能變」是硬約束](#視覺零變更當畫面不能變是硬約束)
  - [前置：先有基準，才有得比](#前置先有基準才有得比)
  - [先確認舊版套件現在到底蓋掉了什麼](#先確認舊版套件現在到底蓋掉了什麼)
  - [另一種查法：直接比對線上版的 CSS 原始檔](#另一種查法直接比對線上版的-css-原始檔不需要-playwright-時)
  - [覆寫層放哪裡](#覆寫層放哪裡看-bootstrap-有沒有被編進專案的輸出檔)
  - [覆寫層要放在層疊順序的哪個位置](#覆寫層要放在層疊順序的哪個位置最容易做錯的一步)
- [步驟 5：驗收](#步驟-5驗收)

另見 [`08-bs5-behavior-traps.md`](08-bs5-behavior-traps.md)：**同名 class 的行為改變（元件層級）**——
class 名稱兩版都在、掃描一定通過、但預設值改了的九項。本章的 4-7 是格線與容器層級的同類問題，
兩章要一起查。

---

## 步驟 0：判定起始版本（兩層偵測）

**不要只看載入的檔案版本就決定走哪條路。**「網站載入哪一版 Bootstrap」和「HTML 寫成哪一版的樣子」是兩件會不一致的事——前手可能升過 CSS 檔卻沒改 markup，也可能只改了幾支頁面。兩層都要看：

### 第一層：載入的是哪一版

看 CDN 網址的版本號、`vendor/` 或 `scss/vendor/` 裡的檔案、`package.json` 的 `dependencies`。

```bash
# CDN 網址與本地檔案引用
grep -rEn 'bootstrap[^"'"'"']*\.(min\.)?(css|js)|bootstrap@[0-9.]+' --include='*.html' .
# 本地檔案開頭的版本註解（Bootstrap 每支發行檔第一行都有 "Bootstrap v4.6.2" 這種標記）
grep -rn 'Bootstrap v' --include='*.css' --include='*.js' --include='*.scss' . | head
```

### 第二層：markup 寫成哪一版

用只存在於某一代的 class 當指紋。這張表是**偵測用**，命中數量是給你判斷用的訊號，不是拿來做取代的對照表——誤判成本很低（你會逐一看過命中的位置），所以寧可多列幾個。

| 指紋 | 只出現在 | 說明 |
|---|---|---|
| `col-xs-`、`col-*-offset-*`、`col-*-push-*`、`col-*-pull-*` | BS3 | BS4 起 `xs` 無 infix、offset 改成 `offset-*` |
| `panel`、`well`、`thumbnail`、`page-header`、`list-group-item-heading` | BS3 | BS4 全數併入 `.card` 或直接移除 |
| `glyphicon` | BS3 | BS4 移除內建圖示字型 |
| `img-responsive`、`img-circle`、`img-rounded` | BS3 | BS4 改名為 `img-fluid`／`rounded-circle`／`rounded` |
| `hidden-xs`、`visible-sm-*`、`center-block`、`pull-left`、`pull-right` | BS3 | BS4 改成 `d-*` 顯示工具與 `float-*`／`mx-auto` |
| `btn-default`、`btn-xs`、`table-condensed`、`label-default` | BS3 | BS4 改名或移除 |
| `navbar-default`、`navbar-toggle`、`navbar-form`、`nav navbar-nav` | BS3 | BS4 navbar 結構整組換掉 |
| `carousel-inner > .item`、`carousel-control.left` | BS3 | BS4 改成 `.carousel-item`／`.carousel-control-prev` |
| `input-group-addon`、`help-block`、`control-label`、`has-error` | BS3 | BS4 表單結構改寫 |
| `card`、`jumbotron`、`media-body`、`badge-primary`、`btn-block` | BS4 | BS3 沒有這些，BS5 又移除了後四者 |
| `float-left`、`ml-3`、`mr-2`、`pl-0`、`text-left`、`font-weight-bold` | BS4 | BS3 用 `pull-*`，BS5 改成 `float-start`／`ms-*`／`text-start`／`fw-bold` |
| `form-group`、`form-row`、`custom-control`、`custom-select`、`input-group-append` | BS4 | BS5 全數移除 |
| `no-gutters`、`card-deck`、`thead-light`、`close`、`text-monospace` | BS4 | BS5 改名或移除 |
| `data-toggle=`、`data-target=`、`data-dismiss=`、`data-ride=` | BS3 及 BS4 | BS5 一律要加 `bs` 命名空間 |

單支指令版（逐項計數，方便一眼看出重心在哪一代）：

```bash
for p in 'col-xs-' 'glyphicon' 'panel' 'thumbnail' 'img-responsive' 'btn-default' \
         'pull-left\|pull-right' 'hidden-\|visible-' 'navbar-toggle\>' 'input-group-addon' \
         'card\>' 'jumbotron' 'form-group' 'no-gutters' 'ml-[0-9]\|mr-[0-9]' 'float-left\|float-right' \
         'data-toggle' 'data-bs-toggle'; do
  printf '%-30s %s\n' "$p" "$(grep -rEoh "$p" --include='*.html' . | wc -l)"
done
```

### 指紋表抓不到的三類，要另外處理

上面那張表是「舊版有、新版沒有的 class 名稱」。有三類漏網之魚，都是實跑時才浮現的：

1. **沒有後綴的 BS3 工具類**：`.hidden`、`.show`、`.hide`、`.invisible`、`.text-hide`、`.sr-only`、`.clearfix`、`.center-block`。用 `hidden-[a-z]+` 這種帶後綴的樣式去掃，`.hidden` 剛好掃不到。BS5 只保留 `.clearfix`、`.invisible`、`.visually-hidden`，其餘要換成 `.d-none` 之類的顯示工具。**漏掉 `.hidden` 的後果是原本隱藏的區塊整個顯示出來**——實測首頁因此多出 267px 的一整條區塊。單獨掃一次：
   ```bash
   grep -rEon 'class="[^"]*\<(hidden|show|hide|invisible|text-hide|center-block)\>' --include='*.html' .
   ```
2. **新舊版都有、但需要子元素補 class 的元件**：`.pagination`、`.breadcrumb`、`.nav`、`.dropdown-menu`。這些 class 在 BS5 依然存在，所以「這個 class 還在不在」的掃描一定通過——但 BS3 是靠 `.pagination > li > a` 這種後代選擇器上樣式，BS5 改成要在子元素寫 `.page-item`／`.page-link`／`.breadcrumb-item`。**沒補的話樣式完全不套用，而 HTML 看起來毫無問題。** 逐一確認：
   ```bash
   grep -rEon 'class="[^"]*\<(pagination|breadcrumb|nav|dropdown-menu)\>' --include='*.html' .
   ```
3. **行為定義改變、class 名稱沒變的**：`.container` 的 clearfix、`.row` 的 flex 化等，見 [4-7](#4-7-結構性差異class-掃描抓不到但會動到整頁的那一批)。

這三類的共通點是**靜態掃描結構上就抓不到**，只能靠升級後的量測（見 [`07-visual-regression-verification.md`](07-visual-regression-verification.md)）。這也是為什麼「grep 乾淨」不能當成驗收通過。

### 三種可能的結果，處理方式不同

1. **兩層一致**（載入 BS4、markup 全是 BS4 指紋）→ 走[步驟 3](#步驟-3bs4--bs5-差異清單)。
2. **兩層一致於 BS3** → 走[步驟 3](#步驟-3bs4--bs5-差異清單)**加上**[步驟 4](#步驟-4bs3--bs5-額外差異清單)，兩份都要看，理由見步驟 4 開頭。
3. **不一致或混用**（載入 BS3 但有 `.card`；某幾頁是 BS4 指紋、其他頁是 BS3）→ **不要自己挑一條路走**。把「哪些檔案命中哪一代的指紋、各幾處」列成清單給使用者看，說明混用代表這個站之前被局部改過，需要確認那些頁面是不是還在用、要不要一起處理。混用狀態下按單一路線批次取代，會把已經升級過的部分改壞。

另外一種常見情況是**載入的版本很新、markup 卻是舊的**——前手把 CDN 版本號改掉但沒改 HTML。這種站現在畫面就已經是壞的（只是沒人發現，或壞在不明顯的地方），先把「現在畫面哪裡壞掉」查清楚再談升級，不然升完會分不出是舊傷還是新傷。

---

## 步驟 1：估規模、確認策略與升級路徑

判完版本先停一下，**不要直接開始改**。BS3 起點尤其要在這裡卡一關。

先跑步驟 0 的計數指令，把數字整理成「受影響檔案數 × 受影響位置數」，然後照命中內容分成三類：

| 類別 | 特徵 | 成本 |
|---|---|---|
| A. 純改名 | 舊 class 有一對一的新 class（`img-responsive` → `img-fluid`） | 低，逐處確認後取代 |
| B. 要換結構 | 舊元件在新版沒有等價物，DOM 要重寫（`panel` → `card`、BS3 navbar、`form-group` 版面） | 中到高，等於重切這一塊 |
| C. 要重做設計 | 舊版靠框架提供、新版整個拿掉的東西（glyphicon 圖示、`bootstrap-theme` 的漸層外觀） | 高，且是產品決策不是技術決策 |

有 B、C 類命中時，把下面三個選項連同各自的估時攤開給使用者選，不要替他決定：

1. **原地升級**：逐處改到 BS5 寫法，維持現有視覺。B 類多的時候這通常是最貴的一條，因為改完還要一頁頁對回原本的樣子。
2. **只保留 grid 與 utility，元件區塊重切**：把 `panel`／navbar／表單那些 B 類區塊當成新做，不去還原舊外觀。B 類集中在少數幾個元件時通常比選項 1 划算。
3. **分批**：先升到「載入 BS5 且不壞」的最小狀態（步驟 2 的共通工作 + A 類改名），B、C 類另開一輪。適合站還在線上、不能長時間半殘的情況。

BS3 起點且 B 類命中數量大時，明講「這個落差本身就是一輪任務的規模，不適合跟其他節點擠在同一個 commit」——這條在節點 7 的原始說明裡就有，這裡是把它變成可執行的判斷。

### 選項 3 的兩種執行手法：改 markup 還是補相容層

選了選項 3（分批）之後還有一個岔路，兩條路對同一段 HTML 給的是相反的指示，要在這裡決定，不要邊做邊換：

| | 改 markup | 補相容層 |
|---|---|---|
| 做法 | 照[步驟 3](#步驟-3bs4--bs5-差異清單)逐處把舊 class 換成 BS5 寫法 | utility class 一律不動，用一支 CSS 把 BS5 移除掉的定義補回來 |
| 工作量 | 頁數 × 每頁數十處，逐處確認 | 集中在一支 CSS，但要盤點站上用到哪些 class |
| 風險形狀 | 分散：每一處都是一次改壞版面的機會 | 集中：相容層寫錯會整站一起錯，但也一次就改得回來 |
| 留下什麼 | 乾淨的 BS5 markup | 一支要維護、且日後要逐段退場的相容層 |

**判準是「改動的分散程度」**：頁數多又沒有共用區（節點 3 還沒做）時補相容層划算；
站小或已經做過共用區抽取時，逐處改名的量沒有想像中大，改 markup 一次到位比較乾淨。

補相容層那條路的完整做法、適用邊界、四支稽核腳本與起手樣板，見
[`09-bs4-compat-layer.md`](09-bs4-compat-layer.md)。**BS3 起點只能用它的一半**——
navbar、`.panel` → `.card`、表單結構是 DOM 重寫，補 CSS 補不出來，那一塊還是得改 markup。

### 1-1 BS3 起點：要不要中途經過 BS4？

這是 BS3 起點一定會被問到的問題，而它的陷阱在於「兩段升級」有兩種完全不同的意思，穩定性差很多。三個選項只有一個是對的：

| | 做法 | 評價 |
|---|---|---|
| A | 直接改，只查 BS4→BS5 清單 | **會漏。** 步驟 4 開頭講的三種失效模式（改名兩次的 class、斷點位移、少寫 class 沒有訊號）全部踩得到 |
| B | **分階段改寫、一次上線 BS5** | **建議走這個。** 心裡把 markup 先拉到 BS4 的寫法，再套步驟 3 拉到 BS5；兩份清單都查過，但中繼站只存在於改寫流程裡，不存在於任何一次部署 |
| C | 真的讓 BS4 上線一次，跑一陣子再升 BS5 | **最貴且最不穩，不要做** |

選項 C 之所以要明確排除（它聽起來很像「穩紮穩打」，所以常常被提出來）：

1. **如果版更的來由是資安檢測，這是反效果**。BS4 官方已停止維護、不再發安全性更新，中途停在 BS4 等於刻意在一個 EOL 版本上線一段時間，弱掃照樣會報。（要寫進交付文件的話，先查一次官方的 EOL 公告確認日期，不要引用二手說法。）
2. **視覺回歸驗收要做兩次**，而且 BS3→BS4 那一段的視覺位移最大（字級 14→16px、flexbox、斷點全在這一段）——等於為一個過渡狀態付全額的基準截圖、像素比對、使用者驗收成本。
3. **會做白工**。改名兩次的 class 會讓你手寫出一批 BS4 中間態程式碼（例如 `.input-group-prepend` 包裹層），下一段又要全部拆掉。
4. **Popper 要裝兩次**（v1 再 v2）。

### 1-2 用「並存寫法」縮小原子切換的範圍

換框架版本本身是原子操作——BS3 markup 配 BS5 CSS 的中間態一定壞，這切不開。但**有一批改動可以在舊版還在跑的時候先做、先上線、先驗證**，把真正要一次到位的範圍縮小到可控。這跟節點 4 的「CSS 選擇器並列而非取代」是同一個思路：不是把舊的換成新的，是讓兩套同時成立。

可以先做的三類：

| 改動 | 為什麼在 BS3 底下不會壞 |
|---|---|
| 補 `.nav-item`／`.nav-link`／`.page-item`／`.page-link`／`.breadcrumb-item`／`.dropdown-item` | BS3 靠後代選擇器（`.nav > li > a`）上樣式，多加這些 class 不影響任何 BS3 規則；BS5 則需要它們才認得元素 |
| grid 兩版並存：`class="col-xs-6 col-6"`、`class="col-sm-4 col-md-4"` | BS3 的 CSS 裡沒有 `.col-6`、BS5 的 CSS 裡沒有 `.col-xs-6`，各自忽略對方的那一半（斷點換算規則見步驟 4-1） |
| `data-toggle` 與 `data-bs-toggle` 同時寫在同一個元素上 | BS3 的 JS 只讀 `data-toggle`，BS5 的 JS 只讀 `data-bs-toggle`，互不干擾 |

這些可以獨立成一個 commit、獨立部署、獨立驗證「畫面零變更」，通過之後再進行真正的切換。好處是切換那一刻要同時排查的變數少很多——出問題時你已經知道不是這三類造成的。

**誠實的限制**：不是所有東西都能並存。這幾項必須跟切換同時發生，沒辦法提前：

- `bootstrap-theme` 移除造成的按鈕外觀變化。
- `btn-default` → `btn-secondary` 的顏色差異（兩個 class 同時掛會撞色，不能並存）。
- Reboot 造成的全域字級與間距位移。
- DOM 整組重寫的元件（navbar、`.panel` → `.card`、表單結構）——結構只能有一種。

所以並存策略是**縮小**原子切換的範圍，不是消除它。動手前先把「哪些提前做、哪些必須同時做」列成兩份清單，切換當下要驗的就是第二份。

---

## 步驟 2：共通工作（BS3、BS4 起點都要做）

### 2-1 換掉載入的檔案

走 CDN 的話只要改版本號並重算 SRI，但**版本號、路徑、雜湊三件事都要照節點 6 的流程重新查證**（jsDelivr flat API 確認路徑存在 → `curl` 下載實檔 → `openssl` 算 sha384），不要沿用舊的 hash、也不要憑印象拼網址。

三個容易漏掉的檔案層級變動：

- **`bootstrap-theme.css`／`bootstrap-theme.min.css` 在 BS4 之後不存在**。BS3 站幾乎都有這支（提供按鈕漸層、陰影那種 2013 年的外觀）。照「改版本號」的直覺去動它，會得到一個 404 的網址——而依節點 6 講的，SRI 加在一個載不到的資源上是安靜失敗，畫面不會噴錯只會少掉一批樣式。正確做法是**整行刪掉**，並且要告訴使用者「原本的漸層／立體按鈕外觀會消失」，這是一個看得見的視覺變更，不是無痛替換。
- **JS 檔案要選 bundle 版還是分離版**：BS5 的 dropdown、tooltip、popover 需要 Popper v2。`bootstrap.bundle.min.js` 已經把 Popper 打包進去，一支就夠；如果專案原本有獨立引入 Popper v1（BS4 常見）或 BS3 完全沒有 Popper，改用 bundle 版最單純，同時把舊的 Popper `<script>` 刪掉。留著舊 Popper v1 會讓這些元件定位錯亂。
- **BS5 的 CSS 檔名沒變（`bootstrap.min.css`），但如果專案是走節點 5 的 SCSS 編譯**，換的是 `scss/vendor/` 底下那份 partial 的內容，且要重新確認 `@use` 順序與 `url()` 相對路徑——理由與做法見 `02-modernize.md` 節點 5 的三個編譯期陷阱。

### 2-2 `data-*` 加上 `bs` 命名空間

BS5 把所有行為性 data 屬性改成 `data-bs-*`。這是全站逐處的機械替換，但**遺漏不會噴錯，只會讓那個元件安靜地沒反應**（點了 modal 按鈕沒事發生），所以要靠 grep 收尾而不是靠肉眼。

```bash
# 升級前：把所有還沒加命名空間的行為屬性抓出來
grep -rEon 'data-(toggle|target|dismiss|ride|slide|slide-to|parent|backdrop|keyboard|placement|content|trigger|offset|spy|interval|delay|animation|html|container|boundary|reference|autohide|focus|show|touch)=' --include='*.html' --include='*.js' --include='*.css' --include='*.scss' .
```

三個常見的漏網位置：

- **JS 裡用屬性選擇器抓元素**（`document.querySelectorAll('[data-toggle="tab"]')`、jQuery 的 `$('[data-toggle="tooltip"]')`）——改了 HTML 沒改 JS，選擇器就抓不到東西。所以上面的 grep 要連 `*.js` 一起掃。
- **CSS 裡用屬性選擇器上樣式**（`.btndrop[data-toggle='collapse'] span:after { ... }`）——手風琴與展開鈕的 `:after` 箭頭很常這樣寫。改了 HTML 沒改 CSS，這條規則就選不到任何元素。**症狀是「箭頭不見了、CSS 吃不到」而不是「元件失效」**，跟 data 屬性改名聯想不起來，會繞遠路。所以上面的 grep 也要連 `*.css`／`*.scss` 一起掃，HTML 內嵌的 `<style>` 區塊同樣涵蓋在 `*.html` 那一項裡。
- **不是 Bootstrap 的 data 屬性不要動**：專案自己寫的 `data-target`（例如自製的分頁切換）跟 Bootstrap 的 `data-target` 長得一樣。判斷方法是看這個屬性旁邊有沒有 Bootstrap 的 `data-toggle`，或這個值有沒有被專案自己的 JS 讀取。改錯會把自製功能弄壞，而且同樣是安靜失效。

批次替換可以用本 skill 附的腳本，它刻意把 HTML 與 CSS 綁在一起改（只改一邊正是上面第二點的成因），並會遞迴子資料夾、跳過 `vendor/`。**先跑 `--dry` 確認影響範圍再實際執行**：

```bash
node .claude/skills/legacy-site-modernization/scripts/migrate-data-attrs.js <專案目錄> --dry
```

腳本的替換清單是固定的（見原始碼上方的 `ATTRS`），仍要用上面那道 grep 收尾確認沒有漏網；上面第三點「不是 Bootstrap 的 data 屬性」腳本判斷不了，跑完要逐處看過 diff。

### 2-3 JS 呼叫改成 BS5 的原生 API

BS5 不吃 jQuery，元件要嘛用 `data-bs-*` 屬性驅動，要嘛用 `bootstrap.*` 建構式：

```js
// BS3／BS4 的 jQuery 寫法
$('#myModal').modal('show');
$('[data-toggle="tooltip"]').tooltip();

// BS5
const modal = new bootstrap.Modal('#myModal');   // 建構式接受 CSS 選擇器字串
modal.show();
document.querySelectorAll('[data-bs-toggle="tooltip"]')
	.forEach(el => new bootstrap.Tooltip(el));    // 沒有集合語意，要自己 forEach
```

另外 BS5 把公開靜態方法的底線拿掉了（`_getInstance()` → `getInstance()`）。取既有實例用 `bootstrap.Modal.getInstance(el)`，或用 `getOrCreateInstance(el)` 省掉「不存在就新建」的判斷。

**這一小節只處理「Bootstrap 元件的呼叫寫法」，不處理頁面自己寫的 jQuery**——後者是節點 8 的事，見 `05-remove-jquery.md`。兩者分開做才分得清失效是哪一邊造成的，這是節點 7 必須排在節點 8 之前的原因。

### 2-4 全站字級與間距會整體位移（最容易被低估的一項）

BS4 起把全域 `font-size` 從 14px 改成 16px、單位從 px 改成 rem、`box-sizing` 與 Reboot 的預設樣式也重寫過。結果是**沒有任何一個 class 壞掉，但整站的字級、行高、間距、表單元件高度全部微幅位移**。BS3 起點的站感受最明顯（等於一次吃下兩代的 Reboot 變更）。

這件事沒有 grep 抓得出來，只能看畫面。做法是升級前先把每一支頁面在多個寬度下截圖存起來（節點 6 的收尾驗證已經有一套 Playwright 截圖流程，沿用即可），升級後同角度再截一次做對照。

接下來怎麼處理，取決於這次版更的來由：

- **「順便現代化、可以接受新外觀」** → 把位移的事實與截圖對照拿給使用者看，由他決定接受新預設還是哪幾處要調回來。**不要逐處硬調 px 數字**，那等於在新框架上重建舊框架的度量。
- **「畫面不能變」是驗收條件**（為了過資安檢測而升版最常見）→ 走下面的[視覺零變更](#視覺零變更當畫面不能變是硬約束)一節，用覆寫層一次把預設值調回去。

---

## 步驟 3：BS4 → BS5 差異清單

**這一節假設你走的是「改 markup」那條路。** 若在步驟 1 選了[補相容層](#選項-3-的兩種執行手法改-markup-還是補相容層)，下面的對照表仍然要看（它是判斷「哪些 class 需要補」的依據），但右欄要當成「相容層要還原成什麼」而不是「HTML 要改成什麼」，做法見 [`09-bs4-compat-layer.md`](09-bs4-compat-layer.md)。

以下依官方 [Migrating to v5](https://getbootstrap.com/docs/5.3/migration/) 整理。**這是導航用的地圖，不是可以直接餵給 `sed` 的腳本**——同一個字串在不同脈絡下可能不是 Bootstrap 的 class（`.close` 尤其常見於專案自己的樣式），而右欄標「要重寫」的項目根本沒有一對一對應。每一項動手前先用 grep 把命中位置列出來逐一看過；表上沒列到的項目回去查官方文件，不要憑印象補。

### 方向性 utility 改成邏輯屬性（BS5 為了支援 RTL）

| BS4 | BS5 |
|---|---|
| `.float-left` / `.float-right` | `.float-start` / `.float-end` |
| `.ml-*` / `.mr-*` | `.ms-*` / `.me-*` |
| `.pl-*` / `.pr-*` | `.ps-*` / `.pe-*` |
| `.border-left` / `.border-right` | `.border-start` / `.border-end` |
| `.rounded-left` / `.rounded-right` | `.rounded-start` / `.rounded-end` |
| `.text-left` / `.text-right` | `.text-start` / `.text-end` |

這批是純改名，風險低但數量通常很大。注意 `.ml-*`／`.mr-*` 的 grep 要鎖數字結尾（`ml-[0-9]`），否則會誤命中專案自己的 `.ml-wrapper` 這種名稱。

### 文字 utility

| BS4 | BS5 |
|---|---|
| `.font-weight-bold` / `.font-weight-normal` / `.font-weight-light` | `.fw-bold` / `.fw-normal` / `.fw-light` |
| `.font-italic` | `.fst-italic` |
| `.text-monospace` | `.font-monospace` |

### 純改名的元件 class

| BS4 | BS5 |
|---|---|
| `.no-gutters` | `.g-0` |
| `.close` | `.btn-close`（BS5 的 `.btn-close` 是背景圖 `×`，不再需要裡面的 `<span>&times;</span>` 子元素，要一併刪掉） |
| `.badge-primary` 等 `.badge-*` 顏色 | `.bg-primary` 等背景色 utility（`.badge` 本身保留） |
| `.badge-pill` | `.rounded-pill` |
| `.thead-light` / `.thead-dark` | `.table-light` / `.table-dark` |
| `.custom-select` | `.form-select` |
| `.custom-range` | `.form-range` |
| `.custom-control.custom-checkbox` / `.custom-radio` | `.form-check` |
| `.custom-control.custom-switch` | `.form-check.form-switch` |

### 沒有一對一對應、要重寫結構的

| BS4 | BS5 的做法 |
|---|---|
| `.form-group` / `.form-row` / `.form-inline` | 移除，改用 grid（`.row`／`.col`）加間距 utility（`.mb-3`、`.g-*`）排版 |
| `.input-group-prepend` / `.input-group-append` | 移除包裹層，`.input-group-text`／按鈕直接當 `.input-group` 的子元素 |
| `.custom-file` / `.form-control-file` | 移除，改用 `.form-control` 加 `type="file"` |
| `.btn-block` | 移除，改用 `.d-grid` 搭配 `.gap-*` 包住按鈕 |
| `.jumbotron` | 移除，改用 padding／背景／圓角 utility 組出來 |
| `.media` / `.media-body` | 移除，改用 flex utility（`.d-flex`、`.flex-grow-1`） |
| `.card-deck` | 移除，改用 `.row .row-cols-*` |
| `.card-columns` | 移除，Masonry 版面要另外引入外部套件 |

`.form-group` 這一項是 BS4 起點最花時間的一塊：它在舊站裡幾乎每個表單欄位都有一層，而且承擔的是 `margin-bottom`。批次刪掉會讓表單欄位全部黏在一起，要同時補上 `.mb-3`（或專案自訂的間距），不是單純刪除。

### 依賴與瀏覽器支援

- Popper v1 → v2（見步驟 2-1，用 bundle 版最省事）。
- 不再依賴 jQuery（節點 8 的前提）。
- Sass 編譯器要 Dart Sass，LibSass 不再支援——專案若走節點 5 的 npm + sass 流程，確認裝的是 `sass` 套件（Dart Sass）而不是 `node-sass`。
- BS5 放棄 IE10／IE11。舊站的相容性 polyfill、`<!--[if IE]>` 條件註解可以一併清掉，但**先問使用者的目標瀏覽器範圍**，這是可用性決策不是技術決策。

---

## 步驟 4：BS3 → BS5 額外差異清單

**先讀完步驟 3，這一節是「額外」不是「取代」。** BS3 起點要走的是兩段變更的**聯集**：BS3→BS4 的改動與 BS4→BS5 的改動幾乎沒有重疊，只看其中一份必然漏。

最容易踩的是**被改名兩次**的 class：

```
BS3 .pull-left  →  BS4 .float-left  →  BS5 .float-start
BS3 .hidden-xs  →  BS4 .d-none .d-sm-block  →  BS5 同 BS4（但斷點值不同，見下）
```

只查 BS4→BS5 清單的話，`.pull-left` 不在表上，會被當成「跟 Bootstrap 無關的自訂 class」放過去，然後靜靜地失效。所以 BS3 起點的正確做法是：**先照這一節把 markup 拉到 BS4 的寫法（心裡的中繼站，不要真的去裝 BS4），再套步驟 3 拉到 BS5。**「為什麼是心裡的中繼站而不是真的上線一次 BS4」，理由見 [1-1](#1-1-bs3-起點要不要中途經過-bs4)。

以下依官方 [Migrating to v4](https://getbootstrap.com/docs/4.6/migration/) 整理，同樣是導航用的地圖，不是 `sed` 腳本。

### 4-1 grid 斷點整體位移（BS3 起點最高風險的一項）

BS4 在 768px 底下新增了一層 `sm`（576px），造成**同名的 tier 在 BS3 和 BS5 指的是不同寬度**：

| tier | BS3 起始寬度 | BS5 起始寬度 |
|---|---|---|
| `xs`（無 infix） | < 768px | < 576px |
| `sm` | ≥ 768px | ≥ 576px |
| `md` | ≥ 992px | ≥ 768px |
| `lg` | ≥ 1200px | ≥ 992px |
| `xl` | — | ≥ 1200px |
| `xxl` | — | ≥ 1400px |

要**維持原本的 px 生效點**（多數情況下是對的預設，因為視覺稿是照那些寬度畫的），換算要往後推一階：

| BS3 | BS5 |
|---|---|
| `col-xs-*` | `col-*` |
| `col-sm-*` | `col-md-*` |
| `col-md-*` | `col-lg-*` |
| `col-lg-*` | `col-xl-*` |

`hidden-*`／`visible-*`／`col-*-offset-*` 這些帶 tier 的 class 全部適用同一個位移。

**這裡有一個很容易做錯的半套改法**：只把 `col-xs-6` 換成 `col-6`，其他 tier 名稱原封不動留著。這樣改完 grep 是乾淨的、頁面也不會噴錯，但 `col-sm-*` 的生效點從 768px 悄悄變成 576px——實際現象是「手機橫置或小平板寬度下版面提早變成多欄、擠成一團」，而且只在那一段寬度出現，桌機和手機直立都看不到。改完務必用瀏覽器把寬度從 320px 拉到 1400px 連續看過一遍，不要只截幾個固定斷點的圖。

反過來，如果使用者的意思是「順便照現在的裝置比例重新定斷點」，那就不是換算問題而是重新設計 RWD，屬於步驟 1 的選項 2、要另外估時。兩種意圖差很多，判完斷點命中數量後直接問清楚。

### 4-2 元件：BS3 有、BS4 起沒有

| BS3 | BS5 |
|---|---|
| `.panel` | `.card` |
| `.panel-heading` | `.card-header` |
| `.panel-body` | `.card-body` |
| `.panel-footer` | `.card-footer` |
| `.panel-primary` 等顏色變體 | 沒有對應，改用 `.bg-*`／`.text-*`／`.border-*` utility 自己組 |
| `.well` | 沒有對應，用 `.card` 或 padding／背景 utility 組 |
| `.thumbnail` | 沒有對應，用 `.card` 組 |
| `.pager` | 移除，用 `.pagination` 或自製 |
| `.page-header` | 移除，用 border 與間距 utility 自己組 |
| Affix（`data-spy="affix"`） | 移除，改用 CSS `position: sticky` |
| Glyphicons 圖示字型 | 移除，要另外引入圖示庫（Bootstrap Icons、Font Awesome 等） |

Glyphicons 這項是產品決策：站上每一個 `<span class="glyphicon glyphicon-xxx">` 都要換成新圖示庫的對應圖示，而**新舊圖示庫的圖示集合不完全重疊、視覺風格也不同**。先把用到的 glyphicon 名稱列出來（`grep -rEoh 'glyphicon-[a-z-]+' --include='*.html' . | sort -u`），連同「打算換成哪一套」一起問使用者，不要自己挑一套就開始換。

### 4-3 utility 與圖片 class

| BS3 | BS5 |
|---|---|
| `.pull-left` / `.pull-right` | `.float-start` / `.float-end` |
| `.center-block` | `.mx-auto` |
| `.hidden-xs` 等 | `.d-none` 系列（斷點要照 4-1 位移） |
| `.visible-*` | `.d-*-block` 系列（同上） |
| `.hidden-print` / `.visible-print-*` | `.d-print-none` / `.d-print-block` |
| `.img-responsive` | `.img-fluid` |
| `.img-circle` | `.rounded-circle` |
| `.img-rounded` | `.rounded` |
| `.btn-default` | `.btn-secondary`（顏色不一樣，要看畫面確認可接受） |
| `.btn-xs` | 移除，最小只到 `.btn-sm` |
| `.table-condensed` | `.table-sm` |
| `.label` / `.label-default` | `.badge` + `.bg-secondary`（BS4 把 label 併進 badge，BS5 再把顏色拆成 utility，這是連改兩次的例子） |

### 4-4 表單

| BS3 | BS5 |
|---|---|
| `.control-label` | `.form-label`（BS4 是 `.col-form-label`，BS5 一般欄位用 `.form-label`，grid 版面才用 `.col-form-label`） |
| `.help-block` | `.form-text` |
| `.input-lg` / `.input-sm` | `.form-control-lg` / `.form-control-sm` |
| `.form-control-static` | `.form-control-plaintext` |
| `.checkbox` / `.radio` / `.checkbox-inline` / `.radio-inline` | `.form-check`（inline 版加 `.form-check-inline`），結構要重寫 |
| `.has-error` / `.has-warning` / `.has-success` | 改用 `.is-invalid`／`.is-valid` 與 HTML5 驗證 |
| `.input-group-addon` / `.input-group-btn` | 直接放 `.input-group-text`／按鈕在 `.input-group` 底下（BS4 曾要求 `.input-group-prepend` 包一層，BS5 又拿掉了——這是另一個連改兩次、只看單一份清單會改成中間態的例子） |
| `.form-group` | BS3 有、BS4 有、BS5 移除。BS3 起點一樣要處理，做法同步驟 3 的說明（刪除包裹層並補 `.mb-3`） |

### 4-5 導覽列（BS3 起點通常是最大的一塊）

BS3 的 navbar 是 `.navbar-default > .navbar-header + .collapse.navbar-collapse > .nav.navbar-nav > li > a` 這一整套結構，BS5 換成 `.navbar.navbar-expand-{breakpoint} > .navbar-brand + .navbar-toggler + .collapse.navbar-collapse > .navbar-nav > .nav-item > .nav-link`。

這**不是改幾個 class 名稱，是整段 DOM 重寫**，而且 `.navbar-expand-*` 這個 BS3 沒有對等物的 class 決定了「幾 px 以上展開成橫列」——漏掉它 navbar 會固定停在收合狀態。同時 `.navbar-toggle` → `.navbar-toggler`、切換用的 `data-target` → `data-bs-target`、漢堡圖示從三個 `<span class="icon-bar">` 換成單一 `.navbar-toggler-icon`。

實務建議：navbar 直接照 BS5 官方範例重寫一份，再把原本的選單項目與連結搬進去，比逐個 class 對照改快而且不容易留下殘骸。如果專案已經做過節點 3（共用區抽取），navbar 只存在 `components/header.html` 一份，改一次全站生效——這也是節點 3 排在節點 7 前面的價值之一。

### 4-6 其他常見結構變動

| BS3 | BS5 |
|---|---|
| `.nav > li > a` | `.nav-item` + `.nav-link`（BS4 起不再靠 `>` 後代選擇器，class 要寫在元素上） |
| `.pagination > li > a` | `.page-item` + `.page-link` |
| `.breadcrumb > li` | `.breadcrumb-item` |
| `.dropdown-menu > li > a` | `.dropdown-item`（直接掛在 `<a>`／`<button>` 上，中間的 `<li>` 拿掉） |
| `.divider` | `.dropdown-divider` |
| 輪播 `.carousel-inner > .item` | `.carousel-item` |
| `.carousel-control.left` / `.right` | `.carousel-control-prev` / `.carousel-control-next` |
| 表格 `.active` / `.success` / `.danger` 等情境色 | `.table-active` / `.table-success` / `.table-danger` |
| 進度條 `.progress-bar-success` 等 | `.bg-success` 等 utility |
| 進度條 `.active`（動畫） | `.progress-bar-animated` |
| `.btn-group-justified` / `.btn-group-xs` | 移除，用 flex utility 自己組 |

`.nav > li > a` 這一類「BS3 靠後代選擇器、BS4 起靠 class」的變動特別危險：**改完之後 HTML 看起來完全合法、也沒有多餘的 class，但樣式就是不套用**，因為 BS5 的 CSS 根本沒有針對 `li > a` 的規則。grep 抓不到「少寫了一個 class」，只能靠畫面確認。

### 4-7 結構性差異：class 掃描抓不到、但會動到整頁的那一批

**這一節是 BS3 起點最重要的一節。** 前面幾節都是「舊 class 換新 class」，掃描抓得到、改完就好。這一節的六項不是 class 問題，是 BS3 與 BS5 對同一個 class **行為定義不同**——HTML 完全不用改、掃描完全乾淨，但畫面會變，而且多半是整頁一起變。

以下每一項都是實跑 BS 3.2.0 → 5.3.7 時實際踩到的，附上實測數字。

| # | BS3 的行為 | BS5 的行為 | 實際後果 |
|---|---|---|---|
| 1 | `.container`／`.container-fluid` 內建 `:before/:after` 的 table clearfix | 移除（格線改走 flex，不需要清浮動） | 內容全是浮動元素的區塊高度直接塌成 0。實測 header 的 `.container` 從 95px 變 0，底下所有內容整體上移 |
| 2 | `.row` 是一般區塊，欄位只在自己的斷點以上 `float: left` | `.row` 是 flex 容器 | flex 項目會建立新的區塊格式化脈絡，**子元素的 `margin-top` 不再穿透到欄位外側**，欄位上緣多出一段間距。實測首頁在 320px 下整頁多了 30px |
| 3 | 同上 | 同一列的 flex 項目被拉成等高 | 換行方式跟著變，清單總高度不同。實測部落格格狀列表在 992px 下短了 144px |
| 4 | 欄位在斷點以下沒有寬度（`width: auto`） | `.row > *` 一律 `width: 100%` | 帶有自訂左右外距的欄位會連同外距一起撐出容器。實測 320px 下整頁水平溢出 15px |
| 5 | `.input-group-btn { font-size: 0 }` 消掉 span 內 inline 元素的行框空隙 | 沒有這個 class | 按鈕外多出約 2px 把 `.input-group` 撐高，**連帶把頁面下半部整體往下推**，整片文字錯位 |
| 6 | `.container` 用 `width` 設寬度 | 用 `max-width` | 站台若有自訂規則靠覆寫 `width` 來取消容器寬度限制，那些規則蓋的是另一個屬性、擋不住。實測浮動標頭從滿版 768px 被夾成 750px |

第 2、3 項是同一個根源（flex 取代 float）但後果不同，兩者都要處理。第 6 項的教訓可以推廣：**parity 規則要用舊框架原本用的那個屬性，不要換成新框架偏好的等價屬性**——站台既有的覆寫是針對舊屬性寫的。

處理方式是在覆寫層把 BS3 的行為補回來，而不是逐處調數字：

```scss
// 1. 容器 clearfix
.container::before, .container::after { display: table; content: ' '; }
.container::after { clear: both; }

// 2、3. 格線改回浮動式：.row 是區塊 + clearfix，欄位在自己的斷點以上才浮動
.row {
    display: block;
    &::before, &::after { display: table; content: ' '; }
    &::after { clear: both; }
}
@media (min-width: 768px) { .row > [class*='col-md-'] { float: left; } }
@media (min-width: 992px) { .row > [class*='col-lg-'] { float: left; } }

// 5. input-group 的行框空隙
.input-group-btn { font-size: 0; }
```

第 4 項不要用 `.row > * { width: auto }` 一次解決——那條規則的權重會蓋掉各級 `.col-*` 的寬度，整個格線就壞了。針對實際有自訂外距的那幾個元素個別處理，並靠[水平溢出量](07-visual-regression-verification.md#三層驗收照這個順序看)確認還有沒有漏網。

**這一節處理完之後接著查 [`08-bs5-behavior-traps.md`](08-bs5-behavior-traps.md)。** 本節是格線與容器層級（後果是整頁位移），08 是同一類問題的**元件層級**版本（`.form-control` 的 height、`.col-*` 的 `position`、`.card-body` 的 padding、元件的 `--bs-*` 變數、專案舊覆寫被特異度反超等九項），後果通常侷限在某一類元件但同樣掃描不到。順序是先本節、後 08——整頁都在位移的時候，逐個元件去查是浪費時間。

### 4-8 Less → Sass、px → rem

BS3 用 Less、BS4 起用 Sass。舊站如果有自己的 Less 檔在覆寫 Bootstrap 變數（`@brand-primary` 這種），這些變數在 BS5 全部改名成 Sass 變數（`$primary`）且變數系統重寫過，不能對照著搬。專案若已走過節點 5 轉成 SCSS，這一段通常已經處理掉了；沒走過的話，這是另一個要納入步驟 1 估時的區塊。

---

## 視覺零變更：當「畫面不能變」是硬約束

舊站升級的常見來由是「要通過資安檢測、要把有 CVE 的套件換掉」，不是「要改版面」。這種情境下畫面維持原樣是驗收條件——使用者端不會有人為版面變動背書，任何一處跑版都會被算成這次改動造成的迴歸。

**核心手法是「把新框架的預設值調回舊值」，不是「逐處微調到看起來差不多」。** 前者是一支集中的覆寫檔、幾十個變數；後者是散落全站的補丁，改完沒有人說得清楚哪些規則是為什麼存在的，而且下次再動任何東西都要重來一遍。

### 前置：先有基準，才有得比

**在動任何一行程式碼之前**，把每一支頁面在各寬度下截圖存檔。沒有基準就無法證明「畫面沒變」，只能靠印象，而印象在改了幾百處之後不可靠。

```bash
# 起本機伺服器，用 Playwright 對每頁每寬度截全頁圖，存成 baseline/<page>-<width>.png
# 寬度至少涵蓋 320 / 375 / 576 / 768 / 992 / 1200 / 1440
```

截圖要用**全頁截圖**（`full_page=True`）而不是只截可視範圍，否則頁面下半部的位移看不到。若頁面有輪播、動畫、隨機排序的內容，這些區塊每次截圖都會不同——先把它們列出來，比對時排除，或在截圖前用 JS 把動畫停在固定影格，不要放著讓它們污染整份比對結果。

截圖之外還要傾印一份 computed style（做法見下一節），兩者用途不同：截圖看得出「哪一塊變了」，computed style 說得出「變的是哪一個屬性、從什麼變成什麼」。只有截圖的話，你會知道按鈕不對但要自己猜是背景色、漸層還是陰影。

### 先確認舊版套件現在到底蓋掉了什麼

**「畫面零變更」的基準是瀏覽器實際渲染的結果，不是程式碼看起來想做什麼。** 這兩件事在舊站經常不一致，而不一致的地方就是既有 bug——框架升級會讓這些 bug「意外被修好」，那同樣是畫面變更，要在動手前發現並讓使用者決定，不是等他事後問「這顆按鈕為什麼變色了」。

最典型的來源是**兩個獨立的 CSS 屬性被誤以為是同一個**。專案覆寫了其中一個、舊套件設了另一個，於是專案的覆寫看起來寫了卻沒生效：

| 專案常寫 | 舊套件常設 | 為什麼蓋不掉 |
|---|---|---|
| `background-color`（甚至加 `!important`） | `background-image: linear-gradient(...)` | 兩個是不同屬性，`!important` 只作用在自己那一個；不透明的漸層會整片蓋住背景色 |
| `border-color` | `border` 簡寫 | 簡寫會一併重設 `border-style`／`border-width` |
| `background-color` | `background` 簡寫 | 簡寫會把 `background-image` 重設成 `none`（這個方向反過來，是專案的覆寫意外生效） |
| 單獨改 `box-shadow` 的其中一層 | 完整的多層 `box-shadow` | `box-shadow` 只能整條取代，沒有辦法只改其中一層 |

`tpl_fortune_tcnews` 實際踩到的就是第一列：專案的 `_color1.scss` 對 `.btn-primary` 設了 `background-color: #0e6133 !important`（品牌綠），但 `bootstrap-theme@3.2.0` 對同一個 class 設了 `background-image: linear-gradient(#428bca, #2d6ca2)`（BS3 預設藍）。實測 computed style 是「背景色綠、漸層藍」，畫面上渲染出來是**藍色**，品牌綠一個像素都看不到。同一支 theme 的 `.btn-default` 白→灰漸層配上專案的 `.btn { color: #fff !important }`，更做出了一顆白底白字、對比度約 1.05:1 的按鈕。

這種問題**靜態讀 CSS 可以推導，但只有 computed style 能確定**——選擇器權重、載入順序、簡寫展開三者交互作用之後的結果，用眼睛追很容易漏。用本 skill 附的腳本傾印：

```bash
# 升級前
python .claude/skills/legacy-site-modernization/scripts/dump-computed-style.py dump \
    --base http://127.0.0.1:8899 --pages index.html news-info.html \
    --selector ".btn" --out before.json --shots shots/before

# 升級後（同樣的參數，只換輸出檔名）
python .../dump-computed-style.py dump ... --out after.json --shots shots/after

# 只列出真正改變的屬性；完全一致回傳 0，有差異回傳 1
python .../dump-computed-style.py compare before.json after.json
```

腳本預設傾印顏色、背景、字級、行高、圓角、邊框、陰影、內外距這幾組「框架換代最容易悄悄改掉」的屬性，需要別的用 `--props` 指定。它靠「同一頁的第 N 個命中」配對前後兩份資料，所以 DOM 有增刪時會錯位——輸出裡一併印了元素文字，錯位時看得出來。需要 playwright，裝在暫存的 venv，不要動專案的 `package.json` 與 `node_modules`。

**掃到不一致時，不要自己決定要保留還是修正。** 把「程式碼想做什麼／實際渲染成什麼／升級後會變成什麼」三欄列成清單交給使用者。這種既有 bug 常常正好是使用者原本的設計意圖（例如那個品牌綠），修掉反而是回到正確狀態；但也可能有人早就習慣了現在的樣子。這是產品決策。

### 另一種查法：直接比對線上版的 CSS 原始檔（不需要 playwright 時）

上面的 computed style 傾印回答的是「現在渲染出來是什麼」，但有時候要回答的是「這個 token 抄的到底是哪一份來源」——尤其是升級完一段時間後才被回報「畫面跟線上版不一樣」，手上沒有「升級前」的本機環境可以並排跑，只能拿現在還在線上的舊站當基準。這種情況下，把線上版實際載入的每一支 CSS（不只是看起來像主題檔的那幾支——`bootstrap.css`、`bootstrap-theme.css`、專案自己的 `custom.css`、`color1.css`……HTML `<head>` 裡列出的全部都要抓）用 `curl` 下載下來，照 `<link>` 出現的順序手動追一次疊色，跟量測 computed style 一樣可靠，還多一個好處：**看得到「為什麼」，不只是「是什麼」**。

`tpl_fortune_tcnews` 的分頁連結文字色是一個例子：`_visual-parity-tokens.scss` 裡 `$legacy-pagination-color` 原本設成 `#428bca`，註解寫「BS3 的分頁連結色是它自己的藍，不是本站的品牌綠——這是升級前就存在的狀況，依畫面不能變原樣還原」。這句話讀起來像量過的結論，但實際上只抄到了 `bootstrap.css`（BS3 框架本身）的 base 值，漏看了線上版另外載入的 `bootstrap-theme.css` 有一條 `.pagination > li > a, .pagination > li > span { color: #666 }`——兩條規則選擇器特異度完全相同，`bootstrap-theme.css` 排在 `bootstrap.css` 之後載入，級聯規則是後者勝出，線上版實際顯示的是灰色 `#666`，不是藍色。把這幾支 CSS 抓下來、對照 `<link>` 順序讀一次，幾分鐘就能定位到問題出在哪一支檔案的哪一條規則；只看 computed style 的最終顏色差異，只會知道「顏色不對」，不會知道「為什麼不對、該改哪個 token」。

**這也是判斷既有 parity token 註解可不可信的一個訊號**：上面 `.btn-primary` 的案例、這裡的分頁案例，可信的註解都指得出具體來源（哪一支 CSS 檔案、第幾行，或量測腳本的輸出）；「這是升級前就存在的狀況」「依原樣還原」這類只有結論、沒有出處的措辭，語氣即使篤定，也可能只是沒測到、憑印象猜的。**幫專案既有的 parity token 做覆核時，優先複查註解裡沒有具體來源引用的那些**——不一定錯，但錯的機率明顯比有引用的高。

### 覆寫層放哪裡：看 Bootstrap 有沒有被編進專案的輸出檔

**判斷依據不是「專案有沒有 Sass 建置」，是「Bootstrap 本身在不在編譯圖裡」。** 這兩件事很容易被當成同一件——專案做過節點 5、有 `package.json` 和 `scss/`，但 Bootstrap 仍然是 HTML 裡一行 CDN `<link>`，這種組合相當常見（節點 6 的 CDN 化本來就會把套件從編譯圖裡抽出來）。這種情況下 Sass 變數覆寫是用不了的，因為你沒有在編譯 Bootstrap。

**情況 A：Bootstrap 從源碼編進專案的輸出檔**（`scss/vendor/` 底下有 Bootstrap 的 partial，`main.scss` 有 `@use` 它）

覆寫 Bootstrap 的 Sass 變數，讓新版直接編譯出舊版的數值。變數必須在 `@use` Bootstrap 之前設定：

```scss
// scss/theme/_bs-visual-parity.scss 的角色：把 BS5 的預設值調回舊版數值
// 這支檔案的存在理由是「維持升級前的外觀」，未來若要真的換新外觀，整支刪掉即可
@use '../vendor/bootstrap' with (
	$font-size-base: 0.875rem,   // 舊版 14px；實際數值要照下面的方法從專案手上的舊檔案讀出來
	$line-height-base: 1.428571429,
	$grid-gutter-width: 30px,
	// ...
);
```

**情況 B：Bootstrap 走 CDN（不管專案有沒有 Sass 建置）**

改不了 Sass 變數，因為你拿到的是編譯好的 `bootstrap.min.css`。但 BS 5.3 把大量數值改用 CSS 自訂屬性（`--bs-*`）輸出，可以在一支**排在 Bootstrap `<link>` 之後**的樣式檔裡覆寫：

```css
:root {
	--bs-body-font-size: 0.875rem;
	--bs-body-line-height: 1.428571429;
	--bs-border-radius: 4px;
}
```

專案若有 Sass 建置，這段就寫進 `scss/theme/` 底下的 parity partial，編譯進既有的輸出檔——但要確認那支輸出檔的 `<link>` 真的排在 Bootstrap CDN `<link>` 之後（判斷方法見 `02-modernize.md` 節點 6 的實跑補充第 3 點，層疊順序看的是 `<link>` 的先後，不是 `@use` 的行號）。

CSS 變數覆寫不到的部分（例如 grid gutter、container 各斷點寬度，有些是編譯期算好寫死在規則裡的），才退到寫具體規則覆寫。**這是最後手段，不是起手式**——每寫一條具體規則就多欠一筆技術債，寫之前先確認真的沒有變數可用。

**情況 C：有 Sass 建置，但 Bootstrap 目前走 CDN，而你想要情況 A 的完整控制**

做法是把 Bootstrap 源碼拉進 `scss/vendor/` 從源碼編譯，HTML 那行 CDN `<link>` 拿掉。**這是專案性質的改變，要先問使用者**，而且與節點 6「內部資源改成 CDN」的方向相反（等於把一個已經 CDN 化的套件收回本地編譯），連帶影響：

- 失去 CDN 的快取與頻寬優勢，也不再有 SRI 保護那一段——但相對地，資源變成同源，弱掃報告裡的「外部資源」類發現項會少一項。
- 輸出的 CSS 檔會大很多（除非同時做 tree-shaking，只 `@use` 用得到的 Bootstrap 模組）。
- 之後升級 Bootstrap 要重跑編譯，不能只改版本號。

值不值得，取決於情況 B 的 CSS 變數覆寫夠不夠用。**先試情況 B**，把改不掉的項目列出來，再拿著那份清單問使用者要不要走情況 C，不要一開始就選最重的做法。

不管哪種情況，**覆寫都集中在單一檔案、開頭寫清楚這支檔案的用途**，不要散落在各個 partial 裡。

### 覆寫層要放在層疊順序的哪個位置（最容易做錯的一步）

**放在站台所有樣式之前，不是之後。** 直覺會想「它要蓋掉 Bootstrap，所以要排在最後」——這是錯的，而且錯得不明顯。

理由是還原升級前的層疊結構：升級前 `bootstrap.min.css` 是在站台的 CSS 之前載入的，**站台的樣式本來就靠「排在框架後面」來覆寫框架預設值**。覆寫層是在模擬舊版框架，就要站在舊版框架原本的位置。放到最後的話，它會連站台自己的覆寫一起蓋掉——那些覆寫原本是刻意要贏過框架的。

實測差別：把覆寫層從 `main.scss` 最後移到最前面，768px 的像素差異從 22198px 降到 2690px，而且改的只是一行 `@use` 的位置。

順帶一提，這也解釋了為什麼**新版框架的 CSS 自訂屬性（`--bs-*`）不一定夠用**：設 `--bs-btn-font-size` 是餵給框架自己的 `.btn { font-size: var(...) }`，權重是一個 class；如果站台有一條同權重、排在後面的 `.btn-primary { font-size: 15px }`，變數餵出來的值會被蓋掉。舊框架原本是靠 `.input-group-lg > .input-group-btn > .btn` 這種三層選擇器的權重贏過去的——**遇到這種情況，覆寫層也要直接寫實際屬性、用對等的權重**，不能只設變數。

### 要調回哪些值：從專案自己的舊檔案讀，不要背表

高影響的項目大致是這幾類，但**不要拿任何一份記憶中的數值直接填**——舊版 Bootstrap 的檔案就在專案裡（`vendor/`、`scss/vendor/`，或用 `curl` 抓對應版本的 CDN 檔案），直接把數值讀出來才是準的，不同小版本也可能有差異：

| 類別 | 為什麼影響大 | 去哪裡讀舊值 |
|---|---|---|
| 基礎字級與行高 | 全站每一段文字的高度都由它決定，差 2px 會讓整頁往下推 | 舊檔案的 `body { font-size; line-height }` |
| 字體家族 | BS5 預設用系統字體堆疊，跟舊版指定的字體不同，中文站的表現差異尤其明顯 | 舊檔案的 `body { font-family }` |
| grid 間距（gutter） | 每一個 column 的左右 padding，全站版面寬度都受影響 | 舊檔案的 `.col-*` 或 `.row` 的 padding／margin |
| container 各斷點最大寬度 | 直接決定內容區塊多寬 | 舊檔案的 `.container` 各 media query 底下的 `width` |
| 主色與各語意色 | 按鈕、連結、badge 的顏色全部跟著變 | 舊檔案的 `.btn-primary` 背景色等 |
| 連結樣式 | BS 5.3 的連結預設帶底線，舊版多半沒有——這是一眼就看得到的差異 | 舊檔案的 `a { color; text-decoration }` |
| 圓角半徑 | 按鈕、卡片、表單元件的邊角 | 舊檔案的 `.btn`／`.form-control` 的 `border-radius` |
| 表單元件高度與 padding | 輸入框變高會把整個表單推開 | 舊檔案的 `.form-control` 的 `height`／`padding` |
| 標題 h1–h6 的字級與字重 | 舊版標題級距跟新版不同 | 舊檔案的 `h1`～`h6` 規則 |

做法是把舊版檔案跟新版檔案並排 `diff`，或寫一段一次性的腳本把兩邊的關鍵規則抓出來對照，逐項填進覆寫層。這比一頁一頁看截圖找差異快得多，而且找得齊。

**「舊檔案」不是只有 `bootstrap.min.css` 一支。** 舊站常見的另一種結構是「框架本體 + 客製主題檔」分開兩支載入（例如 BS3 站台常見的 `bootstrap.css` + `bootstrap-theme.css`），後者專門疊上專案自己調過的外觀值，會蓋掉框架的官方預設值。只查框架本體、直接套用官方文件寫的預設數值，量出來的 token 會是錯的——`tpl_fortune_tcnews` 這個專案就踩過：`.container` 在 ≥1200px 一開始記成 BS3 官方預設的 `1170px`，但正式站的 `bootstrap-theme.css` 裡有一條 `.container { width: 1080px }` 蓋掉了框架預設，量測時沒把這支檔案抓進來，記錯了一路沿用，直到跟正式站逐字對照才發現。動手量測前先把目標頁面 `<head>` 裡實際載入的**全部** CSS `<link>` 列出來，不要只看檔名裡有 `bootstrap` 的那一支。

補一點：`bootstrap-theme.css` 裡藏的不只是數值被改（像上面 `.container` 寬度這種情況），也可能是整條屬性被拿掉——例如 `.breadcrumb` 的 `background`、`margin` 直接被歸零，不是換了個數字，是規則本身消失。這種情況下光靠 BS5 的 CSS 變數填新值還不夠，因為變數模型本身可能就表達不出舊版的寫法：BS5 的 `--bs-breadcrumb-padding-x` 是左右對稱的單一變數，做不出舊版「左 0、右 15px」這種只改一邊的不對稱內距，要在同一條規則裡另外加一行 longhand（例如 `padding-left: 0`）疊上去才行。

### 沒有變數可以還原的三種東西

有些差異不是數值問題，變數調不回來。這三種要**事前列出來讓使用者拍板**，不要改完才報告：

1. **BS3 的 `bootstrap-theme.css` 外觀**（按鈕漸層、內陰影、文字陰影）。BS5 沒有對應的變數。可行做法是把舊 `bootstrap-theme.css` 裡按鈕／導覽列那幾段規則抽出來，改寫成對應 BS5 class 名稱後放進覆寫層——這能做到幾乎一樣，但等於把一份 2013 年的樣式手動維護下去。另一個選項是接受扁平化外觀。哪個對，是使用者的決定。
2. **Glyphicons 換成別的圖示庫**。圖示的線條粗細、視覺重心、尺寸基準都不同，不可能完全一樣。先把用到的圖示列出來，連同「打算換成哪一套」一起問。
3. **BS3→BS5 有些元件是 DOM 重寫**（navbar、表單、`.panel` → `.card`）。重寫後的 DOM 結構不同，套用的樣式也不同，要靠覆寫層把外觀補回去。這是「視覺零變更」最花時間的一塊，要單獨估時——通常比其他所有項目加起來還久。

### 一個要跟使用者確認的取捨

「畫面零變更」與「BS3 直接跳 BS5」這兩個目標互相拉扯：跨兩代的變更越多，要靠覆寫層補回來的東西就越多，而覆寫層本身也是要維護的東西。如果這次版更的**真正目的是修掉套件的已知漏洞**，那還有一條成本低很多的路——升到同一大版的最後一個修補版（BS3 的最後版本是 3.4.1，它修掉了 BS3 幾個 XSS 類 CVE），視覺變動幾乎為零，但**留在一個已經停止維護的大版本上，之後不會再有安全性更新**。

這是「這一次省事」與「之後不用再處理」的取捨，屬於使用者的決定。把兩條路的成本與後果攤開來問，不要自己選；使用者已經指定要升到 5.3.7 的話就照做，這段只是確保他知道有另一條路存在。

---

## 步驟 5：驗收

grep 只能證明「舊寫法沒有殘留」，證明不了「畫面對不對」。兩層都要做。

### 5-1 靜態掃描：舊寫法殘留

```bash
# 沒加命名空間的 Bootstrap data 屬性（應為 0 筆）
grep -rEon 'data-(toggle|target|dismiss|ride|slide|slide-to|parent|spy)=' --include='*.html' --include='*.js' --include='*.css' --include='*.scss' .

# BS4 方向性 utility 殘留
grep -rEon '\<(float-(left|right)|m[lr]-[0-9]|p[lr]-[0-9]|text-(left|right)|font-weight-|font-italic|no-gutters|btn-block|badge-(primary|secondary|success|danger|warning|info|light|dark|pill)|thead-(light|dark)|custom-(select|range|control|file)|input-group-(append|prepend)|form-(group|row|inline)|jumbotron|media-body|card-(deck|columns)|text-monospace)\>' --include='*.html' --include='*.js' --include='*.scss' .

# BS3 殘留（BS3 起點才需要）
grep -rEon '\<(col-xs-|col-(sm|md|lg)-(offset|push|pull)-|glyphicon|panel(-heading|-body|-footer|-default|-primary)?|well|thumbnail|img-(responsive|circle|rounded)|pull-(left|right)|center-block|hidden-(xs|sm|md|lg|print)|visible-|btn-(default|xs)|table-condensed|label-(default|primary|success|info|warning|danger)|control-label|help-block|input-(lg|sm)|input-group-(addon|btn)|has-(error|warning|success)|navbar-(default|toggle|form)|carousel-inner|page-header|pager)\>' --include='*.html' --include='*.js' --include='*.scss' .
```

三個指令都要連 `*.scss`／`*.css` 一起掃，不能只掃 HTML——專案自己的樣式檔裡常有針對舊 class 的覆寫規則（`.panel-heading { background: #eee; }`），HTML 改完了但 CSS 還在鎖舊名稱，那條規則就變成死碼，而新的 `.card-header` 沒有拿到該有的樣式。這類「HTML 改了、CSS 沒跟上」的漏改，畫面上表現為某一塊顏色或間距怪怪的，很難直覺聯想到是升級造成的。

命中結果照 `02-modernize.md` 開頭那條原則處理：**掃描是第一輪篩選，不是驗收證明**，命中的每一處都要看過再決定是不是真的要改（專案自訂的 `.well-known-section` 這種名字會被上面的 `well` 命中）。

上面三道 grep 找的是「舊寫法有沒有殘留」。反方向的問題——「哪些 class 在舊版有定義、BS5 沒有、而專案自己的 CSS 也沒接手」——可以用腳本自動比對，它會把兩份 Bootstrap 原始碼對起來看，比人工核對表格齊：

```bash
git show HEAD:vendor/bootstrap/css/bootstrap.css > /tmp/bs4.css
node .claude/skills/legacy-site-modernization/scripts/audit-bs4-classes.js <專案目錄> /tmp/bs4.css
```

**它只驗證 class 是否存在，抓不到同名但行為改變**——那一批在 [`08-bs5-behavior-traps.md`](08-bs5-behavior-traps.md)。腳本只讀扁平結構（`<專案目錄>/*.html` 不遞迴、`<專案目錄>/css/*.css`），路徑對不上的專案不會報錯、只會回報乾淨，跑之前先確認。

### 5-2 執行期驗證

沿用節點 6 的收尾流程（本機靜態伺服器 + Playwright 無頭瀏覽器），同時看三件事：

1. **console 與 `pageerror`**：`bootstrap is not defined`、`Cannot read properties of undefined` 這類通常代表 JS 檔沒載到或 API 用錯版本。
2. **`requestfailed`**：抓 SRI 不符與 404（尤其是被誤留下來的 `bootstrap-theme.min.css`）——這兩種都是安靜失敗，不看這個清單看不出來。
3. **截圖對照**：升級前的截圖要在動手前先拍（見[視覺零變更](#視覺零變更當畫面不能變是硬約束)的「前置」）。至少涵蓋 320px、576px、768px、992px、1200px 五個寬度；BS3 起點因為有 4-1 的斷點位移，中間寬度要用連續拉動的方式再看一遍，不能只看這五個點。

### 5-3 像素比對（「畫面不能變」時，這是驗收證明本身）

**完整做法、腳本用法與量測本身的陷阱寫在 [`07-visual-regression-verification.md`](07-visual-regression-verification.md)，動手前讀那份。** 下面只留原則。

肉眼比對兩張截圖抓不到 2～3px 的位移，而那正是框架換代最典型的差異。用程式算：

```bash
# 用 ImageMagick 算兩張圖的差異像素數，並輸出標示差異位置的圖
compare -metric AE baseline/index-1200.png after/index-1200.png diff/index-1200.png
```

沒有 ImageMagick 的話用 Python 的 Pillow 逐像素比對也可以（讀兩張圖、`ImageChops.difference`、算非零像素數與 bounding box）。重點是要拿到**兩個數字**：差異像素數，以及差異集中在哪個區域——後者比前者有用，因為它直接指出「是哪一塊跑掉了」。

比對結果怎麼讀：

- **整張圖幾乎全紅** → 通常不是幾百處都壞了，而是有一個全域值沒調回來（字級、行高、gutter），把整頁的東西往下或往旁邊推。先找那一個變數，不要一塊一塊去修。
- **差異集中在某個元件** → 那個元件的 DOM 或 class 改寫沒補回外觀，針對它處理。
- **兩張圖高度不同導致無法比對** → 這本身就是結果：頁面總高變了，代表有累積性的間距差異。先處理到高度一致再談逐像素。

像素比對要跟 computed style 比對搭配著用，兩者各自回答一半問題：像素比對告訴你「哪一塊、多大範圍變了」，`scripts/dump-computed-style.py compare` 告訴你「變的是哪一個屬性、從什麼變成什麼」。只做前者會卡在「知道不對但不知道改哪裡」，只做後者會漏掉版面位移這種不歸屬於單一元素的變化。

**不要把「差異像素數 = 0」當成唯一可接受的標準**——字型 anti-aliasing、瀏覽器版本差異都可能造成零星幾個像素的落差。合理的做法是先把差異降到「只剩下說得出原因的零星點」，然後把差異圖與說明一起交給使用者確認，由他判定可不可接受。無法降到零的項目要具體寫出是哪一塊、為什麼（例如「圖示庫替換，圖示線條粗細不同」），不要用一句「有些微差異」帶過。

### 5-4 收尾報告要寫的事

不要只說「已升級到 5.3.7」。至少要列出：

- 起始版本的判定依據（兩層偵測各看到什麼），以及是否有混用。
- 這一輪實際做了哪些類別（A 改名／B 換結構／C 重做設計），哪些依步驟 1 的決定留到下一輪。
- **已知會改變的視覺**：`bootstrap-theme` 移除造成的按鈕外觀變化、`btn-default` → `btn-secondary` 的顏色差異、全域字級從 14px 變 16px 的整體位移、圖示庫替換。這些不是 bug，但使用者一定會看到，事前講跟事後被問是完全不同的兩件事。
- 要手動確認的頁面清單，照節點 9 的兩層寫法（有實際元件在跑的頁面／只是共用了同一支 CSS 的頁面）。
