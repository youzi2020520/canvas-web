import fs from "node:fs/promises";
import path from "node:path";
import { pluginRoot } from "./paths.mjs";
import { ensureProjectStore } from "./store.mjs";

await loadWebEnvFile();

const DEFAULT_PUBLIC_URL = "https://canvas.websyc.tech/";

export function isWebRuntime() {
  return process.env.CODEX_CANVAS_RUNTIME === "web" || process.env.CODEX_CANVAS_REMOTE_MODE === "1";
}

export function webProjectDir() {
  const configured = String(process.env.CODEX_CANVAS_WEB_PROJECT_DIR || "").trim();
  return path.resolve(configured || path.join(pluginRoot, ".web-data", "default"));
}

export function webPublicUrl() {
  const raw = String(process.env.CODEX_CANVAS_PUBLIC_URL || DEFAULT_PUBLIC_URL).trim() || DEFAULT_PUBLIC_URL;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export function webMcpHost() {
  return String(process.env.CODEX_CANVAS_MCP_HOST || "127.0.0.1").trim() || "127.0.0.1";
}

export function webMcpPort() {
  const value = Number(process.env.CODEX_CANVAS_MCP_PORT || 8787);
  return Number.isInteger(value) && value > 0 && value <= 65535 ? value : 8787;
}

export function webCanvasHost() {
  return String(process.env.CODEX_CANVAS_WEB_HOST || "127.0.0.1").trim() || "127.0.0.1";
}

export function webCanvasPort() {
  const value = Number(process.env.CODEX_CANVAS_WEB_PORT || 43217);
  return Number.isInteger(value) && value > 0 && value <= 65535 ? value : 43217;
}

export async function ensureWebProject() {
  const projectDir = webProjectDir();
  await fs.mkdir(projectDir, { recursive: true });
  await ensureProjectStore(projectDir);
  return projectDir;
}

export function webRegistryPath() {
  return path.join(webProjectDir(), "canvas", ".web-projects.json");
}

export function requireOptionalBearer(request) {
  const expected = String(process.env.CODEX_CANVAS_MCP_TOKEN || "").trim();
  if (!expected) return;
  const header = String(request.headers.authorization || "");
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (token === expected) return;
  const error = new Error("Unauthorized MCP request.");
  error.statusCode = 401;
  throw error;
}


async function loadWebEnvFile() {
  const configured = String(process.env.CODEX_CANVAS_ENV_FILE || "").trim();
  const envPath = path.resolve(configured || path.join(pluginRoot, ".env.web"));
  let text;
  try { text = await fs.readFile(envPath, "utf8"); }
  catch (error) { if (error?.code === "ENOENT") return; throw error; }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, "\n");
  }
}
