import * as echarts from "echarts";

const chartTypes = new Set(["bar", "line", "scatter", "pie"]);

function cleanText(value, fallback = "", limit = 160) {
  return typeof value === "string" ? (value.trim() || fallback).slice(0, limit) : fallback;
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-1e12, Math.min(1e12, number)) : 0;
}

export function normalizeSlideChart(value = {}) {
  const type = chartTypes.has(value.type) ? value.type : "bar";
  const categories = Array.isArray(value.categories) ? value.categories.slice(0, 50).map((item) => cleanText(String(item), "—", 80)) : [];
  const series = Array.isArray(value.series) ? value.series.slice(0, 8).map((item, index) => ({
    name:cleanText(item?.name, `Series ${index + 1}`, 80),
    data:Array.isArray(item?.data) ? item.data.slice(0, 50).map(cleanNumber) : []
  })) : [];
  const colors = Array.isArray(value.colors) ? value.colors.filter((item) => /^#[0-9a-f]{6}$/i.test(String(item))).slice(0, 8) : [];
  return {
    type,
    title:cleanText(value.title, "", 160),
    unit:cleanText(value.unit, "", 40),
    categories,
    series:series.length ? series : [{ name:"Value", data:categories.map(() => 0) }],
    colors:colors.length ? colors : ["#14b8a6", "#2563eb", "#f59e0b", "#8b5cf6"],
    accessibilitySummary:cleanText(value.accessibilitySummary, "Chart", 500)
  };
}

function chartOption(chart) {
  const common = {
    animation:false,
    color:chart.colors,
    backgroundColor:"transparent",
    aria:{ enabled:true, description:chart.accessibilitySummary },
    textStyle:{ fontFamily:"Inter, system-ui, sans-serif", color:"#334155" },
    tooltip:{ show:false }
  };
  if (chart.type === "pie") {
    return { ...common, series:[{ type:"pie", radius:["42%", "72%"], center:["50%", "52%"], label:{ color:"#334155", fontSize:12 }, data:chart.categories.map((name, index) => ({ name, value:chart.series[0]?.data[index] || 0 })) }] };
  }
  const scatter = chart.type === "scatter";
  return {
    ...common,
    grid:{ left:48, right:20, top:chart.title ? 42 : 22, bottom:42, containLabel:true },
    title:chart.title ? { text:chart.title, left:8, top:4, textStyle:{ color:"#0f172a", fontSize:15, fontWeight:650 } } : undefined,
    xAxis:scatter
      ? { type:"value", splitLine:{ lineStyle:{ color:"#e2e8f0" } }, axisLabel:{ color:"#64748b" } }
      : { type:"category", data:chart.categories, axisTick:{ show:false }, axisLine:{ lineStyle:{ color:"#cbd5e1" } }, axisLabel:{ color:"#64748b", interval:0 } },
    yAxis:{ type:"value", name:chart.unit, nameTextStyle:{ color:"#64748b" }, splitLine:{ lineStyle:{ color:"#e2e8f0" } }, axisLabel:{ color:"#64748b" } },
    series:chart.series.map((series, index) => ({
      name:series.name,
      type:chart.type,
      data:scatter ? series.data.map((value, point) => [point, value]) : series.data,
      symbolSize:scatter ? 11 : undefined,
      smooth:chart.type === "line",
      lineStyle:chart.type === "line" ? { width:3 } : undefined,
      itemStyle:chart.type === "bar" ? { borderRadius:[5, 5, 0, 0] } : undefined,
      barMaxWidth:42,
      emphasis:{ disabled:true },
      z:3 + index
    }))
  };
}

export function renderSlideChart(value, { width = 640, height = 360 } = {}) {
  const chart = normalizeSlideChart(value);
  const safeWidth = Math.max(160, Math.min(1600, Math.round(Number(width) || 640)));
  const safeHeight = Math.max(100, Math.min(1000, Math.round(Number(height) || 360)));
  const instance = echarts.init(null, null, { renderer:"svg", ssr:true, width:safeWidth, height:safeHeight });
  try {
    instance.setOption(chartOption(chart));
    const svg = instance.renderToSVGString().replace(/<script[\s\S]*?<\/script>/gi, "");
    return { chart, src:`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` };
  } finally {
    instance.dispose();
  }
}
