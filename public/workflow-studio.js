const board = document.querySelector("#board");
const world = document.querySelector("#world");
const layer = document.querySelector("#workflowLayer");
const edgeLayer = document.querySelector("#workflowEdges");
const nodeLayer = document.querySelector("#workflowNodes");
const openButton = document.querySelector("#workflowImageButton");
const toast = document.querySelector("#toast");

const nodeSizes = {
  studio: { width: 520, height: 650 }
};
const nodeTypes = new Set(["studio", "result", "layerGroup"]);
const ratios = ["16:9", "9:16", "4:3", "3:4", "1:1", "2:1", "3:2", "6:5", "5:6"];
const exportResolutions = ["1k", "2k", "4k"];
const exportFormats = ["jpeg", "png"];
const expandRatios = ["original", "1:1", "16:9", "9:16", "4:3", "3:4"];
const workflowDataTypes = Object.freeze({ image: "IMAGE" });
const workflowGroupThemes = ["default", "sky", "grape", "mint", "amber", "rose"];
const workflowGroupPadding = 32;
const workflowGroupGap = 18;
const workflowSelectionProtectedSelector = ".workflow-group-section, .selection-toolbar, .workflow-group-section-header, .quick-edit-composer";
const activeDownloads = new Set();
const search = new URLSearchParams(window.location.search);
const projectId = search.get("project") || "default";
const threadId = search.get("threadId") || "default";
const storageKey = `codexCanvasWorkflow:v2:${projectId}:${threadId}`;
const copy = {
  en: {
    tool: "Upload image",
    studioTitle: "Image generator",
    generationDialogTitle: "Create image",
    generationDialogHint: "Choose a generation mode. Image to image accepts uploaded or connected canvas references.",
    createGenerator: "Create generator",
    textMode: "Text to image",
    imageMode: "Image to image",
    fusionMode: "Image fusion",
    ready: "Ready",
    running: "Generating",
    done: "Done",
    error: "Error",
    cancelled: "Cancelled",
    deleteNode: "Delete node",
    upload: "Upload images",
    uploadHint: "or paste with ⌘/Ctrl + V",
    referenceHint: "Up to 6 reference images",
    connected: "Connected",
    removeReference: "Remove reference",
    prompt: "Prompt",
    promptPlaceholder: "Describe the image you want to create…",
    ratio: "Aspect ratio",
    count: "Outputs",
    generate: "Generate",
    generating: "Generating…",
    inputImages: "Reference images",
    output: "Result",
    result: "Generated image",
    resultHint: "Connect this image to another generator",
    continueGenerate: "Continue",
    reuseSettings: "Reuse settings",
    copyPrompt: "Copy prompt",
    promptCopied: "Prompt copied",
    generateAgain: "Generate again",
    generationDetails: "Prompt & settings",
    referenceCount: "references",
    batch: "Batch",
    aiGenerated: "AI generated",
    editedResult: "Edited result",
    removedBackgroundResult: "Background removed",
    download: "Download",
    downloading: "Preparing download…",
    downloadStarted: "Download started. Check your browser downloads.",
    downloadFailed: "Unable to prepare the download",
    exportResolution: "Export resolution",
    exportFormat: "Export format",
    originalSize: "Original",
    exportSize: "Export",
    removeBg: "Remove BG",
    crop: "Crop",
    expand: "Expand",
    elements: "Layers",
    apply: "Apply",
    cancel: "Cancel",
    expandPrompt: "Describe the area to extend (optional)",
    expandRatio: "Ratio",
    expandScale: "Scale",
    expandPreset: "Type",
    presetGeneral: "General",
    presetPhoto: "Photo",
    presetPoster: "Poster",
    presetProduct: "Product",
    originalRatio: "Original",
    layerGroup: "Element layers",
    layerCount: "layers",
    backgroundLayer: "Background",
    objectLayer: "Object",
    textLayer: "Text",
    operationStarted: "Image operation started",
    operationDone: "Image operation finished",
    cropFailed: "Unable to crop this image",
    addPrompt: "Enter a prompt before generating",
    uploadFailed: "Image upload failed",
    startFailed: "Unable to start generation",
    jobFailed: "Generation failed",
    jobDone: "Generation finished",
    incompatible: "These ports cannot be connected",
    connectionRemoved: "Connection removed",
    maxReferences: "A generator supports up to 6 reference images",
    duplicateReference: "This image is already connected as a reference",
    cycleConnection: "This connection would create a workflow cycle",
    imageUnavailable: "Image unavailable",
    singleImageRefHint: "Selected 1 reference image. Create a reference generator.",
    multiImageFusionHint: "Selected multiple reference images. Create a fusion generator."
  },
  zh: {
    tool: "上传图片",
    studioTitle: "图片生成",
    generationDialogTitle: "参考生图",
    generationDialogHint: "选择生成模式；图生图可使用上传图片，也可使用画板连线图片。",
    createGenerator: "创建生成框",
    textMode: "文生图",
    imageMode: "图生图",
    fusionMode: "多图融合",
    ready: "就绪",
    running: "生成中",
    done: "完成",
    error: "错误",
    cancelled: "已取消",
    deleteNode: "删除节点",
    upload: "上传图片",
    uploadHint: "也可使用 ⌘/Ctrl + V 粘贴",
    referenceHint: "最多支持 6 张参考图",
    connected: "已连线",
    removeReference: "移除参考图",
    prompt: "提示词",
    promptPlaceholder: "描述你想要创建的图片…",
    ratio: "画面比例",
    count: "生成数量",
    generate: "生成图片",
    generating: "正在生成…",
    inputImages: "参考图片",
    output: "生成结果",
    result: "生成图片",
    resultHint: "可将此图片继续连接到新的生成面板",
    continueGenerate: "继续生成",
    reuseSettings: "复用配置",
    copyPrompt: "复制提示词",
    promptCopied: "提示词已复制",
    generateAgain: "再次生成",
    generationDetails: "提示词与参数",
    referenceCount: "张参考图",
    batch: "批次",
    aiGenerated: "AI 生成",
    editedResult: "编辑结果",
    removedBackgroundResult: "去背景结果",
    download: "下载",
    downloading: "正在准备下载，请稍候…",
    downloadStarted: "下载已开始，请在浏览器下载记录中查看。",
    downloadFailed: "无法生成下载文件",
    exportResolution: "分辨率",
    exportFormat: "照片格式",
    originalSize: "原图",
    exportSize: "导出",
    removeBg: "去背景",
    crop: "裁剪",
    expand: "扩图",
    elements: "元素分层",
    apply: "应用",
    cancel: "取消",
    expandPrompt: "描述希望向画面外延展的内容（可选）",
    expandRatio: "画面比例",
    expandScale: "扩展倍数",
    expandPreset: "内容类型",
    presetGeneral: "通用",
    presetPhoto: "照片",
    presetPoster: "海报",
    presetProduct: "产品",
    originalRatio: "原比例",
    layerGroup: "元素分层",
    layerCount: "个图层",
    backgroundLayer: "背景",
    objectLayer: "主体",
    textLayer: "文字",
    operationStarted: "图片处理已开始",
    operationDone: "图片处理完成",
    cropFailed: "无法裁剪这张图片",
    addPrompt: "请输入提示词后再生成",
    uploadFailed: "图片上传失败",
    startFailed: "无法启动生成任务",
    jobFailed: "图片生成失败",
    jobDone: "图片生成完成",
    incompatible: "这两个端口无法连接",
    connectionRemoved: "已删除连线",
    maxReferences: "一个生成面板最多支持 6 张参考图",
    duplicateReference: "这张图片已经作为参考图连接",
    cycleConnection: "这条连线会形成工作流循环",
    imageUnavailable: "图片不可用",
    singleImageRefHint: "已选 1 张参考图，创建参考生图生成框。",
    multiImageFusionHint: "已选多张参考图，创建多图融合生成框。"
  }
};

let graph = loadGraph();
let canvasState = { objects: [], selection: null };
let selectedResultNodeId = null;
let selectedResultNodeIds = new Set();
let isolatedWorkflowResultNodeId = null;
const workflowUndoStack = [];
const workflowRedoStack = [];
const workflowHistoryLimit = 50;
let dragState = null;
let connectionDraft = null;
let generationDialog = null;
let cropDragState = null;
let toastTimer = null;
const pollingJobs = new Map();
const derivedPollingJobs = new Map();

window.addEventListener("codex-canvas:workflow-marquee-hit-test", (event) => {
  const rect = event.detail?.rect;
  if (layer?.hidden || !rect) return;
  const left = Number(rect.x);
  const top = Number(rect.y);
  const right = left + Number(rect.width);
  const bottom = top + Number(rect.height);
  if (![left, top, right, bottom].every(Number.isFinite)) return;
  // 使用画布对象的实际边界命中（优先用事件携带的实时对象数据，避免 2s 轮询延迟）
  const objects = Array.isArray(event.detail?.objects) ? event.detail.objects : canvasState.objects;
  const nodes = graph.nodes.filter((node) => {
    // Materialized results are ordinary canvas images. Let the canvas marquee
    // and layer-group system own their selection so they can be grouped with
    // source photos just like any other pair of images.
    if (node.type !== "result" || !node.objectId || !shouldRenderResultNode(node)) return false;
    const object = objects.find((item) => item.id === node.objectId);
    if (!object || object.hidden) return false;
    return left <= object.x + object.width
      && right >= object.x
      && top <= object.y + object.height
      && bottom >= object.y;
  });
  if (!nodes.length) return;
  event.detail.objectIds = [...new Set(nodes.map((node) => node.objectId).filter(Boolean))];
  const groupId = nodes[0]?.workflowGroupId || null;
  event.detail.grouped = Boolean(groupId) && nodes.every((node) => node.workflowGroupId === groupId);
  event.detail.bounds = workflowNodeScreenBounds(nodes);
});

window.addEventListener("codex-canvas:selection-changed", (event) => {
  const objectIds = new Set(Array.isArray(event.detail?.objectIds) ? event.detail.objectIds.map(String) : []);
  const currentNodes = graph.nodes.filter((node) => (
    node.type === "result"
    && shouldRenderResultNode(node)
    && selectedResultNodeIds.has(node.id)
    && objectIds.has(String(node.objectId || ""))
  ));
  const nodeIds = [];
  objectIds.forEach((objectId) => {
    const current = currentNodes.find((node) => String(node.objectId || "") === objectId);
    const fallback = [...graph.nodes].reverse().find((node) => (
      node.type === "result"
      && shouldRenderResultNode(node)
      && String(node.objectId || "") === objectId
    ));
    const node = current || fallback;
    if (node && !nodeIds.includes(node.id)) nodeIds.push(node.id);
  });
  selectedResultNodeIds = new Set(nodeIds);
  selectedResultNodeId = nodeIds.length === 1 ? nodeIds[0] : null;
  if (!nodeIds.includes(isolatedWorkflowResultNodeId)) isolatedWorkflowResultNodeId = null;
  nodeLayer?.querySelectorAll(".result-node[data-workflow-node-id]").forEach((element) => {
    const selected = selectedResultNodeIds.has(element.dataset.workflowNodeId);
    element.classList.toggle("selected", selected && selectedResultNodeIds.size === 1);
    element.classList.toggle("multi-selected", selected && selectedResultNodeIds.size > 1 && !selectedWorkflowGroupId());
  });
  nodeLayer?.querySelectorAll(".workflow-group-section, .workflow-group-section-header").forEach((element) => {
    element.classList.toggle("selected", element.dataset.workflowGroupId === selectedWorkflowGroupId());
  });
  nodeLayer?.querySelector(".workflow-multi-selection")?.remove();
  const multiSelection = renderWorkflowMultiSelection();
  if (multiSelection) nodeLayer?.append(multiSelection);
});

window.addEventListener("codex-canvas:workflow-toolbar-action", (event) => {
  const action = String(event.detail?.action || "");
  const objectId = String(event.detail?.objectId || "");
  if (!["remove-bg", "expand", "crop", "edit-elements", "edit-text"].includes(action) || !objectId) return;
  const selectedNode = graph.nodes.find((node) => (
    node.type === "result"
    && selectedResultNodeIds.has(node.id)
    && String(node.objectId || "") === objectId
  ));
  const node = selectedNode || [...graph.nodes].reverse().find((item) => (
    item.type === "result" && String(item.objectId || "") === objectId
  ));
  if (!node) return;
  event.detail.handled = true;
  selectedResultNodeIds = new Set([node.id]);
  selectedResultNodeId = node.id;
  isolatedWorkflowResultNodeId = node.workflowGroupId ? node.id : null;
  if (["crop", "edit-elements", "edit-text"].includes(action)) {
    materializeResultForCanvasAction(node, action)
      .catch((error) => showToast(error?.message || tr("jobFailed")));
    return;
  }
  handleResultAction(node.id, action);
});

async function materializeResultForCanvasAction(node, action) {
  if (!node?.objectId) throw new Error(tr("imageUnavailable"));
  const objectId = node.objectId;
  await revealCanvasObjects([objectId]);
  deleteNode(node.id);
  selectedResultNodeIds.clear();
  selectedResultNodeId = null;
  isolatedWorkflowResultNodeId = null;
  dispatchWorkflowResultSelection();
  await refreshCanvasState();
  window.dispatchEvent(new CustomEvent("codex-canvas:materialized-image-action", {
    detail: { action, objectId }
  }));
}

window.addEventListener("codex-canvas:workflow-run-image-action", (event) => {
  const action = String(event.detail?.action || "");
  const objectId = String(event.detail?.objectId || "");
  if (action !== "expand" || !objectId) return;
  const node = graph.nodes.find((item) => (
    item.type === "result"
    && selectedResultNodeIds.has(item.id)
    && String(item.objectId || "") === objectId
  )) || [...graph.nodes].reverse().find((item) => (
    item.type === "result" && String(item.objectId || "") === objectId
  ));
  if (!node) return;
  event.detail.handled = true;
  startDerivedJob(node.id, action, {
    prompt: String(event.detail?.prompt || ""),
    expand: event.detail?.expand || {}
  }).catch((error) => showToast(error?.message || tr("jobFailed")));
});

document.addEventListener("keydown", (event) => {
  const historyKey = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && (historyKey === "z" || (historyKey === "y" && event.ctrlKey))) {
    if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
    const direction = (historyKey === "z" && !event.shiftKey) ? "undo" : "redo";
    if (runWorkflowHistory(direction)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  }
  if (event.key === "Escape" && connectionDraft) {
    event.preventDefault();
    connectionDraft = null;
    clearConnectionTargetClasses();
    renderEdges();
    return;
  }
  if (event.key === "Escape" && generationDialog) {
    event.preventDefault();
    closeGenerationDialog();
    return;
  }
  const editingResultNode = graph.nodes.find((node) => (
    node.type === "result" && selectedResultNodeIds.has(node.id) && node.editMode
  ));
  if (editingResultNode && event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    handleResultAction(editingResultNode.id, "cancel");
    return;
  }
  if (editingResultNode?.editMode === "crop" && event.key === "Enter") {
    event.preventDefault();
    event.stopImmediatePropagation();
    handleResultAction(editingResultNode.id, "crop-apply");
    return;
  }
  if (event.key === "Escape" && selectedResultNodeIds.size) {
    event.preventDefault();
    if (isolatedWorkflowResultNodeId) {
      const isolatedNode = graph.nodes.find((node) => node.id === isolatedWorkflowResultNodeId);
      const groupedNodes = isolatedNode?.workflowGroupId
        ? graph.nodes.filter((node) => node.type === "result" && node.workflowGroupId === isolatedNode.workflowGroupId)
        : [];
      isolatedWorkflowResultNodeId = null;
      selectedResultNodeIds = new Set(groupedNodes.map((node) => node.id));
      selectedResultNodeId = selectedResultNodeIds.size === 1 ? [...selectedResultNodeIds][0] : null;
      dispatchWorkflowResultSelection();
      renderGraph();
      return;
    }
    selectedResultNodeId = null;
    selectedResultNodeIds.clear();
    dispatchWorkflowResultSelection();
    renderGraph();
    return;
  }
  if (!selectedResultNodeIds.size || !["Backspace", "Delete"].includes(event.key)) return;
  if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const nodeIds = [...selectedResultNodeIds];
  selectedResultNodeId = null;
  selectedResultNodeIds.clear();
  nodeIds.forEach(deleteNode);
}, true);

window.addEventListener("codex-canvas:create-reference-generator", (event) => {
  const objectIds = Array.isArray(event.detail?.objectIds) ? event.detail.objectIds : [];
  const validIds = objectIds.filter((id) => canvasObject(id)?.src).slice(0, 6);
  if (validIds.length >= 2) {
    createStudioFromReferences(validIds);
    return;
  }
  openGenerationDialog(objectIds, event.detail?.anchorBounds);
});

nodeLayer?.addEventListener("click", (event) => {
  const renameButton = event.target.closest("[data-workflow-group-rename]");
  if (renameButton) {
    event.preventDefault();
    event.stopPropagation();
    beginWorkflowGroupNameEdit(renameButton.closest(".workflow-group-section-header"), renameButton.dataset.workflowGroupRename);
    return;
  }
  const themeOption = event.target.closest("[data-workflow-group-theme-option]");
  if (themeOption) {
    event.preventDefault();
    event.stopPropagation();
    setWorkflowGroupTheme(themeOption.dataset.workflowGroupId, themeOption.dataset.workflowGroupThemeOption);
    return;
  }
  const themeTrigger = event.target.closest("[data-workflow-group-theme-trigger]");
  if (themeTrigger) {
    event.preventDefault();
    event.stopPropagation();
    const menu = themeTrigger.closest(".workflow-group-theme-picker")?.querySelector(".workflow-group-theme-menu");
    if (!menu) return;
    const opening = menu.hidden;
    nodeLayer.querySelectorAll(".workflow-group-theme-menu").forEach((item) => { item.hidden = true; });
    menu.hidden = !opening;
    themeTrigger.setAttribute("aria-expanded", String(opening));
    return;
  }
  const groupSection = event.target.closest("[data-workflow-group-id]");
  if (groupSection && !event.target.closest("[data-workflow-node-id]")) {
    const nodes = graph.nodes.filter((node) => node.type === "result" && node.workflowGroupId === groupSection.dataset.workflowGroupId);
    selectedResultNodeIds = new Set(nodes.map((node) => node.id));
    selectedResultNodeId = null;
    isolatedWorkflowResultNodeId = null;
    renderGraph();
    requestAnimationFrame(dispatchWorkflowResultSelection);
    return;
  }
  const ratioOption = event.target.closest("[data-studio-ratio-option]");
  if (ratioOption) {
    event.preventDefault();
    event.stopPropagation();
    const node = graph.nodes.find((item) => item.id === ratioOption.dataset.nodeId && item.type === "studio");
    if (!node) return;
    node.ratio = ratios.includes(ratioOption.dataset.studioRatioOption)
      ? ratioOption.dataset.studioRatioOption
      : "1:1";
    saveGraph();
    renderGraph();
    return;
  }
  const ratioTrigger = event.target.closest("[data-studio-ratio-trigger]");
  if (ratioTrigger) {
    event.preventDefault();
    event.stopPropagation();
    const picker = ratioTrigger.closest(".studio-ratio-picker");
    const menu = picker?.querySelector(".studio-ratio-menu");
    if (!menu) return;
    const opening = menu.hidden;
    nodeLayer.querySelectorAll(".studio-ratio-menu").forEach((item) => { item.hidden = true; });
    menu.hidden = !opening;
    ratioTrigger.setAttribute("aria-expanded", String(opening));
    return;
  }
  const carouselButton = event.target.closest("[data-result-carousel]");
  if (carouselButton) {
    event.preventDefault();
    event.stopPropagation();
    stepResultCarousel(carouselButton.dataset.nodeId, Number(carouselButton.dataset.resultCarousel));
    return;
  }
  const deleteButton = event.target.closest("[data-workflow-delete]");
  if (deleteButton) {
    event.stopPropagation();
    deleteNode(deleteButton.dataset.workflowDelete);
    return;
  }
  const removeReference = event.target.closest("[data-reference-remove]");
  if (removeReference) {
    event.stopPropagation();
    removeDirectReference(removeReference.dataset.nodeId, removeReference.dataset.referenceRemove);
    return;
  }
  const runButton = event.target.closest("[data-studio-run]");
  if (runButton) {
    event.stopPropagation();
    runStudio(runButton.dataset.studioRun);
    return;
  }
  const resultOption = event.target.closest("[data-result-option]");
  if (resultOption) {
    event.stopPropagation();
    updateResultOption(
      resultOption.dataset.nodeId,
      resultOption.dataset.resultOption,
      resultOption.dataset.value
    );
    return;
  }
  const downloadButton = event.target.closest("[data-workflow-download]");
  if (downloadButton) {
    event.preventDefault();
    event.stopPropagation();
    if (downloadButton.getAttribute("aria-disabled") !== "true") {
      startWorkflowDownload(
        downloadButton.dataset.workflowDownload,
        downloadButton.href,
        downloadButton.download
      ).catch(() => {});
    }
    return;
  }
  const resultAction = event.target.closest("[data-result-action]");
  if (resultAction) {
    event.stopPropagation();
    handleResultAction(resultAction.dataset.nodeId, resultAction.dataset.resultAction);
    return;
  }
  const resultElement = event.target.closest('.result-node[data-workflow-node-id]');
  if (resultElement) {
    const nodeId = resultElement.dataset.workflowNodeId;
    const clickedNode = graph.nodes.find((item) => item.id === nodeId && item.type === "result");
    if (event.detail >= 2 && clickedNode?.workflowGroupId) {
      isolatedWorkflowResultNodeId = nodeId;
      selectedResultNodeIds = new Set([nodeId]);
    } else if (event.shiftKey) {
      isolatedWorkflowResultNodeId = null;
      if (selectedResultNodeIds.has(nodeId)) selectedResultNodeIds.delete(nodeId);
      else selectedResultNodeIds.add(nodeId);
    } else {
      const keepIsolated = isolatedWorkflowResultNodeId === nodeId && Boolean(clickedNode?.workflowGroupId);
      isolatedWorkflowResultNodeId = keepIsolated ? isolatedWorkflowResultNodeId : null;
      const groupedNodes = clickedNode?.workflowGroupId
        ? graph.nodes.filter((item) => item.type === "result" && item.workflowGroupId === clickedNode.workflowGroupId)
        : [];
      selectedResultNodeIds = new Set(keepIsolated ? [nodeId] : groupedNodes.length > 1 ? groupedNodes.map((item) => item.id) : [nodeId]);
    }
    selectedResultNodeId = selectedResultNodeIds.size === 1 ? [...selectedResultNodeIds][0] : null;
    dispatchWorkflowResultSelection();
    renderGraph();
  }
});

nodeLayer?.addEventListener("change", (event) => {
  const select = event.target.closest("[data-workflow-group-theme-select]");
  if (!select) return;
  event.stopPropagation();
  const theme = workflowGroupThemes.includes(select.value) ? select.value : "violet";
  const historySnapshot = workflowGraphSnapshot();
  graph.nodes.forEach((node) => {
    if (node.workflowGroupId === select.dataset.workflowGroupThemeSelect) node.workflowGroupTheme = theme;
  });
  recordWorkflowHistory(historySnapshot);
  saveGraph();
  renderGraph();
});

function setWorkflowGroupTheme(groupId, requestedTheme) {
  const theme = workflowGroupThemes.includes(requestedTheme) ? requestedTheme : "default";
  const historySnapshot = workflowGraphSnapshot();
  graph.nodes.forEach((node) => {
    if (node.workflowGroupId === groupId) node.workflowGroupTheme = theme;
  });
  recordWorkflowHistory(historySnapshot);
  saveGraph();
  renderGraph();
}

layer?.addEventListener("click", (event) => {
  if (event.target !== layer && event.target !== nodeLayer && event.target !== edgeLayer) return;
  if (!selectedResultNodeIds.size) return;
  selectedResultNodeId = null;
  selectedResultNodeIds.clear();
  isolatedWorkflowResultNodeId = null;
  dispatchWorkflowResultSelection();
  renderGraph();
});

function dispatchWorkflowResultSelection() {
  const nodes = graph.nodes.filter((node) => node.type === "result" && selectedResultNodeIds.has(node.id));
  const objectIds = nodes.map((node) => node.objectId).filter(Boolean);
  const node = nodes.length === 1 ? nodes[0] : null;
  const objectId = node?.objectId || null;
  let bounds = null;
  const selectedGroupId = selectedWorkflowGroupId();
  const groupElement = selectedGroupId
    ? nodeLayer?.querySelector(`.workflow-group-section[data-workflow-group-id="${CSS.escape(selectedGroupId)}"]`)
    : null;
  const elements = groupElement ? [groupElement] : nodes.map((item) => nodeElement(item.id)).filter(Boolean);
  if (elements.length && board) {
    const rects = elements.map((element) => element.getBoundingClientRect());
    const boardRect = board.getBoundingClientRect();
    bounds = {
      left: Math.min(...rects.map((rect) => rect.left)) - boardRect.left,
      top: Math.min(...rects.map((rect) => rect.top)) - boardRect.top - 52,
      right: Math.max(...rects.map((rect) => rect.right)) - boardRect.left,
      bottom: Math.max(...rects.map((rect) => rect.bottom)) - boardRect.top
    };
  }
  window.dispatchEvent(new CustomEvent("codex-canvas:workflow-result-selected", {
    detail: {
      objectId,
      objectIds,
      bounds,
      grouped: nodes.length > 1 && Boolean(nodes[0]?.workflowGroupId) && nodes.every((item) => item.workflowGroupId === nodes[0].workflowGroupId),
      exportResolution: node?.exportResolution || null,
      exportFormat: node?.exportFormat || null
    }
  }));
}

function selectedWorkflowGroupId() {
  if (isolatedWorkflowResultNodeId || selectedResultNodeIds.size < 2) return null;
  const nodes = graph.nodes.filter((node) => node.type === "result" && selectedResultNodeIds.has(node.id));
  const groupId = nodes[0]?.workflowGroupId || null;
  return groupId && nodes.length > 1 && nodes.every((node) => node.workflowGroupId === groupId)
    ? groupId
    : null;
}

nodeLayer?.addEventListener("input", (event) => {
  const element = event.target.closest("[data-workflow-node-id]");
  if (!element) return;
  const node = graph.nodes.find((item) => item.id === element.dataset.workflowNodeId);
  if (!node) return;
  if (node.type === "studio" && event.target.matches("[data-studio-prompt]")) {
    node.prompt = event.target.value.slice(0, 4000);
    saveGraph();
    return;
  }
  if (node.type === "result" && event.target.matches("[data-expand-prompt]")) {
    node.expandPrompt = event.target.value.slice(0, 1200);
    saveGraph();
    return;
  }
  if (node.type === "result" && event.target.matches("[data-result-generation-prompt]")) {
    node.generationPrompt = event.target.value.slice(0, 4000);
    saveGraph();
  }
});

nodeLayer?.addEventListener("change", async (event) => {
  const element = event.target.closest("[data-workflow-node-id]");
  if (!element) return;
  const node = graph.nodes.find((item) => item.id === element.dataset.workflowNodeId);
  if (!node) return;
  if (node.type === "studio" && event.target.matches("[data-studio-file]")) {
    const files = [...(event.target.files || [])].filter(isImageFile);
    event.target.value = "";
    if (files.length) await uploadFiles(node.id, files);
    return;
  }
  if (node.type === "studio" && event.target.matches("[data-studio-ratio]")) {
    node.ratio = ratios.includes(event.target.value) ? event.target.value : "1:1";
  }
  if (node.type === "studio" && event.target.matches("[data-studio-count]")) {
    node.count = clampCount(event.target.value);
  }
  if (node.type === "result" && event.target.matches("[data-expand-ratio]")) {
    node.expandRatio = expandRatios.includes(event.target.value) ? event.target.value : "original";
  }
  if (node.type === "result" && event.target.matches("[data-expand-scale]")) {
    node.expandScale = ["1", "1.25", "1.5", "2"].includes(event.target.value) ? event.target.value : "1.5";
  }
  if (node.type === "result" && event.target.matches("[data-expand-preset]")) {
    node.expandPreset = ["general", "photo", "poster", "product"].includes(event.target.value)
      ? event.target.value
      : "general";
  }
  saveGraph();
  renderGraph();
});

nodeLayer?.addEventListener("paste", async (event) => {
  const element = event.target.closest("[data-workflow-node-id]");
  const node = graph.nodes.find((item) => item.id === element?.dataset.workflowNodeId);
  if (!node || node.type !== "studio") return;
  const files = [...(event.clipboardData?.files || [])].filter(isImageFile);
  if (!files.length) return;
  event.preventDefault();
  await uploadFiles(node.id, files);
});

nodeLayer?.addEventListener("dragstart", (event) => {
  const reference = event.target.closest("[data-reference-object-id]");
  if (!reference) return;
  event.dataTransfer?.setData("text/plain", JSON.stringify({
    nodeId: reference.dataset.nodeId,
    objectId: reference.dataset.referenceObjectId
  }));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
});

nodeLayer?.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-reference-object-id]")) event.preventDefault();
});

nodeLayer?.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-reference-object-id]");
  if (!target) return;
  event.preventDefault();
  try {
    const source = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
    if (source.nodeId !== target.dataset.nodeId || source.objectId === target.dataset.referenceObjectId) return;
    const node = graph.nodes.find((item) => item.id === source.nodeId && item.type === "studio");
    if (!node) return;
    const ids = [...referenceIdsForStudio(node)];
    const from = ids.indexOf(source.objectId);
    const to = ids.indexOf(target.dataset.referenceObjectId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    node.referenceOrderObjectIds = ids;
    saveGraph();
    renderGraph();
  } catch {}
});

nodeLayer?.addEventListener("keydown", (event) => {
  const upload = event.target.closest(".studio-upload-zone, .studio-add-reference");
  if (!upload || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  upload.querySelector("[data-studio-file]")?.click();
});

document.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".studio-ratio-picker")) return;
  nodeLayer?.querySelectorAll(".studio-ratio-menu").forEach((menu) => { menu.hidden = true; });
  nodeLayer?.querySelectorAll("[data-studio-ratio-trigger]").forEach((trigger) => {
    trigger.setAttribute("aria-expanded", "false");
  });
  if (!event.target.closest(".workflow-group-theme-picker")) {
    nodeLayer?.querySelectorAll(".workflow-group-theme-menu").forEach((menu) => { menu.hidden = true; });
  }
});

nodeLayer?.addEventListener("pointerdown", (event) => {
  const cropTarget = event.target.closest("[data-crop-handle], [data-crop-box]");
  if (cropTarget) {
    const element = cropTarget.closest("[data-workflow-node-id]");
    const node = graph.nodes.find((item) => item.id === element?.dataset.workflowNodeId && item.type === "result");
    const preview = element?.querySelector(".result-preview");
    if (node && preview) {
      event.preventDefault();
      event.stopPropagation();
      const rect = preview.getBoundingClientRect();
      cropDragState = {
        nodeId: node.id,
        mode: cropTarget.dataset.cropHandle || "move",
        startX: event.clientX,
        startY: event.clientY,
        crop: { ...normalizeCrop(node.crop) },
        rect
      };
      cropTarget.setPointerCapture?.(event.pointerId);
    }
    return;
  }
  const output = event.target.closest("[data-workflow-output]");
  if (output) {
    event.preventDefault();
    event.stopPropagation();
    const element = output.closest("[data-workflow-node-id]");
    const sourceNode = graph.nodes.find((node) => node.id === element.dataset.workflowNodeId);
    const sourcePort = workflowPortDefinition(sourceNode, "output", output.dataset.workflowOutput);
    if (!sourcePort) return;
    connectionDraft = {
      fromNode: element.dataset.workflowNodeId,
      fromPort: output.dataset.workflowOutput,
      type: sourcePort.type,
      pointer: clientToWorld(event.clientX, event.clientY),
      target: null
    };
    updateConnectionTargets(event.clientX, event.clientY);
    output.setPointerCapture?.(event.pointerId);
    renderEdges();
    return;
  }

  const groupSurface = event.target.closest("[data-workflow-group-id]");
  if (groupSurface && !event.target.closest("[data-workflow-node-id], button, input, select, textarea")) {
    const groupId = groupSurface.dataset.workflowGroupId;
    const members = graph.nodes
      .filter((item) => item.type === "result" && item.workflowGroupId === groupId)
      .map((item) => ({ id: item.id, x: item.x, y: item.y }));
    if (members.length) {
      event.preventDefault();
      event.stopPropagation();
      const point = clientToWorld(event.clientX, event.clientY);
      selectedResultNodeIds = new Set(members.map((item) => item.id));
      selectedResultNodeId = null;
      isolatedWorkflowResultNodeId = null;
      dragState = {
        id: members[0].id,
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        historySnapshot: workflowGraphSnapshot(),
        members,
        groupId,
        groupSurface,
        groupSurfaces: [...nodeLayer.querySelectorAll(`[data-workflow-group-id="${CSS.escape(groupId)}"]`)]
          .filter((item) => !item.closest("[data-workflow-node-id]"))
          .map((item) => ({
            element: item,
            left: Number.parseFloat(item.style.left) || 0,
            top: Number.parseFloat(item.style.top) || 0
          }))
      };
      groupSurface.setPointerCapture?.(event.pointerId);
      nodeLayer.querySelectorAll(`[data-workflow-group-id="${CSS.escape(groupId)}"]`).forEach((item) => item.classList.add("dragging"));
      dispatchWorkflowResultSelection();
    }
    return;
  }

  const header = event.target.closest(".studio-node-header, .result-node-header");
  const resultPreview = event.target.closest(".result-preview");
  const dragHandle = header || resultPreview;
  if (!dragHandle || event.target.closest("button")) return;
  if (event.shiftKey) return;
  event.preventDefault();
  event.stopPropagation();
  const element = dragHandle.closest("[data-workflow-node-id]");
  const node = graph.nodes.find((item) => item.id === element?.dataset.workflowNodeId);
  if (!node) return;
  const point = clientToWorld(event.clientX, event.clientY);
  dragState = {
    id: node.id,
    offsetX: point.x - node.x,
    offsetY: point.y - node.y,
    pointerId: event.pointerId,
    startX: point.x,
    startY: point.y,
    historySnapshot: workflowGraphSnapshot(),
    members: node.type === "result" && selectedResultNodeIds.size > 1 && selectedResultNodeIds.has(node.id)
      ? graph.nodes
        .filter((item) => item.type === "result" && selectedResultNodeIds.has(item.id))
        .map((item) => ({ id: item.id, x: item.x, y: item.y }))
      : null
  };
  element.setPointerCapture?.(event.pointerId);
  element.classList.add("dragging");
});

document.addEventListener("pointermove", (event) => {
  if (cropDragState) {
    updateCropFromPointer(event);
    return;
  }
  if (connectionDraft) {
    updateConnectionTargets(event.clientX, event.clientY);
    renderEdges();
  }
  if (!dragState) return;
  const node = graph.nodes.find((item) => item.id === dragState.id);
  if (!node) return;
  const point = clientToWorld(event.clientX, event.clientY);
  if (dragState.members?.length) {
    const dx = point.x - dragState.startX;
    const dy = point.y - dragState.startY;
    for (const member of dragState.members) {
      const selectedNode = graph.nodes.find((item) => item.id === member.id);
      if (!selectedNode) continue;
      selectedNode.x = Math.round(member.x + dx);
      selectedNode.y = Math.round(member.y + dy);
      const selectedElement = nodeElement(member.id);
      if (selectedElement) {
        selectedElement.style.left = `${selectedNode.x}px`;
        selectedElement.style.top = `${selectedNode.y}px`;
      }
    }
    dragState.groupSurfaces?.forEach((surface) => {
      surface.element.style.left = `${surface.left + dx}px`;
      surface.element.style.top = `${surface.top + dy}px`;
    });
    renderEdges();
    return;
  }
  node.x = Math.round(point.x - dragState.offsetX);
  node.y = Math.round(point.y - dragState.offsetY);
  const element = nodeElement(node.id);
  if (element) {
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
  }
  renderEdges();
});

document.addEventListener("pointerup", (event) => {
  if (cropDragState) {
    cropDragState = null;
    saveGraph();
    return;
  }
  if (connectionDraft) {
    const input = event.target.closest?.("[data-workflow-input]") || connectionDraft.target;
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
    clearConnectionTargetClasses();
    renderEdges();
  }
  if (dragState) {
    const movedGroup = Boolean(dragState.groupId);
    recordWorkflowHistory(dragState.historySnapshot);
    nodeElement(dragState.id)?.classList.remove("dragging");
    if (dragState.groupId) {
      nodeLayer?.querySelectorAll(`[data-workflow-group-id="${CSS.escape(dragState.groupId)}"]`).forEach((item) => item.classList.remove("dragging"));
    }
    dragState = null;
    saveGraph();
    if (movedGroup) renderGraph();
  }
});

document.addEventListener("pointercancel", () => {
  if (!connectionDraft) return;
  connectionDraft = null;
  clearConnectionTargetClasses();
  renderEdges();
});

function workflowNodeScreenBounds(nodes) {
  const elements = nodes.map((node) => nodeElement(node.id)).filter(Boolean);
  if (!elements.length || !board) return null;
  const rects = elements.map((element) => element.getBoundingClientRect());
  const boardRect = board.getBoundingClientRect();
  return {
    left: Math.min(...rects.map((rect) => rect.left)) - boardRect.left,
    top: Math.min(...rects.map((rect) => rect.top)) - boardRect.top - 52,
    right: Math.max(...rects.map((rect) => rect.right)) - boardRect.left,
    bottom: Math.max(...rects.map((rect) => rect.bottom)) - boardRect.top
  };
}

edgeLayer?.addEventListener("click", (event) => {
  const path = event.target.closest("[data-workflow-edge-id]");
  if (!path) return;
  graph.edges = graph.edges.filter((edge) => edge.id !== path.dataset.workflowEdgeId);
  saveGraph();
  renderGraph();
  showToast(tr("connectionRemoved"));
});

new MutationObserver(() => {
  localizeToolbar();
  renderGraph();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

window.addEventListener("storage", (event) => {
  if (event.key !== storageKey) return;
  graph = loadGraph();
  renderGraph();
  resumeJobs();
});

// Re-render edges when canvas objects are moved or resized
window.addEventListener("codex-canvas:object-updated", () => {
  renderEdges();
});

await refreshCanvasState();
await materializeCompletedLayerGroups();
localizeToolbar();
saveGraph();
renderGraph();
resumeJobs();
window.setInterval(refreshCanvasState, 2000);

function loadGraph() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "");
    if (stored && Array.isArray(stored.nodes) && Array.isArray(stored.edges)) {
      const normalizedNodes = stored.nodes.map(normalizeNode).filter(Boolean);
      const seenResults = new Set();
      const nodes = normalizedNodes.filter((node) => {
        if (node.type !== "result") return true;
        const key = node.jobId || node.objectId || node.id;
        if (seenResults.has(key)) return false;
        seenResults.add(key);
        return true;
      });
      const nodeIds = new Set(nodes.map((node) => node.id));
      return {
        nodes,
        edges: stored.edges
          .map(normalizeEdge)
          .filter((edge) => edge && nodeIds.has(edge.fromNode) && nodeIds.has(edge.toNode))
      };
    }
  } catch {}
  return { nodes: [], edges: [] };
}

function normalizeNode(node) {
  if (!node?.id || !nodeTypes.has(node.type)) return null;
  return {
    id: String(node.id),
    type: node.type,
    x: Number.isFinite(node.x) ? node.x : 120,
    y: Number.isFinite(node.y) ? node.y : 120,
    prompt: typeof node.prompt === "string" ? node.prompt.slice(0, 4000) : "",
    generationMode: node.generationMode === "image" ? "image" : "text",
    ratio: ratios.includes(node.ratio) ? node.ratio : "1:1",
    count: clampCount(node.count),
    referenceObjectIds: legacyReferenceObjectIds(node),
    referenceBindings: normalizeReferenceBindings(node),
    referenceOrderObjectIds: Array.isArray(node.referenceOrderObjectIds)
      ? [...new Set(node.referenceOrderObjectIds.map(String))].slice(0, 6)
      : [],
    objectId: typeof node.objectId === "string" ? node.objectId : null,
    objectIds: Array.isArray(node.objectIds) ? [...new Set(node.objectIds.map(String))].slice(0, 32) : [],
    activeResultIndex: Number.isFinite(node.activeResultIndex) ? Math.max(0, Math.round(node.activeResultIndex)) : 0,
    compositeObjectId: typeof node.compositeObjectId === "string" ? node.compositeObjectId : null,
    sourceNodeId: typeof node.sourceNodeId === "string" ? node.sourceNodeId : null,
    generationPrompt: typeof node.generationPrompt === "string" ? node.generationPrompt.slice(0, 4000) : "",
    generationRatio: ratios.includes(node.generationRatio) ? node.generationRatio : "1:1",
    generationReferenceObjectIds: Array.isArray(node.generationReferenceObjectIds)
      ? [...new Set(node.generationReferenceObjectIds.map(String))].slice(0, 6)
      : [],
    batchId: typeof node.batchId === "string" ? node.batchId : null,
    batchIndex: Number.isFinite(node.batchIndex) ? Math.max(0, Math.round(node.batchIndex)) : 0,
    generatedAt: typeof node.generatedAt === "string" ? node.generatedAt : "",
    assetKind: ["upload", "ai", "edited", "removed-bg"].includes(node.assetKind) ? node.assetKind : null,
    derivedAction: ["remove-bg", "crop", "expand", "edit-elements"].includes(node.derivedAction)
      ? node.derivedAction
      : null,
    layerGroupId: typeof node.layerGroupId === "string" ? node.layerGroupId : null,
    workflowGroupId: typeof node.workflowGroupId === "string" ? node.workflowGroupId : null,
    workflowGroupTheme: node.workflowGroupTheme === "violet"
      ? "grape"
      : node.workflowGroupTheme === "blue"
        ? "sky"
        : workflowGroupThemes.includes(node.workflowGroupTheme) ? node.workflowGroupTheme : "default",
    workflowGroupName: typeof node.workflowGroupName === "string" ? node.workflowGroupName.slice(0, 80) : "",
    jobId: typeof node.jobId === "string" ? node.jobId : null,
    jobIds: Array.isArray(node.jobIds) ? node.jobIds.map(String).slice(0, 4) : [],
    exportResolution: exportResolutions.includes(node.exportResolution) ? node.exportResolution : "1k",
    exportFormat: exportFormats.includes(node.exportFormat) ? node.exportFormat : "png",
    editMode: node.editMode === "expand" ? "expand" : null,
    crop: normalizeCrop(node.crop),
    expandPrompt: typeof node.expandPrompt === "string" ? node.expandPrompt.slice(0, 1200) : "",
    expandRatio: expandRatios.includes(node.expandRatio) ? node.expandRatio : "original",
    expandScale: ["1", "1.25", "1.5", "2"].includes(String(node.expandScale)) ? String(node.expandScale) : "1.5",
    expandPreset: ["general", "photo", "poster", "product"].includes(node.expandPreset)
      ? node.expandPreset
      : "general",
    status: ["idle", "running", "done", "error", "cancelled"].includes(node.status) ? node.status : "idle",
    error: typeof node.error === "string" ? node.error.slice(0, 500) : ""
  };
}

function normalizeEdge(edge) {
  if (!edge?.id || !edge?.fromNode || !edge?.toNode) return null;
  return {
    id: String(edge.id),
    fromNode: String(edge.fromNode),
    fromPort: String(edge.fromPort || "output"),
    toNode: String(edge.toNode),
    toPort: String(edge.toPort || "input"),
    type: edge.type === workflowDataTypes.image ? edge.type : workflowDataTypes.image,
    order: Number.isFinite(edge.order) ? Math.max(0, Math.round(edge.order)) : 0
  };
}

function legacyReferenceObjectIds(node) {
  const fromBindings = Array.isArray(node.referenceBindings)
    ? node.referenceBindings.map((binding) => binding?.objectId)
    : [];
  const legacy = Array.isArray(node.referenceObjectIds) ? node.referenceObjectIds : [];
  return [...new Set([...fromBindings, ...legacy].filter(Boolean).map(String))].slice(0, 6);
}

function normalizeReferenceBindings(node) {
  const source = Array.isArray(node.referenceBindings)
    ? node.referenceBindings
    : (Array.isArray(node.referenceObjectIds) ? node.referenceObjectIds.map((objectId) => ({ objectId })) : []);
  const seen = new Set();
  return source.flatMap((binding, index) => {
    const objectId = String(binding?.objectId || "").trim();
    if (!objectId || seen.has(objectId) || seen.size >= 6) return [];
    seen.add(objectId);
    return [{
      id: String(binding?.id || `reference_${objectId}`),
      objectId,
      source: "upload",
      order: Number.isFinite(binding?.order) ? Math.max(0, Math.round(binding.order)) : index
    }];
  });
}

function saveGraph() {
  localStorage.setItem(storageKey, JSON.stringify(graph));
}

function workflowGraphSnapshot() {
  return JSON.stringify(graph);
}

function recordWorkflowHistory(snapshot = workflowGraphSnapshot()) {
  if (!snapshot || snapshot === workflowGraphSnapshot()) return;
  if (workflowUndoStack.at(-1) !== snapshot) workflowUndoStack.push(snapshot);
  if (workflowUndoStack.length > workflowHistoryLimit) workflowUndoStack.shift();
  workflowRedoStack.length = 0;
}

function runWorkflowHistory(direction) {
  const source = direction === "undo" ? workflowUndoStack : workflowRedoStack;
  const target = direction === "undo" ? workflowRedoStack : workflowUndoStack;
  const snapshot = source.pop();
  if (!snapshot) return false;
  target.push(workflowGraphSnapshot());
  graph = JSON.parse(snapshot);
  selectedResultNodeIds = new Set([...selectedResultNodeIds].filter((id) => graph.nodes.some((node) => node.id === id)));
  if (selectedResultNodeId && !selectedResultNodeIds.has(selectedResultNodeId)) selectedResultNodeId = null;
  if (isolatedWorkflowResultNodeId && !selectedResultNodeIds.has(isolatedWorkflowResultNodeId)) isolatedWorkflowResultNodeId = null;
  saveGraph();
  renderGraph();
  requestAnimationFrame(dispatchWorkflowResultSelection);
  return true;
}

function addStudioNode(options = {}) {
  const center = viewportCenterInWorld();
  const offset = graph.nodes.filter((node) => node.type === "studio").length % 4;
  const node = normalizeNode({
    id: createId("studio"),
    type: "studio",
    x: Math.round(center.x - nodeSizes.studio.width / 2 + offset * 36),
    y: Math.round(center.y - nodeSizes.studio.height / 2 + offset * 28),
    status: "idle",
    generationMode: options.mode === "text" ? "text" : "image",
    ratio: "1:1",
    count: 1,
    referenceObjectIds: []
  });
  graph.nodes.push(node);
  saveGraph();
  renderGraph();
  requestAnimationFrame(() => {
    const textarea = nodeElement(node.id)?.querySelector("[data-studio-prompt]");
    textarea?.focus({ preventScroll: true });
  });
  return node;
}

function createStudioFromReferences(objectIds, options = {}) {
  const references = [...new Set((objectIds || []).map(String))]
    .filter((id) => canvasObject(id)?.src)
    .slice(0, 6);
  if (!references.length) return null;
  const center = viewportCenterInWorld();
  const node = normalizeNode({
    id: createId("studio"),
    type: "studio",
    x: Math.round(center.x - nodeSizes.studio.width / 2),
    y: Math.round(center.y - nodeSizes.studio.height / 2),
    status: "idle",
    generationMode: "image",
    ratio: ratios.includes(options.ratio) ? options.ratio : "1:1",
    count: 1,
    prompt: typeof options.prompt === "string" ? options.prompt : "",
    referenceObjectIds: []
  });
  graph.nodes.push(node);
  for (const [index, objectId] of references.entries()) {
    const assetNode = ensureCanvasAssetNode(objectId, index);
    if (!assetNode) continue;
    graph.edges.push({
      id: createId("edge"),
      fromNode: assetNode.id,
      fromPort: "image",
      toNode: node.id,
      toPort: "images",
      type: workflowDataTypes.image,
      order: index
    });
  }
  saveGraph();
  renderGraph();
  requestAnimationFrame(() => {
    const element = nodeElement(node.id);
    const textarea = element?.querySelector("[data-studio-prompt]");
    textarea?.focus({ preventScroll: true });
    element?.scrollIntoView?.({ block: "center", inline: "center" });
  });
  return node;
}

function ensureCanvasAssetNode(objectId, index = 0) {
  const existing = graph.nodes.find((node) => node.type === "result" && node.objectId === objectId);
  if (existing) return existing;
  const object = canvasObject(objectId);
  if (!object?.src) return null;
  const node = normalizeNode({
    id: createId("asset"),
    type: "result",
    objectId,
    objectIds: [objectId],
    assetKind: "upload",
    x: Number.isFinite(object.x) ? object.x : 120 + index * 40,
    y: Number.isFinite(object.y) ? object.y : 120 + index * 40,
    status: "done"
  });
  graph.nodes.push(node);
  // Note:不再调用 hideCanvasObject，图片保留在画布上可见
  // 因为统一渲染逻辑，已完成的 result-node 不会在 workflow layer 中渲染
  // 图片通过 canvas object layer 渲染，保持可见
  return node;
}

function deleteNode(id) {
  if (selectedResultNodeId === id) selectedResultNodeId = null;
  if (isolatedWorkflowResultNodeId === id) isolatedWorkflowResultNodeId = null;
  selectedResultNodeIds.delete(id);
  graph.nodes = graph.nodes.filter((node) => node.id !== id);
  graph.edges = graph.edges.filter((edge) => edge.fromNode !== id && edge.toNode !== id);
  saveGraph();
  renderGraph();
}

function removeDirectReference(nodeId, objectId) {
  const node = graph.nodes.find((item) => item.id === nodeId && item.type === "studio");
  if (!node) return;
  node.referenceObjectIds = node.referenceObjectIds.filter((id) => id !== objectId);
  node.referenceBindings = node.referenceBindings.filter((binding) => binding.objectId !== objectId);
  graph.edges = graph.edges.filter((edge) => {
    if (edge.toNode !== nodeId || edge.toPort !== "images") return true;
    const source = graph.nodes.find((item) => item.id === edge.fromNode);
    const sourceObjectId = source?.type === "layerGroup" ? source.compositeObjectId : source?.objectId;
    return sourceObjectId !== objectId;
  });
  node.referenceOrderObjectIds = node.referenceOrderObjectIds.filter((id) => id !== objectId);
  saveGraph();
  renderGraph();
}

function connectNodes(fromNodeId, fromPort, toNodeId, toPort) {
  if (fromNodeId === toNodeId) return;
  const from = graph.nodes.find((node) => node.id === fromNodeId);
  const to = graph.nodes.find((node) => node.id === toNodeId);
  const output = workflowPortDefinition(from, "output", fromPort);
  const input = workflowPortDefinition(to, "input", toPort);
  if (!portsAreCompatible(output, input)) {
    showToast(tr("incompatible"));
    return;
  }
  const existing = graph.edges.some((edge) => (
    edge.fromNode === fromNodeId
    && edge.fromPort === fromPort
    && edge.toNode === toNodeId
    && edge.toPort === toPort
  ));
  if (existing) return;
  const sourceObjectId = objectIdForWorkflowNode(from);
  if (sourceObjectId && referenceIdsForStudio(to).includes(sourceObjectId)) {
    showToast(tr("duplicateReference"));
    return;
  }
  if (referenceIdsForStudio(to).length >= 6) {
    showToast(tr("maxReferences"));
    return;
  }
  if (wouldCreateWorkflowCycle(fromNodeId, toNodeId)) {
    showToast(tr("cycleConnection"));
    return;
  }
  const incomingCount = graph.edges.filter((edge) => edge.toNode === toNodeId && edge.toPort === toPort).length;
  graph.edges.push({
    id: createId("edge"),
    fromNode: fromNodeId,
    fromPort,
    toNode: toNodeId,
    toPort,
    type: output.type,
    order: incomingCount
  });
  saveGraph();
  renderGraph();
}

function workflowPortDefinition(node, direction, portId) {
  if (!node) return null;
  if (["result", "layerGroup"].includes(node.type) && direction === "output" && portId === "image") {
    return { id: portId, direction, type: workflowDataTypes.image, multiple: true };
  }
  if (node.type === "studio" && node.generationMode === "image" && direction === "input" && portId === "images") {
    return { id: portId, direction, type: workflowDataTypes.image, multiple: true, maxConnections: 6 };
  }
  if (node.type === "studio" && direction === "output" && portId === "result") {
    return { id: portId, direction, type: workflowDataTypes.image, multiple: true };
  }
  if (["result", "layerGroup"].includes(node.type) && direction === "input" && portId === "result") {
    return { id: portId, direction, type: workflowDataTypes.image, multiple: false, acceptsManual: false };
  }
  return null;
}

function portsAreCompatible(output, input) {
  return Boolean(output
    && input
    && output.direction === "output"
    && input.direction === "input"
    && input.acceptsManual !== false
    && output.type === input.type);
}

function objectIdForWorkflowNode(node) {
  return node?.type === "layerGroup" ? node.compositeObjectId : node?.objectId;
}

function wouldCreateWorkflowCycle(fromNodeId, toNodeId) {
  const pending = [toNodeId];
  const visited = new Set();
  while (pending.length) {
    const nodeId = pending.pop();
    if (nodeId === fromNodeId) return true;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    for (const edge of graph.edges) {
      if (edge.fromNode === nodeId) pending.push(edge.toNode);
    }
  }
  return false;
}

function openGenerationDialog(objectIds = [], anchorBounds = null) {
  closeGenerationDialog();
  const references = [...new Set(objectIds.map(String))]
    .filter((id) => canvasObject(id)?.src)
    .slice(0, 6);
  const hasRef = references.length > 0;
  const isMultiRef = references.length >= 2;
  const dialog = document.createElement("div");
  dialog.className = "generation-dialog-backdrop";
  dialog.innerHTML = `
    <section class="generation-dialog" role="dialog" aria-modal="true" aria-labelledby="generationDialogTitle">
      <header>
        <div>
          <strong id="generationDialogTitle">${escapeHtml(hasRef ? tr("imageMode") : tr("generationDialogTitle"))}</strong>
          <span>${escapeHtml(hasRef ? (isMultiRef ? tr("multiImageFusionHint") : tr("singleImageRefHint")) : tr("generationDialogHint"))}</span>
        </div>
        <button type="button" class="workflow-icon-button" data-generation-close aria-label="${escapeHtml(tr("cancel"))}">${closeIcon()}</button>
      </header>
      ${hasRef ? "" : `
      <div class="generation-mode-switch" role="tablist" aria-label="${escapeHtml(tr("generationDialogTitle"))}">
        <button type="button" role="tab" data-generation-mode="text">${escapeHtml(tr("textMode"))}</button>
        <button type="button" role="tab" data-generation-mode="image">${escapeHtml(tr("imageMode"))}</button>
      </div>`}
      <div class="generation-dialog-references"></div>
      <button type="button" class="generation-dialog-confirm" data-generation-confirm>${escapeHtml(isMultiRef ? tr("createGenerator") : tr("createGenerator"))}</button>
    </section>`;
  const initialMode = hasRef ? "image" : "text";
  dialog.dataset.mode = initialMode;
  const renderDialog = () => {
    const mode = dialog.dataset.mode;
    for (const button of dialog.querySelectorAll("[data-generation-mode]")) {
      const selected = button.dataset.generationMode === mode;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    }
    const preview = dialog.querySelector(".generation-dialog-references");
    preview.hidden = mode !== "image" && !hasRef;
    preview.replaceChildren();
    if (mode === "image" || hasRef) {
      if (references.length) {
        const refGrid = document.createElement("div");
        refGrid.className = "generation-dialog-ref-grid";
        for (const id of references) {
          const object = canvasObject(id);
          const wrap = document.createElement("div");
          wrap.className = "generation-dialog-ref-item";
          const image = document.createElement("img");
          image.src = assetUrl(object.src, object);
          image.alt = object.name || tr("inputImages");
          wrap.append(image);
          refGrid.append(wrap);
        }
        preview.append(refGrid);
        if (isMultiRef) {
          const fusionHint = document.createElement("div");
          fusionHint.className = "generation-dialog-fusion-hint";
          fusionHint.textContent = tr("multiImageFusionHint");
          preview.append(fusionHint);
        }
      } else {
        const hint = document.createElement("span");
        hint.textContent = tr("referenceHint");
        preview.append(hint);
      }
    }
  };
  dialog.addEventListener("click", (event) => {
    const modeButton = event.target.closest("[data-generation-mode]");
    if (modeButton) {
      dialog.dataset.mode = modeButton.dataset.generationMode;
      renderDialog();
      return;
    }
    if (event.target === dialog || event.target.closest("[data-generation-close]")) {
      closeGenerationDialog();
      return;
    }
    if (event.target.closest("[data-generation-confirm]")) {
      const mode = dialog.dataset.mode;
      closeGenerationDialog();
      if (hasRef) createStudioFromReferences(references);
      else if (mode === "image" && references.length) createStudioFromReferences(references);
      else addStudioNode({ mode });
    }
  });
  document.body.append(dialog);
  generationDialog = dialog;
  renderDialog();
  positionGenerationDialog(dialog, anchorBounds);
  requestAnimationFrame(() => dialog.querySelector("[data-generation-confirm]")?.focus({ preventScroll: true }));
}

function positionGenerationDialog(backdrop, anchorBounds) {
  const panel = backdrop?.querySelector(".generation-dialog");
  if (!panel) return;
  const validAnchor = anchorBounds
    && [anchorBounds.left, anchorBounds.top, anchorBounds.right, anchorBounds.bottom].every(Number.isFinite);
  if (!validAnchor) {
    panel.classList.add("generation-dialog-centered");
    return;
  }
  const gap = 18;
  const edge = 16;
  const rect = panel.getBoundingClientRect();
  let left = anchorBounds.right + gap;
  if (left + rect.width > window.innerWidth - edge) left = anchorBounds.left - rect.width - gap;
  left = Math.max(edge, Math.min(left, window.innerWidth - rect.width - edge));
  const top = Math.max(edge, Math.min(anchorBounds.top, window.innerHeight - rect.height - edge));
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function closeGenerationDialog() {
  generationDialog?.remove();
  generationDialog = null;
}

function renderGraph() {
  if (!layer || !nodeLayer) return;
  const hasNodes = graph.nodes.length > 0;
  layer.hidden = !hasNodes;
  if (!hasNodes) {
    nodeLayer.replaceChildren();
    edgeLayer?.replaceChildren();
    return;
  }
  nodeLayer.replaceChildren();
  renderWorkflowGroupSections().forEach((section) => nodeLayer.append(section));
  for (const node of graph.nodes) {
    if (node.type === "studio") nodeLayer.append(renderStudioNode(node));
    else if (node.type === "layerGroup") nodeLayer.append(renderLayerGroupNode(node));
    else if (node.type === "result") {
      // Skip completed result nodes that have been materialized to canvas objects
      // These are now rendered through the standard canvas object layer
      if (!shouldRenderResultNode(node)) continue;
      nodeLayer.append(renderResultNode(node));
    }
  }
  const multiSelection = renderWorkflowMultiSelection();
  if (multiSelection) nodeLayer.append(multiSelection);
  renderEdges();
}

function shouldRenderResultNode(node) {
  // Render result node if:
  // 1. It's still generating (no objectId yet or status is running)
  // 2. It has an error state
  // 3. It has edit mode active (crop, expand, etc.)
  if (node.status === "running" || node.status === "error") return true;
  if (node.editMode && node.editMode !== "idle") return true;
  // If it has no objectId yet, still render
  if (!node.objectId) return true;
  // Completed result nodes with objectId are rendered through canvas object layer
  return false;
}

function renderWorkflowGroupSections() {
  const groups = new Map();
  graph.nodes.filter((node) => node.type === "result" && node.workflowGroupId && shouldRenderResultNode(node)).forEach((node) => {
    if (!groups.has(node.workflowGroupId)) groups.set(node.workflowGroupId, []);
    groups.get(node.workflowGroupId).push(node);
  });
  return [...groups.entries()].filter(([, nodes]) => nodes.length > 1).flatMap(([groupId, nodes]) => {
    const left = Math.min(...nodes.map((node) => node.x)) - workflowGroupPadding;
    const top = Math.min(...nodes.map((node) => node.y)) - workflowGroupPadding;
    const right = Math.max(...nodes.map((node) => node.x + nodeSize(node).width)) + workflowGroupPadding;
    const bottom = Math.max(...nodes.map((node) => node.y + nodeSize(node).height)) + workflowGroupPadding;
    const storedTheme = nodes[0].workflowGroupTheme || "default";
    const theme = storedTheme === "violet" ? "grape" : storedTheme === "blue" ? "sky" : storedTheme;
    const section = document.createElement("section");
    const selected = selectedWorkflowGroupId() === groupId;
    section.className = `workflow-group-section theme-${theme}${selected ? " selected" : ""}`;
    section.dataset.workflowGroupId = groupId;
    section.style.left = `${left}px`;
    section.style.top = `${top}px`;
    section.style.width = `${right - left}px`;
    section.style.height = `${bottom - top}px`;
    const header = document.createElement("header");
    header.className = `workflow-group-section-header theme-${theme}${selected ? " selected" : ""}`;
    header.dataset.workflowGroupId = groupId;
    header.style.left = `${left}px`;
    header.style.top = `${top - 40}px`;
    header.style.width = `${right - left}px`;
    const nameWrap = document.createElement("span");
    nameWrap.className = "workflow-group-name-wrap";
    const title = document.createElement("strong");
    title.className = "workflow-group-name";
    title.textContent = nodes[0].workflowGroupName || (document.documentElement.lang.startsWith("zh") ? "生成分区" : "Generation section");
    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "workflow-group-rename";
    rename.dataset.workflowGroupRename = groupId;
    rename.title = document.documentElement.lang.startsWith("zh") ? "编辑分区名称" : "Rename section";
    rename.setAttribute("aria-label", rename.title);
    rename.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
    nameWrap.append(title, rename);
    const themePicker = document.createElement("div");
    themePicker.className = "workflow-group-theme-picker";
    const themeTrigger = document.createElement("button");
    themeTrigger.type = "button";
    themeTrigger.className = "workflow-group-theme-trigger";
    themeTrigger.dataset.workflowGroupThemeTrigger = groupId;
    themeTrigger.setAttribute("aria-expanded", "false");
    themeTrigger.setAttribute("aria-label", document.documentElement.lang.startsWith("zh") ? "分区颜色主题" : "Section color theme");
    themeTrigger.innerHTML = `<span class="workflow-theme-dot theme-${theme}"></span><span>${workflowGroupThemeLabel(theme)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg>`;
    const themeMenu = document.createElement("div");
    themeMenu.className = "workflow-group-theme-menu";
    themeMenu.hidden = true;
    workflowGroupThemes.forEach((value) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = `workflow-group-theme-option${value === theme ? " selected" : ""}`;
      option.dataset.workflowGroupId = groupId;
      option.dataset.workflowGroupThemeOption = value;
      option.innerHTML = `<span class="workflow-theme-dot theme-${value}"></span><span>${workflowGroupThemeLabel(value)}</span>`;
      themeMenu.append(option);
    });
    themePicker.append(themeTrigger, themeMenu);
    header.append(nameWrap, themePicker);
    return [section, header];
  });
}

function workflowGroupThemeLabel(theme) {
  const zh = { default: "默认", sky: "天空蓝", grape: "葡萄紫", mint: "薄荷绿", amber: "琥珀黄", rose: "玫瑰红" };
  const en = { default: "Default", sky: "Sky", grape: "Grape", mint: "Mint", amber: "Amber", rose: "Rose" };
  return (document.documentElement.lang.startsWith("zh") ? zh : en)[theme] || theme;
}

function beginWorkflowGroupNameEdit(section, groupId) {
  const wrap = section?.querySelector(".workflow-group-name-wrap");
  if (!wrap || wrap.querySelector("input")) return;
  const nodes = graph.nodes.filter((node) => node.workflowGroupId === groupId);
  if (!nodes.length) return;
  const previousName = nodes[0].workflowGroupName || (document.documentElement.lang.startsWith("zh") ? "生成分区" : "Generation section");
  const input = document.createElement("input");
  input.className = "workflow-group-name-input";
  input.value = previousName;
  wrap.replaceChildren(input);
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const nextName = input.value.trim().slice(0, 80);
    if (save && nextName && nextName !== previousName) {
      const historySnapshot = workflowGraphSnapshot();
      nodes.forEach((node) => { node.workflowGroupName = nextName; });
      recordWorkflowHistory(historySnapshot);
      saveGraph();
    }
    renderGraph();
  };
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); finish(true); }
    if (event.key === "Escape") { event.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true), { once: true });
  input.focus();
  input.select();
}

function renderWorkflowMultiSelection() {
  if (selectedWorkflowGroupId()) return null;
  // A completed result is shown by the regular canvas object layer. Its
  // workflow coordinates can be stale after the user moves the image, and a
  // second workflow selection frame would therefore be both duplicate and
  // incorrect. Only render this frame for result cards that still live in the
  // workflow layer (pending/error/editing states).
  const nodes = graph.nodes.filter((node) => (
    node.type === "result"
    && selectedResultNodeIds.has(node.id)
    && shouldRenderResultNode(node)
  ));
  if (nodes.length < 2) return null;
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + nodeSize(node).width));
  const bottom = Math.max(...nodes.map((node) => node.y + nodeSize(node).height));
  const frame = document.createElement("div");
  frame.className = "workflow-multi-selection";
  frame.style.left = `${left}px`;
  frame.style.top = `${top}px`;
  frame.style.width = `${right - left}px`;
  frame.style.height = `${bottom - top}px`;
  for (const direction of ["nw", "ne", "se", "sw"]) {
    const handle = document.createElement("span");
    handle.className = `workflow-multi-selection-handle resize-${direction}`;
    frame.append(handle);
  }
  const size = document.createElement("span");
  size.className = "workflow-multi-selection-size";
  size.textContent = `${Math.round(right - left)} × ${Math.round(bottom - top)}`;
  frame.append(size);
  return frame;
}

// 画布侧完成对齐后，同步工作流 result 节点的坐标，保持工作流图与画布一致
window.addEventListener("codex-canvas:workflow-nodes-aligned", (event) => {
  const updates = Array.isArray(event.detail?.updates) ? event.detail.updates : [];
  if (!updates.length) return;
  const byId = new Map(updates.map((item) => [item.id, item.patch]));
  let changed = false;
  for (const node of graph.nodes) {
    if (node.type !== "result" || !node.objectId) continue;
    const patch = byId.get(node.objectId);
    if (!patch) continue;
    if (Number.isFinite(patch.x) && node.x !== patch.x) { node.x = patch.x; changed = true; }
    if (Number.isFinite(patch.y) && node.y !== patch.y) { node.y = patch.y; changed = true; }
  }
  if (!changed) return;
  saveGraph();
  renderGraph();
});

window.addEventListener("codex-canvas:toggle-workflow-result-group", () => {
  const nodes = graph.nodes.filter((node) => node.type === "result" && selectedResultNodeIds.has(node.id));
  if (nodes.length < 2) return;
  const historySnapshot = workflowGraphSnapshot();
  const sharedGroupId = nodes[0].workflowGroupId
    && nodes.every((node) => node.workflowGroupId === nodes[0].workflowGroupId)
    ? nodes[0].workflowGroupId
    : null;
  const nextGroupId = sharedGroupId ? null : `workflow_group_${crypto.randomUUID()}`;
  const usedThemes = new Set(graph.nodes.map((node) => node.workflowGroupTheme).filter(Boolean));
  const nextTheme = workflowGroupThemes.find((theme) => !usedThemes.has(theme)) || workflowGroupThemes[0];
  const groupNumber = new Set(graph.nodes.map((node) => node.workflowGroupId).filter(Boolean)).size + 1;
  const nextName = document.documentElement.lang.startsWith("zh") ? `生成分区 ${groupNumber}` : `Generation section ${groupNumber}`;
  nodes.forEach((node) => {
    node.workflowGroupId = nextGroupId;
    node.workflowGroupTheme = nextGroupId ? nextTheme : "default";
    node.workflowGroupName = nextGroupId ? nextName : "";
  });
  isolatedWorkflowResultNodeId = null;
  recordWorkflowHistory(historySnapshot);
  saveGraph();
  renderGraph();
  requestAnimationFrame(dispatchWorkflowResultSelection);
});

function renderStudioNode(node) {
  const element = baseNodeElement(node, "studio-node");
  const header = document.createElement("header");
  header.className = "studio-node-header";
  const heading = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = tr("studioTitle");
  const mode = document.createElement("span");
  mode.className = "studio-mode";
  mode.textContent = modeLabel(node);
  heading.append(title, mode);
  const status = document.createElement("span");
  status.className = `studio-status studio-status-${node.status}`;
  status.textContent = statusLabel(node.status);
  const remove = iconButton("close", tr("deleteNode"));
  remove.dataset.workflowDelete = node.id;
  header.append(heading, status, remove);

  const body = document.createElement("div");
  body.className = "studio-node-body";
  const references = document.createElement("section");
  references.className = "studio-references";
  references.tabIndex = 0;
  references.setAttribute("aria-label", tr("inputImages"));
  const referenceIds = referenceIdsForStudio(node);
  references.hidden = node.generationMode === "text" && referenceIds.length === 0;
  if (referenceIds.length) {
    const grid = document.createElement("div");
    grid.className = "studio-reference-grid";
    for (const objectId of referenceIds) {
      grid.append(renderReference(node, objectId));
    }
    references.append(grid);
  }
  if (referenceIds.length < 6) {
    const upload = document.createElement("label");
    upload.className = referenceIds.length ? "studio-add-reference" : "studio-upload-zone";
    upload.setAttribute("aria-label", tr("upload"));
    upload.tabIndex = 0;
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.multiple = true;
    picker.hidden = true;
    picker.dataset.studioFile = node.id;
    upload.innerHTML = uploadIcon();
    const uploadText = document.createElement("strong");
    uploadText.textContent = tr("upload");
    const hint = document.createElement("span");
    hint.textContent = referenceIds.length ? tr("referenceHint") : tr("uploadHint");
    upload.append(picker, uploadText, hint);
    references.append(upload);
  }

  const promptLabel = document.createElement("label");
  promptLabel.className = "studio-prompt-field";
  const promptTitle = document.createElement("span");
  promptTitle.textContent = tr("prompt");
  const textarea = document.createElement("textarea");
  textarea.dataset.studioPrompt = "";
  textarea.maxLength = 4000;
  textarea.placeholder = tr("promptPlaceholder");
  textarea.value = node.prompt;
  textarea.addEventListener("pointerdown", (event) => event.stopPropagation());
  promptLabel.append(promptTitle, textarea);

  const settings = document.createElement("div");
  settings.className = "studio-settings";
  settings.append(
    ratioPicker(node),
    selectField(tr("count"), "studio-count", String(node.count), [1, 2, 3, 4].map((value) => [String(value), String(value)]))
  );

  const run = document.createElement("button");
  run.type = "button";
  run.className = "studio-run";
  run.dataset.studioRun = node.id;
  run.disabled = node.status === "running";
  run.innerHTML = sparkleIcon();
  const runText = document.createElement("span");
  runText.textContent = node.status === "running" ? tr("generating") : tr("generate");
  run.append(runText);

  body.append(promptLabel, references, settings, run);
  if (node.status === "running") body.append(renderStudioGenerationState(node));
  if (node.error) {
    const error = document.createElement("p");
    error.className = "studio-error";
    error.textContent = node.error;
    body.append(error);
  }
  element.append(header, body);
  if (node.generationMode === "image") {
    const inputPort = portButton("input", "images", tr("inputImages"));
    inputPort.style.top = `${studioInputPortOffset(node) - 8}px`;
    element.append(inputPort);
  }
  element.append(portButton("output", "result", tr("output")));
  return element;
}

function renderStudioGenerationState(node) {
  const state = document.createElement("div");
  state.className = "studio-generation-state";
  state.setAttribute("role", "status");
  const visual = document.createElement("span");
  visual.className = "studio-generation-orbit";
  visual.setAttribute("aria-hidden", "true");
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = tr("generating");
  const detail = document.createElement("span");
  const jobCount = Math.max(1, node.jobIds?.length || node.count || 1);
  detail.textContent = document.documentElement.lang.startsWith("zh")
    ? `正在处理 ${jobCount} 个生成任务`
    : `Processing ${jobCount} generation ${jobCount === 1 ? "task" : "tasks"}`;
  copy.append(title, detail);
  const bar = document.createElement("span");
  bar.className = "studio-generation-bar";
  bar.setAttribute("aria-hidden", "true");
  state.append(visual, copy, bar);
  return state;
}

function ratioPicker(node) {
  const field = document.createElement("label");
  field.className = "studio-ratio-field";
  const label = document.createElement("span");
  label.textContent = tr("ratio");
  const picker = document.createElement("div");
  picker.className = "studio-ratio-picker";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "studio-ratio-trigger";
  trigger.dataset.studioRatioTrigger = node.id;
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.append(ratioShape(node.ratio), document.createTextNode(node.ratio));
  const chevron = document.createElement("span");
  chevron.className = "studio-ratio-chevron";
  chevron.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  trigger.append(chevron);

  const menu = document.createElement("div");
  menu.className = "studio-ratio-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  for (const ratio of ratios) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "studio-ratio-option";
    option.dataset.nodeId = node.id;
    option.dataset.studioRatioOption = ratio;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(ratio === node.ratio));
    option.append(ratioShape(ratio), document.createTextNode(ratio));
    if (ratio === node.ratio) {
      const check = document.createElement("span");
      check.className = "studio-ratio-check";
      check.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>';
      option.append(check);
    }
    menu.append(option);
  }
  picker.append(trigger, menu);
  field.append(label, picker);
  return field;
}

function ratioShape(ratio) {
  const [width, height] = String(ratio).split(":").map(Number);
  const shape = document.createElement("span");
  shape.className = "studio-ratio-shape";
  const scale = Math.min(22 / Math.max(1, width), 16 / Math.max(1, height));
  shape.style.width = `${Math.max(7, Math.round(width * scale))}px`;
  shape.style.height = `${Math.max(7, Math.round(height * scale))}px`;
  return shape;
}

function renderResultNode(node) {
  const element = baseNodeElement(node, "result-node");
  if (node.objectId) element.dataset.workflowObjectId = node.objectId;
  element.classList.add("result-node-minimal");
  element.classList.toggle("selected", selectedResultNodeIds.size === 1 && selectedResultNodeIds.has(node.id));
  element.classList.toggle("multi-selected", !selectedWorkflowGroupId() && selectedResultNodeIds.size > 1 && selectedResultNodeIds.has(node.id));
  const object = canvasObject(node.objectId);
  const geometry = resultGeometry(node);
  const header = renderResultControlHeader(node, object);

  const preview = document.createElement("div");
  preview.className = "result-preview";
  preview.style.height = `${geometry.previewHeight}px`;
  if (object?.src) {
    const image = document.createElement("img");
    image.src = assetUrl(object.src, object);
    image.alt = object.name || tr("result");
    preview.append(image);
    if (node.editMode === "crop") preview.append(renderCropOverlay(node));
    const resultIds = [...new Set([...(node.objectIds || []), node.objectId].filter(Boolean))];
    if (resultIds.length > 1) preview.append(renderResultCarousel(node, resultIds));
  } else {
    preview.classList.add("missing");
    const missingTitle = document.createElement("strong");
    missingTitle.textContent = node.status === "running" ? tr("running") : tr("imageUnavailable");
    preview.append(missingTitle);
    if (node.error) {
      const error = document.createElement("span");
      error.className = "result-preview-error";
      error.textContent = node.error;
      preview.append(error);
    }
  }
  element.append(header, preview);
  if (node.editMode === "expand") element.append(renderExpandPanel(node));
  if (node.editMode === "expand") {
    element.append(renderResultActions(node, Boolean(object?.src)));
  }
  if (graph.nodes.some((item) => item.type === "studio" && item.generationMode === "image")) {
    element.append(portButton("input", "result", tr("output")));
    element.append(portButton("output", "image", tr("inputImages")));
  }
  return element;
}

function renderResultControlHeader(node, object) {
  const header = document.createElement("header");
  header.className = "result-node-header result-control-header";
  header.append(
    segmentedControl(node, "resolution", exportResolutions.map((value) => [value, value.toUpperCase()]), node.exportResolution, tr("exportResolution")),
    segmentedControl(node, "format", exportFormats.map((value) => [value, value.toUpperCase()]), node.exportFormat, tr("exportFormat"))
  );
  return header;
}

function renderResultCarousel(node, resultIds) {
  const nav = document.createElement("div");
  nav.className = "result-carousel";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "‹";
  previous.dataset.nodeId = node.id;
  previous.dataset.resultCarousel = "-1";
  const count = document.createElement("span");
  const activeIndex = Math.max(0, resultIds.indexOf(node.objectId));
  count.textContent = `${activeIndex + 1} / ${resultIds.length}`;
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "›";
  next.dataset.nodeId = node.id;
  next.dataset.resultCarousel = "1";
  nav.append(previous, count, next);
  return nav;
}

function stepResultCarousel(nodeId, delta) {
  const node = graph.nodes.find((item) => item.id === nodeId && item.type === "result");
  if (!node) return;
  const resultIds = [...new Set([...(node.objectIds || []), node.objectId].filter(Boolean))];
  if (resultIds.length < 2) return;
  const current = Math.max(0, resultIds.indexOf(node.objectId));
  const next = (current + delta + resultIds.length) % resultIds.length;
  node.activeResultIndex = next;
  node.objectId = resultIds[next];
  saveGraph();
  renderGraph();
}

async function startWorkflowDownload(nodeId, href, suggestedName) {
  if (activeDownloads.has(nodeId)) return;
  activeDownloads.add(nodeId);
  syncDownloadButton(nodeId, true);
  showToast(tr("downloading"));

  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error(tr("downloadFailed"));
    const blob = await response.blob();
    if (!blob.size) throw new Error(tr("downloadFailed"));
    await validateWorkflowDownloadBlob(blob, suggestedName);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = suggestedName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    showToast(tr("downloadStarted"));
  } catch (error) {
    showToast(error?.message || tr("downloadFailed"));
    throw error;
  } finally {
    activeDownloads.delete(nodeId);
    syncDownloadButton(nodeId, false);
  }
}

// 校验下载内容与目标扩展名匹配，避免把错误响应保存成目标文件
async function validateWorkflowDownloadBlob(blob, suggestedName) {
  const extension = String(suggestedName || "").match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  const magic = {
    png: [0x89, 0x50, 0x4e, 0x47],
    jpg: [0xff, 0xd8, 0xff],
    jpeg: [0xff, 0xd8, 0xff],
    gif: [0x47, 0x49, 0x46, 0x38],
    webp: [0x52, 0x49, 0x46, 0x46],
    pptx: [0x50, 0x4b, 0x03, 0x04]
  }[extension];
  if (!magic) return;
  const prefix = new Uint8Array(await blob.slice(0, magic.length).arrayBuffer());
  if (!magic.every((byte, index) => prefix[index] === byte)) {
    throw new Error(tr("downloadFailed"));
  }
}

function syncDownloadButton(nodeId, downloading) {
  const button = nodeLayer?.querySelector(`[data-workflow-download="${cssEscape(nodeId)}"]`);
  if (button) setDownloadButtonState(button, downloading);
}

function setDownloadButtonState(button, downloading) {
  button.classList.toggle("is-downloading", downloading);
  button.setAttribute("aria-busy", String(downloading));
  if (downloading) {
    button.setAttribute("aria-disabled", "true");
    button.title = tr("downloading");
    button.setAttribute("aria-label", tr("downloading"));
  } else if (button.hasAttribute("href")) {
    button.removeAttribute("aria-disabled");
    button.title = tr("download");
    button.setAttribute("aria-label", tr("download"));
  }
}

function renderResultActions(node, available) {
  const bar = document.createElement("div");
  bar.className = "result-edit-toolbar";
  if (node.editMode === "crop") {
    bar.append(
      resultActionButton(node, "crop-apply", tr("apply"), "primary"),
      resultActionButton(node, "cancel", tr("cancel"))
    );
    return bar;
  }
  if (node.editMode === "expand") {
    bar.append(
      resultActionButton(node, "expand-apply", tr("apply"), "primary"),
      resultActionButton(node, "cancel", tr("cancel"))
    );
    return bar;
  }
  const actions = [
    ["remove-bg", tr("removeBg")],
    ["crop", tr("crop")],
    ["expand", tr("expand")],
    ["edit-elements", tr("elements")]
  ];
  for (const [action, label] of actions) {
    const button = resultActionButton(node, action, label);
    button.disabled = !available || node.status === "running";
    bar.append(button);
  }
  return bar;
}

function renderResultGenerationDetails(node) {
  if (!node.generationPrompt) return null;
  const details = document.createElement("section");
  details.className = "result-generation-details result-generation-editor";
  const title = document.createElement("strong");
  title.textContent = tr("generationDetails");
  const prompt = document.createElement("textarea");
  prompt.dataset.resultGenerationPrompt = "";
  prompt.maxLength = 4000;
  prompt.value = node.generationPrompt;
  prompt.placeholder = tr("promptPlaceholder");
  const references = document.createElement("div");
  references.className = "result-generation-references";
  for (const [index, objectId] of node.generationReferenceObjectIds.entries()) {
    const object = canvasObject(objectId);
    if (!object?.src) continue;
    const item = document.createElement("span");
    const image = document.createElement("img");
    image.src = assetUrl(object.src, object);
    image.alt = object.name || tr("inputImages");
    const badge = document.createElement("b");
    badge.textContent = String(index + 1);
    item.append(image, badge);
    references.append(item);
  }
  const meta = document.createElement("div");
  const referenceCount = node.generationReferenceObjectIds.length;
  meta.textContent = `${node.generationRatio} · ${referenceCount} ${tr("referenceCount")}${node.generatedAt ? ` · ${new Date(node.generatedAt).toLocaleString()}` : ""}`;
  const detailActions = document.createElement("div");
  detailActions.className = "result-generation-detail-actions";
  detailActions.append(
    resultActionButton(node, "copy-prompt", tr("copyPrompt")),
    resultActionButton(node, "reuse-config", tr("generateAgain"), "primary")
  );
  details.append(title, prompt);
  if (references.childElementCount) details.append(references);
  details.append(meta, detailActions);
  return details;
}

function resultActionButton(node, action, label, variant = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.nodeId = node.id;
  button.dataset.resultAction = action;
  button.textContent = label;
  if (variant) button.classList.add(variant);
  return button;
}

function renderExpandPanel(node) {
  const panel = document.createElement("section");
  panel.className = "result-expand-panel";
  const prompt = document.createElement("textarea");
  prompt.dataset.expandPrompt = "";
  prompt.maxLength = 1200;
  prompt.placeholder = tr("expandPrompt");
  prompt.value = node.expandPrompt;
  panel.append(
    prompt,
    selectField(
      tr("expandRatio"),
      "expand-ratio",
      node.expandRatio,
      expandRatios.map((value) => [value, value === "original" ? tr("originalRatio") : value])
    ),
    selectField(
      tr("expandScale"),
      "expand-scale",
      node.expandScale,
      ["1", "1.25", "1.5", "2"].map((value) => [value, `${value}×`])
    ),
    selectField(
      tr("expandPreset"),
      "expand-preset",
      node.expandPreset,
      [
        ["general", tr("presetGeneral")],
        ["photo", tr("presetPhoto")],
        ["poster", tr("presetPoster")],
        ["product", tr("presetProduct")]
      ]
    )
  );
  return panel;
}

function renderCropOverlay(node) {
  const crop = normalizeCrop(node.crop);
  const overlay = document.createElement("div");
  overlay.className = "result-crop-overlay crop-overlay";
  const box = document.createElement("div");
  box.className = "result-crop-box crop-box";
  box.dataset.cropBox = "";
  box.style.left = `${crop.x * 100}%`;
  box.style.top = `${crop.y * 100}%`;
  box.style.width = `${crop.width * 100}%`;
  box.style.height = `${crop.height * 100}%`;
  for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
    const control = document.createElement("span");
    control.className = `result-crop-handle crop-handle crop-${handle}`;
    control.dataset.cropHandle = handle;
    box.append(control);
  }
  const actions = document.createElement("div");
  actions.className = "crop-actions";
  const cancel = resultActionButton(node, "cancel", tr("cancel"));
  cancel.classList.add("secondary-action");
  const apply = resultActionButton(node, "crop-apply", tr("apply"), "primary");
  actions.append(cancel, apply);
  box.append(actions);
  overlay.append(box);
  return overlay;
}

function renderLayerGroupNode(node) {
  const element = baseNodeElement(node, "layer-group-node");
  const objects = node.objectIds.map(canvasObject).filter(Boolean);
  const header = document.createElement("header");
  header.className = "result-node-header";
  const title = document.createElement("strong");
  title.textContent = tr("layerGroup");
  const status = document.createElement("span");
  status.className = `studio-status studio-status-${node.status}`;
  status.textContent = statusLabel(node.status);
  const remove = iconButton("close", tr("deleteNode"));
  remove.dataset.workflowDelete = node.id;
  header.append(title, status, remove);

  const list = document.createElement("div");
  list.className = "layer-group-list";
  if (!objects.length && node.status === "running") {
    const loading = document.createElement("div");
    loading.className = "layer-group-loading";
    loading.textContent = tr("running");
    list.append(loading);
  }
  for (const object of objects.sort((a, b) => (b.layerGroupIndex || 0) - (a.layerGroupIndex || 0))) {
    const row = document.createElement("div");
    row.className = "layer-group-row";
    if (object.src) {
      const image = document.createElement("img");
      image.src = assetUrl(object.src, object);
      image.alt = object.name || layerKindLabel(object.layerGroupKind);
      row.append(image);
    }
    const details = document.createElement("div");
    const kind = document.createElement("strong");
    kind.textContent = layerKindLabel(object.layerGroupKind);
    const name = document.createElement("span");
    name.textContent = object.name || object.id;
    details.append(kind, name);
    row.append(details);
    list.append(row);
  }
  const footer = document.createElement("p");
  footer.textContent = `${objects.length} ${tr("layerCount")}`;
  element.append(header, list, footer);
  element.append(portButton("input", "result", tr("output")));
  element.append(portButton("output", "image", tr("inputImages")));
  return element;
}

function baseNodeElement(node, className) {
  const size = nodeSize(node);
  const element = document.createElement("article");
  element.className = `${className}${node.status === "running" ? " is-running" : ""}`;
  element.dataset.workflowNodeId = node.id;
  element.dataset.workflowNodeType = node.type;
  element.style.left = `${node.x}px`;
  element.style.top = `${node.y}px`;
  element.style.width = `${size.width}px`;
  element.style.height = `${size.height}px`;
  return element;
}

function segmentedControl(node, option, options, selected, label) {
  const group = document.createElement("div");
  group.className = "result-segmented";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);
  for (const [value, text] of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.dataset.resultOption = option;
    button.dataset.nodeId = node.id;
    button.dataset.value = value;
    button.classList.toggle("active", value === selected);
    button.setAttribute("aria-pressed", value === selected ? "true" : "false");
    group.append(button);
  }
  return group;
}

function renderReference(node, objectId) {
  const object = canvasObject(objectId);
  const item = document.createElement("div");
  item.className = "studio-reference";
  if (object?.src) {
    const image = document.createElement("img");
    image.src = assetUrl(object.src, object);
    image.alt = object.name || tr("inputImages");
    item.append(image);
  } else {
    item.classList.add("missing");
  }
  const directBindings = directReferenceBindings(node);
  const direct = directBindings.some((binding) => binding.objectId === objectId);
  item.draggable = true;
  item.dataset.nodeId = node.id;
  item.dataset.referenceObjectId = objectId;
  const badge = document.createElement("span");
  badge.textContent = direct
    ? String(referenceIdsForStudio(node).indexOf(objectId) + 1)
    : tr("connected");
  item.append(badge);
  const remove = iconButton("close", tr("removeReference"));
  remove.dataset.nodeId = node.id;
  remove.dataset.referenceRemove = objectId;
  item.append(remove);
  return item;
}

function selectField(labelText, dataName, value, options) {
  const label = document.createElement("label");
  const text = document.createElement("span");
  text.textContent = labelText;
  const select = document.createElement("select");
  select.setAttribute(`data-${dataName}`, "");
  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = optionValue === value;
    select.append(option);
  }
  label.append(text, select);
  return label;
}

function portButton(direction, port, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `workflow-port workflow-port-${direction} workflow-port-${port}`;
  button.dataset[`workflow${capitalize(direction)}`] = port;
  button.dataset.workflowPortType = workflowDataTypes.image;
  button.title = label;
  button.setAttribute("aria-label", label);
  const tooltip = document.createElement("span");
  tooltip.textContent = label;
  button.append(tooltip);
  return button;
}

function updateConnectionTargets(clientX, clientY) {
  if (!connectionDraft) return;
  const source = graph.nodes.find((node) => node.id === connectionDraft.fromNode);
  const output = workflowPortDefinition(source, "output", connectionDraft.fromPort);
  let nearest = null;
  let nearestDistance = 30;
  for (const input of nodeLayer.querySelectorAll("[data-workflow-input]")) {
    const element = input.closest("[data-workflow-node-id]");
    const targetNode = graph.nodes.find((node) => node.id === element?.dataset.workflowNodeId);
    const targetPort = workflowPortDefinition(targetNode, "input", input.dataset.workflowInput);
    const sourceObjectId = objectIdForWorkflowNode(source);
    const compatible = source?.id !== targetNode?.id
      && portsAreCompatible(output, targetPort)
      && !wouldCreateWorkflowCycle(source.id, targetNode.id)
      && referenceIdsForStudio(targetNode).length < (targetPort?.maxConnections || Infinity)
      && (!sourceObjectId || !referenceIdsForStudio(targetNode).includes(sourceObjectId));
    input.classList.toggle("connection-compatible", compatible);
    input.classList.toggle("connection-incompatible", !compatible);
    input.classList.remove("connection-target");
    if (!compatible) continue;
    const rect = input.getBoundingClientRect();
    const distance = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
    if (distance < nearestDistance) {
      nearest = input;
      nearestDistance = distance;
    }
  }
  connectionDraft.target = nearest;
  if (nearest) {
    nearest.classList.add("connection-target");
    const element = nearest.closest("[data-workflow-node-id]");
    const targetNode = graph.nodes.find((node) => node.id === element?.dataset.workflowNodeId);
    connectionDraft.pointer = portPosition(targetNode, nearest.dataset.workflowInput, "input");
  } else {
    connectionDraft.pointer = clientToWorld(clientX, clientY);
  }
}

function clearConnectionTargetClasses() {
  nodeLayer?.querySelectorAll(".connection-compatible, .connection-incompatible, .connection-target").forEach((port) => {
    port.classList.remove("connection-compatible", "connection-incompatible", "connection-target");
  });
}

function renderEdges() {
  if (!edgeLayer || layer.hidden) return;
  edgeLayer.replaceChildren();
  for (const edge of graph.edges) {
    const from = graph.nodes.find((node) => node.id === edge.fromNode);
    const to = graph.nodes.find((node) => node.id === edge.toNode);
    if (!from || !to) continue;
    // Skip edges connected to result nodes that are truly dangling.
    // We draw edges for completed results (materialized to canvas) when:
    //   - the result has a valid objectId AND the canvas object still exists
    //     (edge connects to the canvas image position)
    // We skip edges when:
    //   - the result has no objectId (never materialized, truly dangling)
    //   - the result has an objectId but the canvas object was deleted
    if (from.type === "result" && !shouldRenderResultNode(from)) {
      if (!from.objectId) continue;
      if (!canvasObject(from.objectId)) continue;
    }
    if (to.type === "result" && !shouldRenderResultNode(to)) {
      if (!to.objectId) continue;
      if (!canvasObject(to.objectId)) continue;
    }
    edgeLayer.append(edgePath(
      portPosition(from, edge.fromPort, "output"),
      portPosition(to, edge.toPort, "input"),
      edge.id,
      edge.type
    ));
  }
  if (connectionDraft) {
    const from = graph.nodes.find((node) => node.id === connectionDraft.fromNode);
    if (from) {
      const preview = edgePath(
        portPosition(from, connectionDraft.fromPort, "output"),
        connectionDraft.pointer,
        null,
        connectionDraft.type
      );
      preview.classList.add("preview");
      edgeLayer.append(preview);
    }
  }
}

function edgePath(from, to, id, type = workflowDataTypes.image) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const bend = Math.max(80, Math.abs(to.x - from.x) * 0.45);
  path.setAttribute("d", `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`);
  path.setAttribute("fill", "none");
  path.classList.add("workflow-edge", "studio-edge");
  path.dataset.workflowEdgeType = type;
  if (id) path.dataset.workflowEdgeId = id;
  return path;
}

function portPosition(node, _port, direction) {
  // For result nodes materialized to canvas (has objectId but not rendered in workflow),
  // use the canvas object's actual position and dimensions so the edge connects to the real image bounds.
  if (node.type === "result" && node.objectId && !shouldRenderResultNode(node)) {
    const object = canvasObject(node.objectId);
    if (object) {
      if (direction === "input") {
        return { x: object.x, y: object.y + object.height / 2 };
      }
      return { x: object.x + object.width, y: object.y + object.height / 2 };
    }
  }
  const size = nodeSize(node);
  if (node.type === "studio") {
    return direction === "input"
      ? { x: node.x, y: node.y + studioInputPortOffset(node) }
      : { x: node.x + size.width, y: node.y + size.height - 54 };
  }
  return direction === "input"
    ? { x: node.x, y: node.y + size.height / 2 }
    : { x: node.x + size.width, y: node.y + size.height / 2 };
}

async function uploadFiles(nodeId, files) {
  const node = graph.nodes.find((item) => item.id === nodeId && item.type === "studio");
  if (!node) return;
  node.generationMode = "image";
  const remaining = Math.max(0, 6 - referenceIdsForStudio(node).length);
  const candidates = files.filter(isImageFile).slice(0, remaining);
  if (!candidates.length) {
    showToast(tr("maxReferences"));
    return;
  }
  node.status = "running";
  node.error = "";
  saveGraph();
  renderGraph();
  try {
    for (const file of candidates) {
      const dataUrl = await readFile(file);
      const size = await imageSize(dataUrl);
      const display = displaySize(size, 320);
      const response = await fetch(apiPath("/api/images"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          name: file.name || `reference-${Date.now()}.png`,
          prompt: "Workflow reference image",
          layoutMode: "workflow-reference",
          x: node.x + 32,
          y: node.y + 86,
          width: display.width,
          height: display.height,
          allowDuplicate: true,
          hidden: true,
          workflowInput: true
        })
      });
      const object = await response.json();
      if (!response.ok) throw new Error(object.error || tr("uploadFailed"));
      node.referenceBindings.push({
        id: createId("reference"),
        objectId: object.id,
        source: "upload",
        order: node.referenceBindings.length
      });
      node.referenceBindings = normalizeReferenceBindings(node);
      node.referenceObjectIds = node.referenceBindings.map((binding) => binding.objectId);
    }
    node.status = "idle";
    await refreshCanvasState();
    saveGraph();
    renderGraph();
  } catch (error) {
    node.status = "error";
    node.error = error?.message || tr("uploadFailed");
    saveGraph();
    renderGraph();
    showToast(node.error);
  }
}

async function runStudio(nodeId) {
  const node = graph.nodes.find((item) => item.id === nodeId && item.type === "studio");
  if (!node || node.status === "running") return;
  const prompt = String(node.prompt || "").trim();
  if (!prompt) {
    showToast(tr("addPrompt"));
    nodeElement(node.id)?.querySelector("[data-studio-prompt]")?.focus({ preventScroll: true });
    return;
  }
  const objectIds = referenceIdsForStudio(node).slice(0, 6);
  node.status = "running";
  node.error = "";
  node.jobIds = [];
  node.batchId = createId("batch");
  saveGraph();
  renderGraph();

  const tasks = [];
  try {
    for (let index = 0; index < node.count; index += 1) {
      const response = await fetch(apiPath("/api/workflow/jobs"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: generationPrompt(node, index),
          objectIds,
          x: node.x + nodeSizes.studio.width + 150 + index * 34,
          y: node.y + index * 34
        })
      });
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || tr("startFailed"));
      node.jobIds.push(job.id);
      saveGraph();
      if (job.placeholderId) hideCanvasObject(job.placeholderId);
      tasks.push(pollJob(node.id, job.id, index));
    }
    const results = await Promise.allSettled(tasks);
    const activeNode = graph.nodes.find((item) => item.id === node.id);
    if (!activeNode) return;
    const failures = results.filter((result) => result.status === "rejected");
    const allCancelled = failures.length > 0
      && failures.length === results.length
      && failures.every((result) => result.reason?.message === tr("cancelled"));
    activeNode.status = allCancelled ? "cancelled" : failures.length ? "error" : "done";
    activeNode.error = failures[0]?.reason?.message || "";
    activeNode.jobIds = [];
    saveGraph();
    await refreshCanvasState();
    collapseCompletedStudio(activeNode.id);
    showToast(failures.length ? activeNode.error || tr("jobFailed") : tr("jobDone"));
  } catch (error) {
    node.status = "error";
    node.error = error?.message || tr("startFailed");
    node.jobIds = [];
    saveGraph();
    renderGraph();
    showToast(node.error);
  }
}

function collapseCompletedStudio(studioId) {
  const studio = graph.nodes.find((node) => node.id === studioId && node.type === "studio");
  if (!studio || studio.status !== "done") {
    renderGraph();
    return;
  }
  const incoming = graph.edges.filter((edge) => edge.toNode === studioId && edge.toPort === "images");
  const outgoing = graph.edges.filter((edge) => edge.fromNode === studioId && edge.fromPort === "result");
  const bridged = [];
  for (const source of incoming) {
    for (const target of outgoing) {
      bridged.push({
        id: createId("edge"),
        fromNode: source.fromNode,
        fromPort: source.fromPort || "image",
        toNode: target.toNode,
        toPort: "result",
        type: workflowDataTypes.image,
        order: target.order || 0
      });
    }
  }
  graph.nodes = graph.nodes.filter((node) => node.id !== studioId);
  graph.edges = [
    ...graph.edges.filter((edge) => edge.fromNode !== studioId && edge.toNode !== studioId),
    ...bridged
  ];
  saveGraph();
  renderGraph();
}

function generationPrompt(node, index) {
  return [
    node.prompt.trim(),
    "",
    `Required output aspect ratio: ${node.ratio}.`,
    node.count > 1 ? `This is variation ${index + 1} of ${node.count}; keep the core brief but create a meaningfully distinct composition.` : ""
  ].filter(Boolean).join("\n");
}

async function pollJob(studioId, jobId, index = 0) {
  if (pollingJobs.has(jobId)) return pollingJobs.get(jobId);
  const promise = (async () => {
    while (true) {
      const response = await fetch(apiPath(`/api/jobs/${encodeURIComponent(jobId)}`));
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || tr("jobFailed"));
      if (job.status === "done") {
        const result = Array.isArray(job.imported) ? job.imported[0] : null;
        if (!result?.id) throw new Error(tr("jobFailed"));
        // Completed results are rendered by the regular canvas object layer.
        // Keep the asset visible there; hiding it was legacy workflow-node
        // behavior and made a successfully generated image disappear.
        await revealCanvasObjects([result.id]);
        await refreshCanvasState();
        addResultNode(studioId, result.id, jobId, index);
        return result.id;
      }
      if (job.status === "failed") throw new Error(job.error || tr("jobFailed"));
      if (job.status === "cancelled") throw new Error(tr("cancelled"));
      await wait(1000);
    }
  })().finally(() => pollingJobs.delete(jobId));
  pollingJobs.set(jobId, promise);
  return promise;
}

function addResultNode(studioId, objectId, jobId, index) {
  graph = loadGraph();
  if (graph.nodes.some((node) => node.type === "result" && (node.jobId === jobId || node.objectId === objectId))) return;
  const studio = graph.nodes.find((node) => node.id === studioId);
  if (!studio) return;
  const batchResult = graph.nodes.find((node) => (
    node.type === "result" && node.batchId && node.batchId === studio.batchId && !node.derivedAction
  ));
  if (batchResult) {
    batchResult.objectIds = [...new Set([...(batchResult.objectIds || []), batchResult.objectId, objectId].filter(Boolean))];
    batchResult.jobIds = [...new Set([...(batchResult.jobIds || []), jobId])].slice(0, 4);
    batchResult.status = "done";
    if (studio.jobIds.length > 0 && studio.jobIds.every((id) => batchResult.jobIds.includes(id))) {
      studio.status = "done";
      studio.error = "";
      studio.jobIds = [];
    }
    saveGraph();
    renderGraph();
    return;
  }
  const siblingResults = graph.edges
    .filter((edge) => edge.fromNode === studio.id && edge.fromPort === "result")
    .map((edge) => graph.nodes.find((node) => node.id === edge.toNode))
    .filter((node) => node?.type === "result");
  const yOffset = siblingResults.reduce((total, node) => total + nodeSize(node).height + 32, 0);
  const result = normalizeNode({
    id: createId("result"),
    type: "result",
    objectId,
    objectIds: [objectId],
    activeResultIndex: 0,
    jobId,
    jobIds: [jobId],
    generationPrompt: studio.prompt,
    generationRatio: studio.ratio,
    generationReferenceObjectIds: referenceIdsForStudio(studio),
    batchId: studio.batchId,
    batchIndex: index,
    generatedAt: new Date().toISOString(),
    x: studio.x + nodeSizes.studio.width + 150,
    y: studio.y + yOffset,
    status: "done"
  });
  graph.nodes.push(result);
  graph.edges.push({
    id: createId("edge"),
    fromNode: studio.id,
    fromPort: "result",
    toNode: result.id,
    toPort: "result",
    type: workflowDataTypes.image,
    order: index
  });
  const completedJobIds = new Set(
    graph.nodes
      .filter((node) => node.type === "result")
      .flatMap((node) => [...(node.jobIds || []), node.jobId].filter(Boolean))
  );
  if (studio.jobIds.length > 0 && studio.jobIds.every((id) => completedJobIds.has(id))) {
    studio.status = "done";
    studio.error = "";
    studio.jobIds = [];
  }
  saveGraph();
  renderGraph();
  
  // Update canvas object with source="generated" and export settings
  markCanvasObjectAsGenerated(objectId);
}

async function markCanvasObjectAsGenerated(objectId) {
  if (!objectId) return;
  try {
    await refreshCanvasState();
    const object = canvasObject(objectId);
    if (!object) return;
    
    // Update canvas object properties
    object.source = "generated";
    object.exportResolution = object.exportResolution || "1k";
    object.exportFormat = object.exportFormat || "png";
    
    // Persist to server via PATCH
    await fetch(apiPath(`/api/objects/${encodeURIComponent(objectId)}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "generated",
        exportResolution: object.exportResolution,
        exportFormat: object.exportFormat
      })
    }).catch(() => {});
    
    // Trigger state refresh in app.js
    window.dispatchEvent(new CustomEvent("codex-canvas:object-updated", {
      detail: { objectId, source: "generated" }
    }));
  } catch {}
}

function resumeJobs() {
  // Older workflow sessions may contain completed results that were hidden
  // while the workflow UI rendered its own result card. Result cards are now
  // materialized as ordinary canvas objects, so reconcile them on load.
  const completedResultIds = graph.nodes
    .filter((node) => node.type === "result" && node.status === "done" && node.objectId && !node.editMode)
    .map((node) => node.objectId);
  if (completedResultIds.length) {
    revealCanvasObjects(completedResultIds)
      .then(() => refreshCanvasState())
      .catch(() => {});
  }
  for (const node of graph.nodes) {
    if (node.type === "studio" && node.status === "running" && node.jobIds.length) {
      Promise.allSettled(node.jobIds.map((jobId, index) => pollJob(node.id, jobId, index))).then((results) => {
        const current = graph.nodes.find((item) => item.id === node.id);
        if (!current) return;
        const failure = results.find((result) => result.status === "rejected");
        current.status = failure ? "error" : "done";
        current.error = failure?.reason?.message || "";
        current.jobIds = [];
        saveGraph();
        if (current.status === "done") collapseCompletedStudio(current.id);
        else renderGraph();
      });
    }
    if (["result", "layerGroup"].includes(node.type) && node.status === "running" && node.jobId) {
      pollDerivedJob(node.id, node.jobId).catch(() => {});
    }
  }
}

function referenceIdsForStudio(node) {
  const incoming = graph.edges
    .filter((edge) => edge.toNode === node.id && edge.toPort === "images")
    .sort((left, right) => left.order - right.order)
    .map((edge) => ({ edge, source: graph.nodes.find((item) => item.id === edge.fromNode) }))
    .filter((item) => ["result", "layerGroup"].includes(item.source?.type))
    .map((item) => objectIdForWorkflowNode(item.source))
    .filter(Boolean);
  const direct = directReferenceBindings(node)
    .sort((left, right) => left.order - right.order)
    .map((binding) => binding.objectId);
  const ids = [...new Set([...direct, ...incoming])].slice(0, 6);
  const order = node.referenceOrderObjectIds || [];
  return ids.sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    if (leftIndex < 0 && rightIndex < 0) return 0;
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    return leftIndex - rightIndex;
  });
}

function directReferenceBindings(node) {
  if (Array.isArray(node.referenceBindings)) return node.referenceBindings;
  return normalizeReferenceBindings(node);
}

function modeLabel(node) {
  const count = referenceIdsForStudio(node).length;
  if (count > 1) return tr("fusionMode");
  if (count === 1 || node.generationMode === "image") return tr("imageMode");
  return tr("textMode");
}

function statusLabel(status) {
  if (status === "running") return tr("running");
  if (status === "done") return tr("done");
  if (status === "error") return tr("error");
  if (status === "cancelled") return tr("cancelled");
  return tr("ready");
}

async function refreshCanvasState() {
  try {
    const response = await fetch(apiPath("/api/state"));
    if (!response.ok) return;
    canvasState = await response.json();
    // Re-render edges to reflect any canvas object position changes
    renderEdges();
  } catch {}
}

async function hideCanvasObject(objectId) {
  if (!objectId) return;
  try {
    await fetch(apiPath("/api/objects"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        updates: [{ id: objectId, patch: { hidden: true } }]
      })
    });
  } catch {}
}

async function revealCanvasObjects(objectIds) {
  const ids = [...new Set((objectIds || []).filter(Boolean))];
  if (!ids.length) return;
  const response = await fetch(apiPath("/api/objects"), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      updates: ids.map((id) => ({ id, patch: { hidden: false } }))
    })
  });
  if (!response.ok) throw new Error(tr("jobFailed"));
}

async function materializeCompletedLayerGroups() {
  const completed = graph.nodes.filter((node) => node.type === "layerGroup" && node.status === "done" && node.objectIds.length);
  if (!completed.length) return;
  for (const node of completed) {
    await revealCanvasObjects(node.objectIds);
    removeLayerGroupGraphNode(node.id);
  }
  await refreshCanvasState();
  const latest = completed.at(-1);
  window.dispatchEvent(new CustomEvent("codex-canvas:layers-materialized", {
    detail: { ids: [...latest.objectIds], groupId: latest.layerGroupId || null }
  }));
}

function removeLayerGroupGraphNode(nodeId) {
  const node = graph.nodes.find((item) => item.id === nodeId && item.type === "layerGroup");
  if (!node) return;
  const sourceId = node.sourceNodeId;
  const nextEdges = [];
  for (const edge of graph.edges) {
    if (edge.toNode === nodeId) continue;
    if (edge.fromNode === nodeId) {
      if (sourceId) {
        nextEdges.push({ ...edge, fromNode: sourceId, fromPort: "image" });
      }
      continue;
    }
    nextEdges.push(edge);
  }
  graph.nodes = graph.nodes.filter((item) => item.id !== nodeId);
  graph.edges = nextEdges.filter((edge, index, edges) => (
    edges.findIndex((item) => item.fromNode === edge.fromNode
      && item.fromPort === edge.fromPort
      && item.toNode === edge.toNode
      && item.toPort === edge.toPort) === index
  ));
}

function canvasObject(id) {
  return canvasState.objects.find((object) => object.id === id);
}

function nodeSize(node) {
  if (node.type === "result") return resultGeometry(node);
  if (node.type === "layerGroup") return layerGroupGeometry(node);
  return {
    width: nodeSizes.studio.width,
    height: node.generationMode === "image" || referenceIdsForStudio(node).length > 0
      ? nodeSizes.studio.height + Math.max(0, studioReferenceRows(node) - 1) * 165
      : 360
  };
}

function studioReferenceRows(node) {
  return Math.max(1, Math.ceil(referenceIdsForStudio(node).length / 3));
}

function studioInputPortOffset(node) {
  return 360 + Math.max(0, studioReferenceRows(node) - 1) * 82.5;
}

function resultGeometry(node) {
  const object = canvasObject(node.objectId);
  const size = naturalImageSize(object);
  const aspect = size.width / size.height;
  const width = aspect < 0.8 ? 360 : aspect > 1.3 ? 520 : 440;
  const previewWidth = width - 8;
  const previewHeight = Math.max(180, Math.round(previewWidth / aspect));
  return {
    width,
    height: 4 + previewHeight,
    previewHeight
  };
}

function layerGroupGeometry(node) {
  const count = Math.max(1, node.objectIds?.length || 0);
  return {
    width: 360,
    height: 48 + Math.min(6, count) * 62 + 44
  };
}

function naturalImageSize(object) {
  const width = positiveDimension(object?.naturalWidth) || positiveDimension(object?.width) || 1024;
  const height = positiveDimension(object?.naturalHeight) || positiveDimension(object?.height) || 1024;
  return { width, height };
}

function exportImageSize(object, resolution) {
  const natural = naturalImageSize(object);
  const longest = resolution === "4k" ? 4096 : resolution === "2k" ? 2048 : 1024;
  const scale = longest / Math.max(natural.width, natural.height);
  return {
    width: Math.max(1, Math.round(natural.width * scale)),
    height: Math.max(1, Math.round(natural.height * scale))
  };
}

function positiveDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function updateResultOption(nodeId, option, value) {
  const node = graph.nodes.find((item) => item.id === nodeId && item.type === "result");
  if (!node) return;
  if (option === "resolution" && exportResolutions.includes(value)) node.exportResolution = value;
  if (option === "format" && exportFormats.includes(value)) node.exportFormat = value;
  saveGraph();
  if (selectedResultNodeId === node.id) {
    window.dispatchEvent(new CustomEvent("codex-canvas:workflow-export-options", {
      detail: {
        objectId: node.objectId,
        exportResolution: node.exportResolution,
        exportFormat: node.exportFormat
      }
    }));
  }
  renderGraph();
}

function handleResultAction(nodeId, action) {
  const node = graph.nodes.find((item) => item.id === nodeId && item.type === "result");
  if (!node) return;
  if (action === "cancel") {
    node.editMode = null;
    saveGraph();
    renderGraph();
    notifyWorkflowEditMode(node, false);
    return;
  }
  if (action === "continue-generate") {
    createStudioFromReferences([node.objectId], {
      prompt: node.generationPrompt,
      ratio: node.generationRatio
    });
    return;
  }
  if (action === "reuse-config") {
    createStudioFromReferences(node.generationReferenceObjectIds.length
      ? node.generationReferenceObjectIds
      : [node.objectId], {
      prompt: node.generationPrompt,
      ratio: node.generationRatio
    });
    return;
  }
  if (action === "copy-prompt") {
    navigator.clipboard?.writeText(node.generationPrompt || "").then(
      () => showToast(tr("promptCopied")),
      () => showToast(tr("copyPrompt"))
    );
    return;
  }
  if (action === "crop") {
    materializeResultForCanvasAction(node, action)
      .catch((error) => showToast(error?.message || tr("cropFailed")));
    return;
  }
  if (action === "expand") {
    node.editMode = "expand";
    saveGraph();
    renderGraph();
    notifyWorkflowEditMode(node, true);
    return;
  }
  if (action === "crop-apply") {
    applyResultCrop(node.id).catch((error) => showToast(error?.message || tr("cropFailed")));
    return;
  }
  if (action === "expand-apply") {
    startDerivedJob(node.id, "expand", {
      prompt: node.expandPrompt,
      expand: {
        ratio: node.expandRatio,
        scale: node.expandScale,
        preset: node.expandPreset
      }
    }).catch((error) => showToast(error?.message || tr("jobFailed")));
    return;
  }
  if (action === "edit-elements") {
    materializeResultForCanvasAction(node, action)
      .catch((error) => showToast(error?.message || tr("jobFailed")));
    return;
  }
  if (action === "remove-bg") {
    startDerivedJob(node.id, action).catch((error) => showToast(error?.message || tr("jobFailed")));
  }
}

function notifyWorkflowEditMode(node, active) {
  window.dispatchEvent(new CustomEvent("codex-canvas:workflow-edit-mode", {
    detail: { objectId: node?.objectId || null, mode: node?.editMode || "idle", active: Boolean(active) }
  }));
}

async function startDerivedJob(sourceNodeId, action, options = {}) {
  const source = graph.nodes.find((item) => item.id === sourceNodeId && item.type === "result");
  if (!source?.objectId) throw new Error(tr("imageUnavailable"));
  const response = await fetch(apiPath("/api/jobs"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action,
      objectId: source.objectId,
      prompt: options.prompt || "",
      ...(options.expand ? { expand: options.expand } : {})
    })
  });
  const job = await response.json();
  if (!response.ok) throw new Error(job.error || tr("jobFailed"));
  if (job.placeholderId) await hideCanvasObject(job.placeholderId);

  const type = action === "edit-elements" ? "layerGroup" : "result";
  const placement = derivedPlacement(source);
  const pending = normalizeNode({
    id: createId(type === "layerGroup" ? "layers" : "result"),
    type,
    sourceNodeId: source.id,
    generationPrompt: source.generationPrompt,
    generationRatio: source.generationRatio,
    generationReferenceObjectIds: source.generationReferenceObjectIds,
    batchId: source.batchId,
    batchIndex: source.batchIndex,
    generatedAt: source.generatedAt,
    derivedAction: action,
    jobId: job.id,
    compositeObjectId: action === "edit-elements" ? source.objectId : null,
    x: placement.x,
    y: placement.y,
    status: "running"
  });
  source.editMode = null;
  graph.nodes.push(pending);
  graph.edges.push({
    id: createId("edge"),
    fromNode: source.id,
    fromPort: "image",
    toNode: pending.id,
    toPort: "result",
    type: workflowDataTypes.image,
    order: 0
  });
  saveGraph();
  renderGraph();
  showToast(tr("operationStarted"));
  return pollDerivedJob(pending.id, job.id);
}

async function pollDerivedJob(nodeId, jobId) {
  if (derivedPollingJobs.has(jobId)) return derivedPollingJobs.get(jobId);
  const promise = (async () => {
    while (true) {
      const response = await fetch(apiPath(`/api/jobs/${encodeURIComponent(jobId)}`));
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || tr("jobFailed"));
      if (job.status === "done") {
        const imported = Array.isArray(job.imported) ? job.imported.filter((item) => item?.id) : [];
        if (!imported.length) throw new Error(tr("jobFailed"));
        const isLayerGroup = graph.nodes.find((item) => item.id === nodeId)?.type === "layerGroup";
        if (isLayerGroup) {
          await revealCanvasObjects(imported.map((item) => item.id));
        } else {
          await Promise.allSettled(imported.map((item) => hideCanvasObject(item.id)));
        }
        await refreshCanvasState();
        graph = loadGraph();
        const node = graph.nodes.find((item) => item.id === nodeId);
        if (!node) return imported;
        node.status = "done";
        node.error = "";
        if (node.type === "layerGroup") {
          node.objectIds = imported.map((item) => item.id);
          node.layerGroupId = imported.find((item) => item.layerGroupId)?.layerGroupId || null;
          const ids = [...node.objectIds];
          const groupId = node.layerGroupId;
          removeLayerGroupGraphNode(node.id);
          saveGraph();
          renderGraph();
          window.dispatchEvent(new CustomEvent("codex-canvas:layers-materialized", {
            detail: { ids, groupId }
          }));
        } else {
          node.objectId = imported[0].id;
          saveGraph();
          renderGraph();
        }
        showToast(tr("operationDone"));
        return imported;
      }
      if (job.status === "failed") throw new Error(job.error || tr("jobFailed"));
      if (job.status === "cancelled") {
        graph = loadGraph();
        const node = graph.nodes.find((item) => item.id === nodeId);
        if (node) {
          node.status = "cancelled";
          node.error = "";
          saveGraph();
          renderGraph();
        }
        return [];
      }
      await wait(1000);
    }
  })().catch((error) => {
    graph = loadGraph();
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (node) {
      node.status = "error";
      node.error = error?.message || tr("jobFailed");
      saveGraph();
      renderGraph();
    }
    throw error;
  }).finally(() => derivedPollingJobs.delete(jobId));
  derivedPollingJobs.set(jobId, promise);
  return promise;
}

async function applyResultCrop(nodeId) {
  const source = graph.nodes.find((item) => item.id === nodeId && item.type === "result");
  const object = canvasObject(source?.objectId);
  if (!source || !object?.src) throw new Error(tr("cropFailed"));
  const crop = normalizeCrop(source.crop);
  const image = await loadImage(assetUrl(object.src, object));
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sx = Math.round(crop.x * sourceWidth);
  const sy = Math.round(crop.y * sourceHeight);
  const sw = Math.max(1, Math.round(crop.width * sourceWidth));
  const sh = Math.max(1, Math.round(crop.height * sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(tr("cropFailed"));
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  const dataUrl = canvas.toDataURL("image/png");
  const response = await fetch(apiPath("/api/images"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      dataUrl,
      name: `${safeFileBase(object.name || "image")}-crop.png`,
      prompt: `Cropped from ${object.name || object.id}`,
      layoutMode: "workflow-derived",
      sourceObjectId: object.id,
      x: object.x,
      y: object.y,
      width: Math.max(1, Math.round((object.width || sw) * crop.width)),
      height: Math.max(1, Math.round((object.height || sh) * crop.height)),
      hidden: true
    })
  });
  const cropped = await response.json();
  if (!response.ok) throw new Error(cropped.error || tr("cropFailed"));
  source.editMode = null;
  await refreshCanvasState();
  addCompletedDerivedResult(source, cropped.id, "crop");
  notifyWorkflowEditMode(source, false);
  showToast(tr("operationDone"));
}

function addCompletedDerivedResult(source, objectId, action) {
  const placement = derivedPlacement(source);
  const result = normalizeNode({
    id: createId("result"),
    type: "result",
    sourceNodeId: source.id,
    generationPrompt: source.generationPrompt,
    generationRatio: source.generationRatio,
    generationReferenceObjectIds: source.generationReferenceObjectIds,
    batchId: source.batchId,
    batchIndex: source.batchIndex,
    generatedAt: source.generatedAt,
    derivedAction: action,
    objectId,
    x: placement.x,
    y: placement.y,
    status: "done"
  });
  graph.nodes.push(result);
  graph.edges.push({
    id: createId("edge"),
    fromNode: source.id,
    fromPort: "image",
    toNode: result.id,
    toPort: "result",
    type: workflowDataTypes.image,
    order: 0
  });
  saveGraph();
  renderGraph();
}

function derivedPlacement(source) {
  const children = graph.edges
    .filter((edge) => edge.fromNode === source.id)
    .map((edge) => graph.nodes.find((item) => item.id === edge.toNode))
    .filter((item) => item && item.type !== "studio");
  const sourceRight = source.x + nodeSize(source).width + 110;
  const x = children.length
    ? Math.max(sourceRight, ...children.map((child) => child.x + nodeSize(child).width + 32))
    : sourceRight;
  return { x, y: source.y };
}

function normalizeCrop(crop) {
  const fallback = { x: 0.08, y: 0.08, width: 0.84, height: 0.84 };
  if (!crop || typeof crop !== "object") return fallback;
  const x = clampUnit(crop.x, fallback.x);
  const y = clampUnit(crop.y, fallback.y);
  const width = Math.min(1 - x, Math.max(0.05, Number(crop.width) || fallback.width));
  const height = Math.min(1 - y, Math.max(0.05, Number(crop.height) || fallback.height));
  return { x, y, width, height };
}

function updateCropFromPointer(event) {
  const state = cropDragState;
  const node = graph.nodes.find((item) => item.id === state?.nodeId && item.type === "result");
  if (!state || !node) return;
  const dx = (event.clientX - state.startX) / Math.max(1, state.rect.width);
  const dy = (event.clientY - state.startY) / Math.max(1, state.rect.height);
  const start = state.crop;
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (state.mode === "move") {
    left = clampRange(start.x + dx, 0, 1 - start.width);
    top = clampRange(start.y + dy, 0, 1 - start.height);
    right = left + start.width;
    bottom = top + start.height;
  } else {
    if (state.mode.includes("w")) left = clampRange(start.x + dx, 0, right - 0.05);
    if (state.mode.includes("e")) right = clampRange(right + dx, left + 0.05, 1);
    if (state.mode.includes("n")) top = clampRange(start.y + dy, 0, bottom - 0.05);
    if (state.mode.includes("s")) bottom = clampRange(bottom + dy, top + 0.05, 1);
  }
  node.crop = { x: left, y: top, width: right - left, height: bottom - top };
  const box = nodeElement(node.id)?.querySelector(".result-crop-box");
  if (box) {
    box.style.left = `${left * 100}%`;
    box.style.top = `${top * 100}%`;
    box.style.width = `${(right - left) * 100}%`;
    box.style.height = `${(bottom - top) * 100}%`;
  }
}

function clampUnit(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? clampRange(number, 0, 1) : fallback;
}

function clampRange(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(tr("imageUnavailable")));
    image.src = src;
  });
}

function actionLabel(action) {
  if (action === "remove-bg") return tr("removeBg");
  if (action === "crop") return tr("crop");
  if (action === "expand") return tr("expand");
  if (action === "edit-elements") return tr("elements");
  return "";
}

function layerKindLabel(kind) {
  if (kind === "background") return tr("backgroundLayer");
  if (kind === "text") return tr("textLayer");
  return tr("objectLayer");
}

function safeFileBase(name) {
  return String(name).replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80) || "generated-image";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function viewportCenterInWorld() {
  const rect = board.getBoundingClientRect();
  return clientToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function clientToWorld(clientX, clientY) {
  const rect = board.getBoundingClientRect();
  const transform = new DOMMatrixReadOnly(getComputedStyle(world).transform);
  const inverse = transform.inverse();
  const point = new DOMPoint(clientX - rect.left, clientY - rect.top).matrixTransform(inverse);
  return { x: point.x, y: point.y };
}

function localizeToolbar() {
  if (!openButton) return;
  openButton.title = tr("tool");
  openButton.dataset.tooltip = tr("tool");
  openButton.setAttribute("aria-label", tr("tool"));
}

function locale() {
  return document.documentElement.lang?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function tr(key) {
  return copy[locale()]?.[key] || copy.en[key] || key;
}

function nodeElement(id) {
  return nodeLayer?.querySelector(`[data-workflow-node-id="${cssEscape(id)}"]`);
}

function clampCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(4, Math.max(1, Math.round(number))) : 1;
}

function createId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isImageFile(file) {
  return String(file?.type || "").startsWith("image/")
    || /\.(png|jpe?g|webp|gif|avif)$/i.test(file?.name || "");
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error(tr("uploadFailed")));
    reader.readAsDataURL(file);
  });
}

function imageSize(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => resolve(null), 2000);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(null);
    };
    image.src = dataUrl;
  });
}

function displaySize(size, max) {
  if (!size?.width || !size?.height) return { width: max, height: max };
  const scale = Math.min(1, max / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale))
  };
}

function iconButton(icon, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "workflow-icon-button";
  button.title = label;
  button.setAttribute("aria-label", label);
  if (icon === "close") {
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';
  }
  return button;
}

function closeIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';
}

function downloadIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>';
}

function uploadIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"></path></svg>';
}

function imageIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-5-5L5 21"></path></svg>';
}

function sparkleIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9Z"></path><path d="m19 17-.8 2.2L16 20l2.2.8L19 23l.8-2.2L22 20l-2.2-.8Z"></path></svg>';
}
