# 笨鸟先飞 · The Clumsy Bird Flies First

A tiny one-file Flappy-style browser game where the bird is a **black whale** taken from a
hand-drawn illustration. Tap / click / press Space to flap, slip through the bamboo gaps,
and see how far a clumsy bird can get before it falls.

### ▶ [**Play it in your browser**](https://sclyu4462.github.io/clumsy-bird-flies-first/)

![ready screen](docs/screenshot-ready.png)

* **Single file, zero dependencies** — open `index.html` in a browser and play, offline-friendly
* **Works on phones and desktops** — full-bleed scenery, aspect-aware responsive layout
* **Chinese UI** with a warm "early morning flight" look (sunrise, clouds, hills, bamboo)
* **No build step and no assets to load** — the sprite is embedded as a base64 data URI

## Quick start

```bash
git clone https://github.com/SCLyu4462/clumsy-bird-flies-first.git
cd clumsy-bird-flies-first
# just open index.html — that's it
```

Or serve it if you prefer: `python -m http.server 8000` → http://localhost:8000

## Controls

| Input | Action |
| --- | --- |
| Click / tap / `Space` / `↑` / `W` / `Enter` | Flap |
| `M` or the 🔊 button (bottom-right) | Toggle sound |
| "再来一次" button, or click again after crashing | Restart |

Score +1 per bamboo gap. Hitting a pipe or the ground ends the run. The gap narrows as you
score (194 → 152 px), and every second gap floats a few words of encouragement
(勤能补拙 "diligence makes up for clumsiness", 先飞一步 "fly one step ahead", …).
The best score is kept in `localStorage`.

![playing](docs/screenshot-playing.png)

## How the whale sprite was made

The source artwork is a black whale on a white background. `tools/make_bird_sprite.py`
turns it into a game-ready sprite:

1. **drop the white background** — pixels brighter than 236 become transparent, edges fade
   proportionally so there is no white halo
2. **trim + centre** — crop the empty border, pad to a square (18% margin) so rotation
   stays centred
3. **mirror horizontally** (`--mirror`) — the game flies to the right, so the whale faces right
4. **nearest-neighbour upscale** — 58×58 → 160×160 keeps the crisp printed look
5. **embed** — written into `index.html` as a base64 data URI, so the game stays a single file

```bash
python tools/make_bird_sprite.py <source.png> assets --mirror   # regenerate the sprite
python tools/repack_sprite.py                                   # embed it back into index.html
```

## How it works

* **Logical resolution 420×720** — all game logic lives in that coordinate space and is scaled
  to the viewport at render time (CSS pixels are the single unit; `devicePixelRatio` only
  affects the canvas backing store)
* **Aspect-aware scaling** — portrait keeps the full 420 width, landscape keeps the full 720
  height, and on very wide screens the field scales up to fill the canvas (with a cap on how
  much scenery may be cropped, so the whale and the pipes are always on screen)
* **dt-based physics** — gravity 1550 px/s², flap impulse −452 px/s, terminal fall 780 px/s;
  identical feel at 60 / 120 / 144 Hz
* **Sub-stepped collision** — collision runs in 1/120 s slices, so a long frame can't tunnel
  the whale through a bamboo pipe
* **State machine** — `ready` → `play` → `dying` → `over`
* **Procedural audio** — WebAudio oscillators, no sound files

## Tests

An automated regression suite drives a headless Chrome over the DevTools Protocol and makes
**18 assertions** per viewport: sprite decode & draw, keyboard/pointer input, an idle run that
must end on the ground (dying exactly once), a fixed-step replay where a helper bird must clear
6+ pipes with ≥17 px clearance, **a bird shoved into the ceiling must fall back down**, pipe
collision must kill, restart, canvas backing store == canvas box × DPR, the view-transform
self-test, and a clean console.

```bash
node tests/serve.js                        # static server on :8123
chrome --headless=new --remote-debugging-port=8899 \
       --user-data-dir=/tmp/dsh-test about:blank
CDP_PORT=8899 node tests/drive.js --w=1440 --h=900  --tag=desktop
CDP_PORT=8899 node tests/drive.js --w=390  --h=844 --mobile --tag=phone
```

Results: **18/18 passing** at 1440×900, 820×1180 and 390×844.

## Project layout

```
index.html                  the game (open this)
assets/                     processed sprite + preview
tools/make_bird_sprite.py   source art -> game sprite
tools/repack_sprite.py      re-embed the sprite into index.html
tests/drive.js              automated regression suite (18 assertions)
tests/serve.js              tiny static server for the tests
deploy/heyuankugua.xyz/     site-specific files for heyuankugua.xyz/benniao/
README.zh-CN.md             Chinese write-up: mechanics, bug log, limitations
```

### Site deployment (`deploy/heyuankugua.xyz/`)

Self-hosting on the author's blog needs two extra bits on top of `index.html`:

* a `#home` pill in the top-left corner linking back to the blog
* a third `.project-card` block on the blog landing page

`deploy/heyuankugua.xyz/` keeps both files ready to upload plus the step-by-step
instructions. Note it holds a *frozen copy* of the game page for that host — the
canonical source is the root `index.html`, so re-apply the two additions (and the
`<meta>` tags) if the game changes.

## License

MIT — see [LICENSE](LICENSE).
