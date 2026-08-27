---
name: create-slide-chart
description: Design accurate presentation charts from quantitative content using ECharts semantics, then express the result as editable slide labels plus a movable SVG chart layer. Use for trends, comparisons, distributions, proportions, matrices, and uncertainty.
---

# Create Slide Chart

## Workflow

1. Identify the exact claim and the fields, units, time range, and comparison basis. Determine whether values are supplied facts or demonstration data.
2. Choose the least complex chart that makes the claim visible.
3. Define an editable `chart` element with categories, series, chart type, colors, units, and accessible description.
4. Let the backend ECharts renderer create its self-contained SVG `src`; keep the page takeaway and source note as separate slide text layers.
5. Verify numerical fidelity and prevent deceptive axes or encodings.

Read [echarts-contract.md](references/echarts-contract.md) for the required model and chart choice rules.

## Output Requirements

- When values are missing, generate plausible, internally consistent demonstration values so the visual remains complete. Set `chart.dataMode` to `simulated` and add a separate visible label: `模拟数据｜仅供演示` or `Simulated data · For demonstration only`.
- Never attribute simulated values to a real company, customer, study, market, or source, and never phrase conclusions as verified outcomes. User-supplied values always take priority.
- Emit element type `chart` rather than flattening charts into generic SVG. Use the schema in the reference contract.
- Use SVG paths, shapes, and lines for visual marks; never use text glyphs as chart decoration.
- Keep the chart readable at presentation distance and avoid unnecessary 3D effects.
- Preserve an accessible text summary of the chart's conclusion.
