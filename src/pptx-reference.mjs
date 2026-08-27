import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function xmlText(xml) {
  return [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXml(match[1]).replace(/\s+/g, " ").trim()).filter(Boolean);
}

function entryText(entries, name) {
  const bytes = entries[name];
  return bytes ? new TextDecoder().decode(bytes) : "";
}

function slideNumber(name) {
  return Number(/slide(\d+)\.xml$/i.exec(name)?.[1] || 0);
}

function relationshipMap(xml) {
  const relationships = new Map();
  for (const match of xml.matchAll(/<Relationship\b([^>]+?)\/?>(?:<\/Relationship>)?/gi)) {
    const attributes = match[1];
    const id = /\bId="([^"]+)"/i.exec(attributes)?.[1];
    const target = /\bTarget="([^"]+)"/i.exec(attributes)?.[1];
    if (id && target) relationships.set(id, decodeXml(target));
  }
  return relationships;
}

function mediaEntryForSlide(entries, slideName) {
  const number = slideNumber(slideName);
  const rels = relationshipMap(entryText(entries, `ppt/slides/_rels/slide${number}.xml.rels`));
  const xml = entryText(entries, slideName);
  const ids = [...xml.matchAll(/<a:blip\b[^>]*\br:embed="([^"]+)"/gi)].map((match) => match[1]);
  for (const id of ids) {
    const target = rels.get(id);
    if (!target || !/\.(?:png|jpe?g|webp)$/i.test(target)) continue;
    const normalized = path.posix.normalize(path.posix.join("ppt/slides", target));
    if (entries[normalized]) return normalized;
  }
  return null;
}

function representativeIndexes(length, limit = 4) {
  if (length <= limit) return Array.from({ length }, (_, index) => index);
  const preferred = [0, 1, Math.round((length - 1) / 2), length - 1];
  return [...new Set(preferred)].slice(0, limit);
}

function themeFonts(themeXml) {
  return [...themeXml.matchAll(/<a:(?:latin|ea|cs)\b[^>]*\btypeface="([^"]*)"/gi)]
    .map((match) => decodeXml(match[1]).trim()).filter((value) => value && !value.startsWith("+"))
    .filter((value, index, all) => all.indexOf(value) === index).slice(0, 8);
}

export async function inspectPptxReference(buffer, outputDir, label = "reference.pptx") {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100 || buffer.length > 16 * 1024 * 1024) throw new Error("PPTX reference must be between 100 bytes and 16 MB.");
  let entries;
  try { entries = unzipSync(new Uint8Array(buffer)); } catch { throw new Error("The PowerPoint reference is not a valid PPTX file."); }
  const slideNames = Object.keys(entries).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)).sort((left, right) => slideNumber(left) - slideNumber(right));
  if (!slideNames.length) throw new Error("The PPTX reference contains no readable slides.");

  const presentationXml = entryText(entries, "ppt/presentation.xml");
  const sizeMatch = /<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/.exec(presentationXml);
  const slideWidth = Number(sizeMatch?.[1]) || 0;
  const slideHeight = Number(sizeMatch?.[2]) || 0;
  const aspectRatio = slideWidth && slideHeight ? (slideWidth / slideHeight).toFixed(3) : "unknown";
  const slides = slideNames.slice(0, 40).map((name) => {
    const text = xmlText(entryText(entries, name)).join(" · ").slice(0, 1800);
    return { number:slideNumber(name), text, mediaEntry:mediaEntryForSlide(entries, name) };
  });
  const flattenedSlides = slides.filter((slide) => slide.mediaEntry && !slide.text);
  const flattenedRatio = flattenedSlides.length / slides.length;

  const themeXml = entryText(entries, "ppt/theme/theme1.xml");
  const colors = [...themeXml.matchAll(/<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/g)]
    .map((match) => `#${match[1].toUpperCase()}`)
    .filter((value, index, all) => all.indexOf(value) === index).slice(0, 12);
  const fonts = themeFonts(themeXml);

  const mediaPaths = [];
  const selectedSlides = representativeIndexes(slides.length).map((index) => slides[index]).filter(Boolean);
  for (const slide of selectedSlides) {
    const name = slide.mediaEntry;
    const bytes = name ? entries[name] : null;
    if (!bytes?.length || bytes.length > 6 * 1024 * 1024) continue;
    const extension = path.extname(name).toLowerCase();
    const target = path.join(outputDir, `pptx-slide-${String(slide.number).padStart(2, "0")}${extension}`);
    await fs.writeFile(target, bytes);
    mediaPaths.push(target);
  }

  const flattened = flattenedRatio >= 0.75;
  const context = [
    `PowerPoint visual source: ${String(label || "reference.pptx").slice(0, 160)}`,
    `Slides: ${slideNames.length}; aspect ratio: ${aspectRatio}.`,
    flattened
      ? "REFERENCE MODE: FLATTENED-SLIDE SOURCE. Most source pages are full-slide raster compositions, so OOXML theme colors and fonts are not reliable. The attached representative source pages are the binding source of truth for palette, typography appearance, margins, image masks, decoration, density, and light/dark page rhythm. Do not substitute a generic technology, corporate, dashboard, or card-grid style."
      : `Declared theme colors: ${colors.join(", ") || "not declared"}; declared fonts: ${fonts.join(", ") || "not declared"}.`,
    `Representative source pages attached: ${selectedSlides.map((slide) => slide.number).join(", ")}. Map the generated opening to source page 1, navigation/overview to source page 2 when applicable, content pages to the middle reference family, and the closing page to the final source page.`,
    ...slides.map((slide) => `Reference slide ${slide.number}: ${slide.text || (slide.mediaEntry ? "[full-slide visual composition]" : "[visual-only slide]")}`)
  ].join("\n").slice(0, 60_000);
  return { context, mediaPaths, slideCount:slideNames.length, colors, fonts, aspectRatio, flattened, representativeSlides:selectedSlides.map((slide) => slide.number) };
}
