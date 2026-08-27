import http from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { addImage, promptHistory, readState, searchObjects, versionGroups } from "../src/store.mjs";
import { generateOpenAIImage, editOpenAIImage, generateOpenAIText } from "../src/openai-provider.mjs";
import { APP_VERSION } from "../src/version.mjs";
import { ensureWebProject, requireOptionalBearer, webMcpHost, webMcpPort, webPublicUrl } from "../src/web-runtime.mjs";

const TEMPLATE_URI = "ui://codex-canvas/web/v1.html";
const sessions = new Map();
const maxBodyBytes = 2 * 1024 * 1024;
const projectDir = await ensureWebProject();
const publicUrl = webPublicUrl();

function buildMcpServer() {
  const server = new McpServer(
    { name: "codex-canvas-web", version: APP_VERSION },
    {
      instructions: "Codex-Canvas Web is a server-backed visual canvas. Use canvas_status/search/prompt_history/version_groups for data. Use generate_image/edit_image/add_image for canvas mutations. Use open_canvas only when the user wants the visual board rendered."
    }
  );

  server.registerResource("codex-canvas-web", TEMPLATE_URI, {}, async () => ({
    contents: [{
      uri: TEMPLATE_URI,
      mimeType: "text/html;profile=mcp-app",
      text: widgetHtml(publicUrl),
      _meta: {
        ui: {
          prefersBorder: false,
          domain: new URL(publicUrl).origin,
          csp: {
            frameDomains: [new URL(publicUrl).origin],
            connectDomains: [new URL(publicUrl).origin],
            resourceDomains: [new URL(publicUrl).origin]
          }
        }
      }
    }]
  }));

  server.registerTool("open_canvas", {
    title: "Open Codex-Canvas",
    description: "Render the Codex-Canvas web board. Use when the user asks to open, show, or work visually on the canvas.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    _meta: {
      ui: { resourceUri: TEMPLATE_URI },
      "openai/outputTemplate": TEMPLATE_URI,
      "openai/toolInvocation/invoking": "Opening Codex-Canvas…",
      "openai/toolInvocation/invoked": "Codex-Canvas opened."
    }
  }, async () => {
    const state = await readState(projectDir);
    return toolResult(`Codex-Canvas is ready at ${publicUrl}`, {
      mode: "web",
      url: publicUrl,
      objects: state.objects.length,
      selection: state.selection,
      updatedAt: state.updatedAt
    });
  });

  server.registerTool("canvas_status", {
    title: "Get canvas status",
    description: "Read the current server-backed Codex-Canvas state.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
  }, async () => {
    const state = await readState(projectDir);
    return toolResult(`Codex-Canvas has ${state.objects.length} object(s).`, {
      mode: "web", objects: state.objects.length, selection: state.selection, updatedAt: state.updatedAt, url: publicUrl
    });
  });

  server.registerTool("search_canvas", {
    title: "Search canvas",
    description: "Search Codex-Canvas objects by name, prompt, text, source, or metadata.",
    inputSchema: {
      query: z.string().optional(),
      type: z.enum(["image", "text", "drawing", "annotation", "job"]).optional(),
      limit: z.number().int().min(1).max(100).optional()
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
  }, async ({ query = "", type, limit = 20 }) => {
    const result = await searchObjects(projectDir, { query, type: type || null, limit });
    return toolResult(`Found ${result.total} Codex-Canvas object(s).`, result);
  });

  server.registerTool("prompt_history", {
    title: "List canvas prompts",
    description: "List recent unique prompts associated with Codex-Canvas objects.",
    inputSchema: { query: z.string().optional(), limit: z.number().int().min(1).max(100).optional() },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
  }, async ({ query = "", limit = 20 }) => {
    const result = await promptHistory(projectDir, { query, limit });
    return toolResult(`Found ${result.total} Codex-Canvas prompt(s).`, result);
  });

  server.registerTool("version_groups", {
    title: "List canvas versions",
    description: "Group Codex-Canvas object versions for reviewing generated or edited variants.",
    inputSchema: {
      query: z.string().optional(),
      groupBy: z.enum(["sourceObjectId", "batchId", "layoutMode", "prompt"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      objectLimit: z.number().int().min(1).max(100).optional()
    },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
  }, async ({ query = "", groupBy = "sourceObjectId", limit = 20, objectLimit = 20 }) => {
    const result = await versionGroups(projectDir, { query, groupBy, limit, objectLimit });
    return toolResult(`Found ${result.total} Codex-Canvas version group(s).`, result);
  });

  server.registerTool("add_image", {
    title: "Add image to canvas",
    description: "Add a remote image URL or base64 data URL to the web canvas. Local filesystem paths are intentionally not accepted in web mode.",
    inputSchema: {
      url: z.string().url().optional(),
      dataUrl: z.string().optional(),
      name: z.string().max(300).optional(),
      prompt: z.string().max(4000).optional(),
      imagegenPrompt: z.string().max(20000).optional()
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false }
  }, async (args) => {
    requireOneWebImageInput(args);
    const object = await addImage(projectDir, args);
    return toolResult(`Added ${object.name || object.id} to Codex-Canvas.`, object);
  });

  server.registerTool("generate_image", {
    title: "Generate image",
    description: "Generate an image with the configured OpenAI image model (GPT Image 2 by default) and place it directly on Codex-Canvas.",
    inputSchema: {
      prompt: z.string().min(1).max(20000),
      name: z.string().max(300).optional(),
      size: z.enum(["auto", "1024x1024", "1024x1536", "1536x1024"]).optional(),
      quality: z.enum(["auto", "low", "medium", "high"]).optional(),
      background: z.enum(["auto", "opaque", "transparent"]).optional()
    },
    annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
    _meta: {
      "openai/toolInvocation/invoking": "Generating image…",
      "openai/toolInvocation/invoked": "Image generated."
    }
  }, async ({ prompt, name, size = "auto", quality = "auto", background = "auto" }) => {
    const generated = await generateOpenAIImage({ prompt, size, quality, background });
    const object = await addImage(projectDir, {
      dataUrl: generated.dataUrl,
      url: generated.dataUrl ? undefined : generated.url,
      name: name || `gpt-image-${Date.now()}.png`,
      prompt,
      imagegenPrompt: prompt,
      allowDuplicate: true
    });
    return toolResult(`Generated an image and added it to Codex-Canvas as ${object.name}.`, {
      object,
      model: generated.model,
      revisedPrompt: generated.revisedPrompt,
      usage: generated.usage,
      canvasUrl: publicUrl
    });
  });

  server.registerTool("edit_image", {
    title: "Edit canvas image",
    description: "Edit a selected server-backed canvas image with GPT Image 2 and add the result as a new version beside the source.",
    inputSchema: {
      objectId: z.string().min(1),
      prompt: z.string().min(1).max(20000),
      name: z.string().max(300).optional(),
      size: z.enum(["auto", "1024x1024", "1024x1536", "1536x1024"]).optional(),
      quality: z.enum(["auto", "low", "medium", "high"]).optional(),
      background: z.enum(["auto", "opaque", "transparent"]).optional()
    },
    annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
    _meta: {
      "openai/toolInvocation/invoking": "Editing image…",
      "openai/toolInvocation/invoked": "Image edited."
    }
  }, async ({ objectId, prompt, name, size = "auto", quality = "auto", background = "auto" }) => {
    const state = await readState(projectDir);
    const source = state.objects.find((item) => item.id === objectId && (item.type || "image") === "image");
    if (!source) throw clientError(`Canvas image not found: ${objectId}`, 404);
    const sourcePath = source.assetPath || source.sourcePath;
    if (!sourcePath) throw clientError("The selected image is remote-only. Import it as a local canvas asset before editing.", 400);
    const edited = await editOpenAIImage({ imagePaths: [sourcePath], prompt, size, quality, background });
    const object = await addImage(projectDir, {
      dataUrl: edited.dataUrl,
      url: edited.dataUrl ? undefined : edited.url,
      name: name || `${source.name || "image"}-edit.png`,
      prompt,
      imagegenPrompt: prompt,
      sourceObjectId: source.id,
      x: Number(source.x || 0) + Number(source.width || 360) + 72,
      y: Number(source.y || 0),
      allowDuplicate: true
    });
    return toolResult(`Edited ${source.name || source.id} and added a new canvas version.`, {
      sourceObjectId: source.id,
      object,
      model: edited.model,
      revisedPrompt: edited.revisedPrompt,
      usage: edited.usage,
      canvasUrl: publicUrl
    });
  });

  server.registerTool("generate_text", {
    title: "Generate text",
    description: "Run the configured OpenAI text model for plugin-side text generation when server-side AI output is required.",
    inputSchema: {
      prompt: z.string().min(1).max(50000),
      instructions: z.string().max(20000).optional(),
      model: z.string().max(100).optional()
    },
    annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false }
  }, async ({ prompt, instructions = "", model = "" }) => {
    const result = await generateOpenAIText({ prompt, instructions, model });
    return toolResult("Generated text with the configured OpenAI model.", result);
  });

  return server;
}

const httpServer = http.createServer(async (req, res) => {
  try {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    const url = new URL(req.url || "/", "http://codex-canvas.local");
    if (url.pathname === "/health") {
      sendJson(res, 200, { ok: true, name: "codex-canvas-web-mcp", version: APP_VERSION, canvasUrl: publicUrl });
      return;
    }
    if (url.pathname !== "/mcp") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    requireOptionalBearer(req);
    const body = req.method === "POST" ? await readJsonBody(req) : undefined;
    const sessionId = String(req.headers["mcp-session-id"] || "").trim();

    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId).handleRequest(req, res, body);
      return;
    }

    if (!sessionId && req.method === "POST" && isInitializeRequest(body)) {
      let transport;
      const mcp = buildMcpServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => sessions.set(id, transport),
        enableJsonResponse: false
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
      return;
    }

    sendJson(res, sessionId ? 404 : 400, {
      jsonrpc: "2.0",
      error: { code: -32000, message: sessionId ? "Unknown MCP session" : "Initialize the MCP session first" },
      id: null
    });
  } catch (error) {
    if (!res.headersSent) sendJson(res, error?.statusCode || 500, { error: error?.message || String(error) });
    else res.end();
  }
});

httpServer.listen(webMcpPort(), webMcpHost(), () => {
  console.log(`Codex-Canvas Web MCP listening on http://${webMcpHost()}:${webMcpPort()}/mcp`);
  console.log(`Canvas: ${publicUrl}`);
  console.log(`Project data: ${projectDir}`);
});

function toolResult(text, structuredContent) {
  return { content: [{ type: "text", text }], structuredContent };
}

function requireOneWebImageInput(args) {
  const count = [args?.url, args?.dataUrl].filter((value) => typeof value === "string" && value.trim()).length;
  if (count !== 1) throw clientError("add_image requires exactly one of url or dataUrl in web mode.", 400);
}

function clientError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBodyBytes) throw clientError("MCP request body is too large.", 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return undefined;
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw clientError("MCP request body must be valid JSON.", 400); }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function setCors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,mcp-session-id,mcp-protocol-version,last-event-id");
  res.setHeader("access-control-expose-headers", "mcp-session-id,mcp-protocol-version");
}

function widgetHtml(initialUrl) {
  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{height:100%;margin:0;background:#0f1115;color:#fff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#shell{height:100%;min-height:520px;display:flex;flex-direction:column}.bar{height:44px;display:flex;align-items:center;gap:10px;padding:0 12px;background:#151820;border-bottom:1px solid #2a2e38;font-size:13px}.dot{width:8px;height:8px;border-radius:50%;background:#39d98a}.title{font-weight:600}.sub{opacity:.62}.bar a{margin-left:auto;color:#b9c7ff;text-decoration:none}.frame{flex:1;width:100%;border:0;background:#101217}</style></head>
<body><div id="shell"><div class="bar"><span class="dot"></span><span class="title">Codex-Canvas</span><span class="sub">Web runtime</span><a id="external" href="${escapeHtml(initialUrl)}" target="_blank" rel="noreferrer">Open full screen ↗</a></div><iframe class="frame" id="canvas" src="${escapeHtml(initialUrl)}"></iframe></div>
<script>let current=${JSON.stringify(initialUrl)};const f=document.getElementById('canvas'),a=document.getElementById('external');window.addEventListener('message',(event)=>{const m=event.data;if(m&&m.jsonrpc==='2.0'&&m.method==='ui/notifications/tool-result'){const u=m.params&&m.params.structuredContent&&m.params.structuredContent.url;if(typeof u==='string'&&u&&u!==current){current=u;f.src=u;a.href=u;}}},{passive:true});</script></body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
