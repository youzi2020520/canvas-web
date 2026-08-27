import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inferSlideIntent, skillRouteForIntent } from "./slides-layout-engine.mjs";

const skillsRoot = fileURLToPath(new URL("../skills/", import.meta.url));
const skillCache = new Map();

export const slideSkillActions = Object.freeze({
  OPTIMIZE_BRIEF:"optimize-brief",
  TRANSFORM_DECK:"transform-deck",
  PLAN_DECK:"plan-deck",
  COMPOSE_DECK:"compose-deck",
  REVIEW_DECK:"review-deck"
});

async function readSkill(name) {
  if (skillCache.has(name)) return skillCache.get(name);
  const skillPath = path.join(skillsRoot, name, "SKILL.md");
  const content = await fs.readFile(skillPath, "utf8");
  skillCache.set(name, content);
  return content;
}

function outlineText(outline = []) {
  return outline.map((page) => `${page?.type || ""} ${page?.title || ""} ${page?.message || ""} ${page?.visual || ""}`).join("\n").toLowerCase();
}

export function selectSlideSkills(action, outline = []) {
  if (action === slideSkillActions.OPTIMIZE_BRIEF) return ["optimize-slide-brief"];
  if (action === slideSkillActions.TRANSFORM_DECK) return ["transform-slide-deck"];
  const selected = ["compose-professional-slides"];
  if (action === slideSkillActions.REVIEW_DECK) selected.push("review-slide-quality");
  if (action !== slideSkillActions.COMPOSE_DECK) return selected;
  if (!outline.length) {
    selected.push("create-slide-chart", "create-slide-diagram", "generate-slide-visual", "review-slide-quality");
    return selected;
  }
  const text = outlineText(outline);
  const routes = new Set(outline.map((page, index) => skillRouteForIntent(inferSlideIntent(page, index, outline.length))));
  const confirmedRoutes = new Set(outline.map((page) => String(page?.specialistRoute || "").trim()).filter(Boolean));
  if (confirmedRoutes.has("chart") || routes.has("echarts") || routes.has("data-viz") || /\b(data|comparison)\b|图表|数据|趋势|分布|占比|对比|矩阵|散点|柱状|折线|漏斗/.test(text)) selected.push("create-slide-chart");
  if (confirmedRoutes.has("diagram") || routes.has("svg-diagram") || /\b(process|roadmap|solution)\b|流程|架构|关系|路径|时间线|步骤|因果|系统图|示意图/.test(text)) selected.push("create-slide-diagram");
  if (confirmedRoutes.has("visual") || routes.has("art-direction-imagegen") || routes.has("image-crop-focal-point") || /\b(cover|section|case-study)\b|主视觉|照片|图片|插画|场景|人物|产品/.test(text)) selected.push("generate-slide-visual");
  selected.push("review-slide-quality");
  return [...new Set(selected)];
}

export async function buildSlideSkillPrompt({ action, payload, outline = [] }) {
  const skillNames = selectSlideSkills(action, outline);
  const contracts = await Promise.all(skillNames.map(async (name) => `--- ACTIVE SKILL: ${name} ---\n${await readSkill(name)}`));
  return [
    `Backend slide action: ${action}`,
    "Apply the following project-local skills as binding execution contracts. Route page work only to the specialist skills that are active below.",
    ...contracts,
    "--- TASK PAYLOAD ---",
    payload
  ].join("\n\n");
}
