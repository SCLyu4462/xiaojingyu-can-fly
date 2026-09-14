// 静态服务器 + Chrome DevTools Protocol 测试驱动（仅用 node 内置模块）
// 用法: node tests/drive.js [--w=1440] [--h=900] [--mobile] [--tag=name]
//   环境变量 SITE_ROOT  指定站点根目录（默认项目根），PAGE_PATH 指定测试页面（默认 index.html）
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.resolve(__dirname, "..");
const OUT = process.env.SHOT_DIR ? path.resolve(process.env.SHOT_DIR) : path.join(ROOT, "tests", "shots");
const PORT = Number(process.env.SITE_PORT || 8123);
const CDP = "http://127.0.0.1:" + (process.env.CDP_PORT || 9333);
const PAGE_URL = `http://127.0.0.1:${PORT}/${process.env.PAGE_PATH || "index.html"}`;

// 视口参数: --w=820 --h=1180 [--mobile] [--tag=name]
const argv = process.argv.slice(2);
const arg = (k, d) => { const m = argv.find(a => a.startsWith("--" + k + "=")); return m ? m.split("=")[1] : d; };
const VW_PX = Number(arg("w", 820));
const VH_PX = Number(arg("h", 1180));
const MOBILE = argv.includes("--mobile");
const TAG = arg("tag", `${VW_PX}x${VH_PX}`);
const VH_GROUND_GUARD = 500;   // 落地后 y 一定在画面下方

fs.mkdirSync(OUT, { recursive: true });
const LOGFILE = path.join(OUT, "..", "drive-log.txt");
fs.mkdirSync(path.dirname(LOGFILE), { recursive: true });
fs.writeFileSync(LOGFILE, "");
const log = (...a) => {
  const line = a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  console.log(line);
  fs.appendFileSync(LOGFILE, line + "\n");
};

// ---------- 静态服务器 ----------
const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, rel === "/" ? "/index.html" : rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("no"); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
});
let serverOwned = true;
server.on("error", e => {
  if (e.code === "EADDRINUSE") { serverOwned = false; log("port 8123 already served by another process - reusing it"); }
  else throw e;
});

// ---------- CDP 小客户端 ----------
class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener("open", () => res());
      this.ws.addEventListener("error", e => rej(new Error("ws error: " + (e.message || "unknown"))));
    });
    this.ws.addEventListener("message", ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("timeout: " + method)); }
      }, 60000);
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression: `(() => { ${expression} })()`,
      returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error("page error: " + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails));
    return r.result.value;
  }
  async shot(name) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    const p = path.join(OUT, name + ".png");
    fs.writeFileSync(p, Buffer.from(data, "base64"));
    return p;
  }
  async key(code, key, keyCode) {
    for (const type of ["keyDown", "keyUp"]) {
      await this.send("Input.dispatchKeyEvent", { type, code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    }
  }
  async click(x, y) {
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, buttons: 0 });
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function findPageTarget() {
  const res = await fetch(CDP + "/json/list");
  const list = await res.json();
  return list.find(t => t.type === "page");
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? "  -> " + JSON.stringify(detail) : ""}`);
}

(async () => {
  await new Promise(r => { server.listen(PORT, "127.0.0.1", r); setTimeout(r, 400); });
  log("static server on", PAGE_URL);

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = await findPageTarget(); } catch (e) { /* chrome still booting */ }
    if (!target) await sleep(500);
  }
  if (!target) throw new Error("no chrome page target on " + CDP);

  const cdp = new CDPClient(target.webSocketDebuggerUrl);
  await cdp.ready;
  const consoleErrors = [];
  cdp.ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push(JSON.stringify(m.params.args));
    if (m.method === "Runtime.exceptionThrown") consoleErrors.push(JSON.stringify(m.params.exceptionDetails));
  });

  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: VW_PX, height: VH_PX, deviceScaleFactor: 1, mobile: MOBILE });
  await cdp.send("Page.navigate", { url: PAGE_URL });
  await sleep(600);
  // 等第一帧真正跑起来，最多 6 秒（画布缓冲 = 视口 × DPR）
  for (let i = 0; i < 30; i++) {
    const t = await cdp.eval(`
      const c = document.querySelector('canvas');
      if (!c) return null;
      const dpr = window.devicePixelRatio || 1;
      return { buf: [c.width, c.height], want: [Math.round(c.clientWidth * dpr), Math.round(c.clientHeight * dpr)],
               dpr, frames: window.__benniao ? window.__benniao.telemetry().frames : -1 };
    `);
    if (t && t.buf[0] === t.want[0] && t.frames > 2) break;
    await sleep(200);
  }
  await sleep(300);
  log(`### viewport ${TAG} (${VW_PX}x${VH_PX}${MOBILE ? ", mobile" : ""})`);
  const boot = await cdp.eval(`
    const c = document.querySelector('canvas');
    const dpr = window.devicePixelRatio || 1;
    return { buf: [c.width, c.height], want: [Math.round(c.clientWidth * dpr), Math.round(c.clientHeight * dpr)],
             view: [window.innerWidth, window.innerHeight], dpr,
             frames: window.__benniao ? window.__benniao.telemetry().frames : -1,
             fit: window.__benniao ? window.__benniao.lastFit() : null };
  `);
  check("canvas backing store matches its box × DPR",
    boot.buf[0] === boot.want[0] && boot.buf[1] === boot.want[1], boot);

  // 1. 精灵图是否解码成功
  const sprite = await cdp.eval(`
    const b = new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r(null); i.src = window.__benniao ? document.querySelector('canvas') && '' : ''; });
    return { ready: window.__benniao.spriteReady() };
  `);
  check("sprite decoded from data URI", sprite.ready === true, sprite);

  // 2. 初始状态
  const ready = await cdp.eval(`return { state: window.__benniao.state, cls: window.__benniao.debug() };`);
  check("initial state is ready", ready.state === "ready", ready.cls);
  await cdp.shot(TAG + "-01-ready");

  // 3. 键盘空格起飞（直接派发事件，避免 headless 时间膨胀影响判定）
  const afterKey = await cdp.eval(`
    window.__benniao.reset();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    return { state: window.__benniao.state, vy: Math.round(window.__benniao.debug().vy) };
  `);
  check("space key starts flight (vy < 0)", afterKey.state === "play" && afterKey.vy < 0, afterKey);

  // 4. 指针点击也能起飞
  const clickPt = await cdp.eval(`const r = document.querySelector('canvas').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.8) };`);
  const afterClick = await cdp.eval(`
    window.__benniao.reset();
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: ${clickPt.x}, clientY: ${clickPt.y}, bubbles: true }));
    return { state: window.__benniao.state, vy: Math.round(window.__benniao.debug().vy) };
  `);
  check("pointer click starts flight", afterClick.state === "play" && afterClick.vy < 0, { ...afterClick, clickPt });

  // 5. 不操作 -> 掉到地上 -> game over（用状态回放，避免 headless 帧率抖动造成漏采）
  const idleRun = await cdp.eval(`
    const B = window.__benniao;
    B.autopilot(false);
    B.pause(true);
    B.reset();
    B.flap();
    const states = new Set([B.state]);
    let f = 0;
    while (f < 60 * 20 && B.state !== "over") { B.update(1 / 60); states.add(B.state); f++; }
    const out = { states: [...states], state: B.state, seconds: +(f / 60).toFixed(2), y: Math.round(B.debug().y), deaths: B.telemetry().deaths };
    B.pause(false);
    return out;
  `);
  check("no-input run ends in game over", idleRun.state === "over" && idleRun.states.includes("play") && idleRun.deaths === 1, idleRun);
  await cdp.shot(TAG + "-02-gameover");

  // 6. 确定性模拟：暂停 rAF，用固定步长驱动真实的 update()，检验竹竿可以通过
  //    （headless 下帧率不稳定，所以用固定步长回放，结论与真实浏览器一致）
  const sim = await cdp.eval(`
    const B = window.__benniao;
    const dt = 1 / 60;
    B.pause(true);                                     // 先冻结 rAF，保证完全可控
    B.autopilot(true);                                 // 让"陪练"接管扇翅膀
    B.autopilotReset();
    B.reset();
    B.flap();
    B.telemetry().minClearance = 1e9;
    const deaths0 = B.telemetry().deaths;
    let frames = 0, minClear = Infinity;
    while (frames < 60 * 120 && B.state === "play" && B.debug().score < 16) {
      B.steer();                                       // 每步都让陪练决策（与主循环一致）
      B.update(dt);
      frames++;
      const t = B.telemetry();
      if (t.minClearance < minClear) minClear = t.minClearance;
    }
    const out = { state: B.state, score: B.debug().score, seconds: +(frames / 60).toFixed(1),
                  flaps: B.telemetry().flaps, deathDelta: B.telemetry().deaths - deaths0,
                  minClear: Math.round(minClear), log: B.flightLog };
    B.autopilot(false);
    B.pause(false);
    return out;
  `);
  check("fixed-step run survives 6+ pipes", sim.score >= 6 && sim.minClear > 8, { ...sim, log: undefined });
  if (sim.score < 6) log("   flight log: " + JSON.stringify(sim.log));
  check("clearance stayed sane while cruising", sim.minClear > 8, { minClear: sim.minClear });
  // 6b. 同样的确定性步进，但完全不扇翅膀 -> 必定落地结束
  const simIdle = await cdp.eval(`
    const B = window.__benniao;
    B.pause(true);
    B.reset();
    B.flap();
    const d0 = B.telemetry().deaths;
    let frames = 0;
    while (frames < 60 * 20 && B.state !== "over") { B.update(1 / 60); frames++; }
    const out = { state: B.state, deaths: B.telemetry().deaths - d0, seconds: +(frames / 60).toFixed(1), y: Math.round(B.debug().y) };
    B.pause(false);
    return out;
  `);
  check("idle bird dies exactly once (no double-death)", simIdle.state === "over" && simIdle.deaths === 1, simIdle);
  await cdp.shot(TAG + "-03-playing");

  // 6c. 天花板：撞到上限后必须落下来（防"粘在天花板上"回归）
  const ceiling = await cdp.eval(`
    const B = window.__benniao;
    B.autopilot(false);
    B.pause(true);
    B.reset();
    B.flap();
    const g = B.gamestate();
    g.pipes.length = 0;
    g.bird.y = 17; g.bird.vy = -452;           // 贴在最高处还继续上冲：绝不能粘住
    let minY = 1e9, maxStuck = 0, stuck = 0, hitCeiling = false;
    for (let f = 0; f < 180; f++) {
      B.update(1 / 60);
      const y = g.bird.y, vy = g.bird.vy;
      if (y < minY) minY = y;
      if (y <= 17.5) hitCeiling = true;
      // 判定"粘住"：贴着天花板(y≈HIT_RY)且几乎不动，连续帧数超过 0.5 秒即算卡死
      if (y <= 18 && Math.abs(vy) < 1) { stuck++; if (stuck > maxStuck) maxStuck = stuck; }
      else stuck = 0;
    }
    const out = { hitCeiling, minY: +minY.toFixed(1), endY: +g.bird.y.toFixed(1), endVy: +g.bird.vy.toFixed(1),
                  maxStuckFrames: maxStuck, state: B.state };
    B.pause(false);
    return out;
  `);
  check("bird cannot stick to the ceiling",
    ceiling.hitCeiling && ceiling.maxStuckFrames <= 30 && ceiling.endY > ceiling.minY + 40, ceiling);

  // 7. 撞竹竿必然进入 dying -> over（同样用确定性步进）
  const crash = await cdp.eval(`
    const B = window.__benniao;
    B.autopilot(false);
    B.pause(true);
    B.reset();
    B.flap();
    const g = B.gamestate();
    g.pipes.length = 0;
    g.bird.y = 560; g.bird.vy = 0;   // 560 落在"下竹竿"里（缝隙是 300~494），必然撞竿
    g.pipes.push({ x: 120, top: 300, gap: 194, passed: false, seed: 1 }); // 缝隙 300~494，鸟在 360 -> 卡在竹竿里
    const d0 = B.telemetry().deaths;
    B.update(1 / 60);
    const afterHit = { state: B.state, deaths: B.telemetry().deaths - d0 };
    let f = 0;
    while (f < 60 * 5 && B.state !== "over") { B.update(1 / 60); f++; }
    const out = { afterHit, state: B.state, y: Math.round(B.debug().y), overAfter: +(f / 60).toFixed(2) };
    B.pause(false);
    return out;
  `);
  const yNow = crash.y;
  check("hitting a pipe triggers dying -> over",
    crash.afterHit.state === "dying" && crash.afterHit.deaths === 1 && crash.state === "over" && yNow > VH_GROUND_GUARD,
    crash);
  await cdp.shot(TAG + "-04-crash");

  // 8. 结束后再来一次（同样直接派发事件）
  const restart = await cdp.eval(`
    window.__benniao.reset();
    const afterReset = window.__benniao.state;
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: ${clickPt.x}, clientY: ${clickPt.y}, bubbles: true }));
    return { state: window.__benniao.state, score: window.__benniao.debug().score, afterReset };
  `);
  check("restart after game over works", restart.state === "play" && restart.score === 0, { ...restart, clickPt });

  // 9. 直接复现 _draw 里画鲸鱼的那几行，在独立画布上验证素材真的能画出来
  const birdPix = await cdp.eval(`
    const src = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const off = document.createElement('canvas');
        off.width = 500; off.height = 500;
        const o = off.getContext('2d');
        o.fillStyle = '#ffffff';
        o.fillRect(0, 0, 500, 500);
        o.save();
        o.translate(250, 250);
        const s = 70.3;                                  // 与 index.html 中 BIRD_SIZE 一致
        o.drawImage(img, -s / 2, -s / 2, s, s);          // 与 _draw() 中完全相同的调用
        o.restore();
        const img2 = o.getImageData(0, 0, 500, 500).data;
        let dark = 0, tot = 0;
        for (let i = 0; i < img2.length; i += 4) { tot++; if ((img2[i] + img2[i+1] + img2[i+2]) / 3 < 100) dark++; }
        res({ drawn: true, darkPct: +(100 * dark / tot).toFixed(1), natural: [img.naturalWidth, img.naturalHeight] });
      };
      img.onerror = e => res({ drawn: false, error: String(e && e.type) });
      img.src = window.__benniao.spriteURI || '';
    });
    return src;
  `);
  check("whale sprite renders into a canvas (non-blank)",
    birdPix.drawn === true && birdPix.darkPct > 0.25, birdPix);

  // 10. 控制台报错
  check("no console errors / exceptions", consoleErrors.length === 0, consoleErrors.slice(0, 5));

  // 10b. 让 draw() 真跑一帧：确认渲染不抛异常、且玩法区域完整落在视口内
  const drawErr = await cdp.eval(`
    const c = document.querySelector('canvas');
    const lay = window.__benniao.layout();
    window.__benniao.reset();
    window.__benniao.pause(true);
    const gs = window.__benniao.gamestate();
    gs.bird.y = 300; gs.bird.vy = 0; gs.bird.rot = 0;
    let err = "ok";
    try { window.__benniao.draw(1.0); } catch (e) { err = "THREW: " + e.message; }
    window.__benniao.pause(false);
    const want = { x: lay.kx * 132 + lay.ox, y: lay.ky * 300 + lay.oy, size: lay.ky * 70 };
    const inBounds = want.x - want.size / 2 >= 0 && want.y - want.size / 2 >= 0 &&
                     want.x + want.size / 2 <= c.width && want.y + want.size / 2 <= c.height;
    return { err, want, inBounds, canvas: [c.width, c.height], spriteReady: window.__benniao.spriteReady() };
  `);
  check("draw() runs without throwing", drawErr.err === "ok", drawErr.err);
  check("play field fits the viewport (bird inside canvas)", drawErr.inBounds, drawErr.want);

  // 10c. 变换自检：玩法区必须可见、画面必须铺满画布、鲸鱼必须在画布内
  const cover = await cdp.eval(`
    const c = document.querySelector('canvas');
    const s = window.__benniao.selfTest();
    // 画布后备存储应等于 CSS 尺寸 × DPR（允许 1px 取整误差）
    const dpr = window.devicePixelRatio || 1;
    const sizeOk = Math.abs(c.width - Math.round(c.clientWidth * dpr)) <= 1 &&
                   Math.abs(c.height - Math.round(c.clientHeight * dpr)) <= 1;
    return { sizeOk, css: [c.clientWidth, c.clientHeight], buf: [c.width, c.height], dpr, self: s,
             lastFit: window.__benniao.lastFit(), win: [window.innerWidth, window.innerHeight] };
  `);
  check("canvas backing store matches viewport × DPR", cover.sizeOk, cover);
  check("self-test: view transform consistent",
    cover.self.fieldUsable && cover.self.canvasCovered && cover.self.birdInside,
    { ...cover.self, lastFit: cover.lastFit, win: cover.win });

  await cdp.shot(TAG + "-05-final");
  log("\n--- screenshots ---");
  for (const f of fs.readdirSync(OUT)) log("  " + path.join(OUT, f));

  const failed = results.filter(r => !r.ok);
  log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (serverOwned) server.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => {
  console.error("DRIVER ERROR:", e && e.stack || e);
  if (serverOwned) server.close();
  process.exit(2);
});

