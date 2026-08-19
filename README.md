# Agent Skills 集合

Agent Skills 集合，主題是**舊站整體版更（Legacy Site Modernization）**：把「接手一個舊版純靜態網站，要整理到能放心維護、能通過資安檢測」這件事拆成 11 個節點。前 10 個彼此有順序依賴——移除沒用的檔案 → 掃出沒引用的 css/js → 挖出共用區 → 按鈕語意化 → CSS 轉 SCSS → CDN 化 → Bootstrap 升級到 5.3.7 → 移除 jQuery 改寫成原生 JS → 第三方套件升級 → 修復弱點掃描發現項；節點 11（加上「不支援 IE」提示）只依賴節點 7，做法拆在另一支 skill。節點全部走完之後還有一個收尾動作——把這一輪的 commit 整理成交付給客戶、PM 與接手工程師看的「工作項目 × Commit 對照表」，做法拆在第三支 skill。

**正本只有一份，放在 `.claude/skills/`。** 檔案格式遵循 [Agent Skills](https://agentskills.io) 開放標準（`SKILL.md` ＋ `name` / `description` 前綴資料 ＋ 漸進式載入），Claude Code、Codex、GitHub Copilot、Antigravity 等支援同一標準的工具都能直接使用，差別只在各家掃描的資料夾位置不同，對照表見下方〈安裝〉。

## 內容

| Skill | 做什麼 | 什麼時候會被觸發 |
|---|---|---|
| [legacy-site-modernization](.claude/skills/legacy-site-modernization/) | 純靜態舊網站（無 npm/build tool）的 11 節點整體版更流程：除去廢 code → 共用元件化 → 按鈕語意化 → CSS 轉 SCSS → CDN 化 → Bootstrap 升級（BS3/BS4 → 5.3.7）→ 移除 jQuery → 升級第三方套件 → 修復弱點掃描發現項 → 加上「不支援 IE」提示，並訂出「畫面樣式不得改變」的硬約束與三層驗收法 | 提到「整體版更」「除去廢code」「清一下舊專案」「接手舊站要不要重構」「套件太舊要升級」「Bootstrap 3 升 5」「BS4 升 BS5」「把 jQuery 拿掉」「改成原生 JS」，或升級**之後**才回報「版面跑掉」「CSS 吃不到」「modal 打不開」「手風琴箭頭不見」 |
| [legacy-browser-notice](.claude/skills/legacy-browser-notice/) | 節點 11 的做法：在靜態站加上「本站不支援 IE」提示列——UA 判斷、由共用 js 統一注入、CSS 每個顏色先寫靜態值再寫 `var()`（IE 遇到看不懂的值會整條宣告作廢）、z-index 與 iPhone 底部安全區、改完哪些檔案要更新版本號破快取 | 提到「加舊版瀏覽器提示」「IE 提示」「不支援 IE」「提醒使用者換瀏覽器」「IE 版面整個爛掉」「這個提示要全站共用」，或升級 BS5 後發現 IE 開起來是裸文字 |
| [commit-delivery-report](.claude/skills/commit-delivery-report/) | 收尾交付的做法：把這一輪的 commit 回頭整理成「工作項目 × Commit 對照表」——以節點清單（而非 commit 時序）當骨架、每一列的重點放在「工程端須配合什麼、不做會怎樣」、⚠️ 的判準、破快取 commit 的摺疊規則、「未歸屬 commit」的完整性核對，以及貼進 ClickUp／Notion 這類看板工具的做法 | 提到「整理 commit 對照表」「工作項目對照表」「交付文件」「這段時間做了什麼整理給客戶／PM」「要交接給工程師，列一份清單」「版更做完了整理一份交付清單」「修改節點要貼到 ClickUp」 |

**三支要一起安裝。** `legacy-site-modernization` 的節點 11 只寫「做法見 `legacy-browser-notice`」、收尾交付只寫「做法見 `commit-delivery-report`」，都不重複寫做法；少裝任何一支，走到那一步會指向一支不存在的 skill，而且不會有錯誤訊息。

## 安裝

每一支 skill 就是一個資料夾，安裝＝**把 `.claude/skills/` 底下的資料夾原封不動複製到你的工具會掃描的位置**，內容不需要任何修改。

最簡單的做法是把下面整段貼給你的 AI。**路徑表直接寫在提示詞裡**，因為多數 AI 不知道自己該掃哪個資料夾，有些也讀不到網頁：

```
請幫我把 https://github.com/Shui-Ching/version-upgrade 這套 skill 安裝到這個專案。

步驟：
1. 把 repo clone 到暫存資料夾，不要 clone 進專案目錄裡。
2. 把 repo 內 .claude/skills/ 底下的「三個」資料夾都整包複製到
   （legacy-site-modernization、legacy-browser-notice、commit-delivery-report，
     三個缺一不可，第一支的節點 11 會直接指向第二支，收尾交付會指向第三支）
   「你這個工具」在專案層掃描 skill 的位置：
     Claude Code        → .claude/skills/
     OpenAI Codex       → .agents/skills/
     GitHub Copilot     → .github/skills/、.claude/skills/、.agents/skills/ 任一
     Google Antigravity → .agents/skills/
   如果你不確定自己屬於哪一個，就 .claude/skills/ 和 .agents/skills/ 兩個位置
   各放一份，這樣所有工具都掃得到。
3. 刪掉步驟 1 的暫存 clone。
4. 回報：你把三個資料夾分別複製到哪個路徑、各自的 SKILL.md 是否存在。

注意：不要修改 skill 的內容，原封不動複製即可。
裝完可能要重開一次工具，新的 skill 目錄才會被掃到。
```

### 變體

**想裝成全域（所有專案都生效）**：把步驟 2 的路徑換成 `~/.claude/skills/`、`~/.agents/skills/`、`~/.copilot/skills/`、`~/.gemini/config/skills/`（對應下表全域層那一欄）。

**AI 沒有終端機權限**（例如只開了對話框、沒開 agent 模式）：改成自己下載 ZIP 解壓，把 `legacy-site-modernization`、`legacy-browser-notice`、`commit-delivery-report` 三個資料夾拖進下表對應位置，這一步不需要 AI。

### 各工具掃描路徑

| 工具 | 專案層（只在該專案生效） | 全域層（所有專案生效） |
|---|---|---|
| Claude Code | `.claude/skills/<skill>/` | `~/.claude/skills/<skill>/` |
| OpenAI Codex | `.agents/skills/<skill>/` | `~/.agents/skills/<skill>/` |
| GitHub Copilot | `.github/skills/`、`.claude/skills/`、`.agents/skills/` 三者皆可 | `~/.copilot/skills/` 或 `~/.agents/skills/` |
| Google Antigravity | `.agents/skills/<skill>/` | `~/.gemini/config/skills/<skill>/` |

Codex 與 Antigravity 只認 `.agents/skills/`，Claude Code 只認 `.claude/skills/`，兩邊互不相通。上表依 2026 年 7 月各家官方文件整理，路徑約定會變動，裝之前建議順手確認一次。

```bash
# 範例一：安裝到 Claude Code 全域（所有專案生效）
mkdir -p ~/.claude/skills && cp -r .claude/skills/* ~/.claude/skills/

# 範例二：安裝到某個專案給 Codex／Antigravity 用
mkdir -p /path/to/專案/.agents/skills && cp -r .claude/skills/* /path/to/專案/.agents/skills/
```

安裝完成後，工具啟動時只會載入 skill 的 `name` 與 `description`，判斷相關才讀取 `SKILL.md` 全文，`references/` 內的細節文件再按需讀取——裝了不會撐爆 context。

### 提示詞的四個設計重點

改寫本章開頭那段要貼給 AI 的提示詞時，這四點請保留：

- **「三個資料夾都要複製」**。AI 看到 repo 裡有三支 skill，很容易只挑跟指令字面最相關的那一支裝。少裝的那支不會有任何錯誤訊息：漏掉 `legacy-browser-notice` 要等到走完節點 7、進到節點 11 才會發現做法指向一支不存在的 skill；漏掉 `commit-delivery-report` 要等到全部節點做完、要交報告時才會發現。
- **「不要 clone 進專案目錄裡」**是最容易出事的一步。Codex 從當前目錄往上找到 repo 根目錄，**不會往下鑽子資料夾**，所以把整個 repo clone 成 `專案/skills/` 掃不到，還會在專案裡留下一個帶 `.git` 的外來 repo。
- **「不確定就兩個位置都放」**是保險絲。skill 資料夾只是 markdown 加腳本，重複一份成本近乎零，可以避免「AI 猜錯自己是誰 → 裝了等於沒裝」這種最難除錯的狀況。
- **「回報複製到哪」**讓人一眼看得出成功與否，不必自己翻資料夾。

## 第一次使用

裝完之後畫面上不會有任何變化——skill 是被動觸發的，要等你講到相關的事情才會被讀進去。所以第一次用，直接照抄下面這句話當開場，不要只說「幫我看一下這個專案」：

```
這個專案要做整體版更，請照 legacy-site-modernization 的節點清單幫我盤點現況，
先不要動任何檔案。
```

**預期反應**：AI 應該會回報目前的 Bootstrap／jQuery 版本、有沒有建置工具，並反過來問你這次版更的來由（是為了通過資安檢測，還是單純想現代化）——這個問題會決定「畫面樣式不得改變」算不算硬約束，是整套流程的分水嶺。如果它只回了一段泛泛的重構建議、完全沒提到節點編號，就是 skill 沒被載到，回頭確認資料夾放的位置對不對、工具有沒有重開。

接著就照它列出的節點順序一個一個做，每個節點做完各自 commit。**不要跳著做**：節點之間有依賴關係，例如先移除 jQuery 再升 Bootstrap，會分不清哪些 jQuery 呼叫是 Bootstrap 元件要的、哪些是頁面自己的邏輯。

第二支 skill（`legacy-browser-notice`）不需要特別叫它，走到節點 11 會自己被帶出來；想單獨用的話，說「幫這個站加上不支援 IE 的提示」即可。

節點全部做完之後，用第三支 skill（`commit-delivery-report`）產出交付文件，同樣不必記 skill 名稱，說下面這句就會被帶出來：

```
版更的節點都做完了，請照節點清單把這一輪的 commit 整理成工作項目對照表，
我要貼到 ClickUp 給主管看。
```

它會先問你這一輪的**起點 commit**（不要用 `master..<分支>`，長壽的切版分支會撈進幾年前的無關 commit），然後照節點順序逐節列出 commit、影響範圍，以及每一項「工程端要跟著做什麼、不做會怎樣」。

## 使用前要注意的地方

這支 skill 假設起始狀態是「純靜態 HTML/CSS/JS，沒有 npm、沒有 build tool、沒有前端框架」。如果專案其實已經有 `package.json`、Vue/React、或既有的 build pipeline，先停下來跟使用者確認技術棧再套用——細節見 [SKILL.md](.claude/skills/legacy-site-modernization/SKILL.md) 的〈適用範圍〉一節。

節點 6 之後（CDN 化、Bootstrap 升級、移除 jQuery、套件升級、修復弱掃發現項，也就是節點 6～10）全部適用一條硬約束：**畫面樣式不得改變**，驗收要走「靜態掃描 → 幾何不變量 → 逐屬性與逐像素」三層，方法與腳本在 [07-visual-regression-verification.md](.claude/skills/legacy-site-modernization/references/07-visual-regression-verification.md)、[compare-screenshots.py](.claude/skills/legacy-site-modernization/scripts/compare-screenshots.py)、[dump-computed-style.py](.claude/skills/legacy-site-modernization/scripts/dump-computed-style.py)。

量測腳本需要 Python 3 ＋ playwright ＋ pillow，裝在專案外的暫存 venv（Windows 的執行檔在 `Scripts/`，macOS／Linux 在 `bin/`）：

```bash
python -m venv vrt-venv
./vrt-venv/Scripts/python.exe -m pip install playwright pillow   # macOS／Linux 用 ./vrt-venv/bin/python
./vrt-venv/Scripts/python.exe -m playwright install chromium
```

兩種平台的完整指令與判讀方式見上面那份 07 文件的〈環境準備〉一節。

**節點 11 是這條硬約束唯一的例外**：它的目的就是新增一條使用者看得到的提示列，所以驗收條件是「除了這條刻意新增的提示列，其餘畫面不能變」，不是「完全不能變」。

升級**之後**才出現的「版面跑掉」「CSS 吃不到」「modal 打不開」「手風琴箭頭不見」，根因多半不是 class 改錯，而是同名 class 在 BS5 的預設值變了——這類差異兩版的 class 名稱都在，靜態掃描一定通過。九項實際案例與各自的修法（含「該修在相容層還是專案自己的 CSS」的判準）收在 [08-bs5-behavior-traps.md](.claude/skills/legacy-site-modernization/references/08-bs5-behavior-traps.md)。

節點 7（Bootstrap 升級）在 [04-bootstrap-upgrade.md](.claude/skills/legacy-site-modernization/references/04-bootstrap-upgrade.md) 步驟 1 要先從三個策略選項裡挑一個：原地升級、只保留 grid 與 utility 並把元件區塊重切、或分批升級。選了**分批**（選項 3）之後還有一個岔路，**兩條路對同一段 HTML 給的是相反的指示**，同樣在步驟 1 決定，不要邊做邊換：

- **改 markup**——逐處把舊 class 換成 BS5 寫法。留下乾淨的 BS5 程式碼，但改動分散在每一頁。
- **補相容層**——utility class 一律不動，用一支 CSS 把 BS5 移除掉的定義補回來。改動集中，適合頁數多又還沒做共用區抽取的站；做法見 [09-bs4-compat-layer.md](.claude/skills/legacy-site-modernization/references/09-bs4-compat-layer.md)，起手樣板在 [bs4-compat.css](.claude/skills/legacy-site-modernization/assets/bs4-compat.css)。**BS3 起點只能用它的一半**，因為 navbar、`.panel` → `.card`、表單結構是 DOM 重寫，補 CSS 補不出來。

這一節點另附四支只需要 Node 的稽核腳本（`migrate-data-attrs.js`、`audit-bs4-classes.js`、`audit-behavior-changes.js`、`audit-bs5-component-vars.js`）。**它們是啟發式篩選不是驗收證明**，而且三支 `audit-*.js` 只讀扁平結構，專案路徑對不上時會安靜地回報乾淨——用之前先讀 [SKILL.md](.claude/skills/legacy-site-modernization/SKILL.md) 的〈附帶的工具〉。

## 授權

MIT，條款全文見 [LICENSE](LICENSE)。內容依 2026 年 8 月的規範與工具文件撰寫，各家工具的路徑約定會變動，採用前請自行確認現行版本。

## 回饋

在專案裡跑這套流程時踩到新的陷阱、或發現文件寫錯了，請開 issue 或 PR 回饋到這個 repo，不要只改自己專案裡的那份副本——那份改動下一個接手的人看不到。判斷「值不值得寫回來」的標準在 `legacy-site-modernization/SKILL.md` 的〈這份 skill 的權威版本與回寫規則〉。
