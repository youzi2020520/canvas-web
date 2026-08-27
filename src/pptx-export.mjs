import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { zipSync, strToU8, unzipSync } from "fflate";
import { assetsDirFor } from "./paths.mjs";
import { readState } from "./store.mjs";
import { loadPreset, TRIGGER_NODE_TYPES } from "./pptx-animation-presets.mjs";

const pptxContentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
// Presentation slide is 1280x720 px (16:9). EMU-per-pixel at 96 dpi is 9525.
const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;
const EMU = 9525;
const fidelityCheckedFields = ["slide-count", "shape-count", "geometry", "fill", "font-family", "font-size", "alpha", "gradient", "rounded-geometry", "mask", "image-crop", "animation-timing"];

export async function exportSlidesPptx(projectDir, deckId, options = {}) {
  const state = await readState(projectDir, options);
  const deck = state.objects.find((item) => item.id === deckId && item.type === "slides");
  if (!deck) throw httpError("Slide deck not found.", 404);
  const slides = slidesForDeck(state.objects, deck);
  if (!slides.length) throw httpError("Add at least one slide before exporting PowerPoint.", 400);

  const projectAssetsDir = assetsDirFor(projectDir, options.canvasId);
  const media = new Map();
  const rendered = [];
  for (const [index, source] of slides.entries()) {
    rendered.push(await renderSlide(source, index, projectAssetsDir, media));
  }
  const embeddedFonts = await collectProjectFonts(projectDir);
  let exportSlides = rendered;
  let buffer = buildPptx(exportSlides, deck.name || "AI-slides", media, embeddedFonts);
  verifyPptx(buffer);
  let fidelity;
  try {
    fidelity = verifyExportFidelity(buffer, slides, exportSlides);
    if (fidelity.diffs.some((diff) => ["invalid-geometry", "out-of-bounds", "invalid-font-size", "invalid-crop"].includes(diff.issue))) {
      exportSlides = repairRenderedSlidesForPptx(exportSlides);
      buffer = buildPptx(exportSlides, deck.name || "AI-slides", media, embeddedFonts);
      verifyPptx(buffer);
      fidelity = { ...verifyExportFidelity(buffer, slides, exportSlides), repairAttempted:true };
    }
  } catch (error) {
    fidelity = { ok: false, diffs: [{ issue: "verification-error", error: error.message }] };
  }
  return {
    buffer,
    contentType: pptxContentType,
    filename: `${safeFilename(deck.name || "AI-slides")}.pptx`,
    fidelity
  };
}

function slidesForDeck(objects, deck) {
  const legacy = new Map((deck.slideIds || []).map((id, index) => [id, index]));
  return objects.filter((item) => ["image", "html", "slide-frame"].includes(item.type || "image") && (item.slideDeckId === deck.id || legacy.has(item.id)))
    .sort((left, right) => (Number.isFinite(left.slideOrder) ? left.slideOrder : legacy.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (Number.isFinite(right.slideOrder) ? right.slideOrder : legacy.get(right.id) ?? Number.MAX_SAFE_INTEGER));
}

async function renderSlide(source, index, projectAssetsDir, media) {
  const kind = source.type || "image";
  if (kind === "slide-frame") return renderFrameSlide(source, projectAssetsDir, media);
  if (kind === "html") return renderHtmlSlide(source, index);
  return renderImageSlide(source, index, media);
}

async function renderImageSlide(source, index, media) {
  const missing = () => ({
    background: "#f8fafc",
    shapes: [textShape(`Slide ${index + 1}`, source.name, { left: 72, top: 260, width: 1136, height: 120 }, { fontSize: 42, bold: true, color: "#0f172a", alignment: "center" })]
  });
  const imagePath = source.assetPath || source.sourcePath;
  if (!imagePath) return missing();
  const bytes = await fs.readFile(imagePath).catch(() => null);
  if (!bytes) return missing();
  const key = "file:" + path.resolve(imagePath);
  registerMedia(media, key, bytes, imageContentType(imagePath));
  const rect = coverRect(imageDimensions(bytes), { left: 0, top: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT });
  return {
    background: "#ffffff",
    shapes: [{ kind: "pic", name: source.name || `Slide ${index + 1}`, x: rect.left, y: rect.top, w: rect.width, h: rect.height, mediaKey: key }]
  };
}

async function renderFrameSlide(source, projectAssetsDir, media) {
  const elements = Array.isArray(source.elements) ? source.elements : [];
  const models = new Map(elements.map((element) => [element.id, element]));
  const parentLocalCoordinates = source.coordinateSpace === "parent-local";
  // 自动检测实际设计稿尺寸：
  // 1) 显式 designWidth/designHeight 优先
  // 2) 否则用所有元素绝对坐标的最大 endX/endY 作为设计稿尺寸（防 AI 生成的元素超出 width/height）
  // 3) 兜底用 source.width/height 或标准 1280×720
  let detectedW = Number(source.designWidth) || 0;
  let detectedH = Number(source.designHeight) || 0;
  if (!detectedW || !detectedH) {
    let maxEndX = 0, maxEndY = 0;
    const seenDetect = new Set();
    const detectRange = (element) => {
      if (!element || seenDetect.has(element.id)) return;
      seenDetect.add(element.id);
      let left = Number(element.x) || 0;
      let top = Number(element.y) || 0;
      let parent = parentLocalCoordinates ? models.get(element.parentId) : null;
      const seen = new Set([element.id]);
      while (parent && !seen.has(parent.id)) {
        seen.add(parent.id);
        left += Number(parent.x) || 0;
        top += Number(parent.y) || 0;
        parent = models.get(parent.parentId);
      }
      const w = Math.max(0, Number(element.width) || 0);
      const h = Math.max(0, Number(element.height) || 0);
      if (left + w > maxEndX) maxEndX = left + w;
      if (top + h > maxEndY) maxEndY = top + h;
    };
    for (const el of elements) detectRange(el);
    if (!detectedW) detectedW = Math.max(maxEndX, Number(source.width) || 0, SLIDE_WIDTH);
    if (!detectedH) detectedH = Math.max(maxEndY, Number(source.height) || 0, SLIDE_HEIGHT);
  }
  const sourceWidth = detectedW || SLIDE_WIDTH;
  const sourceHeight = detectedH || SLIDE_HEIGHT;
  const scaleX = sourceWidth > 0 ? SLIDE_WIDTH / sourceWidth : 1;
  const scaleY = sourceHeight > 0 ? SLIDE_HEIGHT / sourceHeight : 1;
  // 保持画布比例：用 min 防止元素被拉伸超出 16:9 画布
  const scale = Math.min(scaleX, scaleY);
  if (sourceWidth !== Number(source.designWidth) || sourceHeight !== Number(source.designHeight)) {
    console.error(`[pptx-export] detected design size: ${sourceWidth}x${sourceHeight} (source.width=${source.width} source.height=${source.height}) -> scale=${scale}`);
  }
  const absolutePosition = (element) => {
    let left = Number(element.x) || 0;
    let top = Number(element.y) || 0;
    const seen = new Set([element.id]);
    let parent = parentLocalCoordinates ? models.get(element.parentId) : null;
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      left += Number(parent.x) || 0;
      top += Number(parent.y) || 0;
      parent = models.get(parent.parentId);
    }
    return { left: left * scale, top: top * scale, width: Math.max(1, Number(element.width) || 1) * scale, height: Math.max(1, Number(element.height) || 1) * scale };
  };
  const shapes = [];
  const backgroundRaw = String(source.background ?? "");
  const background = parseCssGradient(backgroundRaw)
    || parseColorWithAlpha(backgroundRaw)
    || hexColor(backgroundRaw, "ffffff");
  console.error(`[pptx-export] slide "${source.name || source.id}" background raw=${JSON.stringify(backgroundRaw)} parsed=${JSON.stringify(background)}`);
  shapes.push({ kind: "sp", name: "background", x: 0, y: 0, w: SLIDE_WIDTH, h: SLIDE_HEIGHT, fill: background });
  for (const element of elements) {
    const position = absolutePosition(element);
    const style = element.style || {};
    console.error(`[pptx-export]   element type=${element.type} id=${element.id} x=${element.x} y=${element.y} w=${element.width} h=${element.height} parentId=${element.parentId || ""} -> abs=${JSON.stringify(position)} style=${JSON.stringify({ background: style.background, color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight, fontFamily: style.fontFamily, textAlign: style.textAlign, clipPath: style.clipPath, borderRadius: style.borderRadius, objectFit: style.objectFit, objectPosition: style.objectPosition })} text=${JSON.stringify(String(element.text || "").slice(0, 40))}`);
    if (element.type === "shape" || (style.background && element.type !== "text")) {
      const gradientFill = parseCssGradient(style.background);
      const rawFill = hexColor(style.background, null);
      let parsedFill = gradientFill || rawFill;
      // 如果是纯颜色（不是 gradient object），用 parseColorWithAlpha 带上 alpha
      if (typeof rawFill === "string") {
        const parsed = parseColorWithAlpha(style.background);
        if (parsed) parsedFill = parsed.alpha < 1 ? parsed : parsed.hex;
      } else if (rawFill == null && /^rgba?\(|transparent/i.test(String(style.background || ""))) {
        const parsed = parseColorWithAlpha(style.background);
        if (parsed) parsedFill = parsed;
      }
      const hasBorder = parseCssBorder(style.border);
      if (parsedFill !== null || hasBorder || element.type === "shape") {
        const geometry = style.geometry || element.geometry || element.tag || "";
        const geometryAdjustment = cssNumber(style.geometryAdjustment != null ? style.geometryAdjustment : element.geometryAdjustment, undefined);
        shapes.push({ kind: "sp", name: element.id || "shape", x: position.left, y: position.top, w: position.width, h: position.height, fill: parsedFill, borderRadius: (cssNumber(style.borderRadius, 0) || 0) * scale || undefined, clipPath: style.clipPath ? String(style.clipPath) : undefined, border: hasBorder, geometry: String(geometry || ""), geometryAdjustment: geometryAdjustment });
      }
    }
    if (element.type === "text") {
      const textColor = parseColorWithAlpha(style.color) || { hex: normalizeHexColor(style.color, "172033"), alpha: 1 };
      const textBg = style.background ? (parseColorWithAlpha(style.background) || { hex: normalizeHexColor(style.background, "FFFFFF"), alpha: 1 }) : null;
      shapes.push(textShape(element.id || "text", String(element.text || ""), position, {
        fontSize: Math.max(8, cssNumber(style.fontSize, 24)),
        bold: Number(style.fontWeight) >= 600 || /bold/i.test(String(style.fontWeight || "")),
        fontFamily: String(style.fontFamily || "").split(",")[0].trim() || null,
        color: textColor.alpha < 1 ? textColor : textColor.hex,
        alignment: ["left", "center", "right"].includes(style.textAlign) ? style.textAlign : "left",
        fill: textBg ? (textBg.alpha < 1 ? textBg : textBg.hex) : null,
        borderRadius: (cssNumber(style.borderRadius, 0) || 0) * scale || undefined
      }));
    }
    if (element.type === "chart" && element.chart?.series?.length) {
      shapes.push({ kind: "chart", name: element.id || "chart", x: position.left, y: position.top, w: position.width, h: position.height, chart: element.chart });
    }
    if (["image", "svg"].includes(element.type)) {
      const src = String(element.src || "");
      const match = /^data:(image\/(?:png|jpeg|svg\+xml));base64,(.+)$/i.exec(src);
      let bytes = match ? Buffer.from(match[2], "base64") : null;
      let contentType = match?.[1]?.toLowerCase() || "";
      let key = bytes ? `data:${src.slice(0, 96)}` : "";
      if (!bytes && src.startsWith("/assets/")) {
        const assetName = decodeURIComponent(src.split("?")[0].split("/").at(-1) || "");
        const assetPath = path.join(projectAssetsDir, assetName);
        bytes = await fs.readFile(assetPath).catch(() => null);
        contentType = imageContentType(assetPath);
        key = "file:" + path.resolve(assetPath);
      }
      if (bytes) {
        registerMedia(media, key, bytes, contentType);
        const dimensions = imageDimensions(bytes);
        const objectFit = style.objectFit || "contain";
        const rect = objectFit === "cover" ? position : containRect(dimensions, position);
        shapes.push({ kind: "pic", name: element.text || element.id || "image", x: rect.left, y: rect.top, w: rect.width, h: rect.height, mediaKey: key, borderRadius: (cssNumber(style.borderRadius, 0) || 0) * scale || undefined, clipPath: style.clipPath ? String(style.clipPath) : undefined, objectFit, crop:objectFit === "cover" ? coverCrop(dimensions, position, style.objectPosition) : null });
      }
    }
    if (element.type === "web-embed") {
      const url = String(element.src || "");
      shapes.push({ kind: "sp", name: element.id || "web-embed", x: position.left, y: position.top, w: position.width, h: position.height, fill: "F4F5F7" });
      if (url) {
        shapes.push(textShape(element.id || "web-embed-link", url, position, {
          fontSize: 12,
          bold: false,
          color: "2563EB",
          alignment: "left",
          fill: null
        }));
      }
    }
    if (element.type === "table") {
      const rows = Number(element.rows) || 2;
      const cols = Number(element.cols) || 4;
      const cellW = position.width / cols;
      const cellH = position.height / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          shapes.push({
            kind: "sp",
            name: `${element.id}-cell-${r}-${c}`,
            x: position.left + c * cellW,
            y: position.top + r * cellH,
            w: cellW,
            h: cellH,
            fill: "FFFFFF",
            border: { color: "D1D5DB", width: 1 }
          });
        }
      }
      shapes.push(textShape(element.id || "table", String(element.text || `${cols}×${rows} 表格`), position, {
        fontSize: 12,
        bold: false,
        color: "344054",
        alignment: "center",
        fill: null
      }));
    }
    if (element.type === "media") {
      shapes.push({ kind: "sp", name: element.id || "media", x: position.left, y: position.top, w: position.width, h: position.height, fill: "172033" });
      shapes.push(textShape(element.id || "media-label", String(element.text || "🎬 视频"), position, {
        fontSize: 14,
        bold: true,
        color: "FFFFFF",
        alignment: "center",
        fill: null
      }));
    }
  }
  return {
    background,
    shapes,
    intent: source.intent || source.archetype || "content",
    role: source.role || "content",
    layoutFamily: source.layoutFamily || "title-content",
    transition: source.transition || "fade",
    animation: source.animation || { preset: "fade", groups: [] },
    speakerNotes: source.speakerNotes || deriveSpeakerNotes(source, elements)
  };
}

function deriveSpeakerNotes(source, elements) {
  const text = elements.filter((element) => element.type === "text").map((element) => String(element.text || "").trim()).filter(Boolean);
  return {
    summary: source.name || text[0] || "",
    talkingPoints: text.slice(1, 7),
    transition: "",
    durationSeconds: 0,
    sourceWarnings: []
  };
}

function renderHtmlSlide(source, index) {
  const content = htmlContent(source.html || "");
  return {
    background: "#f8fafc",
    shapes: [
      { kind: "sp", name: "accent", x: 0, y: 0, w: 22, h: 720, fill: hexColor("#0ea5e9", "0ea5e9") },
      textShape("eyebrow", `AI SLIDES  ·  ${String(index + 1).padStart(2, "0")}`, { left: 72, top: 62, width: 400, height: 28 }, { fontSize: 16, bold: true, color: "#0284c7" }),
      textShape("title", content.title || source.name || `Slide ${index + 1}`, { left: 72, top: 118, width: 1136, height: 112 }, { fontSize: 42, bold: true, color: "#0f172a" }),
      textShape("body", content.body || "Interactive HTML content is available in the Canvas-Codex presentation view.", { left: 72, top: 270, width: 920, height: 330 }, { fontSize: 24, color: "#475569" }),
      textShape("footer", source.name || "Canvas-Codex HTML slide", { left: 72, top: 654, width: 1136, height: 24 }, { fontSize: 14, color: "#94a3b8" })
    ]
  };
}

function textShape(name, text, position, style) {
  return { kind: "sp", name, x: position.left, y: position.top, w: position.width, h: position.height, text: String(text ?? ""), ...style };
}

function htmlContent(html) {
  const title = firstTagText(html, ["h1", "h2", "title"]);
  const paragraphs = [...String(html).matchAll(/<(p|li|h3)[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => decodeEntities(stripTags(match[2]))).filter(Boolean).slice(0, 8);
  return { title, body: paragraphs.join("\n\n").slice(0, 1200) };
}

function firstTagText(html, tags) {
  for (const tag of tags) {
    const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(String(html));
    const text = match ? decodeEntities(stripTags(match[1])) : "";
    if (text) return text.slice(0, 180);
  }
  return "";
}

function stripTags(value) { return String(value).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function decodeEntities(value) { return String(value).replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'"); }
function cssNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function hexColor(value, fallback = "ffffff") {
  const str = String(value || "").trim();
  if (/transparent|none/i.test(str)) return null;
  if (!str) {
    if (fallback == null) return null;
    const fb = String(fallback).trim();
    if (/transparent|none/i.test(fb)) return null;
    return toHex(fb);
  }
  const gradient = parseCssGradient(str);
  if (gradient) return gradient;
  return parseColorToHex(str, fallback);
}

function parseColorToHex(str, fallback = "ffffff") {
  const fb = fallback || "ffffff";
  let match = /#([0-9a-f]{6})\b/i.exec(str);
  if (match) return match[1].toUpperCase();
  match = /#([0-9a-f]{3})\b/i.exec(str);
  if (match) {
    const hex = match[1];
    return (hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]).toUpperCase();
  }
  match = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(str);
  if (match) {
    return rgbToHex(parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10));
  }
  const named = NAMED_COLORS[str.toLowerCase()];
  if (named) return named;
  return toHex(fb);
}

function toHex(value) {
  return String(value).replace(/^#/, "").slice(0, 6).toUpperCase().padStart(6, "0") || "FFFFFF";
}

function rgbToHex(r, g, b) {
  return [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("").toUpperCase();
}

const NAMED_COLORS = {
  black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF",
  yellow: "FFFF00", cyan: "00FFFF", magenta: "FF00FF", gray: "808080", grey: "808080",
  silver: "C0C0C0", maroon: "800000", purple: "800080", fuchsia: "FF00FF",
  lime: "00FF00", olive: "808000", navy: "000080", teal: "008080",
  orange: "FFA500", aqua: "00FFFF", aliceblue: "F0F8FF", antiquewhite: "FAEBD7",
  azure: "F0FFFF", beige: "F5F5DC", bisque: "FFE4C4", blanchedalmond: "FFEBCD",
  blueviolet: "8A2BE2", brown: "A52A2A", burlywood: "DEB887", cadetblue: "5F9EA0",
  chartreuse: "7FFF00", chocolate: "D2691E", coral: "FF7F50", cornflowerblue: "6495ED",
  cornsilk: "FFF8DC", crimson: "DC143C", darkblue: "00008B", darkcyan: "008B8B",
  darkgoldenrod: "B8860B", darkgray: "A9A9A9", darkgreen: "006400", darkgrey: "A9A9A9",
  darkkhaki: "BDB76B", darkmagenta: "8B008B", darkolivegreen: "556B2F", darkorange: "FF8C00",
  darkorchid: "9932CC", darkred: "8B0000", darksalmon: "E9967A", darkseagreen: "8FBC8F",
  darkslateblue: "483D8B", darkslategray: "2F4F4F", darkslategrey: "2F4F4F",
  darkturquoise: "00CED1", darkviolet: "9400D3", deeppink: "FF1493", deepskyblue: "00BFFF",
  dimgray: "696969", dimgrey: "696969", dodgerblue: "1E90FF", firebrick: "B22222",
  floralwhite: "FFFAF0", forestgreen: "228B22", gainsboro: "DCDCDC", ghostwhite: "F8F8FF",
  gold: "FFD700", goldenrod: "DAA520", greenyellow: "ADFF2F", honeydew: "F0FFF0",
  hotpink: "FF69B4", indianred: "CD5C5C", indigo: "4B0082", ivory: "FFFFF0",
  khaki: "F0E68C", lavender: "E6E6FA", lavenderblush: "FFF0F5", lawngreen: "7CFC00",
  lemonchiffon: "FFFACD", lightblue: "ADD8E6", lightcoral: "F08080", lightcyan: "E0FFFF",
  lightgoldenrodyellow: "FAFAD2", lightgray: "D3D3D3", lightgreen: "90EE90", lightgrey: "D3D3D3",
  lightpink: "FFB6C1", lightsalmon: "FFA07A", lightseagreen: "20B2AA", lightskyblue: "87CEFA",
  lightslategray: "778899", lightslategrey: "778899", lightsteelblue: "B0C4DE",
  lightyellow: "FFFFE0", limegreen: "32CD32", linen: "FAF0E6", magenta: "FF00FF",
  mediumaquamarine: "66CDAA", mediumblue: "0000CD", mediumorchid: "BA55D3",
  mediumpurple: "9370DB", mediumseagreen: "3CB371", mediumslateblue: "7B68EE",
  mediumspringgreen: "00FA9A", mediumturquoise: "48D1CC", mediumvioletred: "C71585",
  midnightblue: "191970", mintcream: "F5FFFA", mistyrose: "FFE4E1", moccasin: "FFE4B5",
  navajowhite: "FFDEAD", oldlace: "FDF5E6", olivedrab: "6B8E23", orangered: "FF4500",
  orchid: "DA70D6", palegoldenrod: "EEE8AA", palegreen: "98FB98", paleturquoise: "AFEEEE",
  palevioletred: "DB7093", papayawhip: "FFEFD5", peachpuff: "FFDAB9", peru: "CD853F",
  pink: "FFC0CB", plum: "DDA0DD", powderblue: "B0E0E6", rosybrown: "BC8F8F",
  royalblue: "4169E1", saddlebrown: "8B4513", salmon: "FA8072", sandybrown: "F4A460",
  seagreen: "2E8B57", seashell: "FFF5EE", sienna: "A0522D", skyblue: "87CEEB",
  slateblue: "6A5ACD", slategray: "708090", slategrey: "708090", snow: "FFFAFA",
  springgreen: "00FF7F", steelblue: "4682B4", tan: "D2B48C", thistle: "D8BFD8",
  tomato: "FF6347", turquoise: "40E0D0", violet: "EE82EE", wheat: "F5DEB3",
  whitesmoke: "F5F5F5", yellowgreen: "9ACD32"
};

function parseCssGradient(str) {
  const str_ = String(str || "").trim();
  const linearMatch = /linear-gradient\(\s*([\s\S]+?)\s*\)\s*$/i.exec(str_);
  const radialMatch = /radial-gradient\(\s*([\s\S]+?)\s*\)\s*$/i.exec(str_);
  if (!linearMatch && !radialMatch) return null;

  const isRadial = !!radialMatch;
  const inner = (isRadial ? radialMatch[1] : linearMatch[1]).trim();

  let angle = 180;
  let stopsStr = inner;
  let radialPos = { x: 50, y: 50 };
  let radialSize = 100;

  if (isRadial) {
    stopsStr = inner;
    const shapeMatch = /^(circle|ellipse)\s+(?:at\s+(\d+(?:\.\d+)?)%?\s+(\d+(?:\.\d+)?)%?)?\s*,?\s*([\s\S]+)$/i.exec(inner);
    if (shapeMatch) {
      if (shapeMatch[2] && shapeMatch[3]) {
        radialPos = { x: parseFloat(shapeMatch[2]), y: parseFloat(shapeMatch[3]) };
      }
      stopsStr = shapeMatch[4] || inner;
    } else {
      const atMatch = /^at\s+(\d+(?:\.\d+)?)%?\s+(\d+(?:\.\d+)?)%?\s*,?\s*([\s\S]+)$/i.exec(inner);
      if (atMatch) {
        radialPos = { x: parseFloat(atMatch[1]), y: parseFloat(atMatch[2]) };
        stopsStr = atMatch[3] || inner;
      }
    }
  } else {
    const dirMatch = /^(to\s+(?:top\s+right|top\s+left|bottom\s+right|bottom\s+left|top|bottom|left|right))\s*,\s*(.+)$/i.exec(inner);
    if (dirMatch) {
      const dir = dirMatch[1];
      stopsStr = dirMatch[2];
      if (/to top right/i.test(dir)) angle = 45;
      else if (/to bottom right/i.test(dir)) angle = 135;
      else if (/to bottom left/i.test(dir)) angle = 225;
      else if (/to top left/i.test(dir)) angle = 315;
      else if (/to top/i.test(dir)) angle = 0;
      else if (/to bottom/i.test(dir)) angle = 180;
      else if (/to right/i.test(dir)) angle = 90;
      else if (/to left/i.test(dir)) angle = 270;
    } else {
      const degMatch = /^(\d+(?:\.\d+)?)\s*deg\s*,\s*(.+)$/i.exec(inner);
      if (degMatch) {
        angle = parseFloat(degMatch[1]);
        stopsStr = degMatch[2];
      }
    }
  }

  const parts = splitStops(stopsStr);
  const stops = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const parsed = parseGradientStop(trimmed);
    if (parsed) stops.push(parsed);
  }

  if (stops.length >= 2) {
    const totalStops = stops.length;
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].pos == null) {
        stops[i].pos = totalStops === 1 ? 50 : (i * 100 / (totalStops - 1));
      }
    }
    if (isRadial) {
      return {
        type: "gradient",
        gradientType: "radial",
        cx: Math.max(0, Math.min(100000, Math.round(radialPos.x * 1000))),
        cy: Math.max(0, Math.min(100000, Math.round(radialPos.y * 1000))),
        r: Math.max(0, Math.min(100000, Math.round(radialSize * 1000))),
        stops
      };
    }
    return {
      type: "gradient",
      gradientType: "linear",
      rot: cssAngleToPptxRot(angle),
      stops
    };
  }
  return null;
}

function parseGradientStop(trimmed) {
  const m = /^(.+?)(?:\s+(\d+(?:\.\d+)?)\s*%?)?$/.exec(trimmed);
  if (!m) return null;
  const colorStr = m[1].trim();
  const pos = m[2] != null ? parseFloat(m[2]) : null;
  const color = parseColorWithAlpha(colorStr);
  if (!color) return null;
  return { color: color.hex, alpha: color.alpha, pos };
}

function parseColorWithAlpha(str) {
  const s = String(str || "").trim();
  if (!s) return null;
  const hex6 = /^#([0-9a-f]{6})\b$/i.exec(s);
  if (hex6) return { hex: hex6[1].toUpperCase(), alpha: 1 };
  const hex3 = /^#([0-9a-f]{3})\b$/i.exec(s);
  if (hex3) {
    const h = hex3[1];
    return { hex: (h[0] + h[0] + h[1] + h[1] + h[2] + h[2]).toUpperCase(), alpha: 1 };
  }
  const rgba = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+))?\s*\)/i.exec(s);
  if (rgba) {
    const r = Math.max(0, Math.min(255, parseInt(rgba[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(rgba[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(rgba[3], 10)));
    const a = rgba[4] != null ? Math.max(0, Math.min(1, parseFloat(rgba[4]))) : 1;
    return { hex: rgbToHex(r, g, b), alpha: a };
  }
  const named = NAMED_COLORS[s.toLowerCase()];
  if (named) return { hex: named, alpha: 1 };
  return null;
}

function splitStops(text) {
  const result = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      if (current.trim()) result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

function cssAngleToPptxRot(cssDeg) {
  const pptDeg = ((cssDeg - 90) % 360 + 360) % 360;
  return Math.round(pptDeg * 60000);
}

function buildGradFillXml(gradient) {
  const isRadial = gradient.gradientType === "radial";
  let xml = `<a:gradFill flip="none" rotWithShape="0">`;
  xml += `<a:gsLst>`;
  for (const stop of gradient.stops) {
    const pos = Math.max(0, Math.min(100000, Math.round(stop.pos * 1000)));
    xml += `<a:gs pos="${pos}">`;
    if (stop.alpha != null && stop.alpha < 1) {
      const alphaVal = Math.max(0, Math.min(100000, Math.round(stop.alpha * 100000)));
      xml += `<a:srgbClr val="${stop.color}"><a:alpha val="${alphaVal}"/></a:srgbClr>`;
    } else {
      xml += `<a:srgbClr val="${stop.color}"/>`;
    }
    xml += `</a:gs>`;
  }
  xml += `</a:gsLst>`;
  if (isRadial) {
    // srcRect: 让渐变中心 (始终在 source rect 中心) 映射到目标位置 (cx, cy)
    // 公式:  source rect 宽度 w 最大为 min(2*cx, 2*(100000-cx))，保证 l>=0, r>=0
    const cx = Math.max(0, Math.min(100000, gradient.cx || 50000));
    const cy = Math.max(0, Math.min(100000, gradient.cy || 50000));
    const wMax = Math.min(2 * cx, 2 * (100000 - cx));
    const hMax = Math.min(2 * cy, 2 * (100000 - cy));
    const w = Math.max(1000, wMax);
    const h = Math.max(1000, hMax);
    const l = Math.max(0, cx - Math.round(w / 2));
    const r = Math.max(0, 100000 - cx - Math.round(w / 2));
    const t = Math.max(0, cy - Math.round(h / 2));
    const b = Math.max(0, 100000 - cy - Math.round(h / 2));
    xml += `<a:srcRect l="${l}" t="${t}" r="${r}" b="${b}"/>`;
    xml += `<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>`;
  } else {
    xml += `<a:lin ang="${gradient.rot || 0}" scaled="0"/>`;
  }
  xml += `</a:gradFill>`;
  return xml;
}
function imageContentType(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "image/jpeg";
}
function mediaExtFor(contentType) {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}
function registerMedia(media, key, bytes, contentType) {
  if (media.has(key) || !bytes) return;
  media.set(key, { bytes: Buffer.from(bytes), ext: mediaExtFor(contentType) });
}
function imageDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2) return null;
      offset += 2 + length;
    }
  }
  return null;
}
function containRect(dimensions, box) {
  if (!dimensions || !dimensions.width || !dimensions.height) return box;
  const scale = Math.min(box.width / dimensions.width, box.height / dimensions.height);
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  return { left: Math.round(box.left + (box.width - width) / 2), top: Math.round(box.top + (box.height - height) / 2), width, height };
}

function coverRect(dimensions, box) {
  if (!dimensions || !dimensions.width || !dimensions.height) return { left: box.left, top: box.top, width: box.width, height: box.height };
  const scale = Math.max(box.width / dimensions.width, box.height / dimensions.height);
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  const left = Math.round(box.left - (width - box.width) / 2);
  const top = Math.round(box.top - (height - box.height) / 2);
  return { left, top, width, height };
}

function objectPositionFractions(value) {
  const tokens = String(value || "50% 50%").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const fraction = (token, axis) => {
    if (token === "left" || token === "top") return 0;
    if (token === "right" || token === "bottom") return 1;
    if (token === "center") return 0.5;
    if (/%$/.test(token)) return Math.max(0, Math.min(1, Number.parseFloat(token) / 100));
    return axis === "x" ? 0.5 : 0.5;
  };
  if (tokens.length === 1) {
    if (["top", "bottom"].includes(tokens[0])) return { x:0.5, y:fraction(tokens[0], "y") };
    return { x:fraction(tokens[0], "x"), y:0.5 };
  }
  return { x:fraction(tokens[0], "x"), y:fraction(tokens[1], "y") };
}

function coverCrop(dimensions, box, objectPosition) {
  if (!dimensions?.width || !dimensions?.height || !box?.width || !box?.height) return null;
  const sourceAspect = dimensions.width / dimensions.height;
  const boxAspect = box.width / box.height;
  const position = objectPositionFractions(objectPosition);
  let left = 0, top = 0, right = 0, bottom = 0;
  if (sourceAspect > boxAspect) {
    const visibleWidth = dimensions.height * boxAspect;
    const cropped = Math.max(0, dimensions.width - visibleWidth);
    left = cropped * position.x / dimensions.width;
    right = cropped * (1 - position.x) / dimensions.width;
  } else if (sourceAspect < boxAspect) {
    const visibleHeight = dimensions.width / boxAspect;
    const cropped = Math.max(0, dimensions.height - visibleHeight);
    top = cropped * position.y / dimensions.height;
    bottom = cropped * (1 - position.y) / dimensions.height;
  }
  return { left, top, right, bottom };
}
function xmlEscape(value) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function safeFilename(value) { return String(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim().slice(0, 80) || "AI-slides"; }
function httpError(message, statusCode) { const error = new Error(message); error.statusCode = statusCode; return error; }
function relsXml(inner) { return `${XML}<Relationships xmlns="${RELS_NS}">${inner}</Relationships>`; }

async function collectProjectFonts(projectDir) {
  const roots = [path.join(projectDir, "fonts"), path.join(projectDir, "assets", "fonts")];
  const fonts = [];
  for (const root of roots) {
    const names = await fs.readdir(root).catch(() => []);
    for (const name of names) {
      if (!/\.(ttf|otf)$/i.test(name) || fonts.length >= 8) continue;
      const bytes = await fs.readFile(path.join(root, name)).catch(() => null);
      if (!bytes) continue;
      const guid = crypto.randomUUID().toUpperCase();
      fonts.push({ typeface: path.basename(name, path.extname(name)), guid, bytes: obfuscateFont(bytes, guid) });
    }
  }
  return fonts;
}

function obfuscateFont(bytes, guid) {
  const output = Buffer.from(bytes);
  const key = Buffer.from(guid.replace(/-/g, ""), "hex").reverse();
  for (let index = 0; index < Math.min(32, output.length); index += 1) output[index] ^= key[index % key.length];
  return output;
}

function buildPptx(rendered, deckName, media, embeddedFonts = []) {
  const mediaNames = new Map();
  [...media.entries()].forEach(([key, entry], index) => mediaNames.set(key, `image${index + 1}.${entry.ext}`));
  const slideXml = [];
  const slideRels = [];
  const slideOverrides = [];
  const slideIds = [];
  const notesOverrides = [];
  const chartOverrides = [];
  let chartNumber = 0;
  for (const [index, slide] of rendered.entries()) {
    const usedMedia = [];
    for (const shape of slide.shapes) if (shape.kind === "pic" && !usedMedia.includes(shape.mediaKey)) usedMedia.push(shape.mediaKey);
    const mediaRels = new Map(usedMedia.map((key, offset) => [key, `rId${offset + 3}`]));
    const chartShapes = slide.shapes.filter((shape) => shape.kind === "chart");
    chartShapes.forEach((shape, offset) => { shape.chartNumber = ++chartNumber; shape.chartRelId = `rId${usedMedia.length + offset + 3}`; });
    slideXml.push(buildSlideXml(slide, mediaRels));
    const relationships = [`<Relationship Id="rId1" Type="${R_NS}/slideLayout" Target="../slideLayouts/slideLayout${layoutIndexFor(slide.layoutFamily || slide.role || slide.intent)}.xml"/>`, `<Relationship Id="rId2" Type="${R_NS}/notesSlide" Target="../notesSlides/notesSlide${index + 1}.xml"/>`];
    usedMedia.forEach((key, offset) => relationships.push(`<Relationship Id="rId${offset + 3}" Type="${R_NS}/image" Target="../media/${mediaNames.get(key)}"/>`));
    chartShapes.forEach((shape) => relationships.push(`<Relationship Id="${shape.chartRelId}" Type="${R_NS}/chart" Target="../charts/chart${shape.chartNumber}.xml"/>`));
    slideRels.push(relsXml(relationships.join("")));
    slideOverrides.push(`<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    notesOverrides.push(`<Override PartName="/ppt/notesSlides/notesSlide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`);
    chartShapes.forEach((shape) => chartOverrides.push(`<Override PartName="/ppt/charts/chart${shape.chartNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`));
    slideIds.push(`<p:sldId id="${256 + index}" r:id="rId${index + 3}"/>`);
  }
  embeddedFonts.forEach((_, index) => chartOverrides.push(`<Override PartName="/ppt/fonts/font${index + 1}.odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>`));
  const slideCount = rendered.length;
  const now = new Date().toISOString();
  const presPropsXml = `${XML}<p:presentationPr xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:extLst><p:ext uri="{E76CE94A-603C-4142-B9EB-6D1370010A27}"><p14:discardImageEditData xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="0"/></p:ext><p:ext uri="{D31A062A-798A-4329-ABDD-BBA856620510}"><p14:defaultImageDpi xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="0"/></p:ext></p:extLst></p:presentationPr>`;
  const viewPropsXml = `${XML}<p:viewPr xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}" lastView="sldThumbnailView"><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:slideViewPr><p:cSldViewPr snapToGrid="0" snapToObjects="1"><p:cViewPr varScale="1"><p:scale><a:sx n="124" d="100"/><a:sy n="124" d="100"/></p:scale><p:origin x="-1512" y="-112"/></p:cViewPr><p:guideLst><p:guide orient="horz" pos="2160"/><p:guide pos="2880"/></p:guideLst></p:cSldViewPr></p:slideViewPr><p:notesTextViewPr><p:cViewPr><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:notesTextViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`;
  const entries = {
    "[Content_Types].xml": strToU8(`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.presentationml.printerSettings"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="webp" ContentType="image/webp"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>${slideLayouts.map((_, index) => `<Override PartName="/ppt/slideLayouts/slideLayout${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`).join("")}<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>${slideOverrides.join("")}${notesOverrides.join("")}${chartOverrides.join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(relsXml(`<Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${R_NS}/extended-properties" Target="docProps/app.xml"/>`)),
    "docProps/core.xml": strToU8(`${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(deckName)}</dc:title><dc:creator>Canvas-Codex</dc:creator><cp:lastModifiedBy>Canvas-Codex</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Canvas-Codex</Application><Slides>${slideCount}</Slides></Properties>`),
    "ppt/presentation.xml": strToU8(buildPresentationXml(slideCount, slideIds.join(""), embeddedFonts)),
    "ppt/_rels/presentation.xml.rels": strToU8(relsXml(`<Relationship Id="rId1" Type="${R_NS}/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="${R_NS}/theme" Target="theme/theme1.xml"/>${Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 3}" Type="${R_NS}/slide" Target="slides/slide${index + 1}.xml"/>`).join("")}<Relationship Id="rId${slideCount + 3}" Type="${R_NS}/presProps" Target="presProps.xml"/><Relationship Id="rId${slideCount + 4}" Type="${R_NS}/viewProps" Target="viewProps.xml"/><Relationship Id="rId${slideCount + 5}" Type="${R_NS}/notesMaster" Target="notesMasters/notesMaster1.xml"/>${embeddedFonts.map((_, index) => `<Relationship Id="rId${slideCount + 6 + index}" Type="${R_NS}/font" Target="fonts/font${index + 1}.odttf"/>`).join("")}`)),
    "ppt/presProps.xml": strToU8(presPropsXml),
    "ppt/viewProps.xml": strToU8(viewPropsXml),
    "ppt/theme/theme1.xml": strToU8(themeXml),
    "ppt/slideMasters/slideMaster1.xml": strToU8(slideMasterXml),
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": strToU8(relsXml(`${slideLayouts.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${R_NS}/slideLayout" Target="../slideLayouts/slideLayout${index + 1}.xml"/>`).join("")}<Relationship Id="rId${slideLayouts.length + 1}" Type="${R_NS}/theme" Target="../theme/theme1.xml"/>`)),
    "ppt/notesMasters/notesMaster1.xml": strToU8(notesMasterXml),
    "ppt/notesMasters/_rels/notesMaster1.xml.rels": strToU8(relsXml(`<Relationship Id="rId1" Type="${R_NS}/theme" Target="../theme/theme1.xml"/>`))
  };
  slideLayouts.forEach((layout, index) => { entries[`ppt/slideLayouts/slideLayout${index + 1}.xml`] = strToU8(buildSlideLayoutXml(layout)); entries[`ppt/slideLayouts/_rels/slideLayout${index + 1}.xml.rels`] = strToU8(relsXml(`<Relationship Id="rId1" Type="${R_NS}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>`)); });
  slideXml.forEach((xml, index) => {
    entries[`ppt/slides/slide${index + 1}.xml`] = strToU8(xml);
    entries[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = strToU8(slideRels[index]);
    entries[`ppt/notesSlides/notesSlide${index + 1}.xml`] = strToU8(buildNotesSlideXml(rendered[index].speakerNotes));
    entries[`ppt/notesSlides/_rels/notesSlide${index + 1}.xml.rels`] = strToU8(relsXml(`<Relationship Id="rId1" Type="${R_NS}/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rId2" Type="${R_NS}/slide" Target="../slides/slide${index + 1}.xml"/>`));
    rendered[index].shapes.filter((shape) => shape.kind === "chart").forEach((shape) => { entries[`ppt/charts/chart${shape.chartNumber}.xml`] = strToU8(buildChartXml(shape.chart)); });
  });
  media.forEach((entry, key) => { entries[`ppt/media/${mediaNames.get(key)}`] = new Uint8Array(entry.bytes); });
  embeddedFonts.forEach((font, index) => { entries[`ppt/fonts/font${index + 1}.odttf`] = new Uint8Array(font.bytes); });
  return Buffer.from(zipSync(entries, { level: 6 }));
}

function buildSlideXml(slide, mediaRels) {
  let shapeId = 2;
  // 建立 name → spid 映射，供 buildTimingXml 查找动画目标
  const shapeIdMap = new Map();
  const shapesXml = slide.shapes.map((shape) => {
    const id = shapeId++;
    if (shape.name) shapeIdMap.set(shape.name, id);
    return buildShapeXml(shape, id, mediaRels);
  }).join("");
  return `${XML}<p:sld xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_WIDTH * EMU}" cy="${SLIDE_HEIGHT * EMU}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_WIDTH * EMU}" cy="${SLIDE_HEIGHT * EMU}"/></a:xfrm></p:grpSpPr>${shapesXml}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${buildTransitionXml(slide.transition)}${buildTimingXml(slide.animation, shapeIdMap)}</p:sld>`;
}

function buildShapeXml(shape, shapeId, mediaRels) {
  const x = Math.round(shape.x * EMU);
  const y = Math.round(shape.y * EMU);
  const w = Math.max(1, Math.round(shape.w * EMU));
  const h = Math.max(1, Math.round(shape.h * EMU));

  const custGeomXml = buildCustGeomForClipPath(shape.clipPath, w, h);
  const geomXml = custGeomXml || buildPrstGeomXml(shape, w, h);

  if (shape.kind === "chart") {
    return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${shapeId}" name="${xmlEscape(shape.name || "Chart")}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${R_NS}" r:id="${shape.chartRelId}"/></a:graphicData></a:graphic></p:graphicFrame>`;
  }

  if (shape.kind === "pic") {
    const rId = mediaRels.get(shape.mediaKey) || "rId3";
    const crop = shape.crop;
    const srcRectXml = crop ? `<a:srcRect l="${Math.round(crop.left * 100000)}" t="${Math.round(crop.top * 100000)}" r="${Math.round(crop.right * 100000)}" b="${Math.round(crop.bottom * 100000)}"/>` : "";
    return `<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="${xmlEscape(shape.name || "Picture")}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}" cstate="print"/>${srcRectXml}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>${geomXml}</p:spPr></p:pic>`;
  }
  const isText = "text" in shape;
  const txBoxAttr = isText ? ' txBox="1"' : "";
  let fillXml = `<a:noFill/>`;
  if (shape.fill) {
    if (typeof shape.fill === "object" && shape.fill.type === "gradient") {
      fillXml = buildGradFillXml(shape.fill);
    } else if (typeof shape.fill === "object" && shape.fill.hex) {
      const f = shape.fill;
      fillXml = f.alpha != null && f.alpha < 1
        ? `<a:solidFill><a:srgbClr val="${f.hex}"><a:alpha val="${Math.max(0, Math.min(100000, Math.round(f.alpha * 100000)))}"/></a:srgbClr></a:solidFill>`
        : `<a:solidFill><a:srgbClr val="${f.hex}"/></a:solidFill>`;
    } else {
      const hex = typeof shape.fill === "string" ? shape.fill : hexColor(shape.fill, null);
      if (hex) fillXml = `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
    }
  } else if (shape.fill === null) {
    fillXml = `<a:noFill/>`;
  } else if (!isText && typeof shape.fill === "undefined") {
    fillXml = `<a:noFill/>`;
  }
  const txBody = isText ? buildTextBody(shape) : `<p:txBody><a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US" sz="1800"/></a:p></p:txBody>`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="${xmlEscape(shape.name || "Shape")}"/><p:cNvSpPr${txBoxAttr}/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>${geomXml}${fillXml}${buildLnXml(shape.border)}</p:spPr>${txBody}</p:sp>`;
}

function buildPrstGeomXml(shape, w, h) {
  const explicit = String(shape.geometry || "").trim();
  const prstMap = new Map([
    ["ellipse", "ellipse"],
    ["oval", "ellipse"],
    ["circle", "ellipse"],
    ["star8", "star8"],
    ["star10", "star10"],
    ["star12", "star12"],
    ["star16", "star16"],
    ["star24", "star24"],
    ["star32", "star32"],
    ["plus", "plus"],
    ["mathPlus", "mathPlus"],
    ["diamond", "diamond"],
    ["rhombus", "diamond"],
    ["triangle", "triangle"],
    ["pentagon", "pentagon"],
    ["hexagon", "hexagon"],
    ["octagon", "octagon"],
    ["decagon", "decagon"],
    ["heptagon", "heptagon"],
    ["nonagon", "nonagon"],
    ["donut", "donut"],
    ["ring", "donut"],
    ["teardrop", "teardrop"]
  ]);
  const prst = prstMap.get(explicit);
  if (prst) {
    const gd = shape.geometryAdjustment != null ? `<a:avLst><a:gd name="adj" fmla="val ${shape.geometryAdjustment}"/></a:avLst>` : `<a:avLst/>`;
    return `<a:prstGeom prst="${prst}">${gd}</a:prstGeom>`;
  }
  const radius = Number(shape.borderRadius) || 0;
  if (radius > 0) {
    const minDimPx = Math.max(1, Math.min(w, h) / EMU);
    const ratio = radius / minDimPx;
    // 半径达到 50% 即视为圆形
    if (ratio >= 0.49) {
      return `<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>`;
    }
    const adj = Math.max(0, Math.min(50000, Math.round(ratio * 100000)));
    return `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`;
  }
  return `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`;
}

function buildCustGeomForClipPath(clipPath, w, h) {
  if (!clipPath) return null;
  const str = String(clipPath).trim();

  const polygonMatch = /^polygon\(\s*([\s\S]+)\s*\)$/i.exec(str);
  if (polygonMatch) {
    const points = polygonMatch[1].split(/\s*,\s*/).map((pair) => {
      const match = /^(-?[\d.]+)%\s+(-?[\d.]+)%$/.exec(pair.trim());
      return match ? { x:Math.round(w * Number(match[1]) / 100), y:Math.round(h * Number(match[2]) / 100) } : null;
    }).filter(Boolean);
    if (points.length >= 3) {
      const [first, ...rest] = points;
      return `<a:custGeom><a:avLst/><a:pathLst><a:path w="${w}" h="${h}"><a:moveTo><a:pt x="${first.x}" y="${first.y}"/></a:moveTo>${rest.map((point) => `<a:lnTo><a:pt x="${point.x}" y="${point.y}"/></a:lnTo>`).join("")}<a:close/></a:path></a:pathLst></a:custGeom>`;
    }
  }

  const circleMatch = /circle\(\s*([\d.]+)%\s*(?:at\s+([\d.]+)%\s+([\d.]+)%)?\)/i.exec(str);
  if (circleMatch) {
    const radiusPct = parseFloat(circleMatch[1]) / 100;
    const cxPct = circleMatch[2] ? parseFloat(circleMatch[2]) / 100 : 0.5;
    const cyPct = circleMatch[3] ? parseFloat(circleMatch[3]) / 100 : 0.5;
    const cx = Math.round(w * cxPct);
    const cy = Math.round(h * cyPct);
    const radiusPx = radiusPct * Math.min(w, h);
    const r = Math.max(1, Math.round(radiusPx));
    // arcTo 使用 60000 每度。完整圆 = 21600000000
    const fullAngle = 21600000000;
    return `<a:custGeom><a:avLst/><a:pathLst><a:path w="${w}" h="${h}"><a:moveTo><a:pt x="${cx - r}" y="${cy}"/></a:moveTo><a:arcTo wR="${r}" hR="${r}" stAng="0" swAng="${fullAngle}"/></a:path></a:pathLst></a:custGeom>`;
  }

  const insetMatch = /inset\(\s*([\d.]+)(?:%|px)\s*\)/i.exec(str);
  if (insetMatch) {
    const raw = parseFloat(insetMatch[1]);
    let insetX, insetY;
    if (/%\s*$/.test(insetMatch[0])) {
      const pct = raw / 100;
      insetX = Math.round(w * pct);
      insetY = Math.round(h * pct);
    } else {
      const pxVal = Math.round(raw * EMU);
      insetX = pxVal;
      insetY = pxVal;
    }
    const newW = w - 2 * insetX;
    const newH = h - 2 * insetY;
    return `<a:custGeom><a:avLst/><a:pathLst><a:path w="${w}" h="${h}"><a:moveTo><a:pt x="${insetX}" y="${insetY}"/></a:moveTo><a:lnTo><a:pt x="${insetX + newW}" y="${insetY}"/></a:lnTo><a:lnTo><a:pt x="${insetX + newW}" y="${insetY + newH}"/></a:lnTo><a:lnTo><a:pt x="${insetX}" y="${insetY + newH}"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>`;
  }

  if (/circle|圆形|圆/i.test(str)) {
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);
    const r = Math.max(1, Math.round(Math.min(w, h) / 2));
    const fullAngle = 21600000000;
    return `<a:custGeom><a:avLst/><a:pathLst><a:path w="${w}" h="${h}"><a:moveTo><a:pt x="${cx - r}" y="${cy}"/></a:moveTo><a:arcTo wR="${r}" hR="${r}" stAng="0" swAng="${fullAngle}"/></a:path></a:pathLst></a:custGeom>`;
  }

  return null;
}

function parseCssBorder(value) {
  const str = String(value || "").trim();
  if (!str || /none|transparent/i.test(str)) return null;
  // 匹配 px 值 + 样式 + 颜色（支持 hex/rgb()/rgba()/命名色）
  const colorPart = str.replace(/^\d+(?:\.\d+)?px\s+(?:solid|dashed|dotted|double|groove|ridge|inset|outset)\s+/i, "").trim();
  const widthMatch = /^(\d+(?:\.\d+)?)px/.exec(str);
  if (!widthMatch || !colorPart) return null;
  const width = parseFloat(widthMatch[1]);
  const parsed = parseColorWithAlpha(colorPart) || { hex: hexColor(colorPart, "000000"), alpha: 1 };
  return { width, color: parsed.hex, alpha: parsed.alpha };
}

function buildLnXml(border) {
  if (!border) return `<a:ln><a:noFill/></a:ln>`;
  const w = Math.max(9525, Math.round(border.width * EMU));
  const alphaXml = border.alpha != null && border.alpha < 1
    ? `<a:alpha val="${Math.max(0, Math.min(100000, Math.round(border.alpha * 100000)))}"/>`
    : "";
  return `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="${border.color}">${alphaXml}</a:srgbClr></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`;
}

// 字体分类表：把常见字体名映射到类别
// 类别：sans（无衬线/线体）、serif（衬线）、mono（等宽）、display（展示/装饰）、cjk-sans（中文黑体）、cjk-serif（中文宋/楷/仿宋）、script（手写）
const FONT_CATEGORY = {
  // sans-serif（线体）
  "arial": "sans", "arial black": "sans", "arial narrow": "sans", "helvetica": "sans", "helvetica neue": "sans",
  "inter": "sans", "roboto": "sans", "open sans": "sans", "lato": "sans", "montserrat": "sans",
  "poppins": "sans", "nunito": "sans", "raleway": "sans", "ubuntu": "sans", "noto sans": "sans",
  "source sans pro": "sans", "source sans": "sans", "work sans": "sans", "manrope": "sans", "mulish": "sans",
  "sf pro": "sans", "sf pro display": "sans", "sf pro text": "sans", "san francisco": "sans",
  "segoe ui": "sans", "tahoma": "sans", "verdana": "sans", "trebuchet ms": "sans", "calibri": "sans",
  "droid sans": "sans", "oxygen": "sans", "cabin": "sans", "archivo": "sans",
  // CJK sans（中文线体/黑体）
  "microsoft yahei": "cjk-sans", "微软雅黑": "cjk-sans", "microsoft yahei ui": "cjk-sans",
  "pingfang sc": "cjk-sans", "苹方": "cjk-sans", "pingfang tc": "cjk-sans", "pingfang": "cjk-sans",
  "hiragino sans gb": "cjk-sans", "stheiti": "cjk-sans", "华文黑体": "cjk-sans",
  "source han sans": "cjk-sans", "source han sans sc": "cjk-sans", "思源黑体": "cjk-sans",
  "noto sans cjk": "cjk-sans", "noto sans sc": "cjk-sans", "noto sans cjk sc": "cjk-sans",
  "simhei": "cjk-sans", "黑体": "cjk-sans", "heiti sc": "cjk-sans", "heiti tc": "cjk-sans",
  "等线": "cjk-sans", "dengxian": "cjk-sans", "din": "cjk-sans", "din alternate": "cjk-sans",
  "yu gothic": "cjk-sans", "yu gothic ui": "cjk-sans", "meiryo": "cjk-sans", "hiragino sans": "cjk-sans",
  "malgun gothic": "cjk-sans", "applesdgothicneo": "cjk-sans",
  // serif（衬线体）
  "times new roman": "serif", "times": "serif", "georgia": "serif", "garamond": "serif",
  "palatino": "serif", "palatino linotype": "serif", "book antiqua": "serif", "baskerville": "serif",
  "hoefler text": "serif", "cambria": "serif", "constantia": "serif",
  "playfair display": "serif", "merriweather": "serif", "lora": "serif", "cormorant": "serif",
  "libre baskerville": "serif", "crimson text": "serif", "eb garamond": "serif",
  // CJK serif（中文宋/楷/仿宋）
  "simsun": "cjk-serif", "宋体": "cjk-serif", "songti sc": "cjk-serif", "songti tc": "cjk-serif", "华文宋体": "cjk-serif",
  "source han serif": "cjk-serif", "source han serif sc": "cjk-serif", "思源宋体": "cjk-serif",
  "noto serif cjk": "cjk-serif", "noto serif sc": "cjk-serif", "noto serif cjk sc": "cjk-serif",
  "fangsong": "cjk-serif", "仿宋": "cjk-serif", "stfangsong": "cjk-serif", "华文仿宋": "cjk-serif",
  "kaiti": "cjk-serif", "楷体": "cjk-serif", "stkaiti": "cjk-serif", "华文楷体": "cjk-serif",
  "mingti": "cjk-serif", "mincho": "cjk-serif", "ms mincho": "cjk-serif", "ms pmincho": "cjk-serif",
  "batang": "cjk-serif", "gungsuh": "cjk-serif",
  // monospace（等宽体）
  "courier new": "mono", "courier": "mono", "consolas": "mono", "monaco": "mono", "menlo": "mono",
  "source code pro": "mono", "jetbrains mono": "mono", "fira code": "mono", "roboto mono": "mono",
  "ubuntu mono": "mono", "inconsolata": "mono", "cascadia code": "mono", "cascadia mono": "mono",
  "ibm plex mono": "mono", "pt mono": "mono", "dm mono": "mono", "space mono": "mono",
  // display（展示/装饰体）
  "impact": "display", "haettenschweiler": "display",
  "bebas neue": "display", "anton": "display", "oswald": "display", "archivo black": "display",
  "teko": "display", "titillium web": "display", "oxanium": "display", "bungee": "display",
  "passion one": "display", "alfa slab one": "display", "ultra": "display", "stretch pro": "display",
  // script（手写体）
  "comic sans ms": "script", "comic sans": "script", "bradley hand": "script", "marker felt": "script",
  "snell roundhand": "script", "brush script mt": "script", "lucida handwriting": "script",
  "noto sans jp": "cjk-sans", "noto serif jp": "cjk-serif",
  "yu mincho": "cjk-serif",
};

// 每个类别的跨平台安全字体（macOS + Windows 都内置或通过 WPS 字体替换显示）
const CATEGORY_SAFE_FONT = {
  "sans": "Arial",
  "serif": "Times New Roman",
  "mono": "Courier New",
  "display": "Impact",
  "cjk-sans": "Microsoft YaHei",
  "cjk-serif": "SimSun",
  "script": "Comic Sans MS",
};

// 已知跨平台通用字体（macOS + Windows 都内置），保留原名不替换
// 注：Consolas 仅 Windows 内置（macOS 没有），不列入；Calibri 仅 Windows+Office 内置
const PLATFORM_SAFE_FONTS = new Set([
  "arial", "arial black", "arial narrow", "times new roman", "georgia",
  "courier new", "impact", "verdana", "tahoma", "trebuchet ms",
  "comic sans ms", "candara", "constantia", "cambria",
  "simsun", "宋体", "simhei", "黑体", "kaiti", "楷体", "fangsong", "仿宋",
  "microsoft yahei", "微软雅黑", "等线", "dengxian",
]);

// 识别字体类别并选择跨平台安全字体
// 输入：fontFamily（可能含多个字体 "Inter, Helvetica, sans-serif"）
// 输出：{ category, typeface, original, replaced }
// 注：粗体由 rPr 的 b="1" 属性表达，无需在此处理字重
export function classifyFont(fontFamily) {
  const raw = String(fontFamily || "").split(",")[0].trim();
  if (!raw) return { category: null, typeface: "", original: "", replaced: false };
  const lower = raw.toLowerCase();

  // 1. 精确匹配分类
  let category = FONT_CATEGORY[lower];

  // 2. 模糊匹配（字体名包含某个关键词）
  if (!category) {
    for (const [name, cat] of Object.entries(FONT_CATEGORY)) {
      if (lower === name || lower.includes(name)) {
        category = cat;
        break;
      }
    }
  }

  // 3. 关键词启发式匹配
  if (!category) {
    if (/mono|code|consol|courier|terminal/i.test(raw)) category = "mono";
    else if (/serif|roman|宋|楷|仿宋|mincho|batang/i.test(raw)) category = "serif";
    else if (/黑|hei|gothic|sans|雅黑|pingfang|hiragino/i.test(raw)) category = "cjk-sans";
    else if (/script|hand|brush|marker|cursive/i.test(raw)) category = "script";
    else if (/impact|bebas|anton|oswald|display|narrow|condensed/i.test(raw)) category = "display";
  }

  // 4. 已知跨平台安全字体，保留原名
  if (PLATFORM_SAFE_FONTS.has(lower)) {
    return { category, typeface: raw, original: raw, replaced: false };
  }

  // 5. 能分类且类别有安全字体 → 替换
  if (category && CATEGORY_SAFE_FONT[category]) {
    return { category, typeface: CATEGORY_SAFE_FONT[category], original: raw, replaced: true };
  }

  // 6. 不能分类，保留原名（让 PPT 用主题字体 fallback）
  return { category: null, typeface: raw, original: raw, replaced: false, unknown: true };
}

function eastAsianTypeface(fontFamily, classified) {
  const families = String(fontFamily || "").split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  for (const family of families) {
    const category = FONT_CATEGORY[family.toLowerCase()];
    if (category === "cjk-sans" || category === "cjk-serif") return family;
  }
  return classified.category === "serif" || classified.category === "cjk-serif" ? "SimSun" : "Microsoft YaHei";
}

function buildTextBody(shape) {
  const paragraphs = String(shape.text ?? "").split(/\r\n|\r|\n/);
  const sz = Math.round(Math.max(1, cssNumber(shape.fontSize, 18)) * 75);
  // 字体分类与跨平台 fallback
  const classified = classifyFont(shape.fontFamily);
  const typeface = xmlEscape(classified.typeface);
  const eastAsian = xmlEscape(eastAsianTypeface(shape.fontFamily, classified));
  if (classified.replaced) {
    console.error(`[pptx-export] font fallback: "${classified.original}" → "${classified.typeface}" (category=${classified.category})`);
  }
  const latinXml = typeface ? `<a:latin typeface="${typeface}"/><a:ea typeface="${eastAsian}"/><a:cs typeface="${typeface}"/>` : `<a:ea typeface="${eastAsian}"/>`;
  // 支持 shape.color = {hex, alpha} 或 string
  let colorHex = normalizeHexColor(typeof shape.color === "object" && shape.color ? shape.color.hex : shape.color, "172033");
  const hasAlpha = typeof shape.color === "object" && shape.color && shape.color.alpha != null && shape.color.alpha < 1;
  const colorAlpha = hasAlpha ? Math.max(0, Math.min(100000, Math.round(shape.color.alpha * 100000))) : 0;
  const runs = paragraphs.map((paragraph) => {
    const pPr = shape.alignment && shape.alignment !== "left" ? `<a:pPr algn="${shape.alignment}"/>` : "";
    const solidFillXml = hasAlpha
      ? `<a:solidFill><a:srgbClr val="${colorHex}"><a:alpha val="${colorAlpha}"/></a:srgbClr></a:solidFill>`
      : `<a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill>`;
    const rPr = `<a:rPr lang="zh-CN" altLang="en-US" sz="${sz}"${shape.bold ? ' b="1"' : ""}>${latinXml}${solidFillXml}</a:rPr>`;
    return `<a:p>${pPr}<a:r>${rPr}<a:t>${xmlEscape(paragraph)}</a:t></a:r><a:endParaRPr lang="zh-CN" altLang="en-US" sz="${sz}">${latinXml}</a:endParaRPr></a:p>`;
  });
  if (!runs.length) runs.push(`<a:p><a:endParaRPr lang="en-US" sz="1800"/></a:p>`);
  return `<p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="t"/><a:lstStyle/>${runs.join("")}</p:txBody>`;
}

function normalizeHexColor(value, fallback = "172033") {
  const str = String(value || "").trim();
  if (!str) return fallback.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(str)) return str.toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(str)) return str.slice(1).toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(str)) {
    const h = str.slice(1);
    return (h[0] + h[0] + h[1] + h[1] + h[2] + h[2]).toUpperCase();
  }
  return fallback.toUpperCase();
}

function buildPresentationXml(slideCount, slideIdsXml, embeddedFonts = []) {
  const fontList = embeddedFonts.length ? `<p:embeddedFontLst>${embeddedFonts.map((font, index) => `<p:embeddedFont><p:font typeface="${xmlEscape(font.typeface)}"/><p:regular r:id="rId${slideCount + 6 + index}"/></p:embeddedFont>`).join("")}</p:embeddedFontLst>` : "";
  return `${XML}<p:presentation xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}" saveSubsetFonts="1" autoCompressPictures="0"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIdsXml}</p:sldIdLst><p:sldSz cx="${SLIDE_WIDTH * EMU}" cy="${SLIDE_HEIGHT * EMU}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/>${fontList}<p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>`;
}

const slideLayouts = [
  { name: "Cover", type: "title" },
  { name: "Section", type: "secHead" },
  { name: "Title and Content", type: "obj" },
  { name: "Two Content", type: "twoObj" },
  { name: "Comparison", type: "twoTxTwoObj" },
  { name: "Blank", type: "blank" },
  { name: "Agenda", type: "obj" },
  { name: "Summary", type: "obj" },
  { name: "Closing", type: "titleOnly" }
];

function layoutIndexFor(intent) {
  const value = String(intent || "").toLowerCase();
  if (/agenda|目录/.test(value)) return 7;
  if (/summary|总结/.test(value)) return 8;
  if (/closing|结尾|thanks/.test(value)) return 9;
  if (/two-content|two|split/.test(value)) return 4;
  if (/comparison|compare/.test(value)) return 5;
  if (/title-content|content|obj/.test(value)) return 3;
  if (/cover|title/.test(value)) return 1;
  if (/section|chapter/.test(value)) return 2;
  if (/blank|freeform/.test(value)) return 6;
  return 3;
}

function buildSlideLayoutXml(layout) {
  return `${XML}<p:sldLayout xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}" type="${layout.type}" preserve="1"><p:cSld name="${xmlEscape(layout.name)}"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_WIDTH * EMU}" cy="${SLIDE_HEIGHT * EMU}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_WIDTH * EMU}" cy="${SLIDE_HEIGHT * EMU}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

const slideMasterXml = `${XML}<p:sldMaster xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_WIDTH * EMU}" cy="${SLIDE_HEIGHT * EMU}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_WIDTH * EMU}" cy="${SLIDE_HEIGHT * EMU}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst>${slideLayouts.map((_, index) => `<p:sldLayoutId id="${2147483649 + index}" r:id="rId${index + 1}"/>`).join("")}</p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;

function buildTransitionXml(value) {
  if (!value || value === "none") return "";
  const cfg = typeof value === "object" ? value : { type: value, duration: 700, direction: null };
  const type = cfg.type || "fade";
  const dirMap = { l: "fromL", r: "fromR", t: "fromT", b: "fromB" };
  const direction = dirMap[cfg.direction] || "";
  const dirAttr = direction ? ` dir="${direction}"` : "";
  const spd = cfg.duration <= 300 ? "slow" : cfg.duration >= 800 ? "med" : "fast";
  switch (type) {
    case "fade":   return `<p:transition spd="${spd}" advClick="1"><p:fade/></p:transition>`;
    case "cut":    return `<p:transition spd="${spd}" advClick="1"><p:cut/></p:transition>`;
    case "cover":  return `<p:transition spd="${spd}" advClick="1"><p:cover${dirAttr}/></p:transition>`;
    case "split":  return `<p:transition spd="${spd}" advClick="1"><p:split orient="horz"/></p:transition>`;
    case "push":
    case "push_left":  return `<p:transition spd="${spd}" advClick="1"><p:push dir="l"/></p:transition>`;
    case "push_right": return `<p:transition spd="${spd}" advClick="1"><p:push dir="r"/></p:transition>`;
    case "push_up":    return `<p:transition spd="${spd}" advClick="1"><p:push dir="t"/></p:transition>`;
    case "push_down":  return `<p:transition spd="${spd}" advClick="1"><p:push dir="b"/></p:transition>`;
    case "wipe":
    case "wipe_left":  return `<p:transition spd="${spd}" advClick="1"><p:wipe dir="l"/></p:transition>`;
    case "wipe_right": return `<p:transition spd="${spd}" advClick="1"><p:wipe dir="r"/></p:transition>`;
    case "wipe_up":    return `<p:transition spd="${spd}" advClick="1"><p:wipe dir="t"/></p:transition>`;
    case "wipe_down":  return `<p:transition spd="${spd}" advClick="1"><p:wipe dir="b"/></p:transition>`;
    default: return `<p:transition spd="${spd}" advClick="1"><p:fade/></p:transition>`;
  }
}

function buildTimingXml(animation, shapeIdMap) {
  if (!animation || animation.preset === "none") return "";
  const groups = Array.isArray(animation.groups) ? animation.groups : [];
  if (!groups.length || !shapeIdMap || !shapeIdMap.size) return "";

  // 按 order 排序，平手保持原数组顺序（稳定排序）
  const sorted = groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (a.g.order || 0) - (b.g.order || 0) || a.i - b.i);

  // id 分配：tmRoot=1, mainSeq=2，每个元素占 5 个 id（{ID},{ID1-4}）
  const ID_SLOTS_PER_ROW = 5;
  let nextId = 3;
  // 累积偏移：上一个元素的绝对结束时刻（相对当前 click 组开始）
  let lastEndTime = 0;
  const rows = [];

  for (const { g } of sorted) {
    const spid = shapeIdMap.get(g.elementId);
    if (!spid) continue; // 找不到目标形状，跳过（不静默失败，校验阶段会报）

    const preset = loadPreset(g.effect);
    if (!preset) continue; // 未注册效果，跳过

    const nodeType = TRIGGER_NODE_TYPES[g.trigger] || "afterEffect";
    // appear 等不可缩放效果保持 defaultDuration（踩坑规避）
    const dur = preset.durationScalable ? Math.max(1, Math.round(g.duration) || preset.defaultDuration) : preset.defaultDuration;

    // 计算起始 delay（放在 rowTemplate 最外层 cTn 的 stCondLst/cond@delay）
    let delay;
    if (g.trigger === "on_click") {
      delay = "indefinite"; // 等点击
      lastEndTime = 0; // 新 click 组，重置累积偏移
    } else if (g.trigger === "with_previous") {
      delay = String(Math.max(0, Math.round(g.delay) || 0));
      lastEndTime = Math.max(lastEndTime, (Math.round(g.delay) || 0) + dur);
    } else { // after_previous
      const abs = lastEndTime + (Math.max(0, Math.round(g.delay) || 0));
      delay = String(abs);
      lastEndTime = abs + dur;
    }

    const id = nextId;
    let xml = preset.rowTemplate;
    // 替换占位符（顺序重要：先 ID 再 ID1-4，避免 ID 误匹配 ID1）
    xml = xml
      .replace(/\{ID1\}/g, String(id + 1))
      .replace(/\{ID2\}/g, String(id + 2))
      .replace(/\{ID3\}/g, String(id + 3))
      .replace(/\{ID4\}/g, String(id + 4))
      .replace(/\{ID\}/g, String(id))
      .replace(/\{NODE_TYPE\}/g, nodeType)
      .replace(/\{DELAY\}/g, delay)
      .replace(/\{DUR\}/g, String(dur))
      .replace(/\{SPID\}/g, String(spid))
      .replace(/\{SUBTYPE\}/g, String(preset.presetSubtype));

    rows.push(xml);
    nextId += ID_SLOTS_PER_ROW;
  }

  if (!rows.length) return "";

  // 组装 timing 树（借鉴 ppt-master 的 mainSeq 骨架）
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${rows.join("")}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}

function buildChartXml(chart) {
  const categories = Array.isArray(chart?.categories) ? chart.categories : [];
  const series = Array.isArray(chart?.series) ? chart.series : [];
  const catLit = `<c:strLit><c:ptCount val="${categories.length}"/>${categories.map((value, index) => `<c:pt idx="${index}"><c:v>${xmlEscape(value)}</c:v></c:pt>`).join("")}</c:strLit>`;
  const seriesXml = series.map((item, seriesIndex) => {
    const values = Array.isArray(item.data) ? item.data : [];
    const valLit = `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values.map((value, index) => `<c:pt idx="${index}"><c:v>${Number(value) || 0}</c:v></c:pt>`).join("")}</c:numLit>`;
    return `<c:ser><c:idx val="${seriesIndex}"/><c:order val="${seriesIndex}"/><c:tx><c:v>${xmlEscape(item.name || `Series ${seriesIndex + 1}`)}</c:v></c:tx><c:cat>${catLit}</c:cat><c:val>${valLit}</c:val></c:ser>`;
  }).join("");
  const type = chart?.type === "line" ? "lineChart" : chart?.type === "pie" ? "pieChart" : "barChart";
  const axes = type === "pieChart" ? "" : `<c:axId val="48650112"/><c:axId val="48672768"/>`;
  const chartBody = type === "barChart" ? `<c:barDir val="col"/><c:grouping val="clustered"/>${seriesXml}<c:gapWidth val="150"/>${axes}` : type === "lineChart" ? `<c:grouping val="standard"/><c:varyColors val="0"/>${seriesXml}${axes}` : `<c:varyColors val="1"/>${seriesXml}`;
  const axisXml = type === "pieChart" ? "" : `<c:catAx><c:axId val="48650112"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="48672768"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="48672768"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="48650112"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  const title = chart?.title ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN"/><a:t>${xmlEscape(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` : `<c:autoTitleDeleted val="1"/>`;
  return `${XML}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="${A_NS}" xmlns:r="${R_NS}"><c:date1904 val="0"/><c:lang val="zh-CN"/><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/><c:${type}>${chartBody}</c:${type}>${axisXml}</c:plotArea><c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/></c:chart><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function notesText(notes) {
  const value = notes && typeof notes === "object" ? notes : {};
  return [value.summary, ...(value.talkingPoints || []).map((item) => `• ${item}`), value.transition ? `转场：${value.transition}` : "", ...(value.sourceWarnings || []).map((item) => `待核实：${item}`)].filter(Boolean).join("\n");
}

function buildNotesSlideXml(notes) {
  const paragraphs = notesText(notes).split("\n").map((line) => `<a:p><a:r><a:rPr lang="zh-CN"/><a:t>${xmlEscape(line)}</a:t></a:r><a:endParaRPr lang="zh-CN"/></a:p>`).join("") || `<a:p><a:endParaRPr lang="zh-CN"/></a:p>`;
  return `${XML}<p:notes xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

const notesMasterXml = `${XML}<p:notesMaster xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:notesStyle><a:lvl1pPr marL="0" algn="l" defTabSz="914400"><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle></p:notesMaster>`;

const themeXml = `${XML}<a:theme xmlns:a="${A_NS}" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:shade val="51000"/><a:satMod val="130000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="94000"/><a:satMod val="135000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;

function verifyPptx(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1500 || buffer.readUInt32BE(0) !== 0x504b0304) throw httpError("Generated PowerPoint file is invalid (missing ZIP signature).", 500);
  let entries;
  try { entries = unzipSync(new Uint8Array(buffer)); } catch { throw httpError("Generated PowerPoint file failed integrity verification.", 500); }
  const slideNames = Object.keys(entries).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
  if (!slideNames.length) throw httpError("Generated PowerPoint file contains no slides.", 500);
  for (const required of ["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml", "ppt/slideMasters/slideMaster1.xml", "ppt/slideLayouts/slideLayout1.xml", "ppt/theme/theme1.xml"]) {
    if (!entries[required]) throw httpError("Generated PowerPoint file is missing required parts.", 500);
  }
  const decoder = new TextDecoder();
  if (!slideNames.some((name) => /<p:(?:sp|pic)\b/.test(decoder.decode(entries[name])))) throw httpError("Generated PowerPoint file contains no visible slide content.", 500);
}

export function verifyExportFidelity(pptxBuffer, originalFrames, expectedSlides = null) {
  if (!pptxBuffer || !originalFrames || !originalFrames.length) {
    return { ok: false, diffs: [{ issue: "missing-input" }], checkedFields:fidelityCheckedFields };
  }
  let entries;
  try {
    entries = unzipSync(new Uint8Array(pptxBuffer));
  } catch (e) {
    return { ok: false, diffs: [{ issue: "unzip-failed", error: e.message }], checkedFields:fidelityCheckedFields };
  }
  const decoder = new TextDecoder();
  const slideFiles = Object.keys(entries)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/i)[1]) - parseInt(b.match(/slide(\d+)/i)[1]));
  const diffs = [];
  if (slideFiles.length !== originalFrames.length) {
    diffs.push({
      issue: "slide-count-mismatch",
      expected: originalFrames.length,
      actual: slideFiles.length
    });
  }
  for (let i = 0; i < slideFiles.length; i++) {
    const frame = originalFrames[i];
    if (!frame) continue;
    const xml = decoder.decode(entries[slideFiles[i]]);
    const shapes = extractShapeVisuals(xml);
    const expectedShapes = Array.isArray(expectedSlides?.[i]?.shapes) ? expectedSlides[i].shapes : null;
    const elements = Array.isArray(frame.elements) ? frame.elements : [];
    const expectedCount = expectedShapes?.length ?? elements.length;
    if (shapes.length !== expectedCount) {
      diffs.push({
        slide: i + 1,
        issue: "shape-count-mismatch",
        expected: expectedCount,
        actual: shapes.length
      });
    }
    if (expectedShapes) {
      for (const expected of expectedShapes) {
        const shape = shapes.find((item) => item.name === expected.name && item.kind === expected.kind);
        if (!shape) continue;
        compareShapeFidelity(diffs, i + 1, expected, shape);
      }
      continue;
    }
    for (const shape of shapes) {
      const match = elements.find((el) => {
        if (shape.text && el.text && String(el.text).includes(shape.text)) return true;
        if (shape.fill && el.fill && colorsMatch(el.fill, shape.fill)) return true;
        return false;
      });
      if (!match) continue;
      if (shape.fill && match.fill && !colorsMatch(match.fill, shape.fill)) {
        diffs.push({
          slide: i + 1,
          elementId: match.id,
          issue: "fill-mismatch",
          expected: match.fill,
          actual: shape.fill
        });
      }
      if (shape.font && match.fontFamily) {
        const expectedClass = classifyFont(match.fontFamily);
        const actualClass = classifyFont(shape.font);
        if (expectedClass.category && actualClass.category && expectedClass.category !== actualClass.category) {
          diffs.push({
            slide: i + 1,
            elementId: match.id,
            issue: "font-class-mismatch",
            expected: match.fontFamily + " (" + expectedClass.category + ")",
            actual: shape.font + " (" + actualClass.category + ")"
          });
        }
      }
    }
    // 动画 timing 校验（借鉴 ppt-master 的 validate_slide_animation_structure）
    verifySlideAnimation(diffs, i + 1, xml, frame);
  }
  return { ok: diffs.length === 0, diffs, checkedFields:fidelityCheckedFields };
}

// 动画 timing 导出后校验：timing 存在性 / cTn id 唯一 / spid 引用有效 / 行数匹配 / trigger 读回
function verifySlideAnimation(diffs, slide, xml, frame) {
  const animation = frame?.animation;
  if (!animation || animation.preset === "none") return;
  const groups = Array.isArray(animation.groups) ? animation.groups.filter((g) => g && g.elementId) : [];
  if (!groups.length) return;

  // 1. timing 块存在性
  const timingMatch = xml.match(/<p:timing>([\s\S]*?)<\/p:timing>/);
  if (!timingMatch) {
    diffs.push({ slide, issue: "animation-missing-timing", expected: groups.length, actual: 0 });
    return;
  }
  const timingXml = timingMatch[1];

  // 2. cTn id 唯一性（用 cTn id= 排除 spTgt spid= 的误匹配）
  const cTnIds = [...timingXml.matchAll(/cTn id="(\d+)"/g)].map((m) => m[1]);
  const idCounts = {};
  cTnIds.forEach((id) => { idCounts[id] = (idCounts[id] || 0) + 1; });
  const dupIds = Object.entries(idCounts).filter(([, c]) => c > 1).map(([id, count]) => ({ id, count }));
  if (dupIds.length) {
    diffs.push({ slide, issue: "animation-duplicate-ctn-id", duplicates: dupIds });
  }

  // 3. spid 引用有效（对比 shape cNvPr id 集合）
  const shapeIds = new Set([...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map((m) => m[1]));
  const spids = [...timingXml.matchAll(/spTgt spid="(\d+)"/g)].map((m) => m[1]);
  const invalidSpids = [...new Set(spids.filter((spid) => !shapeIds.has(spid)))];
  if (invalidSpids.length) {
    diffs.push({ slide, issue: "animation-invalid-spid", spids: invalidSpids });
  }

  // 4. 行数匹配（用 presetClass 计数）
  const presetClasses = [...timingXml.matchAll(/presetClass="(entr|emph|exit|path)"/g)].map((m) => m[1]);
  if (presetClasses.length !== groups.length) {
    diffs.push({ slide, issue: "animation-row-count-mismatch", expected: groups.length, actual: presetClasses.length });
  }

  // 5. trigger 读回（每个预期 nodeType 至少出现一次）
  const nodeTypes = [...timingXml.matchAll(/nodeType="(clickEffect|withEffect|afterEffect)"/g)].map((m) => m[1]);
  const expectedNodeTypes = groups.map((g) => TRIGGER_NODE_TYPES[g.trigger] || "afterEffect");
  for (const expected of new Set(expectedNodeTypes)) {
    if (!nodeTypes.includes(expected)) {
      diffs.push({ slide, issue: "animation-trigger-mismatch", expected, found: false });
    }
  }
}

function extractShapeVisuals(xml) {
  const shapes = [];
  for (const [tag, kind] of [["sp", "sp"], ["pic", "pic"], ["graphicFrame", "chart"]]) {
    const shapeRegex = new RegExp(`<p:${tag}>([\\s\\S]*?)<\\/p:${tag}>`, "g");
    let match;
    while ((match = shapeRegex.exec(xml)) !== null) {
      const inner = match[1];
      const name = decodeXmlAttribute(inner.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1] || "");
      const transform = inner.match(/<(?:a|p):xfrm>[\s\S]*?<a:off x="(-?\d+)" y="(-?\d+)"\/>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    const fillMatch = inner.match(/<a:solidFill><a:srgbClr val="([0-9a-fA-F]{6})"/);
    const fontMatch = inner.match(/<a:latin typeface="([^"]+)"/);
    const textMatch = inner.match(/<a:t>([^<]*)<\/a:t>/);
      shapes.push({
        kind, name,
        x: transform ? Number(transform[1]) / EMU : null,
        y: transform ? Number(transform[2]) / EMU : null,
        w: transform ? Number(transform[3]) / EMU : null,
        h: transform ? Number(transform[4]) / EMU : null,
        fill: fillMatch ? fillMatch[1].toLowerCase() : null,
        alpha: Number(inner.match(/<a:alpha val="(\d+)"\/>/)?.[1] || 100000) / 100000,
        font: fontMatch ? fontMatch[1] : null,
        fontSize: Number(inner.match(/<a:rPr\b[^>]*\bsz="(\d+)"/)?.[1] || 0) / 75 || null,
        text: textMatch ? textMatch[1] : null,
        gradient: extractGradient(inner),
        rounded: /<a:prstGeom prst="roundRect">/.test(inner),
        masked: /<a:custGeom>/.test(inner),
        crop: extractCrop(inner)
      });
    }
  }
  return shapes;
}

function compareShapeFidelity(diffs, slide, expected, actual) {
  const elementId = expected.name;
  for (const key of ["x", "y", "w", "h"]) {
    if (!Number.isFinite(actual[key]) || Math.abs(Number(expected[key]) - actual[key]) > 1) {
      diffs.push({ slide, elementId, issue:"geometry-mismatch", field:key, expected:Number(expected[key]), actual:actual[key] });
    }
  }
  if (![actual.x, actual.y, actual.w, actual.h].every(Number.isFinite) || actual.w <= 0 || actual.h <= 0) diffs.push({ slide, elementId, issue:"invalid-geometry" });
  if (actual.x < -1 || actual.y < -1 || actual.x + actual.w > SLIDE_WIDTH + 1 || actual.y + actual.h > SLIDE_HEIGHT + 1) diffs.push({ slide, elementId, issue:"out-of-bounds" });
  if (expected.fontSize && (!actual.fontSize || Math.abs(Number(expected.fontSize) - actual.fontSize) > 0.6)) diffs.push({ slide, elementId, issue:"font-size-mismatch", expected:Number(expected.fontSize), actual:actual.fontSize });
  if (expected.fontSize && (!Number.isFinite(actual.fontSize) || actual.fontSize <= 0)) diffs.push({ slide, elementId, issue:"invalid-font-size" });
  const expectedFill = solidShapeColor(expected.fill);
  if (expectedFill && actual.fill && expectedFill.toLowerCase() !== actual.fill.toLowerCase()) diffs.push({ slide, elementId, issue:"fill-mismatch", expected:expectedFill, actual:actual.fill });
  if (expected.fontFamily && actual.font) {
    const expectedClass = classifyFont(expected.fontFamily);
    const actualClass = classifyFont(actual.font);
    if (expectedClass.category && actualClass.category && expectedClass.category !== actualClass.category) diffs.push({ slide, elementId, issue:"font-class-mismatch", expected:expected.fontFamily, actual:actual.font });
  }
  const expectedAlpha = shapeAlpha(expected);
  if (expectedAlpha < 1 && Math.abs(expectedAlpha - actual.alpha) > 0.01) diffs.push({ slide, elementId, issue:"alpha-mismatch", expected:expectedAlpha, actual:actual.alpha });
  if (expected.fill?.type === "gradient" && !actual.gradient) diffs.push({ slide, elementId, issue:"gradient-missing" });
  if (expected.fill?.type === "gradient" && actual.gradient && Math.abs(Number(expected.fill.rot || 0) - actual.gradient.rot) > 60000) diffs.push({ slide, elementId, issue:"gradient-direction-mismatch", expected:expected.fill.rot, actual:actual.gradient.rot });
  if (expected.borderRadius && !actual.rounded && !actual.masked) diffs.push({ slide, elementId, issue:"rounded-geometry-missing" });
  if (expected.clipPath && !actual.masked) diffs.push({ slide, elementId, issue:"mask-missing" });
  if (expected.crop && !actual.crop) diffs.push({ slide, elementId, issue:"crop-missing" });
  if (actual.crop && Object.values(actual.crop).some((value) => !Number.isFinite(value) || value < 0 || value > 1)) diffs.push({ slide, elementId, issue:"invalid-crop" });
}

function solidShapeColor(value) {
  if (typeof value === "string") return normalizeHexColor(value, "");
  if (value && typeof value === "object" && value.type !== "gradient" && value.hex) return normalizeHexColor(value.hex, "");
  return "";
}

function extractGradient(xml) {
  const match = xml.match(/<a:gradFill\b[\s\S]*?<a:lin ang="(-?\d+)"/);
  return match ? { rot:Number(match[1]) } : null;
}

function extractCrop(xml) {
  const match = xml.match(/<a:srcRect\b([^>]*)\/>/);
  if (!match) return null;
  const value = (name) => Number(new RegExp(`\\b${name}="(\\d+)"`).exec(match[1])?.[1] || 0) / 100000;
  return { left:value("l"), top:value("t"), right:value("r"), bottom:value("b") };
}

function shapeAlpha(shape) {
  for (const value of [shape.fill, shape.color]) if (value && typeof value === "object" && value.alpha != null) return Number(value.alpha);
  return 1;
}

function repairRenderedSlidesForPptx(slides) {
  return slides.map((slide) => ({ ...slide, shapes:(slide.shapes || []).map((shape) => {
    const next = { ...shape };
    next.x = Math.max(0, Math.min(SLIDE_WIDTH - 1, Number(next.x) || 0));
    next.y = Math.max(0, Math.min(SLIDE_HEIGHT - 1, Number(next.y) || 0));
    next.w = Math.max(1, Math.min(SLIDE_WIDTH - next.x, Number(next.w) || 1));
    next.h = Math.max(1, Math.min(SLIDE_HEIGHT - next.y, Number(next.h) || 1));
    if (next.fontSize != null) next.fontSize = Math.max(1, Math.min(400, Number(next.fontSize) || 18));
    if (next.crop) next.crop = Object.fromEntries(Object.entries(next.crop).map(([key, value]) => [key, Math.max(0, Math.min(1, Number(value) || 0))]));
    return next;
  }) }));
}

function decodeXmlAttribute(value) {
  return String(value || "").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function colorsMatch(canvasColor, pptxHex) {
  const hexMatch = String(canvasColor).match(/#?([0-9a-fA-F]{6})/);
  if (!hexMatch) return false;
  return hexMatch[1].toLowerCase() === pptxHex.toLowerCase();
}
