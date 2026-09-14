// 常驻静态服务器（测试期间用，避免每次启停）
// 环境变量：SITE_ROOT 站点根目录（默认项目根），SITE_PORT 端口（默认 8123）
const fs = require("fs");
const path = require("path");
const http = require("http");
const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.resolve(__dirname, "..");
const PORT = Number(process.env.SITE_PORT || 8123);
const MIME = {
  ".html": "text/html; charset=utf-8", ".png": "image/png", ".js": "text/javascript",
  ".css": "text/css", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json",
};
http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(ROOT, rel === "/" ? "/index.html" : rel);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");  // 目录 -> index.html
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("no"); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(buf);
  });
}).listen(PORT, "127.0.0.1", () => console.log("serving", ROOT, "on", PORT));
