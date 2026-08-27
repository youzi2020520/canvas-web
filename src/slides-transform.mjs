import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readState, updateObjects } from "./store.mjs";
import { jobsDirFor } from "./paths.mjs";
import { startCodexSlidesJob, stopCodexProcess } from "./codex-runner.mjs";
import { buildSlideSkillPrompt, slideSkillActions } from "./slides-skill-router.mjs";

const previews = new Map();
const allowedActions = new Set(["businesslike", "shorten-30", "dark-brand"]);

function slidesForDeck(objects, deck) {
  const legacy = new Map((deck.slideIds || []).map((id, index) => [id, index]));
  return objects.filter((item) => item.type === "slide-frame" && (item.slideDeckId === deck.id || legacy.has(item.id)))
    .sort((a, b) => (a.slideOrder ?? legacy.get(a.id) ?? 9999) - (b.slideOrder ?? legacy.get(b.id) ?? 9999));
}

function shortenText(value) {
  const text = String(value || "");
  if (text.length < 24) return text;
  const target = Math.max(12, Math.round(text.length * 0.7));
  const clauses = text.split(/(?<=[。！？；.!?;])|[，,]\s*/).map((item) => item.trim()).filter(Boolean);
  let output = "";
  for (const clause of clauses) {
    if (output && output.length + clause.length > target) break;
    output += clause;
  }
  return (output || text.slice(0, target)).replace(/[，,；;：:]$/, "") + (/[。！？.!?]$/.test(text) ? text.at(-1) : "");
}

function numericFacts(value) {
  return String(value || "").match(/(?:[$¥€£]\s*)?\d[\d,.]*(?:%|万|亿|k|m|b)?/gi) || [];
}

function transformElement(element, actionId) {
  if (element.locked || element.aiLocked) return structuredClone(element);
  const next = structuredClone(element);
  if (actionId === "shorten-30" && element.type === "text") {
    const shortened = shortenText(element.text);
    next.text = numericFacts(element.text).every((fact) => shortened.includes(fact)) ? shortened : element.text;
  }
  if (actionId === "businesslike" && element.type === "text") {
    next.text = String(element.text || "").replace(/\s{2,}/g, " ").replace(/([。！？.!?])\1+/g, "$1").trim();
    next.style = { ...next.style, fontWeight: Number.parseInt(next.style?.fontWeight || "400", 10) >= 600 ? "700" : next.style?.fontWeight || "400" };
  }
  if (actionId === "dark-brand") {
    const accent = "#60a5fa";
    next.style = { ...next.style };
    if (element.type === "text") next.style.color = Number.parseInt(next.style.fontWeight || "400", 10) >= 600 ? "#f8fafc" : "#cbd5e1";
    if (element.type === "shape" && next.style.background && next.style.background !== "transparent") next.style.background = "#1e293b";
    if (element.type === "chart" && next.chart) next.chart.colors = [accent, "#34d399", "#fbbf24", "#f472b6", "#a78bfa"];
  }
  return next;
}

function transformSlide(slide, actionId) {
  return {
    ...structuredClone(slide),
    background: actionId === "dark-brand" ? "#0f172a" : slide.background,
    elements: (slide.elements || []).map((element) => transformElement(element, actionId))
  };
}

function validateStructure(before, after) {
  if (before.length !== after.length) throw new Error("Slide count changed during global transformation.");
  before.forEach((slide, index) => {
    const transformed = after[index];
    if (slide.id !== transformed.id || slide.elements.length !== transformed.elements.length) throw new Error("Slide structure changed during global transformation.");
    slide.elements.forEach((element, elementIndex) => {
      const next = transformed.elements[elementIndex];
      for (const key of ["id", "type", "parentId", "x", "y", "width", "height"]) if (element[key] !== next[key]) throw new Error(`Protected structure changed: ${element.id}.${key}`);
      if ((element.locked || element.aiLocked) && JSON.stringify(element) !== JSON.stringify(next)) throw new Error(`Locked element changed: ${element.id}`);
      if (element.type === "chart" && JSON.stringify(element.chart?.series || []) !== JSON.stringify(next.chart?.series || [])) throw new Error(`Chart data changed: ${element.id}`);
    });
  });
}

function validateTransformScope(before, after, scope = {}) {
  validateStructure(before, after);
  if (!scope.slideId) return;
  before.forEach((slide, slideIndex) => {
    const next = after[slideIndex];
    if (slide.id !== scope.slideId) {
      if (JSON.stringify(slide) !== JSON.stringify(next)) throw new Error(`AI changed protected slide: ${slide.id}`);
      return;
    }
    const { elements:beforeElements, ...beforeSlide } = slide;
    const { elements:afterElements, ...afterSlide } = next;
    if (JSON.stringify(beforeSlide) !== JSON.stringify(afterSlide)) throw new Error(`AI changed protected slide properties: ${slide.id}`);
    slide.elements.forEach((element, elementIndex) => {
      if (element.id !== scope.elementId && JSON.stringify(element) !== JSON.stringify(next.elements[elementIndex])) throw new Error(`AI changed protected element: ${element.id}`);
    });
  });
}

function transformPreviewSummary(before, after) {
  const pageChanges = after.map((slide, index) => {
    const changedTypes = new Set();
    const changedElements = slide.elements.filter((element, elementIndex) => {
      const previous = before[index].elements[elementIndex];
      if (JSON.stringify(element) === JSON.stringify(previous)) return false;
      if (element.text !== previous.text) changedTypes.add("text");
      if (element.src !== previous.src) changedTypes.add("image");
      if (JSON.stringify(element.chart) !== JSON.stringify(previous.chart)) changedTypes.add("chart");
      if (JSON.stringify(element.style) !== JSON.stringify(previous.style)) changedTypes.add("style");
      return true;
    }).length;
    const backgroundChanged = slide.background !== before[index].background;
    if (backgroundChanged) changedTypes.add("background");
    return { pageIndex:index, title:slide.name || slide.title || `Slide ${index + 1}`, changedItems:changedElements + (backgroundChanged ? 1 : 0), backgroundChanged, changedTypes:[...changedTypes], beforeSlide:before[index], afterSlide:slide };
  }).filter((page) => page.changedItems > 0);
  return { changedItems:pageChanges.reduce((count, page) => count + page.changedItems, 0), changedPages:pageChanges.length, pageChanges };
}

async function createAiPreview(projectDir, deckId, instruction, scope, options) {
  const state = await readState(projectDir, options);
  const deck = state.objects.find((item) => item.id === deckId && item.type === "slides");
  if (!deck) throw Object.assign(new Error("Slide deck not found."), { statusCode:404 });
  const before = slidesForDeck(state.objects, deck);
  if (!before.length) throw Object.assign(new Error("The deck has no structured slides."), { statusCode:400 });
  if (scope?.slideId && !before.some((slide) => slide.id === scope.slideId && slide.elements.some((element) => element.id === scope.elementId))) throw Object.assign(new Error("The selected slide element no longer exists."), { statusCode:404 });
  const id = randomUUID();
  const jobDir = path.join(jobsDirFor(projectDir, options.canvasId), `transform_${id}`);
  const outputDir = path.join(jobDir, "outputs");
  await fs.mkdir(outputDir, { recursive:true });
  await fs.writeFile(path.join(outputDir, "source-deck.json"), `${JSON.stringify({ slides:before }, null, 2)}\n`, "utf8");
  const prompt = await buildSlideSkillPrompt({ action:slideSkillActions.TRANSFORM_DECK, payload:[
    "Transform the structured presentation in source-deck.json according to this free-text instruction:",
    instruction,
    scope?.elementId
      ? `STRICT SCOPE: modify only element ${scope.elementId} on slide ${scope.slideId}. Every other slide and element must remain byte-for-byte unchanged.`
      : "SCOPE: the whole deck may be revised within the skill preservation rules.",
    "Write the complete result to transformed-deck.json in the output directory. Use actionId custom. Do not modify repository files or ask questions."
  ].join("\n") });
  const runner = await startCodexSlidesJob({ projectDir, outputDir, logPath:path.join(jobDir, "codex.log"), prompt });
  let timeout;
  try {
    await Promise.race([runner.done, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("AI slide modification timed out after 15 minutes.")), 15 * 60_000); timeout.unref?.(); })]);
  } catch (error) { await stopCodexProcess(runner.child); throw error; }
  finally { clearTimeout(timeout); }
  let result;
  try { result = JSON.parse(await fs.readFile(path.join(outputDir, "transformed-deck.json"), "utf8")); }
  catch { throw Object.assign(new Error("AI modification finished without a valid transformed-deck.json result."), { statusCode:502 }); }
  const after = Array.isArray(result?.slides) ? result.slides : [];
  validateTransformScope(before, after, scope);
  const summary = transformPreviewSummary(before, after);
  previews.set(id, { projectDir, deckId, actionId:"custom", instruction, before, after, options, applied:false, createdAt:Date.now() });
  const targetElement = scope?.elementId ? after.find((slide) => slide.id === scope.slideId)?.elements.find((element) => element.id === scope.elementId) : null;
  return { id, actionId:"custom", slideCount:after.length, ...summary, beforeCharacters:before.flatMap((s) => s.elements).reduce((n,e) => n + String(e.text || "").length,0), afterCharacters:after.flatMap((s) => s.elements).reduce((n,e) => n + String(e.text || "").length,0), targetElement };
}

export async function createDeckTransformPreview(projectDir, deckId, actionId, options = {}, input = {}) {
  const instruction = String(input.instruction || "").trim().slice(0, 4000);
  const scope = input.slideId && input.elementId ? { slideId:String(input.slideId), elementId:String(input.elementId) } : null;
  if (instruction) return createAiPreview(projectDir, deckId, instruction, scope, options);
  if (!allowedActions.has(actionId)) throw Object.assign(new Error("Unsupported deck transformation."), { statusCode: 400 });
  const state = await readState(projectDir, options);
  const deck = state.objects.find((item) => item.id === deckId && item.type === "slides");
  if (!deck) throw Object.assign(new Error("Slide deck not found."), { statusCode: 404 });
  const before = slidesForDeck(state.objects, deck);
  if (!before.length) throw Object.assign(new Error("The deck has no structured slides."), { statusCode: 400 });
  const after = before.map((slide) => transformSlide(slide, actionId));
  validateStructure(before, after);
  const summary = transformPreviewSummary(before, after);
  const id = randomUUID();
  previews.set(id, { projectDir, deckId, actionId, before, after, options, applied: false, createdAt: Date.now() });
  return { id, actionId, slideCount: after.length, ...summary, beforeCharacters: before.flatMap((s) => s.elements).reduce((n, e) => n + String(e.text || "").length, 0), afterCharacters: after.flatMap((s) => s.elements).reduce((n, e) => n + String(e.text || "").length, 0) };
}

export async function applyDeckTransformPreview(projectDir, id, input = {}) {
  const preview = previews.get(id);
  if (!preview || preview.projectDir !== projectDir) throw Object.assign(new Error("Transformation preview expired."), { statusCode: 404 });
  const changedIndexes = preview.after.map((slide, index) => JSON.stringify(slide) !== JSON.stringify(preview.before[index]) ? index : -1).filter((index) => index >= 0);
  const requestedIndexes = Array.isArray(input.pageIndexes) ? [...new Set(input.pageIndexes.map(Number).filter(Number.isInteger))] : changedIndexes;
  const appliedIndexes = requestedIndexes.filter((index) => changedIndexes.includes(index));
  if (!appliedIndexes.length) throw Object.assign(new Error("Select at least one changed slide to apply."), { statusCode:400 });
  await updateObjects(projectDir, appliedIndexes.map((index) => ({ id: preview.after[index].id, patch: { background: preview.after[index].background, elements: preview.after[index].elements } })), preview.options);
  preview.applied = true;
  preview.appliedIndexes = appliedIndexes;
  return { id, applied: true, appliedIndexes };
}

export async function restoreDeckTransformPreview(projectDir, id) {
  const preview = previews.get(id);
  if (!preview || preview.projectDir !== projectDir || !preview.applied) throw Object.assign(new Error("No applied transformation can be restored."), { statusCode: 404 });
  const appliedIndexes = preview.appliedIndexes?.length ? preview.appliedIndexes : preview.before.map((_, index) => index);
  await updateObjects(projectDir, appliedIndexes.map((index) => ({ id: preview.before[index].id, patch: { background: preview.before[index].background, elements: preview.before[index].elements } })), preview.options);
  preview.applied = false;
  return { id, restored: true, restoredIndexes:appliedIndexes };
}
