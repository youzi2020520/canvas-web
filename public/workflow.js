const board = document.querySelector("#board");
const world = document.querySelector("#world");
const layer = document.querySelector("#workflowLayer");
const edgeLayer = document.querySelector("#workflowEdges");
const nodeLayer = document.querySelector("#workflowNodes");
const studioButton = document.querySelector("#workflowImageButton");
const imageInput = document.querySelector("#workflowImageInput");
const toast = document.querySelector("#toast");

const nodeSizes = {
  studio: { width: 440, height: 590 },
  image: { width: 272, height: 270 }
};
const allowedRatios = new Set(["1:1", "16:9", "9:16", "4:3", "3:4"]);
const allowedCounts = new Set([1, 2, 4]);
const search = new URLSearchParams(window.location.search);
const projectId = search.get("project") || "default";
const threadId = search.get("threadId") || "default";
const storageKey = `codexCanvasWorkflow:v2:${projectId}:${threadId}`;

let workflow = loadWorkflow();
let canvasState = { objects: [], selection: null };
let nodeDrag = null;
let connectionDraft = null;
let pendingUploadNodeId = null;
let activeStudioId = null;
let toastTimer = null;
const pollingJobs = new Set();

const copy = {
  zh: {
    tool: "图片生成",
    title: "图片生成",
    ready: "就绪",
    running: "生成中",
    done: "已完成",
    error: "失败",
    remove: "删除节点",
    uploadTitle: "上传参考图片",
    uploadHint: "点击上传、拖入图片，或按 ⌘/Ctrl + V 粘贴",
    addImage: "添加图片",
    references: "参考图片",
    prompt: "提示词",
    promptPlaceholder: "描述你想创建的图片…",
    ratio: "画面比例",
    count: "生成张数",
    generate: "生成图片",
    generating: "正在生成…",
    textMode: "文生图",
    imageMode: "图生图",
    fusionMode: "多图融合",
    continue: "继续生成",
    output: "图片输出",
    input: "图片输入",
    uploadFailed: "图片上传失败",
    promptRequired: "请输入图片描述",
    started: "生成任务已开始",
    finished: "生成完成",
    failed: "生成失败",
    connectionRemoved: "已删除连线",
    incompatible: "此端口无法连接",
    referenceRemoved: "已移除参考图",
    maxReferences: "最多添加 6 张参考图",
    imageUnavailable: "图片不可用"
  },
  en: {
    tool: "Image generation",
    title: "Image generation",
    ready: "Ready",
    running: "Generating",
    done: "Done",
    error: "Failed",
    remove: "Delete node",
    uploadTitle: "Upload reference images",
    uploadHint: "Click, drop images, or paste with ⌘/Ctrl + V",
    addImage: "Add image",
    references: "References",
    prompt: "Prompt",
    promptPlaceholder: "Describe the image you want to create…",
    ratio: "Aspect ratio",
    count: "Outputs",
    generate: "Generate",
    generating: "Generating…",
    textMode: "Text to image",
    imageMode: "Image to image",
    fusionMode: "Multi-image fusion",
    continue: "Continue",
    output: "Image output",
    input: "Image input",
    uploadFailed: "Image upload failed",
    promptRequired: "Describe the image first",
    started: "Generation started",
    finished: "Generation finished",
    failed: "Generation failed",
    connectionRemoved: "Connection removed",
    incompatible: "These ports cannot connect",
    referenceRemoved: "Reference removed",
    maxReferences: "Up to 6 reference images",
    imageUnavailable: "Image unavailable"
  }
};

studioButton?.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  await refreshCanvasState();
  const selected = selectedCanvasImage();
  addStudioNode({
    referenceObjectIds: selected ? [selected.id] : []
  });
});

imageInput?.addEventListener("change", async () => {
  const files = [...(imageInput.files || [])].filter(isImageFile);
  imageInput.value = "";
  if (!pendingUploadNodeId || !files.length) return;
  await uploadReferences(pendingUploadNodeId, files);
});

nodeLayer?.addEventListener("click", async (event) => {
  const nodeElement = event.target.closest("[data-workflow-node-id]");
  if (nodeElement?.dataset.workflowNodeType === "studio") {
    activeStudioId = nodeElement.dataset.workflowNodeId;
  }

  const remove = event.target.closest("[data-workflow-delete]");
  if (remove) {
    event.preventDefault();
    event.stopPropagation();
    deleteNode(remove.dataset.workflowDelete);
    return;
  }

  const upload = event.target.closest("[data-workflow-upload]");
  if (upload) {
    event.preventDefault();
    event.stopPropagation();
    pendingUploadNodeId = upload.dataset.workflowUpload;
    activeStudioId = pendingUploadNodeId;
    imageInput?.click();
    return;
  }

  const removeReference = event.target.closest("[data-workflow-remove-reference]");
  if (removeReference) {
    event.preventDefault();
    event.stopPropagation();
    const node = workflow.nodes.find((item) => item.id === removeReference.dataset.workflowNode);
    if (!node || node.type !== "studio") return;
    node.referenceObjectIds = node.referenceObjectIds.filter(
      (id) => id !== removeReference.dataset.workflowRemoveReference
    );
    saveWorkflow();
    renderWorkflow();
    showToast(w("referenceRemoved"));
    return;
  }

  const run = event.target.closest("[data-workflow-run]");
  if (run) {
    event.preventDefault();
    event.stopPropagation();
    runStudioNode(run.dataset.workflowRun);
    return;
  }

  const continueButton = event.target.closest("[data-workflow-continue]");
  if (continueButton) {
    event.preventDefault();
    event.stopPropagation();
    const source = workflow.nodes.find((item) => item.id === continueButton.dataset.workflowContinue);
    if (!source?.objectId) return;
    addStudioNode({
      x: source.x + nodeSizes.image.width + 110,
      y: source.y - 60,
      referenceObjectIds: [source.objectId]
    });
  }
});

nodeLayer?.addEventListener("input", (event) => {
  const nodeElement = event.target.closest("[data-workflow-node-id]");
  const node = workflow.nodes.find((item) => item.id === nodeElement?.dataset.workflowNodeId);
  if (!node || node.type !== "studio") return;
  if (event.target.matches("[data-workflow-prompt]")) {
    node.prompt = event.target.value.slice(0, 4000);
    saveWorkflow();
  }
});

nodeLayer?.addEventListener("change", (event) => {
  const nodeElement = event.target.closest("[data-workflow-node-id]");
  const node = workflow.nodes.find((item) => item.id === nodeElement?.dataset.workflowNodeId);
  if (!node || node.type !== "studio") return;
  if (event.target.matches("[data-workflow-ratio]")) {
    node.ratio = allowedRatios.has(event.target.value) ? event.target.value : "1:1";
  }
  if (event.target.matches("[data-workflow-count]")) {
    const count = Number(event.target.value);
    node.count = allowedCounts.has(count) ? count : 1;
  }
  saveWorkflow();
  renderWorkflow();
});

nodeLayer?.addEventListener("dragover", (event) => {
  if (!event.target.closest("[data-workflow-drop]")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

nodeLayer?.addEventListener("drop", async (event) => {
  const zone = event.target.closest("[data-workflow-drop]");
  if (!zone) return;
  event.preventDefault();
  event.stopPropagation();
  const files = [...(event.dataTransfer?.files || [])].filter(isImageFile);
  if (files.length) await uploadReferences(zone.dataset.workflowDrop, files);
});

document.addEventListener("paste", async (event) => {
  const studioElement = event.target.closest?.('[data-workflow-node-type="studio"]');
  const nodeId = studioElement?.dataset.workflowNodeId || activeStudioId;
  if (!nodeId) return;
  const files = [...(event.clipboardData?.files || [])].filter(isImageFile);
  if (!files.length) return;
  event.preventDefault();
  await uploadReferences(nodeId, files);
});

nodeLayer?.addEventListener("pointerdown", (event) => {
  const output = event.target.closest("[data-workflow-output]");
  if (output) {
    event.preventDefault();
    event.stopPropagation();
    const element = output.closest("[data-workflow-node-id]");
    connectionDraft = {
      fromNode: element.dataset.workflowNodeId,
      fromPort: output.dataset.workflowOutput,
      pointer: clientToWorld(event.clientX, event.clientY)
    };
    output.setPointerCapture?.(event.pointerId);
    renderEdges();
    return;
  }

  const header = event.target.closest(".studio-node-header, .result-node-header");
  if (!header || event.target.closest("button")) return;
  event.preventDefault();
  event.stopPropagation();
  const element = header.closest("[data-workflow-node-id]");
  const node = workflow.nodes.find((item) => item.id === element?.dataset.workflowNodeId);
  if (!node) return;
  const point = clientToWorld(event.clientX, event.clientY);
  nodeDrag = {
    id: node.id,
    offsetX: point.x - node.x,
    offsetY: point.y - node.y,
    pointerId: event.pointerId
  };
  element.setPointerCapture?.(event.pointerId);
  element.classList.add("dragging");
});

document.addEventListener("pointermove", (event) => {
  if (connectionDraft) {
    connectionDraft.pointer = clientToWorld(event.clientX, event.clientY);
    renderEdges();
  }
  if (!nodeDrag) return;
  const node = workflow.nodes.find((item) => item.id === nodeDrag.id);
  if (!node) return;
  const point = clientToWorld(event.clientX, event.clientY);
  node.x = Math.round(point.x - nodeDrag.offsetX);
  node.y = Math.round(point.y - nodeDrag.offsetY);
  const element = nodeLayer.querySelector(`[data-workflow-node-id="${cssEscape(node.id)}"]`);
  if (element) {
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
  }
  renderEdges();
});

document.addEventListener("pointerup", (event) => {
  if (connectionDraft) {
    const input = event.target.closest?.("[data-workflow-input]");
    if (input) {
      const element = input.closest("[data-workflow-node-id]");
      connectNodes(
        connectionDraft.fromNode,
        connectionDraft.fromPort,
        element.dataset.workflowNodeId,
        input.dataset.workflowInput
      );
    }
    connectionDraft = null;
    renderEdges();
  }
  if (nodeDrag) {
    nodeLayer.querySelector(`[data-workflow-node-id="${cssEscape(nodeDrag.id)}"]`)?.classList.remove("dragging");
    nodeDrag = null;
    saveWorkflow();
  }
});

edgeLayer?.addEventListener("click", (event) => {
  const path = event.target.closest("[data-workflow-edge-id]");
  if (!path) return;
  workflow.edges = workflow.edges.filter((edge) => edge.id !== path.dataset.workflowEdgeId);
  saveWorkflow();
  renderWorkflow();
  showToast(w("connectionRemoved"));
});

new MutationObserver(renderWorkflow).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["lang"]
});

await refreshCanvasState();
applyToolLocale();
renderWorkflow();
resumeRunningJobs();
window.setInterval(refreshCanvasState, 2500);

function loadWorkflow() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "");
    if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return {
        nodes: parsed.nodes.map(normalizeNode).filter(Boolean),
        edges: parsed.edges.map(normalizeEdge).filter(Boolean)
      };
    }
  } catch {}
  return { nodes: [], edges: [] };
}

function normalizeNode(node) {
  if (!node?.id || !nodeSizes[node.type]) return null;
  if (node.type === "studio") {
    return {
      id: String(node.id),
      type: "studio",
      x: numberOr(node.x, 120),
      y: numberOr(node.y, 100),
      prompt: String(node.prompt || "").slice(0, 4000),
      ratio: allowedRatios.has(node.ratio) ? node.ratio : "1:1",
      count: allowedCounts.has(Number(node.count)) ? Number(node.count) : 1,
      referenceObjectIds: [...new Set(
        (Array.isArray(node.referenceObjectIds) ? node.referenceObjectIds : [])
          .map(String)
          .filter(Boolean)
      )].slice(0, 6),
      status: ["idle", "running", "done", "error"].includes(node.status) ? node.status : "idle",
      jobIds: (Array.isArray(node.jobIds) ? node.jobIds : []).map(String).filter(Boolean).slice(0, 4),
      error: String(node.error || "").slice(0, 500)
    };
  }
  return {
    id: String(node.id),
    type: "image",
    x: numberOr(node.x, 660),
    y: numberOr(node.y, 120),
    objectId: typeof node.objectId === "string" ? node.objectId : null,
    status: ["running", "done", "error"].includes(node.status) ? node.status : "done",
    error: String(node.error || "").slice(0, 300)
  };
}

function normalizeEdge(edge) {
  if (!edge?.id || !edge?.fromNode || !edge?.toNode) return null;
  return {
    id: String(edge.id),
    fromNode: String(edge.fromNode),
    fromPort: String(edge.fromPort || "image"),
    toNode: String(edge.toNode),
    toPort: String(edge.toPort || "images")
  };
}

function saveWorkflow() {
  localStorage.setItem(storageKey, JSON.stringify(workflow));
}

function addStudioNode(options = {}) {
  const position = viewportNodePosition(nodeSizes.studio);
  const node = normalizeNode({
    id: createId("studio"),
    type: "studio",
    x: options.x ?? position.x,
    y: options.y ?? position.y,
    referenceObjectIds: options.referenceObjectIds || [],
    prompt: options.prompt || "",
    ratio: "1:1",
    count: 1,
    status: "idle"
  });
  workflow.nodes.push(node);
  activeStudioId = node.id;
  saveWorkflow();
  renderWorkflow();
  window.setTimeout(() => {
    nodeLayer.querySelector(`[data-workflow-node-id="${cssEscape(node.id)}"] textarea`)?.focus();
  }, 0);
  return node;
}

function deleteNode(id) {
  workflow.nodes = workflow.nodes.filter((node) => node.id !== id);
  workflow.edges = workflow.edges.filter((edge) => edge.fromNode !== id && edge.toNode !== id);
  if (activeStudioId === id) activeStudioId = null;
  saveWorkflow();
  renderWorkflow();
}

function connectNodes(fromNodeId, fromPort, toNodeId, toPort) {
  const from = workflow.nodes.find((node) => node.id === fromNodeId);
  const to = workflow.nodes.find((node) => node.id === toNodeId);
  if (!from || !to || from.type !== "image" || to.type !== "studio" || fromPort !== "image" || toPort !== "images") {
    showToast(w("incompatible"));
    return;
  }
  if (workflow.edges.some((edge) => edge.fromNode === fromNodeId && edge.toNode === toNodeId && edge.toPort === toPort)) return;
  const existingInputs = workflow.edges.filter((edge) => edge.toNode === toNodeId && edge.toPort === toPort);
  if (existingInputs.length + to.referenceObjectIds.length >= 6) {
    showToast(w("maxReferences"));
    return;
  }
  workflow.edges.push({
    id: createId("edge"),
    fromNode: fromNodeId,
    fromPort,
    toNode: toNodeId,
    toPort
  });
  saveWorkflow();
  renderWorkflow();
}

function renderWorkflow() {
  applyToolLocale();
  if (!layer) return;
  layer.hidden = workflow.nodes.length === 0;
  nodeLayer.replaceChildren();
  for (const node of workflow.nodes) {
    nodeLayer.append(node.type === "studio" ? renderStudioNode(node) : renderImageNode(node));
  }
  renderEdges();
}

function renderStudioNode(node) {
  const element = createNodeShell(node, "studio-node");
  const references = referenceObjectsForStudio(node);
  const mode = references.length === 0 ? w("textMode") : references.length === 1 ? w("imageMode") : w("fusionMode");
  element.innerHTML = `
    <header class="studio-node-header">
      <div class="studio-node-title">
        <span class="studio-node-icon">${sparkleIcon()}</span>
        <div><strong>${escapeHtml(w("title"))}</strong><span>${escapeHtml(mode)}</span></div>
      </div>
      <div class="studio-node-meta">
        <span class="studio-status studio-status-${node.status}" role="status">${escapeHtml(statusLabel(node.status))}</span>
        <button type="button" data-workflow-delete="${escapeHtml(node.id)}" title="${escapeHtml(w("remove"))}" aria-label="${escapeHtml(w("remove"))}">${closeIcon()}</button>
      </div>
    </header>
    <div class="studio-node-content">
      <section class="studio-reference-section">
        <div class="studio-section-label"><span>${escapeHtml(w("references"))}</span><span>${references.length}/6</span></div>
        ${renderReferenceArea(node, references)}
      </section>
      <label class="studio-prompt-label">
        <span>${escapeHtml(w("prompt"))}</span>
        <textarea data-workflow-prompt maxlength="4000" placeholder="${escapeHtml(w("promptPlaceholder"))}">${escapeHtml(node.prompt)}</textarea>
      </label>
      <div class="studio-options">
        <label><span>${escapeHtml(w("ratio"))}</span>
          <select data-workflow-ratio aria-label="${escapeHtml(w("ratio"))}">
            ${["1:1", "16:9", "9:16", "4:3", "3:4"].map((ratio) => `<option value="${ratio}"${ratio === node.ratio ? " selected" : ""}>${ratio}</option>`).join("")}
          </select>
        </label>
        <label><span>${escapeHtml(w("count"))}</span>
          <select data-workflow-count aria-label="${escapeHtml(w("count"))}">
            ${[1, 2, 4].map((count) => `<option value="${count}"${count === node.count ? " selected" : ""}>${count}</option>`).join("")}
          </select>
        </label>
      </div>
      <button class="studio-generate-button" type="button" data-workflow-run="${escapeHtml(node.id)}"${node.status === "running" ? " disabled" : ""}>
        ${sparkleIcon()}<span>${escapeHtml(node.status === "running" ? w("generating") : w("generate"))}</span>
      </button>
      ${node.status === "error" && node.error ? `<p class="studio-error" role="alert">${escapeHtml(node.error)}</p>` : ""}
    </div>
    <button class="workflow-port studio-input-port" type="button" data-workflow-input="images" aria-label="${escapeHtml(w("input"))}" title="${escapeHtml(w("input"))}">
      <span>${escapeHtml(w("input"))}</span>
    </button>
  `;
  element.querySelector("textarea")?.addEventListener("pointerdown", (event) => event.stopPropagation());
  return element;
}

function renderReferenceArea(node, references) {
  if (!references.length) {
    return `
      <button class="studio-upload-zone" type="button" data-workflow-upload="${escapeHtml(node.id)}" data-workflow-drop="${escapeHtml(node.id)}">
        ${uploadIcon()}
        <strong>${escapeHtml(w("uploadTitle"))}</strong>
        <span>${escapeHtml(w("uploadHint"))}</span>
      </button>
    `;
  }
  const cards = references.map(({ object, local }) => `
    <div class="studio-reference-card">
      ${object?.src ? `<img src="${escapeHtml(assetUrl(object.src, object))}" alt="${escapeHtml(object.name || w("references"))}">` : `<span>${escapeHtml(w("imageUnavailable"))}</span>`}
      ${local ? `<button type="button" data-workflow-node="${escapeHtml(node.id)}" data-workflow-remove-reference="${escapeHtml(object.id)}" aria-label="${escapeHtml(w("referenceRemoved"))}">${closeIcon()}</button>` : '<span class="studio-linked-badge" aria-hidden="true">↗</span>'}
    </div>
  `).join("");
  const add = references.length < 6 ? `
    <button class="studio-reference-add" type="button" data-workflow-upload="${escapeHtml(node.id)}" data-workflow-drop="${escapeHtml(node.id)}">
      ${uploadIcon()}<span>${escapeHtml(w("addImage"))}</span>
    </button>
  ` : "";
  return `<div class="studio-reference-grid" data-workflow-drop="${escapeHtml(node.id)}">${cards}${add}</div>`;
}

function renderImageNode(node) {
  const element = createNodeShell(node, "result-node");
  const object = canvasState.objects.find((item) => item.id === node.objectId);
  element.innerHTML = `
    <header class="result-node-header">
      <div><strong>${escapeHtml(object?.name || w("output"))}</strong><span class="studio-status studio-status-${node.status}">${escapeHtml(statusLabel(node.status))}</span></div>
      <button type="button" data-workflow-delete="${escapeHtml(node.id)}" title="${escapeHtml(w("remove"))}" aria-label="${escapeHtml(w("remove"))}">${closeIcon()}</button>
    </header>
    <div class="result-node-preview">
      ${object?.src ? `<img src="${escapeHtml(assetUrl(object.src, object))}" alt="${escapeHtml(object.name || w("output"))}">` : `<div>${escapeHtml(w("imageUnavailable"))}</div>`}
    </div>
    <button class="result-continue-button" type="button" data-workflow-continue="${escapeHtml(node.id)}">${arrowIcon()}<span>${escapeHtml(w("continue"))}</span></button>
    <button class="workflow-port result-output-port" type="button" data-workflow-output="image" aria-label="${escapeHtml(w("output"))}" title="${escapeHtml(w("output"))}">
      <span>${escapeHtml(w("output"))}</span>
    </button>
  `;
  return element;
}

function createNodeShell(node, className) {
  const element = document.createElement("article");
  const size = nodeSizes[node.type];
  element.className = `${className}${node.status === "running" ? " is-running" : ""}`;
  element.dataset.workflowNodeId = node.id;
  element.dataset.workflowNodeType = node.type;
  element.style.left = `${node.x}px`;
  element.style.top = `${node.y}px`;
  element.style.width = `${size.width}px`;
  element.style.height = `${size.height}px`;
  return element;
}

function referenceObjectsForStudio(node) {
  const localIds = node.referenceObjectIds || [];
  const linkedIds = workflow.edges
    .filter((edge) => edge.toNode === node.id && edge.toPort === "images")
    .map((edge) => workflow.nodes.find((item) => item.id === edge.fromNode)?.objectId)
    .filter(Boolean);
  return [...new Set([...localIds, ...linkedIds])].slice(0, 6).map((id) => ({
    object: canvasState.objects.find((item) => item.id === id) || { id },
    local: localIds.includes(id)
  }));
}

function referenceObjectIdsForStudio(node) {
  return referenceObjectsForStudio(node).map((item) => item.object.id).filter(Boolean);
}

async function uploadReferences(nodeId, files) {
  const node = workflow.nodes.find((item) => item.id === nodeId && item.type === "studio");
  if (!node) return;
  const available = Math.max(0, 6 - referenceObjectsForStudio(node).length);
  if (!available) {
    showToast(w("maxReferences"));
    return;
  }
  const candidates = files.filter(isImageFile).slice(0, available);
  if (!candidates.length) return;
  node.status = "running";
  saveWorkflow();
  renderWorkflow();

  try {
    for (const file of candidates) {
      const dataUrl = await readFileAsDataUrl(file);
      const size = await readImageSize(dataUrl);
      const display = displaySize(size);
      const response = await fetch(apiPath("/api/images"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          name: file.name || `reference-${Date.now()}.png`,
          prompt: "Workflow reference image",
          layoutMode: "manual",
          x: node.x + 24,
          y: node.y + 24,
          width: display.width,
          height: display.height
        })
      });
      const object = await response.json();
      if (!response.ok) throw new Error(object.error || w("uploadFailed"));
      await fetch(apiPath("/api/objects"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          updates: [{ id: object.id, patch: { hidden: true } }]
        })
      });
      node.referenceObjectIds.push(object.id);
    }
    node.referenceObjectIds = [...new Set(node.referenceObjectIds)].slice(0, 6);
    node.status = "idle";
    node.error = "";
    saveWorkflow();
    await refreshCanvasState();
    renderWorkflow();
  } catch (error) {
    node.status = "error";
    node.error = error?.message || w("uploadFailed");
    saveWorkflow();
    renderWorkflow();
    showToast(node.error);
  }
}

async function runStudioNode(id) {
  const node = workflow.nodes.find((item) => item.id === id && item.type === "studio");
  if (!node || node.status === "running") return;
  const prompt = node.prompt.trim();
  if (!prompt) {
    showToast(w("promptRequired"));
    nodeLayer.querySelector(`[data-workflow-node-id="${cssEscape(id)}"] textarea`)?.focus();
    return;
  }

  const objectIds = referenceObjectIdsForStudio(node);
  const enrichedPrompt = [
    prompt,
    "",
    `Requested output aspect ratio: ${node.ratio}.`,
    objectIds.length > 1
      ? "Use all attached reference images deliberately in one coherent final image."
      : objectIds.length === 1
        ? "Use the attached image as the visual reference for this generation."
        : ""
  ].filter(Boolean).join("\n");

  node.status = "running";
  node.error = "";
  node.jobIds = [];
  saveWorkflow();
  renderWorkflow();
  showToast(w("started"));

  try {
    const jobs = [];
    for (let index = 0; index < node.count; index += 1) {
      const response = await fetch(apiPath("/api/workflow/jobs"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: enrichedPrompt,
          objectIds,
          x: node.x + nodeSizes.studio.width + 80 + index * 300,
          y: node.y + index * 30
        })
      });
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || w("failed"));
      node.jobIds.push(job.id);
      jobs.push(job);
    }
    saveWorkflow();
    await finishStudioJobs(node, jobs.map((job) => job.id));
  } catch (error) {
    node.status = "error";
    node.error = error?.message || w("failed");
    saveWorkflow();
    renderWorkflow();
    showToast(node.error);
  }
}

async function finishStudioJobs(node, jobIds) {
  const settled = await Promise.allSettled(jobIds.map((jobId) => pollJob(jobId)));
  const completed = settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value)
    .filter(Boolean);
  await refreshCanvasState();
  completed.forEach((job, index) => {
    const result = Array.isArray(job.imported) ? job.imported[0] : null;
    if (result?.id) addResultNode(node, result.id, index);
  });
  const failures = settled.filter((item) => item.status === "rejected");
  node.status = completed.length ? "done" : "error";
  node.error = failures.length
    ? String(failures[0].reason?.message || failures[0].reason || w("failed")).slice(0, 500)
    : "";
  node.jobIds = [];
  saveWorkflow();
  renderWorkflow();
  showToast(completed.length ? w("finished") : node.error || w("failed"));
}

async function pollJob(jobId) {
  if (pollingJobs.has(jobId)) {
    while (pollingJobs.has(jobId)) await wait(500);
  }
  pollingJobs.add(jobId);
  try {
    while (true) {
      const response = await fetch(apiPath(`/api/jobs/${encodeURIComponent(jobId)}`));
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || w("failed"));
      if (job.status === "done") return job;
      if (job.status === "failed") throw new Error(job.error || w("failed"));
      await wait(1000);
    }
  } finally {
    pollingJobs.delete(jobId);
  }
}

function addResultNode(studio, objectId, index = 0) {
  const existing = workflow.nodes.find((node) => node.type === "image" && node.objectId === objectId);
  if (existing) return existing;
  const node = normalizeNode({
    id: createId("image"),
    type: "image",
    objectId,
    x: studio.x + nodeSizes.studio.width + 120 + index * (nodeSizes.image.width + 70),
    y: studio.y + 90 + index * 28,
    status: "done"
  });
  workflow.nodes.push(node);
  return node;
}

function resumeRunningJobs() {
  for (const node of workflow.nodes) {
    if (node.type === "studio" && node.status === "running" && node.jobIds.length) {
      finishStudioJobs(node, [...node.jobIds]);
    }
  }
}

function renderEdges() {
  if (!edgeLayer || layer.hidden) return;
  edgeLayer.replaceChildren();
  for (const edge of workflow.edges) {
    const from = workflow.nodes.find((node) => node.id === edge.fromNode);
    const to = workflow.nodes.find((node) => node.id === edge.toNode);
    if (!from || !to) continue;
    edgeLayer.append(createEdgePath(portPosition(from, "output"), portPosition(to, "input"), edge.id));
  }
  if (connectionDraft) {
    const from = workflow.nodes.find((node) => node.id === connectionDraft.fromNode);
    if (from) {
      const preview = createEdgePath(portPosition(from, "output"), connectionDraft.pointer, null);
      preview.classList.add("preview");
      edgeLayer.append(preview);
    }
  }
}

function createEdgePath(from, to, id) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const bend = Math.max(80, Math.abs(to.x - from.x) * 0.45);
  path.setAttribute("d", `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`);
  path.setAttribute("fill", "none");
  path.classList.add("workflow-edge");
  if (id) path.dataset.workflowEdgeId = id;
  return path;
}

function portPosition(node, direction) {
  const size = nodeSizes[node.type];
  if (node.type === "image" && direction === "output") {
    return { x: node.x + size.width, y: node.y + 136 };
  }
  return { x: node.x, y: node.y + 225 };
}

async function refreshCanvasState() {
  try {
    const response = await fetch(apiPath("/api/state"));
    if (!response.ok) return;
    canvasState = await response.json();
    if (workflow.nodes.length) renderWorkflow();
  } catch {}
}

function selectedCanvasImage() {
  const selectedElement = document.querySelector(".canvas-object.selected[data-id]");
  const selectedId = selectedElement?.dataset.id || canvasState.selection;
  return canvasState.objects.find(
    (item) => item.id === selectedId && (item.type || "image") === "image" && !item.hidden
  ) || null;
}

function viewportNodePosition(size) {
  const rect = board.getBoundingClientRect();
  const center = clientToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  const offset = workflow.nodes.filter((node) => node.type === "studio").length % 4;
  return {
    x: Math.round(center.x - size.width / 2 + offset * 38),
    y: Math.round(center.y - size.height / 2 + offset * 32)
  };
}

function clientToWorld(clientX, clientY) {
  const rect = board.getBoundingClientRect();
  const transform = new DOMMatrixReadOnly(getComputedStyle(world).transform);
  const inverse = transform.inverse();
  const point = new DOMPoint(clientX - rect.left, clientY - rect.top).matrixTransform(inverse);
  return { x: point.x, y: point.y };
}

function apiPath(pathname) {
  const url = new URL(pathname, window.location.origin);
  if (projectId !== "default") url.searchParams.set("project", projectId);
  if (threadId !== "default") url.searchParams.set("threadId", threadId);
  return `${url.pathname}${url.search}`;
}

function assetUrl(src, object) {
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin === window.location.origin && projectId !== "default") {
      url.searchParams.set("project", projectId);
      if (Number.isFinite(object?.assetVersion)) url.searchParams.set("v", String(object.assetVersion));
      return `${url.pathname}${url.search}`;
    }
    return url.href;
  } catch {
    return src;
  }
}

function applyToolLocale() {
  if (!studioButton) return;
  studioButton.title = w("tool");
  studioButton.dataset.tooltip = w("tool");
  studioButton.setAttribute("aria-label", w("tool"));
}

function locale() {
  return document.documentElement.lang?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function w(key) {
  return copy[locale()]?.[key] || copy.en[key] || key;
}

function statusLabel(status) {
  if (status === "running") return w("running");
  if (status === "done") return w("done");
  if (status === "error") return w("error");
  return w("ready");
}

function isImageFile(file) {
  return String(file?.type || "").startsWith("image/")
    || /\.(png|jpe?g|webp|gif|avif)$/i.test(file?.name || "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error(w("uploadFailed")));
    reader.readAsDataURL(file);
  });
}

function readImageSize(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 1024, height: 1024 });
    image.src = dataUrl;
  });
}

function displaySize(size) {
  const scale = Math.min(1, 420 / Math.max(size.width || 1, size.height || 1));
  return {
    width: Math.max(1, Math.round((size.width || 1024) * scale)),
    height: Math.max(1, Math.round((size.height || 1024) * scale))
  };
}

function showToast(message) {
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function createId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sparkleIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9Z"></path><path d="m19 17-.8 2.2L16 20l2.2.8L19 23l.8-2.2L22 20l-2.2-.8Z"></path></svg>';
}

function uploadIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"></path></svg>';
}

function closeIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';
}

function arrowIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>';
}
