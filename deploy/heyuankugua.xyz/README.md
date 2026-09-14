# 部署到 heyuankugua.xyz（宝塔 / 主机面板）

上传两个东西：**一个新目录 `benniao/`** 和 **替换首页 `index.html`**。

## 一、上传游戏目录

把本文件夹里的 `benniao/` 整个目录上传到**网站根目录**下，目标结构：

```
网站根目录/
├── index.html                ← 首页（第二步替换）
└── benniao/                  ← 新增
    ├── index.html            ← 游戏本体（贴图已内嵌，单文件）
    └── assets/
        ├── bird_sprite.png          备用素材（游戏未引用，可留可删）
        └── bird_sprite_preview.png  放大预览（可删）
```

> `assets/` 里的两张图游戏**并不引用**（贴图已 base64 内嵌在 html 里）。
> 留着方便以后换图，想省空间就删掉，不影响运行。

上传后访问 **https://heyuankugua.xyz/benniao/** 应该直接就是游戏。
左上角有「← 返回博客」按钮，点它回首页。

## 二、替换首页（加入项目卡片）

把本文件夹里的 `index.html` 上传覆盖网站根目录的 `index.html`。

它相对你现在线上的版本**只多了 18 行、没有删除任何内容**，就是在「项目展示」区
的第 2 张卡片（智能五子棋）后面插入第 3 张：

```html
<div class="project-card">
    <div class="project-icon">🐋</div>
    <div class="project-title">笨鸟先飞 · The Clumsy Bird</div>
    <div class="project-sub">单文件 Canvas 网页小游戏</div>
    <div class="project-desc">
        一只小鲸鱼版「笨鸟先飞」。点击或按空格扇翅膀，穿过竹竿缝隙，
        分数越高缝隙越窄。纯 Canvas 手写，零依赖、单文件，
        手机与桌面自适应，附带 18 项自动化回归测试。
    </div>
    <div class="project-links">
        <a href="/benniao/">立即试玩 →</a>
        <a href="https://github.com/SCLyu4462/clumsy-bird-flies-first" target="_blank">GitHub →</a>
    </div>
</div>
```

> ⚠️ 如果你在给我那份首页之后又改过线上首页，**别直接覆盖**，改成把上面这段
> 插进你自己那版的 `projects-grid` 里（位置一样：五子棋卡片的 `</div>` 之后）。

## 三、验证清单

- [ ] https://heyuankugua.xyz/benniao/ 能打开，点一下/按空格能起飞
- [ ] 左上角「← 返回博客」能回到首页
- [ ] 首页「项目展示」区出现第 3 张卡片，图标 🐋
- [ ] 卡片上「立即试玩 →」跳到 `/benniao/`，「GitHub →」跳到仓库
- [ ] 手机浏览器打开也正常（竖屏铺满、可触摸操作）

## 说明

* 游戏不依赖任何外部资源：不请求 CDN、不加载字体、贴图内嵌，离线也能玩
* 分数记录存在浏览器 `localStorage`，不会上传任何数据
* 音效由 WebAudio 现场合成，首次点击后才会出声（浏览器自动播放策略）
