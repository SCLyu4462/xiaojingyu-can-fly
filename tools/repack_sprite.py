"""把 assets/bird_sprite.png 重新内嵌回 index.html（保持单文件可玩）。

用法: python repack_sprite.py [index.html] [bird_sprite.png]
"""

from __future__ import annotations

import base64
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
HTML = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "index.html"
PNG = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE.parent / "assets" / "bird_sprite.png"

def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    uri = "data:image/png;base64," + base64.b64encode(PNG.read_bytes()).decode("ascii")
    pattern = re.compile(r'const SPRITE_URI = "data:image/png;base64,[^"]*";')
    if not pattern.search(html):
        raise SystemExit("SPRITE_URI not found in " + str(HTML))
    new_html, count = pattern.subn(f'const SPRITE_URI = "{uri}";', html, count=1)
    HTML.write_text(new_html, encoding="utf-8")
    print(f"repacked {PNG.name} ({PNG.stat().st_size} bytes) into {HTML.name} (replaced {count})")
    print(f"index.html now {HTML.stat().st_size} bytes")


if __name__ == "__main__":
    main()
