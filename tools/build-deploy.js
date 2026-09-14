// 从仓库根 index.html 生成 heyuankugua.xyz 专用的 /xiaojingyu/index.html（叠加返回博客入口）
// 用法: node tools/build-deploy.js <项目目录>
const fs = require("fs");
const path = require("path");
const ROOT = process.argv[2];
if (!ROOT) { console.error("用法: node build-deploy.js <项目目录>"); process.exit(1); }

const SRC = path.join(ROOT, "index.html");
const OUT = path.join(ROOT, "deploy", "heyuankugua.xyz", "xiaojingyu", "index.html");

const HEAD_ADD = `<meta name="description" content="苦瓜的个人项目：小鲸鱼能飞，一个单文件 Canvas 小游戏。点击或按空格让小鲸鱼飞起来，穿过竹竿缝隙。" />
<meta name="theme-color" content="#f7c98d" />`;

const HOME_CSS = `  /* 左上角返回博客的入口（不影响游戏本体） */
  #home{
    position: fixed; left: 12px; top: 12px; z-index: 10;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 999px;
    background: rgba(255,255,255,.88);
    color: #2f4157; text-decoration: none;
    font-size: 14px; font-weight: 600; letter-spacing: .02em;
    box-shadow: 0 4px 14px -6px rgba(16,32,48,.6);
    backdrop-filter: blur(6px);
    transition: transform .12s ease, background .12s ease;
  }
  #home:hover{ background: #fff; transform: translateY(-1px); }
  #home:active{ transform: translateY(0); }
  @media (max-width: 430px){ #home{ font-size: 13px; padding: 6px 12px; } }
`;

let html = fs.readFileSync(SRC, "utf8");
const before = html;

if (!html.includes('name="theme-color"')) html = html.replace("<style>", HEAD_ADD + "\n<style>");
if (!html.includes("#home{")) html = html.replace("</style>", HOME_CSS + "</style>");
if (!html.includes('id="home"')) html = html.replace("<canvas", '<a id="home" href="/">← 返回博客</a>\n<canvas');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, "utf8");
console.log((html === before ? "内容未变，仍" : "已生成 ") + path.relative(ROOT, OUT));
console.log("  含返回入口: " + html.includes('id="home"'));
console.log("  含分享 meta: " + html.includes('name="theme-color"'));
console.log("  体积: " + (Buffer.byteLength(html) / 1024).toFixed(1) + " KB");
