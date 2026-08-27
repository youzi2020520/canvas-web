# Slide Templates

Codex-Canvas 的可组合幻灯片模板系统。模板是 deterministic 约束集,供 `compose-professional-slides` 在规划 visual-system 时绑定使用,而非让 AI 自由发挥。

## 设计哲学

走可组合原子,不走几百个静态模板。模板由 6 维原子组合而成:

1. **palette roles** — 8 个语义色角色(背景/容器/主色/强调/三档文字/描边)
2. **typography roles** — 5 个字体角色(标题/副标题/正文/数据/辅助)
3. **shape language** — 圆角/阴影/描边宽度
4. **page-role slots** — 每个 page role 映射到 layout-engine 的 archetype + 内容槽位
5. **chart language** — 图表色板/字体/网格色
6. **image language** — 图片视觉语言/处理风格/裁切

5-8 个种子组合覆盖高频场景。需要新场景时,优先扩展现有模板的原子定义,而非新增模板。

## 目录结构

```
skills/slide-templates/
├── README.md              # 本文件
├── schema.json            # JSON Schema 定义(可校验)
└── templates/             # 种子模板
    ├── annual-report-business-chart.json
    ├── product-launch-tech-hero.json
    ├── thesis-defense-academic-diagram.json
    ├── business-plan-startup-data.json
    └── training-course-flat-educational.json
```

## 使用方式

- 后端加载器:`src/slide-templates.mjs` 提供 `loadTemplate(id)` / `listTemplates()` 同步函数。
- compose skill 绑定规则:见 [skills/compose-professional-slides/SKILL.md](../compose-professional-slides/SKILL.md) 的"Template Binding"段。
- 挂载点:`job.deckTemplateId` 字段(deck 级模板绑定,默认 `freeform` 表示不绑定)。注意:这与 `slide-frame.templateId`(page role,如 cover/section/insight)是不同字段,不要混淆。

## 字段说明

完整字段定义见 [schema.json](./schema.json)。关键约束:

- `id` 必须 kebab-case,与文件名同。
- `palette.roles` 必须含全部 8 个色角色。
- `typography.roles` 必须含全部 5 个字体角色。
- `pageRoleSlots` 至少 1 项,每项必须含 `layout` + `slots`。
- `chart.palette` 必须 3-12 个 hex 色值。
- 所有颜色必须是 6 位 hex(如 `#0f172a`),不支持 rgba/hsl。

## 字体替换

模板里写的 CJK 字体名(如 `思源黑体 SC`)在 PPTX 导出时由 `src/pptx-export.mjs` 自动替换为跨平台兼容字体(详见 [docs/PPTX_EXPORT_TROUBLESHOOTING.md](../../docs/PPTX_EXPORT_TROUBLESHOOTING.md))。模板里写字体族栈即可,导出层负责兼容。

## 扩展原则

- 新增模板前,先看现有 5 个能否通过调整原子定义覆盖。能覆盖就不新增。
- 模板字段必须是纯数据,不含 AI 决策逻辑。任何"AI 决定"的逻辑应该在 `compose-professional-slides` skill 内,而非模板内。
- 模板定稿前不进入 `brief → templateId` mapper 阶段(见 [docs/SLIDES_PRODUCT_ROADMAP.md](../../docs/SLIDES_PRODUCT_ROADMAP.md) 阶段一第 2 项)。
