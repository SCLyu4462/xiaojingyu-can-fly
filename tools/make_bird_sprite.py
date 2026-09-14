"""Turn the attached whale artwork into a game-ready sprite.

Steps
-----
1. load the original PNG (black whale on a near-white background)
2. make the near-white background transparent (keeps antialiased edges)
3. trim the transparent border, pad into a square so rotation feels centred
4. optionally mirror horizontally (the game flies to the right, so the whale
   should face right as well)
5. upscale with nearest neighbour (keeps the crisp printed/engraved look)
6. save  bird_sprite.png  (game asset)  +  bird_sprite_preview.png (for humans)

Usage:  python make_bird_sprite.py <src.png> <out_dir> [--mirror]
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

WHITE_CUT = 236      # pixels brighter than this on every channel become transparent
SQUARE_MARGIN = 0.18  # extra padding around the trimmed art (fraction of its size)
FINAL = 160          # final square sprite size in px
PREVIEW = 640        # human readable preview size in px


def load_with_alpha(src: Path) -> Image.Image:
    img = Image.open(src).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # distance from white decides alpha -> smooth cut, no white halo
            lum = max(r, g, b)
            if lum >= WHITE_CUT:
                px[x, y] = (r, g, b, 0)
            elif lum > 150:
                # soften the antialiased rim proportionally
                t = (WHITE_CUT - lum) / (WHITE_CUT - 150)
                px[x, y] = (r, g, b, int(a * min(1.0, t + 0.15)))
    return img


def trim(img: Image.Image) -> Image.Image:
    box = img.getbbox()
    if box is None:
        raise SystemExit("sprite ended up empty - check WHITE_CUT")
    return img.crop(box)


def square(img: Image.Image, margin: float = SQUARE_MARGIN) -> Image.Image:
    w, h = img.size
    side = int(round(max(w, h) * (1.0 + margin * 2)))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    mirror = "--mirror" in sys.argv
    if len(args) != 2:
        raise SystemExit(__doc__)
    src = Path(args[0])
    out_dir = Path(args[1])
    out_dir.mkdir(parents=True, exist_ok=True)

    art = square(trim(load_with_alpha(src)))
    if mirror:
        art = art.transpose(Image.FLIP_LEFT_RIGHT)

    sprite = art.resize((FINAL, FINAL), Image.NEAREST)
    sprite.save(out_dir / "bird_sprite.png")

    preview = sprite.resize((PREVIEW, PREVIEW), Image.NEAREST)
    flat = Image.new("RGBA", preview.size, (255, 255, 255, 255))
    flat.alpha_composite(preview)
    flat.convert("RGB").save(out_dir / "bird_sprite_preview.png")

    print(f"trimmed art      : {art.size[0]}x{art.size[1]} (square, padded)")
    print(f"mirrored         : {mirror}")
    print(f"game sprite      : bird_sprite.png {FINAL}x{FINAL}")
    print(f"preview          : bird_sprite_preview.png {PREVIEW}x{PREVIEW}")
    print(f"sprite bytes     : {(out_dir / 'bird_sprite.png').stat().st_size}")


if __name__ == "__main__":
    main()
