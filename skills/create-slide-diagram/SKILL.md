---
name: create-slide-diagram
description: Turn processes, systems, timelines, hierarchies, and relationships into clear presentation diagrams using structured groups and self-contained SVG. Use when prose or card grids obscure how parts connect.
---

# Create Slide Diagram

## Workflow

1. Extract nodes, relationships, direction, hierarchy, and the intended conclusion.
2. Choose a diagram family: flow, architecture, timeline, cycle, hierarchy, matrix, or causal chain.
3. Remove secondary detail until the diagram has one clear reading path.
4. Build connected SVG geometry and separate editable text labels.
5. Group related elements so the diagram can move as a unit without flattening the whole slide.

Read [diagram-contract.md](references/diagram-contract.md) for geometry and accessibility rules.

## Output Requirements

- Use SVG for arrows, connectors, icons, stars, braces, and decorative geometry.
- Do not type symbols with emoji, Unicode arrows, or dingbat fonts.
- Make direction and grouping visible without relying on color alone.
- Keep labels concise and prevent connector crossings where possible.

## Preset Binding

- When the deck or page specifies a `presetId` matching a diagram preset (see [../slide-diagram-presets/schema.json](../slide-diagram-presets/schema.json) and [../slide-diagram-presets/presets/](../slide-diagram-presets/presets/)), the diagram must use that preset's `family`, `layout`, `slots`, and `visualSpec` instead of designing freely. Backend loader: `src/slide-diagram-presets.mjs` (`loadPreset(id)` / `listPresets()` / `inferPresetFromOutline(text)`).
- Preset fields are deterministic constraints, not suggestions:
  - `family` and `layout` are binding; the diagram must implement that layout type. A preset may declare a family not in the original Workflow step 2 list (e.g., `funnel`); implement it as described.
  - `slots` are binding; every slot must be filled, no slot may be skipped, no extra top-level slot may be added.
  - `visualSpec` (stroke width, divider lines, arrowheads, connector style) must follow the preset's values, overridden by the bound slide template's `shape` field when stricter.
  - `accessibilityPattern` must be reflected in the diagram's accessibility summary.
- `inferPresetFromOutline(outlineText)` is a deterministic keyword matcher that the host pipeline may call to auto-suggest a preset; AI may confirm but must not invent a preset id.
- When no preset is bound, keep the existing free-design behavior; the diagram family and layout remain an AI planning choice per Workflow step 2.
