# 部署到 heyuankugua.xyz（宝塔 / 主机面板）

上传两个东西：**一个新目录 `xiaojingyu/`** 和 **替换首页 `index.html`**。

## 一、上传游戏目录

把本文件夹里的 `xiaojingyu/` 整个目录上传到**网站根目录**下，目标结构：

```
网站根目录/
├── index.html                 ← 首页（第二步替换）
└── xiaojingyu/                ← 新增（原来的 benniao/ 可以删掉）
    └── index.html             ← 游戏本体（贴图已内嵌，单文件，无其他依赖）
```

上传后访问 **https://heyuankugua.xyz/xiaojingyu/** 应该直接就是游戏。
左上角有「← 返回博客」按钮，点它回首页。

## 二、替换首页（加入项目卡片）

把本文件夹里的 `index.html` 上传覆盖网站根目录的 `index.html`。

它相对你线上版本**只多了一张卡片、没有删除任何内容**，即在「项目展示」区
第 2 张卡片（智能五子棋）之后插入第 3 张：

```html
<div class="project-card">
    <div class="project-icon">🐋</div>
    <div class="project-title">小鲸鱼能飞 · The Little Whale Who Could Fly</div>
    <div class="project-sub">单文件 Canvas 网页小游戏</div>
    <div class="project-desc">
        一只想飞的小鲸鱼。点击或按空格扇翅膀，穿过竹竿缝隙，
        分数越高缝隙越窄。纯 Canvas 手写，零依赖、单文件，
        手机与桌面自适应，附带 18 项自动化回归测试。
    </div>
    <div class="project-links">
        <a href="/xiaojingyu/">立即试玩 →</a>
        <a href="https://github.com/SCLyu4462/xiaojingyu-can-fly" target="_blank">GitHub →</a>
    </div>
</div>
```

> ⚠️ 如果你在给我那份首页之后又改过线上首页，**别直接覆盖**，改成把上面这段
> 插进你自己那版的 `projects-grid` 里（位置一样：五子棋卡片的 `</div>` 之后）。

## 三、验证清单

- [ ] https://heyuankugua.xyz/xiaojingyu/ 能打开，标题是「小鲸鱼能飞」
- [ ] 点一下 / 按空格能起飞，穿过竹竿有分数
- [ ] 左上角「← 返回博客」能回到首页
- [ ] 首页「项目展示」区出现第 3 张卡片，图标 🐋
- [ ] 卡片上「立即试玩 →」跳到 `/xiaojingyu/`，「GitHub →」跳到仓库
- [ ] 手机浏览器打开也正常（竖屏铺满、可触摸操作）
- [ ] 旧的 `/benniao/` 目录可以删掉（首页卡片已不再指向它）

## 说明

* 游戏不依赖任何外部资源：不请求 CDN、不加载字体、贴图内嵌，离线也能玩
* 最高分存在浏览器 `localStorage`（键名 `xiaojingyu_best`），不会上传任何数据；
  因为换了键名，之前 `benniao_best` 的老记录不会带过来
* 音效由 WebAudio 现场合成，首次点击后才会出声（浏览器自动播放策略）
