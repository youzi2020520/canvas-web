import { createServer } from "./server.mjs";
import { ensureWebProject, webCanvasHost, webCanvasPort, webRegistryPath } from "./web-runtime.mjs";

process.env.CODEX_CANVAS_RUNTIME = "web";
process.env.CODEX_CANVAS_REMOTE_MODE = "1";

const projectDir = await ensureWebProject();
const { url } = await createServer({
  projectDir,
  host: webCanvasHost(),
  port: webCanvasPort(),
  autoCollect: false,
  persistentRegistryPath: webRegistryPath()
});

console.log(`Codex-Canvas Web UI listening on ${url}`);
console.log(`Project data: ${projectDir}`);
await new Promise(() => {});
