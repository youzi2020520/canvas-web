# Codex-Canvas Slides 产品路线图

> 本文档作为 slides 模块产品讨论的稳定参照,不是规格书。代码事实以 `src/` 实际实现为准;本文档反映 2026-08-24 时点的对照快照,需在能力发生实质变化时同步刷新。

---

## 落地状态(2026-08-24)

| 项 | 状态 | 文件 |
|---|---|---|
| 模板系统 schema | 已落地 | [skills/slide-templates/schema.json](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/skills/slide-templates/schema.json) |
| 12 个种子模板 | 已落地 | [skills/slide-templates/templates/](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/skills/slide-templates/templates/) 年度总结/商业计划书/产品发布/毕业答辩/培训课件 + 项目汇报/行业研究/战略规划/方案汇报/公司介绍/竞品分析/增长复盘;mapper `PURPOSE_KEYWORDS` 同步扩充到 12 组,12/12 brief 命中对应模板 @ 71-92% |
| 模板加载器 | 已落地 | [src/slide-templates.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slide-templates.mjs) |
| compose skill 绑定规则 | 已落地 | [skills/compose-professional-slides/SKILL.md](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/skills/compose-professional-slides/SKILL.md) "Template Binding" 段 |
| brief → templateId mapper | 已落地 | [src/slide-template-mapper.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slide-template-mapper.mjs) `mapBriefToTemplate(brief)` / `normalizeBrief(brief)`,deterministic 关键词+评分,confidence < 0.6 返回 top-3 推荐 |
| 商业图解组件库 | 已落地 | [skills/slide-diagram-presets/](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/skills/slide-diagram-presets/) schema + 12 preset(SWOT/漏斗/金字塔/对比/组织架构/时间轴 + 流程图/鱼骨图/能力雷达/价值链/KPI仪表盘/循环闭环)+ [src/slide-diagram-presets.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slide-diagram-presets.mjs) 加载器,`PRESET_KEYWORDS` 12 组,12/12 关键词推断命中 |
| PPTX 双重渲染回归 | 已落地(最低版本) | [src/pptx-export.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/pptx-export.mjs) `verifyExportFidelity(pptxBuffer, originalFrames)`,字段级 diff(slide 数量 / shape 数量 / 填充色 / 字体类 via `classifyFont`);坐标 diff 留作未来增强(导出 scale 归一化使直接对比复杂) |
| Pipeline 集成 | 已落地 | [src/slides-jobs.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slides-jobs.mjs):`runBriefOptimization` 调 `mapBriefToTemplate` 存 `job.deckTemplateId`;`resolveDeckTemplate(job)` 在 generate-slides/plan-slides 路径从 prompt+visualDirection 重推导;`slidesPrompt` 经 `templateBindingSection(job)` 注入模板约束;`publicJob` 暴露 `deckTemplateId`。[src/pptx-export.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/pptx-export.mjs) `exportSlidesPptx` 调 `verifyExportFidelity` 挂 `fidelity` 报告到返回值(smoke `pptx visual fidelity contract` 通过) |
| 图解 preset 自动绑定 | 已落地 | [src/slides-jobs.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slides-jobs.mjs) `normalizeOutline` 用 `inferPresetFromOutline(title+message+visual+keyPoints)` 给每页挂 `presetId`;`presetBindingSection(job)` 在 `slidesPrompt` 注入命中 preset 的完整定义(family/layout/slots/visualSpec);`writeSlidePlan` 经 `...slide` 自动序列化 `presetId` 到 slide-plan.json;`create-slide-diagram` SKILL.md 的 "Preset Binding" 契约已就绪,数据层注入即生效 |
| 质量报告汇总 | 已落地 | [src/slides-jobs.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slides-jobs.mjs) `buildQualityReport(slides)` 在生成 finalize(import 后、done 前)聚合 `collectLayoutIssues`+`collectDataAccuracyIssues` 每页 issue,挂 `job.qualityReport`(`{layoutIssues,dataIssues,summary:{pages,errors,warnings}}`);`publicJob` 暴露 `qualityReport`;导出 PPTX 的 `fidelity` 报告单独挂在 `exportSlidesPptx` 返回值 |
| 集成回归验证 | 已落地 | [scripts/smoke.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/scripts/smoke.mjs) `testSlidesPipelineIntegration` 端到端验证串联:brie→`resolveDeckTemplate`→`deckTemplateId`≥0.6、`templateBindingSection` 注入、`normalizeOutline`→`presetId` 命中、`presetBindingSection` 注入、`slidesPrompt` 含两者、`buildQualityReport` summary。回归发现并修复 mapper 关键词缺口:`PURPOSE_KEYWORDS["年度总结"]` 加"业绩报告/年度业绩"等、`AUDIENCE_KEYWORDS["管理层"]` 加"董事/董事会"、`normalizeBrief` style/audience/scenario 改 infer 优先(field fallback);修复后"年度业绩报告"0.217→0.833,8/9 真实 brief 命中对应模板 |
| 企业品牌模板 | 已落地 | 当前项目可保存品牌名称、字体、主辅色、背景色与页脚规则；生成时作为 `visualDirection.brandProfile` 强约束注入，不改变已确认内容与数据 |

---

## 一、产品定位

Codex-Canvas 是 Codex 桌面插件(macOS + Windows),不是云端 SaaS。所有功能设计必须围绕这一定位展开。

### 已明确排除的方向(避免精力分散)

| 排除项 | 理由 |
|---|---|
| 多人实时协作 | Codex 单机桌面插件无账号体系,做不了云端协同 |
| Web 端 / 移动端 | Codex 插件能力范围仅限桌面,跨平台已声明为 macOS+Windows |
| 显式多 Agent 框架 | "多 Agent"是 marketing 词,实质就是 specialist skill 路由,现有 `src/slides-skill-router.mjs` 已覆盖 |
| 自建输入层(文档/URL/语音/思维导图) | Codex chat 本身处理文档/URL/语音输入,canvas-codex 应接收 Codex 已处理的素材,而非自建一遍输入层 |
| 几百个静态模板 | 不可维护,会爆炸;走"少量可组合原子 × 参数"路线 |

### 仅保留的两个输入入口

1. **主题/简报输入** — 用户一句话或简报,经 `optimize-slide-brief` 结构化。
2. **PPTX reference** — 既有 PPT 作为结构/视觉参考(binding reference),不做"从现有 PPT 优化"独立入口,避免第二套 pipeline。

---

## 二、六层能力对照(现有实现 vs 待补)

| 层 | 功能点 | 现有实现 | 状态 |
|---|---|---|---|
| 输入 | 主题一句话生成 | `optimize-slide-brief` → `compose-professional-slides` | 已有 |
| 输入 | PPTX reference 导入 | compose skill 内 binding reference | 已有 |
| 输入 | 文档"保持原文/改写/参考"三模式 | 无(借 Codex) | 后置 |
| 思考 | 意图理解 + 大纲 + 叙事线 | outline 单一确认(storyline + chapter + page role + title + message) | 已有 |
| 思考 | 多 Agent 协同 | specialist skill 路由(compose / chart / diagram / visual / review) | 已有(名词差异) |
| 视觉 | 模板智能匹配 | [slide-template-mapper.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slide-template-mapper.mjs) `mapBriefToTemplate` deterministic 关键词+评分,12 模板库,confidence<0.6 返回 top-3 | 已落地 |
| 视觉 | 设计哲学 → 色板推导 | 模板预定义 `palette.roles`(8 角色),经 `deckTemplateId` 绑定 + `templateBindingSection` 注入;非动态生成色板而是匹配预定义 | 已落地(匹配式) |
| 视觉 | 标题/正文/数据三角色字体 | 模板 `typography.roles`(title/subtitle/body/data/caption 5 角色,含 fontFamily/sizeRange/weight/lineHeight) | 已落地 |
| 视觉 | 布局系统(标题+图表/分栏/矩阵/时间轴) | [slides-layout-engine.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slides-layout-engine.mjs) 三层显式清单:`INTENT_RULES`(11 条 intent 推断规则,关键词+positional,遍历式)、`archetypeForIntent`(intent→archetype 对象映射)、`SLIDE_LAYOUTS`(13 archetype→slot box 数据) | 已清单化 |
| 视觉 | 用户偏好记忆 | 无 | 空白(桌面插件价值有限,后置) |
| 构建 | 智能排版(黄金分割/密度/一致性) | layout-engine + validation + targeted repair | 已有 |
| 构建 | 数据图表(ECharts 15+) | `create-slide-chart` | 数据图已有 |
| 构建 | 商业图解(SWOT/漏斗/金字塔/组织架构/对比矩阵/仪表盘) | [slide-diagram-presets.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slide-diagram-presets.mjs) 12 参数化 preset(SWOT/漏斗/金字塔/对比/组织架构/时间轴 + 流程图/鱼骨图/能力雷达/价值链/KPI仪表盘/循环闭环),`normalizeOutline` 自动绑定 `presetId` | 已落地 |
| 构建 | AI 配图 | `generate-slide-visual` | 已有 |
| 构建 | 多格式导出 | 仅 PPTX | 缺 PDF / 长图 |
| 交互 | 在线编辑 | canvas 本身是无限画布编辑器 | 已有 |
| 交互 | 单页重生成(失败修复) | targeted repair(preserve passing pages, only regen failing) | 已有 |
| 交互 | 单页主动重生成(用户主动指定) | 无 | 缺口 |
| 交互 | AI 对话修改(deck 级) | `transform-slide-deck`(businesslike / shorten-30 / dark-brand 3 个 actionId) | 已有 |
| 交互 | AI 对话修改(单页/单元素级) | 无 | 缺口 |
| 质量 | 设计一致性检查 | `review-slide-quality` deck-wide review | 已有 |
| 质量 | 布局诊断(溢出/重叠/对比度) | [slides-layout-engine.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slides-layout-engine.mjs) `collectLayoutIssues(frame)` 返回结构化清单(`{id,severity,elementId,message}`),6 类:cyclic-parent/invalid-geometry/out-of-bounds/parent-clip/safe-area(error)+ low-contrast/text-overlap(warning);`validatePostLayout` 保持 throw 契约 | 已清单化 |
| 质量 | 内容准确性(关键数据评分) | [slides-jobs.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slides-jobs.mjs) `collectDataAccuracyIssues(elements, index)` 返回清单:`simulated-without-disclosure`(error,simulated chart 无演示标注)+ `key-data-without-source`(warning,含实质数据/非模拟 chart 但无来源标注);`validateSimulatedDataDisclosure` 重构为委托并保持 throw 契约 | 已落地(最低版本) |
| 质量 | Storyline 连读 | final deck review 必经阶段 | 已有 |
| 质量 | 敏感内容审核 | 无 | 空白(借 Codex 内容策略) |
| 质量 | PPTX 双重渲染回归 | [pptx-export.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/pptx-export.mjs) `verifyExportFidelity(buffer, frames)` 字段级 diff(slide 数/shape 数/填充色/字体类),`exportSlidesPptx` 导出后自动调用并挂 `fidelity` 报告 | 已落地(最低版本) |

---

## 三、三块硬资产(真正要补的)

其他 80% 在现有 skill 契约里已经写明。真正决定能否从"偶尔好看"走到"稳定可交付"的是以下三块硬资产。

### 硬资产 1:模板系统(视觉层)

**为什么是最大缺口**:现有 visual-system / rhythm 完全靠 AI 在 compose skill 内"自动规划",没有显式可对齐的模板系统。这是从"AI 自由生成"转向"模板约束"的唯一支柱。

**设计原则**:走可组合原子,不做几百个静态模板。

```
模板 schema = palette roles
            × typography roles(标题 / 正文 / 数据)
            × shape language(圆角/阴影/描边)
            × page-role slots(封面/目录/章节/内容/数据/总结)
            × chart language
```

**子任务**:
1. 在 `skills/` 下新增 `slide-templates/` 目录,定义模板 schema JSON。
2. 手工填 5-8 个种子组合(覆盖高频场景):
   - 年度总结 × 管理层 × 商务 × 图表型
   - 产品发布 × 科技行业 × 未来科技 × 全图大字型
   - 毕业答辩 × 教育学术 × 极简清新 × 图解型
   - 商业计划书 × 早期项目 × 专业商务 × 数据驱动型
   - 等等
3. 在 `optimize-slide-brief` 之后、`compose-professional-slides` 之前加 deterministic mapper(纯函数,不调 AI),brief 字段 → `templateId` + 置信度。置信度不足时给 3 个推荐(对应"AI 只理解,不随意决定模板")。
4. `store.mjs` 的 `templateId: "freeform"` 改为可绑定具体模板 ID,compose skill 读模板约束做 visual-system 规划。

**不做**:
- 不做"8 套设计哲学 + 7 种页面布局"这种想象数字。
- 不做"按行业/风格/用途三维筛选"的几百个模板库。

### 硬资产 2:商业图解组件库(构建层)

**为什么是缺口**:`create-slide-chart`(ECharts)覆盖了**数据图表**(柱/折/饼/散点/漏斗数据图),但 **SWOT / 金字塔 / 对比矩阵 / 组织架构 / 仪表盘 / 路线图 / 流程图** 这些"商业图解"目前要靠 `create-slide-diagram` 临时画 SVG,不是稳定可复用组件。

**设计原则**:做成 `create-slide-diagram` 的参数化 preset,而非每次 AI 临时画。

**子任务**:
1. 在 `skills/create-slide-diagram/references/` 下定义组件 preset schema(类型 + 槽位数 + 数据绑定 + 视觉规范)。
2. 先做 6 个最高频 preset:SWOT、漏斗、金字塔、对比矩阵、组织架构、流程时间轴。
3. preset 的视觉规范绑定到硬资产 1 的模板系统(shape language / chart language),保证同一模板下组件视觉一致。
4. ~~`slides-skill-router.mjs` 的路由规则扩展:outline 关键词匹配到 preset 类型时,直接绑定 preset ID 而非让 AI 临时设计。~~(已落地:`normalizeOutline` 调 `inferPresetFromOutline` 给每页挂 `presetId`,`presetBindingSection` 在 `slidesPrompt` 注入命中 preset 完整定义,`writeSlidePlan` 序列化到 slide-plan.json)

**不做**:
- 不做"15+ 种图表"(数据图已由 ECharts 覆盖,不重复造轮子)。
- 不做动态/交互式组件(PPTX 静态导出场景不需要)。

### 硬资产 3:PPTX 双重渲染回归(质量层)

**为什么是真空白**:`docs/PPTX_EXPORT_TROUBLESHOOTING.md` 列了 13 项手工修复,全是**导出前静态 XML 校验**。没有"导出后程序化重开 PPTX、渲染、与画布截图 diff、超阈值进入自动修复"。这才是"稳定可交付"承诺真正闭合的最后一块。

**设计原则**:程序化回归,不依赖人眼对比。

**子任务**:
1. 在 `src/pptx-export.mjs` 末尾加 `verifyExportFidelity(pptxPath, sourceFrames)` 函数。
2. 最低版本校验项:
   - 解压 PPTX,抽取每页形状的坐标/字体/颜色/圆角/渐变。
   - 与画布 `slide-frame` 的 elements JSON 做字段级 diff。
   - 检查项:文字溢出、字体替换、圆角丢失、渐变方向、alpha 丢失、坐标越界、字号缩放错误。
3. 超阈值时:不直接显示"导出完成",而是标红失败项 + 进入 targeted repair(回到 frame 层修复后重新导出)。
4. 输出回归报告(JSON),含每页差异项清单。

**不做**:
- 不做"渲染成位图与画布截图像素 diff"(过重,且 PPTX 渲染器跨平台不一致)。
- 不做动画/切换的导出回归(PPTX 静态导出当前不涉及动画)。

---

## 四、落地阶段

### 阶段一(P0,基础质量稳定性)

1. **模板系统 schema + 5-8 个种子模板**(硬资产 1 的 1-2 步)
2. **brief → templateId deterministic mapper**(硬资产 1 的 3 步)
3. **商业图解组件库 6 个 preset**(硬资产 2 的 1-3 步)
4. **PPTX 双重渲染回归最低版本**(硬资产 3 的 1-3 步)

### 阶段二(P1,体验完善)

5. ~~模板系统种子扩充到 12-15 个~~(已扩充到 12 个:新增项目汇报/行业研究/战略规划/方案汇报/公司介绍/竞品分析/增长复盘,mapper 关键词同步扩充,12/12 命中 @ 71-92%)
6. ~~商业图解 preset 扩充到 12 个~~(已扩充:新增流程图/鱼骨图/能力雷达/价值链/KPI仪表盘/循环闭环,`PRESET_KEYWORDS` 同步扩充到 12 组,12/12 关键词推断命中)
7. 数据模式切换 UI(真实/模拟/占位,生成前选择)
8. 单页主动重生成 + 对话级 transform(扩展 `transform-slide-deck` 的 actionId)
9. PDF / 长图导出
10. PPTX 回归报告可视化(画布内显示差异项)
11. **重点：可编辑 PPTX 演示动画 + PowerPoint/WPS 双端兼容闭环**
   - 为页面和元素提供动画编辑器：进入/退出效果、分组、顺序、单击/与上一动画同时/上一动画之后、持续时间与延迟。
   - 生成标准 OOXML `p:transition` / `p:timing`，不得把动画页面栅格化；文字、形状、图片、图表仍保持可编辑。
   - 真正使用持久化的 `animation.groups`，支持至少 appear / fade / wipe / slide / zoom，并允许整页或整套清除动画。
   - 增加导出前动画时间轴校验、导出后 OOXML 回读，以及 Microsoft PowerPoint 与 WPS 的实机播放/另存回归矩阵。
   - WPS/PowerPoint 不支持的效果必须确定性降级并在导出报告中说明；禁止静默丢失动画。
   - 验收标准：生成 PPTX 在 PowerPoint 和 WPS 中均可按预期单击播放、自动串联、返回重播，并在另存后保留动画时间轴和对象可编辑性。

### 阶段三(P2,差异化)

12. 用户偏好记忆(仅同一项目内,不做跨设备同步)
13. 参考 PPT 模板复用(从 PPTX reference 提炼模板 schema 反向生成)
14. Excel / 文档数据映射(借 Codex 处理,canvas-codex 只接收结构化数据)

### 阶段四(P3,可选)

15. ~~企业品牌模板(本地配置,不涉云端)~~(已落地:项目级本地品牌配置 + 生成绑定)
16. 模板市场(若 Codex 插件市场开放再做)

---

## 五、设计哲学(从上一轮讨论沉淀)

1. **AI 自由度必须被专业结构约束**:不是"加更多 prompt",而是把 AI 理解力限制在模板、组件、数据规则、质量校验之内。skill 契约里的 `binding` / `preservation rules` / `do not invent` 已经体现这一点,继续顺着走。

2. **走可组合原子,不走静态模板库**:`palette × typography × shape × page-role × chart` 五维可组合,5-8 个种子覆盖高频场景;不做几百个静态模板。

3. **AI 只理解,不随意决定**:brief → templateId 走 deterministic mapper(规则 + 评分),AI 不参与选模决策;specialist routing 也走 outline 关键词正则 + 推断,不让 AI 每次自由决定。

4. **质量校验分页面级和整套级**:页面级失败只修当前页(targeted repair),整套级走 final deck review;两者都是必经阶段,不是可选步骤。

5. **导出必须可回归**:PPTX 导出不是终点,而是回归起点。导出后程序化重开校验,超阈值不显示"完成"。

6. **桌面插件定位优先**:任何与云端 SaaS 能力(多人协作 / Web/移动端 / 跨设备同步)冲突的功能,一律后置或排除。

---

## 六、相关文件

| 文件 | 作用 |
|---|---|
| [docs/PROJECT_STATIC_CONTEXT.md](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/docs/PROJECT_STATIC_CONTEXT.md) | 项目稳定上下文(架构/约束/规则) |
| [docs/PPTX_EXPORT_TROUBLESHOOTING.md](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/docs/PPTX_EXPORT_TROUBLESHOOTING.md) | PPTX 导出 13 项手工修复清单(硬资产 3 的前置基础) |
| [skills/compose-professional-slides/SKILL.md](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/skills/compose-professional-slides/SKILL.md) | 主 composition skill 契约 |
| [skills/optimize-slide-brief/SKILL.md](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/skills/optimize-slide-brief/SKILL.md) | brief 优化 skill(硬资产 1 mapper 的前置) |
| [skills/transform-slide-deck/SKILL.md](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/skills/transform-slide-deck/SKILL.md) | deck 级 transform skill |
| [src/slides-skill-router.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slides-skill-router.mjs) | specialist skill 路由(硬资产 2 preset 路由的扩展点) |
| [src/slides-layout-engine.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/slides-layout-engine.mjs) | 布局引擎 + validation |
| [src/pptx-export.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/pptx-export.mjs) | PPTX 导出(硬资产 3 的实现点) |
| [src/store.mjs](file:///Users/mac/Downloads/个人文件/AI开发网站/canvas-codex/src/store.mjs) | 画布对象持久化(模板 ID 绑定点) |
