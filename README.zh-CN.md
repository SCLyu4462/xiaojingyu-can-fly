# 小鲸鱼能飞 · The Little Whale Who Could Fly

一个用原图小鲸鱼当主角的网页小游戏。**单文件、零依赖、双击即玩。**

> 在线试玩：**https://sclyu4462.github.io/xiaojingyu-can-fly/**
> 博客展示页：**https://heyuankugua.xyz/xiaojingyu/**
> 仓库地址：**https://github.com/SCLyu4462/xiaojingyu-can-fly**

游戏内所有文案都已改为「小鲸鱼能飞」：标题、待机面板、结束提示、鼓励语。

> 提示：本仓库的 git 全局代理指向 `127.0.0.1:7890`，若该端口没开，推送会失败。
> 可临时绕过：`git -c http.proxy= -c https.proxy= push`

## 玩法

打开 `index.html`（Chrome / Edge 双击即可，无需服务器）。

| 操作 | 说明 |
| --- | --- |
| 点击 / 触摸 / `空格` / `↑` / `W` / `Enter` | 扇一下翅膀，让小鲸鱼往上飞 |
| `M` 或右下角 🔊 图标 | 开关音效 |
| 结束面板上的「再来一次」或再点一下 | 重新开始 |

穿过竹竿缝隙得 1 分，撞到竹竿或掉到地上就结束；最高分存在浏览器本地（`localStorage`
键名 `xiaojingyu_best`）。分数越高缝隙越窄（194 → 152 px），每过两根竹竿会飘出一句
勉励语（勤能补拙、先飞一步、小鲸鱼也能飞……）。

## 目录结构

```
xiaojingyu-can-fly/
├── index.html            ← 游戏本体（贴图已内嵌，双击就能玩）
├── assets/
│   ├── bird_sprite.png          加工好的小鲸鱼贴图 160×160（透明底）
│   └── bird_sprite_preview.png  放大预览图（方便肉眼检查抠图效果）
├── tools/
│   ├── make_bird_sprite.py      原图 → 游戏贴图（去白底/裁剪居中/镜像/放大）
│   └── repack_sprite.py         把贴图重新内嵌回 index.html
├── tests/
│   ├── drive.js         自动化回归测试（headless Chrome + CDP，18 项断言）
│   ├── serve.js         本地静态服务器（支持 SITE_ROOT / SITE_PORT）
│   └── drive-log.txt    最近一次测试日志（不入版本库）
└── deploy/
    └── heyuankugua.xyz/ 博客 heyuankugua.xyz 的上线文件与说明
```

## 贴图加工

原图是一张白底黑色小鲸鱼，`tools/make_bird_sprite.py` 负责变成游戏素材：

1. **去白底**：亮度 ≥ 236 的像素变透明，边缘按亮度渐变半透明，避免白边
2. **裁剪居中**：裁掉空白，补成正方形（留 18% 边距），旋转时不偏心
3. **左右镜像**（`--mirror`）：游戏往右飞，所以让鲸鱼头朝右
4. **最近邻放大**：58×58 → 160×160，保留原图的版画质感
5. **内嵌**：base64 写进 `index.html`，整个游戏只有一个文件、离线可玩

```powershell
python tools/make_bird_sprite.py <原图.png> assets --mirror   # 重新生成贴图
python tools/repack_sprite.py                                  # 重新内嵌回 html
```

## 实现要点

* **逻辑分辨率 420×720**，所有逻辑都在这个坐标系；渲染时按视口等比缩放
  （CSS 像素为唯一单位，DPR 只作用于画布后备存储）
* **缩放策略**：竖屏保宽度（420 全见）、横屏保高度（720 全见），宽屏下若两侧留白
  超过 10% 则放大铺满，且裁剪量有上限 —— 保证小鲸鱼和竹竿永远在画面内
* **物理**：重力 1550 px/s²，扇翅初速 −452 px/s，下落上限 780 px/s；按 `dt` 积分，
  60/120/144Hz 表现一致
* **防穿模**：碰撞按 1/120 秒分子步，长帧也不会"穿过"竹竿
* **状态机**：`ready` → `play` → `dying` → `over`
* **音效**：WebAudio 现场合成，没有音频文件

## 自动化测试

```powershell
# 1) 起本地服务器（后台）
node tests/serve.js

# 2) 启动带调试端口的 Chrome
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --remote-debugging-port=8899 --user-data-dir=$env:TEMP\dsh-game-test about:blank

# 3) 跑回归（视口可换）
$env:CDP_PORT=8899
node tests/drive.js --w=1440 --h=900 --tag=desktop
node tests/drive.js --w=390  --h=844 --mobile --tag=phone
```

也可以用 `SITE_ROOT` 直接测"部署后的那一份"：

```powershell
$env:SITE_ROOT="C:\path\to\site"; $env:PAGE_PATH="xiaojingyu/index.html"
node tests/drive.js --w=1440 --h=900 --tag=deployed
```

覆盖内容（18 项）：贴图解码与绘制、空格/指针输入、无操作必落地结束且只死一次、
固定步长物理回放（陪练鸟稳定穿过 6+ 根竹竿且离竹竿最近 ≥17px）、
**撞到天花板后必须落下来（防"粘在天花板上"）**、撞竿必死、重开、
画布后备存储 = 画布尺寸 × DPR、变换自检（玩法区不被裁掉）、控制台无异常。

最近一次结果：

| 视口 | 结果 |
| --- | --- |
| 1440×900（桌面） | 18/18 通过 |
| 820×1180（竖屏） | 18/18 通过 |
| 390×844（手机模拟） | 18/18 通过 |
| 420×720（精确等于逻辑尺寸） | 该视口下 headless Chrome 的画布停在 300×150 且 rAF 不启动；同一尺寸在真实窗口里验证正常，判为 headless 环境怪癖 |

## 已知限制

* 音效需要用户先有一次点击（浏览器自动播放策略），第一次扇翅可能没声音
* 极端帧率下单帧最多按 33ms 计算，超长卡顿会略微拖慢节奏
* `tests/shots/` 里保留了各视口截图（不入版本库）

## 许可

MIT，见 [LICENSE](LICENSE)。小鲸鱼形象来自作者本人的手绘稿，`assets/` 里的贴图由它生成。
