import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { assetsDirFor, jobsDirFor } from "./paths.mjs";
import { startCodexImageJob, startCodexSlidesJob, stopCodexProcess } from "./codex-runner.mjs";
import { addObject, deleteObjects, readState, updateObjects } from "./store.mjs";
import { createOperationLease } from "./operation-leases.mjs";
import { buildSlideSkillPrompt, slideSkillActions } from "./slides-skill-router.mjs";
import { renderSlideChart } from "./slide-charts.mjs";
import { inspectPptxReference } from "./pptx-reference.mjs";
import { applyDeterministicLayout, inferSlideIntent, normalizeFrameHierarchyCoordinates, flattenFrameElementsForEditing, collectLayoutIssues, validatePostLayout, validatePreLayout } from "./slides-layout-engine.mjs";
import { mapBriefToTemplate } from "./slide-template-mapper.mjs";
import { loadTemplate, isFreeformTemplate } from "./slide-templates.mjs";
import { inferPresetFromOutline, loadPreset } from "./slide-diagram-presets.mjs";

const jobs = new Map();
const slidesJobPersistence = new Map();
const slidesJobStateFilename = "job-state.json";
const maxSlides = 20;
const maxHtmlBytes = 500_000;
const visualGenerationConcurrency = 2;
function slidesJobTimeout(job, revision = false) {
  const minutes = job.action === "optimize-brief"
    ? 8
    : job.action === "plan-slides"
    ? 12
    : revision
      ? Math.min(30, Math.max(10, 4 + job.pageCount * 2))
      : Math.min(45, Math.max(15, 8 + job.pageCount * 3));
  return { minutes, ms:minutes * 60_000 };
}

function qualityRevisionTimeout(job, failedIndex) {
  const minutes = failedIndex == null
    ? Math.min(8, Math.max(5, 3 + Math.ceil(job.pageCount / 4)))
    : Math.min(5, Math.max(3, 2 + Math.ceil(job.pageCount / 8)));
  return { minutes, ms:minutes * 60_000 };
}

function visualAssetBudget(pageCount) {
  if (pageCount <= 5) return { min:2, max:3 };
  if (pageCount <= 10) return { min:3, max:5 };
  return { min:5, max:8 };
}

function batchVisualAssetBudget(pageCount, batchIndex, batchTotal) {
  const totalBudget = visualAssetBudget(pageCount);
  const distribute = (value) => Math.floor(value / batchTotal) + (batchIndex < value % batchTotal ? 1 : 0);
  return { min:distribute(totalBudget.min), max:distribute(totalBudget.max) };
}

function normalizeCanvasId(value) {
  const canvasId = typeof value === "string" ? value.trim() : "";
  return canvasId || null;
}

function matches(job, options = {}) {
  if (options.projectDir && path.resolve(options.projectDir) !== path.resolve(job.projectDir)) return false;
  return normalizeCanvasId(options.canvasId) === normalizeCanvasId(job.canvasId);
}

function publicJob(job) {
  const progress = computeSlidesProgress(job);
  return {
    id: job.id,
    action: job.action,
    status: job.status,
    progressPercent: progress.percent,
    etaSeconds: progress.etaSeconds,
    visualIndex: job.visualIndex || 0,
    visualTotal: job.visualTotal || 0,
    batchIndex: job.batchIndex || 0,
    batchTotal: job.batchTotal || 0,
    stage: job.stage,
    deckId: job.deckId,
    pageCount: job.pageCount,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    durationMs: job.durationMs,
    elapsedSeconds: Math.round(activeSlidesElapsedMs(job) / 1000),
    accumulatedPausedMs: Math.max(0, Number(job.accumulatedPausedMs) || 0),
    imported: job.imported,
    previewSlides: job.previewSlides,
    pages: job.pages,
    qualityRepair: job.qualityRepair || null,
    qualityWarnings: job.qualityWarnings || [],
    failedStage: job.failedStage || null,
    failureKind: job.failureKind || null,
    targetSlideId: job.targetSlideId,
    brief: job.brief,
    deckTemplateId: job.deckTemplateId || "freeform",
    dataMode:job.dataMode || "ai-generated",
    templateConfidence: Number(job.templateConfidence) || 0,
    templateRecommendations: Array.isArray(job.templateRecommendations) ? job.templateRecommendations.slice(0, 3) : [],
    qualityReport: job.qualityReport || null,
    outline: job.outline,
    error: job.error
  };
}

function slidesJobStatePath(job) {
  return path.join(path.dirname(job.logPath), slidesJobStateFilename);
}

async function persistSlidesJob(job, options = {}) {
  const statePath = slidesJobStatePath(job);
  const previous = slidesJobPersistence.get(statePath);
  const throttleMs = Math.max(0, Number(options.throttleMs) || 0);
  if (throttleMs && previous?.writtenAt && Date.now() - previous.writtenAt < throttleMs) return false;
  const temporaryPath = `${statePath}.tmp`;
  const snapshot = Object.fromEntries(Object.entries(job).filter(([key]) => !["currentChild", "activeChildren", "resumeWaiter"].includes(key)));
  const serialized = `${JSON.stringify(snapshot)}\n`;
  if (previous?.serialized === serialized) return false;
  try {
    await fs.writeFile(temporaryPath, serialized, "utf8");
    await fs.rename(temporaryPath, statePath);
    slidesJobPersistence.set(statePath, { serialized, writtenAt:Date.now() });
    return true;
  } catch {
    await fs.unlink(temporaryPath).catch(() => {});
    return false;
  }
}

async function restoreSlidesJob(projectDir, id, options = {}) {
  const statePath = path.join(jobsDirFor(projectDir, normalizeCanvasId(options.canvasId)), id, slidesJobStateFilename);
  let snapshot;
  try { snapshot = JSON.parse(await fs.readFile(statePath, "utf8")); }
  catch { return null; }
  if (!snapshot || snapshot.id !== id) return null;
  const job = { ...snapshot, projectDir, canvasId:normalizeCanvasId(options.canvasId), currentChild:null, activeChildren:new Set(), resumeWaiter:null, pauseRequested:false, cancelRequested:false };
  if (["queued", "running", "pausing", "paused"].includes(job.status)) {
    job.status = "interrupted";
    job.error = "Canvas restarted while this generation was running. Completed outputs are preserved and can be resumed.";
    await persistSlidesJob(job);
  }
  jobs.set(id, job);
  return job;
}

export async function createSlidesJob(projectDir, input, options = {}) {
  const action = input.action === "optimize-brief"
    ? "optimize-brief"
    : input.action === "plan-slides"
      ? "plan-slides"
      : "generate-slides";
  const deckId = String(input.deckId || "").trim();
  const prompt = String(input.prompt || "").trim().slice(0, 6000);
  const suppliedPageCount = Number(input.pageCount);
  const hasSuppliedPageCount = Number.isFinite(suppliedPageCount) && suppliedPageCount >= 1;
  const pageCount = action === "optimize-brief" && !hasSuppliedPageCount
    ? null
    : Math.max(1, Math.min(maxSlides, Math.round(suppliedPageCount || 5)));
  const requestedOutline = action === "optimize-brief" ? null : normalizeOutline(input.outline, pageCount);
  const visualDirection = normalizeVisualDirection(input.visualDirection);
  const targetSlideId = typeof input.targetSlideId === "string" ? input.targetSlideId.trim().slice(0, 200) : null;
  const requestedDeckTemplateId = String(input.deckTemplateId || "").trim().slice(0, 160);
  if (requestedDeckTemplateId && !isFreeformTemplate(requestedDeckTemplateId)) loadTemplate(requestedDeckTemplateId);
  const dataMode = ["ai-generated", "supplied", "simulated", "placeholder"].includes(String(input.dataMode || "").toLowerCase()) ? String(input.dataMode).toLowerCase() : "ai-generated";
  if (!deckId || !prompt) {
    const error = new Error("AI slide generation requires a deck and a presentation description.");
    error.statusCode = 400;
    throw error;
  }
  const canvasId = normalizeCanvasId(options.canvasId);
  const state = await readState(projectDir, { canvasId });
  const deck = state.objects.find((object) => object.id === deckId && object.type === "slides");
  if (!deck) {
    const error = new Error(`Slide deck not found: ${deckId}`);
    error.statusCode = 404;
    throw error;
  }

  const id = `slides_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const jobDir = path.join(jobsDirFor(projectDir, canvasId), id);
  const outputDir = path.join(jobDir, "outputs");
  const logPath = path.join(jobDir, "codex.log");
  await fs.mkdir(outputDir, { recursive: true });
  const referenceBundle = await writeReferences(jobDir, input.references);
  const referencePaths = referenceBundle.imagePaths;
  const job = {
    id, action, projectDir, canvasId, deckId, prompt, pageCount: requestedOutline?.length || pageCount || 0,
    targetSlideId, visualDirection, deckTemplateId:requestedDeckTemplateId || "freeform", dataMode,
    requestedOutline, outputDir, logPath, referencePaths, presentationReference:referenceBundle.presentationContext,
    status: "queued", stage: "planning", createdAt: new Date().toISOString(), startedAt: null,
    completedAt: null, durationMs: null, imported: [], previewSlides:[], brief: null, outline: null, error: null, currentChild: null, activeChildren:new Set(), cancelRequested: false, pauseRequested: false, pauseStartedAt:null, accumulatedPausedMs:0, resumeStage:null, resumeWaiter:null, generatedAssets: [],
    pages: Array.from({ length: requestedOutline?.length || pageCount || 0 }, (_, index) => ({
      index, status:"waiting", intent:inferSlideIntent(requestedOutline?.[index] || {}, index, requestedOutline?.length || pageCount || 0)
    }))
  };
  jobs.set(id, job);
  await persistSlidesJob(job);
  const lease = await createOperationLease("slides-job", { action, projectDir, canvasId });
  runSlidesJob(job)
    .catch((error) => failJob(job, error))
    .finally(async () => { job.currentChild = null; await lease.release(); });
  return publicJob(job);
}

export async function getSlidesJob(id, options = {}) {
  const job = jobs.get(id) || (options.projectDir ? await restoreSlidesJob(options.projectDir, id, options) : null);
  if (!job || !matches(job, options)) {
    const error = new Error(`Slides job not found: ${id}`);
    error.statusCode = 404;
    throw error;
  }
  return publicJob(job);
}

export async function retrySlidesJob(projectDir, id, options = {}) {
  const job = jobs.get(id) || await restoreSlidesJob(projectDir, id, options);
  if (!job || !matches(job, { ...options, projectDir })) {
    const error = new Error(`Slides job not found: ${id}`); error.statusCode = 404; throw error;
  }
  if (!["interrupted", "failed", "quality_failed"].includes(job.status)) {
    const error = new Error("Only an interrupted or failed slides job can be retried."); error.statusCode = 409; throw error;
  }
  const retryFromQuality = job.status === "quality_failed";
  job.status = "queued"; job.error = null; job.completedAt = null; job.durationMs = null;
  job.pauseStartedAt = null; job.accumulatedPausedMs = 0;
  job.retryFromQuality = retryFromQuality;
  job.pages = job.pages.map((page, index) => ({
    ...page,
    status:retryFromQuality && job.previewSlides?.[index] ? "ready" : ["ready", "done"].includes(page.status) ? page.status : "waiting",
    reviewStatus:retryFromQuality && page.error ? "repairing" : page.reviewStatus,
    error:null
  }));
  await persistSlidesJob(job);
  const lease = await createOperationLease("slides-job", { action:job.action, projectDir, canvasId:job.canvasId });
  runSlidesJob(job).catch((error) => failJob(job, error)).finally(async () => { job.currentChild = null; await lease.release(); });
  return publicJob(job);
}

export async function continueSlidesWithoutVisuals(projectDir, id, options = {}) {
  const job = jobs.get(id) || await restoreSlidesJob(projectDir, id, options);
  if (!job || !matches(job, { ...options, projectDir })) {
    const error = new Error(`Slides job not found: ${id}`); error.statusCode = 404; throw error;
  }
  if (!['failed', 'quality_failed'].includes(job.status) || job.failedStage !== 'illustrating' || !job.previewSlides?.some(Boolean)) {
    const error = new Error('Only a visual-asset failure with preserved slide drafts can continue without images.'); error.statusCode = 409; throw error;
  }
  job.status = 'running';
  job.stage = 'illustrating';
  job.error = null;
  job.completedAt = null;
  job.durationMs = null;
  job.pages = job.pages.map((page, index) => ({
    ...page,
    status:job.previewSlides[index]?.generationFailed ? 'failed' : 'ready',
    reviewStatus:job.previewSlides[index]?.generationFailed ? page.reviewStatus : 'reviewed',
    error:job.previewSlides[index]?.generationFailed ? page.error : null
  }));
  await appendSlidesJobLog(job, 'Stage: illustrating | user continued without unavailable bitmap visuals; preserving all slide drafts');
  await persistSlidesJob(job);
  const lease = await createOperationLease('slides-job', { action:job.action, projectDir, canvasId:job.canvasId });
  finishSlidesWithoutVisuals(job).catch((error) => failJob(job, error)).finally(async () => { job.currentChild = null; await lease.release(); });
  return publicJob(job);
}

export async function cancelSlidesJob(projectDir, id, options = {}) {
  const job = jobs.get(id);
  if (!job || !matches(job, { ...options, projectDir })) {
    const error = new Error(`Slides job not found: ${id}`);
    error.statusCode = 404;
    throw error;
  }
  if (!["queued", "running", "paused", "pausing"].includes(job.status)) {
    const error = new Error("Slides job is no longer running.");
    error.statusCode = 409;
    throw error;
  }
  job.cancelRequested = true;
  job.status = "cancelled";
  job.stage = "cancelled";
  job.completedAt = new Date().toISOString();
  job.durationMs = activeSlidesElapsedMs(job);
  job.resumeWaiter?.(); job.resumeWaiter = null;
  const children = job.activeChildren?.size ? [...job.activeChildren] : [job.currentChild].filter(Boolean);
  await Promise.allSettled(children.map((child) => stopCodexProcess(child)));
  await persistSlidesJob(job);
  return publicJob(job);
}

export async function pauseSlidesJob(projectDir, id, options = {}) {
  const job = jobs.get(id);
  if (!job || !matches(job, { ...options, projectDir })) {
    const error = new Error(`Slides job not found: ${id}`); error.statusCode = 404; throw error;
  }
  if (job.status !== "running") {
    const error = new Error("Only a running slides job can be paused."); error.statusCode = 409; throw error;
  }
  job.pauseRequested = true;
  job.pauseStartedAt ||= new Date().toISOString();
  job.resumeStage = job.stage;
  job.status = "pausing";
  await persistSlidesJob(job);
  return publicJob(job);
}

export async function resumeSlidesJob(projectDir, id, options = {}) {
  const job = jobs.get(id);
  if (!job || !matches(job, { ...options, projectDir })) {
    const error = new Error(`Slides job not found: ${id}`); error.statusCode = 404; throw error;
  }
  if (!["paused", "pausing"].includes(job.status)) {
    const error = new Error("Slides job is not paused."); error.statusCode = 409; throw error;
  }
  job.pauseRequested = false;
  if (job.pauseStartedAt) {
    job.accumulatedPausedMs = Math.max(0, Number(job.accumulatedPausedMs) || 0) + Math.max(0, Date.now() - Date.parse(job.pauseStartedAt));
    job.pauseStartedAt = null;
  }
  job.status = "running";
  job.stage = job.resumeStage || "generating";
  job.resumeWaiter?.(); job.resumeWaiter = null;
  await persistSlidesJob(job);
  return publicJob(job);
}

export async function skipSlidesQualityCheck(projectDir, id, options = {}) {
  const job = jobs.get(id);
  if (!job || !matches(job, { ...options, projectDir })) {
    const error = new Error(`Slides job not found: ${id}`); error.statusCode = 404; throw error;
  }
  if (job.status !== "running" || job.stage !== "revising" || job.qualityRepair?.scope !== "page") {
    const error = new Error("Only an attributed page-quality repair can be skipped; structural and deck manifest errors must still be resolved."); error.statusCode = 409; throw error;
  }
  job.skipQualityRequested = true;
  job.qualitySkipRequestedAt = new Date().toISOString();
  await appendSlidesJobLog(job, "Quality check skip requested by user; preserving current drafts and continuing to the next stage.");
  if (job.stage === "revising" && job.currentChild) await stopCodexProcess(job.currentChild);
  await persistSlidesJob(job);
  return publicJob(job);
}

async function waitWhilePaused(job, nextStage) {
  if (!job.pauseRequested || job.cancelRequested) return;
  job.resumeStage = nextStage || job.resumeStage || job.stage;
  job.status = "paused";
  job.stage = "paused";
  await new Promise((resolve) => { job.resumeWaiter = resolve; });
  if (job.cancelRequested) return;
  job.status = "running";
  job.stage = job.resumeStage;
}

export function slideGenerationBatches(pageCount) {
  const total = Math.max(1, Math.min(maxSlides, Math.round(Number(pageCount) || 1)));
  return Array.from({ length:total }, (_, index) => [index]);
}

async function writeSlidePlan(job, batches) {
  const plan = {
    schemaVersion:1,
    pageCount:job.pageCount,
    briefSummary:job.prompt.slice(0, 1800),
    designSystem:job.visualDirection?.designSystem || null,
    visualRhythm:job.visualDirection?.visualRhythm || [],
    slides:(job.requestedOutline || []).map((slide, index) => ({ pageNumber:index + 1, ...slide })),
    batches:batches.map((indexes, index) => ({ batchNumber:index + 1, pages:indexes.map((pageIndex) => pageIndex + 1) }))
  };
  await fs.writeFile(path.join(job.outputDir, "slide-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
}

async function refreshGeneratedSlidePreviews(job, files = null) {
  files = files || await fs.readdir(job.outputDir);
  const ready = new Set(files.filter((name) => /^slide-\d{2}\.json$/i.test(name)).map((name) => Number(name.slice(6, 8)) - 1));
  job.pages = job.pages.map((page) => page.status === "failed"
    ? page
    : ({ ...page, status:ready.has(page.index) ? "ready" : page.status === "ready" ? "ready" : "waiting" }));
  for (const index of ready) {
    if (job.previewSlides[index]) continue;
    const filename = `slide-${String(index + 1).padStart(2, "0")}.json`;
    try {
      let frame = JSON.parse(await fs.readFile(path.join(job.outputDir, filename), "utf8"));
      if (!Array.isArray(frame.elements) || !frame.elements.length) continue;
      frame = flattenFrameElementsForEditing(normalizeFrameHierarchyCoordinates(applyDeterministicLayout(frame, { index, count:job.pageCount, preserveCoordinates:Boolean(job.presentationReference) })));
      job.pages[index] = { ...job.pages[index], status:frame.generationFailed ? "failed" : "ready", intent:frame.intent, archetype:frame.archetype, skillRoute:frame.skillRoute };
      const previewElements = frame.elements.map((element) => element?.type === "chart"
        ? { ...element, ...renderSlideChart(element.chart, { width:element.width, height:element.height }) }
        : element);
      job.previewSlides[index] = {
        type:"slide-frame", title:String(frame.title || job.requestedOutline?.[index]?.title || `幻灯片 ${index + 1}`).trim().slice(0, 100),
        role:job.requestedOutline?.[index]?.role || frame.role || "content", chapterId:job.requestedOutline?.[index]?.chapterId || frame.chapterId || null,
        layoutFamily:job.requestedOutline?.[index]?.layoutFamily || frame.layoutFamily || "title-content", intent:frame.intent, archetype:frame.archetype,
        skillRoute:frame.skillRoute, layoutSpec:frame.layoutSpec, coordinateSpace:frame.coordinateSpace,
        templateId:String(frame.templateId || "freeform").trim().slice(0, 120), background:String(frame.background || "#ffffff").trim().slice(0, 300), elements:previewElements,
        generationFailed:Boolean(frame.generationFailed), generationError:String(frame.generationError || "").slice(0, 1000)
      };
    } catch {}
  }
  return ready;
}

async function runSlidesBatch(job, batch, batchIndex, batchTotal, repairAttempt = 0) {
  job.batchIndex = batchIndex + 1;
  job.batchTotal = batchTotal;
  job.stage = "generating";
  job.pages = job.pages.map((page) => ({ ...page, status:batch.includes(page.index) && page.status !== "ready" ? "generating" : page.status }));
  await logSlidesProgress(job, `Stage: generating | page ${batch[0] + 1}/${batchTotal}${repairAttempt ? ` | repair attempt ${repairAttempt}/2` : ""}`);
  const prompt = await buildSlideSkillPrompt({
    action:slideSkillActions.COMPOSE_DECK,
    payload:slidesPrompt(job, { indexes:batch, batchIndex, batchTotal }),
    outline:job.requestedOutline || []
  });
  const runner = await startCodexSlidesJob({
    projectDir:job.projectDir, outputDir:job.outputDir,
    logPath:path.join(path.dirname(job.logPath), `codex-batch-${String(batchIndex + 1).padStart(2, "0")}${repairAttempt ? `-repair-${repairAttempt}` : ""}.log`),
    imagePaths:job.referencePaths, prompt
  });
  job.currentChild = runner.child;
  const required = new Set(batch.map((index) => `slide-${String(index + 1).padStart(2, "0")}.json`));
  required.add(`visual-assets-batch-${String(batchIndex + 1).padStart(2, "0")}.json`);
  let stableTicks = 0;
  let lastVisibleCount = -1;
  let tickRunning = false;
  let resolveReady;
  const filesReady = new Promise((resolve) => { resolveReady = resolve; });
  const timer = setInterval(async () => {
    if (tickRunning) return;
    tickRunning = true;
    try {
      const filenames = await fs.readdir(job.outputDir);
      const ready = await refreshGeneratedSlidePreviews(job, filenames);
      await persistSlidesJob(job, { throttleMs:2100 });
      const files = new Set(filenames);
      if ([...required].every((filename) => files.has(filename))) stableTicks += 1;
      else stableTicks = 0;
      if (stableTicks >= 3) resolveReady("files");
      if (ready.size !== lastVisibleCount) {
        lastVisibleCount = ready.size;
        await appendSlidesJobLog(job, `Batch ${job.batchIndex}/${batchTotal}: ${ready.size}/${job.pageCount} drafts visible`);
      }
    } catch {} finally {
      tickRunning = false;
    }
  }, 700);
  timer.unref?.();
  let timeout;
  const timeoutSpec = slidesJobTimeout(job);
  try {
    const completedBy = await Promise.race([
      runner.done.then(() => "runner"), filesReady,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`AI slide batch ${batchIndex + 1} timed out after ${timeoutSpec.minutes} minutes.`)), timeoutSpec.ms); timeout.unref?.(); })
    ]);
    if (completedBy === "files") await stopCodexProcess(runner.child);
  } catch (error) {
    await stopCodexProcess(runner.child);
    throw error;
  } finally {
    clearTimeout(timeout);
    clearInterval(timer);
  }
  const files = new Set(await fs.readdir(job.outputDir));
  const missing = [...required].filter((filename) => !files.has(filename));
  if (missing.length) throw new Error(`AI slide batch ${batchIndex + 1} finished without required files: ${missing.join(", ")}`);
  await refreshGeneratedSlidePreviews(job);
  await logSlidesProgress(job, `Stage: generating | batch ${job.batchIndex}/${batchTotal} complete | ${job.pages.filter((page) => page.status === "ready").length}/${job.pageCount} slides ready`);
}

async function writeFailedSlidePlaceholder(job, pageIndex, batchIndex, error, repairAttempts) {
  const title = String(job.requestedOutline?.[pageIndex]?.title || `幻灯片 ${pageIndex + 1}`).trim().slice(0, 100);
  const message = String(error?.message || error || "Unknown generation error").slice(0, 1000);
  const frame = {
    title, role:job.requestedOutline?.[pageIndex]?.role || "content", templateId:"generation-failed",
    background:"#fff7f7", generationFailed:true, generationError:message,
    elements:[
      { id:"failure-panel", type:"shape", x:64, y:72, width:896, height:432, layoutLocked:true, style:{ background:"#ffffff", border:"2px solid #ef4444", borderRadius:24 } },
      { id:"failure-title", type:"text", x:112, y:128, width:800, height:64, layoutLocked:true, text:title, style:{ fontSize:36, fontWeight:700, lineHeight:1.2, color:"#991b1b" } },
      { id:"failure-label", type:"text", x:112, y:224, width:800, height:44, layoutLocked:true, text:"此页面生成失败，已跳过并继续生成后续页面", style:{ fontSize:24, fontWeight:600, lineHeight:1.3, color:"#b91c1c" } },
      { id:"failure-detail", type:"text", x:112, y:300, width:800, height:100, layoutLocked:true, text:`已自动修复 ${repairAttempts} 次。完成后可从页面菜单手动删除本页。`, style:{ fontSize:18, lineHeight:1.45, color:"#6b7280" } }
    ]
  };
  await fs.writeFile(path.join(job.outputDir, `slide-${String(pageIndex + 1).padStart(2, "0")}.json`), `${JSON.stringify(frame, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(job.outputDir, `visual-assets-batch-${String(batchIndex + 1).padStart(2, "0")}.json`), `${JSON.stringify({ assets:[] }, null, 2)}\n`, "utf8");
  job.pages[pageIndex] = { ...job.pages[pageIndex], status:"failed", reviewStatus:"failed", repairAttempts, error:message };
  await refreshGeneratedSlidePreviews(job);
  await persistSlidesJob(job);
}

async function assembleBatchedSlideOutputs(job) {
  const assets = [];
  let artDirection = null;
  for (let index = 0; index < job.batchTotal; index += 1) {
    const filePath = path.join(job.outputDir, `visual-assets-batch-${String(index + 1).padStart(2, "0")}.json`);
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (!artDirection && parsed.artDirection) artDirection = parsed.artDirection;
    if (Array.isArray(parsed.assets)) assets.push(...parsed.assets);
  }
  const uniqueAssets = [...new Map(assets.map((asset) => [String(asset?.token || ""), asset])).values()].filter((asset) => asset?.token);
  await fs.writeFile(path.join(job.outputDir, "visual-assets.json"), `${JSON.stringify({ artDirection, assets:uniqueAssets }, null, 2)}\n`, "utf8");
  const slides = job.pages.map((page, index) => ({ file:`slide-${String(index + 1).padStart(2, "0")}.json`, title:job.requestedOutline?.[index]?.title || job.previewSlides[index]?.title || `幻灯片 ${index + 1}` }));
  await fs.writeFile(path.join(job.outputDir, "manifest.json"), `${JSON.stringify({ slides }, null, 2)}\n`, "utf8");
}

async function runBatchedSlideGeneration(job) {
  const batches = slideGenerationBatches(job.pageCount);
  job.batchIndex = 0;
  job.batchTotal = batches.length;
  await writeSlidePlan(job, batches);
  await refreshGeneratedSlidePreviews(job);
  for (const [batchIndex, batch] of batches.entries()) {
    if (job.cancelRequested) return;
    await waitWhilePaused(job, "generating");
    if (job.cancelRequested) return;
    const alreadyReady = batch.every((index) => job.pages[index]?.status === "ready" && job.previewSlides[index]);
    if (alreadyReady) continue;
    let lastError = null;
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      try {
        if (attempt) {
          const pageIndex = batch[0];
          job.pages[pageIndex] = { ...job.pages[pageIndex], status:"generating", reviewStatus:"repairing", repairAttempts:attempt, error:null };
          await fs.unlink(path.join(job.outputDir, `slide-${String(pageIndex + 1).padStart(2, "0")}.json`)).catch(() => {});
          await fs.unlink(path.join(job.outputDir, `visual-assets-batch-${String(batchIndex + 1).padStart(2, "0")}.json`)).catch(() => {});
        }
        await runSlidesBatch(job, batch, batchIndex, batches.length, attempt);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        await logSlidesProgress(job, `Stage: generating | page ${batch[0] + 1}/${batches.length} failed${attempt < 2 ? "; scheduling repair" : "; recorded and continuing"} | ${String(error?.message || error).slice(0, 500)}`);
      }
    }
    if (lastError) await writeFailedSlidePlaceholder(job, batch[0], batchIndex, lastError, 2);
  }
  await assembleBatchedSlideOutputs(job);
}

export function buildQualityReport(slides) {
  const layoutIssues = [];
  const dataIssues = [];
  const frames = Array.isArray(slides) ? slides.filter((slide) => slide?.type === "slide-frame" && !slide.generationFailed) : [];
  for (const slide of frames) {
    const index = slides.indexOf(slide);
    const frame = { elements: slide.elements || [], background: slide.background };
    layoutIssues.push(...collectLayoutIssues(frame));
    dataIssues.push(...collectDataAccuracyIssues(slide.elements || [], index));
  }
  const all = [...layoutIssues, ...dataIssues];
  return {
    layoutIssues,
    dataIssues,
    summary: {
      pages: frames.length,
      errors: all.filter((issue) => issue.severity === "error").length,
      warnings: all.filter((issue) => issue.severity === "warning").length
    }
  };
}

async function runSlidesJob(job) {
  job.status = "running";
  job.stage = "planning";
  job.startedAt = new Date().toISOString();
  await appendSlidesJobLog(job, `AI slides job started: ${job.action} (${job.pageCount} slides)`);
  if (job.action === "optimize-brief") {
    await runBriefOptimization(job);
    return;
  }
  resolveDeckTemplate(job);
  await logSlidesProgress(job, `Stage: planning (${job.action}) | template → ${job.deckTemplateId} (${Math.round((job.templateConfidence || 0) * 100)}%)`);
  if (job.action === "generate-slides") {
    await runBatchedSlideGeneration(job);
    job.retryFromQuality = false;
    if (job.cancelRequested) return;
  } else {
  const action = job.action === "plan-slides" ? slideSkillActions.PLAN_DECK : slideSkillActions.COMPOSE_DECK;
  const prompt = await buildSlideSkillPrompt({
    action,
    payload:job.action === "plan-slides" ? outlinePrompt(job) : slidesPrompt(job),
    outline:job.requestedOutline || []
  });
  const runner = await startCodexSlidesJob({
    projectDir: job.projectDir,
    outputDir: job.outputDir,
    logPath: job.logPath,
    imagePaths: job.referencePaths,
    prompt
  });
  job.currentChild = runner.child;
  job.stage = "generating";
  await logSlidesProgress(job, "Stage: generating | Codex child running");
  let resolveOutputReady;
  let stableOutputTicks = 0;
  let lastLoggedReadyCount = -1;
  const outputReady = new Promise((resolve) => { resolveOutputReady = resolve; });
  const progressTimer = setInterval(async () => {
    try {
      const files = await fs.readdir(job.outputDir);
      const ready = new Set(files.filter((name) => /^slide-\d{2}\.(?:json|html)$/i.test(name)).map((name) => Number(name.slice(6, 8)) - 1));
      if (ready.size !== lastLoggedReadyCount) {
        lastLoggedReadyCount = ready.size;
        await logSlidesProgress(job, `Stage: generating | ${ready.size}/${job.pageCount} slides ready`);
      }
      job.pages = job.pages.map((page) => ({ ...page, status:ready.has(page.index) ? "ready" : page.status === "ready" ? "ready" : "generating" }));
      if (job.action === "generate-slides" && ready.size === job.pageCount && files.includes("manifest.json") && files.includes("visual-assets.json")) {
        stableOutputTicks += 1;
        if (stableOutputTicks >= 3) resolveOutputReady("files");
      } else stableOutputTicks = 0;
      for (const index of ready) {
        if (job.previewSlides[index]) continue;
        const filename = files.find((name) => new RegExp(`^slide-${String(index + 1).padStart(2, "0")}\\.json$`, "i").test(name));
        if (!filename) continue;
        try {
          let frame = JSON.parse(await fs.readFile(path.join(job.outputDir, filename), "utf8"));
          if (!Array.isArray(frame.elements) || !frame.elements.length) continue;
          frame = flattenFrameElementsForEditing(normalizeFrameHierarchyCoordinates(applyDeterministicLayout(frame, { index, count:job.pageCount, preserveCoordinates:Boolean(job.presentationReference) })));
          job.pages[index] = { ...job.pages[index], intent:frame.intent, archetype:frame.archetype, skillRoute:frame.skillRoute };
          const previewElements = frame.elements.map((element) => element?.type === "chart"
            ? { ...element, ...renderSlideChart(element.chart, { width:element.width, height:element.height }) }
            : element);
          job.previewSlides[index] = {
            type:"slide-frame",
            title:String(frame.title || job.requestedOutline?.[index]?.title || `幻灯片 ${index + 1}`).trim().slice(0, 100),
            role:job.requestedOutline?.[index]?.role || frame.role || "content",
            chapterId:job.requestedOutline?.[index]?.chapterId || frame.chapterId || null,
            layoutFamily:job.requestedOutline?.[index]?.layoutFamily || frame.layoutFamily || "title-content",
            intent:frame.intent, archetype:frame.archetype, skillRoute:frame.skillRoute, layoutSpec:frame.layoutSpec, coordinateSpace:frame.coordinateSpace,
            templateId:String(frame.templateId || "freeform").trim().slice(0, 120),
            background:String(frame.background || "#ffffff").trim().slice(0, 300),
            elements:previewElements
          };
        } catch {}
      }
    } catch {}
  }, 700);
  progressTimer.unref?.();
  let timeout;
  const generationTimeout = slidesJobTimeout(job);
  try {
    const completedBy = await Promise.race([
      runner.done.then(() => "runner"),
      outputReady,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`AI slide generation timed out after ${generationTimeout.minutes} minutes.`)), generationTimeout.ms);
        timeout.unref?.();
      })
    ]);
    if (completedBy === "files") await stopCodexProcess(runner.child);
  } catch (error) {
    await stopCodexProcess(runner.child);
    throw error;
  } finally {
    clearTimeout(timeout);
    clearInterval(progressTimer);
  }
  }
  if (job.cancelRequested) return;
  await waitWhilePaused(job, job.action === "plan-slides" ? "validating" : "validating");
  if (job.cancelRequested) return;
  if (job.action === "plan-slides") {
    job.stage = "validating";
    job.outline = await readGeneratedOutline(job);
    job.status = "done";
    job.stage = "done";
    job.completedAt = new Date().toISOString();
    job.durationMs = activeSlidesElapsedMs(job);
    await logSlidesProgress(job, `Stage: done | outline prepared for ${job.pageCount} slides`);
    return;
  }
  job.stage = "validating";
  await logSlidesProgress(job, "Stage: validating | slides generated, checking quality");
  const slides = await readGeneratedSlidesWithQualityRetry(job);
  job.previewSlides = slides;
  const successfulSlides = slides.filter((slide) => !slide.generationFailed);
  await waitWhilePaused(job, "illustrating");
  if (job.cancelRequested) return;
  job.stage = "illustrating";
  await logSlidesProgress(job, "Stage: illustrating | generating visual assets");
  const illustratedSlides = successfulSlides.length ? await generateRequestedVisualAssets(job, slides) : slides;
  job.previewSlides = illustratedSlides;
  await waitWhilePaused(job, "final-review");
  if (job.cancelRequested) return;
  job.stage = "final-review";
  await logSlidesProgress(job, "Stage: final-review | reviewing deck visuals");
  job.pages = job.pages.map((page) => page.status === "failed" ? page : ({ ...page, status:"ready", reviewStatus:"reviewing" }));
  const reviewedSlides = await finalVisualReviewWithTargetedRepair(job, illustratedSlides);
  job.previewSlides = reviewedSlides;
  job.qualityReport = buildQualityReport(reviewedSlides);
  if (job.qualityReport.summary.errors > 0) {
    throw new Error(`Final quality gate found ${job.qualityReport.summary.errors} blocking error(s); the deck was not imported.`);
  }
  await waitWhilePaused(job, "importing");
  if (job.cancelRequested) return;
  job.stage = "importing";
  await logSlidesProgress(job, "Stage: importing | placing slides on canvas");
  job.imported = await importSlides(job, reviewedSlides);
  job.pages = job.pages.map((page, index) => ({ ...page, status:page.status === "failed" ? "failed" : "done", id:job.imported[index]?.id || null }));
  job.partialFailureCount = job.pages.filter((page) => page.status === "failed").length;
  job.status = "done";
  job.stage = "done";
  job.completedAt = new Date().toISOString();
  job.durationMs = activeSlidesElapsedMs(job);
  await logSlidesProgress(job, `Stage: done | imported ${job.imported.length} slide(s) after ${formatDuration(job.durationMs)} | failed pages retained: ${job.partialFailureCount} | quality: ${job.qualityReport.summary.errors} errors / ${job.qualityReport.summary.warnings} warnings`);
}

async function runBriefOptimization(job) {
  job.stage = "optimizing-brief";
  await logSlidesProgress(job, "Stage: optimizing-brief | structuring presentation request");
  const prompt = await buildSlideSkillPrompt({
    action:slideSkillActions.OPTIMIZE_BRIEF,
    payload:briefOptimizationPrompt(job),
    outline:[]
  });
  const runner = await startCodexSlidesJob({
    projectDir:job.projectDir,
    outputDir:job.outputDir,
    logPath:job.logPath,
    imagePaths:job.referencePaths,
    prompt
  });
  job.currentChild = runner.child;
  const timeoutSpec = slidesJobTimeout(job);
  let timeout;
  try {
    await Promise.race([
      runner.done,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`AI brief optimization timed out after ${timeoutSpec.minutes} minutes.`)), timeoutSpec.ms);
        timeout.unref?.();
      })
    ]);
  } catch (error) {
    await stopCodexProcess(runner.child);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (job.cancelRequested) return;
  job.stage = "validating";
  job.brief = await readOptimizedBrief(job);
  const mapped = mapBriefToTemplate(job.brief);
  job.deckTemplateId = mapped.templateId || "freeform";
  job.templateConfidence = mapped.confidence;
  job.templateRecommendations = mapped.recommendations || [];
  job.pageCount = job.brief.recommendedPageCount;
  job.pages = [];
  job.status = "done";
  job.stage = "done";
  job.completedAt = new Date().toISOString();
  job.durationMs = activeSlidesElapsedMs(job);
  await logSlidesProgress(job, `Stage: done | presentation brief optimized (${job.brief.recommendedPageCount} slides) | template → ${job.deckTemplateId} (${Math.round((job.templateConfidence || 0) * 100)}%)`);
}

async function finishSlidesWithoutVisuals(job) {
  const slides = job.previewSlides.map((slide) => slide?.type !== 'slide-frame' ? slide : ({
    ...slide,
    elements:(slide.elements || []).filter((element) => !String(element?.src || '').startsWith('asset://'))
  }));
  const omittedCount = job.previewSlides.reduce((count, slide) => count + (slide?.elements || []).filter((element) => String(element?.src || '').startsWith('asset://')).length, 0);
  job.previewSlides = slides;
  job.qualityWarnings = [...(job.qualityWarnings || []), `Visual assets omitted after generation service failure: ${omittedCount}`];
  job.stage = 'final-review';
  await writeResolvedSlides(job, slides);
  validateResolvedVisualDeck(slides);
  job.qualityReport = buildQualityReport(slides);
  if (job.qualityReport.summary.errors > 0) throw new Error(`Final quality gate found ${job.qualityReport.summary.errors} blocking error(s); the deck was not imported.`);
  job.stage = 'importing';
  await logSlidesProgress(job, `Stage: importing | importing retained drafts without ${omittedCount} unavailable visual asset(s)`);
  job.imported = await importSlides(job, slides);
  job.pages = job.pages.map((page, index) => ({ ...page, status:page.status === 'failed' ? 'failed' : 'done', id:job.imported[index]?.id || null }));
  job.partialFailureCount = job.pages.filter((page) => page.status === 'failed').length;
  job.status = 'done';
  job.stage = 'done';
  job.failedStage = null;
  job.failureKind = null;
  job.completedAt = new Date().toISOString();
  job.durationMs = activeSlidesElapsedMs(job);
  await logSlidesProgress(job, `Stage: done | imported ${job.imported.length} retained slide(s) without unavailable bitmap visuals`);
  await persistSlidesJob(job);
}

async function finalVisualReviewWithTargetedRepair(job, slides) {
  await writeResolvedSlides(job, slides);
  const failures = collectFinalVisualFailures(slides);
  if (!failures.length) {
    job.pages = job.pages.map((page) => page.status === "failed" ? page : ({ ...page, status:"ready", reviewStatus:"reviewed" }));
    return slides;
  }
  job.stage = "final-repair";
  await logSlidesProgress(job, `Stage: final-repair | repairing ${failures.length} failing slide(s)`);
  const failingIndexes = new Set(failures.map((failure) => failure.index));
  job.pages = job.pages.map((page) => page.status === "failed" ? page : ({ ...page, status:"ready", reviewStatus:failingIndexes.has(page.index) ? "repairing" : "reviewed" }));
  const protectedFiles = new Map();
  for (const filename of ["manifest.json", "visual-assets.json"]) {
    const filePath = path.join(job.outputDir, filename);
    const content = await fs.readFile(filePath).catch(() => null);
    if (content) protectedFiles.set(filePath, content);
  }
  for (let index = 0; index < slides.length; index += 1) {
    if (failingIndexes.has(index)) continue;
    const filePath = path.join(job.outputDir, `slide-${String(index + 1).padStart(2, "0")}.json`);
    protectedFiles.set(filePath, await fs.readFile(filePath));
  }
  const prompt = await buildSlideSkillPrompt({
    action:slideSkillActions.REVIEW_DECK,
    payload:finalVisualRepairPrompt(job, failures),
    outline:job.requestedOutline || []
  });
  const runner = await startCodexSlidesJob({
    projectDir:job.projectDir,
    outputDir:job.outputDir,
    logPath:path.join(path.dirname(job.logPath), "final-visual-repair.log"),
    imagePaths:[...job.referencePaths, ...job.generatedAssets.map((asset) => asset.path).filter(Boolean)].slice(0, 8),
    prompt
  });
  job.currentChild = runner.child;
  let timeout;
  const revisionTimeout = slidesJobTimeout(job, true);
  try {
    await Promise.race([
      runner.done,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`AI final visual repair timed out after ${revisionTimeout.minutes} minutes.`)), revisionTimeout.ms);
        timeout.unref?.();
      })
    ]);
  } catch (error) {
    await stopCodexProcess(runner.child);
    throw error;
  } finally {
    clearTimeout(timeout);
    await restoreChangedProtectedFiles(protectedFiles);
  }
  for (const failure of failures) {
    const filePath = path.join(job.outputDir, `slide-${String(failure.index + 1).padStart(2, "0")}.json`);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const frame = JSON.parse(raw);
      if (Array.isArray(frame.elements)) {
        frame.elements = frame.elements.map((el) => {
          if (el?.type === "text" && !el.parentId && !el.layoutLocked) {
            return { ...el, layoutLocked: true };
          }
          return el;
        });
        await fs.writeFile(filePath, `${JSON.stringify(frame, null, 2)}\n`);
      }
    } catch {}
  }
  const revised = await readGeneratedSlides(job);
  const remaining = collectFinalVisualFailures(revised);
  if (remaining.length) throw new Error(`Final visual review failed after targeted repair: ${remaining.map((item) => `slide ${item.index + 1}: ${item.message}`).join("; ")}`);
  validateResolvedVisualDeck(revised);
  job.pages = job.pages.map((page) => page.status === "failed" ? page : ({ ...page, status:"ready", reviewStatus:"reviewed" }));
  return revised;
}

async function writeResolvedSlides(job, slides) {
  for (const [index, slide] of slides.entries()) {
    if (slide.type !== "slide-frame") continue;
    await fs.writeFile(path.join(job.outputDir, `slide-${String(index + 1).padStart(2, "0")}.json`), `${JSON.stringify({ title:slide.title, intent:slide.intent, archetype:slide.archetype, skillRoute:slide.skillRoute, layoutSpec:slide.layoutSpec, coordinateSpace:slide.coordinateSpace || "parent-local", templateId:slide.templateId, background:slide.background, elements:slide.elements, generationFailed:Boolean(slide.generationFailed), generationError:slide.generationError || undefined }, null, 2)}\n`);
  }
}

function collectFinalVisualFailures(slides) {
  const failures = [];
  for (const [index, slide] of slides.entries()) {
    if (slide?.generationFailed) continue;
    if (slide.type !== "slide-frame") { failures.push({ index, message:"page is not a structured Frame" }); continue; }
    try {
      const frame = structuredClone({ ...slide, elements:slide.elements || [] });
      validateGeneratedFrame(frame, index);
      validatePostLayout(frame);
      if (frame.elements.some((item) => String(item?.src || "").startsWith("asset://"))) throw new Error("contains an unresolved generated visual token");
      for (const element of frame.elements.filter((item) => item.type === "image" && /^\/assets\//.test(String(item.src || "")))) {
        const style = element.style || {};
        if (!["cover", "contain", "scale-down"].includes(String(style.objectFit || ""))) throw new Error(`image ${element.id} has an invalid final crop mode`);
        if (!String(style.objectPosition || "").trim()) throw new Error(`image ${element.id} is missing final subject positioning`);
      }
    } catch (error) {
      failures.push({ index, message:String(error?.message || error).replace(/^Slide \d+\s*/i, "").slice(0, 500) });
    }
  }
  return failures;
}

function finalVisualRepairPrompt(job, failures) {
  const files = failures.map((failure) => `slide-${String(failure.index + 1).padStart(2, "0")}.json`).join(", ");
  return [
    "Perform the final post-asset visual repair for a structured presentation.",
    `Edit only these failing page files: ${files}. Do not modify any other slide file, manifest.json, or visual-assets.json.`,
    ...failures.map((failure) => `Slide ${failure.index + 1} failure: ${failure.message}`),
    "The bitmap assets are already generated and resolved in element.src. Preserve those assets and all confirmed facts.",
    "Repair layout, crop, objectPosition, masks, text fit, overlap, hierarchy, focal balance, and safe margins using the existing movable layers.",
    "Do not create new asset:// tokens, request new images, change page order, or replace unrelated pages.",
    "Use SVG elements instead of Unicode glyph decoration and keep ECharts chart models editable.",
    `Write corrected failing files only inside: ${job.outputDir}`,
    "Do not modify repository code and do not ask questions."
  ].join("\n");
}

async function readGeneratedSlidesWithQualityRetry(job) {
  const maxPageRepairs = 2;
  const maxDeckRepairs = 1;
  const repairCounts = new Map();
  const maxChecks = Math.max(3, job.pageCount * maxPageRepairs + maxDeckRepairs + 1);
  let lastError = null;
  for (let check = 0; check < maxChecks; check += 1) {
    try {
      const slides = await readGeneratedSlides(job);
      await validateVisualManifestPlan(job, slides);
      job.qualityRepair = null;
      return slides;
    } catch (error) {
      lastError = error;
      if (job.cancelRequested) throw error;
      const failedIndex = failedSlideIndexFromError(error);
      if (job.skipQualityRequested) {
        const message = String(error?.message || error).slice(0, 1000);
        if (failedIndex != null) await retainQualityFailedSlide(job, failedIndex, error, repairCounts.get(`slide-${failedIndex}`) || 0);
        else job.qualityWarnings = [...(job.qualityWarnings || []), `Skipped: ${message}`];
        job.skipQualityRequested = false;
        job.qualitySkipped = true;
        job.qualityRepair = null;
        await logSlidesProgress(job, "Stage: validating | quality check skipped by user; continuing with retained drafts");
        return readGeneratedSlides(job, { skipQualityValidation:true });
      }
      const repairKey = failedIndex == null ? "deck" : `slide-${failedIndex}`;
      const repairLimit = failedIndex == null ? maxDeckRepairs : maxPageRepairs;
      const repairAttempt = (repairCounts.get(repairKey) || 0) + 1;
      if (repairAttempt > repairLimit) {
        if (failedIndex == null) {
          job.qualityWarnings = [...(job.qualityWarnings || []), String(error?.message || error).slice(0, 1000)];
          job.qualityRepair = null;
          await logSlidesProgress(job, "Stage: validating | deck-level quality warning retained; continuing without another full-deck AI pass");
          return readGeneratedSlides(job);
        }
        await retainQualityFailedSlide(job, failedIndex, error, repairLimit);
        continue;
      }
      repairCounts.set(repairKey, repairAttempt);
      const reason = String(error?.message || error).replace(/\s+/g, " ").slice(0, 240);
      job.qualityRepair = { scope:failedIndex == null ? "deck" : "page", pageIndex:failedIndex, attempt:repairAttempt, limit:repairLimit, reason };
      if (failedIndex != null) job.pages[failedIndex] = { ...job.pages[failedIndex], status:"ready", reviewStatus:"repairing", repairAttempts:repairAttempt, error:reason };
      await logSlidesProgress(job, failedIndex == null
        ? `Stage: revising | deck quality repair ${repairAttempt}/${repairLimit} | ${reason}`
        : `Stage: revising | slide ${failedIndex + 1} quality repair ${repairAttempt}/${repairLimit} | ${reason}`);
      try {
        const revised = await runQualityRevision(job, error, failedIndex, failedIndex == null
          ? `quality-revision-deck-${String(repairAttempt).padStart(2, "0")}.log`
          : `quality-revision-slide-${String(failedIndex + 1).padStart(2, "0")}-${String(repairAttempt).padStart(2, "0")}.log`);
        await validateVisualManifestPlan(job, revised);
        if (failedIndex != null) job.pages[failedIndex] = { ...job.pages[failedIndex], status:"ready", reviewStatus:"reviewed", error:null };
        job.qualityRepair = null;
        return revised;
      } catch (revisionError) {
        lastError = revisionError;
      }
    }
  }
  throw lastError || new Error("Slide quality repair did not produce a valid deck.");
}

async function retainQualityFailedSlide(job, failedIndex, error, repairAttempts) {
  const filePath = path.join(job.outputDir, `slide-${String(failedIndex + 1).padStart(2, "0")}.json`);
  const message = String(error?.message || error).slice(0, 1000);
  try {
    const frame = JSON.parse(await fs.readFile(filePath, "utf8"));
    frame.generationFailed = true;
    frame.generationError = message;
    await fs.writeFile(filePath, `${JSON.stringify(frame, null, 2)}\n`);
  } catch {}
  job.pages[failedIndex] = { ...job.pages[failedIndex], status:"failed", reviewStatus:"failed", repairAttempts, error:message };
  job.qualityRepair = null;
  await logSlidesProgress(job, `Stage: validating | slide ${failedIndex + 1} retained after ${repairAttempts} unsuccessful quality repairs; continuing`);
}

async function runQualityRevision(job, error, failedIndex, logFilename) {
  const protectedFiles = new Map();
  const repairTargetPath = failedIndex == null ? null : path.join(job.outputDir, `slide-${String(failedIndex + 1).padStart(2, "0")}.json`);
  const repairTargetSnapshot = repairTargetPath ? await fs.readFile(repairTargetPath).catch(() => null) : null;
  for (const page of job.pages.filter((item) => item.status === "failed")) {
    const filePath = path.join(job.outputDir, `slide-${String(page.index + 1).padStart(2, "0")}.json`);
    const content = await fs.readFile(filePath).catch(() => null);
    if (content) protectedFiles.set(filePath, content);
  }
  if (failedIndex != null) {
    for (const filename of ["manifest.json", "visual-assets.json"]) {
      const filePath = path.join(job.outputDir, filename);
      const content = await fs.readFile(filePath).catch(() => null);
      if (content) protectedFiles.set(filePath, content);
    }
    for (let index = 0; index < job.pageCount; index += 1) {
      if (index === failedIndex) continue;
      const filePath = path.join(job.outputDir, `slide-${String(index + 1).padStart(2, "0")}.json`);
      const content = await fs.readFile(filePath).catch(() => null);
      if (content) protectedFiles.set(filePath, content);
    }
  }
    job.stage = "revising";
    await logSlidesProgress(job, failedIndex == null
      ? "Stage: revising | deck quality revision started"
      : `Stage: revising | targeted repair started for slide ${failedIndex + 1}`);
    const repairLog = path.join(path.dirname(job.logPath), logFilename);
    const prompt = await buildSlideSkillPrompt({
      action:slideSkillActions.REVIEW_DECK,
      payload:qualityRevisionPrompt(job, error, failedIndex),
      outline:job.requestedOutline || []
    });
    const runner = await startCodexSlidesJob({
      projectDir:job.projectDir,
      outputDir:job.outputDir,
      logPath:repairLog,
      imagePaths:job.referencePaths,
      prompt
    });
    job.currentChild = runner.child;
    let timeout;
    const revisionTimeout = qualityRevisionTimeout(job, failedIndex);
    try {
      await Promise.race([
        runner.done,
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`AI slide quality revision timed out after ${revisionTimeout.minutes} minutes.`)), revisionTimeout.ms);
          timeout.unref?.();
        })
      ]);
    } catch (revisionError) {
      await stopCodexProcess(runner.child);
      throw revisionError;
    } finally {
      clearTimeout(timeout);
      if (job.skipQualityRequested && repairTargetPath && repairTargetSnapshot) await fs.writeFile(repairTargetPath, repairTargetSnapshot);
      await restoreChangedProtectedFiles(protectedFiles);
    }
    const repairedIndex = failedIndex != null ? failedIndex : null;
    const filesToLock = repairedIndex != null
      ? [path.join(job.outputDir, `slide-${String(repairedIndex + 1).padStart(2, "0")}.json`)]
      : [];
    for (const filePath of filesToLock) {
      try {
        const raw = await fs.readFile(filePath, "utf8");
        const frame = JSON.parse(raw);
        if (Array.isArray(frame.elements)) {
          frame.elements = frame.elements.map((el) => {
            if (el?.type === "text" && !el.parentId && !el.layoutLocked) {
              return { ...el, layoutLocked: true };
            }
            return el;
          });
          await fs.writeFile(filePath, `${JSON.stringify(frame, null, 2)}\n`);
        }
      } catch {}
    }
    job.stage = "validating";
    await logSlidesProgress(job, "Stage: validating | quality revision completed");
    return readGeneratedSlides(job);
}

async function validateVisualManifestPlan(job, slides) {
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(job.outputDir, "visual-assets.json"), "utf8")); }
  catch { throw new Error("AI slides require a valid visual-assets.json plan."); }
  const activeSlides = slides.filter((slide) => !slide.generationFailed);
  if (!activeSlides.length) return;
  const budget = visualAssetBudget(activeSlides.length);
  const requests = Array.isArray(manifest?.assets) ? manifest.assets.slice(0, budget.max) : [];
  if (!requests.length) return;
  if (!normalizeArtDirection(manifest.artDirection)) throw new Error("A visual plan with bitmap requests requires a complete deck-wide artDirection specification.");
  const requested = new Set(requests.map((request) => String(request?.token || "").trim()).filter((token) => /^asset:\/\/visual-[a-z0-9._-]+$/i.test(token)));
  if (requested.size !== requests.length) throw new Error("The visual plan contains invalid or duplicate bitmap tokens.");
  const used = new Set(activeSlides.flatMap((slide) => slide.elements.map((element) => String(element?.src || "")).filter((src) => src.startsWith("asset://"))));
  if ([...used].some((token) => !requested.has(token))) throw new Error("Every bitmap layer token must have a matching visual-assets request.");
}

function qualityRevisionPrompt(job, error, failedIndex = null) {
  const budget = visualAssetBudget(job.pageCount);
  return [
    "Perform one targeted professional quality revision of the existing structured slide files in the output directory.",
    `Quality failure to fix: ${error?.message || String(error)}`,
    failedIndex == null
      ? "This is a deck-level failure. Inspect the full deck and revise only the files responsible for it."
      : `This is isolated to slide ${failedIndex + 1}. Edit only slide-${String(failedIndex + 1).padStart(2, "0")}.json; every other slide file and both manifest files are protected and must remain unchanged.`,
    `Keep exactly ${job.pageCount} slides and preserve the user-confirmed narrative and factual content.`,
    failedIndex == null ? "Inspect every existing slide JSON and revise only the pages responsible for the failure." : "Use the surrounding deck only as read-only context for visual and narrative consistency.",
    "Preserve independent movable layers. Use SVG data URLs for icons, arrows, stars, orbit lines, connectors, and abstract decoration; never use Unicode glyphs as graphics.",
    `Ensure visual-assets.json contains ${budget.min}-${budget.max} distinct, content-relevant bitmap requests plus a complete deck-wide artDirection object.`,
    "Ensure cover and case-study pages have a substantial masked bitmap focal point, adjacent pages have distinct silhouettes, and no generic card grid repeats on consecutive slides.",
    job.presentationReference
      ? "This deck uses PPTX reference mode. Preserve or restore templateId pptx-ref-N on every page and rebuild failing pages from their mapped source composition. The supplied PPTX pages override generic design defaults; do not introduce a new palette, technology aesthetic, dashboard language, glassmorphism, or unrelated decoration."
      : "Use the attached references as binding art direction when present, without copying their text or logos.",
    "Rebuild any failing page on a 12-column grid with a 48-72px content-safe margin. Make every text box tall enough for its wrapped copy with at least 12% spare vertical space.",
    "Remove accidental panel-on-panel overlays and clipped bottom content. If layers intentionally belong together, put them in one parent group instead of stacking unrelated top-level elements.",
    "For photographic crops use cover or contain, preserve the subject with objectPosition, and never stretch with fill.",
    "Run a final pass for hierarchy, contrast, text fit, focal point, visual relevance, image crop, and cross-slide consistency.",
    `Write corrected files only inside: ${job.outputDir}`,
    "Do not modify repository code and do not ask questions."
  ].join("\n");
}

async function generateRequestedVisualAssets(job, slides) {
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(job.outputDir, "visual-assets.json"), "utf8"));
  } catch {
    throw new Error("AI slides require a visual-assets.json manifest and at least one generated bitmap visual.");
  }
  const activeSlides = slides.filter((slide) => !slide.generationFailed);
  if (!activeSlides.length) return slides;
  const budget = visualAssetBudget(activeSlides.length);
  const requests = Array.isArray(manifest?.assets) ? manifest.assets.slice(0, budget.max) : [];
  if (!requests.length) return slides;
  const artDirection = normalizeArtDirection(manifest?.artDirection);
  if (!artDirection) throw new Error("visual-assets.json requires a complete deck-wide artDirection specification.");
  const requestedTokens = new Set(requests.map((request) => String(request?.token || "").trim()).filter(Boolean));
  const usedTokens = new Set(activeSlides.flatMap((slide) => slide.type === "slide-frame"
    ? slide.elements.map((element) => String(element?.src || "").trim()).filter((src) => src.startsWith("asset://"))
    : []));
  if (![...requestedTokens].some((token) => usedTokens.has(token))) return slides;
  const replacements = new Map();
  job.visualIndex = 0;
  job.visualTotal = requests.length;
  let nextRequestIndex = 0;
  let completedRequestCount = 0;
  const generateOne = async (index, request) => {
    if (job.cancelRequested) return;
    await waitWhilePaused(job, "illustrating");
    if (job.cancelRequested) return;
    const token = String(request?.token || "").trim();
    const prompt = String(request?.prompt || "").trim().slice(0, 3000);
    if (!/^asset:\/\/visual-[a-z0-9._-]+$/i.test(token) || !prompt) return;
    const assetDir = path.join(job.outputDir, `visual-${String(index + 1).padStart(2, "0")}`);
    const assetLog = path.join(path.dirname(job.logPath), `visual-${String(index + 1).padStart(2, "0")}.log`);
    const aspectRatio = String(request?.aspectRatio || "landscape").trim().slice(0, 40);
    const purpose = String(request?.purpose || "editorial presentation visual").trim().slice(0, 240);
    let generated = await newestGeneratedImage(assetDir);
    if (!generated) {
      const runner = await startCodexImageJob({
      projectDir:job.projectDir,
      action:"generate",
      imagePath:job.referencePaths,
      outputDir:assetDir,
      logPath:assetLog,
      prompt:[
        `Create a premium ${purpose} for a professional 16:9 presentation.`,
        `Target crop/aspect ratio: ${aspectRatio}.`,
        prompt,
        "No visible text, letters, numbers, logos, interface labels, watermarks, frames, or slide backgrounds.",
        job.presentationReference
          ? "The attached images are representative pages from the supplied PowerPoint. Extract only their illustration/rendering language, palette, lighting, material treatment, and subject framing. Do not reproduce the slide screenshot, its typography, or its layout inside the bitmap, and do not substitute an unrelated neon-cyan or generic technology style."
          : job.referencePaths.length ? "Use the attached references as binding img2 visual direction: match their art direction, lighting, palette relationships, material quality, and image treatment without copying text, logos, or identity." : "Create an original visual direction consistent with the deck.",
        "Compose a clean standalone visual asset with intentional negative space and colors compatible with the deck direction.",
        `Binding deck art direction: ${JSON.stringify(artDirection)}.`,
        job.visualDirection?.deckStyle ? `Deck visual direction: ${job.visualDirection.deckStyle}` : "",
        "Return one polished bitmap, not a collage or presentation screenshot."
      ].filter(Boolean).join("\n")
    });
      job.currentChild = runner.child;
      job.activeChildren ||= new Set();
      job.activeChildren.add(runner.child);
      try {
        await runner.done;
      } finally {
        job.activeChildren.delete(runner.child);
        if (job.currentChild === runner.child) job.currentChild = null;
      }
      generated = await newestGeneratedImage(assetDir);
    }
    if (!generated) return;
    const buffer = await fs.readFile(generated);
    const mime = imageMime(generated);
    if (!mime || buffer.length > 8 * 1024 * 1024) return;
    const assetName = `slide-${job.id}-${String(index + 1).padStart(2, "0")}${path.extname(generated).toLowerCase() || ".png"}`;
    const assetPath = path.join(assetsDirFor(job.projectDir, job.canvasId), assetName);
    await fs.mkdir(path.dirname(assetPath), { recursive:true });
    await fs.copyFile(generated, assetPath);
    replacements.set(token, `/assets/${encodeURIComponent(assetName)}`);
    job.generatedAssets.push({ token, purpose, path:assetPath });
    completedRequestCount += 1;
    job.visualIndex = completedRequestCount;
    await logSlidesProgress(job, `Stage: illustrating | ${completedRequestCount}/${requests.length} visual assets generated`, { visualIndex:completedRequestCount, visualTotal:requests.length });
  };
  const worker = async () => {
    while (!job.cancelRequested) {
      const index = nextRequestIndex;
      nextRequestIndex += 1;
      if (index >= requests.length) return;
      await generateOne(index, requests[index]);
    }
  };
  await Promise.all(Array.from({ length:Math.min(visualGenerationConcurrency, requests.length) }, () => worker()));
  if (!replacements.size) throw new Error("Image generation finished without a usable bitmap visual.");
  const unresolved = [...usedTokens].filter((token) => !replacements.has(token));
  if (unresolved.length) throw new Error(`Image generation did not resolve visual assets: ${unresolved.join(", ")}`);
  const resolvedSlides = slides.map((slide) => slide.type !== "slide-frame" ? slide : {
    ...slide,
    elements:slide.elements.map((element) => replacements.has(element.src) ? { ...element, src:replacements.get(element.src) } : element)
  });
  validateResolvedVisualDeck(resolvedSlides);
  return resolvedSlides;
}

function normalizeArtDirection(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalized = {
    palette:String(value.palette || "").trim().slice(0, 500),
    typography:String(value.typography || "").trim().slice(0, 500),
    imageStyle:String(value.imageStyle || "").trim().slice(0, 800),
    decorativeLanguage:String(value.decorativeLanguage || "").trim().slice(0, 800),
    consistencyKey:String(value.consistencyKey || "").trim().slice(0, 800)
  };
  return Object.values(normalized).every(Boolean) ? normalized : null;
}

function validateResolvedVisualDeck(slides) {
  const activeSlides = slides.filter((slide) => !slide.generationFailed);
  if (!activeSlides.length) return;
  const bitmapElements = activeSlides.flatMap((slide) => slide.type === "slide-frame"
    ? slide.elements.filter((element) => element.type === "image" && /^\/assets\//.test(String(element.src || "")))
    : []);
  for (const element of bitmapElements) {
    const style = element.style ||= {};
    if (!["cover", "contain", "scale-down"].includes(String(style.objectFit || ""))) style.objectFit = "cover";
    if (!String(style.objectPosition || "").trim()) style.objectPosition = "50% 50%";
  }
}

async function newestGeneratedImage(directory) {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes:true }); } catch { return null; }
  const images = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(?:png|jpe?g|webp)$/i.test(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat) images.push({ filePath, mtimeMs:stat.mtimeMs });
  }
  return images.sort((a,b) => b.mtimeMs - a.mtimeMs)[0]?.filePath || null;
}

function imageMime(filePath) {
  if (/\.png$/i.test(filePath)) return "image/png";
  if (/\.webp$/i.test(filePath)) return "image/webp";
  if (/\.jpe?g$/i.test(filePath)) return "image/jpeg";
  return "";
}

async function failJob(job, error) {
  if (job.cancelRequested || job.status === "cancelled") return;
  const failedStage = job.stage;
  const recoverableQualityFailure = job.action === "generate-slides"
    && job.previewSlides?.some(Boolean)
    && ["validating", "revising", "illustrating", "final-review", "final-repair"].includes(failedStage);
  job.status = recoverableQualityFailure ? "quality_failed" : "failed";
  job.stage = recoverableQualityFailure ? "quality_failed" : "failed";
  job.failedStage = failedStage;
  job.error = error?.message || String(error);
  job.failureKind = classifySlidesFailure(job.error, failedStage);
  const failedIndex = failedSlideIndexFromError(job.error);
  job.pages = job.pages.map((page) => {
    if (page.status === "done") return page;
    const isFailedPage = failedIndex != null && page.index === failedIndex;
    return { ...page, status:isFailedPage ? "failed" : page.status === "ready" ? "ready" : page.status, error:isFailedPage ? job.error : null };
  });
  job.completedAt = new Date().toISOString();
  job.durationMs = activeSlidesElapsedMs(job);
  await persistSlidesJob(job);
}

export function classifySlidesFailure(error, stage = '') {
  const message = String(error || '');
  if (/\b401\b|unauthorized|missing bearer|missing basic authentication|authentication in header/i.test(message)) return 'authentication';
  if (stage === 'illustrating') return 'visual-assets';
  if (['validating', 'revising', 'final-review', 'final-repair'].includes(stage)) return 'quality';
  return 'generation';
}

export function failedSlideIndexFromError(error) {
  const slideMatch = /\bSlide\s+(\d+)\b/i.exec(String(error || "").trim());
  return slideMatch ? Number(slideMatch[1]) - 1 : null;
}

export function resolveDeckTemplate(job) {
  if (job.deckTemplateId && !isFreeformTemplate(job.deckTemplateId)) return;
  const vd = job.visualDirection || {};
  const briefLike = {
    topic: job.prompt,
    goal: vd.goal || "",
    style: vd.deckStyle || "",
    audience: vd.audience || "",
    scenario: vd.scenario || "",
    narrative: job.prompt,
    recommendedPageCount: job.pageCount
  };
  const mapped = mapBriefToTemplate(briefLike);
  job.deckTemplateId = mapped.templateId || "freeform";
  job.templateConfidence = mapped.confidence;
  job.templateRecommendations = mapped.recommendations || [];
}

export function templateBindingSection(job) {
  if (isFreeformTemplate(job.deckTemplateId)) return "";
  const template = loadTemplate(job.deckTemplateId);
  if (!template) return "";
  return [
    `DECK TEMPLATE BINDING: This deck is bound to template "${template.id}" (${template.purpose || ""} · ${template.style || ""} · ${template.expression || ""}). This is a binding constraint, not inspiration.`,
    "Workflow step 3 (deck design system) must be loaded from this template instead of planned freely. See the compose-professional-slides skill's \"Template Binding\" section.",
    `Template definition (binding): ${JSON.stringify(template)}`,
    "When the template's shape.cornerRadius, typography sizeRange/weight, palette role values, chart palette, or image language conflict with generic styling suggestions above, the template wins.",
  ].join("\n");
}

export function presetBindingSection(job) {
  const outline = Array.isArray(job.requestedOutline) ? job.requestedOutline : [];
  const hitIds = [...new Set(outline.map((page) => page?.presetId).filter(Boolean))];
  if (!hitIds.length) return "";
  const presets = [];
  for (const id of hitIds) {
    try {
      const preset = loadPreset(id);
      if (preset) presets.push(preset);
    } catch {}
  }
  if (!presets.length) return "";
  return [
    "DIAGRAM PRESET BINDING: The confirmed outline binds a diagram preset to specific pages (each page's presetId). This is a binding constraint, not a suggestion.",
    "When a page's presetId is non-null, that page's diagram must use the bound preset's family, layout, slots, and visualSpec instead of designing freely. Every slot must be filled, no slot may be skipped, no extra top-level slot may be added. See the create-slide-diagram skill's \"Preset Binding\" section.",
    `Bound presets (binding): ${JSON.stringify(presets)}`,
  ].join("\n");
}

export function slidesPrompt(job, batch = null) {
  const assetBudget = visualAssetBudget(job.pageCount);
  const batchIndexes = batch?.indexes || Array.from({ length:job.pageCount }, (_, index) => index);
  const batchPages = batchIndexes.map((index) => index + 1);
  const batchAssetFilename = batch ? `visual-assets-batch-${String(batch.batchIndex + 1).padStart(2, "0")}.json` : "visual-assets.json";
  const currentAssetBudget = batch ? batchVisualAssetBudget(job.pageCount, batch.batchIndex, batch.batchTotal) : assetBudget;
  const imageReferenceContract = job.referencePaths.length ? [
    "IMAGE REFERENCE MODE IS A BINDING TEMPLATE-QUALITY CONTRACT, NOT A COLOR MOOD BOARD.",
    "First infer one reusable visual grammar from the supplied screenshots: canvas polarity, gradient direction, title scale, grid, whitespace, recurring ornaments, card treatment, image material, and page-to-page rhythm.",
    "Match composition structure as well as styling. Preserve the reference family's large display headlines, asymmetric hero balance, generous whitespace, restrained blue-white palette, luminous depth, and polished 3D/isometric illustration language when those traits are visible.",
    "Build a coordinated slide family: cover/closing bookends, agenda or navigation, chapter dividers, editorial content pages, diagram/process pages, and evidence pages. Do not make every page a card grid and do not repeat the same silhouette on consecutive pages.",
    "Use background gradients, soft waves, glows, rings, fine lines, and geometric accents as separate native shape or SVG layers. Do not bake slide text, logos, charts, or complete page layouts into generated bitmap images.",
    "On cover and section pages use a 44-68px Chinese display title and a dominant visual occupying about 38-58% of the canvas. On content pages keep body text presentation-readable, usually 16-22px, with one dominant diagram, visual, or evidence region.",
    "Use sharp business typography, disciplined baseline alignment, consistent corner radii, subtle shadows, and intentional optical spacing. Reject pages that merely place small text into generic white cards on a plain background.",
    `Derive ${batchAssetFilename} artDirection from the references. Every generated asset must share the same material system, camera angle family, lighting, blue/cyan relationships, edge quality, and background integration so the deck looks like one authored template.`
  ].join("\n") : "";
  return [
    "Create a polished, presentation-ready structured slide deck from the user's brief.",
    batch
      ? `This is generation batch ${batch.batchIndex + 1}/${batch.batchTotal}. Generate only pages ${batchPages.join(", ")} of the ${job.pageCount}-page deck as independent 1024x576 slide Frame JSON documents.`
      : `Generate exactly ${job.pageCount} independent 1024x576 slide Frame JSON documents.`,
    batch ? `Read and obey the deck-wide storyboard at ${path.join(job.outputDir, "slide-plan.json")}. Use it as the single source of truth for narrative, confirmed copy, design system, visual rhythm, and neighboring-page context. Do not rewrite it.` : "",
    "First establish a coherent narrative arc, then give every page a distinct layout suited to its message.",
    job.requestedOutline
      ? `Follow this user-confirmed page outline exactly:\n${JSON.stringify(job.requestedOutline)}`
      : "Create a coherent page outline before rendering.",
    job.visualDirection
      ? `Treat this user-confirmed visual direction as a binding deck-wide constraint:\n${JSON.stringify(job.visualDirection)}`
      : "Derive a coherent visual direction from the user's brief.",
    "When visualDirection contains designSystem, use its color roles, typography, shape language, image language, and chart language consistently on every page. When it contains visualRhythm, follow each page's treatment, density, silhouette, and specialistRoute exactly. These confirmed fields override generic styling suggestions.",
    job.visualDirection?.brandProfile ? `ENTERPRISE BRAND BINDING: ${JSON.stringify(job.visualDirection.brandProfile)}. Apply these exact brand colors and font family across the deck. Use the brand name as restrained identity text and add footerText consistently when provided.` : "",
    templateBindingSection(job),
    presetBindingSection(job),
    "Act as a senior editorial presentation designer, not a template filler. Every slide needs a visible focal point and a deliberate reading path.",
    job.presentationReference
      ? "PPTX REFERENCE MODE OVERRIDES THE DEFAULT DESIGN SYSTEM. Reconstruct the source deck's visual grammar from the attached source pages before composing: background polarity and page rhythm, exact palette relationships, typography scale and weight, margins, focal-image placement, masks, recurring lines and ornaments, and density. Do not invent a different art direction even if another style looks more fashionable."
      : "Apply professional presentation principles used by Microsoft Designer and Adobe Express: create a cohesive visual system, use content-relevant high-quality imagery, convert lists/processes/timelines into diagrams, favor more visuals and less text, and let every visual support rather than distract from the message.",
    "Use one core idea per slide, a 12-column grid, three-level typography, 48-72px outer margins, and a restrained deck-wide palette with one primary accent and at most one secondary accent.",
    "Treat the 48-72px margin as a hard content-safe area. Background shapes may bleed, but titles, body text, charts, labels, and controls must stay inside it.",
    "Size every text box from its actual copy. Never rely on overflow clipping: estimate wrapped lines from font size and box width, then leave at least 12% vertical breathing room.",
    "Do not place independent opaque or translucent panels over existing cards, text, timelines, or charts. Overlap is allowed only for an intentional parent container with its own children or a clearly decorative non-obscuring layer.",
    "For cover, section, case-study, and key-insight pages, reserve roughly 35-55% of the canvas for one dominant visual. For evidence, process, comparison, and data pages, use an editorial diagram, timeline, masked image, or information composition instead of plain text cards.",
    "Vary compositions across the deck: full-bleed hero, asymmetric split, editorial grid, comparison, process, evidence, and summary. Do not repeat one card arrangement on every page.",
    "Use strong editorial hierarchy, concise real copy, intentional typography, grids, diagrams, charts, timelines, cards, and vector artwork where appropriate.",
    "CONTENT MODE: AI-FIRST COMPLETE DRAFT. Preserve explicit user copy when present. Proactively author every missing name, example, claim, date, metric, quotation, recommendation, and outcome so the deck is complete and presentation-ready.",
    "If a page still lacks substantive content, author useful editable draft copy from domain-general knowledge: explanations, frameworks, recommendations, hypothetical examples, options, and next actions. Do not leave a page empty or fill it with generic placeholders when safe conceptual content can be proposed.",
    "Do not run authenticity checks, request sources, add factual caveats, use 待补充 / To be provided, or label AI-authored content as simulated. The user will proactively provide replacement content when changes are needed.",
    "Before drawing, assign every page one intent from: cover, hero, chart, comparison, process, timeline, architecture, case, dashboard, summary, image. Save it in slide.intent.",
    "Assign slide.archetype from: cover-hero, hero-left, hero-right, split-50, split-40-60, three-columns, four-metrics, comparison, timeline, process, architecture, dashboard, case-study, summary. The backend owns final geometry.",
    "Assign each meaningful top-level element a slot supported by its archetype (title, subtitle, content, visual, footer, left, right, col1-col3, or metric1-metric4). The backend deterministically replaces x/y/width/height from that slot on a 16:9 canvas with a 64px safe area, 12-column grid, and 24px gap. Set layoutLocked:true only for background/decorative bleed geometry.",
    "Skill routing is binding: chart => editable ECharts chart; process/timeline/architecture => SVG diagram; cover/hero => UI/UX art direction plus ImageGen description; dashboard => data-viz; image => image crop with focal-point/objectPosition.",
    "Choose a templateId for every page from: cover, section, insight, comparison, process, data, case-study, solution, roadmap, summary, freeform.",
    "Every meaningful item must be an independently movable top-level element with a stable id and type: text, image, svg, chart, or shape. Do not emit group elements for generated slides.",
    "For quantitative charts, emit a chart element with chart.type (bar, line, scatter, or pie), categories, series, colors, unit, dataMode, and accessibilitySummary. Leave chart src empty; the backend will render it with ECharts. Keep the page takeaway and source note as separate text layers.",
    job.dataMode === "supplied"
      ? "DATA MODE: supplied. Use only quantitative values explicitly supplied by the user. If a required value is absent, use a clearly labeled 待补充 / To be provided placeholder; do not synthesize numbers. Set chart.dataMode to supplied."
      : job.dataMode === "placeholder"
        ? "DATA MODE: placeholder. Do not synthesize missing quantitative values. Keep chart and metric structures editable but visibly label missing values 待补充 / To be provided. Set chart.dataMode to placeholder."
      : job.dataMode === "simulated"
        ? "DATA MODE: simulated. Populate missing values with internally consistent AI-generated values without adding disclosure labels or source requirements."
        : "DATA MODE: ai-generated. Generate all missing chart values, metrics, outcomes, dates, and supporting copy with AI. Set chart.dataMode to ai-generated. Do not add source notes, authenticity checks, placeholders, or simulated-data disclosures. User-supplied replacements always take priority.",
    "Use slide-absolute x/y coordinates for every element. Set parentId to null, positionMode to free, and layout.mode to free. Do not use row, column, grid, or invisible layout containers; moving one element must never reposition another.",
    "Keep content and presentation separate: copy belongs in element.text, imagery in element.src, visual styling in element.style, and layout only in element coordinates or element.layout.",
    "Do not repeat a stock template, a generic sphere, or the same hero composition across pages. Avoid filler text, emoji, Unicode dingbats used as graphics, and invented claims presented as facts.",
    "Use inline SVG data URLs for icons, arrows, connectors, stars, or abstract editorial decorations. Keep SVG vectors compact, self-contained, and free of scripts, foreignObject, external resources, or text glyphs.",
    batch ? `Request exactly ${currentAssetBudget.min === currentAssetBudget.max ? currentAssetBudget.min : `${currentAssetBudget.min}-${currentAssetBudget.max}`} premium bitmap visual(s) for this batch, only on the pages where imagery most improves communication. Use globally unique tokens such as asset://visual-p${String(batchPages[0]).padStart(2, "0")}-01.png.` : `Request ${assetBudget.min}-${assetBudget.max} premium bitmap visuals for this ${job.pageCount}-page deck. Add each as an independently movable image element whose src is asset://visual-01.png (or another unique visual-NN.png token). Use dedicated visuals for the cover, case studies, project showcases, and key section moments; do not reuse the same image on adjacent pages.`,
    `Write ${batchAssetFilename} with this shape: {"artDirection":{"palette":"...","typography":"...","imageStyle":"...","decorativeLanguage":"...","consistencyKey":"stable description of recurring character, lighting, lens, material and color treatment"},"assets":[{"token":"asset://visual-p01-01.png","file":"visual-p01-01.png","prompt":"...","aspectRatio":"4:5","purpose":"page 1 hero portrait"}]}. Use the confirmed deck design system for one stable artDirection. Every asset prompt must repeat the consistencyKey details. The assets array may be empty only if no bitmap improves this batch.`,
    "For image elements, store objectFit, objectPosition, clipPath, borderRadius, border, and shadow directly on the image element as one movable masked-image layer. Never create a separate mask or wrapper group. At least one generated bitmap in every deck must be visibly masked. Never stretch an image.",
    "For every image crop, choose objectFit cover or contain deliberately and set an objectPosition that keeps the subject visible. Never use fill for photographic content.",
    "Do not output HTML, JavaScript, remote URLs, CDNs, external fonts, file URLs, or network requests.",
    "Keep all element bounds inside 1024x576 and use sufficient color contrast.",
    job.referencePaths.length
      ? "Attached images are visual references. Match their composition logic, color relationships, type hierarchy, image treatment, and density without copying text or logos. Use them selectively and prefer them over generating unnecessary new imagery."
      : "No reference images are attached; create a purposeful visual system and request generated bitmaps only when they materially improve communication.",
    imageReferenceContract,
    job.presentationReference ? `A PowerPoint reference was supplied. This is a binding visual-source contract, not loose inspiration. Every output page must name its mapped source page in templateId as pptx-ref-N and visibly preserve that source family's palette, typography appearance, spacing, image masking, decorative language, and light/dark rhythm. ${batchAssetFilename} must derive artDirection only from this reference; never introduce an unrelated neon-cyan, glassmorphism, generic corporate, dashboard, or technology theme unless it visibly exists in the supplied pages.\n${job.presentationReference}` : "",
    "Write files only inside the exact output directory below:",
    job.outputDir,
    batch ? `Write only ${batchPages.map((pageNumber) => `slide-${String(pageNumber).padStart(2, "0")}.json`).join(", ")}. Do not create, edit, or delete slide files belonging to other batches.` : `Write slide-01.json through slide-${String(job.pageCount).padStart(2, "0")}.json.`,
    "Each slide JSON must use this shape: {\"title\":\"...\",\"intent\":\"cover\",\"archetype\":\"cover-hero\",\"templateId\":\"cover\",\"background\":\"#ffffff\",\"elements\":[{\"id\":\"headline\",\"type\":\"text\",\"slot\":\"title\",\"parentId\":null,\"text\":\"...\",\"src\":\"\",\"locked\":false,\"aiLocked\":false,\"style\":{\"color\":\"#0f172a\",\"background\":\"\",\"fontFamily\":\"Inter, sans-serif\",\"fontSize\":\"52px\",\"fontWeight\":\"700\",\"lineHeight\":\"1.05\",\"textAlign\":\"left\",\"borderRadius\":\"0\",\"opacity\":\"1\",\"transform\":\"\",\"objectFit\":\"cover\",\"objectPosition\":\"50% 50%\",\"clipPath\":\"\",\"boxShadow\":\"\",\"border\":\"\"}}]}",
    batch ? "Do not write manifest.json or visual-assets.json. The backend assembles those global files after every batch is safely persisted." : "Also write manifest.json as valid JSON: {\"slides\":[{\"file\":\"slide-01.json\",\"title\":\"...\"}]}",
    batch ? "Finish immediately after the assigned slide files and batch visual asset plan are valid on disk." : "The manifest order is the presentation order and must contain exactly the requested number of entries.",
    "Run a final visual QA pass before finishing: reject text collisions, clipped text, low contrast, stretched images, excessive tiny copy, repeated compositions, and decorative elements that do not support the message.",
    "Do not modify repository source code. Do not ask follow-up questions. Do not merely describe the slides; create all files.",
    "",
    "User brief:",
    job.prompt
  ].join("\n");
}

function normalizeVisualDirection(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalized = {
    deckStyle: String(value.deckStyle || "").trim().slice(0, 600),
    goal: String(value.goal || "").trim().slice(0, 240),
    audience: String(value.audience || "").trim().slice(0, 240),
    scenario: String(value.scenario || "").trim().slice(0, 240),
    presets: Array.isArray(value.presets) ? value.presets.map((item) => String(item || "").trim().slice(0, 80)).filter(Boolean).slice(0, 12) : [],
    designSystem: normalizeDeckDesignSystem(value.designSystem),
    visualRhythm: normalizeVisualRhythm(value.visualRhythm, Array.isArray(value.visualRhythm) ? value.visualRhythm.length : 0),
    brandProfile: value.brandProfile?.enabled ? { enabled:true, name:String(value.brandProfile.name || "").trim().slice(0, 120), fontFamily:String(value.brandProfile.fontFamily || "").trim().slice(0, 120), primaryColor:/^#[0-9a-f]{6}$/i.test(String(value.brandProfile.primaryColor || "")) ? String(value.brandProfile.primaryColor).toLowerCase() : "", secondaryColor:/^#[0-9a-f]{6}$/i.test(String(value.brandProfile.secondaryColor || "")) ? String(value.brandProfile.secondaryColor).toLowerCase() : "", backgroundColor:/^#[0-9a-f]{6}$/i.test(String(value.brandProfile.backgroundColor || "")) ? String(value.brandProfile.backgroundColor).toLowerCase() : "", footerText:String(value.brandProfile.footerText || "").trim().slice(0, 160) } : null
  };
  return Object.values(normalized).some((item) => Array.isArray(item) ? item.length : item) ? normalized : null;
}

function briefOptimizationPrompt(job) {
  const explicit = explicitBriefFromPrompt(job.prompt);
  return [
    "Turn the rough presentation request into one concise, editable brief for a novice user to confirm.",
    "This is not the outline stage. Do not propose slide titles, page-by-page content, chapter structures, agenda items, or page allocation.",
    "Keep goal, audience, scenario, and duration to one short phrase each; keep coreMessage, narrative, style, and factsAndSources to one concise sentence each.",
    "Preserve every explicit name, number, claim, constraint, audience, scenario, and style choice.",
    "When the request names a domain or use case but omits professional context, infer a practical presenter role and content scope from that domain (for example, a campus party-affairs request may use a university ideological-education counselor perspective and identify the requested modules). Keep these as editable intent, not as invented facts.",
    "For short prompts, make the optimized brief materially more useful by completing missing goal, audience, scenario, content scope, visual direction, and evidence boundary; do not merely rewrite the same sentence.",
    "Also return expandedPrompt: rewrite the user's original request into one natural, complete paragraph. Treat the original words as semantic input, not as a quoted topic label: do not write ‘围绕“用户原话”制作’ and do not repeat command wording such as ‘帮我生成…’. Start with a natural request such as ‘请帮我制作一套…’, preserve the intent, then continue with useful context. Do not format expandedPrompt as labels, bullet points, or a field list. This paragraph is what the user will see and edit.",
    "Example: for ‘帮我生成党政党建主题的模板，颜色为红色’, expandedPrompt should request a complete red-themed presentation with AI-authored policy-style explanations, examples, dates, metrics, and action recommendations, all editable by the user. Do not copy this example when the topic is different.",
    "Before writing expandedPrompt, remove duplicated words, repeated verbs, doubled punctuation, and awkward joins. Never output forms such as 身份身份、采用采用、。。、；。 or repeated phrases.",
    "Infer and author useful defaults wherever information is missing. Generate a complete draft instead of exposing assumptions, evidence gaps, or authenticity warnings.",
    "Generate missing quantitative and non-quantitative content directly. Do not use 待补充, To be provided, source requests, or simulated-data disclosure labels.",
    explicit.recommendedPageCount
      ? `The user explicitly requested exactly ${explicit.recommendedPageCount} slides. Preserve this value; it is not a recommendation.`
      : "Recommend the optimal length between 1 and 20 slides from the actual content scope. First identify the distinct ideas that deserve their own page, then adjust for audience, presentation scenario, duration, evidence density, and the need for a cover and closing. Do not anchor on 5 or any other default.",
    Object.keys(explicit).length ? `Explicit user fields that must win over inferred values:\n${JSON.stringify(explicit, null, 2)}` : "",
    "Write valid JSON only to this exact path:",
    path.join(job.outputDir, "brief.json"),
    "Use exactly this shape: {\"expandedPrompt\":\"...\",\"topic\":\"...\",\"presenterRole\":\"...\",\"goal\":\"...\",\"audience\":\"...\",\"scenario\":\"...\",\"duration\":\"...\",\"coreMessage\":\"...\",\"narrative\":\"...\",\"style\":\"...\",\"factsAndSources\":\"...\",\"mustPreserve\":\"...\",\"mustAvoid\":\"...\",\"recommendedPageCount\":8,\"pageCountReason\":\"...\",\"assumptions\":[\"...\"],\"questions\":[\"...\"]}",
    "Return zero to three questions. Prefer an editable assumption over a question unless the ambiguity materially changes the deck.",
    "Do not generate an outline, slides, images, Markdown, or repository changes.",
    job.presentationReference ? `PowerPoint reference context:\n${job.presentationReference}` : "",
    "Rough request:",
    job.prompt
  ].filter(Boolean).join("\n\n");
}

async function readOptimizedBrief(job) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(path.join(job.outputDir, "brief.json"), "utf8"));
  } catch {
    throw new Error("AI finished without a valid presentation brief.");
  }
  const text = (value, fallback = "", max = 1200) => String(value || fallback).trim().slice(0, max);
  const list = (value) => Array.isArray(value)
    ? value.map((item) => text(item, "", 300)).filter(Boolean).slice(0, 6)
    : [];
  const explicit = explicitBriefFromPrompt(job.prompt);
  const recommendedPageCount = Math.max(1, Math.min(maxSlides, Math.round(Number(explicit.recommendedPageCount || parsed.recommendedPageCount) || 8)));
  return {
    expandedPrompt:text(parsed.expandedPrompt, "", 2400),
    topic:text(explicit.topic || parsed.topic, job.prompt, 1000),
    presenterRole:text(parsed.presenterRole, "", 240),
    goal:text(explicit.goal || parsed.goal, "AI 智能判断", 500),
    audience:text(explicit.audience || parsed.audience, "AI 智能判断", 500),
    scenario:text(explicit.scenario || parsed.scenario, "AI 智能判断", 500),
    duration:text(parsed.duration, "AI 智能判断", 120),
    coreMessage:text(parsed.coreMessage, "由 AI 根据主题生成完整核心信息", 800),
    narrative:text(explicit.narrative || parsed.narrative, "", 1200),
    style:text(explicit.style || parsed.style, "跟随内容智能判断", 500),
    factsAndSources:text(explicit.factsAndSources || parsed.factsAndSources, "全部内容由 AI 自主生成；用户后续提供的修改内容优先", 1200),
    mustPreserve:text(parsed.mustPreserve, "", 800),
    mustAvoid:text(parsed.mustAvoid, "避免空白页、待补充占位和未完成内容", 800),
    recommendedPageCount,
    pageCountReason:text(parsed.pageCountReason, "", 500),
    assumptions:list(parsed.assumptions),
    questions:list(parsed.questions).slice(0, 3)
  };
}

function parseSlidePageNumber(raw) {
  const value = String(raw || "").trim();
  if (/^\d{1,2}$/.test(value)) return Number(value);
  const digits = { 一:1, 二:2, 两:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9 };
  if (value === "十") return 10;
  const match = /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(value);
  if (match) return (match[1] ? digits[match[1]] : 1) * 10 + (match[2] ? digits[match[2]] : 0);
  return digits[value] || null;
}

export function explicitBriefFromPrompt(prompt) {
  const raw = String(prompt || "").trim();
  let value = {};
  try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed; } catch {}
  const source = [value.sourcePrompt, value.topic, raw].filter(Boolean).join("\n");
  const explicit = {};
  const inferredDefaults = /^(?:AI\s*智能判断|Auto|跟随.*智能判断|Use presets or auto)$/i;
  for (const key of ["topic", "goal", "audience", "scenario", "narrative", "style", "factsAndSources"]) {
    const candidate = String(value[key] || "").trim();
    if (candidate && !inferredDefaults.test(candidate)) explicit[key] = candidate;
  }
  const labels = {
    topic:/^(?:主题|topic)\s*[：:]\s*(.+)$/i,
    goal:/^(?:目标|演示目标|goal)\s*[：:]\s*(.+)$/i,
    audience:/^(?:受众|目标受众|audience)\s*[：:]\s*(.+)$/i,
    scenario:/^(?:场景|使用场景|scenario)\s*[：:]\s*(.+)$/i,
    narrative:/^(?:叙事|叙事结构|narrative)\s*[：:]\s*(.+)$/i,
    style:/^(?:视觉|视觉方向|style|visual direction)\s*[：:]\s*(.+)$/i,
    factsAndSources:/^(?:事实规则|事实与资料边界|fact rule|facts and sources)\s*[：:]\s*(.+)$/i
  };
  for (const line of source.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    for (const [key, pattern] of Object.entries(labels)) {
      const match = pattern.exec(line);
      if (match) { explicit[key] = match[1].trim(); break; }
    }
  }
  const requested = Number(value.recommendedPageCount);
  const pageToken = "(\\d{1,2}|[一二两三四五六七八九十]{1,3})";
  const pageMatch = new RegExp(`(?:建议页数|篇幅|页数|recommended slides|slide count|length)\\s*[：:]?\\s*${pageToken}\\s*(?:页|slides?)?`, "i").exec(source)
    || new RegExp(`(?:做成?|生成|制作|一共|总共)?\\s*${pageToken}\\s*页`, "i").exec(source);
  const pageCount = pageMatch ? parseSlidePageNumber(pageMatch[1]) : requested;
  if (Number.isFinite(pageCount) && pageCount >= 1 && pageCount <= maxSlides) explicit.recommendedPageCount = Math.round(pageCount);
  return explicit;
}

function outlinePrompt(job) {
  return [
    "Act as a senior presentation strategist. Plan the slide deck before any visual generation.",
    `Create exactly ${job.pageCount} pages from the user's structured brief.`,
    "First infer four decision groups from the brief: core goal, target audience, presentation scenario, and deck length.",
    "For goal, audience, and scenario, provide one recommended selection plus 2-3 concise alternatives. For length, select the requested page count and provide 2-3 reasonable numeric alternatives.",
    "Create a deck-level storyline before the page list: one short arrow-separated narrative path, one presentation-type tag, and 3-6 internal narrative groupings. These groupings are reasoning references only: they must not consume pages, replace page content, force four chapters, or create standalone section pages.",
    "Create a page structure plan for every requested page. Assign every page exactly one structural role from cover, agenda, content, summary, closing; use section only when the user's brief explicitly requests standalone chapter divider pages. Page 1 must be cover and the last page must be closing. Every page still needs its own concrete title and content as part of the complete page list. Map each role to a layout family from title, agenda, section-header, title-content, two-content, comparison, summary, closing.",
    "Create one deck design system with a restrained palette, typography hierarchy, shape language, image language, and chart language. These are global constraints, not page decoration suggestions.",
    job.referencePaths.length ? "The attached screenshots are binding design evidence. Describe their observed title scale, blue-white gradient roles, spatial depth, 3D/isometric material language, recurring ornaments, card geometry, whitespace, and cover/content/section rhythm inside designSystem and visualRhythm. Match their template-grade composition, not only their dominant color. Do not copy screenshot wording or logos." : "",
    "Create a visual rhythm plan with exactly one entry per page. Choose treatment from hero-image, chart, diagram, comparison, editorial, metrics, minimal; density from low, medium, high; silhouette from full-bleed, left-visual, right-visual, centered, split, grid, timeline; and specialistRoute from visual, chart, diagram, native. Never repeat the same silhouette on consecutive pages. Route data to chart, processes and relationships to diagram, and covers or editorial scenes to visual.",
    "Each page must have a clear role in one coherent narrative. Avoid repeated generic sections.",
    "Choose and save a page intent from: cover, hero, chart, comparison, process, timeline, architecture, case, dashboard, summary, image.",
    "For every page provide a complete editable content draft, not merely a title and one-sentence outline. Include a subtitle, a short lead, 2-5 substantive key points with an optional heading and body, an optional emphasis quote, a concise narrativeLogic explaining how the page advances the story, speakerNotes, page type, and a concrete visual direction.",
    "CONTENT SOURCE PRIORITY: extract and preserve explicit points from the user's prompt and parsed source material first. If those sources do not provide enough concrete points, proactively author 2-5 plausible, useful, editable draft points for each content page using domain-general knowledge.",
    "AI-authored points may include explanations, frameworks, recommended practices, hypothetical examples, options, and action steps. They must read as proposed presentation copy, not as sourced evidence. Do not leave keyPoints empty merely because the user supplied only a topic.",
    "Keep the content presentation-ready and complete. Proactively generate policy-style wording, dates, quotations, names, customers, research-style findings, outcomes, metrics, and recommendations when they help the narrative. Do not add authenticity checks, source requirements, 待补充 placeholders, or simulated-data labels. User-provided edits override AI-authored content.",
    "Do not create HTML or images in this step.",
    `Write valid JSON to this exact path: ${path.join(job.outputDir, "outline.json")}`,
    "Use exactly this shape: {\"title\":\"deck title\",\"style\":\"visual system summary\",\"designSystem\":{\"primaryColor\":\"#6f4e37\",\"secondaryColor\":\"#efe4d2\",\"backgroundColor\":\"#fffaf3\",\"textColor\":\"#241b16\",\"typography\":\"现代无衬线，标题强对比\",\"shapeLanguage\":\"克制圆角与细线\",\"imageLanguage\":\"温暖自然光、真实场景\",\"chartLanguage\":\"扁平、少网格线、重点色强调\"},\"visualRhythm\":[{\"pageNumber\":1,\"treatment\":\"hero-image\",\"density\":\"low\",\"silhouette\":\"full-bleed\",\"specialistRoute\":\"visual\"}],\"storyline\":{\"path\":\"机会 → 洞察 → 方案 → 行动\",\"tag\":\"商务合作方案\",\"chapters\":[{\"id\":\"chapter-1\",\"title\":\"市场机会\",\"role\":\"背景铺垫\",\"summary\":\"说明为什么现在值得行动\",\"slideNumbers\":[1,2]}]},\"structure\":{\"agendaMode\":\"recommended\",\"sectionMode\":\"recommended\",\"summaryMode\":\"recommended\",\"closingMode\":\"required\",\"pages\":[{\"role\":\"cover\",\"chapterId\":null,\"narrativePurpose\":\"建立第一印象\",\"layoutFamily\":\"title\"}]},\"requirements\":{\"goal\":{\"selected\":\"...\",\"options\":[\"...\"]},\"audience\":{\"selected\":\"...\",\"options\":[\"...\"]},\"scenario\":{\"selected\":\"...\",\"options\":[\"...\"]},\"length\":{\"selected\":\"5\",\"options\":[\"5\",\"8\",\"12\"]}},\"slides\":[{\"title\":\"...\",\"subtitle\":\"...\",\"message\":\"...\",\"lead\":\"...\",\"keyPoints\":[{\"heading\":\"...\",\"body\":\"...\"}],\"quote\":\"...\",\"narrativeLogic\":\"...\",\"speakerNotes\":\"...\",\"type\":\"...\",\"intent\":\"...\",\"visual\":\"...\"}]}",
    "Do not modify repository source code. Do not ask follow-up questions.",
    "",
    "Structured brief:",
    job.presentationReference ? `PowerPoint reference analysis:\n${job.presentationReference}` : "",
    job.prompt
  ].join("\n");
}

async function readGeneratedOutline(job) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(path.join(job.outputDir, "outline.json"), "utf8"));
  } catch {
    throw new Error("AI finished without a valid presentation outline.");
  }
  const slides = normalizeOutline(parsed.slides, job.pageCount);
  if (!slides || slides.length !== job.pageCount) {
    throw new Error(`AI returned ${slides?.length || 0} outline pages; ${job.pageCount} were requested.`);
  }
  const storyline = normalizeStoryline(parsed.storyline, slides);
  return {
    title: String(parsed.title || "AI 幻灯片").trim().slice(0, 120),
    style: String(parsed.style || "").trim().slice(0, 600),
    storyline,
    structure: normalizePageStructure(parsed.structure, slides, storyline),
    designSystem: normalizeDeckDesignSystem(parsed.designSystem, parsed.style),
    visualRhythm: normalizeVisualRhythm(parsed.visualRhythm, slides.length, slides),
    requirements: normalizeOutlineRequirements(parsed.requirements, job.pageCount),
    slides
  };
}

function normalizeDeckDesignSystem(value, fallbackStyle = "") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const color = (key, fallback) => /^#[0-9a-f]{6}$/i.test(String(source[key] || "").trim()) ? String(source[key]).trim().toLowerCase() : fallback;
  const text = (key, fallback) => String(source[key] || fallback).trim().slice(0, 240);
  return {
    primaryColor:color("primaryColor", "#2563eb"), secondaryColor:color("secondaryColor", "#dbeafe"),
    backgroundColor:color("backgroundColor", "#ffffff"), textColor:color("textColor", "#0f172a"),
    typography:text("typography", "现代无衬线，三级字阶，标题高对比"),
    shapeLanguage:text("shapeLanguage", "克制圆角、细线与充足留白"),
    imageLanguage:text("imageLanguage", fallbackStyle || "真实、自然、统一光线与色彩处理"),
    chartLanguage:text("chartLanguage", "扁平可编辑图表，弱化网格线，重点色强调结论")
  };
}

function normalizeVisualRhythm(value, pageCount, slides = []) {
  const treatments = new Set(["hero-image", "chart", "diagram", "comparison", "editorial", "metrics", "minimal"]);
  const densities = new Set(["low", "medium", "high"]);
  const silhouettes = ["full-bleed", "left-visual", "right-visual", "centered", "split", "grid", "timeline"];
  const routes = new Set(["visual", "chart", "diagram", "native"]);
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length:pageCount }, (_, index) => {
    const item = source[index] || {};
    const intent = String(slides[index]?.intent || "");
    const fallbackRoute = intent === "chart" || intent === "dashboard" ? "chart" : ["process","timeline","architecture"].includes(intent) ? "diagram" : ["cover","hero","image","case"].includes(intent) ? "visual" : "native";
    const fallbackTreatment = fallbackRoute === "chart" ? "chart" : fallbackRoute === "diagram" ? "diagram" : fallbackRoute === "visual" ? "hero-image" : index % 3 === 0 ? "editorial" : "minimal";
    let silhouette = silhouettes.includes(item.silhouette) ? item.silhouette : silhouettes[index % silhouettes.length];
    if (index && silhouette === (source[index - 1]?.silhouette || silhouettes[(index - 1) % silhouettes.length])) silhouette = silhouettes[(silhouettes.indexOf(silhouette) + 1) % silhouettes.length];
    return { pageNumber:index + 1, treatment:treatments.has(item.treatment) ? item.treatment : fallbackTreatment, density:densities.has(item.density) ? item.density : index === 0 ? "low" : "medium", silhouette, specialistRoute:routes.has(item.specialistRoute) ? item.specialistRoute : fallbackRoute };
  });
}

function normalizeStoryline(value, slides) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rawChapters = Array.isArray(source.chapters) ? source.chapters : [];
  let chapters = rawChapters.slice(0, 6).map((chapter, index) => ({
    id: String(chapter?.id || `chapter-${index + 1}`).trim().slice(0, 80),
    title: String(chapter?.title || `章节 ${index + 1}`).trim().slice(0, 80),
    role: String(chapter?.role || "内容展开").trim().slice(0, 80),
    summary: String(chapter?.summary || "").trim().slice(0, 300),
    slideNumbers: Array.isArray(chapter?.slideNumbers) ? [...new Set(chapter.slideNumbers.map(Number).filter((number) => Number.isInteger(number) && number >= 1 && number <= slides.length))].slice(0, slides.length) : []
  })).filter((chapter) => chapter.title);
  if (!chapters.length) {
    const chapterCount = Math.max(1, Math.min(4, Math.ceil(slides.length / 3)));
    chapters = Array.from({ length: chapterCount }, (_, index) => {
      const start = Math.floor(index * slides.length / chapterCount);
      const end = Math.floor((index + 1) * slides.length / chapterCount);
      const group = slides.slice(start, end);
      return { id:`chapter-${index + 1}`, title: group[0]?.title || `章节 ${index + 1}`, role: index === 0 ? "背景铺垫" : index === chapterCount - 1 ? "结论行动" : "论据展开", summary: group.map((slide) => slide.message).filter(Boolean).join("；").slice(0, 300), slideNumbers: group.map((_, offset) => start + offset + 1) };
    });
  }
  return {
    path: String(source.path || chapters.map((chapter) => chapter.title).join(" → ")).trim().slice(0, 300),
    tag: String(source.tag || "演示方案").trim().slice(0, 80),
    chapters
  };
}

function normalizePageStructure(value, slides, storyline) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const validRoles = new Set(["cover", "agenda", "section", "content", "summary", "closing"]);
  const validLayouts = new Set(["title", "agenda", "section-header", "title-content", "two-content", "comparison", "summary", "closing"]);
  const pageCount = slides.length;
  const recommendedAgenda = pageCount >= 10;
  const allowStandaloneSections = source.sectionMode === "required";
  const chapterBySlide = new Map();
  storyline.chapters.forEach((chapter) => (chapter.slideNumbers || []).forEach((number) => chapterBySlide.set(number, chapter.id)));
  const requestedPages = Array.isArray(source.pages) ? source.pages : [];
  const pages = slides.map((slide, index) => {
    const requested = requestedPages[index] || {};
    let role = validRoles.has(requested.role) ? requested.role : "content";
    if (role === "section" && !allowStandaloneSections) role = "content";
    if (index === 0) role = "cover";
    else if (index === pageCount - 1) role = "closing";
    else if (!requestedPages.length && recommendedAgenda && index === 1) role = "agenda";
    else if (!requestedPages.length && pageCount >= 12 && index === pageCount - 2) role = "summary";
    const fallbackLayout = { cover:"title", agenda:"agenda", section:"section-header", content:"title-content", summary:"summary", closing:"closing" }[role];
    return {
      id: `page-${index + 1}`,
      order: index + 1,
      role,
      chapterId: typeof requested.chapterId === "string" ? requested.chapterId.slice(0, 80) : chapterBySlide.get(index + 1) || null,
      title: slide.title,
      narrativePurpose: String(requested.narrativePurpose || slide.message || "").trim().slice(0, 300),
      layoutFamily: validLayouts.has(requested.layoutFamily) ? requested.layoutFamily : fallbackLayout
    };
  });
  return {
    agendaMode: ["off", "recommended", "required"].includes(source.agendaMode) ? source.agendaMode : recommendedAgenda ? "recommended" : "off",
    sectionMode: allowStandaloneSections ? "required" : "off",
    summaryMode: ["off", "recommended", "required"].includes(source.summaryMode) ? source.summaryMode : pageCount >= 12 ? "recommended" : "off",
    closingMode: "required",
    pages
  };
}

function normalizeOutlineRequirements(value, pageCount) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalizeGroup = (group, fallback = "") => {
    const selected = String(group?.selected || fallback).trim().slice(0, 180);
    const options = Array.isArray(group?.options)
      ? group.options.map((item) => String(item || "").trim().slice(0, 180)).filter(Boolean).slice(0, 6)
      : [];
    if (selected && !options.includes(selected)) options.unshift(selected);
    return { selected, options:[...new Set(options)].slice(0, 6) };
  };
  return {
    goal: normalizeGroup(value.goal),
    audience: normalizeGroup(value.audience),
    scenario: normalizeGroup(value.scenario),
    length: normalizeGroup(value.length, String(pageCount))
  };
}

export function normalizeOutline(value, expectedCount) {
  if (!Array.isArray(value)) return null;
  const validRoles = new Set(["cover", "agenda", "section", "content", "summary", "closing"]);
  const slides = value.slice(0, maxSlides).map((item, index, source) => {
    const role = validRoles.has(item?.role) ? item.role : index === 0 ? "cover" : index === source.length - 1 ? "closing" : "content";
    const intentSource = role === "cover" ? { ...item, intent:"cover" } : ["summary", "closing", "agenda"].includes(role) ? { ...item, intent:"summary" } : item;
    return {
      title: String(item?.title || `幻灯片 ${index + 1}`).trim().slice(0, 120),
      subtitle: String(item?.subtitle || "").trim().slice(0, 240),
      message: String(item?.message || "").trim().slice(0, 600),
      lead: String(item?.lead || "").trim().slice(0, 800),
      keyPoints: Array.isArray(item?.keyPoints) ? item.keyPoints.slice(0, 6).map((point) => typeof point === "string" ? { heading:"", body:String(point).trim().slice(0, 600) } : { heading:String(point?.heading || "").trim().slice(0, 120), body:String(point?.body || "").trim().slice(0, 600) }).filter((point) => point.heading || point.body) : [],
      quote: String(item?.quote || "").trim().slice(0, 500),
      narrativeLogic: String(item?.narrativeLogic || "").trim().slice(0, 600),
      speakerNotes: String(item?.speakerNotes || "").trim().slice(0, 1200),
      type: String(item?.type || "insight").trim().slice(0, 40),
      intent: inferSlideIntent(intentSource, index, source.length),
      role,
      chapterId: typeof item?.chapterId === "string" ? item.chapterId.trim().slice(0, 80) : null,
      layoutFamily: String(item?.layoutFamily || "").trim().slice(0, 80),
      treatment: String(item?.treatment || "").trim().slice(0, 40),
      density: String(item?.density || "").trim().slice(0, 20),
      silhouette: String(item?.silhouette || "").trim().slice(0, 40),
      specialistRoute: String(item?.specialistRoute || "").trim().slice(0, 20),
      visual: String(item?.visual || "").trim().slice(0, 600),
      presetId: inferPresetFromOutline([
        item?.title, item?.message, item?.visual,
        ...(Array.isArray(item?.keyPoints) ? item.keyPoints.map((point) => typeof point === "string" ? point : `${point?.heading || ""} ${point?.body || ""}`) : [])
      ].filter(Boolean).join(" "))
    };
  });
  if (!slides.length || (expectedCount && slides.length !== expectedCount)) return null;
  return slides;
}

async function writeReferences(jobDir, references) {
  const list = Array.isArray(references) ? references.slice(0, 4) : [];
  const paths = [];
  const presentationContexts = [];
  for (let index = 0; index < list.length; index += 1) {
    const reference = typeof list[index] === "string" ? { kind:"image", dataUrl:list[index], name:`reference-${index + 1}` } : list[index] || {};
    const source = String(reference.dataUrl || "");
    const pptxMatch = /^data:application\/(?:vnd\.openxmlformats-officedocument\.presentationml\.presentation|octet-stream);base64,([A-Za-z0-9+/=]+)$/.exec(source);
    if (reference.kind === "pptx" && pptxMatch) {
      const inspected = await inspectPptxReference(Buffer.from(pptxMatch[1], "base64"), jobDir, reference.name);
      presentationContexts.push(inspected.context);
      for (const mediaPath of inspected.mediaPaths) if (paths.length < 4) paths.push(mediaPath);
      continue;
    }
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(source);
    if (!match) continue;
    const extension = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > 3 * 1024 * 1024) continue;
    const target = path.join(jobDir, `reference-${index + 1}.${extension}`);
    await fs.writeFile(target, buffer);
    paths.push(target);
  }
  return { imagePaths:paths.slice(0, 4), presentationContext:presentationContexts.join("\n\n").slice(0, 60_000) };
}

async function readGeneratedSlides(job, options = {}) {
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(job.outputDir, "manifest.json"), "utf8"));
  } catch {
    throw new Error("AI finished without a valid slide manifest.");
  }
  if (!Array.isArray(manifest.slides) || manifest.slides.length !== job.pageCount) {
    throw new Error(`AI returned ${manifest.slides?.length || 0} slides; ${job.pageCount} were requested.`);
  }
  const slides = [];
  for (const [index, entry] of manifest.slides.entries()) {
    const filename = path.basename(String(entry?.file || ""));
    if (!/^slide-\d{2}\.(?:json|html)$/i.test(filename)) throw new Error(`Slide ${index + 1} has an invalid filename.`);
    const filePath = path.join(job.outputDir, filename);
    const stat = await fs.stat(filePath);
    if (stat.size < 100 || stat.size > maxHtmlBytes) throw new Error(`Slide ${index + 1} has an invalid file size.`);
    const source = await fs.readFile(filePath, "utf8");
    if (/\.json$/i.test(filename)) {
      let frame;
      try { frame = JSON.parse(source); } catch { throw new Error(`Slide ${index + 1} is not valid Frame JSON.`); }
      if (!Array.isArray(frame.elements) || !frame.elements.length) throw new Error(`Slide ${index + 1} has no structured elements.`);
      frame = flattenFrameElementsForEditing(normalizeFrameHierarchyCoordinates(applyDeterministicLayout(frame, { index, count:job.pageCount, preserveCoordinates:Boolean(job.presentationReference) })));
      validatePreLayout(frame);
      frame.elements = frame.elements.map((element) => element?.type === "chart"
        ? { ...element, ...renderSlideChart(element.chart, { width:element.width, height:element.height }) }
        : element);
      if (!frame.generationFailed && !options.skipQualityValidation) {
        validateGeneratedFrame(frame, index);
        if (!job.presentationReference && frame.elements.some((element) => String(element?.slot || "").trim())) validatePostLayout(frame);
      }
      slides.push({
        type: "slide-frame",
        title: String(frame.title || entry.title || `幻灯片 ${index + 1}`).trim().slice(0, 100),
        role:job.requestedOutline?.[index]?.role || frame.role || "content",
        chapterId:job.requestedOutline?.[index]?.chapterId || frame.chapterId || null,
        layoutFamily:job.requestedOutline?.[index]?.layoutFamily || frame.layoutFamily || "title-content",
        intent:frame.intent, archetype:frame.archetype, skillRoute:frame.skillRoute, layoutSpec:frame.layoutSpec, coordinateSpace:frame.coordinateSpace,
        templateId: String(frame.templateId || "freeform").trim().slice(0, 120),
        background: String(frame.background || "#ffffff").trim().slice(0, 300),
        elements: frame.elements,
        generationFailed:Boolean(frame.generationFailed), generationError:String(frame.generationError || "").slice(0, 1000)
      });
    } else {
      if (!/<html[\s>]/i.test(source) || !/<body[\s>]/i.test(source)) throw new Error(`Slide ${index + 1} is not a complete HTML document.`);
      if (hasExternalResource(source)) throw new Error(`Slide ${index + 1} contains an external resource.`);
      slides.push({ type: "html", title: String(entry.title || `幻灯片 ${index + 1}`).trim().slice(0, 100), html: source });
    }
  }
  if (job.presentationReference) {
    const unmapped = slides
      .map((slide, index) => slide.generationFailed || /^pptx-ref-\d+$/i.test(String(slide.templateId || "")) ? null : index + 1)
      .filter(Boolean);
    if (unmapped.length) throw new Error(`PPTX reference mapping is missing on slides ${unmapped.join(", ")}; set templateId to pptx-ref-N and rebuild those pages from the mapped source composition.`);
  }
  return slides;
}

function validateDeckVisualVariety(slides) {
  const activeSlides = slides.filter((slide) => !slide.generationFailed);
  if (!activeSlides.length) return;
  const frames = activeSlides.filter((slide) => slide.type === "slide-frame");
  if (frames.length !== activeSlides.length) throw new Error("All newly generated slides must use structured Frame JSON.");
  const signatures = frames.map((slide) => {
    const elements = slide.elements || [];
    const dominant = elements
      .filter((element) => ["image", "svg", "chart", "shape", "group"].includes(element.type))
      .sort((a,b) => (Number(b.width) || 0) * (Number(b.height) || 0) - (Number(a.width) || 0) * (Number(a.height) || 0))[0];
    const centerX = dominant ? (Number(dominant.x) || 0) + (Number(dominant.width) || 0) / 2 : 512;
    const zone = centerX < 410 ? "left" : centerX > 614 ? "right" : "center";
    const imageCount = elements.filter((element) => element.type === "image").length;
    const groupCount = elements.filter((element) => element.type === "group").length;
    return `${slide.templateId}:${zone}:i${Math.min(imageCount,3)}:g${Math.min(groupCount,3)}`;
  });
  for (let index = 1; index < signatures.length; index += 1) {
    if (signatures[index] === signatures[index - 1]) {
      throw new Error(`Slides ${index} and ${index + 1} repeat the same visual silhouette; revise one composition.`);
    }
  }
  const counts = new Map();
  for (const signature of signatures) counts.set(signature, (counts.get(signature) || 0) + 1);
  if ([...counts.values()].some((count) => count > Math.max(2, Math.ceil(frames.length / 3)))) {
    throw new Error("The deck repeats one visual composition too often; increase cross-slide layout variety.");
  }
  const usedBitmapTokens = frames.flatMap((slide) => slide.elements
    .filter((element) => element.type === "image" && String(element.src || "").startsWith("asset://"))
    .map((element) => String(element.src)));
  const uniqueTokens = new Set(usedBitmapTokens);
  const budget = visualAssetBudget(frames.length);
  if (uniqueTokens.size < budget.min) throw new Error(`The deck needs at least ${budget.min} distinct bitmap visual concepts.`);
}

function validateReferenceTemplateQuality(slides) {
  const frames = slides.filter((slide) => slide.type === "slide-frame" && !slide.generationFailed);
  for (const [index, frame] of frames.entries()) {
    const elements = frame.elements || [];
    const textElements = elements.filter((element) => element.type === "text" && String(element.text || "").trim());
    const displayTitle = textElements.reduce((largest, element) => Math.max(largest, Number.parseFloat(element.style?.fontSize) || 0), 0);
    const meaningfulVisualArea = elements
      .filter((element) => ["image", "svg", "chart"].includes(element.type))
      .reduce((largest, element) => Math.max(largest, (Number(element.width) || 0) * (Number(element.height) || 0)), 0);
    const decorativeDepth = elements.filter((element) => {
      if (!["shape", "svg"].includes(element.type) || element.parentId) return false;
      const area = (Number(element.width) || 0) * (Number(element.height) || 0);
      return element.layoutLocked === true || area > 36_000;
    }).length;
    const role = String(frame.role || frame.templateId || frame.intent || "").toLowerCase();
    if (/cover|section|closing|summary/.test(role) && displayTitle < 40) {
      throw new Error(`Slide ${index + 1} reference-driven title hierarchy is too weak; use a display title of at least 40px.`);
    }
    if (/cover|section/.test(role) && meaningfulVisualArea < 105_000) {
      throw new Error(`Slide ${index + 1} does not match the reference family's dominant hero composition.`);
    }
    if (!meaningfulVisualArea && decorativeDepth < 2) {
      throw new Error(`Slide ${index + 1} is visually flat compared with the supplied references; add a meaningful diagram or layered native depth.`);
    }
  }
}

const MATERIAL_DATA_PATTERN = /(\d[\d,.]*)\s*(?:%|pp|个百分点|万|亿|万元|亿元|元|美元|USD|CNY|RMB|kbps|mbps|gb|吨|度|千瓦时)/i;
const SOURCE_PATTERN = /来源|source|数据来源|出处|统计自|据.{0,12}(报告|调研|研究)|引自|参考自|数据[:：]|资料[:：]/i;

export function collectDataAccuracyIssues(elements, index = 0) {
  const issues = [];
  const texts = elements.filter((element) => element?.type === "text").map((element) => String(element.text || ""));
  const combinedText = texts.join(" ");
  const charts = elements.filter((element) => element?.type === "chart");
  const hasSuppliedChart = charts.some((element) => String(element.chart?.dataMode || "").toLowerCase() === "supplied");
  const hasSource = SOURCE_PATTERN.test(combinedText);
  const hasMaterialData = MATERIAL_DATA_PATTERN.test(combinedText) || hasSuppliedChart;
  if (hasMaterialData && hasSuppliedChart && !hasSource) {
    issues.push({ id:"key-data-without-source", severity:"warning", message:`Slide ${index + 1} contains material data without a visible source attribution.` });
  }
  return issues;
}

export function validateSimulatedDataDisclosure(elements, index = 0) {
  return collectDataAccuracyIssues(elements, index);
}

function validateGeneratedFrame(frame, index) {
  const elements = frame.elements;
  const ids = new Set();
  const removableGlyphIds = new Set();
  for (const element of elements) {
    const id = String(element?.id || "").trim();
    if (!id || ids.has(id)) throw new Error(`Slide ${index + 1} contains duplicate or missing element ids.`);
    ids.add(id);
    const x = Number(element.x) || 0;
    const y = Number(element.y) || 0;
    const width = Number(element.width) || 0;
    const height = Number(element.height) || 0;
    if (width < 1 || height < 1 || x < 0 || y < 0 || x + width > 1024 || y + height > 576) {
      throw new Error(`Slide ${index + 1} contains an element outside the 1024×576 frame.`);
    }
    if (element.type === "text") {
      const text = String(element.text || "").trim();
      const symbolOnlyDecoration = text.length > 0
        && text.replace(/\s/gu, "").length <= 8
        && /^[★☆✦✧✶✳✴❖◆◇▶►➜→←↑↓\s]+$/u.test(text);
      if (symbolOnlyDecoration) {
        removableGlyphIds.add(id);
        continue;
      }
    }
    if (element.type === "image") {
      const style = element.style ||= {};
      if (!["cover", "contain", "scale-down"].includes(String(style.objectFit || ""))) style.objectFit = "cover";
      if (!String(style.objectPosition || "").trim()) style.objectPosition = "50% 50%";
    }
    if (element.type === "svg" && !/^data:image\/svg\+xml(?:;charset=[^;,]+)?(?:;base64)?,/i.test(String(element.src || ""))) {
      throw new Error(`Slide ${index + 1} contains an invalid SVG asset.`);
    }
  }
  validateSimulatedDataDisclosure(elements, index);
  if (removableGlyphIds.size) {
    frame.elements = elements.filter((element) => !removableGlyphIds.has(String(element?.id || "").trim()));
  }
}

function hasExternalResource(html) {
  return /\b(?:src|href)\s*=\s*["']\s*(?:https?:|file:|ftp:)/i.test(html)
    || /\burl\(\s*["']?\s*(?:https?:|file:|ftp:)/i.test(html)
    || /\b(?:fetch|importScripts)\s*\(\s*["']\s*(?:https?:|file:|ftp:)/i.test(html);
}

async function importSlides(job, slides) {
  const storeOptions = { canvasId: job.canvasId };
  const state = await readState(job.projectDir, storeOptions);
  const deck = state.objects.find((object) => object.id === job.deckId && object.type === "slides");
  if (!deck) throw new Error("The slide deck was removed before generation finished.");
  const existingIds = Array.isArray(deck.slideIds) ? deck.slideIds.filter((id) => state.objects.some((object) => object.id === id)) : [];
  const replacementIndex = job.targetSlideId ? existingIds.indexOf(job.targetSlideId) : -1;
  if (job.targetSlideId && replacementIndex < 0) throw new Error("The slide selected for regeneration no longer exists in this deck.");
  const created = [];
  try {
    for (const [index, slide] of slides.entries()) {
      const pageIssues = slide.generationFailed ? [{ id:"generation-failed", severity:"error", message:slide.generationError || `Slide ${index + 1} generation failed after two repair attempts.` }] : slide.type === "slide-frame" ? [
        ...collectLayoutIssues({ elements:slide.elements || [], background:slide.background }),
        ...collectDataAccuracyIssues(slide.elements || [], index)
      ] : [];
      const qualityStatus = pageIssues.some((issue) => issue.severity === "error") ? "error" : pageIssues.some((issue) => issue.severity === "warning") ? "warning" : "passed";
      created.push(await addObject(job.projectDir, {
        type: slide.type || "slide-frame", name: slide.title, x: deck.x + 12 + (existingIds.length + index) * 1056,
        y: deck.y + 12, width: 1024, height: 576,
        ...(slide.type === "html" ? { html: slide.html } : { intent:slide.intent, archetype:slide.archetype, role:slide.role, chapterId:slide.chapterId, layoutFamily:slide.layoutFamily, skillRoute:slide.skillRoute, layoutSpec:slide.layoutSpec, coordinateSpace:slide.coordinateSpace || "parent-local", templateId: slide.templateId, background: slide.background, elements: slide.elements, generationFailed:Boolean(slide.generationFailed), generationError:slide.generationError || null, qualityStatus, qualityIssues:pageIssues.slice(0, 12) })
      }, storeOptions));
    }
    const combinedIds = replacementIndex >= 0
      ? existingIds.flatMap((id, index) => index === replacementIndex ? created.map((object) => object.id) : [id])
      : [...existingIds, ...created.map((object) => object.id)];
    await updateObjects(job.projectDir, [
      { id: deck.id, patch: { slideIds: combinedIds } },
      ...combinedIds.map((id, slideOrder) => ({ id, patch: { slideDeckId: deck.id, slideOrder } }))
    ], { ...storeOptions, selection: null });
    if (replacementIndex >= 0) await deleteObjects(job.projectDir, [job.targetSlideId], storeOptions);
    return created.map((object, index) => ({ id: object.id, title: slides[index].title }));
  } catch (error) {
    if (created.length) await deleteObjects(job.projectDir, created.map((object) => object.id), storeOptions).catch(() => {});
    throw error;
  }
}

async function appendSlidesJobLog(job, message) {
  try {
    await fs.appendFile(job.logPath, `[codex-canvas] ${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging should not affect slide job completion.
  }
}

async function restoreChangedProtectedFiles(protectedFiles) {
  for (const [filePath, content] of protectedFiles) {
    const current = await fs.readFile(filePath).catch(() => null);
    if (!current || !current.equals(content)) await fs.writeFile(filePath, content);
  }
}

function formatDuration(durationMs) {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function activeSlidesElapsedMs(job, nowMs = Date.now()) {
  const startedAtMs = Date.parse(job.startedAt || job.createdAt);
  if (!Number.isFinite(startedAtMs)) return 0;
  const accumulatedPausedMs = Math.max(0, Number(job.accumulatedPausedMs) || 0);
  const currentPauseMs = job.pauseStartedAt ? Math.max(0, nowMs - Date.parse(job.pauseStartedAt)) : 0;
  return Math.max(0, nowMs - startedAtMs - accumulatedPausedMs - currentPauseMs);
}

// Estimate slide generation progress as a percentage and ETA (seconds).
// Slide generation has explicit stages plus page-level readiness from
// job.pages, so progress can be more precise than image jobs.
function computeSlidesProgress(job, extra = {}) {
  const elapsedMs = activeSlidesElapsedMs(job);
  const effectiveStage = job.stage === "paused" ? (job.resumeStage || "generating") : job.stage;
  let percent;
  if (job.status === "done") percent = 100;
  else if (job.status === "failed" || job.status === "cancelled") percent = null;
  else if (effectiveStage === "planning") percent = 5;
  else if (effectiveStage === "optimizing-brief") percent = 35;
  else if (effectiveStage === "generating") {
    const readyCount = job.pages?.filter((page) => page.status === "ready" || page.status === "done" || page.status === "failed").length || 0;
    const total = Math.max(1, job.pageCount || job.pages?.length || 1);
    percent = 10 + (readyCount / total) * 50; // 10% -> 60%
  } else if (effectiveStage === "validating") percent = 60;
  else if (effectiveStage === "revising") percent = 62;
  else if (effectiveStage === "illustrating") {
    const visualIndex = Number(extra.visualIndex ?? job.visualIndex) || 0;
    const visualTotal = Math.max(1, Number(extra.visualTotal ?? job.visualTotal) || 1);
    percent = 65 + Math.min(1, visualIndex / visualTotal) * 23; // 65% -> 88%
  } else if (effectiveStage === "final-repair") percent = 90;
  else if (effectiveStage === "final-review") percent = 92;
  else if (effectiveStage === "importing") percent = 95;
  else percent = 50;
  const readyCount = job.pages?.filter((page) => page.status === "ready" || page.status === "done" || page.status === "failed").length || 0;
  const hasProgressSample = effectiveStage !== "generating" || readyCount > 0;
  const etaSeconds = percent == null || percent >= 100 || !hasProgressSample
    ? 0
    : Math.max(0, Math.round((elapsedMs / Math.max(1, percent)) * (100 - percent) / 1000));
  return { percent: percent == null ? null : Math.round(percent), etaSeconds };
}

async function logSlidesProgress(job, message, extra = {}) {
  const { percent, etaSeconds } = computeSlidesProgress(job, extra);
  if (percent == null) return;
  await appendSlidesJobLog(job, `Progress ${percent}% | ETA ${formatDuration(etaSeconds * 1000)} | ${message}`);
  await persistSlidesJob(job);
}
