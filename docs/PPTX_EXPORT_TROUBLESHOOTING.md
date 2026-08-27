# PPTX 导出排查与修复指南

> 本文档总结 canvas-codex 项目 `src/pptx-export.mjs` 在导出 PPTX 时遇到的常见问题、诊断方法论、代码修复点和临时绕过方案,供未来遇到类似问题时直接套用。
>
> 最后更新:2026-08-19

---

## 目录

1. [诊断方法论(四步法)](#1-诊断方法论四步法)
2. [代码修复清单](#2-代码修复清单)
3. [slide-frame 临时注入方案](#3-slide-frame-临时注入方案绕过-codex-cli)
4. [症状 → 根因 → 修复 速查表](#4-症状--根因--修复-速查表)

---

## 1. 诊断方法论(四步法)

当导出的 PPTX 在 WPS/PowerPoint 中出现"修复提示""背景缺失""排版错位""颜色不对"等问题时,按以下四步顺序排查。

### 第一步:确认是"结构死罪"还是"视觉错位"

生成一个最简 PPTX——只包含一页,这一页上只有一个纯黑色矩形和一行纯黑色文字"Test",不要任何渐变、阴影、背景。

- **如果最简文件都报错"修复"**:
  - 说明 PPTX ZIP 打包器或最底层的 XML 模板有致命缺陷
  - 检查 `[Content_Types].xml` 是否是 ZIP 包里的第一个文件(fflate 按插入顺序写,通常没问题)
  - 检查根命名空间 `xmlns:p` / `xmlns:a` / `xmlns:r` 是否完整
  - 检查 ZIP 压缩算法是否用了非 Deflate

- **如果最简文件正常打开**:
  - 说明基础框架是好的,问题出在复杂属性的 XML 序列化上
  - 进入第二步

### 第二步:用"文件差异对比"揪出元凶

1. 用代码生成包含问题的完整 PPTX(命名为 `my_bad.pptx`)
2. 用 WPS 点击"修复",另存为新文件(命名为 `wps_fixed.pptx`)
3. 将两个文件分别解压到 `bad/` 和 `fixed/` 文件夹
4. 用 `diff -r bad/ fixed/` 或 VS Code "比较文件夹"对比差异

**特别关注以下"隐蔽雷区"**:

| 雷区 | 说明 | 检查方法 |
|---|---|---|
| **A. 文件顺序** | PPTX 要求 `[Content_Types].xml` 必须是 ZIP 包里的第一个文件 | `unzip -l my_bad.pptx \| head -5` |
| **B. 空文件/空节点** | `<p:bg>` 标签下如果没有子元素,必须直接删掉,留空会报错 | `grep -r "<p:bg></p:bg>" bad/` |
| **C. 颜色值越界** | RGB 值不能是小数,透明度 alpha 必须在 0-100000 范围(PPTX 透明度是千分制) | 检查 `<a:alpha val="..."/>` 的值 |
| **D. schema 非法属性** | 某些属性不属于该节点(如 `gradFill` 上的 `scaled`),WPS 严格 schema 校验会丢弃整个节点 | 对比 OOXML schema 文档 |

### 第三步:核对 EMU 坐标转换公式

PPTX 内部单位是 EMU(英制公制单位),常见转换公式:

| 转换 | 公式 | 说明 |
|---|---|---|
| 像素 → EMU | `EMU = px * 9525` | 96 dpi 下,1px = 9525 EMU |
| 磅 → EMU | `EMU = pt * 12700` | 1pt = 12700 EMU |
| 像素 → 磅 | `pt = px * 0.75` | 96 dpi 下,1px = 0.75pt |
| 像素 → 字号 sz | `sz = px * 75` | sz 单位是百分之一磅(0.01pt) |
| 角度 → 60000 分之一度 | `pptxAngle = cssDeg * 60000` | 不需要除以 360 |

**致命陷阱**:如果坐标用了 `px * 9525`,但字号用了 `pt * 12700`,文字和矩形框的比例会失调。

### 第四步:终极"脏"手段(绕过所有 PPTX 渲染引擎)

如果实在无法调试 XML,且"视觉一致"优先级高于"可编辑性":

1. 在 Web 端(Canvas/SVG)把每一页渲染成高清位图(PNG,300 DPI)
2. 生成 PPTX 时,只创建空白页,把位图作为背景图片整张铺满(`<p:blipFill>` 配合 stretch 拉伸)
3. 不要在上面叠加任何 PPT 文本框

WPS 绝对不会报"修复"错误,且视觉 100% 还原。代价是失去可编辑性。

---

## 2. 代码修复清单

以下是本项目 `src/pptx-export.mjs` 已经修复的具体问题,按修复顺序列出。每项包含:文件位置、根因、修复方案。

### 修复 1:渐变角度公式错误

- **文件**:`src/pptx-export.mjs` — `cssAngleToPptxRot` 函数
- **根因**:多了 `/ 360`,导致角度被压缩 360 倍(CSS 180° 实际输出 0.25°)
- **修复**:去掉 `/ 360`,正确输出 `pptDeg * 60000`(60000 分之一度)

### 修复 2:`gradFill` 节点 schema 违规

- **文件**:`src/pptx-export.mjs` — `buildGradFillXml` 函数
- **根因**:`gradFill` 节点写了非法属性 `rot` 和 `scaled`(这两个不是 `CT_GradientFillProperties` 的合法属性),WPS 严格 schema 校验失败,丢弃整个 `gradFill` 节点,导致背景形状变透明
- **修复**:
  - `rot="${...}"` → `rotWithShape="0"`(布尔属性,合法)
  - 移除 `gradFill` 上的 `scaled="0"`(只在 `lin` 上合法)
  - 颜色停止位置 `pos` 钳制在 `0-100000` 范围

### 修复 3:不支持 `radial-gradient`

- **文件**:`src/pptx-export.mjs` — `parseCssGradient` / `buildGradFillXml`
- **根因**:原 `parseCssGradient` 只支持 `linear-gradient`,遇到 `radial-gradient(circle at X% Y%, ...)` 返回 null,被当 fallback 处理
- **修复**:
  - 重写 `parseCssGradient` 支持 `radial-gradient(circle at X% Y%, ...)` 形式
  - `buildGradFillXml` 对 radial 输出 `<a:path path="circle">` + `<a:srcRect>` 控制中心点

### 修复 4:Alpha 透明度丢失

- **文件**:`src/pptx-export.mjs` — `parseColorWithAlpha` / `buildGradFillXml`
- **根因**:`rgba(R,G,B,A)` 的 alpha 通道被丢弃,半透明颜色变成不透明
- **修复**:
  - 新增 `parseColorWithAlpha` 正确解析 `rgba()` 的 alpha 通道
  - 每个 stop 输出 `<a:alpha val="..."/>`(0-100000 千分制)

### 修复 5:`borderRadius` 被忽略

- **文件**:`src/pptx-export.mjs` — `renderFrameSlide` / `buildShapeGeom`
- **根因**:CSS `borderRadius`(px)完全没被翻译到 PPTX
- **修复**:`borderRadius`(px)→ PPTX `roundRect` 几何(`<a:prstGeom prst="roundRect">` + `<a:gd name="adj" fmla="val ${adj}"/>`)

### 修复 6:字号公式多了 1.25 倍率

- **文件**:`src/pptx-export.mjs` — `buildTextBody`
- **根因**:`fontSize * 1.25 * 75` 中,1.25 倍率应该只用于坐标缩放,不应该乘到字号上(字号是 px,直接 `*75` 转 pt 即可),导致文字被放大 25%,撑爆文本框
- **修复**:去掉 `* 1.25`,改为 `fontSize * 75`

### 修复 7:字体名称丢失

- **文件**:`src/pptx-export.mjs` — `buildTextBody`
- **根因**:`fontFamily` 完全没写入 XML,PPT 里所有文字都用 theme 的默认 Calibri
- **修复**:新增 `<a:latin typeface="..."/>` + `<a:ea>` + `<a:cs>`,从 `fontFamily: "Inter, sans-serif"` 取首个字体名

### 修复 8:`<a:bodyPr>` 缺少 `anchor`

- **文件**:`src/pptx-export.mjs` — `buildTextBody`
- **根因**:`<a:bodyPr wrap="square">` 默认 `anchor` 没显式设置,多行文字在文本框里被挤变形
- **修复**:加 `anchor="t"`(顶部对齐)

### 修复 9:文字颜色被 `hexColor` 二次调用破坏

- **文件**:`src/pptx-export.mjs` — `buildTextBody`
- **根因**:`renderFrameSlide` 调用 `hexColor(style.color, "172033")` 把 `"#F4FBFF"` 转成 `"F4FBFF"`(去掉 `#`)赋给 `shape.color`;然后 `buildTextBody` 又调 `hexColor(shape.color, "172033")`,但此时输入是 `"F4FBFF"`(无 `#`),正则 `/#([0-9a-f]{6})\b/i` 匹配失败,返回 fallback `172033`,所有文字变成黑色
- **修复**:新增 `normalizeHexColor` 函数,接受带或不带 `#` 的 hex、3 位或 6 位 hex,统一输出 6 位无 `#` 大写 hex;`buildTextBody` 改用此函数

```javascript
function normalizeHexColor(value, fallback = "172033") {
  const str = String(value || "").trim();
  if (!str) return fallback.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(str)) return str.toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(str)) return str.slice(1).toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(str)) {
    const h = str.slice(1);
    return (h[0] + h[0] + h[1] + h[1] + h[2] + h[2]).toUpperCase();
  }
  return fallback.toUpperCase();
}
```

### 修复 10:坐标缩放倍率硬编码 1.25

- **文件**:`src/pptx-export.mjs` — `renderFrameSlide` 的 `absolutePosition`
- **根因**:`absolutePosition` 把所有坐标硬编码 `* 1.25`(给 1024×576 的 framer 画布设计),但如果 slide-frame 的设计画布是 1280×720,坐标被放大到 1600×900,大量元素超出 PPT 画布(1280×720)
- **修复**:根据 `source.designWidth/designHeight` 自适应计算缩放率

```javascript
const sourceWidth = Number(source.designWidth) || Number(source.width) || SLIDE_WIDTH;
const sourceHeight = Number(source.designHeight) || Number(source.height) || SLIDE_HEIGHT;
const scale = Math.min(SLIDE_WIDTH / sourceWidth, SLIDE_HEIGHT / sourceHeight);
// absolutePosition 用 left * scale, top * scale, width * scale, height * scale
```

### 修复 11:store.mjs 硬编码 slide-frame 尺寸

- **文件**:`src/store.mjs` — `normalizeObject` 的 `slide-frame` 分支(约 1756 行)
- **根因**:`normalizeObject` 对 `slide-frame` 类型硬编码 `width: 1024, height: 576`,完全忽略传入的 width/height,也丢弃 `designWidth/designHeight` 字段
- **修复**:
  - 保留传入的 width/height(默认 1024/576)
  - 新增 `designWidth/designHeight` 字段(供 pptx-export 计算缩放率)

```javascript
if (type === "slide-frame") {
  return {
    ...base,
    width: Number.isFinite(input.width) ? sanitizeDimension(input.width, 1024) : 1024,
    height: Number.isFinite(input.height) ? sanitizeDimension(input.height, 576) : 576,
    designWidth: Number.isFinite(input.designWidth) ? sanitizeDimension(input.designWidth, 1280) : null,
    designHeight: Number.isFinite(input.designHeight) ? sanitizeDimension(input.designHeight, 720) : null,
    background: sanitizeString(input.background, "#ffffff", 300),
    templateId: sanitizeString(input.templateId, "freeform", 120),
    elements: sanitizeSlideElements(input.elements)
  };
}
```

### 修复 12:Image Composition 超时太短

- **文件**:`src/jobs.mjs` 第 22-23 行
- **根因**:`jobTimeoutMs = 5 * 60_000`(5 分钟),Codex CLI 生成多张图像资产通常需要 10-30 分钟,5 分钟超时导致 job 失败
- **修复**:提到 15 分钟,且支持 `CODEX_CANVAS_JOB_TIMEOUT_MS` 环境变量覆盖

```javascript
const jobTimeoutMs = Number(process.env.CODEX_CANVAS_JOB_TIMEOUT_MS) || (15 * 60_000);
const backgroundCompletionTimeoutMs = Number(process.env.CODEX_CANVAS_JOB_TIMEOUT_MS) || (15 * 60_000);
```

### 修复 13:导出按钮文案丢失图标

- **文件**:`public/app.js` 约 6490 行 — `showSlidesExportCheck` 函数
- **根因**:`showSlidesExportCheck` 弹完确认框后,把按钮 innerHTML 重置成 `<span>导出</span>`,丢失了原来的图标和"导出 PPTX"完整文案;紧接着 `downloadSlidesPptx` 把这个被改过的内容当作 `original` 保存,导出完成后恢复成"导出"
- **修复**:删除 `showSlidesExportCheck` 里那行多余的 `button.innerHTML = ...`,让按钮文案的临时改动只发生在 `downloadSlidesPptx` 内部

---

## 3. slide-frame 临时注入方案(绕过 Codex CLI)

当 Codex CLI 不可用或 AI 生成 job 失败时,可以直接通过 store API 注入结构化 slide-frame 数据,让 `pptx-export.mjs` 走 `renderFrameSlide` 分支。

### 适用场景

- Codex CLI 未安装或版本不兼容
- AI 生成 job 超时或失败
- 需要快速验证 PPTX 导出链路
- 已有设计稿,只需转成结构化数据

### 不适用场景

- 需要真正的 AI 生成能力(此方案只是手动注入)
- 需要保持 deck 与 framer 实时同步

### 操作步骤

#### 步骤 1:确认 deck ID 和 canvas ID

```bash
curl -s "http://127.0.0.1:43217/api/state?project=YOUR_PROJECT_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
decks = [o for o in d.get('objects', []) if o.get('type') == 'slides']
for deck in decks:
    print(f'deck id={deck[\"id\"]} name={deck.get(\"name\")}')
"
```

#### 步骤 2:构造 slide-frame JSON

每页 slide-frame 的数据结构:

```javascript
{
  type: "slide-frame",
  canvasId: "YOUR_PROJECT_ID",
  name: "Slide 1 - Hero",
  width: 1280,           // 源画布尺寸(会被 normalizeObject 保留)
  height: 720,
  designWidth: 1280,     // 设计稿尺寸(供 pptx-export 计算缩放率)
  designHeight: 720,
  background: "#020613",
  elements: [
    {
      id: "bg-glow",
      type: "shape",      // 支持:shape / text / image / svg / chart
      x: 240,             // 绝对坐标(不要用 parentId,否则会被累加)
      y: 80,
      width: 800,
      height: 560,
      style: {
        background: "radial-gradient(circle at 50% 50%, rgba(205,255,77,.45), rgba(0,0,0,0) 70%)",
        borderRadius: "0"
      }
    },
    {
      id: "s1-headline",
      type: "text",
      x: 90, y: 150,
      width: 820, height: 180,
      style: {
        color: "#F4FBFF",          // 文字颜色(支持 #hex / rgb / rgba / named)
        fontSize: "62px",          // 必须带 px 单位
        fontWeight: "700",         // >= 600 会被识别为 bold
        fontFamily: "Inter, sans-serif",  // 取首个字体名
        textAlign: "left"          // left / center / right
      },
      text: "重新定义创意工作流"
    }
  ]
}
```

#### 步骤 3:通过 API 注入

```bash
# 创建 slide-frame
curl -X POST "http://127.0.0.1:43217/api/objects" \
  -H "content-type: application/json" \
  -d '{...slide-frame JSON...}'

# 关联到 deck 的 slideIds(注意 PATCH 格式是 {id, patch})
curl -X PATCH "http://127.0.0.1:43217/api/objects" \
  -H "content-type: application/json" \
  -d '{
    "canvasId": "YOUR_PROJECT_ID",
    "updates": [{
      "id": "DECK_ID",
      "patch": {
        "slideIds": ["slide-frame_id_1", "slide-frame_id_2", ...]
      }
    }]
  }'
```

#### 步骤 4:导出 PPTX 验证

```bash
curl -o test.pptx "http://127.0.0.1:43217/api/slides/DECK_ID/pptx"
open test.pptx
```

### 注意事项

1. **坐标系统**:元素坐标用绝对坐标,**不要设 `parentId`**(否则 `absolutePosition` 会累加父元素坐标,导致双重偏移)
2. **设计画布尺寸**:必须同时设置 `width/height` 和 `designWidth/designHeight`,否则 `normalizeObject` 会硬编码成 1024×576,pptx-export 会用 1.25 倍率放大坐标
3. **颜色格式**:支持 `#hex`、`rgb()`、`rgba()`、命名颜色;渐变支持 `linear-gradient(角度, 颜色 停止点, ...)` 和 `radial-gradient(circle at X% Y%, 颜色 停止点, ...)`
4. **字号单位**:`fontSize` 必须带 `px` 单位(如 `"62px"`),内部会去掉 `px` 并乘以 75 转 pt
5. **删除旧 slide-frame**:重新注入前先 DELETE 旧的 slide-frame,否则 deck.slideIds 会指向已删除的对象

### 完整注入脚本示例

参考 `/tmp/inject-slides-v2.js`(临时文件,可复制到项目内长期保存):

```bash
# 修改脚本顶部的 DECK_ID 和 PROJECT 常量
# 修改 slides 数组为你的设计稿内容
node /tmp/inject-slides-v2.js
```

---

## 4. 症状 → 根因 → 修复 速查表

| 症状 | 根因 | 修复位置 | 修复方法 |
|---|---|---|---|
| WPS 弹"修复"提示,修复后背景缺失 | `gradFill` 节点有非法属性 `rot`/`scaled`,WPS 丢弃整个节点 | `buildGradFillXml` | 改用合法属性 `rotWithShape="0"`,移除 `scaled` |
| 渐变方向不对(几乎水平) | 角度公式多了 `/ 360` | `cssAngleToPptxRot` | 去掉 `/ 360`,输出 `pptDeg * 60000` |
| 径向渐变变成纯色 | 不支持 `radial-gradient` | `parseCssGradient` / `buildGradFillXml` | 重写解析器支持 radial,输出 `<a:path path="circle">` |
| 半透明颜色变成不透明 | `rgba()` 的 alpha 通道被丢弃 | `parseColorWithAlpha` | 解析 alpha,输出 `<a:alpha val="..."/>` |
| 圆角卡片变直角 | `borderRadius` 被忽略 | `renderFrameSlide` / `buildShapeGeom` | 翻译成 `roundRect` 几何 |
| 文字字号撑爆文本框 | 字号公式多了 `* 1.25` | `buildTextBody` | 去掉 `* 1.25`,改为 `fontSize * 75` |
| 字体变成 Calibri | `fontFamily` 没写入 XML | `buildTextBody` | 新增 `<a:latin typeface="..."/>` |
| 多行文字在文本框里被挤变形 | `<a:bodyPr>` 缺少 `anchor` | `buildTextBody` | 加 `anchor="t"` |
| 所有文字变成黑色 | `hexColor` 二次调用,无 `#` 的 hex 匹配失败 | `buildTextBody` | 新增 `normalizeHexColor` 函数 |
| 元素超出画布边界 | 坐标缩放硬编码 1.25 | `absolutePosition` | 根据 `designWidth/designHeight` 自适应缩放 |
| store 里 slide-frame 尺寸被改成 1024×576 | `normalizeObject` 硬编码 | `store.mjs` | 保留传入的 width/height,新增 designWidth/designHeight 字段 |
| AI 生成 job 超时失败 | `jobTimeoutMs` 只有 5 分钟 | `jobs.mjs` | 提到 15 分钟,支持环境变量覆盖 |
| 导出按钮文案变成"导出" | `showSlidesExportCheck` 覆盖了按钮 innerHTML | `app.js` | 删除多余的 `button.innerHTML = ...` |
| 导出的 PPTX 只有图片,没有结构化元素 | deck 里只有 image 截图,没有 slide-frame | — | 走临时注入方案(见第 3 节) |

---

## 附:关键文件位置

| 文件 | 作用 |
|---|---|
| `src/pptx-export.mjs` | PPTX 导出核心逻辑(XML 生成、坐标转换、颜色解析) |
| `src/store.mjs` | 画布对象持久化(`normalizeObject` 在此) |
| `src/jobs.mjs` | 图像 job 生命周期(超时设置在此) |
| `src/slides-jobs.mjs` | AI 幻灯片生成 job(`importSlides` 持久化 slide-frame) |
| `src/codex-runner.mjs` | Codex CLI 检测与调用 |
| `public/app.js` | 前端 UI(导出按钮、deck 操作) |

---

## 附:诊断工具命令

```bash
# 1. 解压 PPTX 检查 XML
cd /tmp && rm -rf pptx-check && mkdir pptx-check && cd pptx-check
unzip -q /path/to/your.pptx
ls ppt/slides/

# 2. 提取所有形状坐标(像素)
python3 -c "
import xml.etree.ElementTree as ET
ns = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
tree = ET.parse('ppt/slides/slide1.xml')
root = tree.getroot()
for sp in root.iter('{http://schemas.openxmlformats.org/presentationml/2006/main}sp'):
    name_el = sp.find('.//p:cNvPr', ns)
    name = name_el.get('name', '?') if name_el is not None else '?'
    xfrm = sp.find('.//a:xfrm', ns)
    if xfrm is None: continue
    off = xfrm.find('a:off', ns)
    ext = xfrm.find('a:ext', ns)
    x, y = round(int(off.get('x', 0))/9525), round(int(off.get('y', 0))/9525)
    w, h = round(int(ext.get('cx', 0))/9525), round(int(ext.get('cy', 0))/9525)
    xw, yh = x+w, y+h
    flag = ' ❌ 超出' if xw > 1280 or yh > 720 else ''
    print(f'{name:<20} x={x:<6} y={y:<6} w={w:<6} h={h:<6} x+w={xw:<6} y+h={yh:<6}{flag}')
"

# 3. 检查文字颜色
grep -o 'srgbClr val="[0-9A-F]*"' ppt/slides/slide1.xml | sort | uniq -c

# 4. 查看服务端诊断日志(需在 pptx-export.mjs 里开启 console.error)
tail -f /var/folders/0z/hx_5jw4n6qj35n3s1_qd40xw0000gn/T/trae-agent-toolhost-501/jobs/*/output.log | grep '\[pptx-export\]'

# 5. 查询 store 状态
curl -s "http://127.0.0.1:43217/api/state?project=PROJECT_ID" | python3 -m json.tool | head -50
```
