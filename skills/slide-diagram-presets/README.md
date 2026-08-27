# Slide Diagram Presets

Codex-Canvas 商业图解组件库。preset 是 deterministic 约束集,供 `create-slide-diagram` 在生成图解时绑定使用,而非让 AI 自由设计布局。AI 只负责填充槽位内容,组件保证排版质量。

## 设计哲学

走参数化 preset,不走自由画 SVG。每个 preset 定义:

1. **family** — 对应 create-slide-diagram 的 diagram family(matrix/hierarchy/timeline/funnel 等)
2. **layout** — 具体布局类型标识(如 2x2-grid / vertical-funnel),由 diagram skill 解释
3. **slots** — 槽位数组,每个槽位必须被填充,不得跳过不得新增
4. **visualSpec** — 描边宽度/分割线/箭头/连接器样式
5. **accessibilityPattern** — 阅读顺序,反映在 accessibility summary

6 个 preset 覆盖高频商业图解场景。需要新场景时,优先扩展现有 preset 的槽位定义,而非新增 preset。

## 目录结构

```
skills/slide-diagram-presets/
├── README.md              # 本文件
├── schema.json            # JSON Schema 定义(可校验)
└── presets/               # preset 定义
    ├── swot-2x2.json
    ├── funnel-stages.json
    ├── pyramid-layers.json
    ├── comparison-2col.json
    ├── org-tree.json
    └── timeline-roadmap.json
```

## 使用方式

- 后端加载器:`src/slide-diagram-presets.mjs` 提供 `loadPreset(id)` / `listPresets()` / `inferPresetFromOutline(text)` 同步函数。
- diagram skill 绑定规则:见 [../create-slide-diagram/SKILL.md](../create-slide-diagram/SKILL.md) 的 "Preset Binding" 段。
- `inferPresetFromOutline(outlineText)` 是 deterministic 关键词匹配器,host pipeline 可调用它从 outline 文本自动建议 preset;AI 可确认但不得 invent preset id。

## 与模板系统的关系

- preset 的 `visualSpec`(描边宽度等)在 slide template 的 `shape` 字段更严时,以 template 为准。
- preset 与 template 是正交的:一个 template 可用任意 preset,反之亦然。
- 当 deck 同时绑定 templateId 与 presetId 时,二者视觉规范冲突以 template 为准(template 是 deck 级,preset 是 page 级)。

## 扩展原则

- 新增 preset 前,先看现有 6 个能否通过调整 slots/visualSpec 覆盖。
- preset 字段必须是纯数据,不含 AI 决策逻辑。
- preset 的 family 可扩展(如 funnel 不在原 diagram family 列表),但新 family 必须在 schema 的 enum 内声明。
