export const SLIDE_INTENTS = Object.freeze(["cover", "hero", "chart", "comparison", "process", "timeline", "architecture", "case", "dashboard", "summary", "image"]);
export const SLIDE_ARCHETYPES = Object.freeze(["cover-hero", "hero-left", "hero-right", "split-50", "split-40-60", "three-columns", "four-metrics", "comparison", "timeline", "process", "architecture", "dashboard", "case-study", "summary"]);

const intentSet = new Set(SLIDE_INTENTS);
const archetypeSet = new Set(SLIDE_ARCHETYPES);
const W = 1024, H = 576, SAFE = 64, GAP = 24, INNER_W = W - SAFE * 2, INNER_H = H - SAFE * 2;
const box = (x, y, width, height) => ({ x, y, width, height });
const common = {
  title:box(SAFE, SAFE, INNER_W, 56), subtitle:box(SAFE, 128, INNER_W, 40),
  content:box(SAFE, 184, INNER_W, 328), visual:box(512, 184, 448, 328), footer:box(SAFE, 528, INNER_W, 24)
};

export const SLIDE_LAYOUTS = Object.freeze({
  "cover-hero":{ ...common, title:box(SAFE, 112, 500, 144), subtitle:box(SAFE, 272, 460, 48), visual:box(594, SAFE, 366, 448), content:box(SAFE, 336, 500, 136) },
  "hero-left":{ ...common, title:box(500, 88, 460, 72), subtitle:box(500, 176, 460, 40), content:box(500, 232, 460, 248), visual:box(SAFE, 88, 400, 392) },
  "hero-right":{ ...common, title:box(SAFE, 88, 460, 72), subtitle:box(SAFE, 176, 460, 40), content:box(SAFE, 232, 460, 248), visual:box(560, 88, 400, 392) },
  "split-50":{ ...common, left:box(SAFE, 184, 436, 328), right:box(524, 184, 436, 328), content:box(SAFE, 184, 436, 328), visual:box(524, 184, 436, 328) },
  "split-40-60":{ ...common, left:box(SAFE, 184, 346, 328), right:box(434, 184, 526, 328), content:box(SAFE, 184, 346, 328), visual:box(434, 184, 526, 328) },
  "three-columns":{ ...common, col1:box(SAFE, 176, 282, 320), col2:box(371, 176, 282, 320), col3:box(678, 176, 282, 320) },
  "four-metrics":{ ...common, metric1:box(SAFE, 184, 206, 248), metric2:box(294, 184, 206, 248), metric3:box(524, 184, 206, 248), metric4:box(754, 184, 206, 248) },
  comparison:{ ...common, left:box(SAFE, 184, 424, 312), right:box(536, 184, 424, 312) },
  timeline:{ ...common, content:box(SAFE, 184, INNER_W, 280), visual:box(SAFE, 184, INNER_W, 280) },
  process:{ ...common, content:box(SAFE, 184, INNER_W, 304), visual:box(SAFE, 184, INNER_W, 304) },
  architecture:{ ...common, content:box(SAFE, 184, INNER_W, 328), visual:box(SAFE, 184, INNER_W, 328) },
  dashboard:{ ...common, content:box(SAFE, 184, INNER_W, 328), visual:box(SAFE, 184, INNER_W, 328) },
  "case-study":{ ...common, title:box(SAFE, 72, 424, 64), subtitle:box(SAFE, 152, 424, 40), content:box(SAFE, 208, 424, 288), visual:box(536, 72, 424, 424) },
  summary:{ ...common, title:box(SAFE, 88, INNER_W, 72), subtitle:box(SAFE, 176, INNER_W, 40), content:box(140, 232, 744, 264), visual:box(140, 232, 744, 264) }
});

function textOf(page = {}) { return `${page.type || ""} ${page.title || ""} ${page.message || ""} ${page.visual || ""}`.toLowerCase(); }

export const INTENT_RULES = Object.freeze([
  { intent:"cover", match:/\bcover\b|封面/, positional:"first" },
  { intent:"summary", match:/\bsummary\b|总结|结论/, positional:"last" },
  { intent:"dashboard", match:/dashboard|仪表盘|大屏/ },
  { intent:"architecture", match:/architecture|架构|系统图/ },
  { intent:"timeline", match:/timeline|roadmap|时间线|里程碑/ },
  { intent:"process", match:/process|流程|步骤|路径/ },
  { intent:"comparison", match:/comparison|对比|比较|vs\.?/ },
  { intent:"chart", match:/chart|data|趋势|占比|数据|指标/ },
  { intent:"case", match:/case|案例/ },
  { intent:"image", match:/image|photo|图片|照片|主视觉/ },
  { intent:"hero", match:null }
]);

export function inferSlideIntent(page = {}, index = 0, count = 1) {
  const explicit = String(page.intent || page.type || "").toLowerCase();
  if (intentSet.has(explicit)) return explicit;
  const text = textOf(page);
  for (const rule of INTENT_RULES) {
    if (!rule.match) continue;
    const positional = (rule.positional === "first" && index === 0) || (rule.positional === "last" && index === count - 1);
    if (positional || rule.match.test(text)) return rule.intent;
  }
  return "hero";
}

export function skillRouteForIntent(intent) {
  if (intent === "chart") return "echarts";
  if (["process", "timeline", "architecture"].includes(intent)) return "svg-diagram";
  if (["cover", "hero"].includes(intent)) return "art-direction-imagegen";
  if (intent === "dashboard") return "data-viz";
  if (intent === "image") return "image-crop-focal-point";
  return "layout";
}

export function archetypeForIntent(intent, preferred = "") {
  if (archetypeSet.has(preferred)) return preferred;
  return ({ cover:"cover-hero", hero:"hero-right", chart:"split-40-60", comparison:"comparison", process:"process", timeline:"timeline", architecture:"architecture", case:"case-study", dashboard:"dashboard", summary:"summary", image:"hero-left" })[intent] || "split-50";
}

function inferredSlot(element, index, archetype) {
  const explicit = String(element?.slot || "");
  const isVisual = ["image", "svg", "chart"].includes(element?.type);
  if (isVisual && explicit === "content" && SLIDE_LAYOUTS[archetype]?.visual) {
    const content = SLIDE_LAYOUTS[archetype].content;
    const visual = SLIDE_LAYOUTS[archetype].visual;
    if (content && (content.x !== visual.x || content.y !== visual.y || content.width !== visual.width || content.height !== visual.height)) return "visual";
  }
  if (SLIDE_LAYOUTS[archetype]?.[explicit]) return explicit;
  if (element?.type === "text") return index === 0 ? "title" : index === 1 ? "subtitle" : "content";
  if (isVisual) return "visual";
  return "content";
}

function resolveTextOverlaps(elements) {
  const textEls = elements
    .filter((el) => el.type === "text" && !el.parentId)
    .map((el) => ({ el, id: el.id, x: Number(el.x) || 0, y: Number(el.y) || 0, w: Math.max(1, Number(el.width) || 1), h: Math.max(1, Number(el.height) || 1) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 0; i < textEls.length; i++) {
    for (let j = i + 1; j < textEls.length; j++) {
      const a = textEls[i];
      const b = textEls[j];
      const hOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const minW = Math.min(a.w, b.w);
      if (minW > 0 && hOverlap / minW < 0.25) continue;
      const vOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      if (vOverlap <= 0) continue;
      const pushAmount = vOverlap + GAP;
      b.y += pushAmount;
      const targetEl = elements.find((e) => e.id === b.id);
      if (targetEl) targetEl.y = b.y;
    }
  }
  for (const t of textEls) {
    const maxY = H - SAFE - t.h;
    if (t.y > maxY) {
      t.y = maxY;
      const targetEl = elements.find((e) => e.id === t.id);
      if (targetEl) targetEl.y = t.y;
    }
    if (t.y < SAFE) {
      t.y = SAFE;
      const targetEl = elements.find((e) => e.id === t.id);
      if (targetEl) targetEl.y = t.y;
    }
  }
}

export function applyDeterministicLayout(frame, { index = 0, count = 1, preserveCoordinates = false } = {}) {
  const intent = inferSlideIntent(frame, index, count);
  const archetype = archetypeForIntent(intent, String(frame.archetype || frame.layoutSpec?.archetype || ""));
  const slots = SLIDE_LAYOUTS[archetype];
  const sourceElements = frame.elements || [];
  const hasExplicitSlots = sourceElements.some((element) => String(element?.slot || "").trim());
  const inferredSlots = sourceElements.map((element, elementIndex) => inferredSlot(element, elementIndex, archetype));
  const slotOwner = new Map();
  for (const [elementIndex, slot] of inferredSlots.entries()) {
    if (!slotOwner.has(slot) || slot === "footer") slotOwner.set(slot, elementIndex);
  }
  const elements = sourceElements.map((element, elementIndex) => {
    const slot = inferredSlots[elementIndex];
    const target = slots[slot] || slots.content;
    const repeatedSlot = slotOwner.get(slot) !== elementIndex;
    const hasAbsoluteGeometry = [element.x, element.y, element.width, element.height].every((value) => Number.isFinite(Number(value)))
      && Number(element.width) > 0 && Number(element.height) > 0;
    const isExplicitFreeLayer = element.positionMode === "free" && hasAbsoluteGeometry;
    if (preserveCoordinates || !hasExplicitSlots || isExplicitFreeLayer || repeatedSlot || element.parentId || element.layoutLocked === true) return { ...element, slot };
    return { ...element, slot, ...target };
  });
  resolveTextOverlaps(elements);
  return { ...frame, intent, archetype, skillRoute:skillRouteForIntent(intent), layoutSpec:{ canvas:"16:9", width:W, height:H, safeArea:SAFE, columns:12, gap:GAP, archetype }, elements };
}

export function normalizeFrameHierarchyCoordinates(frame) {
  if (frame.coordinateSpace === "parent-local") return { ...frame, elements:(frame.elements || []).map((element) => ({ ...element })) };
  const elements = (frame.elements || []).map((element) => ({ ...element }));
  const models = new Map(elements.map((element) => [element.id, element]));
  const absoluteCache = new Map();
  const sourceAbsolutePosition = (element, trail = new Set()) => {
    if (!element || trail.has(element.id)) return { x:Number(element?.x) || 0, y:Number(element?.y) || 0 };
    if (absoluteCache.has(element.id)) return absoluteCache.get(element.id);
    const parent = models.get(element.parentId);
    if (!parent) {
      const position = { x:Number(element.x) || 0, y:Number(element.y) || 0 };
      absoluteCache.set(element.id, position);
      return position;
    }
    const parentPosition = sourceAbsolutePosition(parent, new Set(trail).add(element.id));
    const x = Number(element.x) || 0, y = Number(element.y) || 0;
    const width = Math.max(1, Number(element.width) || 1), height = Math.max(1, Number(element.height) || 1);
    const parentWidth = Math.max(1, Number(parent.width) || 1), parentHeight = Math.max(1, Number(parent.height) || 1);
    const looksAbsolute = x >= parentPosition.x - 1 && y >= parentPosition.y - 1
      && x + width <= parentPosition.x + parentWidth + 1
      && y + height <= parentPosition.y + parentHeight + 1;
    const position = looksAbsolute ? { x, y } : { x:parentPosition.x + x, y:parentPosition.y + y };
    absoluteCache.set(element.id, position);
    return position;
  };
  for (const element of elements) sourceAbsolutePosition(element);
  const normalizedElements = elements.map((element) => {
    const parent = models.get(element.parentId);
    if (!parent) return element;
    const absolute = absoluteCache.get(element.id);
    const parentAbsolute = absoluteCache.get(parent.id);
    return { ...element, x:absolute.x - parentAbsolute.x, y:absolute.y - parentAbsolute.y };
  });
  for (const element of normalizedElements) {
    const mode = element.layout?.mode;
    if (!["row", "column", "grid"].includes(mode)) continue;
    const children = normalizedElements.filter((child) => child.parentId === element.id);
    if (children.length < 2 || children.some((child) => child.positionMode === "free")) continue;
    const gap = Math.max(0, Number.parseFloat(element.layout?.gap) || 0);
    const padding = Math.max(0, Number.parseFloat(element.layout?.padding) || 0);
    const required = mode === "row"
      ? children.reduce((sum, child) => sum + Math.max(1, Number(child.width) || 1), 0) + gap * (children.length - 1) + padding * 2
      : mode === "column"
        ? children.reduce((sum, child) => sum + Math.max(1, Number(child.height) || 1), 0) + gap * (children.length - 1) + padding * 2
        : 0;
    const available = mode === "row" ? Number(element.width) || 0 : Number(element.height) || 0;
    if ((mode !== "grid" && required > available + 2) || (mode === "grid" && children.some((child) => Number(child.width) > Number(element.width) || Number(child.height) > Number(element.height)))) {
      element.layout = { ...element.layout, mode:"free" };
    }
  }
  return {
    ...frame,
    coordinateSpace:"parent-local",
    elements:normalizedElements
  };
}

export function flattenFrameElementsForEditing(frame) {
  const source = (frame.elements || []).map((element) => ({ ...element, style:{ ...(element.style || {}) }, layout:{ ...(element.layout || {}) } }));
  const models = new Map(source.map((element) => [element.id, element]));
  const absoluteCache = new Map();
  const absolutePosition = (element, trail = new Set()) => {
    if (!element || trail.has(element.id)) return { x:Number(element?.x) || 0, y:Number(element?.y) || 0 };
    if (absoluteCache.has(element.id)) return absoluteCache.get(element.id);
    const parent = models.get(element.parentId);
    const local = { x:Number(element.x) || 0, y:Number(element.y) || 0 };
    const position = parent ? (() => { const base=absolutePosition(parent, new Set(trail).add(element.id)); return { x:base.x + local.x, y:base.y + local.y }; })() : local;
    absoluteCache.set(element.id, position); return position;
  };
  source.forEach((element) => absolutePosition(element));
  const childrenByParent = new Map();
  for (const element of source) if (element.parentId) childrenByParent.set(element.parentId, [...(childrenByParent.get(element.parentId) || []), element]);
  const inheritedMasks = new Map();
  for (const group of source.filter((element) => element.type === "group")) {
    const children = childrenByParent.get(group.id) || [];
    if (children.length === 1 && children[0].type === "image") inheritedMasks.set(children[0].id, { clipPath:group.style?.clipPath || "", borderRadius:group.style?.borderRadius || "" });
  }
  const flattened = [];
  for (const element of source) {
    const position = absoluteCache.get(element.id) || { x:Number(element.x) || 0, y:Number(element.y) || 0 };
    if (element.type === "group") {
      const style = element.style || {};
      const hasVisibleSurface = Boolean(String(style.background || "").trim() || String(style.border || "").trim() || String(style.boxShadow || "").trim());
      if (!hasVisibleSurface) continue;
      flattened.push({ ...element, type:"shape", parentId:null, positionMode:"free", x:position.x, y:position.y, layout:{ ...element.layout, mode:"free" } });
      continue;
    }
    const inheritedMask = inheritedMasks.get(element.id);
    const style = inheritedMask ? { ...element.style, ...(inheritedMask.clipPath && !element.style?.clipPath ? { clipPath:inheritedMask.clipPath } : {}), ...(inheritedMask.borderRadius && !element.style?.borderRadius ? { borderRadius:inheritedMask.borderRadius } : {}) } : element.style;
    flattened.push({ ...element, style, parentId:null, positionMode:"free", x:position.x, y:position.y, layout:{ ...element.layout, mode:"free" } });
  }
  return { ...frame, coordinateSpace:"parent-local", elements:flattened };
}

export function validatePreLayout(frame) {
  if (!intentSet.has(frame.intent)) throw new Error(`Unknown slide intent: ${frame.intent}`);
  if (!archetypeSet.has(frame.archetype)) throw new Error(`Unknown slide archetype: ${frame.archetype}`);
  if (frame.skillRoute !== skillRouteForIntent(frame.intent)) throw new Error(`Intent ${frame.intent} must route through ${skillRouteForIntent(frame.intent)}.`);
  if (frame.intent === "chart" && !frame.elements.some((element) => element.type === "chart" && element.chart)) throw new Error("Chart intent requires an editable ECharts chart model.");
  if (["process", "timeline", "architecture"].includes(frame.intent) && !frame.elements.some((element) => element.type === "svg")) throw new Error(`${frame.intent} intent requires an SVG diagram layer.`);
}

function parseColorHex(value) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || "").trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const num = parseInt(hex, 16);
  return { r:(num >> 16) & 255, g:(num >> 8) & 255, b:num & 255 };
}

function relativeLuminance({ r, g, b }) {
  const channel = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg), l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function elementContrastIssue(element, frameBackground) {
  if (!element || element.type !== "text") return null;
  const style = element.style || {};
  const fg = parseColorHex(style.color);
  if (!fg) return null;
  const bg = parseColorHex(style.background) || parseColorHex(frameBackground);
  if (!bg) return null;
  if (contrastRatio(fg, bg) < 3.0) {
    return { id:"low-contrast", severity:"warning", elementId:element.id, message:`Element ${element.id} text has low contrast against its background.` };
  }
  return null;
}

export function collectLayoutIssues(frame) {
  const elements = frame.elements || [];
  const models = new Map(elements.map((element) => [element.id, element]));
  const issues = [];
  const absoluteRect = (element, trail = new Set()) => {
    if (trail.has(element.id)) { issues.push({ id:"cyclic-parent", severity:"error", elementId:element.id, message:`Element ${element.id} has a cyclic parent hierarchy.` }); return null; }
    const x = Number(element.x), y = Number(element.y), width = Number(element.width), height = Number(element.height);
    if ([x, y, width, height].some((value) => !Number.isFinite(value))) { issues.push({ id:"invalid-geometry", severity:"error", elementId:element.id, message:`Element ${element.id} has invalid layout geometry.` }); return null; }
    const parent = models.get(element.parentId);
    if (!parent) return { x, y, width, height };
    const parentRect = absoluteRect(parent, new Set(trail).add(element.id));
    if (!parentRect) return null;
    return { x:parentRect.x + x, y:parentRect.y + y, width, height };
  };
  const frameBackground = frame.background;
  for (const element of elements) {
    const rect = absoluteRect(element);
    if (!rect) continue;
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > W || rect.y + rect.height > H) {
      issues.push({ id:"out-of-bounds", severity:"error", elementId:element.id, message:`Element ${element.id} renders outside the slide frame.` });
    }
    const parent = models.get(element.parentId);
    if (parent) {
      const parentRect = absoluteRect(parent);
      if (parentRect && (rect.x < parentRect.x - 1 || rect.y < parentRect.y - 1 || rect.x + rect.width > parentRect.x + parentRect.width + 1 || rect.y + rect.height > parentRect.y + parentRect.height + 1)) {
        issues.push({ id:"parent-clip", severity:"error", elementId:element.id, message:`Element ${element.id} is clipped by parent ${parent.id}; resize or reflow the group.` });
      }
      const contrast = elementContrastIssue(element, frameBackground);
      if (contrast) issues.push(contrast);
      continue;
    }
    if (element.layoutLocked === true || element.type === "shape") continue;
    if (rect.x < SAFE || rect.y < SAFE || rect.x + rect.width > W - SAFE || rect.y + rect.height > H - 24) {
      issues.push({ id:"safe-area", severity:"warning", elementId:element.id, message:`Element ${element.id} extends beyond the recommended content-safe area.` });
    }
    if (element.type === "text" && String(element.text || "").trim()) {
      const fontSize = Math.max(6, Number.parseFloat(element.style?.fontSize) || 24);
      const lineHeight = Math.max(0.8, Number.parseFloat(element.style?.lineHeight) || 1.2);
      const wrappedLines = String(element.text).split(/\n/).reduce((total, line) => {
        const visualUnits = [...line].reduce((sum, character) => sum + (/[^\x00-\xff]/.test(character) ? 1 : 0.56), 0);
        return total + Math.max(1, Math.ceil((visualUnits * fontSize) / Math.max(1, rect.width)));
      }, 0);
      if (wrappedLines * fontSize * lineHeight * 1.12 > rect.height + 2) issues.push({ id:"clipped-text", severity:"warning", elementId:element.id, message:`Text element ${element.id} may be clipped; enlarge its box or shorten the copy.` });
    }
    const contrast = elementContrastIssue(element, frameBackground);
    if (contrast) issues.push(contrast);
  }
  const textRects = elements
    .filter((element) => element.type === "text")
    .map((element) => ({ element, rect: absoluteRect(element) }))
    .filter((entry) => entry.rect);
  for (let a = 0; a < textRects.length; a++) {
    for (let b = a + 1; b < textRects.length; b++) {
      const A = textRects[a].rect, B = textRects[b].rect;
      const overlapW = Math.max(0, Math.min(A.x + A.width, B.x + B.width) - Math.max(A.x, B.x));
      const overlapH = Math.max(0, Math.min(A.y + A.height, B.y + B.height) - Math.max(A.y, B.y));
      const overlapArea = overlapW * overlapH;
      const minArea = Math.min(A.width * A.height, B.width * B.height);
      if (minArea > 0 && overlapArea / minArea > 0.5) {
        issues.push({ id:"text-overlap", severity:"warning", elementId:textRects[a].element.id, message:`Text element ${textRects[a].element.id} overlaps ${textRects[b].element.id} significantly.` });
      }
    }
  }
  return issues;
}

export function validatePostLayout(frame) {
  const issues = collectLayoutIssues(frame);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length) throw new Error(errors[0].message);
}
