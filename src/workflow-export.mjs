import { spawn } from "node:child_process";
import path from "node:path";
import { readState } from "./store.mjs";

const resolutions = {
  "1k": 1024,
  "2k": 2048,
  "4k": 4096
};
const formats = new Set(["jpeg", "png"]);
const maxExportBytes = 128 * 1024 * 1024;

export async function exportWorkflowImage(projectDir, objectId, resolution, format, storeOptions = {}, scale = null) {
  const normalizedFormat = formats.has(format) ? format : "png";
  const state = await readState(projectDir, storeOptions);
  const object = state.objects.find((item) => item.id === objectId && (item.type || "image") === "image");
  const imagePath = object?.assetPath || object?.sourcePath;
  if (!object || !imagePath) {
    const error = new Error("Workflow image not found.");
    error.statusCode = 404;
    throw error;
  }

  // scale 模式：由后端通过 Pillow 识别源图像真实分辨率后按倍率放大；
  // 否则回退到按最长边 (1k/2k/4k) 导出的既有逻辑。
  const numericScale = Number.parseFloat(scale);
  const useScale = Number.isFinite(numericScale) && numericScale > 0 && numericScale !== 1;

  let buffer;
  let suffix;
  if (useScale) {
    buffer = await resizeWithPillow(imagePath, null, normalizedFormat, numericScale);
    suffix = `${numericScale}x`;
  } else {
    const normalizedResolution = resolutions[resolution] ? resolution : "1k";
    buffer = await resizeWithPillow(imagePath, resolutions[normalizedResolution], normalizedFormat, null);
    suffix = normalizedResolution;
  }

  const extension = normalizedFormat === "jpeg" ? "jpg" : "png";
  return {
    buffer,
    contentType: normalizedFormat === "jpeg" ? "image/jpeg" : "image/png",
    filename: `${safeBaseName(object.name)}-${suffix}.${extension}`
  };
}

function resizeWithPillow(imagePath, longestEdge, format, scaleFactor = null) {
  const useScale = Number.isFinite(scaleFactor) && scaleFactor > 0;
  // argv: source, output_format, mode, value
  //   mode="scale"  -> value 为倍率，target = round(width*value, height*value)
  //   mode="longest" -> value 为最长边，target 按最长边等比缩放
  const mode = useScale ? "scale" : "longest";
  const value = useScale ? String(scaleFactor) : String(longestEdge || 1024);
  const script = [
    "import io, sys",
    "from PIL import Image, ImageOps",
    "source, output_format, mode, value = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]",
    "with Image.open(source) as opened:",
    "    image = ImageOps.exif_transpose(opened)",
    "    width, height = image.size",
    "    if mode == 'scale':",
    "        factor = float(value)",
    "        target = (max(1, round(width * factor)), max(1, round(height * factor)))",
    "    else:",
    "        longest = int(value)",
    "        ratio = longest / max(width, height)",
    "        target = (max(1, round(width * ratio)), max(1, round(height * ratio)))",
    "    image = image.resize(target, Image.Resampling.LANCZOS)",
    "    stream = io.BytesIO()",
    "    if output_format == 'jpeg':",
    "        if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):",
    "            rgba = image.convert('RGBA')",
    "            background = Image.new('RGB', rgba.size, 'white')",
    "            background.paste(rgba, mask=rgba.getchannel('A'))",
    "            image = background",
    "        else:",
    "            image = image.convert('RGB')",
    "        image.save(stream, format='JPEG', quality=94, optimize=True)",
    "    else:",
    "        image.save(stream, format='PNG', optimize=True)",
    "    sys.stdout.buffer.write(stream.getvalue())"
  ].join("\n");

  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-c", script, imagePath, format, mode, value], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const chunks = [];
    const errors = [];
    let total = 0;
    child.stdout.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxExportBytes) {
        child.kill();
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (total > maxExportBytes) {
        return reject(new Error("Workflow export exceeded the size limit."));
      }
      if (code !== 0) {
        return reject(new Error(Buffer.concat(errors).toString("utf8").trim() || "Workflow export failed."));
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

function safeBaseName(name) {
  const base = path.basename(String(name || "generated-image"), path.extname(String(name || "")));
  return base.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80) || "generated-image";
}
