import { readState } from "./store.mjs";
import { collectLayoutIssues } from "./slides-layout-engine.mjs";
import { collectDataAccuracyIssues } from "./slides-jobs.mjs";

function slidesForDeck(objects, deck) {
  const legacy = new Map((deck.slideIds || []).map((id, index) => [id, index]));
  return objects.filter((item) => item.type === "slide-frame" && (item.slideDeckId === deck.id || legacy.has(item.id)))
    .sort((a,b) => (a.slideOrder ?? legacy.get(a.id) ?? 9999) - (b.slideOrder ?? legacy.get(b.id) ?? 9999));
}

function normalized(value) { return String(value || "").trim().replace(/\s+/g, " ").toLowerCase(); }
function mode(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a,b) => b[1] - a[1])[0]?.[0] || "";
}

function visualConsistencyIssues(slides) {
  const issues = [];
  const pageFonts = slides.map((slide) => mode((slide.elements || []).filter((item) => item.type === "text").map((item) => normalized(item.style?.fontFamily))));
  const deckFont = mode(pageFonts);
  const fontOutliers = pageFonts.map((font, index) => font && deckFont && font !== deckFont ? index : -1).filter((index) => index >= 0);
  if (fontOutliers.length) issues.push({ id:"font-family-inconsistency", severity:"warning", pageIndexes:fontOutliers, message:`${fontOutliers.length} page(s) use a different dominant font family from the rest of the deck.` });

  const signatures = slides.map((slide) => {
    const elements = slide.elements || [];
    const dominant = elements.filter((item) => ["image","svg","chart","shape"].includes(item.type)).sort((a,b) => (Number(b.width) || 0) * (Number(b.height) || 0) - (Number(a.width) || 0) * (Number(a.height) || 0))[0];
    const center = dominant ? (Number(dominant.x) || 0) + (Number(dominant.width) || 0) / 2 : 512;
    const zone = center < 410 ? "left" : center > 614 ? "right" : "center";
    return `${zone}:${elements.filter((item) => item.type === "image").length}:${elements.filter((item) => item.type === "chart").length}:${elements.filter((item) => item.type === "svg").length}`;
  });
  for (let index = 2; index < signatures.length; index += 1) {
    if (signatures[index] === signatures[index - 1] && signatures[index] === signatures[index - 2]) issues.push({ id:"repeated-page-composition", severity:"warning", pageIndexes:[index - 2,index - 1,index], message:"Three consecutive pages use nearly the same visual composition; compare them and vary one page if the rhythm feels repetitive." });
  }
  return issues;
}

export async function auditSlidesQuality(projectDir, deckId, options = {}) {
  const state = await readState(projectDir, options);
  const deck = state.objects.find((item) => item.id === deckId && item.type === "slides");
  if (!deck) throw Object.assign(new Error("Slide deck not found."), { statusCode:404 });
  const slides = slidesForDeck(state.objects, deck);
  const sourceRecords = [];
  const pages = slides.map((slide, index) => {
    const issues = [
      ...(slide.generationFailed ? [{ id:"generation-failed", severity:"error", message:slide.generationError || "This page failed during generation." }] : []),
      ...collectLayoutIssues({ elements:slide.elements || [], background:slide.background }),
      ...collectDataAccuracyIssues(slide.elements || [], index)
    ];
    for (const element of slide.elements || []) {
      if (element.type !== "chart") continue;
      const chart = element.chart || {};
      const mode = normalized(chart.dataMode || "supplied");
      const label = String(chart.sourceLabel || "").trim();
      const url = String(chart.sourceUrl || "").trim();
      const asOfDate = String(chart.asOfDate || "").trim();
      if (mode === "supplied" && !label) issues.push({ id:"supplied-source-missing", severity:"error", elementId:element.id, message:"Supplied chart data is missing an identifiable source label." });
      if (mode === "supplied" && !asOfDate) issues.push({ id:"source-date-missing", severity:"warning", elementId:element.id, message:"Supplied chart data is missing an as-of date." });
      if (label || url) sourceRecords.push({ pageIndex:index, elementId:element.id, label, url, asOfDate, labelKey:normalized(label), urlKey:normalized(url) });
    }
    const unique = [...new Map(issues.map((issue) => [`${issue.id}:${issue.elementId || ""}:${issue.message}`, issue])).values()];
    return { index, slideId:slide.id, title:slide.name || `Slide ${index + 1}`, status:unique.some((issue) => issue.severity === "error") ? "error" : unique.length ? "warning" : "passed", issues:unique };
  });
  const deckIssues = [];
  const byLabel = new Map(); const byUrl = new Map();
  for (const record of sourceRecords) {
    if (record.labelKey) byLabel.set(record.labelKey, [...(byLabel.get(record.labelKey) || []), record]);
    if (record.urlKey) byUrl.set(record.urlKey, [...(byUrl.get(record.urlKey) || []), record]);
  }
  for (const records of byLabel.values()) {
    const urls = new Set(records.map((item) => item.urlKey).filter(Boolean));
    const dates = new Set(records.map((item) => normalized(item.asOfDate)).filter(Boolean));
    if (urls.size > 1) deckIssues.push({ id:"source-url-conflict", severity:"error", pageIndexes:[...new Set(records.map((item) => item.pageIndex))], message:`The source “${records[0].label}” uses multiple URLs across the deck.` });
    if (dates.size > 1) deckIssues.push({ id:"source-date-conflict", severity:"warning", pageIndexes:[...new Set(records.map((item) => item.pageIndex))], message:`The source “${records[0].label}” uses inconsistent as-of dates across the deck.` });
  }
  for (const records of byUrl.values()) {
    const labels = new Set(records.map((item) => item.labelKey).filter(Boolean));
    if (labels.size > 1) deckIssues.push({ id:"source-label-conflict", severity:"warning", pageIndexes:[...new Set(records.map((item) => item.pageIndex))], message:`One source URL is described with inconsistent labels across the deck.` });
  }
  deckIssues.push(...visualConsistencyIssues(slides));
  const allIssues = [...pages.flatMap((page) => page.issues), ...deckIssues];
  return { deckId, auditedAt:new Date().toISOString(), pages, deckIssues, summary:{ pages:pages.length, passed:pages.filter((page) => page.status === "passed").length, errors:allIssues.filter((issue) => issue.severity === "error").length, warnings:allIssues.filter((issue) => issue.severity === "warning").length, sources:sourceRecords.length } };
}
