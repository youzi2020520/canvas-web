import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const templatesRoot = fileURLToPath(new URL("../skills/slide-templates/templates/", import.meta.url));
const FREEFORM_ID = "freeform";
const templateCache = new Map();
let listingCache = null;

function readTemplateFile(id) {
  const filePath = path.join(templatesRoot, `${id}.json`);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function isFreeformTemplate(id) {
  return !id || id === FREEFORM_ID;
}

export function loadTemplate(id) {
  if (isFreeformTemplate(id)) return null;
  if (templateCache.has(id)) return templateCache.get(id);
  const template = readTemplateFile(id);
  if (template.id !== id) {
    throw new Error(`Template file ${id}.json has mismatched id field: ${template.id}`);
  }
  templateCache.set(id, template);
  return template;
}

export function listTemplates() {
  if (listingCache) return listingCache;
  const files = fs.readdirSync(templatesRoot).filter((name) => name.endsWith(".json"));
  listingCache = files.map((name) => {
    const template = JSON.parse(fs.readFileSync(path.join(templatesRoot, name), "utf8"));
    return {
      id: template.id,
      purpose: template.purpose,
      industry: template.industry,
      style: template.style,
      expression: template.expression,
      audience: template.audience,
      scenario: template.scenario,
      density: template.density
    };
  });
  return listingCache;
}

export function resolvePageRoleSlot(template, roleKey) {
  if (!template || !template.pageRoleSlots) return null;
  return template.pageRoleSlots[roleKey] || null;
}
