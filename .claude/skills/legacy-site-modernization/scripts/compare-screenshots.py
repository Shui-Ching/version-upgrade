#!/usr/bin/env python3
"""同時開「升級前」與「升級後」兩台本機伺服器，逐段捲動比對畫面。

為什麼要兩台伺服器而不是「先存基準截圖、改完再比」：同一個瀏覽器、同一次執行、
同一組等待條件下拍出來的兩張圖才真的可比。存檔基準隔一段時間再比，字型快取、
瀏覽器版本、系統縮放任何一項不同，都會製造出一堆與改動無關的假差異。

準備兩台伺服器（升級前那份用 git 匯出，不要動工作區）：

    mkdir -p /tmp/orig && git archive HEAD | tar -x -C /tmp/orig
    (cd /tmp/orig && python -m http.server 8900) &
    (cd . && python -m http.server 8899) &

然後：

    python compare-screenshots.py --before-port 8900 --after-port 8899 \\
        --pages index.html news.html --widths 320 768 1200

需求：playwright 與 pillow，裝在暫存的 venv，不要動專案的 package.json。

三個關於量測方法的重點，都是踩過才知道的：

1. **不要用整頁截圖（full_page）比對。** 整頁擷取會臨時改變視窗尺寸重新繪製，
   實測會出現「圖示字型的 glyph 整個沒畫出來」這種只在其中一邊發生的假差異，
   看起來就像某個按鈕消失了。改用視窗截圖 + 逐段捲動，畫面才是使用者真正看到的樣子。
2. **等 document.fonts.ready。** 圖示字型晚一步就緒，glyph 不會畫出來。
3. **凍結輪播。** 目前張數每次載入都不同，不凍結的話差異清單會被輪播內容淹掉。

判讀結果時還有一條：**同樣條件重跑兩次，數字如果會變，那個差異就是內容不確定性
（輪播、隨機排序、JS 動畫時序），不是版面問題。** 先重跑一次再決定要不要追。
"""

import argparse
import io
import pathlib
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

FREEZE_CAROUSELS = """() => {
    document.querySelectorAll('.swiper').forEach(el => {
        if (el.swiper) {
            if (el.swiper.autoplay) el.swiper.autoplay.stop();
            el.swiper.slideTo(0, 0);
        }
    });
}"""


def capture(browser, port, page_name, width, viewport_height):
    """逐段捲動拍視窗截圖，回傳 (截圖位元組串列, 頁面總高)。"""
    page = browser.new_page(viewport={"width": width, "height": viewport_height})
    page.goto(f"http://127.0.0.1:{port}/{page_name}", wait_until="networkidle")
    page.evaluate("() => document.fonts.ready")
    page.evaluate(FREEZE_CAROUSELS)
    page.wait_for_timeout(500)

    total = page.evaluate("() => document.documentElement.scrollHeight")
    overflow = page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    shots = []
    for top in range(0, total, viewport_height):
        page.evaluate(f"() => window.scrollTo(0, {top})")
        page.wait_for_timeout(150)
        shots.append(page.screenshot(animations="disabled"))
    page.close()
    return shots, total, overflow


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--before-port", type=int, required=True, help="升級前那份的埠號")
    parser.add_argument("--after-port", type=int, required=True, help="升級後（工作區）的埠號")
    parser.add_argument("--pages", nargs="+", required=True)
    parser.add_argument("--widths", nargs="+", type=int, default=[320, 768, 1200])
    parser.add_argument("--viewport-height", type=int, default=800)
    parser.add_argument("--out", default="screenshot-diff", help="差異圖輸出資料夾")
    args = parser.parse_args()

    try:
        from PIL import Image, ImageChops
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("需要 playwright 與 pillow，請先在暫存 venv 安裝，見本檔開頭的說明。")

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for page_name in args.pages:
            stem = page_name.replace(".html", "").replace("/", "_")
            for width in args.widths:
                before, before_h, before_of = capture(browser, args.before_port, page_name, width, args.viewport_height)
                after, after_h, after_of = capture(browser, args.after_port, page_name, width, args.viewport_height)

                changed = 0
                measured = 0
                worst = None
                for index, (sb, sa) in enumerate(zip(before, after)):
                    ib = Image.open(io.BytesIO(sb)).convert("RGB")
                    ia = Image.open(io.BytesIO(sa)).convert("RGB")
                    if ib.size != ia.size:
                        continue
                    diff = ImageChops.difference(ib, ia)
                    n = sum(1 for px in list(diff.getdata()) if px != (0, 0, 0))
                    measured += ib.size[0] * ib.size[1]
                    changed += n
                    if n and (worst is None or n > worst[1]):
                        worst = (index, n, diff.getbbox())
                        prefix = out_dir / f"{stem}-{width}-seg{index}"
                        diff.save(f"{prefix}-diff.png")
                        ib.save(f"{prefix}-before.png")
                        ia.save(f"{prefix}-after.png")

                pct = changed / measured * 100 if measured else 0
                note = f"最大差異段 #{worst[0]} {worst[1]}px bbox={worst[2]}" if worst else ""
                rows.append((page_name, width, before_h == after_h, before_of == after_of, changed, pct, note))
        browser.close()

    print(f"{'頁面':16}{'寬度':>6}{'總高一致':>10}{'溢出一致':>10}{'差異像素':>10}{'占比':>9}   最大差異段")
    for page_name, width, same_h, same_of, changed, pct, note in rows:
        print(
            f"{page_name:16}{width:>6}{'是' if same_h else '否':>10}"
            f"{'是' if same_of else '否':>10}{changed:>10}{pct:>8.3f}%   {note}"
        )
    print(
        "\n總高與水平溢出這兩欄比像素數更有診斷價值："
        "只要有一欄是「否」，就代表版面真的變了，先追那個再看像素。"
    )


if __name__ == "__main__":
    main()
