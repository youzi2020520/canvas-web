import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const children = [
  spawn(process.execPath, [path.join(root, "src", "web-canvas-server.mjs")], { stdio: "inherit", env: { ...process.env, CODEX_CANVAS_RUNTIME: "web", CODEX_CANVAS_REMOTE_MODE: "1" } }),
  spawn(process.execPath, [path.join(root, "web-mcp", "server.mjs")], { stdio: "inherit", env: { ...process.env, CODEX_CANVAS_RUNTIME: "web", CODEX_CANVAS_REMOTE_MODE: "1" } })
];

let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 250).unref();
}
for (const child of children) {
  child.on("exit", (code) => { if (!closing && code) close(code); });
}
process.on("SIGINT", () => close(0));
process.on("SIGTERM", () => close(0));
