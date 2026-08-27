import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { zipSync } from "fflate";
import { PNG } from "pngjs";
import { exportSlidesPptx } from "./pptx-export.mjs";

const execFileAsync = promisify(execFile);

async function convertPptxToPdf(pptx, tempDir) {
  const input = path.join(tempDir, "slides.pptx");
  const profile = path.join(tempDir, "office-profile");
  await fs.writeFile(input, pptx.buffer);
  await fs.mkdir(profile, { recursive:true });
  const args = ["--headless", `-env:UserInstallation=${pathToFileURL(profile).href}`, "--convert-to", "pdf", "--outdir", tempDir, input];
  try { await execFileAsync(process.platform === "win32" ? "soffice.exe" : "soffice", args, { windowsHide:true, timeout:120_000, maxBuffer:2_000_000 }); }
  catch (error) { throw Object.assign(new Error(`PDF conversion is unavailable: ${String(error?.message || error).slice(0, 500)}`), { statusCode:503 }); }
  const pdfPath = path.join(tempDir, "slides.pdf");
  const buffer = await fs.readFile(pdfPath).catch(() => null);
  if (!buffer?.length) throw Object.assign(new Error("PDF conversion finished without an output file."), { statusCode:500 });
  return buffer;
}

async function renderPdfPages(pdfBuffer, tempDir) {
  const pdfPath = path.join(tempDir, "slides.pdf");
  const prefix = path.join(tempDir, "page");
  await fs.writeFile(pdfPath, pdfBuffer);
  try { await execFileAsync(process.platform === "win32" ? "pdftoppm.exe" : "pdftoppm", ["-png", "-r", "144", pdfPath, prefix], { windowsHide:true, timeout:120_000, maxBuffer:2_000_000 }); }
  catch (error) { throw Object.assign(new Error(`Page image rendering is unavailable: ${String(error?.message || error).slice(0, 500)}`), { statusCode:503 }); }
  const names = (await fs.readdir(tempDir)).filter((name) => /^page-\d+\.png$/i.test(name)).sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]));
  if (!names.length) throw Object.assign(new Error("Page image rendering finished without output files."), { statusCode:500 });
  return Promise.all(names.map(async (name, index) => ({ name:`slide-${String(index + 1).padStart(2, "0")}.png`, buffer:await fs.readFile(path.join(tempDir, name)) })));
}

function stitchPages(pages, gap = 24) {
  const images = pages.map((page) => PNG.sync.read(page.buffer));
  const width = Math.max(...images.map((image) => image.width));
  const height = images.reduce((sum, image) => sum + image.height, 0) + gap * Math.max(0, images.length - 1);
  if (width * height > 180_000_000) throw Object.assign(new Error("The long image would exceed the safe export size; use the image package instead."), { statusCode:422 });
  const output = new PNG({ width, height, colorType:6 });
  output.data.fill(255);
  let y = 0;
  for (const image of images) {
    PNG.bitblt(image, output, 0, 0, image.width, image.height, Math.floor((width - image.width) / 2), y);
    y += image.height + gap;
  }
  return PNG.sync.write(output);
}

export async function exportSlidesDocument(projectDir, deckId, format, options = {}) {
  if (!["pdf", "images", "long-png"].includes(format)) throw Object.assign(new Error("Unsupported slide export format."), { statusCode:400 });
  const pptx = await exportSlidesPptx(projectDir, deckId, options);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-canvas-slides-export-"));
  try {
    const pdf = await convertPptxToPdf(pptx, tempDir);
    const stem = path.basename(pptx.filename, path.extname(pptx.filename));
    if (format === "pdf") return { buffer:pdf, filename:`${stem}.pdf`, contentType:"application/pdf" };
    const pages = await renderPdfPages(pdf, tempDir);
    if (format === "images") {
      const entries = Object.fromEntries(pages.map((page) => [page.name, new Uint8Array(page.buffer)]));
      return { buffer:Buffer.from(zipSync(entries, { level:6 })), filename:`${stem}-images.zip`, contentType:"application/zip" };
    }
    return { buffer:stitchPages(pages), filename:`${stem}-long.png`, contentType:"image/png" };
  } finally {
    await fs.rm(tempDir, { recursive:true, force:true }).catch(() => {});
  }
}
