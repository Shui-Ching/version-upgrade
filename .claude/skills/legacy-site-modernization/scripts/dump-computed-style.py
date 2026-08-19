#!/usr/bin/env python3
"""傾印瀏覽器實際算出來的樣式，用來證明「畫面有沒有變」。

為什麼需要這支腳本：靜態讀 CSS 只能推導「程式碼想做什麼」，推導不出「瀏覽器最後畫出什麼」。
兩者不一致的地方（例如專案寫了 background-color 卻被舊套件的 background-image 蓋掉）就是既有 bug，
框架升級會讓它「意外被修好」——那同樣是畫面變更，要在動手前發現，不是等使用者事後來問。

典型用法（升級前後各跑一次再比對）：

    # 升級前
    python dump-computed-style.py dump --base http://127.0.0.1:8899 \\
        --pages index.html news-info.html --selector ".btn" --out before.json --shots shots/before

    # 升級後
    python dump-computed-style.py dump --base http://127.0.0.1:8899 \\
        --pages index.html news-info.html --selector ".btn" --out after.json --shots shots/after

    # 只列出真正變掉的屬性
    python dump-computed-style.py compare before.json after.json

需求：playwright（裝在專案外的暫存 venv，不要動專案的 package.json／node_modules）
    # Windows（venv 的執行檔在 Scripts/）
    python -m venv vrt-venv && ./vrt-venv/Scripts/python.exe -m pip install playwright
    ./vrt-venv/Scripts/python.exe -m playwright install chromium

    # macOS／Linux（venv 的執行檔在 bin/）
    python3 -m venv vrt-venv && ./vrt-venv/bin/python -m pip install playwright
    ./vrt-venv/bin/python -m playwright install chromium
"""

import argparse
import json
import pathlib
import re
import sys

# Windows 主控台預設用系統 codepage（繁中環境是 cp950），直接輸出會讓中文變亂碼。
# 明確把 stdout 轉成 UTF-8，使用者才不用自己設 PYTHONIOENCODING。
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 預設傾印的屬性：挑的是「框架換代最容易悄悄改掉、而且一改就看得出來」的那些。
# 需要別的屬性用 --props 覆蓋。
#
# width／height 一定要留著：框架換代最貴的錯誤是版面寬高跑掉，而只比對顏色與字級時，
# 一個「欄位比容器寬 30px」的溢出問題完全不會出現在差異清單裡。
DEFAULT_PROPS = [
    "width",
    "height",
    "color",
    "background-color",
    "background-image",
    "font-size",
    "font-family",
    "font-weight",
    "line-height",
    "border-radius",
    "border-color",
    "border-width",
    "box-shadow",
    "text-shadow",
    "padding",
    "margin",
]

# 輪播的目前張數每次載入都不同，會在差異清單裡蓋掉真正的問題。
# 兩邊都停掉自動播放並回到第一張，比對才有意義。Swiper 以外的套件要自己補。
FREEZE_CAROUSELS = """() => {
    document.querySelectorAll('.swiper').forEach(el => {
        if (el.swiper) {
            if (el.swiper.autoplay) el.swiper.autoplay.stop();
            el.swiper.slideTo(0, 0);
        }
    });
}"""

# 在瀏覽器裡執行：找出所有符合選擇器的元素，回傳它們的 computed style 與可見性。
COLLECT = """
([selector, props]) => {
    return [...document.querySelectorAll(selector)].map((el, index) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const styles = {};
        for (const prop of props) styles[prop] = cs.getPropertyValue(prop).trim();
        return {
            index,
            className: typeof el.className === 'string' ? el.className : '',
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().slice(0, 24),
            // 不可見的元素照樣收，因為它可能只是這次沒展開（modal、收合選單），不是不存在
            visible: rect.width > 0 && rect.height > 0
                     && cs.visibility !== 'hidden' && cs.display !== 'none',
            styles,
        };
    });
}
"""


def slugify(value):
    """把 class 字串壓成能當檔名的形式，避免 Windows 不允許的字元。"""
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value)[:48] or "noclass"


def cmd_dump(args):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("找不到 playwright。請先在暫存 venv 安裝，見本檔開頭的說明。")

    shots_dir = pathlib.Path(args.shots) if args.shots else None
    if shots_dir:
        shots_dir.mkdir(parents=True, exist_ok=True)

    result = {"base": args.base, "selector": args.selector, "props": args.props, "pages": {}}
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": args.width, "height": args.height})
        page.on("pageerror", lambda e: problems.append(f"pageerror: {e}"))
        page.on("requestfailed", lambda r: problems.append(f"requestfailed: {r.url}"))

        for path in args.pages:
            page.goto(f"{args.base.rstrip('/')}/{path.lstrip('/')}", wait_until="networkidle")
            # 圖示字型晚一步就緒時，glyph 會整個不畫出來，看起來像元素不見了
            page.evaluate("() => document.fonts.ready")
            page.evaluate(FREEZE_CAROUSELS)
            page.wait_for_timeout(500)
            entries = page.evaluate(COLLECT, [args.selector, args.props])
            result["pages"][path] = entries

            if not shots_dir:
                continue

            stem = path.replace(".html", "").replace("/", "_")
            page.screenshot(path=str(shots_dir / f"{stem}-full-{args.width}.png"), full_page=True)
            handles = page.query_selector_all(args.selector)
            for entry in entries:
                if not entry["visible"]:
                    continue
                name = f"{stem}-{entry['index']:02d}-{slugify(entry['className'])}.png"
                try:
                    handles[entry["index"]].screenshot(path=str(shots_dir / name))
                except Exception as exc:  # 單一元素截不到就記下來，不要中斷整份傾印
                    problems.append(f"screenshot {path} #{entry['index']}: {exc}")

        browser.close()

    pathlib.Path(args.out).write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    total = sum(len(v) for v in result["pages"].values())
    print(f"已傾印 {total} 個元素到 {args.out}")
    if shots_dir:
        print(f"截圖存在 {shots_dir}")
    print("\n--- 載入問題 ---")
    print("\n".join(problems) if problems else "(無)")


def cmd_compare(args):
    before = json.loads(pathlib.Path(args.before).read_text(encoding="utf-8"))
    after = json.loads(pathlib.Path(args.after).read_text(encoding="utf-8"))

    changes = []
    for path, before_entries in before["pages"].items():
        after_entries = after["pages"].get(path)
        if after_entries is None:
            changes.append((path, None, "頁面在 after 檔案裡不存在", "", ""))
            continue
        if len(before_entries) != len(after_entries):
            changes.append(
                (path, None, "元素數量改變", f"{len(before_entries)} 個", f"{len(after_entries)} 個")
            )
        # 以「同一頁的第 N 個命中」配對。DOM 有增刪時這個配對會錯位，
        # 所以下面把 text 一併印出來，錯位時肉眼看得出來。
        for old, new in zip(before_entries, after_entries):
            label = f"#{old['index']} .{old['className'] or old['tag']} 「{old['text']}」"
            if old["text"] != new["text"]:
                changes.append((path, label, "text（可能是元素錯位）", old["text"], new["text"]))
            for prop, old_value in old["styles"].items():
                new_value = new["styles"].get(prop, "(缺少)")
                if old_value != new_value:
                    changes.append((path, label, prop, old_value, new_value))

    if not changes:
        print("兩份傾印完全一致，沒有任何屬性改變。")
        return

    print(f"共 {len(changes)} 處差異：\n")
    current_page = None
    for path, label, prop, old_value, new_value in changes:
        if path != current_page:
            print(f"\n=== {path} ===")
            current_page = path
        prefix = f"  {label}\n    " if label else "  "
        print(f"{prefix}{prop}:\n      before: {old_value}\n      after : {new_value}")

    # 有差異時以非零狀態結束，方便串進其他檢查流程
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    dump = sub.add_parser("dump", help="傾印指定頁面上符合選擇器的元素的 computed style")
    dump.add_argument("--base", required=True, help="站台基底網址，例如 http://127.0.0.1:8899")
    dump.add_argument("--pages", nargs="+", required=True, help="要檢查的頁面路徑")
    dump.add_argument("--selector", default=".btn", help="CSS 選擇器（預設 .btn）")
    dump.add_argument("--props", nargs="+", default=DEFAULT_PROPS, help="要記錄的 CSS 屬性")
    dump.add_argument("--out", default="computed.json", help="輸出的 JSON 檔名")
    dump.add_argument("--shots", help="截圖輸出資料夾，不給就不截圖")
    dump.add_argument("--width", type=int, default=1440, help="視窗寬度")
    dump.add_argument("--height", type=int, default=900, help="視窗高度")
    dump.set_defaults(func=cmd_dump)

    compare = sub.add_parser("compare", help="比對兩份傾印，只列出真正改變的屬性")
    compare.add_argument("before")
    compare.add_argument("after")
    compare.set_defaults(func=cmd_compare)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
