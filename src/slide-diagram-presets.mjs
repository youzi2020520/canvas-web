import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const presetsRoot = fileURLToPath(new URL("../skills/slide-diagram-presets/presets/", import.meta.url));
const presetCache = new Map();
let listingCache = null;

function readPresetFile(id) {
  const filePath = path.join(presetsRoot, `${id}.json`);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function loadPreset(id) {
  if (!id) return null;
  if (presetCache.has(id)) return presetCache.get(id);
  const preset = readPresetFile(id);
  if (preset.id !== id) {
    throw new Error(`Preset file ${id}.json has mismatched id field: ${preset.id}`);
  }
  presetCache.set(id, preset);
  return preset;
}

export function listPresets() {
  if (listingCache) return listingCache;
  const files = fs.readdirSync(presetsRoot).filter((name) => name.endsWith(".json"));
  listingCache = files.map((name) => {
    const preset = JSON.parse(fs.readFileSync(path.join(presetsRoot, name), "utf8"));
    return {
      id: preset.id,
      family: preset.family,
      label: preset.label,
      purpose: preset.purpose,
      layout: preset.layout
    };
  });
  return listingCache;
}

const PRESET_KEYWORDS = {
  "swot-2x2": ["swot", "优势劣势", "优势劣势机会威胁", "四象限分析", "swot分析"],
  "funnel-stages": ["漏斗", "转化漏斗", "funnel", "阶段递减", "转化率漏斗"],
  "pyramid-layers": ["金字塔", "层级递进", "pyramid", "马斯洛", "层次需求"],
  "comparison-2col": ["双列对比", "对照", "versus", "vs ", "对比分析", "比较分析", "对比方案", "对比图", "对比矩阵"],
  "org-tree": ["组织架构", "汇报结构", "org chart", "组织结构", "团队结构"],
  "timeline-roadmap": ["时间轴", "路线图", "timeline", "roadmap", "里程碑", "时间线"],
  "process-flow": ["流程图", "业务流程", "工作流", "流程步骤", "process flow"],
  "fishbone-causal": ["鱼骨图", "鱼骨", "因果分析", "根因分析", "ishikawa"],
  "radar-metrics": ["雷达图", "能力雷达", "雷达", "radar", "能力评估"],
  "value-chain": ["价值链", "波特价值链", "value chain", "价值活动"],
  "kpi-dashboard": ["仪表盘", "kpi", "指标看板", "dashboard", "数据看板"],
  "cycle-loop": ["循环图", "闭环", "pdca", "飞轮", "循环"]
};

export function inferPresetFromOutline(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  for (const [id, keywords] of Object.entries(PRESET_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return id;
    }
  }
  return null;
}
