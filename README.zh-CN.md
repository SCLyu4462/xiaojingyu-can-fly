# 笨鸟先飞 · The Clumsy Bird Flies First

一个用原图小鲸鱼当主角的「笨鸟先飞」小游戏。**单文件、零依赖、双击即玩。**

> 在线试玩：**https://sclyu4462.github.io/clumsy-bird-flies-first/**
> 仓库地址：**https://github.com/SCLyu4462/clumsy-bird-flies-first**
>
> 提示：本仓库的 git 全局代理指向 `127.0.0.1:7890`，若该端口没开，推送会失败。
> 可临时绕过：`git -c http.proxy= -c https.proxy= push`

```
笨鸟先飞/
├── index.html            ← 游戏本体（贴图已内嵌，双击就能玩）
├── assets/
│   ├── bird_sprite.png          加工好的小鸟贴图 160×160（透明底）
│   └── bird_sprite_preview.png  放大预览图（方便肉眼检查抠图效果）
├── tools/
│   └── make_bird_sprite.py      把原图加工成游戏贴图的脚本（Pillow）
└── tests/
    ├── drive.js         自动化回归测试（headless Chrome + CDP，18 项断言）
    ├── serve.js         本地静态服务器
    ├── drive-log.txt    最近一次测试日志
    └── shots/           各视口截图
```

## 怎么玩

打开 `index.html`（Chrome / Edge 双击即可，无需服务器）。

| 操作 | 说明 |
| --- | --- |
| 点击 / 触摸 / `空格` / `↑` / `W` / `Enter` | 扇一下翅膀，让小鸟往上飞 |
| `M` 或右下角 🔊 图标 | 开关音效 |
| 结束后面板上的「再来一次」或再点一下 | 重新开始 |

穿过竹竿缝隙得 1 分，撞到竹竿或掉到地上就结束；最高分存在浏览器本地（localStorage）。
分数越高缝隙越窄（194 → 152 px），每过两根竹竿会飘出一句勉励语（勤能补拙、先飞一步……）。

## 用你给的图替换小鸟

游戏里的小鸟就是附件里的那张黑鲸鱼图，处理流程全在 `tools/make_bird_sprite.py`：

1. **去白底**：亮度 ≥ 236 的像素变透明，边缘按亮度渐变做半透明，避免白边
2. **裁剪居中**：裁掉四周空白，再补成一个正方形（留 18% 边距），这样旋转时不会偏心
3. **左右镜像**（`--mirror`）：游戏是向右飞越竹竿，所以让鲸鱼头朝右，看着像在往前飞
4. **最近邻放大**：58×58 → 160×160，保留原图硬朗的版画感（不会糊）
5. **内嵌**：以 base64 写进 `index.html`，所以整个游戏只有一个文件、离线可玩

重新生成贴图（需要 Python + Pillow），并把新贴图重新内嵌回 HTML：

```powershell
# 生成（--mirror 表示左右翻转；去掉就是原图方向）
python tools/make_bird_sprite.py <原图.png> assets --mirror
# 重新内嵌（把 assets/bird_sprite.png 写回 index.html 里的 SPRITE_URI）
python tools/repack_sprite.py
```

想换成别的图，替换 `index.html` 里的 `SPRITE_URI`（data URI）或改用
`assets/bird_sprite.png` 的路径即可。

## 游戏实现要点

* **逻辑分辨率 420×720**，所有游戏逻辑都在这个坐标系里；渲染时按视口等比缩放
* **缩放策略**：竖屏以宽度为准（420 宽完整可见），横屏以高度为准（720 高完整可见）；
  桌面宽屏下若两侧留白超过 10%，则放大到铺满画布（裁剪量有上限，保证小鸟和竹竿都在画面内）
* **物理**：重力 1550 px/s²，扇翅初速 −452 px/s，下落上限 780 px/s；按 `dt` 积分，60/120/144Hz 表现一致
* **防穿模**：每帧按 1/120 秒分子步做碰撞检测，即使帧率抖动也不会"穿过"竹竿
* **状态机**：`ready`（待机漂浮）→ `play` → `dying`（翻滚坠落）→ `over`
* **画面**：清晨渐变天空、朝阳、流云、远近山、小亭子、滚动草地、竹节竹竿、碰撞白闪 + 屏幕震动、
  小鸟随速度俯仰、扇翅挤压、上升气流、结束面板
* **音效**：WebAudio 现场合成，无音频文件

## 自动化测试

```powershell
# 1) 起本地服务器（后台）
node tests/serve.js

# 2) 启动一个带调试端口的 Chrome（headless 即可）
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --remote-debugging-port=8899 --user-data-dir=$env:TEMP\dsh-game-test about:blank

# 3) 跑回归（视口可换）
$env:CDP_PORT=8899
node tests/drive.js --w=1440 --h=900 --tag=desktop
node tests/drive.js --w=390  --h=844 --mobile --tag=phone
node tests/drive.js --w=820  --h=1180 --tag=tall
```

覆盖内容（18 项）：贴图解码与绘制、空格/指针输入、无操作必落地结束且只死一次、
固定步长物理回放（陪练鸟稳定穿过 6+ 根竹竿且离竹竿最近 ≥17px）、
**撞到天花板后必须落下来（防"粘在天花板上"）**、撞竿必死、
重开、画布后备存储 = 视口 × DPR、变换自检（玩法区不被裁掉）、控制台无异常。

最近一次结果：

| 视口 | 结果 |
| --- | --- |
| 1440×900（桌面） | 18/18 通过 |
| 820×1180（竖屏） | 18/18 通过 |
| 390×844（手机模拟） | 18/18 通过 |
| 420×720（精确等于逻辑尺寸） | 该视口下 headless Chrome 的画布停在 300×150 且 rAF 不启动；同一尺寸在**真实窗口**里验证正常（`tests/shots/final-browser-*.png`），判为 headless 环境的边缘怪癖 |

## 已知限制

* 音效需要用户先有一次点击（浏览器自动播放策略），第一次扇翅可能没声音
* 高刷新率屏幕上游戏节奏与 60Hz 一致（按 dt 积分），但极限帧率下仍有 33ms 的单帧上限
* `tests/shots/` 里保留了各视口截图，可直接查看效果
