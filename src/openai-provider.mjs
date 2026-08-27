import fs from "node:fs/promises";
import path from "node:path";

function apiKey() {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key) {
    const error = new Error("OPENAI_API_KEY is required for the web image/text provider.");
    error.statusCode = 503;
    throw error;
  }
  return key;
}

function imageModel() {
  return String(process.env.CODEX_CANVAS_IMAGE_MODEL || "gpt-image-2").trim() || "gpt-image-2";
}

function textModel() {
  return String(process.env.CODEX_CANVAS_TEXT_MODEL || "gpt-5.6-luna").trim() || "gpt-5.6-luna";
}

async function openaiFetch(endpoint, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${apiKey()}`);
  const baseUrl = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${endpoint}`, { ...init, headers });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { error: { message: await response.text().catch(() => "OpenAI request failed") } };
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `OpenAI API error ${response.status}`);
    error.statusCode = response.status;
    error.openai = payload;
    throw error;
  }
  return payload;
}

export async function generateOpenAIImage({ prompt, size = "auto", quality = "auto", background = "auto" } = {}) {
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) {
    const error = new Error("Image generation requires a prompt.");
    error.statusCode = 400;
    throw error;
  }
  const payload = await openaiFetch("/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: imageModel(),
      prompt: cleanPrompt,
      n: 1,
      size,
      quality,
      background,
      output_format: "png"
    })
  });
  return normalizeImagePayload(payload, cleanPrompt);
}

export async function editOpenAIImage({ imagePaths, prompt, size = "auto", quality = "auto", background = "auto" } = {}) {
  const paths = (Array.isArray(imagePaths) ? imagePaths : [imagePaths])
    .map((value) => typeof value === "string" ? value.trim() : "")
    .filter(Boolean);
  if (!paths.length) {
    const error = new Error("Image edit requires at least one local source image.");
    error.statusCode = 400;
    throw error;
  }
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) {
    const error = new Error("Image edit requires a prompt.");
    error.statusCode = 400;
    throw error;
  }

  const form = new FormData();
  form.set("model", imageModel());
  form.set("prompt", cleanPrompt);
  form.set("size", size);
  form.set("quality", quality);
  form.set("background", background);
  form.set("output_format", "png");

  for (let index = 0; index < paths.length; index += 1) {
    const imagePath = paths[index];
    const buffer = await fs.readFile(imagePath);
    const filename = path.basename(imagePath) || `image-${index + 1}.png`;
    const contentType = imageContentType(filename);
    const blob = new Blob([buffer], { type: contentType });
    const field = paths.length > 1 ? "image[]" : "image";
    form.append(field, blob, filename);
  }

  const payload = await openaiFetch("/images/edits", {
    method: "POST",
    body: form
  });
  return normalizeImagePayload(payload, cleanPrompt);
}

export async function generateOpenAIText({ prompt, instructions = "", model = "" } = {}) {
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) {
    const error = new Error("Text generation requires a prompt.");
    error.statusCode = 400;
    throw error;
  }
  const body = {
    model: String(model || textModel()).trim(),
    input: cleanPrompt
  };
  if (String(instructions || "").trim()) body.instructions = String(instructions).trim();
  const payload = await openaiFetch("/responses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    id: payload.id || null,
    model: payload.model || body.model,
    text: responseText(payload),
    usage: payload.usage || null
  };
}

export async function writeGeneratedImage(result, outputPath) {
  const dataUrl = result?.dataUrl || "";
  const match = /^data:image\/[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("OpenAI image result did not contain base64 image data.");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(match[1], "base64"));
  return outputPath;
}

function normalizeImagePayload(payload, prompt) {
  const item = Array.isArray(payload?.data) ? payload.data[0] : null;
  const b64 = item?.b64_json || item?.b64 || null;
  const url = item?.url || null;
  if (!b64 && !url) {
    const error = new Error("OpenAI image response did not contain an image.");
    error.statusCode = 502;
    throw error;
  }
  return {
    model: imageModel(),
    prompt,
    revisedPrompt: item?.revised_prompt || null,
    dataUrl: b64 ? `data:image/png;base64,${b64}` : null,
    url,
    usage: payload?.usage || null
  };
}

function responseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const parts = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function imageContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}
