import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(rootDir, ".codex-plugin", "plugin.json");
const ignoredDirectories = new Set([".git", "canvas", "node_modules"]);
let previousFingerprint = await fingerprint(rootDir);
let syncing = false;

console.log(`Watching ${rootDir}`);
console.log("Source changes will reinstall canvas-codex@personal for the next Codex task.");

setInterval(async () => {
  if (syncing) return;
  const currentFingerprint = await fingerprint(rootDir);
  if (currentFingerprint === previousFingerprint) return;
  syncing = true;
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const baseVersion = String(manifest.version || "0.1.0").split("+", 1)[0];
    const cachebuster = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    manifest.version = `${baseVersion}+codex.${cachebuster}`;
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await execFileAsync("codex", ["plugin", "add", `${manifest.name}@personal`], {
      cwd: rootDir,
      windowsHide: true
    });
    previousFingerprint = await fingerprint(rootDir);
    console.log(`[${new Date().toLocaleTimeString()}] Installed ${manifest.name} ${manifest.version}`);
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] Sync failed: ${error?.stderr || error?.message || error}`);
  } finally {
    syncing = false;
  }
}, 1500);

async function fingerprint(directory) {
  const entries = [];
  await collect(directory, entries);
  return entries.sort().join("\n");
}

async function collect(directory, entries) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(fullPath, entries);
    } else if (entry.isFile()) {
      const stat = await fs.stat(fullPath);
      entries.push(`${path.relative(rootDir, fullPath)}:${stat.size}:${stat.mtimeMs}`);
    }
  }
}
