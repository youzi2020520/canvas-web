import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "codex-canvas-web-smoke-"));
const port = 18787;
const child = spawn(process.execPath, [new URL("../web-mcp/server.mjs", import.meta.url).pathname], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    CODEX_CANVAS_WEB_PROJECT_DIR: temp,
    CODEX_CANVAS_MCP_HOST: "127.0.0.1",
    CODEX_CANVAS_MCP_PORT: String(port),
    CODEX_CANVAS_PUBLIC_URL: "https://canvas.websyc.tech/",
    CODEX_CANVAS_RUNTIME: "web",
    CODEX_CANVAS_REMOTE_MODE: "1"
  }
});
try {
  await waitFor(`http://127.0.0.1:${port}/health`);
  const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
  if (!health.ok) throw new Error("Web MCP health check failed");
  console.log(JSON.stringify(health, null, 2));
} finally {
  child.kill("SIGTERM");
  await fs.rm(temp, { recursive: true, force: true });
}

async function waitFor(url) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
