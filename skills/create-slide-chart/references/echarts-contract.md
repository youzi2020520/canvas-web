# ECharts Contract

Keep an internal ECharts-compatible model:

```json
{"chartType":"bar","claim":"...","option":{"dataset":{"source":[]},"xAxis":{},"yAxis":{},"series":[]},"accessibilitySummary":"..."}
```

Use line for ordered trends, bar for magnitude comparison, dot or lollipop for compact ranking, scatter for correlation, and area only when cumulative volume matters. Use pie only for a small, complete part-to-whole set. Use a matrix or heatmap when two dimensions are equally important.

Axes must state units. Start bar axes at zero unless a non-zero baseline is explicitly justified. Show direct labels when there are few series. Highlight only the evidence supporting the page claim. Keep grid lines quiet and avoid a chart legend when direct labels are clearer.

The slide output contains one movable editable chart element plus separate editable text layers:

```json
{"id":"chart-1","type":"chart","x":120,"y":160,"width":700,"height":320,"text":"Accessible conclusion","src":"","chart":{"type":"bar","title":"","unit":"%","dataMode":"simulated","categories":["A","B"],"series":[{"name":"Value","data":[42,61]}],"colors":["#14b8a6"],"accessibilitySummary":"In the simulated data, B is higher than A"},"style":{},"layout":{"mode":"free"}}
```

The backend renders `src` as self-contained SVG. Do not invent a data URL in the generation step. The chart remains editable through its `chart` model.

Use `dataMode: "supplied"` for user-provided values and `dataMode: "simulated"` for generated demonstration values. A simulated chart must have a separate visible slide text layer that says `模拟数据｜仅供演示` or `Simulated data · For demonstration only`.
