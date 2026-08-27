import { CanvasHistory } from "./canvas-history.js";

const board = document.querySelector("#board");
const boardGrid = document.querySelector("#boardGrid");
const boardGridContext = boardGrid ? boardGrid.getContext("2d") : null;
const world = document.querySelector("#world");
const objectLayer = document.querySelector("#objects");
const emptyState = document.querySelector("#emptyState");
const boardShell = document.querySelector(".board-shell");
const projectTitle = document.querySelector("#projectTitle");
const projectOptionsButton = document.querySelector(".project-header button");
const projectMenu = document.querySelector("#projectMenu");
const settingsButton = document.querySelector("#settingsButton");
const settingsMenu = document.querySelector("#settingsMenu");
const appVersionValue = document.querySelector("#appVersionValue");
const appUpdateButton = document.querySelector("#appUpdateButton");
const appUpdateStatus = document.querySelector("#appUpdateStatus");
const appRuntimeDetails = document.querySelector("#appRuntimeDetails");
const appRuntimeDiagnostics = document.querySelector("#appRuntimeDiagnostics");
const appRuntimeSource = document.querySelector("#appRuntimeSource");
const runtimeMismatchBanner = document.querySelector("#runtimeMismatchBanner");
const toolbar = document.querySelector("#selectionToolbar");
const textToolbar = document.querySelector("#textToolbar");
if (textToolbar) {
  // Restore toolbar labels that may have been overwritten by global actionLabel()
  const colorDot = textToolbar.querySelector("#textColorDot");
  if (colorDot) colorDot.textContent = "";
  const fontLabel = textToolbar.querySelector("#textFontLabel");
  if (fontLabel) fontLabel.textContent = "Aa";
  const fontSizeLabel = textToolbar.querySelector("#textFontSizeLabel");
  if (fontSizeLabel && !fontSizeLabel.textContent.match(/^\d+$/)) {
    fontSizeLabel.textContent = "28";
  }

  // Ensure no direct text nodes leak into toolbar buttons (only main toolbar buttons, not dropdown items)
  // Exclude buttons inside dropdown menus and color palettes
  textToolbar.querySelectorAll("button").forEach((btn) => {
    if (btn.closest(".text-dropdown-menu, .text-color-palette, .text-color-custom-wrap, .text-size-custom-wrap")) return;
    [...btn.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        btn.removeChild(node);
      }
    });
  });

  // Watch for future direct text node additions inside buttons (exclude dropdown items)
  new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) {
          const parent = n.parentElement;
          if (parent && parent.tagName === "BUTTON" && textToolbar.contains(parent)) {
            // Skip buttons inside dropdown menus and color palettes
            if (parent.closest(".text-dropdown-menu, .text-color-palette, .text-color-custom-wrap, .text-size-custom-wrap")) return;
            parent.removeChild(n);
          }
        }
      });
    });
  }).observe(textToolbar, { childList: true, subtree: true });
}
const quickEditComposer = document.querySelector("#quickEditComposer");
const quickEditPrompt = document.querySelector("#quickEditPrompt");
const editTextPanel = document.querySelector("#editTextPanel");
const editTextList = document.querySelector("#editTextList");
const editTextStatus = document.querySelector("#editTextStatus");
const expandPanel = document.querySelector("#expandPanel");
const expandScale = document.querySelector("#expandScale");
const expandPreset = document.querySelector("#expandPreset");
const expandRatios = document.querySelector("#expandRatios");
const quickEditCancel = document.querySelector("#quickEditCancel");
const quickEditRun = document.querySelector("#quickEditRun");
const quickEditMarkupControls = document.querySelector("#quickEditMarkupControls");
const quickEditColorPalette = document.querySelector("#quickEditColorPalette");
const quickEditHint = document.querySelector("#quickEditHint");
const zoomLabel = document.querySelector("#zoomLabel");
const canvasMap = document.querySelector("#canvasMap");
const canvasMapCanvas = document.querySelector("#canvasMapCanvas");
const canvasMapViewport = document.querySelector("#canvasMapViewport");
const canvasMapContext = canvasMapCanvas.getContext("2d");
// --- Canvas Map Logic ---
let canvasMapBounds = null; // { minX, minY, maxX, maxY }
let canvasMapDragging = false;
let canvasMapLastPointer = null;
let canvasMapVisible = true;
let canvasMapMoved = false; // Track if actual movement occurred
let canvasMapStartPointer = null; // Track initial pointer position
const toast = document.querySelector("#toast");
const toolDock = document.querySelector(".tool-dock");
const undoButton = document.querySelector('[data-history-action="undo"]');
const redoButton = document.querySelector('[data-history-action="redo"]');
const imageUploadInput = document.querySelector("#imageUploadInput");
const colorPalette = document.querySelector("#colorPalette");
const canvasSearch = createCanvasSearchUi();
const defaultCanvasTool = "select";
const zoomWheelSensitivity = 0.0024;
const maxWheelZoomDelta = 160;
const wheelLinePixelSize = 16;
const uploadMaxDisplaySize = 420;
const searchDebounceMs = 180;
const languageStorageKey = "codexCanvasLanguage";
const toolColorStorageKey = "codexCanvasToolColor";
const toolColors = ["#202124", "#d93025", "#f9ab00", "#188038", "#1a73e8", "#9334e6", "#ffffff"];
const defaultQuickEditMarkColor = "#d93025";
const annotationMinimumLengthPx = 18;
const initialSearchParams = new URLSearchParams(window.location.search);
let currentProjectId = initialSearchParams.get("project") || "";
let currentThreadId = initialSearchParams.get("threadId") || initialSearchParams.get("thread-id") || "";
let registeredProjects = [];
let runtimeServerInfo = null;
const pendingTextRecognitionCancels = new Set();
let quickEditAutoColorPrevious = null;

const translations = {
  en: {
    codexCanvas: "Codex canvas",
    canvasTools: "Canvas tools",
    canvasViewControls: "Canvas view controls",
    settings: "Settings",
    language: "Language",
    appVersion: "Version",
    checkUpdates: "Check updates",
    updateNow: "Update",
    updateChecking: "Checking...",
    updateAvailable: "Available",
    updateCurrent: "Current",
    updateUnavailable: "Unavailable",
    updateBlockedDirty: "Local changes",
    updateBlockedAhead: "Local commits",
    updateBlockedDetached: "Detached HEAD",
    updateBlockedNoUpstream: "No upstream",
    updateBlockedNotGit: "Manual",
    updateBlockedSource: "Reinstall",
    updateBlockedRemote: "Offline",
    updateBlockedRelease: "Manual",
    updateRunning: "Updating...",
    updateDone: "Updated. Close the canvas and start a new Codex task to load the new version.",
    updateFailed: "Update failed.",
    runtimeMismatch: "Version mismatch: workspace v{workspace}, running service v{server}. Restart Canvas from this project.",
    projectOptions: "Project options",
    switchCanvas: "Switch canvas",
    currentCanvas: "Current",
    projectDelete: "Delete canvas",
    projectDeleteConfirmTitle: "Delete canvas?",
    projectDeleteConfirmMessage: "This will permanently delete the canvas and all of its data. This action cannot be undone.",
    projectDeleteConfirmButton: "Delete",
    projectDeleted: "Canvas deleted.",
    projectDeleteBlockedJobs: "The canvas has running jobs and cannot be deleted.",
    projectDeleteBlockedLast: "At least one canvas must be kept.",
    projectDeleteFailed: "Failed to delete canvas.",
    promptHistory: "Prompt history",
    promptHistorySearch: "Filter prompts",
    promptHistoryLoading: "Loading prompts...",
    promptHistoryEmpty: "No matching prompts.",
    promptHistoryFailed: "Prompt history failed to load.",
    promptHistoryApplied: "Prompt added to Quick Edit.",
    promptHistoryCopied: "Prompt copied.",
    promptHistoryTab: "Prompts",
    versionBrowserTab: "Versions",
    layerBrowser: "Layers",
    layerBrowserImages: "images",
    layerBrowserLayers: "layers",
    layerBrowserFit: "Fit",
    layerBrowserEmpty: "No images or layers on this canvas.",
    layerBrowserImage: "Image",
    layerBrowserLayer: "Layer",
    layerBrowserBackground: "Background",
    layerBrowserGrouped: "grouped",
    versionBrowserSearch: "Filter versions",
    versionBrowserLoading: "Loading versions...",
    versionBrowserEmpty: "No matching version groups.",
    versionBrowserFailed: "Version groups failed to load.",
    versionGroupLabel: "Group by",
    versionGroupSource: "Source",
    versionGroupBatch: "Batch",
    versionGroupLayout: "Layout",
    versionGroupPrompt: "Prompt",
    versionGroupCount: "objects",
    versionGroupCompare: "Compare",
    versionGroupAnnotate: "Diff",
    versionDiffLabel: "Pixel diff",
    textPlaceholder: "Text",
    quickEditPlaceholder: "Describe your edit here",
    quickEditHint: "Drag between the image target and an outside note position. The arrow points to the image and the text stays at the tail.",
    annotationPlaceholder: "Type an edit instruction",
    annotationEditHint: "Double-click, or select and press Enter, to edit",
    annotationTargetMissing: "Select an image first, or drag the arrow to or from an image.",
    applyAnnotations: "Apply edit",
    expandPlaceholder: "Describe what should extend beyond the image edges",
    quickEditEmpty: "Add an instruction or an annotation first.",
    expandEmpty: "Describe what to extend first.",
    expandTitle: "Expand",
    expandScale: "Scale",
    expandPreset: "Preset",
    expandPresetGeneral: "General",
    expandPresetPhoto: "Photo",
    expandPresetPoster: "Poster",
    expandPresetProduct: "Product",
    expandOriginalRatio: "Original ratio",
    cropApply: "Apply",
    editTextPlaceholder: "Describe the text change here",
    editTextEmpty: "Describe the text change first.",
    editTextTitle: "Edit Text",
    editTextRecognizing: "Recognizing text...",
    editTextNoText: "No editable text was recognized.",
    editTextNoChanges: "Edit at least one recognized text item first.",
    searchLabel: "Search canvas",
    searchPlaceholder: "Search name, prompt, text, source, metadata",
    searchAllTypes: "All",
    searchEmpty: "No matching objects",
    searchHint: "Search canvas objects",
    searchFailed: "Search failed.",
    cancel: "Cancel",
    run: "Run",
    jobStarted: "started. This can take a few minutes.",
    jobRunning: "Running...",
    jobDone: "finished and was added to the canvas.",
    jobFailed: "failed.",
    jobCenter: "Generation tasks",
    jobCenterEmpty: "No generation tasks yet.",
    jobCenterRunning: "running",
    jobCenterCompleted: "completed",
    jobCenterCancelAll: "Cancel all",
    jobCenterCancel: "Cancel task",
    jobCenterDelete: "Delete task",
    jobCenterDeleted: "Task deleted.",
    jobCenterCancelled: "Cancelled",
    jobCenterQueued: "Queued",
    jobCenterSuccess: "Succeeded",
    jobCenterError: "Failed",
    jobCenterUnknownError: "The task ended unexpectedly.",
    jobCenterImage: "Image",
    jobCenterSummary: "generation tasks",
    jobCenterFineCutout: "Refining with AI",
    jobDeleteBlocked: "A running image job cannot be deleted. Wait for it to finish or fail.",
    chatSendStarted: "Sending image to bound chat...",
    chatSendDone: "Image submitted through Codex app-server. If it does not appear in the visible chat, use Copy @file.",
    fileMentionCopied: "@file reference copied. Paste it into the Codex chat box.",
    fileMentionCopyFailed: "Could not copy @file reference.",
    chatNotBound: "Bind this canvas to a Codex thread first.",
    uploadDone: "Image uploaded.",
    uploadFailed: "Image upload failed.",
    downloadPreparing: "Preparing download…",
    downloadStarted: "Download started. Check your browser downloads.",
    downloadFailed: "Download failed.",
    actions: {
      "quick-edit": "Quick Edit",
      "remove-bg": "Remove BG",
      "expand": "Expand",
      "crop": "Crop",
      "edit-elements": "Edit Elements",
      "edit-page": "Edit page",
      "reset-layer-group": "Reset group",
      "layer-up": "Layer up",
      "layer-down": "Layer down",
      "group-layer-group": "Group",
      "align-left": "Align left",
      "align-center": "Align center",
      "align-right": "Align right",
      "align-top": "Align top",
      "align-middle": "Align middle",
      "align-bottom": "Align bottom",
      "distribute-horizontal": "Distribute horizontally",
      "distribute-vertical": "Distribute vertically",
      "tidy-grid": "Tidy grid",
      "edit-text": "Edit Text",
      "reference-generate": "Reference Generate",
      "send-to-chat": "Send to chat",
      "copy-file-mention": "Copy @file",
      "download": "Download",
      "toggle-resolution": "Resolution",
      "text-bold": "Bold",
      "text-italic": "Italic",
      "text-underline": "Underline",
      "text-color": "Text color",
      "text-font-family": "Font",
      "text-font-size": "Font size",
      "text-align": "Alignment",
      "text-lock": "Lock",
      "text-delete": "Delete"
    },
    actionNames: {
      "quick-edit": "Quick Edit",
      "remove-bg": "Remove BG",
      "expand": "Expand",
      "crop": "Crop",
      "edit-elements": "Edit Elements",
      "reset-layer-group": "Reset group",
      "layer-up": "Layer up",
      "layer-down": "Layer down",
      "group-layer-group": "Group",
      "align-left": "Align left",
      "align-center": "Align center",
      "align-right": "Align right",
      "align-top": "Align top",
      "align-middle": "Align middle",
      "align-bottom": "Align bottom",
      "distribute-horizontal": "Distribute horizontally",
      "distribute-vertical": "Distribute vertically",
      "tidy-grid": "Tidy grid",
      "edit-text": "Edit Text",
      "reference-generate": "Reference Generate",
      "send-to-chat": "Send to chat",
      "copy-file-mention": "Copy @file",
      "download": "Download",
      "text-bold": "Bold",
      "text-italic": "Italic",
      "text-underline": "Underline",
      "text-color": "Text color",
      "text-font-family": "Font",
      "text-font-size": "Font size",
      "text-align": "Alignment",
      "text-lock": "Lock",
      "text-delete": "Delete"
    },
    tools: {
      hand: "Hand",
      select: "Select",
      pencil: "Pencil",
      text: "Text",
      annotation: "Arrow note",
      "upload-image": "Upload image"
    },
    controls: {
      undo: "Undo",
      redo: "Redo",
      reset: "Reset view"
    },
    objectTypes: {
      image: "Image",
      "slide-frame": "Structured slide",
      html: "HTML page",
      slides: "AI Slides",
      text: "Text",
      drawing: "Drawing",
      annotation: "Annotation",
      job: "Job"
    }
  },
  zh: {
    codexCanvas: "Agent 画布",
    canvasTools: "画布工具",
    canvasViewControls: "画布视图控制",
    settings: "设置",
    language: "语言",
    appVersion: "版本",
    checkUpdates: "检查更新",
    updateNow: "更新",
    updateChecking: "检查中...",
    updateAvailable: "可更新",
    updateCurrent: "已最新",
    updateUnavailable: "不可用",
    updateBlockedDirty: "有本地改动",
    updateBlockedAhead: "有本地提交",
    updateBlockedDetached: "游离 HEAD",
    updateBlockedNoUpstream: "无上游",
    updateBlockedNotGit: "需手动",
    updateBlockedSource: "需重装",
    updateBlockedRemote: "网络不可用",
    updateBlockedRelease: "需手动",
    updateRunning: "更新中...",
    updateDone: "已更新。请关闭画布并新建 Codex 任务，以加载新版 MCP 和技能。",
    updateFailed: "更新失败。",
    runtimeMismatch: "版本不一致：工作区为 v{workspace}，当前服务为 v{server}。请从本项目重新启动 Canvas。",
    projectOptions: "项目选项",
    switchCanvas: "切换画布",
    currentCanvas: "当前",
    projectDelete: "删除画布",
    projectDeleteConfirmTitle: "删除画布？",
    projectDeleteConfirmMessage: "这将永久删除该画布及其全部数据，此操作不可恢复。",
    projectDeleteConfirmButton: "删除",
    projectDeleted: "画布已删除。",
    projectDeleteBlockedJobs: "画布有进行中的任务，暂时无法删除。",
    projectDeleteBlockedLast: "至少需要保留一块画布。",
    projectDeleteFailed: "删除画布失败。",
    promptHistory: "提示词历史",
    promptHistorySearch: "筛选提示词",
    promptHistoryLoading: "正在加载提示词...",
    promptHistoryEmpty: "没有匹配的提示词。",
    promptHistoryFailed: "提示词历史加载失败。",
    promptHistoryApplied: "已填入快捷编辑。",
    promptHistoryCopied: "已复制提示词。",
    promptHistoryTab: "提示词",
    versionBrowserTab: "版本",
    layerBrowser: "图层",
    layerBrowserImages: "张图片",
    layerBrowserLayers: "个图层",
    layerBrowserFit: "适应",
    layerBrowserEmpty: "画布中还没有图片或图层。",
    layerBrowserImage: "图片",
    layerBrowserLayer: "图层",
    layerBrowserBackground: "背景",
    layerBrowserGrouped: "已成组",
    versionBrowserSearch: "筛选版本",
    versionBrowserLoading: "正在加载版本...",
    versionBrowserEmpty: "没有匹配的版本分组。",
    versionBrowserFailed: "版本分组加载失败。",
    versionGroupLabel: "分组",
    versionGroupSource: "来源",
    versionGroupBatch: "批次",
    versionGroupLayout: "布局",
    versionGroupPrompt: "提示词",
    versionGroupCount: "个对象",
    versionGroupCompare: "比较",
    versionGroupAnnotate: "差异",
    versionDiffLabel: "像素差异",
    textPlaceholder: "文字",
    quickEditPlaceholder: "描述你想怎么改这张图",
    quickEditHint: "在图片目标与外侧批注位置之间拖拽；箭头指向图片，文字留在箭尾。",
    annotationPlaceholder: "输入修改要求",
    annotationEditHint: "双击编辑，或选中后按 Enter",
    annotationTargetMissing: "请先选择图片，或让箭头的一端落在图片上。",
    applyAnnotations: "按标注修改",
    expandPlaceholder: "描述要向画面边缘外扩展什么内容",
    quickEditEmpty: "请先填写修改要求或添加标注。",
    expandEmpty: "先描述要扩展什么内容。",
    expandTitle: "扩图",
    expandScale: "Scale",
    expandPreset: "Preset",
    expandPresetGeneral: "General",
    expandPresetPhoto: "Photo",
    expandPresetPoster: "Poster",
    expandPresetProduct: "Product",
    expandOriginalRatio: "Original ratio",
    cropApply: "应用",
    editTextPlaceholder: "描述要替换或修改的文字",
    editTextEmpty: "先描述你想改哪些字。",
    editTextTitle: "编辑文字",
    editTextRecognizing: "正在识别文字...",
    editTextNoText: "没有识别到可编辑文字。",
    editTextNoChanges: "先修改至少一项识别文字。",
    searchLabel: "搜索画布",
    searchPlaceholder: "搜索名称、prompt、文字、来源、元数据",
    searchAllTypes: "全部",
    searchEmpty: "没有匹配对象",
    searchHint: "搜索画布对象",
    searchFailed: "搜索失败。",
    cancel: "取消",
    run: "运行",
    jobStarted: "已开始，可能需要几分钟。",
    jobRunning: "运行中...",
    jobDone: "已完成并添加到画布。",
    jobFailed: "失败。",
    jobCenter: "生成任务",
    jobCenterEmpty: "暂无生成任务",
    jobCenterRunning: "进行中",
    jobCenterCompleted: "已完成",
    jobCenterCancelAll: "取消全部",
    jobCenterCancel: "取消任务",
    jobCenterDelete: "删除任务",
    jobCenterDeleted: "任务已删除。",
    jobCenterCancelled: "已取消",
    jobCenterQueued: "排队中",
    jobCenterSuccess: "生成成功",
    jobCenterError: "生成失败",
    jobCenterUnknownError: "任务异常结束",
    jobCenterImage: "图片生成",
    jobCenterSummary: "个生成任务",
    jobCenterFineCutout: "AI 精细抠图",
    jobDeleteBlocked: "图片任务仍在运行，完成或失败后才能删除。",
    chatSendStarted: "正在发送图片到已绑定对话...",
    chatSendDone: "图片已通过 Codex app-server 提交；如果当前对话没有显示，请用“复制 @文件”。",
    fileMentionCopied: "@file 引用已复制，请粘贴到 Codex 聊天框。",
    fileMentionCopyFailed: "无法复制 @file 引用。",
    chatNotBound: "请先把画布绑定到 Codex thread。",
    uploadDone: "图片已上传。",
    uploadFailed: "图片上传失败。",
    downloadPreparing: "正在准备下载，请稍候…",
    downloadStarted: "下载已开始，请在浏览器下载记录中查看。",
    downloadFailed: "下载失败。",
    actions: {
      "quick-edit": "编辑图片",
      "remove-bg": "去背景",
      "expand": "扩图",
      "crop": "裁剪",
      "edit-elements": "元素分层",
      "edit-page": "编辑页面",
      "reset-layer-group": "重置组",
      "layer-up": "上移一层",
      "layer-down": "下移一层",
      "group-layer-group": "编组",
      "align-left": "左对齐",
      "align-center": "水平居中",
      "align-right": "右对齐",
      "align-top": "顶部对齐",
      "align-middle": "垂直居中",
      "align-bottom": "底部对齐",
      "distribute-horizontal": "水平分布",
      "distribute-vertical": "垂直分布",
      "tidy-grid": "整理为网格",
      "edit-text": "编辑文字",
      "reference-generate": "参考生图",
      "send-to-chat": "发送到对话",
      "copy-file-mention": "复制 @文件",
      "download": "下载",
      "toggle-resolution": "分辨率",
      "text-bold": "加粗",
      "text-italic": "倾斜",
      "text-underline": "下划线",
      "text-color": "文字颜色",
      "text-font-family": "字体",
      "text-font-size": "字号",
      "text-align": "对齐方式",
      "text-lock": "锁定",
      "text-delete": "删除"
    },
    actionNames: {
      "quick-edit": "编辑图片",
      "remove-bg": "去背景",
      "expand": "扩图",
      "crop": "裁剪",
      "edit-elements": "元素分层",
      "reset-layer-group": "重置组",
      "layer-up": "上移一层",
      "layer-down": "下移一层",
      "group-layer-group": "编组",
      "align-left": "左对齐",
      "align-center": "水平居中",
      "align-right": "右对齐",
      "align-top": "顶部对齐",
      "align-middle": "垂直居中",
      "align-bottom": "底部对齐",
      "distribute-horizontal": "水平分布",
      "distribute-vertical": "垂直分布",
      "tidy-grid": "整理为网格",
      "edit-text": "编辑文字",
      "reference-generate": "参考生图",
      "send-to-chat": "发送到对话",
      "copy-file-mention": "复制 @文件",
      "download": "下载",
      "text-bold": "加粗",
      "text-italic": "倾斜",
      "text-underline": "下划线",
      "text-color": "文字颜色",
      "text-font-family": "字体",
      "text-font-size": "字号",
      "text-align": "对齐方式",
      "text-lock": "锁定",
      "text-delete": "删除"
    },
    tools: {
      hand: "抓手",
      select: "选择",
      pencil: "画笔",
      text: "文字",
      annotation: "箭头批注",
      "upload-image": "上传图片"
    },
    controls: {
      undo: "撤销",
      redo: "重做",
      reset: "重置视图"
    },
    objectTypes: {
      image: "图片",
      "slide-frame": "结构化幻灯片",
      html: "HTML 页面",
      slides: "AI 幻灯片",
      text: "文字",
      drawing: "绘图",
      annotation: "批注",
      job: "任务"
    }
  }
};

let state = null;
let knownObjectIds = null;
let lastLoadedStateSignature = null;
const canvasObjectRenderSignatures = new Map();
let suppressNextAutoFocus = false;
let selectedId = null;
let selectedIds = new Set();
let hasUserSelection = false;
let activeSlidesDeckId = null;
let slidesWorkspaceOpen = localStorage.getItem("codex-canvas:slides-workspace-open") === "true";
let lastSlidesDeckId = localStorage.getItem("codex-canvas:last-slides-deck-id") || null;
const activeSlideIndexByDeck = new Map();
const slidesGeneratorOpenByDeck = new Set();
const slidesGeneratorDraftByDeck = new Map();
const slidesRegenerateStateByDeck = new Map();
const lastDeckTransformByDeck = new Map();
const slidesDraftStorageKey = "codex-canvas:slides-generator-drafts";
const slidesHistoryStorageKey = "codex-canvas:slides-generation-history";

function slidesBrandStorageKey() { return `codex-canvas:brand-profile:${currentProjectId || "default"}`; }
function loadSlidesBrandProfile() {
  try { const value = JSON.parse(localStorage.getItem(slidesBrandStorageKey()) || "null"); return value && typeof value === "object" ? value : null; } catch { return null; }
}
function saveSlidesBrandProfile(profile) {
  try { if (profile?.enabled) localStorage.setItem(slidesBrandStorageKey(), JSON.stringify(profile)); else localStorage.removeItem(slidesBrandStorageKey()); } catch {}
}

function escapeSlideBriefHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
}

function parseExplicitSlideBriefInput(value) {
  const source = String(value || "").trim();
  const fields = {};
  const labels = {
    topic:/^(?:主题|topic)\s*[：:]\s*(.+)$/i,
    goal:/^(?:目标|演示目标|goal)\s*[：:]\s*(.+)$/i,
    audience:/^(?:受众|目标受众|audience)\s*[：:]\s*(.+)$/i,
    scenario:/^(?:场景|使用场景|scenario)\s*[：:]\s*(.+)$/i,
    narrative:/^(?:叙事|叙事结构|narrative)\s*[：:]\s*(.+)$/i,
    style:/^(?:视觉|视觉方向|style|visual direction)\s*[：:]\s*(.+)$/i,
    factsAndSources:/^(?:事实规则|事实与资料边界|fact rule|facts and sources)\s*[：:]\s*(.+)$/i
  };
  for (const line of source.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    for (const [key, pattern] of Object.entries(labels)) {
      const match = pattern.exec(line);
      if (match) { fields[key] = match[1].trim(); break; }
    }
  }
  const chinesePageNumber = (raw) => {
    const value = String(raw || "").trim();
    if (/^\d{1,2}$/.test(value)) return Number(value);
    const digits = { 一:1, 二:2, 两:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9 };
    if (value === "十") return 10;
    const match = /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(value);
    if (match) return (match[1] ? digits[match[1]] : 1) * 10 + (match[2] ? digits[match[2]] : 0);
    return digits[value] || null;
  };
  const pageToken = "(\\d{1,2}|[一二两三四五六七八九十]{1,3})";
  const pageMatch = new RegExp(`(?:建议页数|篇幅|页数|recommended slides|slide count|length)\\s*[：:]?\\s*${pageToken}\\s*(?:页|slides?)?`, "i").exec(source)
    || new RegExp(`(?:做成?|生成|制作|一共|总共)?\\s*${pageToken}\\s*页`, "i").exec(source);
  const parsedPageCount = pageMatch ? chinesePageNumber(pageMatch[1]) : null;
  if (parsedPageCount) fields.recommendedPageCount = Math.max(1, Math.min(20, parsedPageCount));
  return fields;
}

function freshSlidesGeneratorDraft(overrides = {}) {
  return { topic:"", count:5, pageCountMode:"auto", references:[], presetIds:[], outline:null, brief:null, optimizedBrief:null, briefOriginalTopic:"", requirements:null, designSystem:null, visualRhythm:null, brandProfile:loadSlidesBrandProfile(), deckTemplateId:"freeform", templateConfidence:0, templateRecommendations:[], dataMode:"ai-generated", phase:"brief", targetSlideId:null, activeJobId:null, briefJobId:null, generationJobId:null, lastError:null, ...overrides };
}

function loadPersistedSlidesDrafts() {
  try {
    const saved = JSON.parse(localStorage.getItem(slidesDraftStorageKey) || "{}");
    for (const [deckId, draft] of Object.entries(saved)) {
      if (draft && typeof draft === "object" && ["optimizing-brief","brief-review","planning","requirements","storyline","structure","visual-system","outline","generating","review"].includes(draft.phase)) slidesGeneratorDraftByDeck.set(deckId, draft);
    }
  } catch {}
}

function persistSlidesDrafts() {
  try {
    const saved = {};
    for (const [deckId, draft] of slidesGeneratorDraftByDeck) {
      if (["optimizing-brief","brief-review","planning","requirements","storyline","structure","visual-system","outline","generating","review"].includes(draft?.phase)) saved[deckId] = { ...draft, references: [], pollToken: undefined };
    }
    localStorage.setItem(slidesDraftStorageKey, JSON.stringify(saved));
  } catch {}
}

async function pollSlidesJobGlobal(job, onProgress) {
  while (["queued", "running", "pausing", "paused"].includes(job.status)) {
    onProgress?.(job);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const response = await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(job.id)}`));
    job = await response.json(); if (!response.ok) throw new Error(job.error || t("jobFailed"));
  }
  if (job.status === "interrupted") {
    const error = new Error(job.error || (language === "zh" ? "Canvas 服务重启，任务已保留" : "Canvas restarted; the task was preserved"));
    error.job = job;
    throw error;
  }
  if (job.status !== "done") {
    const error = new Error(job.error || (language === "zh" ? "AI 幻灯片任务失败" : "AI slide task failed"));
    error.job = job;
    throw error;
  }
  return job;
}

function slidesDeckHasActiveRegenerate(deckId) {
  const regen = slidesRegenerateStateByDeck.get(deckId);
  return Boolean(regen && ["confirm", "starting", "generating"].includes(regen.status));
}

function slidesDeckRegenerateFrame(deckId) {
  const frame = document.querySelector(`[data-slides-deck-frame="${deckId}"]`);
  return frame || null;
}

function regenerationContentFromSlide(slide) {
  const elements = Array.isArray(slide?.elements) ? slide.elements : [];
  const fragments = elements
    .filter((element) => ["text", "shape", "table", "chart"].includes(String(element?.type || "")))
    .map((element) => String(element?.text || element?.chart?.title || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const title = String(slide?.name || fragments[0] || "").trim();
  const body = fragments.filter((text) => text !== title).join("\n").slice(0, 2400);
  return { title, body, fragments };
}

function regenerationStyleContext(deck, slide, index) {
  const slides = slidesForDeck(deck);
  const colors = new Set();
  const fonts = new Set();
  for (const page of slides) {
    const background = String(page?.background || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(background)) colors.add(background.toLowerCase());
    for (const element of Array.isArray(page?.elements) ? page.elements : []) {
      const style = element?.style || {};
      for (const value of [style.background, style.color, style.borderColor]) {
        if (/^#[0-9a-f]{6}$/i.test(String(value || ""))) colors.add(String(value).toLowerCase());
      }
      if (style.fontFamily) fonts.add(String(style.fontFamily).slice(0, 120));
    }
  }
  const draft = slidesGeneratorDraftByDeck.get(deck.id) || {};
  const rhythm = Array.isArray(draft.visualRhythm) ? draft.visualRhythm[index] || null : null;
  const pageLayout = [slide?.layoutFamily, slide?.archetype, slide?.templateId, slide?.intent].filter(Boolean).join(" / ");
  const deckStyle = [
    draft?.brief?.style || draft?.designSystem?.style || "",
    `Keep this page inside the existing slide family: background ${slide?.background || "existing deck background"}; colors ${[...colors].slice(0, 8).join(", ") || "inherit nearby pages"}; fonts ${[...fonts].slice(0, 3).join(", ") || "inherit nearby pages"}; layout family ${pageLayout || "inherit nearby pages"}.`,
    "Do not introduce a new theme, palette, typography family, card radius, illustration material, or page density."
  ].filter(Boolean).join(" ").slice(0, 600);
  return {
    brief: {
      goal: draft?.brief?.goal || "",
      audience: draft?.brief?.audience || "",
      scenario: draft?.brief?.scenario || "",
      style: draft?.brief?.style || draft?.designSystem?.style || ""
    },
    deckStyle,
    designSystem: draft.designSystem || null,
    visualRhythm: rhythm ? [rhythm] : [],
    brandProfile: draft.brandProfile || loadSlidesBrandProfile(),
    deckTemplateId: draft.deckTemplateId || deck.templateId || "freeform"
  };
}

function buildRegenerateState(deck, slide, index) {
  const content = regenerationContentFromSlide(slide);
  const style = regenerationStyleContext(deck, slide, index);
  return {
    slideId: slide.id,
    slideIndex: index,
    jobId: null,
    status: "confirm",
    outline: {
      title: content.title || `${language === "zh" ? "幻灯片" : "Slide"} ${index + 1}`,
      message: content.body || (language === "zh" ? "保留当前页核心信息并提升视觉表达" : "Preserve the core message and improve visual communication"),
      lead: content.body.slice(0, 800),
      keyPoints: content.fragments.slice(1, 6).map((body) => ({ heading:"", body })),
      type: slide.templateId || "insight",
      layoutFamily: slide.layoutFamily || "",
      treatment: slide.archetype || "",
      visual: `${language === "zh" ? "沿用整套视觉系统，优化本页构图。" : "Keep the deck visual system and improve this composition. "}${style.deckStyle}`.slice(0, 600)
    },
    brief: style.brief,
    styleContext: style,
    instruction: "improve",
    error: null,
    pollToken: null,
    startedAt: Date.now(),
    autoConfirmCleanup: null
  };
}

function positionRegeneratePopover(scrim, popover, anchorEl) {
  const POPOVER_WIDTH = 300;
  const GAP = 8;
  const MARGIN = 10;
  if (!anchorEl || !anchorEl.isConnected) {
    // Fallback：frame 右上角
    const frame = scrim.parentElement;
    const frameRect = frame?.getBoundingClientRect();
    if (frameRect) {
      scrim.style.left = `${Math.max(MARGIN, frameRect.right - POPOVER_WIDTH - MARGIN)}px`;
      scrim.style.top = `${frameRect.top + MARGIN}px`;
    } else {
      scrim.style.left = `${MARGIN}px`;
      scrim.style.top = `${MARGIN}px`;
    }
    window.requestAnimationFrame(() => {
      const popRect = popover.getBoundingClientRect();
      let top = frameRect ? frameRect.top + MARGIN : MARGIN;
      if (top + popRect.height > window.innerHeight - MARGIN) {
        top = Math.max(MARGIN, window.innerHeight - popRect.height - MARGIN);
      }
      scrim.style.top = `${top}px`;
    });
    return;
  }
  const rect = anchorEl.getBoundingClientRect();
  let left = rect.right + GAP;
  if (left + POPOVER_WIDTH > window.innerWidth - MARGIN) {
    left = Math.max(MARGIN, rect.left - POPOVER_WIDTH - GAP);
  }
  scrim.style.left = `${left}px`;
  scrim.style.top = `${rect.top}px`;
  window.requestAnimationFrame(() => {
    const popRect = popover.getBoundingClientRect();
    let top = rect.top;
    if (top + popRect.height > window.innerHeight - MARGIN) {
      top = Math.max(MARGIN, window.innerHeight - popRect.height - MARGIN);
    }
    if (top < MARGIN) top = MARGIN;
    scrim.style.top = `${top}px`;
  });
}

function buildRegeneratePopover(deck, regen, anchorEl = null) {
  const scrim = document.createElement("div");
  scrim.className = "slides-regenerate-scrim";
  scrim.setAttribute("role", "dialog");
  scrim.setAttribute("aria-modal", "true");
  scrim.setAttribute("aria-labelledby", "slides-regen-title");
  const messagePlaceholder = language === "zh" ? "描述这一页要传达的核心信息（不填则沿用原内容）" : "Key message for this slide (leave blank to keep original)";
  const modes = language === "zh" ? [["improve","智能优化"],["business","更商务"],["concise","精简文案"],["visual","强化视觉"],["diagram","转为图解"]] : [["improve","Smart improve"],["business","More businesslike"],["concise","Shorten copy"],["visual","Stronger visual"],["diagram","Turn into diagram"]];
  scrim.innerHTML = `<section class="slides-regenerate-popover"><h2 id="slides-regen-title" class="slides-regenerate-title">${language === "zh" ? "AI 修改当前页" : "Modify this slide with AI"}</h2><form class="slides-regenerate-form"><div class="slides-regenerate-body"><div class="slides-regenerate-modes">${modes.map(([value,label]) => `<button type="button" data-regen-mode="${value}" class="${regen.instruction === value ? "selected" : ""}">${label}</button>`).join("")}</div><label class="slides-regenerate-field"><span>${language === "zh" ? "补充要求（可选）" : "Additional instruction (optional)"}</span><textarea data-regen-field="message" maxlength="600" placeholder="${messagePlaceholder}"></textarea></label><p class="slides-regenerate-preserve">${language === "zh" ? "只替换当前页，其他页面、顺序和整套视觉风格保持不变。" : "Only this slide is replaced; all other slides, order, and deck styling stay unchanged."}</p></div><div class="slides-regenerate-actions"><button type="button" class="slides-regenerate-cancel" data-regen-action="cancel">${language === "zh" ? "取消" : "Cancel"}</button><button type="submit" class="slides-regenerate-confirm"><span>${language === "zh" ? "开始修改" : "Apply change"}</span></button></div></form></section>`;
  const popover = scrim.querySelector(".slides-regenerate-popover");
  const messageInput = scrim.querySelector('[data-regen-field="message"]');
  messageInput.value = regen.outline.message;
  if (!messageInput.value) messageInput.placeholder = messagePlaceholder;
  const collectFields = () => { regen.outline.message = messageInput.value; };
  scrim.querySelector(".slides-regenerate-modes").onclick = (event) => { const button = event.target.closest("[data-regen-mode]"); if (!button) return; regen.instruction = button.dataset.regenMode; scrim.querySelectorAll("[data-regen-mode]").forEach((item) => item.classList.toggle("selected", item === button)); };
  scrim.addEventListener("pointerdown", (event) => event.stopPropagation());
  popover.querySelector('[data-regen-action="cancel"]').onclick = () => closeRegeneratePopover(deck);
  messageInput.addEventListener("input", collectFields);
  const form = scrim.querySelector(".slides-regenerate-form");
  form.onsubmit = (event) => { event.preventDefault(); collectFields(); confirmInlineRegenerate(deck); };
  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRegeneratePopover(deck);
    }
  };
  scrim.addEventListener("keydown", handleKeydown);
  const handleResize = () => positionRegeneratePopover(scrim, popover, anchorEl);
  window.addEventListener("resize", handleResize);
  regen._cleanupPosition = () => window.removeEventListener("resize", handleResize);
  window.requestAnimationFrame(() => {
    positionRegeneratePopover(scrim, popover, anchorEl);
    messageInput.focus();
  });
  return scrim;
}

function closeRegeneratePopover(deck) {
  const regen = slidesRegenerateStateByDeck.get(deck.id);
  if (!regen) return;
  if (regen._cleanupPosition) { regen._cleanupPosition(); regen._cleanupPosition = null; }
  regen._scrim?.remove();
  regen._scrim = null;
  if (regen.status === "confirm") {
    slidesRegenerateStateByDeck.delete(deck.id);
    return;
  }
}

async function confirmInlineRegenerate(deck) {
  const regen = slidesRegenerateStateByDeck.get(deck.id);
  if (!regen || regen.status !== "confirm") return;
  regen.status = "starting";
  if (regen._cleanupPosition) { regen._cleanupPosition(); regen._cleanupPosition = null; }
  regen._scrim?.remove();
  regen._scrim = null;
  attachRegenerateOverlays(deck);
  const instructionLabels = { improve:"保留事实与核心信息，主动修复层级、留白、对齐和视觉表达", business:"在不改变事实的前提下改成专业管理层汇报风格", concise:"保留结论与关键证据，将文案精简约30%并扩大有效留白", visual:"保留事实，强化内容相关的主视觉、构图焦点与页面节奏", diagram:"保留事实，将适合的并列、流程或关系内容改为清晰的可编辑图解" };
  regen.outline.visual = `${instructionLabels[regen.instruction] || instructionLabels.improve}。沿用整套设计系统；禁止改动其他页面。${regen.styleContext?.deckStyle || ""}`.slice(0, 600);
  const slideCharts = Array.isArray(state?.objects?.find((item) => item.id === regen.slideId)?.elements) ? state.objects.find((item) => item.id === regen.slideId).elements.filter((item) => item.type === "chart") : [];
  const payload = {
    action: "generate-slides",
    deckId: deck.id,
    prompt: JSON.stringify({ topic: regen.outline.title, ...regen.brief }, null, 2),
    pageCount: 1,
    outline: [{ ...regen.outline, order: 1 }],
    visualDirection: {
      deckStyle: regen.styleContext?.deckStyle || regen.brief.style || "",
      goal: regen.brief.goal || "",
      audience: regen.brief.audience || "",
      scenario: regen.brief.scenario || "",
      presets: [],
      designSystem: regen.styleContext?.designSystem || null,
      visualRhythm: regen.styleContext?.visualRhythm || [],
      brandProfile: regen.styleContext?.brandProfile || null
    },
    references: [],
    deckTemplateId: regen.styleContext?.deckTemplateId || "freeform",
    dataMode: slideCharts.some((item) => item.chart?.dataMode === "supplied") ? "supplied" : "ai-generated",
    targetSlideId: regen.slideId
  };
  try {
    const response = await fetch(apiPath("/api/slides/jobs"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || t("jobFailed"));
    regen.jobId = job.id;
    regen.status = "generating";
    regen.pollToken = {};
    regen.error = null;
    showToast(language === "zh" ? "已确认大纲，AI 正在重新生成此页" : "Outline confirmed; AI is regenerating this slide");
    pollInlineRegenerateJob(deck, job);
  } catch (error) {
    regen.status = "error";
    regen.error = error?.message || t("jobFailed");
    showToast(language === "zh" ? `启动失败：${regen.error}` : `Could not start: ${regen.error}`);
    attachRegenerateOverlays(deck);
  }
}

async function pollInlineRegenerateJob(deck, initialJob) {
  const regen = slidesRegenerateStateByDeck.get(deck.id);
  if (!regen) return;
  const token = regen.pollToken;
  let job = initialJob;
  try {
    job = await pollSlidesJobGlobal(job, (current) => {
      if (regen.pollToken !== token) return;
      updateRegenerateProgress(deck, current);
    });
    if (regen.pollToken !== token) return;
    await loadState();
    const importedId = Array.isArray(job.imported) && job.imported[0]?.id ? job.imported[0].id : null;
    const deckSlides = slidesForDeck(deck);
    const newSlide = (importedId && state.objects.find((object) => object.id === importedId)) || deckSlides[regen.slideIndex] || deckSlides.find((object) => object.id === regen.slideId);
    regen.status = "done";
    regen.jobId = null;
    regen.pollToken = null;
    swapRegeneratedSlideDOM(deck, newSlide);
    showToast(language === "zh" ? "已原地更新此页" : "Slide updated in place");
    window.setTimeout(() => {
      if (slidesRegenerateStateByDeck.get(deck.id) === regen) slidesRegenerateStateByDeck.delete(deck.id);
    }, 1200);
  } catch (error) {
    if (regen.pollToken !== token) return;
    regen.status = "error";
    regen.error = error?.message || t("jobFailed");
    regen.jobId = null;
    regen.pollToken = null;
    showToast(language === "zh" ? `重新生成失败：${regen.error}` : `Regeneration failed: ${regen.error}`);
    attachRegenerateOverlays(deck);
  }
}

function updateRegenerateProgress(deck, currentJob) {
  const frame = slidesDeckRegenerateFrame(deck.id);
  if (!frame) return;
  const badge = frame.querySelector(`[data-slide-index="${slidesRegenerateStateByDeck.get(deck.id)?.slideIndex}"] .slides-deck-regen-badge`);
  if (!badge) return;
  const seconds = Math.max(0, Number(currentJob.elapsedSeconds) || 0);
  const stageLabel = currentJob.stage === "validating" ? (language === "zh" ? "检查中" : "Reviewing")
    : currentJob.stage === "illustrating" ? (language === "zh" ? "视觉增强中" : "Enhancing")
    : currentJob.stage === "final-review" ? (language === "zh" ? "终检中" : "Final review")
    : currentJob.stage === "final-repair" ? (language === "zh" ? "修复中" : "Repairing")
    : currentJob.stage === "importing" ? (language === "zh" ? "同步中" : "Syncing")
    : (language === "zh" ? "生成中" : "Generating");
  badge.textContent = `${stageLabel} · ${formatSlidesElapsed(seconds)}`;
}

function formatSlidesClock(totalSeconds) {
  const normalizedSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;
  if (language === "zh") return minutes ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatSlidesElapsed(totalSeconds) {
  return language === "zh" ? `已用时 ${formatSlidesClock(totalSeconds)}` : `Elapsed ${formatSlidesClock(totalSeconds)}`;
}

function formatSlidesRemaining(totalSeconds) {
  return language === "zh" ? `预计剩余约 ${formatSlidesClock(totalSeconds)}` : `About ${formatSlidesClock(totalSeconds)} remaining`;
}

function attachRegenerateOverlays(deck) {
  const regen = slidesRegenerateStateByDeck.get(deck.id);
  if (!regen) return;
  const frame = slidesDeckRegenerateFrame(deck.id);
  if (!frame) return;
  const item = frame.querySelector(`[data-slide-index="${regen.slideIndex}"]`);
  if (!item) return;
  item.classList.toggle("is-regenerating", regen.status === "starting" || regen.status === "generating");
  item.classList.toggle("has-error", regen.status === "error");
  let badge = item.querySelector(".slides-deck-regen-badge");
  if ((regen.status === "starting" || regen.status === "generating") && !badge) {
    badge = document.createElement("span");
    badge.className = "slides-deck-regen-badge";
    badge.append(slidesIcon("sparkles"), document.createElement("b"));
    badge.querySelector("b").textContent = language === "zh" ? "生成中" : "Generating";
    item.append(badge);
  }
  if (badge && regen.status === "error") badge.remove();
  let cancelBtn = item.querySelector(".slides-deck-regen-cancel");
  if ((regen.status === "starting" || regen.status === "generating") && !cancelBtn) {
    cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "slides-deck-regen-cancel";
    cancelBtn.setAttribute("aria-label", language === "zh" ? "取消重新生成" : "Cancel regeneration");
    cancelBtn.title = cancelBtn.getAttribute("aria-label");
    cancelBtn.append(slidesIcon("close"));
    cancelBtn.onclick = () => cancelInlineRegenerate(deck);
    item.append(cancelBtn);
  }
  if (cancelBtn && regen.status === "error") cancelBtn.remove();
  let retryBtn = item.querySelector(".slides-deck-regen-retry");
  if (regen.status === "error" && !retryBtn) {
    retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "slides-deck-regen-retry";
    retryBtn.append(slidesIcon("refresh"), document.createTextNode(language === "zh" ? "重试" : "Retry"));
    retryBtn.onclick = () => {
      slidesRegenerateStateByDeck.delete(deck.id);
      item.classList.remove("has-error", "is-regenerating");
      retryBtn.remove();
      const slide = slidesForDeck(deck)[regen.slideIndex];
      if (slide) startInlineRegenerate(deck, slide, regen.slideIndex, item);
    };
    item.append(retryBtn);
  }
  if (retryBtn && regen.status !== "error") retryBtn.remove();
}

function reattachRegenerateState(frame, deck) {
  if (!frame) return;
  frame.dataset.slidesDeckFrame = deck.id;
  const regen = slidesRegenerateStateByDeck.get(deck.id);
  if (!regen) return;
  if (regen.status === "confirm") {
    // 重新挂载到 body，避免画布 world 的 transform 影响 fixed 定位
    regen._scrim?.remove();
    const scrim = buildRegeneratePopover(deck, regen, frame);
    document.body.append(scrim);
    regen._scrim = scrim;
  } else {
    attachRegenerateOverlays(deck);
  }
}

function swapRegeneratedSlideDOM(deck, newSlide) {
  if (!newSlide) return;
  const regen = slidesRegenerateStateByDeck.get(deck.id);
  if (!regen) return;
  const frame = slidesDeckRegenerateFrame(deck.id);
  if (!frame) return;
  const item = frame.querySelector(`[data-slide-index="${regen.slideIndex}"]`);
  if (item) {
    const thumb = item.querySelector(".slides-deck-thumbnail");
    if (thumb) thumb.replaceChildren(createSlidesMedia(newSlide, `${language === "zh" ? "第" : "Slide "}${regen.slideIndex + 1}${language === "zh" ? " 页预览" : " preview"}`, true));
    item.classList.remove("is-regenerating", "has-error");
    item.querySelector(".slides-deck-regen-badge")?.remove();
    item.querySelector(".slides-deck-regen-cancel")?.remove();
    item.querySelector(".slides-deck-regen-retry")?.remove();
    item.classList.add("is-just-updated");
    window.setTimeout(() => item.classList.remove("is-just-updated"), 1300);
  }
}

async function cancelInlineRegenerate(deck) {
  const regen = slidesRegenerateStateByDeck.get(deck.id);
  if (!regen || !regen.jobId || !regen.pollToken) return;
  const confirmed = await showConfirmDialog({
    title: language === "zh" ? "取消重新生成？" : "Cancel regeneration?",
    message: language === "zh" ? "当前页将保留原内容，已生成的部分会被丢弃。" : "The current slide will keep its original content; any in-progress work will be discarded.",
    confirmText: language === "zh" ? "取消生成" : "Cancel generation",
    cancelText: language === "zh" ? "继续等待" : "Keep generating",
    danger: true
  });
  if (!confirmed) return;
  const jobId = regen.jobId;
  regen.pollToken = {};
  try { await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(jobId)}`), { method: "DELETE" }); } catch {}
  regen.status = "cancelled";
  regen.jobId = null;
  const frame = slidesDeckRegenerateFrame(deck.id);
  const item = frame?.querySelector(`[data-slide-index="${regen.slideIndex}"]`);
  item?.classList.remove("is-regenerating");
  item?.querySelector(".slides-deck-regen-badge")?.remove();
  item?.querySelector(".slides-deck-regen-cancel")?.remove();
  showToast(language === "zh" ? "已取消重新生成" : "Regeneration cancelled");
  window.setTimeout(() => {
    if (slidesRegenerateStateByDeck.get(deck.id) === regen) slidesRegenerateStateByDeck.delete(deck.id);
  }, 200);
}

function startInlineRegenerate(deck, slide, index, anchorEl = null) {
  const regen = buildRegenerateState(deck, slide, index);
  slidesRegenerateStateByDeck.set(deck.id, regen);
  const frame = slidesDeckRegenerateFrame(deck.id);
  if (!frame) return;
  const scrim = buildRegeneratePopover(deck, regen, anchorEl);
  // 挂到 document.body，避免画布 world 的 transform 让 fixed 定位失效
  document.body.append(scrim);
  regen._scrim = scrim;
}

function readSlidesGenerationHistory(deckId) {
  try {
    const saved = JSON.parse(localStorage.getItem(slidesHistoryStorageKey) || "{}");
    return Array.isArray(saved[deckId]) ? saved[deckId] : [];
  } catch { return []; }
}

function writeSlidesGenerationHistory(deckId, records) {
  try {
    const saved = JSON.parse(localStorage.getItem(slidesHistoryStorageKey) || "{}");
    saved[deckId] = records.slice(0, 50).map((record, index) => index < 5 ? { ...record, full:true } : { id:record.id, title:record.title, topic:record.topic, pageCount:record.pageCount, style:record.style, createdAt:record.createdAt, full:false });
    localStorage.setItem(slidesHistoryStorageKey, JSON.stringify(saved));
  } catch {}
}

function saveSlidesGenerationHistory(deck, draft, outline, job) {
  const slideIds = (job?.imported || []).map((item) => item?.id).filter(Boolean);
  const record = {
    id:job?.id || `slides-history-${Date.now()}`,
    title:outline?.title || draft?.brief?.topic || slidesDeckDisplayName(deck),
    topic:draft?.brief?.topic || draft?.topic || "",
    pageCount:outline?.slides?.length || slideIds.length,
    style:outline?.style || draft?.brief?.style || "",
    createdAt:job?.completedAt || new Date().toISOString(),
    slideIds,
    outline:structuredClone(outline || null),
    brief:structuredClone(draft?.brief || null),
    full:true
  };
  const records = readSlidesGenerationHistory(deck.id).filter((item) => item.id !== record.id);
  writeSlidesGenerationHistory(deck.id, [record, ...records]);
}

loadPersistedSlidesDrafts();
persistSlidesDrafts();
let workflowSelectionObjectId = null;
let workflowSelectionObjectIds = [];
let workflowSelectionGrouped = false;
let workflowSelectionBounds = null;
let workflowSelectionExport = null;
let isolatedLayerSelectionId = null;
let activeTool = defaultCanvasTool;
let spacePanPressed = false;
let activeColor = loadToolColor();
let editingTextId = null;
let language = loadLanguage();
let drag = null;
let resize = null;
let drawing = null;
let annotationDraft = null;
let editingAnnotationId = null;
let lastAnnotationPointerDown = null;
let marquee = null;
let cropSession = null;
let cropDrag = null;
let viewport = { x: 0, y: 0, zoom: 0.72 };

// Default properties for image objects
const DEFAULT_IMAGE_SOURCE = "upload";
const DEFAULT_EXPORT_RESOLUTION = "1k";
const DEFAULT_EXPORT_FORMAT = "png";
const SUPPORTED_EXPORT_RESOLUTIONS = ["1k", "2k", "4k"];
const SUPPORTED_EXPORT_FORMATS = ["jpeg", "png"];

let imageEditState = { mode: "idle", objectId: null, viewport: null };
let pan = null;
let viewportSaveTimer = null;
let quickEditObjectId = null;
let quickEditAction = null;
let quickEditAnnotationSessionId = null;
let activeTextRecognitionId = null;
let editTextItems = [];
let expandConfig = { scale: "1", preset: "general", ratio: "original", frame: null, sourceStart: null };
const runningJobs = new Map();
let searchTimer = null;
let searchRequestId = 0;
let searchResults = [];
let promptHistoryUi = null;
let layerBrowserUi = null;
let jobCenterUi = null;
let jobCenterJobs = [];
let jobCenterRequestId = 0;
const collapsedLayerGroupIds = new Set();
let promptHistoryFetchToken = 0;
let versionBrowserFetchToken = 0;
let promptHistorySearchTimer = null;
let promptHistoryMode = "prompts";
let versionBrowserGroups = [];
let versionDiffOverlay = null;
let versionDiffHeatmapToken = 0;
let appUpdateInfo = null;
let appUpdateBusy = false;
const composerImageActions = new Set(["quick-edit", "expand", "edit-text"]);
const immediateImageJobActions = new Set(["remove-bg", "edit-elements"]);
const generationTaskActions = new Set([
  "generate", "compose", "quick-edit", "remove-bg", "expand", "edit-elements", "edit-text"
]);
const quickEditMarkupTools = new Set(["annotation", "pencil", "text"]);
const groupSelectionActions = new Set(["reset-layer-group", "layer-up", "layer-down", "group-layer-group"]);
const multiLayoutActions = new Set(["align-left", "align-center", "align-right", "align-top", "align-middle", "align-bottom", "distribute-horizontal", "distribute-vertical", "tidy-grid"]);
const maxUndoStackSize = 50;
const canvasHistory = new CanvasHistory({
  maxSize: maxUndoStackSize,
  onChange: renderCanvasHistoryStatus
});
let canvasScope = null;
const singleSelectionActions = new Set([
  ...composerImageActions,
  ...immediateImageJobActions,
  "crop",
  "send-to-chat",
  "copy-file-mention",
  "toggle-resolution",
  "download"
]);

// 当前选中的导出分辨率倍率："1x" 原始分辨率 | "2x" 像素提升
let exportResolutionScale = "1x";

initLayerBrowserUi();
initJobCenterUi();
initPromptHistoryUi();
applyLanguage();
setActiveTool(defaultCanvasTool);
renderCanvasHistoryStatus();
renderColorPalette();
await loadProjects();
await loadState();
refreshAppUpdateStatus({ checkRemote: true }).catch(() => {});
// DEV: polling slowed from 2000ms to 30000ms for UI editing; restore to 2000 before release
setInterval(loadState, 30000);
setInterval(() => {
  renderJobCenter();
  refreshJobCenter().catch(() => {});
}, 1000);

window.addEventListener("codex-canvas:layers-materialized", async (event) => {
  const ids = Array.isArray(event.detail?.ids) ? event.detail.ids.filter(Boolean) : [];
  if (!ids.length) return;
  await loadState();
  const availableIds = ids.filter((id) => state.objects.some((object) => object.id === id && !object.hidden));
  if (!availableIds.length) return;
  setLocalSelection(availableIds, { fromUser: true });
  render();
  const objects = state.objects.filter((object) => availableIds.includes(object.id));
  frameWorldBounds(boundsForObjects(objects), {
    paddingX: 100,
    paddingTop: 104,
    paddingBottom: 148,
    maxZoom: 1
  });
});

window.addEventListener("codex-canvas:workflow-result-selected", async (event) => {
  const objectIds = Array.isArray(event.detail?.objectIds)
    ? [...new Set(event.detail.objectIds.map(String).filter(Boolean))]
    : [String(event.detail?.objectId || "").trim()].filter(Boolean);
  const objectId = objectIds.length === 1 ? objectIds[0] : null;
  const bounds = event.detail?.bounds;
  if (!objectIds.length) {
    workflowSelectionObjectId = null;
    workflowSelectionObjectIds = [];
    workflowSelectionGrouped = false;
    workflowSelectionBounds = null;
    workflowSelectionExport = null;
    if ([...selectedIds].some((id) => state?.objects.find((item) => item.id === id)?.hidden)) {
      setLocalSelection([], { fromUser: false });
      hideSelectionToolbar();
    }
    return;
  }
  if (objectIds.some((id) => !state?.objects.some((item) => item.id === id && (item.type || "image") === "image"))) {
    await loadState();
  }
  const availableIds = objectIds.filter((id) => state?.objects.some((item) => item.id === id && (item.type || "image") === "image"));
  if (!availableIds.length) return;
  setLocalSelection(availableIds, { fromUser: true });
  workflowSelectionObjectId = objectId;
  workflowSelectionObjectIds = availableIds;
  workflowSelectionGrouped = event.detail?.grouped === true;
  workflowSelectionBounds = bounds && [bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)
    ? bounds
    : null;
  workflowSelectionExport = {
    resolution: ["1k", "2k", "4k"].includes(event.detail?.exportResolution) ? event.detail.exportResolution : "1k",
    format: ["jpeg", "png"].includes(event.detail?.exportFormat) ? event.detail.exportFormat : "png"
  };
  updateSelectionUi();
  fetch(apiPath("/api/selection"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selection: objectId })
  }).catch(() => {});
});

window.addEventListener("codex-canvas:workflow-export-options", (event) => {
  if (!workflowSelectionObjectId || event.detail?.objectId !== workflowSelectionObjectId) return;
  workflowSelectionExport = {
    resolution: ["1k", "2k", "4k"].includes(event.detail?.exportResolution) ? event.detail.exportResolution : "1k",
    format: ["jpeg", "png"].includes(event.detail?.exportFormat) ? event.detail.exportFormat : "png"
  };
});

window.addEventListener("codex-canvas:object-updated", (event) => {
  const objectId = event.detail?.objectId;
  if (!objectId) return;
  
  // Update local state with new properties
  const object = state?.objects.find((obj) => obj.id === objectId);
  if (object) {
    if (event.detail?.source) object.source = event.detail.source;
    if (event.detail?.exportResolution) object.exportResolution = event.detail.exportResolution;
    if (event.detail?.exportFormat) object.exportFormat = event.detail.exportFormat;
    render();
  }
});

window.addEventListener("codex-canvas:workflow-edit-mode", (event) => {
  if (event.detail?.active) {
    beginImageEdit(event.detail?.mode || "edit", event.detail?.objectId || null);
    hideSelectionToolbar();
  } else {
    endImageEdit();
    updateSelectionUi();
  }
});

window.addEventListener("codex-canvas:materialized-image-action", async (event) => {
  const action = String(event.detail?.action || "");
  const objectId = String(event.detail?.objectId || "");
  if (!["crop", "edit-elements", "edit-text"].includes(action) || !objectId) return;
  await loadState();
  const object = state?.objects?.find((item) => (
    item.id === objectId && (item.type || "image") === "image" && !item.hidden
  ));
  if (!object) {
    showToast(t("jobFailed"));
    return;
  }
  setLocalSelection([object.id], { fromUser: true });
  render();
  if (action === "crop") {
    startCropMode();
    return;
  }
  if (action === "edit-text") {
    openImageActionComposer("edit-text");
    return;
  }
  startImageJob("edit-elements");
});

projectTitle.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    projectTitle.blur();
  }
  if (event.key === "Escape") {
    projectTitle.value = state?.title || "Untitled";
    projectTitle.blur();
  }
});

projectTitle.addEventListener("blur", saveProjectTitle);

projectOptionsButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleProjectMenu();
});

settingsButton.addEventListener("click", (event) => {
  event.stopPropagation();
  closeCanvasSearch({ keepQuery: true });
  closePromptHistoryPanel();
  closeLayerBrowserPanel();
  closeJobCenterPanel();
  settingsMenu.hidden = !settingsMenu.hidden;
  if (settingsMenu.hidden) {
    settingsMenu.classList.remove("language-open");
  }
});

settingsMenu.addEventListener("click", (event) => {
  const languageRow = event.target.closest("[data-settings-row='language']");
  if (languageRow) {
    event.stopPropagation();
    settingsMenu.classList.toggle("language-open");
    languageRow.classList.toggle("active", settingsMenu.classList.contains("language-open"));
    return;
  }

  const button = event.target.closest("[data-language]");
  if (!button) return;
  event.stopPropagation();
  setLanguage(button.dataset.language);
});

appUpdateButton?.addEventListener("click", (event) => {
  event.preventDefault();
  if (appUpdateBusy) return;
  if (appUpdateInfo?.canUpdate && appUpdateInfo?.updateAvailable) {
    runAppUpdate();
  } else {
    refreshAppUpdateStatus({ checkRemote: true, showToastOnError: true });
  }
});

toolDock.addEventListener("click", (event) => {
  const historyButton = event.target.closest("[data-history-action]");
  if (historyButton) {
    event.preventDefault();
    runCanvasHistoryAction(historyButton.dataset.historyAction);
    return;
  }
  const button = event.target.closest("[data-tool]");
  if (!button) return;
  event.preventDefault();
  setActiveTool(button.dataset.tool);
  if (event.detail > 0) board.focus({ preventScroll: true });
});

imageUploadInput.addEventListener("change", () => {
  const files = [...imageUploadInput.files].filter(isUploadImageCandidate);
  imageUploadInput.value = "";
  if (!files.length) return;
  uploadImageFiles(files);
});

document.addEventListener("paste", async (event) => {
  if (isShortcutEditingTarget(event.target)) return;
  const files = clipboardImageFiles(event.clipboardData);
  if (!files.length) return;
  event.preventDefault();
  await uploadImageFiles(files, { prompt: "Pasted from clipboard" });
});

colorPalette.addEventListener("click", (event) => {
  const button = event.target.closest("[data-color]");
  if (!button) return;
  event.preventDefault();
  setActiveColor(button.dataset.color);
});

quickEditColorPalette?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-color]");
  if (!button) return;
  event.preventDefault();
  setActiveColor(button.dataset.color);
});

quickEditMarkupControls?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick-edit-tool]");
  if (!button) return;
  event.preventDefault();
  setActiveTool(button.dataset.quickEditTool);
});

canvasSearch.input.addEventListener("input", scheduleCanvasSearch);
canvasSearch.type.addEventListener("change", runCanvasSearch);
canvasSearch.input.addEventListener("focus", () => {
  settingsMenu.hidden = true;
  projectMenu.hidden = true;
  closePromptHistoryPanel();
  closeLayerBrowserPanel();
  closeJobCenterPanel();
  canvasSearch.panel.classList.add("active");
  if (canvasSearch.input.value.trim() || searchResults.length) {
    renderCanvasSearchResults(searchResults);
  }
});
canvasSearch.input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeCanvasSearch();
    return;
  }
  if (event.key === "Enter") {
    const firstResult = canvasSearch.results.querySelector("[data-search-result-id]");
    if (!firstResult) return;
    event.preventDefault();
    focusSearchResult(firstResult.dataset.searchResultId);
  }
});
canvasSearch.results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-search-result-id]");
  if (!button) return;
  event.preventDefault();
  focusSearchResult(button.dataset.searchResultId);
});

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view-action]");
  if (viewButton) {
    event.stopPropagation();
    event.preventDefault();
    if (viewButton.dataset.viewAction === "reset") {
      resetViewport();
      return;
    }
    if (viewButton.dataset.viewAction === "fit-all") {
      fitAllObjects();
      return;
    }
    if (viewButton.dataset.viewAction === "zoom-in") {
      zoomViewport(1.2);
      return;
    }
    if (viewButton.dataset.viewAction === "zoom-out") {
      zoomViewport(1 / 1.2);
      return;
    }
    if (viewButton.dataset.viewAction === "toggle-map") {
      toggleCanvasMap();
      return;
    }
    if (viewButton.dataset.viewAction === "upload") {
      if (viewButton.dataset.workflowOpen === "studio") return;
      imageUploadInput.click();
      return;
    }
    if (viewButton.dataset.viewAction === "add-slides") { toggleSlidesWorkspace(); return; }
  }

  // Handle export control buttons (resolution/format)
  const exportBtn = event.target.closest(".export-control-btn");
  if (exportBtn && toolbar.contains(exportBtn)) {
    event.stopPropagation();
    const controlGroup = exportBtn.closest(".export-control-group");
    const controlType = controlGroup?.dataset.exportControl;
    const value = exportBtn.dataset.exportValue;
    if (controlType === "resolution" && SUPPORTED_EXPORT_RESOLUTIONS.includes(value)) {
      // Get current format from the other group
      const formatGroup = toolbar.querySelector('[data-export-control="format"]');
      const activeFormatBtn = formatGroup?.querySelector(".export-control-btn.active");
      const currentFormat = activeFormatBtn?.dataset.exportValue || DEFAULT_EXPORT_FORMAT;
      updateObjectExportSettings(value, currentFormat);
    } else if (controlType === "format" && SUPPORTED_EXPORT_FORMATS.includes(value)) {
      // Get current resolution from the other group
      const resolutionGroup = toolbar.querySelector('[data-export-control="resolution"]');
      const activeResolutionBtn = resolutionGroup?.querySelector(".export-control-btn.active");
      const currentResolution = activeResolutionBtn?.dataset.exportValue || DEFAULT_EXPORT_RESOLUTION;
      updateObjectExportSettings(currentResolution, value);
    }
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action) {
    event.stopPropagation();
    if (delegateWorkflowToolbarAction(action)) return;
    // 分辨率切换需要在 updateSelectionUi() 之前处理，避免被重置为 1x
    if (action === "toggle-resolution") {
      toggleExportResolution();
      return;
    }
    if (action === "edit-page") {
      const object = state.objects.find((item) => item.id === selectedId && ["html", "slide-frame"].includes(item.type));
      if (object?.type === "slide-frame") openSlideFrameEditor(object);
      else if (object) openHtmlPageEditor(object);
      return;
    }
    updateSelectionUi();
    if (composerImageActions.has(action)) {
      openImageActionComposer(action);
      return;
    }
    if (action === "crop") {
      startCropMode();
      return;
    }
    if (immediateImageJobActions.has(action)) {
      startImageJob(action);
      return;
    }
    if (action === "download") {
      downloadSelectedImage();
      return;
    }
    if (action === "reference-generate") {
      openReferenceGenerationForSelection();
      return;
    }
    if (action === "reset-layer-group") {
      resetSelectedLayerGroup();
      return;
    }
    if (action === "layer-up" || action === "layer-down") {
      moveSelectedLayerInGroup(action === "layer-up" ? "up" : "down");
      return;
    }
    if (action === "group-layer-group") {
      toggleSelectedImageGroup();
      return;
    }
    if (multiLayoutActions.has(action)) {
      arrangeSelectedObjects(action);
      return;
    }
    if (action === "send-to-chat") {
      sendSelectedImageToChat();
      return;
    }
    if (action === "copy-file-mention") {
      copySelectedFileMention();
      return;
    }
    // Text toolbar actions
    if (action === "text-bold" || action === "text-italic" || action === "text-underline") {
      handleTextStyleToggle(action);
      return;
    }
    if (action === "text-color") {
      toggleTextToolbarDropdown("color-palette");
      return;
    }
    if (action === "text-font-family") {
      toggleTextToolbarDropdown("font-family");
      return;
    }
    if (action === "text-font-size") {
      toggleTextToolbarDropdown("font-size");
      return;
    }
    if (action === "text-align") {
      toggleTextToolbarDropdown("align");
      return;
    }
    if (action === "text-lock") {
      toggleTextLock();
      return;
    }
    if (action === "text-delete") {
      deleteSelectedObject();
      return;
    }
    showToast(labelAction(action));
  }
});

// Text toolbar action handlers
function handleTextStyleToggle(action) {
  const object = state.objects.find((obj) => obj.id === selectedId);
  if (!object || object.type !== "text") return;

  if (action === "text-bold") {
    const currentWeight = parseInt(object.fontWeight || "400", 10);
    const newWeight = currentWeight >= 600 ? "400" : "700";
    updateTextObjectProperty(object.id, { fontWeight: newWeight });
  } else if (action === "text-italic") {
    const newStyle = object.fontStyle === "italic" ? "normal" : "italic";
    updateTextObjectProperty(object.id, { fontStyle: newStyle });
  } else if (action === "text-underline") {
    const newDeco = object.textDecoration === "underline" ? "none" : "underline";
    updateTextObjectProperty(object.id, { textDecoration: newDeco });
  }
}

function toggleTextToolbarDropdown(kind) {
  if (!textToolbar) return;
  const selector = kind === "color-palette"
    ? ".text-color-palette"
    : `[data-dropdown="${kind}"]`;
  const target = textToolbar.querySelector(selector);
  if (!target) return;
  const wasHidden = target.hidden;
  closeTextToolbarDropdowns();
  if (wasHidden) target.hidden = false;
}

function toggleTextLock() {
  const object = state.objects.find((obj) => obj.id === selectedId);
  if (!object || object.type !== "text") return;
  const newLocked = !object.locked;
  object.locked = newLocked;
  updateObjectOnServer(object.id, { locked: newLocked });
  updateTextToolbarState(object);
  showToast(newLocked ? "已锁定" : "已解锁");
}

// Text toolbar dropdown event delegation
textToolbar?.addEventListener("click", (event) => {
  // Color swatch click
  const swatch = event.target.closest(".text-color-swatch");
  if (swatch) {
    event.stopPropagation();
    const object = state.objects.find((obj) => obj.id === selectedId);
    if (object && object.type === "text") {
      updateTextObjectProperty(object.id, { color: swatch.dataset.color });
    }
    closeTextToolbarDropdowns();
    return;
  }

  // Custom color picker - just stop propagation
  if (event.target.closest("#textColorCustom")) {
    event.stopPropagation();
    return;
  }

  // Font family dropdown item
  const fontItem = event.target.closest('[data-font]');
  if (fontItem) {
    event.stopPropagation();
    const object = state.objects.find((obj) => obj.id === selectedId);
    if (object && object.type === "text") {
      updateTextObjectProperty(object.id, { fontFamily: fontItem.dataset.font });
    }
    closeTextToolbarDropdowns();
    return;
  }

  // Font size dropdown item
  const sizeItem = event.target.closest('[data-size]');
  if (sizeItem) {
    event.stopPropagation();
    const object = state.objects.find((obj) => obj.id === selectedId);
    if (object && object.type === "text") {
      updateTextObjectProperty(object.id, { fontSize: parseInt(sizeItem.dataset.size, 10) });
    }
    closeTextToolbarDropdowns();
    return;
  }

  // Font size custom input
  const sizeCustom = event.target.closest("#textSizeCustom");
  if (sizeCustom) {
    event.stopPropagation();
    return;
  }

  // Alignment dropdown item
  const alignItem = event.target.closest('[data-align]');
  if (alignItem) {
    event.stopPropagation();
    const object = state.objects.find((obj) => obj.id === selectedId);
    if (object && object.type === "text") {
      updateTextObjectProperty(object.id, { textAlign: alignItem.dataset.align });
    }
    closeTextToolbarDropdowns();
    return;
  }
});

// Custom color picker input
const textColorCustom = textToolbar?.querySelector("#textColorCustom");
textColorCustom?.addEventListener("input", (event) => {
  const object = state.objects.find((obj) => obj.id === selectedId);
  if (object && object.type === "text") {
    updateTextObjectProperty(object.id, { color: event.target.value });
  }
});

// Custom font size input
const textSizeCustomInput = textToolbar?.querySelector("#textSizeCustom");
textSizeCustomInput?.addEventListener("change", (event) => {
  const val = parseInt(event.target.value, 10);
  if (val >= 6 && val <= 160) {
    const object = state.objects.find((obj) => obj.id === selectedId);
    if (object && object.type === "text") {
      updateTextObjectProperty(object.id, { fontSize: val });
    }
  }
  closeTextToolbarDropdowns();
});

// Close text toolbar dropdowns when clicking outside
document.addEventListener("click", (event) => {
  if (!textToolbar || textToolbar.hidden) return;
  if (event.target.closest(".text-toolbar")) return;
  closeTextToolbarDropdowns();
});

// Prevent pointer events on text toolbar from reaching canvas
textToolbar?.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});

function delegateWorkflowToolbarAction(action) {
  const selectedImage = selectedImageDescriptor();
  if (selectedImage?.surface !== "workflow") return false;
  if (!["remove-bg", "crop", "edit-elements", "edit-text"].includes(action)) return false;
  const detail = {
    action,
    objectId: selectedImage.objectId,
    handled: false
  };
  window.dispatchEvent(new CustomEvent("codex-canvas:workflow-toolbar-action", { detail }));
  return detail.handled === true;
}

function selectedImageDescriptor() {
  if (selectedIds.size > 1) return null;
  const objectId = selectedId || workflowSelectionObjectId || null;
  const object = state?.objects?.find((item) => item.id === objectId && (item.type || "image") === "image");
  if (!object) return null;
  const workflowBounds = workflowResultScreenBounds(object.id);
  return {
    objectId: object.id,
    object,
    surface: workflowBounds ? "workflow" : "canvas",
    screenBounds: workflowBounds
  };
}

function beginImageEdit(mode, objectId = null) {
  if (imageEditState.mode === "idle") {
    imageEditState.viewport = { ...viewport };
  }
  imageEditState.mode = mode || "edit";
  imageEditState.objectId = objectId || selectedId || workflowSelectionObjectId || null;
  toolDock.hidden = true;
  updateColorPalette();
}

function endImageEdit() {
  const savedViewport = imageEditState.viewport;
  imageEditState = { mode: "idle", objectId: null, viewport: null };
  toolDock.hidden = false;
  updateColorPalette();
  if (!savedViewport) return;
  viewport = { ...savedViewport };
  applyViewport();
  scheduleViewportSave();
}

function activeWorkflowResultObjectId() {
  if (workflowSelectionObjectIds.length === 1 && workflowSelectionObjectId) {
    return workflowSelectionObjectId;
  }
  const object = state?.objects?.find((item) => item.id === selectedId);
  if (!object?.hidden) return null;
  const selector = `.result-node.selected[data-workflow-object-id="${CSS.escape(object.id)}"]`;
  return document.querySelector(selector) ? object.id : null;
}

function workflowResultScreenBounds(objectId) {
  if (!objectId) return null;
  if (workflowSelectionObjectId === objectId && workflowSelectionBounds) return workflowSelectionBounds;
  const selector = `.result-node.selected[data-workflow-object-id="${CSS.escape(objectId)}"]`;
  const element = document.querySelector(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  return {
    left: rect.left - boardRect.left,
    top: rect.top - boardRect.top,
    right: rect.right - boardRect.left,
    bottom: rect.bottom - boardRect.top
  };
}

document.addEventListener("keydown", async (event) => {
  if (event.key === "Escape" && cropSession) {
    cancelCropSession(event);
    return;
  }
  if (event.key === "Enter" && cropSession && !isShortcutEditingTarget(event.target)) {
    applyCropSession(event);
    return;
  }
  if (event.key === "Escape" && quickEditObjectId) {
    event.preventDefault();
    closeQuickEdit({ keepPrompt: true });
    updateSelectionUi();
    return;
  }
  if (event.key === "Escape" && layerBrowserUi && !layerBrowserUi.panel.hidden) {
    event.preventDefault();
    closeLayerBrowserPanel();
    return;
  }
  if (event.key === "Escape" && !isShortcutEditingTarget(event.target) && (selectedIds.size || selectedId)) {
    event.preventDefault();
    closeQuickEdit({ keepPrompt: true });
    setLocalSelection([]);
    render();
    fetch(apiPath("/api/selection"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selection: null })
    }).catch(() => {});
    return;
  }
  const historyDirection = canvasHistoryShortcut(event);
  if (historyDirection) {
    if (isNativeUndoTarget(event.target)) return;
    event.preventDefault();
    runCanvasHistoryAction(historyDirection);
    return;
  }
  if (event.code === "Space" && !isShortcutEditingTarget(event.target)) {
    event.preventDefault();
    setSpacePanPressed(true);
    return;
  }
  if (["Backspace", "Delete"].includes(event.key)) {
    if (isDeleteEditingTarget(event.target)) return;
    if (!selectedIds.size && !selectedId && slidesWorkspaceOpen && activeSlidesDeckId && !slidesGeneratorOpenByDeck.has(activeSlidesDeckId)) {
      const deck = state.objects.find((item) => item.id === activeSlidesDeckId && item.type === "slides");
      const slides = slidesForDeck(deck);
      const index = Math.min(activeSlideIndexByDeck.get(activeSlidesDeckId) || 0, Math.max(0, slides.length - 1));
      const slide = slides[index];
      if (slide) {
        event.preventDefault();
        await removeSlideFromDeck(deck, slide);
        return;
      }
    }
    if (!selectedIds.size && !selectedId) return;
    event.preventDefault();
    // 如果选中的是 slides 面板中的幻灯片，只解除关联，不删除画布对象
    if (slidesWorkspaceOpen && activeSlidesDeckId) {
      const deck = state.objects.find((item) => item.id === activeSlidesDeckId && item.type === "slides");
      const selected = state.objects.find((item) => selectedIds.has(item.id) || item.id === selectedId);
      if (deck && selected && selected.slideDeckId === deck.id) {
        await removeSlideFromDeck(deck, selected);
        return;
      }
    }
    deleteSelectedObject();
    return;
  }
  if (!selectedIds.size && !selectedId) return;
  if (isShortcutEditingTarget(event.target)) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
    event.preventDefault();
    toggleSelectedImageGroup({ ungroup: event.shiftKey });
    return;
  }
  if (event.key === "Enter") {
    if (selectedIds.size > 1) return;
    const object = state.objects.find((item) => item.id === selectedId);
    if (!object) return;
    if (object.type === "annotation") {
      event.preventDefault();
      editingAnnotationId = object.id;
      render();
      focusAnnotationLabel(object.id);
      return;
    }
    if ((object.type || "image") !== "image") return;
    event.preventDefault();
    frameSelectedImageForViewing(object);
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code === "Space") setSpacePanPressed(false);
});

window.addEventListener("blur", () => setSpacePanPressed(false));

board.addEventListener("pointerdown", (event) => {
  if (!shouldStartPan(event) || isCanvasPanBlockedTarget(event.target)) return;
  startPan(event);
}, { capture: true });

board.addEventListener("contextmenu", (event) => {
  if (isCanvasPanBlockedTarget(event.target)) return;
  event.preventDefault();
});

board.addEventListener("pointerdown", (event) => {
  if (event.target === board || event.target === world || event.target === objectLayer) {
    if (event.button !== 0 || event.isPrimary === false) return;
    if (activeTool === "pencil") {
      startDrawing(event);
      return;
    }
    if (activeTool === "annotation") {
      startAnnotation(event);
      return;
    }
    if (activeTool === "text") {
      createTextObject(event);
      return;
    }
    startMarqueeSelection(event);
  }
});

document.addEventListener("pointerdown", (event) => {
  const isSettingsEvent = event.target.closest("#settingsMenu, #settingsButton");
  const isPromptHistoryEvent = event.target.closest(".prompt-history-panel, .prompt-history-button");
  const isLayerBrowserEvent = event.target.closest(".layer-browser-panel, .layer-browser-button");
  const isJobCenterEvent = event.target.closest(".job-center-panel, .job-center-button");
  const isCanvasSearchEvent = event.target.closest(".canvas-search");
  if (!isSettingsEvent) {
    settingsMenu.hidden = true;
    settingsMenu.classList.remove("language-open");
    settingsMenu.querySelector("[data-settings-row='language']")?.classList.remove("active");
  }
  if (!isPromptHistoryEvent) {
    closePromptHistoryPanel();
  }
  if (!isLayerBrowserEvent) {
    closeLayerBrowserPanel();
  }
  if (!isJobCenterEvent) {
    closeJobCenterPanel();
  }
  if (!isCanvasSearchEvent) {
    closeCanvasSearch({ keepQuery: true });
  }
  if (!event.target.closest("#projectMenu, .project-header button")) {
    projectMenu.hidden = true;
  }
  if (isSettingsEvent || isPromptHistoryEvent || isLayerBrowserEvent || isJobCenterEvent || isCanvasSearchEvent) return;
  if (!quickEditObjectId && !selectedId && selectedIds.size === 0) return;
  if (event.target.closest(".canvas-object, .result-node, .selection-toolbar, .text-toolbar, .quick-edit-composer, .color-palette, .tool-dock, .prompt-history-panel, .prompt-history-button, .layer-browser-panel, .layer-browser-button, .job-center-panel, .job-center-button, .canvas-search")) return;
  closeQuickEdit({ keepPrompt: true });
  selectObject(null);
});

quickEditComposer.addEventListener("submit", (event) => {
  event.preventDefault();
  submitQuickEdit();
});

quickEditPrompt.addEventListener("input", updateQuickEditRunState);

quickEditCancel.addEventListener("click", () => {
  closeQuickEdit();
  updateSelectionUi();
});

expandScale?.addEventListener("change", () => {
  expandConfig.scale = expandScale.value || "1";
  expandConfig.frame = null;
  updateExpandPreview();
});

expandPreset?.addEventListener("change", () => {
  expandConfig.preset = expandPreset.value || "general";
});

expandRatios?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-expand-ratio]");
  if (!button) return;
  expandConfig.ratio = button.dataset.expandRatio || "original";
  expandConfig.frame = null;
  updateExpandRatioButtons();
  updateExpandPreview();
});

quickEditPrompt.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeQuickEdit();
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    submitQuickEdit();
  }
});

board.addEventListener("wheel", (event) => {
  if (shouldUseNativeWheel(event.target)) return;
  event.preventDefault();
  const delta = normalizedWheelDelta(event);
  if (event.ctrlKey || event.altKey) {
    const rect = board.getBoundingClientRect();
    const before = screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    const zoomDelta = clamp(delta.y, -maxWheelZoomDelta, maxWheelZoomDelta);
    const factor = Math.exp(-zoomDelta * zoomWheelSensitivity);
    viewport.zoom = clamp(viewport.zoom * factor, 0.12, 2.2);
    viewport.x = event.clientX - rect.left - before.x * viewport.zoom;
    viewport.y = event.clientY - rect.top - before.y * viewport.zoom;
  } else {
    viewport.x -= delta.x;
    viewport.y -= delta.y;
  }
  applyViewport();
  updateSelectionUi();
  scheduleViewportSave();
}, { passive: false });

function createLayerStackIcon(className) {
  return createSvgIcon(className, [
    "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
    "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",
    "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
  ]);
}

function initJobCenterUi() {
  if (!boardShell) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "job-center-button";
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = `
    <svg class="job-center-button-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14"></path>
      <path d="M5 12h10"></path>
      <path d="M5 17h7"></path>
      <circle cx="18" cy="17" r="3"></circle>
    </svg>
    <span class="job-center-count" hidden></span>
  `;

  const panel = document.createElement("section");
  panel.className = "job-center-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="job-center-header">
      <div>
        <strong class="job-center-title"></strong>
        <span class="job-center-summary"></span>
      </div>
    </div>
    <div class="job-center-list" role="list"></div>
    <button class="job-center-cancel-all" type="button"></button>
    <div class="job-center-live sr-only" aria-live="polite"></div>
  `;

  jobCenterUi = {
    button,
    panel,
    count: button.querySelector(".job-center-count"),
    title: panel.querySelector(".job-center-title"),
    summary: panel.querySelector(".job-center-summary"),
    cancelAll: panel.querySelector(".job-center-cancel-all"),
    list: panel.querySelector(".job-center-list"),
    live: panel.querySelector(".job-center-live")
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleJobCenterPanel();
  });
  panel.addEventListener("click", (event) => {
    const cancel = event.target.closest("[data-job-cancel]");
    if (cancel) {
      event.preventDefault();
      cancelJob(cancel.dataset.jobCancel);
      return;
    }
    const remove = event.target.closest("[data-job-delete]");
    if (remove) {
      event.preventDefault();
      deleteJob(remove.dataset.jobDelete);
    }
  });
  jobCenterUi.cancelAll.addEventListener("click", (event) => {
    event.preventDefault();
    cancelAllJobs();
  });

  boardShell.append(button, panel);
  updateJobCenterLabels();
  refreshJobCenter().catch(() => {});
}

function toggleJobCenterPanel() {
  if (!jobCenterUi) return;
  const nextOpen = jobCenterUi.panel.hidden;
  if (!nextOpen) {
    closeJobCenterPanel();
    return;
  }
  settingsMenu.hidden = true;
  projectMenu.hidden = true;
  closeCanvasSearch({ keepQuery: true });
  closePromptHistoryPanel();
  closeLayerBrowserPanel();
  jobCenterUi.panel.hidden = false;
  jobCenterUi.button.classList.add("active");
  jobCenterUi.button.setAttribute("aria-expanded", "true");
  renderJobCenter();
  refreshJobCenter().catch(() => {});
}

function closeJobCenterPanel() {
  if (!jobCenterUi || jobCenterUi.panel.hidden) return;
  jobCenterUi.panel.hidden = true;
  jobCenterUi.button.classList.remove("active");
  jobCenterUi.button.setAttribute("aria-expanded", "false");
}

async function refreshJobCenter() {
  const requestId = ++jobCenterRequestId;
  const response = await fetch(apiPath("/api/jobs?limit=50"));
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || t("jobCenterUnknownError"));
  if (requestId !== jobCenterRequestId) return;
  const previous = new Map(jobCenterJobs.map((job) => [job.id, job.status]));
  jobCenterJobs = (Array.isArray(payload.jobs) ? payload.jobs : []).filter(isGenerationTask);
  for (const job of jobCenterJobs) {
    const before = previous.get(job.id);
    if (before && before !== job.status && ["done", "failed", "cancelled"].includes(job.status)) {
      jobCenterUi.live.textContent = `${jobActionLabel(job.action, job)} ${jobStatusLabel(job.status)}`;
    }
  }
  renderJobCenter();
}

function renderJobCenter() {
  if (!jobCenterUi) return;
  const active = jobCenterJobs.filter(isActiveJob);
  jobCenterUi.count.hidden = active.length === 0;
  jobCenterUi.count.textContent = active.length > 9 ? "9+" : String(active.length);
  jobCenterUi.button.classList.toggle("has-running", active.length > 0);
  jobCenterUi.summary.textContent = active.length
    ? `${active.length} ${t("jobCenterRunning")}`
    : `${jobCenterJobs.length} ${t("jobCenterSummary")}`;
  jobCenterUi.cancelAll.hidden = active.length === 0;
  jobCenterUi.cancelAll.disabled = active.length === 0;
  if (jobCenterUi.panel.hidden) return;

  jobCenterUi.list.replaceChildren();
  if (!jobCenterJobs.length) {
    const empty = document.createElement("div");
    empty.className = "job-center-empty";
    empty.textContent = t("jobCenterEmpty");
    jobCenterUi.list.append(empty);
    return;
  }
  for (const job of jobCenterJobs) {
    jobCenterUi.list.append(renderJobCenterItem(job));
  }
}

function renderJobCenterItem(job) {
  const item = document.createElement("article");
  item.className = `job-center-item status-${job.status || "queued"}`;
  item.setAttribute("role", "listitem");

  const icon = document.createElement("span");
  icon.className = "job-center-item-icon";
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <circle cx="9" cy="9" r="2"></circle>
      <path d="m21 15-5-5L5 21"></path>
    </svg>
  `;
  const body = document.createElement("div");
  body.className = "job-center-item-body";
  const title = document.createElement("div");
  title.className = "job-center-item-title";
  const name = document.createElement("strong");
  name.textContent = jobActionLabel(job.action, job);
  const duration = document.createElement("span");
  duration.textContent = formatJobDuration(job);
  title.append(name, duration);
  const meta = document.createElement("div");
  meta.className = "job-center-item-meta";
  const status = document.createElement("span");
  status.className = "job-center-status";
  status.textContent = jobProgressLabel(job);
  meta.append(status);
  body.append(title, meta);
  if (job.error) {
    const error = document.createElement("p");
    error.className = "job-center-error";
    error.textContent = job.error;
    body.append(error);
  }
  item.append(icon, body);

  if (isActiveJob(job)) {
    const spinner = document.createElement("span");
    spinner.className = "job-center-spinner";
    spinner.setAttribute("aria-hidden", "true");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "job-center-cancel";
    cancel.dataset.jobCancel = job.id;
    cancel.title = t("jobCenterCancel");
    cancel.setAttribute("aria-label", `${t("jobCenterCancel")}：${jobActionLabel(job.action, job)}`);
    cancel.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 6 6 18"></path>
        <path d="m6 6 12 12"></path>
      </svg>
    `;
    item.append(spinner, cancel);
  } else {
    const mark = document.createElement("span");
    mark.className = "job-center-state-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = job.status === "done" ? "✓" : job.status === "cancelled" ? "—" : "!";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "job-center-delete";
    remove.dataset.jobDelete = job.id;
    remove.title = t("jobCenterDelete");
    remove.setAttribute("aria-label", `${t("jobCenterDelete")}：${jobActionLabel(job.action, job)}`);
    remove.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"></path>
        <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"></path>
      </svg>
    `;
    item.append(mark, remove);
  }
  return item;
}

async function cancelJob(jobId) {
  const job = jobCenterJobs.find((item) => item.id === jobId);
  if (!job || !isActiveJob(job)) return;
  try {
    const response = await fetch(apiPath(`/api/jobs/${encodeURIComponent(jobId)}`), { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t("jobCenterUnknownError"));
    jobCenterJobs = jobCenterJobs.map((item) => item.id === jobId ? payload : item);
    window.clearTimeout(runningJobs.get(jobId));
    runningJobs.delete(jobId);
    renderJobCenter();
    await loadState();
  } catch (error) {
    showToast(error?.message || t("jobCenterUnknownError"));
    refreshJobCenter().catch(() => {});
  }
}

async function cancelAllJobs() {
  const activeJobs = jobCenterJobs.filter(isActiveJob);
  if (!activeJobs.length) return;
  try {
    const cancelledJobs = await Promise.all(activeJobs.map(async (job) => {
      const response = await fetch(apiPath(`/api/jobs/${encodeURIComponent(job.id)}`), { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || t("jobCenterUnknownError"));
      return payload;
    }));
    for (const job of cancelledJobs) {
      window.clearTimeout(runningJobs.get(job.id));
      runningJobs.delete(job.id);
    }
    await refreshJobCenter();
    await loadState();
  } catch (error) {
    showToast(error?.message || t("jobCenterUnknownError"));
  }
}

async function deleteJob(jobId) {
  const job = jobCenterJobs.find((item) => item.id === jobId);
  if (!job || isActiveJob(job)) return;
  try {
    const response = await fetch(apiPath(`/api/jobs/${encodeURIComponent(jobId)}`), { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t("jobCenterUnknownError"));
    jobCenterJobs = jobCenterJobs.filter((item) => item.id !== jobId);
    renderJobCenter();
    showToast(t("jobCenterDeleted"));
  } catch (error) {
    showToast(error?.message || t("jobCenterUnknownError"));
    refreshJobCenter().catch(() => {});
  }
}

function isActiveJob(job) {
  return ["queued", "running"].includes(job?.status) || job?.backgroundCompletionRunning === true;
}

function isGenerationTask(job) {
  return job?.taskKind === "generation" || generationTaskActions.has(job?.action);
}

function jobActionLabel(action, job = null) {
  if (action === "generate" || action === "compose") return t("jobCenterImage");
  return translations[language]?.actionNames?.[action]
    || translations.en.actionNames[action]
    || action
    || t("jobCenterImage");
}

function jobStatusLabel(status) {
  if (status === "queued") return t("jobCenterQueued");
  if (status === "running") return t("jobCenterRunning");
  if (status === "done") return t("jobCenterSuccess");
  if (status === "cancelled") return t("jobCenterCancelled");
  return t("jobCenterError");
}

function jobProgressLabel(job) {
  if (job?.action === "remove-bg" && job?.removeBgBackend === "imagegen-regenerate" && isActiveJob(job)) {
    return t("jobCenterFineCutout");
  }
  return jobStatusLabel(job?.backgroundCompletionRunning ? "running" : job?.status);
}

function formatJobDuration(job) {
  const start = Date.parse(job.startedAt || job.createdAt || "");
  const completed = Date.parse(job.completedAt || "");
  const elapsed = !isActiveJob(job) && Number.isFinite(job.durationMs)
    ? job.durationMs
    : Number.isFinite(start)
      ? Math.max(0, (Number.isFinite(completed) ? completed : Date.now()) - start)
      : 0;
  const totalSeconds = Math.max(0, Math.floor(elapsed / 1000));
  return formatSlidesClock(totalSeconds);
}

function updateJobCenterLabels() {
  if (!jobCenterUi) return;
  const label = t("jobCenter");
  jobCenterUi.button.title = label;
  jobCenterUi.button.dataset.tooltip = label;
  jobCenterUi.button.setAttribute("aria-label", label);
  jobCenterUi.panel.setAttribute("aria-label", label);
  jobCenterUi.title.textContent = label;
  jobCenterUi.cancelAll.textContent = t("jobCenterCancelAll");
  renderJobCenter();
}

function initLayerBrowserUi() {
  if (!boardShell) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "layer-browser-button";
  button.append(createLayerStackIcon("layer-browser-button-icon"));
  button.setAttribute("aria-expanded", "false");

  const panel = document.createElement("section");
  panel.className = "layer-browser-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="layer-browser-header">
      <div class="layer-browser-heading">
        <div class="layer-browser-title"></div>
        <div class="layer-browser-summary"></div>
      </div>
      <button class="layer-browser-fit" type="button"></button>
    </div>
    <div class="layer-browser-list"></div>
  `;

  layerBrowserUi = {
    button,
    panel,
    title: panel.querySelector(".layer-browser-title"),
    summary: panel.querySelector(".layer-browser-summary"),
    fit: panel.querySelector(".layer-browser-fit"),
    list: panel.querySelector(".layer-browser-list")
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleLayerBrowserPanel();
  });

  layerBrowserUi.fit.addEventListener("click", (event) => {
    event.preventDefault();
    fitLayerBrowserObjects();
  });

  panel.addEventListener("click", (event) => {
    const groupToggle = event.target.closest("[data-layer-group-toggle]");
    if (groupToggle) {
      event.preventDefault();
      toggleLayerBrowserGroup(groupToggle.dataset.layerGroupToggle);
      return;
    }

    const objectButton = event.target.closest("[data-layer-object-id]");
    if (!objectButton) return;
    event.preventDefault();
    focusLayerBrowserObject(objectButton.dataset.layerObjectId);
  });

  boardShell.append(button, panel);
  updateLayerBrowserLabels();
}

function toggleLayerBrowserPanel() {
  if (!layerBrowserUi) return;
  const nextOpen = layerBrowserUi.panel.hidden;
  if (!nextOpen) {
    closeLayerBrowserPanel();
    return;
  }
  settingsMenu.hidden = true;
  projectMenu.hidden = true;
  closeCanvasSearch({ keepQuery: true });
  closePromptHistoryPanel();
  closeJobCenterPanel();
  layerBrowserUi.panel.hidden = false;
  layerBrowserUi.button.classList.add("active");
  layerBrowserUi.button.setAttribute("aria-expanded", "true");
  renderLayerBrowserPanel();
}

function closeLayerBrowserPanel() {
  if (!layerBrowserUi || layerBrowserUi.panel.hidden) return;
  layerBrowserUi.panel.hidden = true;
  layerBrowserUi.button.classList.remove("active");
  layerBrowserUi.button.setAttribute("aria-expanded", "false");
}

function renderLayerBrowserPanel() {
  if (!layerBrowserUi || !state) return;
  const images = state.objects.filter(
    (object) => !object.hidden && (object.type || "image") === "image",
  );
  const standaloneCount = images.filter((object) => !object.layerGroupId).length;
  const layerCount = images.length - standaloneCount;
  layerBrowserUi.summary.textContent = `${standaloneCount} ${t("layerBrowserImages")} · ${layerCount} ${t("layerBrowserLayers")}`;
  layerBrowserUi.fit.disabled = images.length === 0;
  if (layerBrowserUi.panel.hidden) return;

  const scrollTop = layerBrowserUi.list.scrollTop;
  layerBrowserUi.list.replaceChildren();
  if (!images.length) {
    const empty = document.createElement("div");
    empty.className = "layer-browser-empty";
    empty.textContent = t("layerBrowserEmpty");
    layerBrowserUi.list.append(empty);
    return;
  }

  const entries = layerBrowserEntries(images);
  const visibleGroupIds = new Set(entries.filter((entry) => entry.type === "group").map((entry) => entry.groupId));
  for (const groupId of [...collapsedLayerGroupIds]) {
    if (!visibleGroupIds.has(groupId)) collapsedLayerGroupIds.delete(groupId);
  }

  for (const entry of entries.filter((item) => item.type === "group")) {
    layerBrowserUi.list.append(renderLayerBrowserGroup(entry));
  }
  const standaloneImages = entries
    .filter((entry) => entry.type === "image")
    .map((entry) => entry.object);
  for (const image of standaloneImages) {
    layerBrowserUi.list.append(renderLayerBrowserObjectRow(image));
  }
  layerBrowserUi.list.scrollTop = scrollTop;
  updateLayerBrowserSelection();
}

function layerBrowserEntries(images) {
  const entries = [];
  const seenGroups = new Set();
  for (const object of [...images].reverse()) {
    if (!object.layerGroupId) {
      entries.push({ type: "image", object });
      continue;
    }
    if (seenGroups.has(object.layerGroupId)) continue;
    seenGroups.add(object.layerGroupId);
    entries.push({
      type: "group",
      groupId: object.layerGroupId,
      members: [...layerGroupMembers(object.layerGroupId)].reverse()
    });
  }
  return entries;
}

function renderLayerBrowserGroup(entry) {
  const collapsed = collapsedLayerGroupIds.has(entry.groupId);
  const section = document.createElement("section");
  section.className = "layer-browser-group";
  section.dataset.layerGroupId = entry.groupId;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "layer-browser-group-toggle";
  toggle.dataset.layerGroupToggle = entry.groupId;
  toggle.setAttribute("aria-expanded", String(!collapsed));

  const chevron = createSvgIcon("layer-browser-chevron", ["M9 6l6 6l-6 6"]);
  toggle.append(chevron, createLayerStackIcon("layer-browser-group-icon"));

  const body = document.createElement("span");
  body.className = "layer-browser-group-body";
  const title = document.createElement("span");
  title.className = "layer-browser-group-title";
  title.textContent = layerGroupLabel(entry.groupId);
  const meta = document.createElement("span");
  meta.className = "layer-browser-group-meta";
  meta.textContent = `${entry.members.length} ${t("layerBrowserLayers")}${isLayerGroupLocked(entry.groupId) ? ` · ${t("layerBrowserGrouped")}` : ""}`;
  body.append(title, meta);

  const count = document.createElement("span");
  count.className = "layer-browser-group-count";
  count.textContent = String(entry.members.length);
  toggle.append(body, count);
  section.append(toggle);

  if (!collapsed) {
    const children = document.createElement("div");
    children.className = "layer-browser-group-children";
    for (const member of entry.members) {
      children.append(renderLayerBrowserObjectRow(member, { nested: true, compact: true }));
    }
    section.append(children);
  }
  return section;
}

function renderLayerBrowserObjectRow(object, { nested = false, compact = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `layer-browser-object${nested ? " nested" : ""}${compact ? " compact" : ""}`;
  button.dataset.layerObjectId = object.id;

  const thumbnail = document.createElement("span");
  thumbnail.className = "layer-browser-thumbnail";
  if (object.src) {
    const image = document.createElement("img");
    image.src = assetUrl(object.src, object);
    image.alt = "";
    image.loading = "lazy";
    image.draggable = false;
    thumbnail.append(image);
  }

  const body = document.createElement("span");
  body.className = "layer-browser-object-body";
  const title = document.createElement("span");
  title.className = "layer-browser-object-title";
  title.textContent = object.name || t(nested ? "layerBrowserLayer" : "layerBrowserImage");
  const meta = document.createElement("span");
  meta.className = "layer-browser-object-meta";
  const kind = nested
    ? t(object.layerGroupKind === "background" ? "layerBrowserBackground" : "layerBrowserLayer")
    : t("layerBrowserImage");
  meta.textContent = `${kind} · ${imageSizeLabel(object)}`;
  body.append(title, meta);

  const accessibleLabel = `${title.textContent} — ${meta.textContent}`;
  button.title = accessibleLabel;
  button.setAttribute("aria-label", accessibleLabel);

  button.append(thumbnail, body);
  return button;
}

function toggleLayerBrowserGroup(groupId) {
  if (!groupId) return;
  if (collapsedLayerGroupIds.has(groupId)) collapsedLayerGroupIds.delete(groupId);
  else collapsedLayerGroupIds.add(groupId);
  renderLayerBrowserPanel();
}

async function focusLayerBrowserObject(id) {
  const object = state?.objects.find((item) => item.id === id && (item.type || "image") === "image");
  if (!object) return;
  closeQuickEdit({ keepPrompt: true });
  await selectObject(id, { fromUser: true }).catch(() => {});
  frameCanvasObject(object);
  updateLayerBrowserSelection();
}

function fitLayerBrowserObjects() {
  const images = state?.objects.filter(
    (object) => !object.hidden && (object.type || "image") === "image",
  ) || [];
  if (!images.length) return;
  frameWorldBounds(boundsForObjects(images), {
    paddingX: 96,
    paddingTop: 88,
    paddingBottom: 104,
    minZoom: 0.12,
    maxZoom: 0.95
  });
}

function updateLayerBrowserSelection() {
  if (!layerBrowserUi || layerBrowserUi.panel.hidden) return;
  const ids = selectedObjectIds();
  const selectedGroupId = selectedObjectLayerGroupId();
  layerBrowserUi.list.querySelectorAll("[data-layer-object-id]").forEach((button) => {
    button.classList.toggle("selected", ids.has(button.dataset.layerObjectId));
  });
  layerBrowserUi.list.querySelectorAll("[data-layer-group-id]").forEach((section) => {
    section.classList.toggle("selected", section.dataset.layerGroupId === selectedGroupId);
  });
}

function updateLayerBrowserLabels() {
  if (!layerBrowserUi) return;
  const label = t("layerBrowser");
  layerBrowserUi.button.title = label;
  layerBrowserUi.button.dataset.tooltip = label;
  layerBrowserUi.button.setAttribute("aria-label", label);
  layerBrowserUi.panel.setAttribute("aria-label", label);
  layerBrowserUi.title.textContent = label;
  layerBrowserUi.fit.textContent = t("layerBrowserFit");
  renderLayerBrowserPanel();
}

function initPromptHistoryUi() {
  if (!boardShell) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "prompt-history-button";
  button.innerHTML = `
    <svg class="prompt-history-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3 -6.7L3 8"></path>
      <path d="M3 3v5h5"></path>
      <path d="M12 7v5l4 2"></path>
    </svg>
  `;

  const panel = document.createElement("section");
  panel.className = "prompt-history-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="prompt-history-header">
      <div class="prompt-history-title"></div>
    </div>
    <div class="prompt-history-tabs" role="tablist">
      <button type="button" data-discovery-mode="prompts"></button>
      <button type="button" data-discovery-mode="versions"></button>
    </div>
    <label class="prompt-history-search">
      <svg class="prompt-history-search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21 -4.3 -4.3"></path>
      </svg>
      <input type="search" autocomplete="off" spellcheck="false" />
    </label>
    <label class="version-group-select">
      <span></span>
      <select>
        <option value="sourceObjectId"></option>
        <option value="batchId"></option>
        <option value="layoutMode"></option>
        <option value="prompt"></option>
      </select>
    </label>
    <div class="prompt-history-list" role="listbox"></div>
    <div class="prompt-history-status"></div>
  `;

  promptHistoryUi = {
    button,
    panel,
    title: panel.querySelector(".prompt-history-title"),
    tabs: [...panel.querySelectorAll("[data-discovery-mode]")],
    search: panel.querySelector("input"),
    groupBy: panel.querySelector(".version-group-select select"),
    groupByLabel: panel.querySelector(".version-group-select span"),
    groupByWrap: panel.querySelector(".version-group-select"),
    list: panel.querySelector(".prompt-history-list"),
    status: panel.querySelector(".prompt-history-status")
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePromptHistoryPanel();
  });

  promptHistoryUi.search.addEventListener("input", () => {
    window.clearTimeout(promptHistorySearchTimer);
    promptHistorySearchTimer = window.setTimeout(() => fetchDiscoveryPanel(), 180);
  });

  promptHistoryUi.search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePromptHistoryPanel();
    }
  });

  promptHistoryUi.groupBy.addEventListener("change", () => fetchVersionGroups());

  panel.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-discovery-mode]");
    if (tab) {
      event.preventDefault();
      setDiscoveryMode(tab.dataset.discoveryMode);
      return;
    }

    const annotate = event.target.closest("[data-version-group-overlay-index]");
    if (annotate) {
      event.preventDefault();
      annotateVersionGroup(Number(annotate.dataset.versionGroupOverlayIndex));
      return;
    }

    const compare = event.target.closest("[data-version-group-index]");
    if (compare) {
      event.preventDefault();
      compareVersionGroup(Number(compare.dataset.versionGroupIndex));
      return;
    }

    const versionObject = event.target.closest("[data-version-object-id]");
    if (versionObject) {
      event.preventDefault();
      closePromptHistoryPanel();
      focusSearchResult(versionObject.dataset.versionObjectId);
      return;
    }

    const item = event.target.closest("[data-prompt]");
    if (!item) return;
    event.preventDefault();
    applyPromptFromHistory(item.dataset.prompt || "");
  });

  boardShell.append(button, panel);
  updatePromptHistoryLabels();
}

function togglePromptHistoryPanel() {
  if (!promptHistoryUi) return;
  const nextOpen = promptHistoryUi.panel.hidden;
  if (nextOpen) {
    settingsMenu.hidden = true;
    projectMenu.hidden = true;
    closeLayerBrowserPanel();
    closeJobCenterPanel();
    promptHistoryUi.panel.hidden = false;
    promptHistoryUi.button.classList.add("active");
    fetchDiscoveryPanel();
    window.requestAnimationFrame(() => promptHistoryUi.search.focus());
  } else {
    closePromptHistoryPanel();
  }
}

function closePromptHistoryPanel() {
  if (!promptHistoryUi || promptHistoryUi.panel.hidden) return;
  promptHistoryUi.panel.hidden = true;
  promptHistoryUi.button.classList.remove("active");
}

function setDiscoveryMode(mode) {
  const nextMode = mode === "versions" ? "versions" : "prompts";
  if (promptHistoryMode === nextMode) return;
  promptHistoryMode = nextMode;
  promptHistoryUi.search.value = "";
  updatePromptHistoryLabels();
  fetchDiscoveryPanel();
  window.requestAnimationFrame(() => promptHistoryUi.search.focus());
}

function fetchDiscoveryPanel() {
  if (promptHistoryMode === "versions") return fetchVersionGroups();
  return fetchPromptHistory();
}

async function fetchPromptHistory() {
  if (!promptHistoryUi || promptHistoryUi.panel.hidden) return;
  const token = ++promptHistoryFetchToken;
  versionBrowserFetchToken += 1;
  const query = promptHistoryUi.search.value.trim();
  renderPromptHistoryStatus(t("promptHistoryLoading"));
  promptHistoryUi.list.replaceChildren();

  try {
    const url = new URL(apiPath("/api/prompts"), window.location.origin);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "20");
    const response = await fetch(`${url.pathname}${url.search}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t("promptHistoryFailed"));
    if (token !== promptHistoryFetchToken) return;
    renderPromptHistoryItems(Array.isArray(payload.prompts) ? payload.prompts : []);
  } catch (error) {
    if (token !== promptHistoryFetchToken) return;
    renderPromptHistoryStatus(error?.message || t("promptHistoryFailed"));
  }
}

async function fetchVersionGroups() {
  if (!promptHistoryUi || promptHistoryUi.panel.hidden) return;
  const token = ++versionBrowserFetchToken;
  promptHistoryFetchToken += 1;
  const query = promptHistoryUi.search.value.trim();
  renderPromptHistoryStatus(t("versionBrowserLoading"));
  promptHistoryUi.list.replaceChildren();

  try {
    const url = new URL(apiPath("/api/versions"), window.location.origin);
    url.searchParams.set("q", query);
    url.searchParams.set("groupBy", promptHistoryUi.groupBy.value || "sourceObjectId");
    url.searchParams.set("limit", "20");
    url.searchParams.set("objectLimit", "6");
    const response = await fetch(`${url.pathname}${url.search}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t("versionBrowserFailed"));
    if (token !== versionBrowserFetchToken) return;
    renderVersionGroups(Array.isArray(payload.groups) ? payload.groups : []);
  } catch (error) {
    if (token !== versionBrowserFetchToken) return;
    renderPromptHistoryStatus(error?.message || t("versionBrowserFailed"));
  }
}

function renderPromptHistoryItems(items) {
  promptHistoryUi.list.replaceChildren();
  if (!items.length) {
    renderPromptHistoryStatus(t("promptHistoryEmpty"));
    return;
  }
  promptHistoryUi.status.textContent = "";
  for (const item of items) {
    const prompt = String(item.prompt || "").trim();
    if (!prompt) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "prompt-history-item";
    button.dataset.prompt = prompt;
    button.setAttribute("role", "option");
    button.setAttribute("aria-label", prompt);

    const text = document.createElement("span");
    text.className = "prompt-history-text";
    text.textContent = prompt;
    button.append(text);

    const metaText = promptHistoryMeta(item);
    if (metaText) {
      const meta = document.createElement("span");
      meta.className = "prompt-history-meta";
      meta.textContent = metaText;
      button.append(meta);
    }
    promptHistoryUi.list.append(button);
  }
  if (!promptHistoryUi.list.children.length) {
    renderPromptHistoryStatus(t("promptHistoryEmpty"));
  }
}

function renderPromptHistoryStatus(message) {
  if (!promptHistoryUi) return;
  promptHistoryUi.status.textContent = message;
}

function renderVersionGroups(groups) {
  promptHistoryUi.list.replaceChildren();
  versionBrowserGroups = groups;
  if (!groups.length) {
    renderPromptHistoryStatus(t("versionBrowserEmpty"));
    return;
  }
  promptHistoryUi.status.textContent = "";

  for (const [index, group] of groups.entries()) {
    const section = document.createElement("section");
    section.className = "version-group";

    const header = document.createElement("div");
    header.className = "version-group-header";

    const title = document.createElement("span");
    title.className = "version-group-title";
    title.textContent = versionGroupTitle(group);
    header.append(title);

    const count = document.createElement("span");
    count.className = "version-group-count";
    count.textContent = `${group.count || 0} ${t("versionGroupCount")}`;
    header.append(count);

    const actions = document.createElement("div");
    actions.className = "version-group-actions";

    const compare = document.createElement("button");
    compare.type = "button";
    compare.className = "version-group-action version-group-compare";
    compare.dataset.versionGroupIndex = String(index);
    compare.textContent = t("versionGroupCompare");
    actions.append(compare);

    const annotate = document.createElement("button");
    annotate.type = "button";
    annotate.className = "version-group-action version-group-overlay";
    annotate.dataset.versionGroupOverlayIndex = String(index);
    annotate.textContent = t("versionGroupAnnotate");
    annotate.disabled = !(Array.isArray(group.objects) && group.objects.length >= 2);
    actions.append(annotate);
    header.append(actions);
    section.append(header);

    const objects = Array.isArray(group.objects) ? group.objects : [];
    for (const object of objects) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "version-group-object";
      button.dataset.versionObjectId = object.id;

      if (object.src) {
        const thumb = document.createElement("img");
        thumb.className = "version-group-thumb";
        thumb.src = assetUrl(object.src, object);
        thumb.alt = "";
        thumb.loading = "lazy";
        button.append(thumb);
      } else {
        button.classList.add("no-thumb");
      }

      const body = document.createElement("span");
      body.className = "version-group-object-body";

      const name = document.createElement("span");
      name.className = "version-group-object-name";
      name.textContent = object.name || object.prompt || object.id;
      body.append(name);

      const meta = document.createElement("span");
      meta.className = "version-group-object-meta";
      meta.textContent = versionObjectMeta(object);
      body.append(meta);

      button.append(body);
      section.append(button);
    }
    promptHistoryUi.list.append(section);
  }
}

function compareVersionGroup(index) {
  const objects = canvasObjectsForVersionGroup(index);
  if (!objects.length) return;

  versionDiffOverlay = null;
  closePromptHistoryPanel();
  closeQuickEdit({ keepPrompt: true });
  setLocalSelection(objects.map((object) => object.id), { fromUser: true });
  render();
  frameWorldBounds(boundsForObjects(objects), {
    paddingX: 96,
    paddingTop: 104,
    paddingBottom: 148,
    minZoom: 0.12,
    maxZoom: 1
  });
}

function annotateVersionGroup(index) {
  const objects = canvasObjectsForVersionGroup(index);
  if (objects.length < 2) return;

  closePromptHistoryPanel();
  closeQuickEdit({ keepPrompt: true });
  const ids = objects.map((object) => object.id);
  setLocalSelection(ids, { fromUser: true });
  versionDiffOverlay = { ids };
  render();
  frameWorldBounds(boundsForObjects(objects), {
    paddingX: 104,
    paddingTop: 112,
    paddingBottom: 156,
    minZoom: 0.12,
    maxZoom: 1
  });
}

function canvasObjectsForVersionGroup(index) {
  const group = versionBrowserGroups[index];
  const ids = (Array.isArray(group?.objects) ? group.objects : [])
    .map((object) => object.id)
    .filter(Boolean);
  return ids
    .map((id) => state?.objects.find((object) => object.id === id))
    .filter(Boolean);
}

function versionGroupTitle(group) {
  const value = String(group.value || "").trim();
  if (!value) return group.groupBy || "";
  if (value.length <= 72) return value;
  return `${value.slice(0, 69)}...`;
}

function versionObjectMeta(object) {
  const type = objectTypeLabel(object.type);
  const date = object.createdAt ? new Date(object.createdAt) : null;
  const dateText = date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString(language === "zh" ? "zh-CN" : "en", { month: "short", day: "numeric" })
    : "";
  return [type, object.layoutMode, object.batchId, dateText].filter(Boolean).join(" · ");
}

function promptHistoryMeta(item) {
  const summary = String(item.summaryPrompt || "").trim();
  const prompt = String(item.prompt || "").trim();
  const name = String(item.objectName || "").trim();
  const date = item.createdAt ? new Date(item.createdAt) : null;
  const dateText = date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString(language === "zh" ? "zh-CN" : "en", { month: "short", day: "numeric" })
    : "";
  return [summary && summary !== prompt ? summary : "", name, dateText].filter(Boolean).join(" · ");
}

function applyPromptFromHistory(prompt) {
  const nextPrompt = String(prompt || "").trim();
  if (!nextPrompt) return;
  closePromptHistoryPanel();

  if (!quickEditComposer.hidden && quickEditAction !== "edit-text" && !quickEditPrompt.hidden) {
    setQuickEditPromptValue(nextPrompt);
    return;
  }

  const object = state?.objects.find((item) => item.id === selectedId);
  if (object && (object.type || "image") === "image" && hasUserSelection && quickEditAction !== "edit-text") {
    openImageActionComposer("quick-edit");
    window.requestAnimationFrame(() => setQuickEditPromptValue(nextPrompt));
    return;
  }

  copyPromptToClipboard(nextPrompt);
}

function setQuickEditPromptValue(prompt) {
  quickEditPrompt.value = prompt;
  quickEditPrompt.focus();
  quickEditPrompt.setSelectionRange(quickEditPrompt.value.length, quickEditPrompt.value.length);
  showToast(t("promptHistoryApplied"));
}

async function copyPromptToClipboard(prompt) {
  try {
    await navigator.clipboard?.writeText(prompt);
    showToast(t("promptHistoryCopied"));
  } catch {
    showToast(prompt);
  }
}

async function loadState() {
  if (drag || resize || marquee || pan || drawing || annotationDraft || editingTextId || editingAnnotationId || canvasHistory.busy || isComposerActive()) return;
  const response = await fetch(apiPath("/api/state"));
  const nextState = await response.json();
  updateCanvasScope(nextState.canvasScope);
  const previousObjectIds = knownObjectIds;
  const addedObjects = previousObjectIds
    ? nextState.objects.filter((object) => !previousObjectIds.has(object.id))
    : [];
  const autoFocusObject = suppressNextAutoFocus ? null : autoFocusObjectForStateUpdate(nextState, addedObjects);
  suppressNextAutoFocus = false;

  // Normalize objects: ensure all image objects have default export properties
  for (const object of nextState.objects) {
    if ((object.type || "image") === "image") {
      object.source = object.source || DEFAULT_IMAGE_SOURCE;
      object.exportResolution = SUPPORTED_EXPORT_RESOLUTIONS.includes(object.exportResolution)
        ? object.exportResolution
        : DEFAULT_EXPORT_RESOLUTION;
      object.exportFormat = SUPPORTED_EXPORT_FORMATS.includes(object.exportFormat)
        ? object.exportFormat
        : DEFAULT_EXPORT_FORMAT;
    }
  }

  const nextStateSignature = JSON.stringify([
    nextState.title || "",
    nextState.viewport || null,
    nextState.objects || []
  ]);
  if (nextStateSignature === lastLoadedStateSignature) {
    suppressNextAutoFocus = false;
    return;
  }
  lastLoadedStateSignature = nextStateSignature;

  state = nextState;
  knownObjectIds = new Set(state.objects.map((object) => object.id));
  selectedIds = new Set([...selectedIds].filter((id) => state.objects.some((object) => object.id === id)));
  if (selectedId && !state.objects.some((object) => object.id === selectedId)) {
    selectedId = null;
  }
  if (autoFocusObject) {
    setLocalSelection([autoFocusObject.id], { fromUser: true });
  } else if (!hasUserSelection || (!selectedId && selectedIds.size === 0)) {
    selectedIds.clear();
    selectedId = null;
    hasUserSelection = false;
  }
  state.selection = selectedId;
  render();
  if (autoFocusObject) frameCanvasObject(autoFocusObject);
}

function autoFocusObjectForStateUpdate(nextState, addedObjects) {
  if (!Array.isArray(addedObjects) || addedObjects.length === 0) return null;
  const selectedNewObject = addedObjects.find((object) => object.id === nextState.selection);
  if (isAutoFocusableObject(selectedNewObject, nextState)) return selectedNewObject;
  return [...addedObjects].reverse().find((object) => isAutoFocusableObject(object, nextState)) || null;
}

function isAutoFocusableObject(object, nextState = state) {
  if (object?.hidden) return false;
  const type = object?.type || "image";
  if (type === "job") return false;
  if (type !== "image") return false;
  if (!object?.sourceObjectId) return true;
  const source = nextState?.objects?.find((item) => item.id === object.sourceObjectId);
  return !source?.hidden;
}

async function loadProjects() {
  const response = await fetch("/api/projects");
  const payload = await response.json();
  registeredProjects = Array.isArray(payload.projects) ? payload.projects : [];
  runtimeServerInfo = payload.server || null;
  if (!currentProjectId && registeredProjects.length > 0) {
    currentProjectId = registeredProjects[0].id;
    const url = new URL(window.location.href);
    url.searchParams.set("project", currentProjectId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }
  renderRuntimeIdentity();
  renderProjectMenu();
}

function renderRuntimeIdentity() {
  const server = runtimeServerInfo || {};
  const version = server.version || appUpdateInfo?.installedVersion || appUpdateInfo?.version || "...";
  const commit = String(server.commitHash || "").slice(0, 9);
  const dirty = server.dirty ? "+dirty" : "";
  if (appVersionValue) appVersionValue.textContent = `v${version}${commit ? ` · ${commit}${dirty}` : ""}`;
  const currentProject = registeredProjects.find((project) => project.id === currentProjectId);
  const workspaceVersion = currentProject?.workspaceVersion || null;
  const mismatch = Boolean(workspaceVersion && server.version && workspaceVersion !== server.version);
  if (runtimeMismatchBanner) {
    runtimeMismatchBanner.hidden = !mismatch;
    runtimeMismatchBanner.textContent = mismatch
      ? t("runtimeMismatch").replace("{workspace}", workspaceVersion).replace("{server}", server.version)
      : "";
  }
  const showDiagnostics = Boolean(server.development);
  if (appRuntimeDetails) appRuntimeDetails.hidden = !showDiagnostics;
  if (showDiagnostics && appRuntimeDiagnostics) {
    const startedAt = server.startedAt ? new Date(server.startedAt).toLocaleString(language === "zh" ? "zh-CN" : "en") : "—";
    appRuntimeDiagnostics.textContent = `PID ${server.pid || "—"} · :${server.port || window.location.port || "—"} · ${startedAt}`;
  }
  if (showDiagnostics && appRuntimeSource) appRuntimeSource.textContent = server.sourceRoot || "";
}

async function toggleProjectMenu() {
  if (!projectMenu) return;
  if (projectMenu.hidden) {
    closeLayerBrowserPanel();
    closePromptHistoryPanel();
    settingsMenu.hidden = true;
    await loadProjects().catch(() => {});
    projectMenu.hidden = false;
  } else {
    projectMenu.hidden = true;
  }
}

function renderProjectMenu() {
  if (!projectMenu) return;
  projectMenu.replaceChildren();

  const title = document.createElement("div");
  title.className = "project-menu-title";
  title.textContent = t("switchCanvas");
  projectMenu.append(title);

  for (const project of registeredProjects) {
    const item = document.createElement("div");
    item.className = "project-menu-item";
    item.dataset.projectId = project.id;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-menu-switch";
    if (project.id === currentProjectId) button.classList.add("active");

    const name = document.createElement("span");
    name.className = "project-menu-name";
    name.textContent = project.title || basename(project.projectDir) || project.id;
    button.append(name);

    const pathLabel = document.createElement("span");
    pathLabel.className = "project-menu-path";
    pathLabel.textContent = project.id === currentProjectId ? t("currentCanvas") : project.projectDir;
    button.append(pathLabel);

    button.addEventListener("click", () => switchProject(project));
    item.append(button);

    if (project.id !== currentProjectId) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "project-menu-delete";
      remove.title = t("projectDelete");
      remove.setAttribute("aria-label", `${t("projectDelete")}：${project.title || project.projectDir}`);
      remove.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"></path>
          <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"></path>
        </svg>
      `;
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteProjectFromMenu(project);
      });
      item.append(remove);
    }

    projectMenu.append(item);
  }
}

function switchProject(project) {
  const projectId = project?.id || "";
  if (!projectId || projectId === currentProjectId) {
    projectMenu.hidden = true;
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("project", projectId);
  if (project.chatThreadId) url.searchParams.set("threadId", project.chatThreadId);
  else url.searchParams.delete("threadId");
  window.location.href = `${url.pathname}${url.search}`;
}

async function deleteProjectFromMenu(project) {
  if (!project) return;
  const confirmed = await showConfirmDialog({
    title: t("projectDeleteConfirmTitle"),
    message: t("projectDeleteConfirmMessage"),
    confirmText: t("projectDeleteConfirmButton"),
    cancelText: t("cancel")
  });
  if (!confirmed) return;
  let response;
  try {
    response = await fetch("/api/projects", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id })
    });
  } catch {
    showToast(t("projectDeleteFailed"));
    return;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (payload.code === "last-canvas") showToast(t("projectDeleteBlockedLast"));
    else if (payload.code === "jobs-running") showToast(t("projectDeleteBlockedJobs"));
    else showToast(t("projectDeleteFailed"));
    return;
  }
  showToast(t("projectDeleted"));
  if (project.id === currentProjectId) {
    window.location.href = payload.url || `${window.location.pathname}`;
    return;
  }
  registeredProjects = registeredProjects.filter((item) => item.id !== project.id);
  renderProjectMenu();
}

// Custom confirm dialog (avoids window.confirm, which may be silently disabled in
// embedded hosts such as the Codex desktop app / TRAE webview).
function showConfirmDialog({ title, message, confirmText = "OK", cancelText = "Cancel", danger = true }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-dialog-backdrop";

    const dialog = document.createElement("div");
    dialog.className = "confirm-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");

    const titleEl = document.createElement("strong");
    titleEl.className = "confirm-dialog-title";
    titleEl.textContent = title;

    const messageEl = document.createElement("p");
    messageEl.className = "confirm-dialog-message";
    messageEl.textContent = message;

    const actions = document.createElement("div");
    actions.className = "confirm-dialog-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "confirm-dialog-cancel";
    cancelButton.textContent = cancelText;

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = `confirm-dialog-ok${danger ? " danger" : ""}`;
    confirmButton.textContent = confirmText;

    actions.append(cancelButton, confirmButton);
    dialog.append(titleEl, messageEl, actions);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const cleanup = (result) => {
      backdrop.remove();
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(false);
      }
    };
    cancelButton.addEventListener("click", () => cleanup(false));
    confirmButton.addEventListener("click", () => cleanup(true));
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) cleanup(false);
    });
    document.addEventListener("keydown", onKeydown);
    confirmButton.focus();
  });
}

function createCanvasSearchUi() {
  const panel = document.createElement("section");
  panel.className = "canvas-search";

  const inputWrap = document.createElement("div");
  inputWrap.className = "canvas-search-input-wrap";
  inputWrap.append(createSvgIcon("canvas-search-icon", [
    "M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0",
    "M21 21l-6 -6"
  ]));

  const input = document.createElement("input");
  input.type = "search";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.className = "canvas-search-input";
  inputWrap.append(input);

  const type = document.createElement("select");
  type.className = "canvas-search-type";
  for (const value of ["", "image", "text", "drawing", "annotation", "job"]) {
    const option = document.createElement("option");
    option.value = value;
    option.dataset.searchTypeOption = value || "all";
    type.append(option);
  }
  inputWrap.append(type);
  panel.append(inputWrap);

  const results = document.createElement("div");
  results.className = "canvas-search-results";
  results.hidden = true;
  panel.append(results);

  boardShell?.append(panel);
  return { panel, input, type, results };
}

function createSvgIcon(className, paths) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add(className);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function scheduleCanvasSearch() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(runCanvasSearch, searchDebounceMs);
}

async function runCanvasSearch() {
  window.clearTimeout(searchTimer);
  const query = canvasSearch.input.value.trim();
  const type = canvasSearch.type.value;
  const requestId = ++searchRequestId;
  canvasSearch.panel.classList.add("active");

  if (!query) {
    searchResults = [];
    renderCanvasSearchResults([]);
    return;
  }

  try {
    const url = new URL(apiPath("/api/search"), window.location.origin);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "12");
    if (type) url.searchParams.set("type", type);
    const response = await fetch(`${url.pathname}${url.search}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t("searchFailed"));
    if (requestId !== searchRequestId) return;
    searchResults = Array.isArray(payload.results) ? payload.results : [];
    renderCanvasSearchResults(searchResults);
  } catch (error) {
    if (requestId !== searchRequestId) return;
    searchResults = [];
    renderCanvasSearchMessage(error?.message || t("searchFailed"));
  }
}

function renderCanvasSearchResults(results) {
  canvasSearch.results.replaceChildren();
  canvasSearch.results.hidden = false;

  const query = canvasSearch.input.value.trim();
  if (!query) {
    renderCanvasSearchMessage(t("searchHint"));
    return;
  }
  if (!results.length) {
    renderCanvasSearchMessage(t("searchEmpty"));
    return;
  }

  for (const result of results) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "canvas-search-result";
    button.dataset.searchResultId = result.id;

    const title = document.createElement("span");
    title.className = "canvas-search-result-title";
    title.textContent = searchResultTitle(result);
    button.append(title);

    const meta = document.createElement("span");
    meta.className = "canvas-search-result-meta";
    meta.textContent = searchResultMeta(result);
    button.append(meta);

    const snippet = searchResultSnippet(result);
    if (snippet) {
      const detail = document.createElement("span");
      detail.className = "canvas-search-result-detail";
      detail.textContent = snippet;
      button.append(detail);
    }

    canvasSearch.results.append(button);
  }
}

function renderCanvasSearchMessage(message) {
  canvasSearch.results.replaceChildren();
  const element = document.createElement("div");
  element.className = "canvas-search-message";
  element.textContent = message;
  canvasSearch.results.append(element);
  canvasSearch.results.hidden = false;
}

async function focusSearchResult(id) {
  const result = searchResults.find((item) => item.id === id);
  let object = state?.objects.find((item) => item.id === id);
  if (!object) {
    await loadState();
    object = state?.objects.find((item) => item.id === id);
  }
  const target = object || result;
  if (!target) {
    showToast(t("searchEmpty"));
    return;
  }

  closeQuickEdit({ keepPrompt: true });
  await selectObject(id, { fromUser: true });
  frameCanvasObject(target);
  closeCanvasSearch({ keepQuery: true });
}

function frameCanvasObject(object) {
  const groupId = object.id ? selectedLayerGroupId() : null;
  const bounds = groupId ? layerGroupBounds(groupId) : boundsForSearchTarget(object);
  frameWorldBounds(bounds, {
    paddingX: 88,
    paddingTop: 104,
    paddingBottom: 148,
    minZoom: 0.16,
    maxZoom: 1.28
  });
}

function boundsForSearchTarget(object) {
  const geometry = canvasObjectGeometry(object);
  return {
    x: Number.isFinite(object.x) ? object.x : 0,
    y: Number.isFinite(object.y) ? object.y : 0,
    width: geometry.width,
    height: geometry.height
  };
}

function canvasObjectGeometry(object) {
  if (object?.type === "slide-frame") return { width:1024, height:576 };
  if (object?.type === "slides") return { width:1280, height:900 };
  return {
    width:Number.isFinite(object?.width) && object.width > 0 ? object.width : 1,
    height:Number.isFinite(object?.height) && object.height > 0 ? object.height : 1
  };
}

function closeCanvasSearch({ keepQuery = false } = {}) {
  window.clearTimeout(searchTimer);
  canvasSearch.panel.classList.remove("active");
  canvasSearch.results.hidden = true;
  if (!keepQuery) {
    canvasSearch.input.value = "";
    searchResults = [];
    canvasSearch.results.replaceChildren();
  }
}

function searchResultTitle(result) {
  return result.name || result.text || result.prompt || result.id || objectTypeLabel(result.type);
}

function searchResultMeta(result) {
  const type = objectTypeLabel(result.type);
  const fields = Array.isArray(result.matchFields) && result.matchFields.length
    ? result.matchFields.join(", ")
    : "id";
  return `${type} · ${fields}`;
}

function searchResultSnippet(result) {
  const values = [
    result.prompt,
    result.text,
    result.sourcePath,
    result.assetPath,
    result.layerGroupName,
    result.layerGroupKind,
    result.src
  ];
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function render() {
  if (document.activeElement !== projectTitle) {
    projectTitle.value = state.title || "Untitled";
  }
  const existingObjectElements = new Map(
    [...objectLayer.children]
      .filter((element) => element.matches(".canvas-object[data-id]"))
      .map((element) => [element.dataset.id, element])
  );
  for (const element of [...objectLayer.children]) {
    if (!element.matches(".canvas-object[data-id]")) element.remove();
  }
  emptyState.hidden = state.objects.length > 0;
  if (state.viewport && !render.hasLoadedViewport) {
    viewport = {
      x: Number.isFinite(state.viewport.x) ? state.viewport.x : 0,
      y: Number.isFinite(state.viewport.y) ? state.viewport.y : 0,
      zoom: Number.isFinite(state.viewport.zoom) ? state.viewport.zoom : 0.72
    };
    render.hasLoadedViewport = true;
  }
  applyViewport();

  const selectedGroupId = selectedLayerGroupId();
  const visibleSelection = selectedObjectIds();
  let previousCanvasObjectElement = null;
  for (const object of state.objects) {
    if (object.hidden) continue;
    const objectType = object.type || "image";
    const isSelectedObject = visibleSelection.has(object.id) && !selectedGroupId;
    const isSelectedGroupMember = selectedGroupId && object.layerGroupId === selectedGroupId;
    const isFillingBackground = object.layerGroupKind === "background" && object.layerGroupBackgroundStatus === "filling";
    const isCropActive = cropSession?.objectId === object.id;
    const existingElement = existingObjectElements.get(object.id);
    const renderSignature = canvasObjectRenderSignature(object, {
      isCropActive,
    });
    if (existingElement && canvasObjectRenderSignatures.get(object.id) === renderSignature) {
      updateCanvasObjectGeometry(existingElement, object);
      updateCanvasObjectSelectionChrome(existingElement, object, {
        isSelectedObject,
        isSelectedGroupMember,
        isFillingBackground,
        isCropActive,
        selectedGroupId
      });
      placeCanvasObjectElement(existingElement, previousCanvasObjectElement);
      previousCanvasObjectElement = existingElement;
      existingObjectElements.delete(object.id);
      continue;
    }

    const element = document.createElement("div");
    element.className = `canvas-object ${objectType}-object${object.hasAlpha ? " alpha-image-object" : ""}${isSelectedObject ? " selected" : ""}${isSelectedGroupMember ? " layer-group-member-selected" : ""}${isFillingBackground ? " layer-background-filling" : ""}${isCropActive ? " crop-active" : ""}`;
    element.style.left = `${object.x}px`;
    element.style.top = `${object.y}px`;
    const geometry = canvasObjectGeometry(object);
    element.style.width = `${geometry.width}px`;
    element.style.height = `${geometry.height}px`;
    element.dataset.id = object.id;
    if (object.type === "text") {
      element.dataset.autoWidth = object._autoWidth !== "false" ? "true" : "false";
    }
    if (object.type === "annotation") {
      element.style.setProperty("--annotation-color", object.color || defaultQuickEditMarkColor);
    }
    if ((object.type || "image") === "image" && !object.layerGroupId) {
      applyImageAnnotationMetadata(element, object);
    }

    if (object.type === "drawing") {
      element.append(renderDrawingObject(object));
    } else if (object.type === "text") {
      element.append(renderTextObject(object));
    } else if (object.type === "annotation") {
      element.append(renderAnnotationObject(object));
    } else if (object.type === "job") {
      element.append(renderJobObject(object));
    } else if (object.type === "slides") {
      element.append(renderSlidesObject(object));
    } else if (object.type === "slide-frame") {
      element.append(renderSlideFrameObject(object));
    } else if (object.type === "html") {
      element.append(renderHtmlObject(object));
    } else {
      element.append(renderImageObject(object));
    }

    if (object.id === selectedId && selectedIds.size <= 1 && hasUserSelection && !selectedGroupId) {
      const isImageType = (object.type || "image") === "image";
      const isTextType = object.type === "text";
      if (isImageType || isTextType) {
        if (isImageType) {
          const meta = document.createElement("div");
          meta.className = "object-meta";

          const size = document.createElement("span");
          size.className = "object-meta-size";
          size.textContent = `${Math.round(object.width)} × ${Math.round(object.height)}`;
          meta.append(size);

          element.append(meta);
        }
        element.append(renderResizeHandles(object));
        if (isImageType && cropSession?.objectId === object.id) {
          element.append(renderCropOverlay(object));
        }
      }
    }

    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.isPrimary === false || activeTool === "hand") return;
      if (activeTool === "pencil") {
        startDrawing(event);
        return;
      }
      if (activeTool === "annotation") {
        startAnnotation(event);
        return;
      }
      if (activeTool === "text") {
        createTextObject(event);
        return;
      }
      const textTarget = event.target.closest(".text-content");
      if (object.type === "text" && editingTextId === object.id && textTarget) {
        if (event.detail >= 2) return;
        textTarget.blur();
        editingTextId = null;
      }
      if (object.type === "annotation" && event.target.closest(".annotation-label")) {
        event.stopPropagation();
        return;
      }
      if ((object.type || "image") === "image" && event.detail >= 2) {
        event.preventDefault();
        event.stopPropagation();
        if (object.layerGroupId && isLayerGroupLocked(object.layerGroupId)) {
          setLocalSelection([object.id], { fromUser: true, isolateLayer: true });
          render();
        } else {
          setLocalSelection([object.id]);
          frameSelectedImageForViewing(object);
        }
        fetch(apiPath("/api/selection"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ selection: object.id })
        }).catch(() => {});
        return;
      }
      startDrag(event, object);
    });
    canvasObjectRenderSignatures.set(object.id, renderSignature);
    if (existingElement) existingElement.replaceWith(element);
    placeCanvasObjectElement(element, previousCanvasObjectElement);
    previousCanvasObjectElement = element;
    existingObjectElements.delete(object.id);
  }
  for (const [objectId, element] of existingObjectElements) {
    element.remove();
    canvasObjectRenderSignatures.delete(objectId);
  }
  const selectedMemberGroupId = selectedObjectLayerGroupId();
  const isolatedGroupId = state.objects.find((object) => object.id === isolatedLayerSelectionId)?.layerGroupId || null;
  const lockedGroupIds = [...new Set(state.objects
    .filter((object) => !object.hidden && object.layerGroupId && object.layerGroupLocked === true)
    .map((object) => object.layerGroupId))];
  for (const groupId of lockedGroupIds) {
    if (groupId !== selectedGroupId) objectLayer.append(renderLayerGroupFrame(groupId));
  }
  if (selectedGroupId && hasUserSelection) {
    objectLayer.append(renderLayerGroupSelection(selectedGroupId));
  } else if (selectedIds.size > 1 && hasUserSelection) {
    const multiSelection = renderMultiImageSelection();
    if (multiSelection) objectLayer.append(multiSelection);
  } else if (selectedMemberGroupId && hasUserSelection) {
    const status = renderLayerGroupBackgroundStatus(selectedMemberGroupId);
    if (status) objectLayer.append(status);
  }
  if (hasUserSelection && (selectedGroupId || isolatedGroupId)) {
    objectLayer.append(renderSelectionLayerStrip(selectedGroupId || isolatedGroupId));
  }
  if (versionDiffOverlay) {
    const overlay = renderVersionDiffOverlay();
    if (overlay) objectLayer.append(overlay);
  }
  const expandPreview = renderExpandPreviewFrame();
  if (expandPreview) objectLayer.append(expandPreview);
  if (annotationDraft?.preview?.element) {
    objectLayer.append(annotationDraft.preview.element);
    updateAnnotationPreview();
  }

  renderLayerBrowserPanel();
  updateSelectionUi();
  updateQuickEditRunState();
  
  // Update canvas map
  if (canvasMapVisible) {
    canvasMap.classList.remove("hidden-map");
    renderCanvasMap();
  } else {
    canvasMap.classList.add("hidden-map");
  }
}

function canvasObjectRenderSignature(object, uiState) {
  const content = {};
  for (const [key, value] of Object.entries(object)) {
    if (key === "x" || key === "y" || key === "width" || key === "height") continue;
    content[key] = value;
  }
  const slidesState = object.type === "slides"
    ? {
        workspaceOpen: slidesWorkspaceOpen,
        activeIndex: activeSlideIndexByDeck.get(object.id) || 0,
        generatorOpen: slidesGeneratorOpenByDeck.has(object.id),
        generatorPhase: slidesGeneratorDraftByDeck.get(object.id)?.phase || "idle"
      }
    : null;
  return JSON.stringify([
    content,
    language,
    uiState.isCropActive,
    editingTextId === object.id,
    editingAnnotationId === object.id,
    slidesState
  ]);
}

function updateCanvasObjectGeometry(element, object) {
  const geometry = canvasObjectGeometry(object);
  element.style.left = `${object.x}px`;
  element.style.top = `${object.y}px`;
  element.style.width = `${geometry.width}px`;
  element.style.height = `${geometry.height}px`;
  const size = element.querySelector(":scope > .object-meta .object-meta-size");
  if (size) size.textContent = `${Math.round(object.width)} × ${Math.round(object.height)}`;
}

function placeCanvasObjectElement(element, previousElement) {
  const expectedElement = previousElement ? previousElement.nextSibling : objectLayer.firstChild;
  if (element === expectedElement) return;
  objectLayer.insertBefore(element, expectedElement || null);
}

function updateCanvasObjectSelectionChrome(element, object, uiState) {
  element.classList.toggle("selected", Boolean(uiState.isSelectedObject));
  element.classList.toggle("layer-group-member-selected", Boolean(uiState.isSelectedGroupMember));
  element.classList.toggle("layer-background-filling", Boolean(uiState.isFillingBackground));
  element.classList.toggle("crop-active", Boolean(uiState.isCropActive));

  for (const adornment of element.querySelectorAll(":scope > .object-meta, :scope > .resize-handle, :scope > .crop-overlay")) {
    adornment.remove();
  }
  const showControls = object.id === selectedId
    && selectedIds.size <= 1
    && hasUserSelection
    && !uiState.selectedGroupId;
  if (!showControls) return;
  const isImageType = (object.type || "image") === "image";
  const isTextType = object.type === "text";
  if (!isImageType && !isTextType) return;
  if (isImageType) {
    const meta = document.createElement("div");
    meta.className = "object-meta";
    const size = document.createElement("span");
    size.className = "object-meta-size";
    size.textContent = `${Math.round(object.width)} × ${Math.round(object.height)}`;
    meta.append(size);
    element.append(meta);
  }
  element.append(renderResizeHandles(object));
  if (isImageType && cropSession?.objectId === object.id) {
    element.append(renderCropOverlay(object));
  }
}

function renderExpandPreviewFrame() {
  if (quickEditAction !== "expand" || quickEditComposer.hidden || !quickEditObjectId) return null;
  const object = state.objects.find((item) => item.id === quickEditObjectId);
  if (!object || (object.type || "image") !== "image") return null;
  if (workflowResultScreenBounds(object.id)) return null;
  const rect = expandPreviewRect(object);
  const frame = document.createElement("div");
  frame.className = "expand-preview-frame";
  frame.dataset.ratio = expandConfig.ratio || "original";
  frame.style.left = `${rect.x}px`;
  frame.style.top = `${rect.y}px`;
  frame.style.width = `${rect.width}px`;
  frame.style.height = `${rect.height}px`;
  const sizeLabel = document.createElement("span");
  sizeLabel.className = "expand-preview-size";
  sizeLabel.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  frame.append(sizeLabel);
  frame.setAttribute("aria-hidden", "true");
  return frame;
}

function renderVersionDiffOverlay() {
  const objects = (versionDiffOverlay?.ids || [])
    .map((id) => state.objects.find((object) => object.id === id))
    .filter(Boolean);
  if (objects.length < 2) {
    versionDiffOverlay = null;
    return null;
  }

  const rawBounds = boundsForObjects(objects);
  const padding = 12;
  const bounds = {
    x: rawBounds.x - padding,
    y: rawBounds.y - padding,
    width: rawBounds.width + padding * 2,
    height: rawBounds.height + padding * 2
  };
  const element = document.createElement("div");
  element.className = "version-diff-overlay";
  element.dataset.versionDiffIds = objects.map((object) => object.id).join(",");
  element.style.left = `${bounds.x}px`;
  element.style.top = `${bounds.y}px`;
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height}px`;
  const overlayIds = objects.map((object) => object.id);

  const connector = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  connector.classList.add("version-diff-connector");
  connector.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
  connector.setAttribute("width", "100%");
  connector.setAttribute("height", "100%");
  connector.setAttribute("aria-hidden", "true");
  for (let index = 1; index < objects.length; index += 1) {
    const previous = objects[index - 1];
    const current = objects[index];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(previous.x + previous.width / 2 - bounds.x));
    line.setAttribute("y1", String(previous.y + previous.height / 2 - bounds.y));
    line.setAttribute("x2", String(current.x + current.width / 2 - bounds.x));
    line.setAttribute("y2", String(current.y + current.height / 2 - bounds.y));
    connector.append(line);
  }
  element.append(connector);

  const label = document.createElement("div");
  label.className = "version-diff-label";
  label.textContent = `${t("versionDiffLabel")} · ${objects.length} ${t("versionGroupCount")}`;
  element.append(label);

  objects.forEach((object, index) => {
    const box = document.createElement("div");
    box.className = "version-diff-box";
    box.style.left = `${object.x - bounds.x}px`;
    box.style.top = `${object.y - bounds.y}px`;
    box.style.width = `${object.width}px`;
    box.style.height = `${object.height}px`;

    if (index > 0 && (object.type || "image") === "image") {
      const heatmap = document.createElement("canvas");
      heatmap.className = "version-diff-heatmap";
      heatmap.dataset.versionDiffSourceId = objects[0].id;
      heatmap.dataset.versionDiffTargetId = object.id;
      heatmap.setAttribute("aria-hidden", "true");
      box.append(heatmap);
    }
    const badge = document.createElement("span");
    badge.className = "version-diff-index";
    badge.textContent = String(index + 1);
    box.append(badge);
    element.append(box);
  });

  scheduleVersionDiffHeatmaps(overlayIds);
  return element;
}

function scheduleVersionDiffHeatmaps(ids) {
  const token = ++versionDiffHeatmapToken;
  window.requestAnimationFrame(() => {
    populateVersionDiffHeatmaps(ids, token).catch(() => {});
  });
}

async function populateVersionDiffHeatmaps(ids, token) {
  if (!versionDiffOverlay || !sameIdSet(ids, versionDiffOverlay.ids || []) || token !== versionDiffHeatmapToken) return;
  const source = state.objects.find((object) => object.id === ids[0]);
  if (!source || (source.type || "image") !== "image") return;
  const sourceImage = await loadDiffImage(source);
  if (token !== versionDiffHeatmapToken) return;

  const canvases = [...objectLayer.querySelectorAll(".version-diff-heatmap")];
  for (const canvas of canvases) {
    const target = state.objects.find((object) => object.id === canvas.dataset.versionDiffTargetId);
    if (!target || (target.type || "image") !== "image") continue;
    try {
      const targetImage = await loadDiffImage(target);
      if (token !== versionDiffHeatmapToken) return;
      drawVersionDiffHeatmap(canvas, sourceImage, targetImage);
    } catch {
      canvas.hidden = true;
    }
  }
}

function loadDiffImage(object) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = assetUrl(object.src, object);
    if (image.complete && image.naturalWidth > 0) resolve(image);
  });
}

function drawVersionDiffHeatmap(canvas, sourceImage, targetImage) {
  const width = Math.max(1, Math.min(192, targetImage.naturalWidth || sourceImage.naturalWidth || 1));
  const height = Math.max(1, Math.min(192, targetImage.naturalHeight || sourceImage.naturalHeight || 1));
  const sourceCanvas = document.createElement("canvas");
  const targetCanvas = document.createElement("canvas");
  sourceCanvas.width = targetCanvas.width = canvas.width = width;
  sourceCanvas.height = targetCanvas.height = canvas.height = height;

  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const targetContext = targetCanvas.getContext("2d", { willReadFrequently: true });
  const heatmapContext = canvas.getContext("2d");
  sourceContext.drawImage(sourceImage, 0, 0, width, height);
  targetContext.drawImage(targetImage, 0, 0, width, height);

  const sourcePixels = sourceContext.getImageData(0, 0, width, height);
  const targetPixels = targetContext.getImageData(0, 0, width, height);
  const heatmapPixels = heatmapContext.createImageData(width, height);
  let changedPixels = 0;
  for (let index = 0; index < sourcePixels.data.length; index += 4) {
    const delta = Math.abs(sourcePixels.data[index] - targetPixels.data[index])
      + Math.abs(sourcePixels.data[index + 1] - targetPixels.data[index + 1])
      + Math.abs(sourcePixels.data[index + 2] - targetPixels.data[index + 2])
      + Math.abs(sourcePixels.data[index + 3] - targetPixels.data[index + 3]);
    if (delta <= 28) continue;
    changedPixels += 1;
    const strength = Math.min(255, 88 + Math.round(delta / 3));
    heatmapPixels.data[index] = 217;
    heatmapPixels.data[index + 1] = delta > 240 ? 48 : 132;
    heatmapPixels.data[index + 2] = 37;
    heatmapPixels.data[index + 3] = strength;
  }
  heatmapContext.clearRect(0, 0, width, height);
  heatmapContext.putImageData(heatmapPixels, 0, 0);
  canvas.hidden = changedPixels === 0;
  canvas.dataset.changedPixels = String(changedPixels);
  canvas.dataset.changedRatio = String(changedPixels / Math.max(1, width * height));
}

function renderLayerGroupSelection(groupId) {
  const bounds = layerGroupBounds(groupId);
  const element = document.createElement("div");
  element.className = "layer-group-selection";
  element.dataset.layerGroupId = groupId;
  element.style.left = `${bounds.x}px`;
  element.style.top = `${bounds.y}px`;
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height}px`;

  for (const direction of ["nw", "ne", "se", "sw"]) {
    const handle = document.createElement("span");
    handle.className = `layer-group-selection-handle resize-${direction}`;
    handle.setAttribute("aria-hidden", "true");
    element.append(handle);
  }

  const size = document.createElement("div");
  size.className = "layer-group-selection-size";
  size.textContent = `${Math.round(bounds.width)} × ${Math.round(bounds.height)}`;
  element.append(createLayerGroupFrameLabel(groupId), size);
  return element;
}

function renderLayerGroupFrame(groupId) {
  const bounds = layerGroupBounds(groupId);
  const element = document.createElement("div");
  element.className = "layer-group-frame";
  element.dataset.layerGroupId = groupId;
  element.style.left = `${bounds.x}px`;
  element.style.top = `${bounds.y}px`;
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height}px`;
  element.append(createLayerGroupFrameLabel(groupId));
  return element;
}

function createLayerGroupFrameLabel(groupId) {
  const label = document.createElement("div");
  label.className = "layer-group-frame-label";
  const name = document.createElement("span");
  name.className = "layer-group-frame-name";
  name.textContent = layerGroupLabel(groupId);
  const rename = document.createElement("button");
  rename.type = "button";
  rename.className = "layer-group-frame-rename";
  rename.title = language === "zh" ? "编辑组名" : "Rename group";
  rename.setAttribute("aria-label", rename.title);
  rename.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
  label.append(name, rename);
  label.title = language === "zh" ? "单击修改组名" : "Click to rename group";
  label.addEventListener("pointerdown", (event) => event.stopPropagation());
  label.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    beginLayerGroupNameEdit(label, groupId);
  });
  return label;
}

function beginLayerGroupNameEdit(label, groupId) {
  if (label.querySelector("input")) return;
  const input = document.createElement("input");
  input.className = "layer-group-frame-name-input";
  input.value = layerGroupLabel(groupId);
  label.replaceChildren(input);
  let cancelled = false;
  let finished = false;
  const finish = async (save) => {
    if (finished) return;
    finished = true;
    const nextName = input.value.trim();
    if (save && nextName) await renameLayerGroup(groupId, nextName);
    else render();
  };
  input.addEventListener("pointerdown", (event) => event.stopPropagation());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelled = true;
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(!cancelled), { once: true });
  input.focus();
  input.select();
}

function renderMultiImageSelection() {
  const objects = state.objects.filter((object) => (
    selectedIds.has(object.id)
    && !object.hidden
    && ((object.type || "image") === "image" || object.type === "slide-frame")
  ));
  if (objects.length < 2) return null;
  const bounds = boundsForObjects(objects);
  const element = document.createElement("div");
  element.className = "layer-group-selection multi-image-selection";
  element.style.left = `${bounds.x}px`;
  element.style.top = `${bounds.y}px`;
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height}px`;
  for (const direction of ["nw", "ne", "se", "sw"]) {
    const handle = document.createElement("span");
    handle.className = `layer-group-selection-handle resize-${direction}`;
    handle.setAttribute("aria-hidden", "true");
    element.append(handle);
  }
  const size = document.createElement("div");
  size.className = "layer-group-selection-size";
  size.textContent = `${Math.round(bounds.width)} × ${Math.round(bounds.height)}`;
  element.append(size);
  return element;
}

async function renameLayerGroup(groupId, name) {
  const members = layerGroupMembers(groupId);
  if (!members.length) return;
  const selectionBefore = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();
  const before = members.map((member) => ({
    id: member.id,
    patch: { layerGroupName: member.layerGroupName || "Frame" }
  }));
  members.forEach((member) => {
    member.layerGroupName = name;
  });
  const after = members.map((member) => ({
    id: member.id,
    patch: { layerGroupName: name }
  }));
  render();
  await commitObjectUpdateHistory({
    before,
    after,
    selectionBefore,
    selectionAfter: captureSelectionSnapshot(),
    scopeMeta
  });
}

function renderSelectionLayerStrip(groupId = null) {
  const objects = groupId
    ? layerGroupMembers(groupId)
    : state.objects.filter((object) => selectedIds.has(object.id) && (object.type || "image") === "image");
  const bounds = groupId ? layerGroupBounds(groupId) : boundsForObjects(objects);
  const strip = document.createElement("aside");
  strip.className = "selection-layer-strip";
  strip.style.left = `${bounds.x - 48}px`;
  strip.style.top = `${bounds.y}px`;
  strip.setAttribute("aria-label", language === "zh" ? "所选图层" : "Selected layers");

  const displayObjects = [...objects].reverse();
  for (const object of displayObjects) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "selection-layer-thumbnail";
    button.classList.toggle("active", selectedIds.size === 1 && selectedId === object.id);
    button.title = object.name || (language === "zh" ? "图层" : "Layer");
    button.setAttribute("aria-label", button.title);
    const image = document.createElement("img");
    image.src = assetUrl(object.src, object);
    image.alt = "";
    button.append(image);
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setLocalSelection([object.id], { fromUser: true, isolateLayer: true });
      render();
      fetch(apiPath("/api/selection"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selection: object.id })
      }).catch(() => {});
    });
    strip.append(button);
  }
  return strip;
}

function renderLayerGroupBackgroundStatus(groupId) {
  const status = layerGroupBackgroundStatus(groupId);
  if (!status || status === "ready") return null;
  const bounds = layerGroupBounds(groupId);
  const element = document.createElement("div");
  element.className = `layer-group-status layer-group-status-${status}`;
  element.dataset.layerGroupId = groupId;
  element.style.left = `${bounds.x}px`;
  element.style.top = `${bounds.y}px`;
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height}px`;

  const label = document.createElement("div");
  label.className = "layer-group-status-label";
  const spinner = document.createElement("span");
  spinner.className = "layer-group-status-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = status === "failed"
    ? (language === "zh" ? "背景补全失败" : "Background fill failed")
    : (language === "zh" ? "背景补全中" : "Filling background");
  label.append(spinner, text);
  element.append(label);
  return element;
}

function updateLayerGroupSelectionElement(groupId) {
  if (!groupId) return;
  const element = objectLayer.querySelector(`.layer-group-selection[data-layer-group-id="${CSS.escape(groupId)}"], .layer-group-status[data-layer-group-id="${CSS.escape(groupId)}"]`);
  if (!element) return;
  const bounds = layerGroupBounds(groupId);
  element.style.left = `${bounds.x}px`;
  element.style.top = `${bounds.y}px`;
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height}px`;
}

function renderDrawingObject(object) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("drawing-content");
  svg.setAttribute("viewBox", `0 0 ${object.width} ${object.height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathForPoints(object.points || []));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", object.stroke || "#202124");
  path.setAttribute("stroke-width", object.strokeWidth || 4);
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function renderTextObject(object) {
  const text = document.createElement("div");
  text.className = "text-content";
  text.textContent = object.text || "Text";
  text.contentEditable = String(editingTextId === object.id);
  text.spellcheck = false;
  text.style.fontSize = `${object.fontSize || 28}px`;
  text.style.color = object.color || "#202124";
  if (object.fontFamily) text.style.fontFamily = object.fontFamily;
  text.style.fontWeight = object.fontWeight || "400";
  text.style.fontStyle = object.fontStyle || "normal";
  text.style.textDecoration = object.textDecoration || "none";
  text.style.textAlign = object.textAlign || "left";
  text.style.width = "100%";
  text.style.minWidth = "1px";
  text.style.maxWidth = "100%";
  text.style.wordBreak = "break-word";

  // Double-click to enter edit mode
  text.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    editingTextId = object.id;
    setLocalSelection([object.id], { fromUser: true });
    render();
    focusTextObject(object.id);
  });

  // Keyboard shortcuts
  text.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      text.blur();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      text.blur();
    }
  });

  // Input handler - auto size or fixed width
  text.addEventListener("input", () => {
    if (editingTextId !== object.id) return;
    const objectEl = text.closest(".text-object");
    if (!objectEl) return;
    const isAutoWidth = objectEl.dataset.autoWidth === "true";
    const currentWidth = Math.round(objectEl.getBoundingClientRect().width);
    const trimmedText = (text.textContent || "").trim();

    if (isAutoWidth) {
      if (!trimmedText) {
        const lineHeight = Math.round((object.fontSize || 28) * TEXT_LINE_HEIGHT_FACTOR);
        const newWidth = TEXT_DEFAULT_WIDTH;
        objectEl.style.width = `${newWidth}px`;
        objectEl.style.height = `${lineHeight}px`;
        object.width = newWidth;
        object.height = lineHeight;
      } else {
        const size = measureTextContentSize(object, text.textContent || "", { maxWidth: TEXT_MAX_AUTO_WIDTH });
        const newWidth = Math.max(Math.min(size.width, TEXT_MAX_AUTO_WIDTH), TEXT_MIN_WIDTH);
        objectEl.style.width = `${newWidth}px`;
        objectEl.style.height = `${size.height}px`;
        object.width = newWidth;
        object.height = size.height;
      }
    } else {
      const size = measureTextContentSize(object, text.textContent || "", { maxWidth: currentWidth });
      const newHeight = Math.max(size.height, Math.round((object.fontSize || 28) * TEXT_LINE_HEIGHT_FACTOR));
      objectEl.style.height = `${newHeight}px`;
      object.height = newHeight;
    }
  });

  // Save on blur
  text.addEventListener("blur", () => {
    editingTextId = null;
    saveTextObject(object.id, text.textContent || "Text");
  });
  return text;
}

function renderAnnotationObject(object) {
  const shell = document.createElement("div");
  shell.className = "annotation-content";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("annotation-arrow");
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, object.width)} ${Math.max(1, object.height)}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const markerId = `annotation-arrowhead-${String(object.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", markerId);
  marker.setAttribute("viewBox", "0 0 12 12");
  marker.setAttribute("refX", "10");
  marker.setAttribute("refY", "6");
  marker.setAttribute("markerWidth", "12");
  marker.setAttribute("markerHeight", "12");
  marker.setAttribute("markerUnits", "userSpaceOnUse");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrowhead = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowhead.setAttribute("d", "M 2 2 L 10 6 L 2 10");
  arrowhead.setAttribute("fill", "none");
  arrowhead.setAttribute("stroke", object.color || defaultQuickEditMarkColor);
  arrowhead.setAttribute("stroke-width", "2.2");
  arrowhead.setAttribute("stroke-linecap", "round");
  arrowhead.setAttribute("stroke-linejoin", "round");
  marker.append(arrowhead);
  defs.append(marker);
  svg.append(defs);

  const geometry = annotationDisplayGeometry(object);
  const start = {
    x: geometry.labelPoint.x - object.x,
    y: geometry.labelPoint.y - object.y
  };
  const end = {
    x: geometry.targetPoint.x - object.x,
    y: geometry.targetPoint.y - object.y
  };
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", annotationCurvePath(start, end));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", object.color || defaultQuickEditMarkColor);
  path.setAttribute("stroke-width", Math.max(2.25, Math.min(3.25, object.strokeWidth || 3)));
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("marker-end", `url(#${markerId})`);
  svg.append(path);
  shell.append(svg);

  const label = document.createElement("div");
  label.className = "annotation-label";
  label.textContent = object.label || "";
  label.contentEditable = String(editingAnnotationId === object.id);
  label.spellcheck = true;
  label.dataset.placeholder = t("annotationPlaceholder");
  label.title = t("annotationEditHint");
  label.style.left = `${start.x}px`;
  label.style.top = `${start.y}px`;
  label.style.setProperty("--annotation-color", object.color || defaultQuickEditMarkColor);
  label.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (editingAnnotationId === object.id) return;
    const now = performance.now();
    const repeatedPointerDown = lastAnnotationPointerDown?.id === object.id
      && now - lastAnnotationPointerDown.at <= 450;
    lastAnnotationPointerDown = { id: object.id, at: now };
    if (event.detail >= 2 || repeatedPointerDown) {
      event.preventDefault();
      setLocalSelection([object.id], { fromUser: true });
      editingAnnotationId = object.id;
      render();
      focusAnnotationLabel(object.id);
      return;
    }
    startDrag(event, object, { element: label.closest(".canvas-object") });
  });
  label.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    editingAnnotationId = object.id;
    setLocalSelection([object.id], { fromUser: true });
    render();
    focusAnnotationLabel(object.id);
  });
  label.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      label.textContent = object.label || "";
      label.blur();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      label.blur();
    }
  });
  label.addEventListener("blur", () => {
    if (editingAnnotationId !== object.id) return;
    editingAnnotationId = null;
    saveAnnotationLabel(object.id, label.textContent || "");
  });
  shell.append(label);
  return shell;
}

function annotationStoredGeometry(object) {
  const labelPoint = {
    x: object.x + (Number.isFinite(object.labelX) ? object.labelX : 0),
    y: object.y + (Number.isFinite(object.labelY) ? object.labelY : 0)
  };
  if (Number.isFinite(object.tipX) && Number.isFinite(object.tipY)) {
    return {
      labelPoint,
      targetPoint: { x: object.x + object.tipX, y: object.y + object.tipY }
    };
  }
  const labelX = Number.isFinite(object.labelX) ? object.labelX : 0;
  const labelY = Number.isFinite(object.labelY) ? object.labelY : 0;
  return {
    labelPoint,
    targetPoint: {
      x: object.x + (labelX > object.width / 2 ? 0 : object.width),
      y: object.y + (labelY > object.height / 2 ? 0 : object.height)
    }
  };
}

function annotationDisplayGeometry(object) {
  const stored = annotationStoredGeometry(object);
  const target = state?.objects?.find((item) => item.id === object.annotationTargetId && (item.type || "image") === "image");
  return target ? orientAnnotationGeometry(stored.labelPoint, stored.targetPoint, target) : stored;
}

function orientAnnotationGeometry(firstPoint, secondPoint, target) {
  const firstDistance = pointDistanceToRect(firstPoint, target);
  const secondDistance = pointDistanceToRect(secondPoint, target);
  return firstDistance < secondDistance
    ? { labelPoint: secondPoint, targetPoint: firstPoint }
    : { labelPoint: firstPoint, targetPoint: secondPoint };
}

function pointDistanceToRect(point, rect) {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function annotationCurvePath(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(42, Math.max(8, length * 0.08));
  const direction = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? -1 : 1) : 1;
  const normalX = -(dy / length) * bend * direction;
  const normalY = (dx / length) * bend * direction;
  const control1 = {
    x: start.x + dx * 0.3 + normalX,
    y: start.y + dy * 0.3 + normalY
  };
  const control2 = {
    x: end.x - dx * 0.2 + normalX * 0.48,
    y: end.y - dy * 0.2 + normalY * 0.48
  };
  return `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;
}

function renderJobObject(object) {
  const shell = document.createElement("div");
  const failed = object.status === "failed";
  shell.className = `job-content ${failed ? "failed" : "running"}`;
  if (failed) shell.title = object.error || "Image job failed.";

  if (object.src) {
    const image = document.createElement("img");
    image.className = "job-preview-image";
    image.src = assetUrl(object.src, object);
    image.alt = "";
    image.draggable = false;
    shell.append(image);
  }

  if (failed) {
    const badge = document.createElement("div");
    badge.className = "job-failed-badge";
    badge.textContent = "!";
    shell.append(badge);

    const message = document.createElement("div");
    message.className = "job-error-message";
    message.textContent = object.error || "Image job failed.";
    shell.append(message);
  } else {
    const state = document.createElement("div");
    state.className = "job-generation-state";
    const pulse = document.createElement("span");
    pulse.className = "job-generation-pulse";
    pulse.setAttribute("aria-hidden", "true");
    const label = document.createElement("strong");
    label.textContent = language === "zh" ? "正在生成" : "Generating";
    const detail = document.createElement("span");
    detail.textContent = labelAction(object.action || "generate");
    state.append(pulse, label, detail);
    shell.append(state);

    const progress = document.createElement("div");
    progress.className = "job-generation-progress";
    progress.setAttribute("aria-hidden", "true");
    shell.append(progress);

    const ripple = document.createElement("div");
    ripple.className = "job-ripple";
    shell.append(ripple);

    const sheen = document.createElement("div");
    sheen.className = "job-sheen";
    shell.append(sheen);
  }
  return shell;
}

function renderImageObject(object) {
  const frame = document.createElement("div");
  frame.className = "image-content";

  const image = document.createElement("img");
  const label = imageAnnotationLabel(object);
  image.src = assetUrl(object.src, object);
  image.alt = object.name || "Canvas image";
  image.setAttribute("aria-label", label);
  image.dataset.objectId = object.id;
  if (object.assetPath) image.dataset.fileMention = `@${object.assetPath}`;
  if (object.assetPath) image.dataset.assetPath = object.assetPath;
  if (object.sourcePath) image.dataset.sourcePath = object.sourcePath;
  image.draggable = false;
  applyImageCrop(image, object);
  frame.append(image);
  return frame;
}

function renderHtmlObject(object) {
  const frame = document.createElement("div");
  frame.className = "html-slide-content";
  const iframe = document.createElement("iframe");
  iframe.srcdoc = object.html || "";
  iframe.title = object.name || "HTML page";
  iframe.setAttribute("sandbox", "allow-scripts");
  frame.append(iframe);
  return frame;
}

function renderSlideFrameObject(object) {
  const frame = document.createElement("div");
  frame.className = "slide-frame-content";
  frame.append(createSlideFramePage(object));
  return frame;
}

function safeSlideCss(value, fallback = "") {
  const text = String(value || "").trim();
  return !text || /url\s*\(|expression\s*\(|javascript:/i.test(text) ? fallback : text;
}

function parseSlideRotation(transform) {
  const match = String(transform || "").match(/rotate\(([-\d.]+)(deg|rad|turn)?\)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]) || 0;
  const unit = (match[2] || "deg").toLowerCase();
  return unit === "rad" ? (value * 180) / Math.PI : unit === "turn" ? value * 360 : value;
}
function setSlideRotation(transform, angle) {
  const current = String(transform || "").trim();
  const rotation = `rotate(${Math.round(angle * 10) / 10}deg)`;
  return /rotate\s*\([^)]*\)/i.test(current) ? current.replace(/rotate\s*\([^)]*\)/i, rotation) : (current ? `${current} ${rotation}` : rotation);
}

function createSlideFramePage(frame) {
  const page = document.createElement("div");
  page.className = "slide-frame-page";
  page.dataset.templateId = frame.templateId || "freeform";
  page.style.background = safeSlideCss(frame.background, "#ffffff");
  const elements = Array.isArray(frame.elements) ? frame.elements : [];
  const nodes = new Map();
  const models = new Map(elements.map((element) => [element.id, element]));
  const effectiveLayoutModes = new Map(elements.map((model) => {
    const layout = model.layout || {};
    const mode = layout.mode || "free";
    if (!["row", "column", "grid"].includes(mode)) return [model.id, mode];
    const children = elements.filter((child) => child.parentId === model.id);
    const gap = Math.max(0, Number.parseFloat(layout.gap) || 0);
    const padding = Math.max(0, Number.parseFloat(layout.padding) || 0);
    const required = mode === "row"
      ? children.reduce((sum, child) => sum + Math.max(1, Number(child.width) || 1), 0) + gap * Math.max(0, children.length - 1) + padding * 2
      : mode === "column"
        ? children.reduce((sum, child) => sum + Math.max(1, Number(child.height) || 1), 0) + gap * Math.max(0, children.length - 1) + padding * 2
        : 0;
    const available = mode === "row" ? Number(model.width) || 0 : Number(model.height) || 0;
    const overflows = mode !== "grid" ? required > available + 2 : children.some((child) => Number(child.width) > Number(model.width) || Number(child.height) > Number(model.height));
    return [model.id, overflows ? "free" : mode];
  }));
  const legacyLocalPosition = (model, parentModel) => {
    const x = Number(model.x) || 0, y = Number(model.y) || 0;
    if (!parentModel || frame.coordinateSpace === "parent-local") return { x, y };
    const parentX = Number(parentModel.x) || 0, parentY = Number(parentModel.y) || 0;
    const width = Math.max(1, Number(model.width) || 1), height = Math.max(1, Number(model.height) || 1);
    const parentWidth = Math.max(1, Number(parentModel.width) || 1), parentHeight = Math.max(1, Number(parentModel.height) || 1);
    const looksAbsolute = x >= parentX - 1 && y >= parentY - 1
      && x + width <= parentX + parentWidth + 1
      && y + height <= parentY + parentHeight + 1;
    return looksAbsolute ? { x:x - parentX, y:y - parentY } : { x, y };
  };
  for (const model of elements) {
    const pendingVisual = model.type === "image" && String(model.src || "").startsWith("asset://");
    const node = ["image", "svg", "chart"].includes(model.type) && !pendingVisual ? document.createElement("img") : document.createElement("div");
    node.className = `slide-frame-element slide-frame-${model.type || "shape"}`;
    node.dataset.slideElementId = model.id;
    if (pendingVisual) {
      node.classList.add("slide-frame-pending-visual");
      node.textContent = language === "zh" ? "视觉素材生成中" : "Generating visual asset";
    } else if (model.type === "web-embed") {
      const iframe = document.createElement("iframe");
      iframe.src = /^https?:\/\//i.test(String(model.src || "")) ? model.src : "about:blank";
      iframe.title = model.text || (language === "zh" ? "嵌入网页" : "Embedded web page");
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox");
      node.append(iframe);
    } else if (model.type === "media") {
      const video = document.createElement("video");
      video.src = String(model.src || "");
      video.controls = true;
      video.preload = "metadata";
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "contain";
      video.style.background = "#000";
      if (!model.src) {
        const placeholder = document.createElement("div");
        placeholder.style.cssText = "display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#172033;color:#fff;font-size:14px;font-weight:600;";
        placeholder.textContent = model.text || "🎬 视频";
        node.append(placeholder);
      } else {
        node.append(video);
      }
    } else if (model.type === "table") {
      const rows = Number(model.rows) || 2;
      const cols = Number(model.cols) || 4;
      const tableEl = document.createElement("table");
      tableEl.style.cssText = "width:100%;height:100%;border-collapse:collapse;table-layout:fixed;";
      for (let r = 0; r < rows; r++) {
        const tr = tableEl.insertRow();
        for (let c = 0; c < cols; c++) {
          const td = tr.insertCell();
          td.style.cssText = "border:1px solid #d1d5db;padding:4px 6px;font-size:12px;color:#344054;";
          if (r === 0) {
            td.style.fontWeight = "600";
            td.style.background = "#f9fafb";
          }
          if (r === 0 && c === 0) td.textContent = model.text || `${cols}×${rows}`;
        }
      }
      node.append(tableEl);
    } else if (["image", "svg", "chart"].includes(model.type)) {
      const src = String(model.src || "");
      if (/^(?:data:image\/|\/)/i.test(src)) node.src = assetUrl(src);
      node.alt = model.text || "";
      node.draggable = false;
    } else if (model.type === "text") {
      node.textContent = model.text || "";
    } else if (model.type === "shape") {
      node.textContent = model.text || "";
    }
    const style = model.style || {};
    for (const [property, value] of Object.entries({
      color: style.color,
      background: style.background,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      textAlign: style.textAlign,
      borderRadius: style.borderRadius,
      opacity: style.opacity,
      transform: style.transform,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      clipPath: style.clipPath,
      boxShadow: style.boxShadow,
      border: style.border,
      mixBlendMode: style.mixBlendMode,
      filter: style.filter
    })) {
      const safeValue = safeSlideCss(value);
      if (safeValue) node.style[property] = safeValue;
    }
    const layout = model.layout || {};
    const effectiveLayoutMode = effectiveLayoutModes.get(model.id) || "free";
    if (["row", "column", "grid"].includes(effectiveLayoutMode)) {
      node.classList.add("slide-frame-layout");
      node.style.display = effectiveLayoutMode === "grid" ? "grid" : "flex";
      if (effectiveLayoutMode !== "grid") node.style.flexDirection = effectiveLayoutMode;
      if (safeSlideCss(layout.gap)) node.style.gap = safeSlideCss(layout.gap);
      if (safeSlideCss(layout.padding)) node.style.padding = safeSlideCss(layout.padding);
      if (safeSlideCss(layout.align)) node.style.alignItems = safeSlideCss(layout.align);
      if (safeSlideCss(layout.justify)) node.style.justifyContent = safeSlideCss(layout.justify);
      if (effectiveLayoutMode === "grid" && safeSlideCss(layout.columns)) node.style.gridTemplateColumns = safeSlideCss(layout.columns);
    }
    nodes.set(model.id, node);
  }
  for (const model of elements) {
    const node = nodes.get(model.id);
    const parentModel = models.get(model.parentId);
    let parent = nodes.get(model.parentId) || page;
    const ancestry = new Set([model.id]);
    let ancestor = parentModel;
    while (ancestor) {
      if (ancestry.has(ancestor.id)) { parent = page; break; }
      ancestry.add(ancestor.id);
      ancestor = models.get(ancestor.parentId);
    }
    const parentLayout = effectiveLayoutModes.get(parentModel?.id) || "free";
    if (parent === page || parentLayout === "free" || model.positionMode === "free") {
      const local = legacyLocalPosition(model, parentModel);
      node.style.position = "absolute";
      node.style.left = `${local.x}px`;
      node.style.top = `${local.y}px`;
    } else {
      node.style.position = "relative";
      node.style.flex = "0 0 auto";
    }
    node.style.width = `${Math.max(1, Number(model.width) || 1)}px`;
    node.style.height = `${Math.max(1, Number(model.height) || 1)}px`;
    parent.append(node);
  }
  return page;
}

function flattenSlideEditorElements(input) {
  const source = structuredClone(Array.isArray(input) ? input : []);
  if (!source.some((element) => element.parentId || element.type === "group" || ["row","column","grid"].includes(element.layout?.mode))) return { elements:source, changed:false };
  const models = new Map(source.map((element) => [element.id, element]));
  const absoluteCache = new Map();
  const absolutePosition = (element, trail = new Set()) => { if (!element || trail.has(element.id)) return { x:Number(element?.x)||0, y:Number(element?.y)||0 }; if (absoluteCache.has(element.id)) return absoluteCache.get(element.id); const parent=models.get(element.parentId); const base=parent ? absolutePosition(parent,new Set(trail).add(element.id)) : {x:0,y:0}; const value={x:base.x+(Number(element.x)||0),y:base.y+(Number(element.y)||0)}; absoluteCache.set(element.id,value); return value; };
  source.forEach((element) => absolutePosition(element));
  const childrenByParent = new Map(); source.forEach((element) => { if (element.parentId) childrenByParent.set(element.parentId,[...(childrenByParent.get(element.parentId)||[]),element]); });
  const inheritedMasks = new Map(); source.filter((element) => element.type === "group").forEach((group) => { const children=childrenByParent.get(group.id)||[]; if (children.length === 1 && children[0].type === "image") inheritedMasks.set(children[0].id,{clipPath:group.style?.clipPath||"",borderRadius:group.style?.borderRadius||""}); });
  const elements=[];
  for (const element of source) { const position=absoluteCache.get(element.id)||{x:Number(element.x)||0,y:Number(element.y)||0}; if (element.type === "group") { const style=element.style||{}; if (!String(style.background||"").trim() && !String(style.border||"").trim() && !String(style.boxShadow||"").trim()) continue; elements.push({...element,type:"shape",parentId:null,positionMode:"free",x:position.x,y:position.y,layout:{...(element.layout||{}),mode:"free"}}); continue; } const mask=inheritedMasks.get(element.id); elements.push({...element,parentId:null,positionMode:"free",x:position.x,y:position.y,style:mask?{...(element.style||{}),...(mask.clipPath&&!element.style?.clipPath?{clipPath:mask.clipPath}:{}),...(mask.borderRadius&&!element.style?.borderRadius?{borderRadius:mask.borderRadius}:{})}:element.style,layout:{...(element.layout||{}),mode:"free"}}); }
  return { elements, changed:true };
}

function requestSlideChartEdit(current = {}) {
  return new Promise((resolve) => {
    const chart = current && typeof current === "object" ? current : {};
    const backdrop = document.createElement("div"); backdrop.className = "slide-chart-dialog-backdrop";
    const dialog = document.createElement("section"); dialog.className = "slide-chart-dialog"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
    const header = document.createElement("header"); const heading = document.createElement("div");
    const title = document.createElement("h2"); title.textContent = language === "zh" ? "编辑图表" : "Edit chart";
    const help = document.createElement("p"); help.textContent = language === "zh" ? "修改数据后将由 ECharts 重新渲染为可移动 SVG 图层。" : "ECharts will re-render the data as a movable SVG layer.";
    heading.append(title, help);
    const closeButton = document.createElement("button"); closeButton.type = "button"; closeButton.setAttribute("aria-label", language === "zh" ? "关闭" : "Close"); closeButton.append(slidesIcon("close")); header.append(heading, closeButton);
    const form = document.createElement("div"); form.className = "slide-chart-dialog-form";
    const field = (labelText, control) => { const label = document.createElement("label"); const span = document.createElement("span"); span.textContent = labelText; label.append(span, control); return label; };
    const type = document.createElement("select"); for (const value of ["bar", "line", "scatter", "pie"]) { const option = document.createElement("option"); option.value = value; option.textContent = ({ bar:"Bar", line:"Line", scatter:"Scatter", pie:"Pie" })[value]; type.append(option); } type.value = chart.type || "bar";
    const chartTitle = document.createElement("input"); chartTitle.value = chart.title || "";
    const unit = document.createElement("input"); unit.value = chart.unit || "";
    const categories = document.createElement("textarea"); categories.value = Array.isArray(chart.categories) ? chart.categories.join(", ") : "";
    const series = document.createElement("textarea"); series.value = Array.isArray(chart.series) ? chart.series.map((item) => `${item.name || "Value"}: ${(item.data || []).join(", ")}`).join("\n") : "";
    const summary = document.createElement("textarea"); summary.value = chart.accessibilitySummary || "";
    const dataMode = document.createElement("select"); [["supplied",language === "zh" ? "真实数据" : "Supplied data"],["simulated",language === "zh" ? "模拟数据" : "Simulated data"],["placeholder",language === "zh" ? "待补充" : "Placeholder"]].forEach(([value,label]) => { const option=document.createElement("option"); option.value=value; option.textContent=label; dataMode.append(option); }); dataMode.value=chart.dataMode || "supplied";
    const sourceLabel = document.createElement("input"); sourceLabel.value = chart.sourceLabel || ""; sourceLabel.placeholder = language === "zh" ? "例如：公司财务系统 / 2026 Q2 经营报表" : "e.g. Finance system / Q2 2026 report";
    const sourceUrl = document.createElement("input"); sourceUrl.value = chart.sourceUrl || ""; sourceUrl.placeholder = "https://";
    const asOfDate = document.createElement("input"); asOfDate.value = chart.asOfDate || ""; asOfDate.placeholder = "2026-06-30";
    form.append(field(language === "zh" ? "图表类型" : "Chart type", type), field(language === "zh" ? "数据性质" : "Data mode", dataMode), field(language === "zh" ? "图表标题" : "Chart title", chartTitle), field(language === "zh" ? "单位" : "Unit", unit), field(language === "zh" ? "分类（逗号分隔）" : "Categories (comma separated)", categories), field(language === "zh" ? "系列（每行：名称: 数值）" : "Series (one per line: name: values)", series), field(language === "zh" ? "数据来源" : "Source", sourceLabel), field(language === "zh" ? "来源链接（可选）" : "Source URL (optional)", sourceUrl), field(language === "zh" ? "数据日期" : "As-of date", asOfDate), field(language === "zh" ? "无障碍摘要" : "Accessibility summary", summary));
    const error = document.createElement("div"); error.className = "slide-chart-dialog-error";
    const footer = document.createElement("footer"); const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = language === "zh" ? "取消" : "Cancel"; const apply = document.createElement("button"); apply.type = "button"; apply.className = "primary"; apply.textContent = language === "zh" ? "应用图表" : "Apply chart"; footer.append(cancel, apply);
    dialog.append(header, form, error, footer); backdrop.append(dialog); document.body.append(backdrop);
    const finish = (value) => { backdrop.remove(); resolve(value); };
    closeButton.onclick = () => finish(null); cancel.onclick = () => finish(null); backdrop.addEventListener("click", (event) => { if (event.target === backdrop) finish(null); });
    apply.onclick = async () => {
      const categoryValues = categories.value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 50);
      const seriesValues = series.value.split(/\n/).map((line, index) => { const separator = line.indexOf(":") >= 0 ? line.indexOf(":") : line.indexOf("："); const name = separator >= 0 ? line.slice(0, separator).trim() : `Series ${index + 1}`; const values = (separator >= 0 ? line.slice(separator + 1) : line).split(/[,，]/).map((item) => Number(item.trim())).filter(Number.isFinite); return { name:name || `Series ${index + 1}`, data:values }; }).filter((item) => item.data.length).slice(0, 8);
      if (!categoryValues.length || !seriesValues.length) { error.textContent = language === "zh" ? "请至少填写一个分类和一组数值。" : "Add at least one category and one data series."; return; }
      apply.disabled = true; error.textContent = "";
      try {
        if (dataMode.value === "supplied" && !sourceLabel.value.trim()) { apply.disabled=false; error.textContent = language === "zh" ? "真实数据请填写可识别的数据来源。" : "Add an identifiable source for supplied data."; return; }
        const response = await fetch(apiPath("/api/slides/charts/render"), { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ width:current.width || 640, height:current.height || 360, chart:{ type:type.value, title:chartTitle.value, unit:unit.value, categories:categoryValues, series:seriesValues, colors:chart.colors, dataMode:dataMode.value, sourceLabel:sourceLabel.value.trim(), sourceUrl:sourceUrl.value.trim(), asOfDate:asOfDate.value.trim(), accessibilitySummary:summary.value || chartTitle.value || "Chart" } }) });
        const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || t("jobFailed")); finish(payload);
      } catch (reason) { apply.disabled = false; error.textContent = reason?.message || t("jobFailed"); }
    };
    window.requestAnimationFrame(() => categories.focus());
  });
}

function openSlideFrameEditor(object) {
  if (!object || object.type !== "slide-frame" || document.querySelector(".slide-frame-editor")) return;
  hideSelectionToolbar();
  const normalizedEditorElements = flattenSlideEditorElements(object.elements);
  let elements = normalizedEditorElements.elements;
  // Auto-select web-embed element so URL toolbar (更换网址) is immediately accessible
  const webEmbed = elements.find((element) => element.type === "web-embed");
  let selectedElementId = webEmbed ? webEmbed.id : null;
  let dirty = normalizedEditorElements.changed;
  let saving = false;
  let history = [];
  let future = [];
  let editorZoom = 1;
  let editorPanX = 0;
  let editorPanY = 0;
  let spacePanReady = false;
  let interactingWebId = null;

  const overlay = document.createElement("section");
  overlay.className = "slide-frame-editor";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", language === "zh" ? "编辑结构化幻灯片" : "Edit structured slide");
  const header = document.createElement("header");
  header.className = "slide-frame-editor-header";
  const left = document.createElement("div");
  left.className = "slide-frame-editor-header-left";
  const right = document.createElement("div");
  right.className = "slide-frame-editor-header-right";
  const toolbar = document.createElement("nav");
  toolbar.className = "slide-frame-editor-toolbar";
  toolbar.setAttribute("role", "toolbar");

  const T = language === "zh";
  const _t = (zh, en) => T ? zh : en;
  const _i = (name) => slidesIcon(name);

  const makeToolBtn = (iconName, label, opts = {}) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toolbar-btn" + (opts.active ? " active" : "") + (opts.textOnly ? " text-only" : "");
    btn.dataset.tool = opts.tool || iconName;
    btn.setAttribute("aria-label", label);
    if (opts.panel) {
      btn.setAttribute("aria-haspopup", "true");
      btn.setAttribute("aria-expanded", "false");
    }
    btn.title = label;
    if (iconName) btn.append(_i(iconName));
    if (label) btn.append(document.createTextNode(label));
    return btn;
  };

  const makeDivider = () => {
    const d = document.createElement("span");
    d.className = "toolbar-divider";
    return d;
  };

  const toolPanels = {};
  const panelButtons = {};
  let activePanel = null;
  let dropdownLayer = null;
  const closePanels = () => {
    for (const key of Object.keys(toolPanels)) toolPanels[key].hidden = true;
    for (const key of Object.keys(panelButtons)) panelButtons[key].setAttribute("aria-expanded", "false");
    activePanel = null;
  };
  const positionPanel = (key) => {
    const btn = panelButtons[key];
    const panel = toolPanels[key];
    if (!btn || !panel || !dropdownLayer) return;
    const layerRect = dropdownLayer.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    panel.style.left = (btnRect.left - layerRect.left) + "px";
    panel.style.top = (btnRect.bottom - layerRect.top + 4) + "px";
    panel.style.minWidth = Math.max(btnRect.width, 180) + "px";
  };
  const togglePanel = (key) => {
    if (activePanel === key) { closePanels(); return; }
    closePanels();
    if (toolPanels[key]) {
      toolPanels[key].hidden = false;
      activePanel = key;
      panelButtons[key]?.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => positionPanel(key));
    }
  };

  // --- 文本下拉面板 ---
  const textPanel = document.createElement("div");
  textPanel.className = "toolbar-dropdown-panel toolbar-panel-text";
  textPanel.hidden = true;
  const textTemplates = [
    { name: _t("大标题", "大标题"), style: { fontSize: "44px", fontWeight: "800", color: "#111827", textAlign: "left" } },
    { name: _t("标题", "标题"), style: { fontSize: "32px", fontWeight: "700", color: "#111827", textAlign: "left" } },
    { name: _t("副标题", "副标题"), style: { fontSize: "24px", fontWeight: "600", color: "#374151", textAlign: "left" } },
    { name: _t("正文", "正文"), style: { fontSize: "18px", fontWeight: "400", color: "#374151", textAlign: "left" } },
    { name: _t("小号正文", "小号正文"), style: { fontSize: "14px", fontWeight: "400", color: "#6b7280", textAlign: "left" } }
  ];
  for (const tpl of textTemplates) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "toolbar-text-item";
    item.textContent = tpl.name;
    Object.assign(item.style, {
      fontSize: tpl.style.fontSize,
      fontWeight: tpl.style.fontWeight,
      color: tpl.style.color,
      textAlign: "left"
    });
    item.onclick = () => {
      const el = insertElement("text", {
        text: tpl.name,
        style: { ...tpl.style, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }
      });
      if (el) { selectedElementId = el.id; renderPage(); checkpoint(); }
      closePanels();
    };
    textPanel.append(item);
  }
  toolPanels.text = textPanel;

  // --- 图形下拉面板 ---
  const shapePanel = document.createElement("div");
  shapePanel.className = "toolbar-dropdown-panel toolbar-panel-shape";
  shapePanel.hidden = true;
  const shapeCategories = [
    { id: "basic", name: _t("基础", "基础"), shapes: [
      { icon: "square", type: "rect", label: _t("矩形", "矩形") },
      { icon: "rounded", type: "rounded-rect", label: _t("圆角矩形", "圆角矩形") },
      { icon: "rect", type: "rect", label: _t("平行四边形", "平行四边形"), skew: true },
      { icon: "ellipse", type: "ellipse", label: _t("椭圆", "椭圆") },
      { icon: "circle", type: "circle", label: _t("圆形", "圆形") },
      { icon: "pie", type: "pie", label: _t("饼图", "饼图") },
      { icon: "ring", type: "ring", label: _t("圆环", "圆环") },
      { icon: "arc", type: "arc", label: _t("弧形", "弧形") },
      { icon: "triangle", type: "triangle", label: _t("三角形", "三角形") },
      { icon: "right-tri", type: "right-triangle", label: _t("直角三角形", "直角三角形") },
      { icon: "pentagon", type: "pentagon", label: _t("五边形", "五边形") },
      { icon: "star", type: "star", label: _t("星形", "星形") },
      { icon: "trape", type: "trapezoid", label: _t("梯形", "梯形") }
    ]},
    { id: "line", name: _t("线条", "线条"), shapes: [
      { icon: "line", type: "line", label: _t("直线", "直线") },
      { icon: "arrow", type: "arrow", label: _t("箭头", "箭头") },
      { icon: "double-arrow", type: "double-arrow", label: _t("双向箭头", "双向箭头") },
      { icon: "dot-line", type: "dot-line", label: _t("点状线", "点状线") },
      { icon: "double-head", type: "double-head-arrow", label: _t("双向", "双向") }
    ]},
    { id: "arrow-cat", name: _t("箭头", "箭头"), shapes: [
      { icon: "chevron", type: "chevron", label: _t("Chevron", "Chevron") },
      { icon: "chevron-double", type: "chevron-double", label: _t("双箭头", "双箭头") },
      { icon: "right-angle", type: "right-angle-arrow", label: _t("直角箭头", "直角箭头") },
      { icon: "curved", type: "curved-arrow", label: _t("弯曲箭头", "弯曲箭头") }
    ]},
    { id: "annotation", name: _t("标注", "标注"), shapes: [
      { icon: "callout", type: "callout", label: _t("标注框", "标注框") },
      { icon: "speech", type: "speech-bubble", label: _t("对话气泡", "对话气泡") },
      { icon: "thought", type: "thought-bubble", label: _t("思考气泡", "思考气泡") }
    ]}
  ];

  const shapeSidebar = document.createElement("div");
  shapeSidebar.className = "toolbar-shape-sidebar";
  const shapeContent = document.createElement("div");
  shapeContent.className = "toolbar-shape-main";

  let shapeCategory = "basic";
  const renderShapeGrid = () => {
    shapeContent.innerHTML = "";
    const cat = shapeCategories.find((c) => c.id === shapeCategory);
    if (!cat) return;
    const title = document.createElement("div");
    title.className = "toolbar-shape-section-label";
    title.textContent = cat.name;
    shapeContent.append(title);
    const grid = document.createElement("div");
    grid.className = "toolbar-shape-grid";
    for (const s of cat.shapes) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "toolbar-shape-tile";
      tile.title = s.label;
      const svgWrap = document.createElement("span");
      svgWrap.className = "toolbar-shape-svg";
      svgWrap.innerHTML = getShapeSvg(s.type, s.skew);
      tile.append(svgWrap);
      tile.onclick = () => {
        const el = insertElement("shape", { geometry: s.type, text: "", style: { background: "#e0e7eb", borderRadius: s.type.includes("rect") ? 8 : 0 } });
        if (el) { selectedElementId = el.id; renderPage(); checkpoint(); }
        closePanels();
      };
      grid.append(tile);
    }
    shapeContent.append(grid);
  };

  const shapeNav = document.createElement("div");
  shapeNav.className = "toolbar-shape-nav";
  for (const cat of shapeCategories) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toolbar-shape-nav-item" + (cat.id === shapeCategory ? " active" : "");
    btn.textContent = cat.name;
    btn.onclick = () => {
      shapeCategory = cat.id;
      shapeNav.querySelectorAll(".toolbar-shape-nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderShapeGrid();
    };
    shapeNav.append(btn);
  }
  shapeSidebar.append(shapeNav);
  shapePanel.append(shapeSidebar, shapeContent);
  renderShapeGrid();
  toolPanels.shape = shapePanel;

  // --- 图片下拉面板（仅 AI 生成，上传已移至双击画布悬浮菜单） ---
  const imagePanel = document.createElement("div");
  imagePanel.className = "toolbar-dropdown-panel toolbar-panel-image";
  imagePanel.hidden = true;

  const aiSection = document.createElement("div");
  aiSection.className = "toolbar-image-tab-content active";
  const aiPrompt = document.createElement("textarea");
  aiPrompt.className = "toolbar-image-prompt";
  aiPrompt.placeholder = _t("描述你想要生成的图片...", "Describe the image you want to generate...");
  aiPrompt.rows = 3;
  const ratioRow = document.createElement("div");
  ratioRow.className = "toolbar-image-ratios";
  const ratios = [
    { v: "1:1", label: "1:1", w: 64, h: 64 },
    { v: "4:3", label: "4:3", w: 80, h: 60 },
    { v: "16:9", label: "16:9", w: 96, h: 54 },
    { v: "9:16", label: "9:16", w: 54, h: 96 },
    { v: "3:4", label: "3:4", w: 60, h: 80 }
  ];
  let selectedRatio = "1:1";
  for (const r of ratios) {
    const rb = document.createElement("button");
    rb.type = "button";
    rb.className = "toolbar-image-ratio" + (r.v === selectedRatio ? " active" : "");
    rb.textContent = r.label;
    rb.onclick = () => {
      selectedRatio = r.v;
      ratioRow.querySelectorAll(".toolbar-image-ratio").forEach((b) => b.classList.remove("active"));
      rb.classList.add("active");
    };
    ratioRow.append(rb);
  }
  const generateBtn = document.createElement("button");
  generateBtn.type = "button";
  generateBtn.className = "toolbar-image-generate-btn";
  generateBtn.textContent = _t("✨ AI 生成图片", "✨ Generate with AI");
  generateBtn.onclick = async () => {
    const prompt = aiPrompt.value.trim();
    if (!prompt) { showToast(_t("请先输入描述", "Please enter a description")); return; }
    const ratio = ratios.find((r) => r.v === selectedRatio);
    showToast(_t("正在生成图片...", "Generating image..."));
    try {
      const url = await generateAiImage(prompt, ratio.w, ratio.h);
      if (url) {
        const el = insertElement("image", { src: url, text: prompt, style: {} });
        if (el) { selectedElementId = el.id; renderPage(); checkpoint(); }
      }
    } catch (err) { showToast(_t("生成失败：" + err.message, "Generation failed: " + err.message)); }
    closePanels();
  };
  aiSection.append(aiPrompt, ratioRow, generateBtn);

  imagePanel.append(aiSection);
  toolPanels.image = imagePanel;

  function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const el = insertElement("image", { src: dataUrl, text: file.name, style: {} });
      if (el) { selectedElementId = el.id; renderPage(); checkpoint(); }
    };
    reader.readAsDataURL(file);
    closePanels();
  }

  async function generateAiImage(prompt, w, h) {
    const sizeMap = { 64: "square", 80: "landscape_4_3", 96: "landscape_16_9", 54: "portrait_16_9", 60: "portrait_4_3" };
    const size = sizeMap[w] || "square";
    const encoded = encodeURIComponent(prompt);
    return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encoded}&image_size=${size}`;
  }

  // --- 媒体下拉面板 ---
  const mediaPanel = document.createElement("div");
  mediaPanel.className = "toolbar-dropdown-panel toolbar-panel-media";
  mediaPanel.hidden = true;
  const mediaUploadArea = document.createElement("div");
  mediaUploadArea.className = "toolbar-image-upload-area";
  mediaUploadArea.innerHTML = `<div class="toolbar-image-upload-icon">🎬</div><div>${_t("点击或拖拽上传视频", "Click or drag to upload video")}</div><div class="toolbar-image-hint">MP4, WebM, MOV</div>`;
  const mediaFileInput = document.createElement("input");
  mediaFileInput.type = "file";
  mediaFileInput.accept = "video/*";
  mediaFileInput.style.display = "none";
  mediaUploadArea.onclick = () => mediaFileInput.click();
  mediaUploadArea.ondragover = (e) => { e.preventDefault(); mediaUploadArea.classList.add("dragover"); };
  mediaUploadArea.ondragleave = () => mediaUploadArea.classList.remove("dragover");
  mediaUploadArea.ondrop = (e) => {
    e.preventDefault(); mediaUploadArea.classList.remove("dragover");
    const file = e.dataTransfer.files?.[0];
    if (file) handleMediaFile(file);
  };
  mediaFileInput.onchange = () => {
    const file = mediaFileInput.files?.[0];
    if (file) handleMediaFile(file);
  };
  mediaPanel.append(mediaUploadArea, mediaFileInput);
  toolPanels.media = mediaPanel;

  function handleMediaFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const el = insertElement("media", { src: dataUrl, text: file.name, style: {} });
      if (el) { selectedElementId = el.id; renderPage(); checkpoint(); }
    };
    reader.readAsDataURL(file);
    closePanels();
  }

  // --- 表格下拉面板 ---
  const tablePanel = document.createElement("div");
  tablePanel.className = "toolbar-dropdown-panel toolbar-panel-table";
  tablePanel.hidden = true;
  const tableHeader = document.createElement("div");
  tableHeader.className = "toolbar-table-header";
  const tableTitle = document.createElement("div");
  tableTitle.textContent = _t("插入表格", "Insert Table");
  const tableSize = document.createElement("div");
  tableSize.className = "toolbar-table-dim";
  tableHeader.append(tableTitle, tableSize);
  const tableGrid = document.createElement("div");
  tableGrid.className = "toolbar-table-grid";
  const ROWS = 8, COLS = 10;
  let tableSelRows = 0, tableSelCols = 0;
  const updateTableSel = (r, c) => {
    tableSelRows = r; tableSelCols = c;
    tableSize.textContent = `${c}×${r}`;
    const cells = tableGrid.querySelectorAll(".toolbar-table-cell");
    cells.forEach((cell) => {
      const cr = Number(cell.dataset.row), cc = Number(cell.dataset.col);
      cell.classList.toggle("selected", cr <= r && cc <= c);
    });
  };
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "toolbar-table-cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.onmouseenter = () => updateTableSel(r, c);
      cell.onclick = () => {
        const el = insertElement("table", {
          rows: r, cols: c,
          text: `${r}×${c} 表格`,
          style: { background: "#ffffff", borderColor: "#d1d5db", borderWidth: "1px", borderRadius: "4px" }
        });
        if (el) { selectedElementId = el.id; renderPage(); checkpoint(); }
        closePanels();
      };
      tableGrid.append(cell);
    }
  }
  updateTableSel(0, 0);
  tablePanel.append(tableHeader, tableGrid);
  toolPanels.table = tablePanel;

  // --- 工具栏按钮 ---
  const btnUndo = makeToolBtn("undo", _t("撤销", "Undo"), { tool: "undo" });
  const btnRedo = makeToolBtn("redo", _t("重做", "Redo"), { tool: "redo" });
  const btnText = makeToolBtn("text", _t("文本", "Text"), { tool: "text", panel: true });
  const btnShape = makeToolBtn("shape", _t("图形", "Shape"), { tool: "shape", panel: true });
  const btnImage = makeToolBtn("image", _t("图片", "Image"), { tool: "image", panel: true });
  const btnMedia = makeToolBtn("play", _t("媒体", "Media"), { tool: "media", panel: true });
  const btnTable = makeToolBtn("table", _t("表格", "Table"), { tool: "table", panel: true });
  const btnFormat = makeToolBtn("palette", _t("格式", "Format"), { tool: "format", panel: true });
  const btnAnim = makeToolBtn("sparkles", _t("动画", "Animation"), { tool: "animation", panel: true });

  btnText.onclick = (e) => { e.stopPropagation(); togglePanel("text"); };
  btnShape.onclick = (e) => { e.stopPropagation(); togglePanel("shape"); };
  btnImage.onclick = (e) => { e.stopPropagation(); togglePanel("image"); };
  btnMedia.onclick = (e) => { e.stopPropagation(); togglePanel("media"); };
  btnTable.onclick = (e) => { e.stopPropagation(); togglePanel("table"); };

  panelButtons.text = btnText;
  panelButtons.shape = btnShape;
  panelButtons.image = btnImage;
  panelButtons.media = btnMedia;
  panelButtons.table = btnTable;

  btnFormat.onclick = () => {
    closePanels();
    const isActive = formatPanel.classList.toggle("open");
    btnFormat.classList.toggle("active", isActive);
    btnFormat.setAttribute("aria-expanded", String(isActive));
    if (isActive) { animationPanel.classList.remove("is-open"); btnAnim.classList.remove("active"); btnAnim.setAttribute("aria-expanded", "false"); }
  };
  btnAnim.onclick = () => {
    closePanels();
    const isActive = animationPanel.classList.toggle("is-open");
    btnAnim.classList.toggle("active", isActive);
    btnAnim.setAttribute("aria-expanded", String(isActive));
    if (isActive) { formatPanel.classList.remove("open"); btnFormat.classList.remove("active"); btnFormat.setAttribute("aria-expanded", "false"); }
  };

  toolbar.append(btnUndo, btnRedo, makeDivider(), btnText, btnShape, btnImage, btnMedia, btnTable, makeDivider(), btnFormat, btnAnim);

  const makeButton = (action, label, primary = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.frameEditorAction = action;
    button.textContent = label;
    if (primary) button.classList.add("primary");
    return button;
  };

  // --- 左侧区 ---
  const back = makeButton("back", _t("← 返回画布", "← Back to canvas"));
  const title = document.createElement("strong");
  title.textContent = object.name || _t("结构化幻灯片", "Structured slide");
  left.append(back, title);

  // --- 右侧区：缩放 ---
  const zoomControls = document.createElement("div");
  zoomControls.className = "slide-frame-editor-zoom";
  const zoomOutBtn = makeButton("zoom-out", ""); zoomOutBtn.classList.add("icon-only"); zoomOutBtn.append(_i("zoom-out"));
  const zoomLabel = makeButton("zoom-fit", "100%"); zoomLabel.classList.add("zoom-label");
  const zoomInBtn = makeButton("zoom-in", ""); zoomInBtn.classList.add("icon-only"); zoomInBtn.append(_i("zoom-in"));
  zoomControls.append(zoomOutBtn, zoomLabel, zoomInBtn);
  right.append(zoomControls);

  // --- 组装 header ---
  header.append(left, toolbar, right);

  // --- 包装下拉面板容器 ---
  dropdownLayer = document.createElement("div");
  dropdownLayer.className = "toolbar-dropdown-layer";
  for (const panel of Object.values(toolPanels)) dropdownLayer.append(panel);
  header.append(dropdownLayer);

  // --- 格式右侧面板 ---
  const formatPanel = document.createElement("aside");
  formatPanel.className = "format-panel slide-frame-editor-format-panel";
  formatPanel.setAttribute("role", "region");
  formatPanel.setAttribute("aria-label", _t("格式设置", "Format settings"));
  const fpTitle = document.createElement("div");
  fpTitle.className = "format-panel-title";
  fpTitle.append(_i("palette"));
  const fpTitleText = document.createElement("span");
  fpTitleText.textContent = _t("幻灯片格式", "Slide Format");
  const fpClose = document.createElement("button");
  fpClose.type = "button";
  fpClose.className = "format-panel-close";
  fpClose.append(_i("close"));
  fpClose.setAttribute("aria-label", _t("关闭格式面板", "Close format panel"));
  fpClose.onclick = () => { formatPanel.classList.remove("open"); btnFormat.classList.remove("active"); btnFormat.setAttribute("aria-expanded", "false"); };
  fpTitle.append(fpTitleText, fpClose);
  formatPanel.append(fpTitle);

  const bgSection = document.createElement("div");
  bgSection.className = "format-section";
  const bgLabel = document.createElement("div");
  bgLabel.className = "format-section-label";
  bgLabel.textContent = _t("背景", "Background");
  const bgColorRow = document.createElement("div");
  bgColorRow.className = "format-row";
  const bgColorLabel = document.createElement("span");
  bgColorLabel.textContent = _t("颜色填充", "Color Fill");
  const bgColorSwatch = document.createElement("button");
  bgColorSwatch.type = "button";
  bgColorSwatch.className = "format-color-swatch";
  bgColorSwatch.style.background = "#ffffff";
  bgColorSwatch.onclick = () => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = object.background?.startsWith("#") ? object.background : "#ffffff";
    input.oninput = (e) => {
      object.background = e.target.value;
      bgColorSwatch.style.background = e.target.value;
      renderPage();
    };
    input.click();
  };
  bgColorRow.append(bgColorLabel, bgColorSwatch);
  const bgImageRow = document.createElement("div");
  bgImageRow.className = "format-row";
  const bgImgLabel = document.createElement("span");
  bgImgLabel.textContent = _t("图片", "Image");
  const bgImgBtn = document.createElement("button");
  bgImgBtn.type = "button";
  bgImgBtn.className = "format-upload-btn";
  bgImgBtn.append(_i("upload"));
  bgImgBtn.onclick = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          object.background = `url(${ev.target.result}) center/cover`;
          renderPage();
        };
        reader.readAsDataURL(file);
      }
    };
    inp.click();
  };
  bgImageRow.append(bgImgLabel, bgImgBtn);
  const applyAllBtn = document.createElement("button");
  applyAllBtn.type = "button";
  applyAllBtn.className = "format-apply-all";
  applyAllBtn.textContent = _t("应用到全部", "Apply to All");
  applyAllBtn.onclick = async () => {
    const deck = state.objects.find((item) => item.type === "slides" && item.id === object.slidesDeckId);
    if (!deck) { showToast(_t("当前页面不属于幻灯片组", "This slide is not in a deck")); return; }
    const background = object.background || "#ffffff";
    const pages = slidesForDeck(deck).filter((slide) => slide.id !== object.id);
    try {
      await Promise.all(pages.map((slide) => updateObjectOnServer(slide.id, { background })));
      showToast(_t("背景已应用到全部页面", "Background applied to all slides"));
    } catch (error) {
      showToast(error?.message || _t("应用失败，请重试", "Could not apply background"));
    }
  };
  bgSection.append(bgLabel, bgColorRow, bgImageRow, applyAllBtn);
  formatPanel.append(bgSection);

  const layoutSection = document.createElement("div");
  layoutSection.className = "format-section";
  const layoutHeader = document.createElement("div");
  layoutHeader.className = "format-section-header";
  const layoutLabel = document.createElement("span");
  layoutLabel.textContent = _t("布局", "Layout");
  const layoutEdit = document.createElement("button");
  layoutEdit.type = "button";
  layoutEdit.className = "format-edit-btn";
  layoutEdit.append(_i("edit"));
  layoutHeader.append(layoutLabel, layoutEdit);
  const layoutGrid = document.createElement("div");
  layoutGrid.className = "format-layout-grid";
  const layouts = [
    { name: _t("默认母版", "Default"), type: "default" },
    { name: _t("空白", "Blank"), type: "blank" }
  ];
  for (const l of layouts) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "format-layout-card";
    if (l.type === "default") card.classList.add("selected");
    const thumb = document.createElement("div");
    thumb.className = "format-layout-thumb";
    thumb.innerHTML = l.type === "default"
      ? `<div style="background:#dbeafe;height:8px;margin:6px 8px;border-radius:2px"></div><div style="background:#e5e7eb;height:40px;margin:4px 8px;border-radius:4px"></div><div style="display:flex;gap:4px;margin:0 8px"><div style="background:#fef3c7;height:20px;flex:1;border-radius:2px"></div><div style="background:#dbeafe;height:20px;flex:1;border-radius:2px"></div></div>`
      : `<div style="background:#f3f4f6;height:60px;margin:8px;border-radius:4px;border:1px dashed #d1d5db"></div>`;
    const lname = document.createElement("div");
    lname.className = "format-layout-name";
    lname.textContent = l.name;
    card.append(thumb, lname);
    card.onclick = () => {
      layoutGrid.querySelectorAll(".format-layout-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      object.layout = l.type;
      updateObjectOnServer(object.id, { layout: l.type });
    };
    layoutGrid.append(card);
  }
  layoutSection.append(layoutHeader, layoutGrid);
  formatPanel.append(layoutSection);

  // --- 浮动格式工具栏（选中元素时显示，保留现有） ---
  const format = document.createElement("div");
  format.className = "slide-frame-editor-format";
  format.hidden = true;
  // —— Figma 风格格式控件 ——
  const fonts = [
    ["Inter, ui-sans-serif, system-ui, sans-serif", language === "zh" ? "默认" : "Default"],
    ["Arial, sans-serif", "Arial"],
    ["'Noto Sans SC', 'Microsoft YaHei', sans-serif", language === "zh" ? "中文黑体" : "Chinese Sans"],
    ["Georgia, serif", "Georgia"],
    ["ui-monospace, SFMono-Regular, Consolas, monospace", language === "zh" ? "等宽" : "Monospace"]
  ];
  const makeChevron = () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("slide-format-chevron"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", "m6 9 6 6 6-6"); svg.append(path);
    return svg;
  };
  const makeColorControl = (ariaLabel) => {
    const wrap = document.createElement("div"); wrap.className = "slide-format-dropdown";
    const button = document.createElement("button"); button.type = "button"; button.className = "slide-format-color-btn";
    button.setAttribute("aria-label", ariaLabel); button.title = ariaLabel;
    const dot = document.createElement("span"); dot.className = "slide-format-color-dot";
    const palette = document.createElement("div"); palette.className = "slide-format-palette"; palette.hidden = true;
    for (const hex of ["#172033", "#344054", "#f04438", "#f79009", "#12b76a", "#1570ef", "#7a5af8", "#ffffff"]) {
      const swatch = document.createElement("button"); swatch.type = "button"; swatch.className = "slide-format-swatch"; swatch.dataset.color = hex;
      swatch.style.background = hex; swatch.style.borderColor = hex.toLowerCase() === "#ffffff" ? "#d0d5dd" : hex; swatch.setAttribute("aria-label", hex);
      palette.append(swatch);
    }
    const custom = document.createElement("div"); custom.className = "slide-format-custom";
    const input = document.createElement("input"); input.type = "color"; input.className = "slide-format-custom-input"; input.value = "#172033"; input.setAttribute("aria-label", ariaLabel);
    const customLabel = document.createElement("span"); customLabel.textContent = language === "zh" ? "自定义" : "Custom";
    custom.append(input, customLabel); palette.append(custom);
    button.append(dot, makeChevron()); wrap.append(button, palette);
    return { wrap, button, dot, palette, input };
  };
  const colorControl = makeColorControl(language === "zh" ? "文字颜色" : "Text color");
  const color = colorControl.input; const colorWrap = colorControl.wrap; colorWrap.dataset.formatGroup = "text";
  const colorDot = colorControl.dot; const colorPalette = colorControl.palette;
  const shapeColorControl = makeColorControl(language === "zh" ? "图形填充色" : "Shape fill color");
  const shapeColor = shapeColorControl.input; const shapeColorWrap = shapeColorControl.wrap; shapeColorWrap.dataset.formatGroup = "shape";
  const shapeColorDot = shapeColorControl.dot; const shapeColorPalette = shapeColorControl.palette;
  // 字体下拉
  const fontWrap = document.createElement("div"); fontWrap.className = "slide-format-dropdown"; fontWrap.dataset.formatGroup = "text";
  const fontBtn = document.createElement("button"); fontBtn.type = "button"; fontBtn.className = "slide-format-select";
  fontBtn.setAttribute("aria-label", language === "zh" ? "字体" : "Font family"); fontBtn.title = fontBtn.getAttribute("aria-label");
  const fontLabel = document.createElement("span"); fontLabel.className = "slide-format-select-label"; fontLabel.textContent = "Aa";
  fontBtn.append(fontLabel, makeChevron());
  const fontMenu = document.createElement("div"); fontMenu.className = "slide-format-menu"; fontMenu.hidden = true;
  for (const [value, label] of fonts) {
    const item = document.createElement("button"); item.type = "button"; item.className = "slide-format-menu-item"; item.dataset.font = value;
    item.style.fontFamily = value; item.textContent = label; fontMenu.append(item);
  }
  fontWrap.append(fontBtn, fontMenu);
  // 字号组（− 数字下拉 +）
  const sizeWrap = document.createElement("div"); sizeWrap.className = "slide-format-size"; sizeWrap.dataset.formatGroup = "text";
  const sizeDown = makeButton("size-down", ""); sizeDown.classList.add("slide-format-step"); sizeDown.append(slidesIcon("minus"));
  sizeDown.setAttribute("aria-label", language === "zh" ? "减小字号" : "Decrease font size"); sizeDown.title = sizeDown.getAttribute("aria-label");
  const sizeDrop = document.createElement("div"); sizeDrop.className = "slide-format-dropdown";
  const sizeBtn = document.createElement("button"); sizeBtn.type = "button"; sizeBtn.className = "slide-format-select slide-format-size-btn";
  sizeBtn.setAttribute("aria-label", language === "zh" ? "字号" : "Font size");
  const sizeLabel = document.createElement("span"); sizeLabel.className = "slide-format-size-label"; sizeLabel.textContent = "24";
  sizeBtn.append(sizeLabel, makeChevron());
  const sizeMenu = document.createElement("div"); sizeMenu.className = "slide-format-menu slide-format-size-menu"; sizeMenu.hidden = true;
  for (const value of [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 80]) {
    const item = document.createElement("button"); item.type = "button"; item.className = "slide-format-menu-item slide-format-size-item"; item.dataset.fontSize = String(value); item.textContent = String(value); sizeMenu.append(item);
  }
  const sizeCustom = document.createElement("div"); sizeCustom.className = "slide-format-custom";
  const size = document.createElement("input"); size.type = "number"; size.min = "6"; size.max = "160"; size.step = "1";
  size.className = "slide-format-custom-input"; size.value = "24"; size.setAttribute("aria-label", language === "zh" ? "字号" : "Font size");
  const sizeCustomLabel = document.createElement("span"); sizeCustomLabel.textContent = language === "zh" ? "自定义" : "Custom";
  sizeCustom.append(size, sizeCustomLabel); sizeMenu.append(sizeCustom);
  sizeDrop.append(sizeBtn, sizeMenu);
  const sizeUp = makeButton("size-up", ""); sizeUp.classList.add("slide-format-step"); sizeUp.append(slidesIcon("plus"));
  sizeUp.setAttribute("aria-label", language === "zh" ? "增大字号" : "Increase font size"); sizeUp.title = sizeUp.getAttribute("aria-label");
  sizeWrap.append(sizeDown, sizeDrop, sizeUp);
  // 对齐分段控件
  const alignGroup = document.createElement("div"); alignGroup.className = "slide-format-segment"; alignGroup.dataset.formatGroup = "text";
  alignGroup.setAttribute("role", "group"); alignGroup.setAttribute("aria-label", language === "zh" ? "文字对齐" : "Text alignment");
  const alignButtons = new Map();
  for (const [value, icon, label] of [["left", "align-left", language === "zh" ? "左对齐" : "Align left"], ["center", "align-center", language === "zh" ? "居中" : "Align center"], ["right", "align-right", language === "zh" ? "右对齐" : "Align right"]]) {
    const button = makeButton("", ""); button.className = "slide-format-segment-btn"; button.dataset.align = value;
    button.setAttribute("aria-label", label); button.title = label; button.append(slidesIcon(icon));
    alignGroup.append(button); alignButtons.set(value, button);
  }
  const bold = makeButton("bold", ""); bold.classList.add("slide-format-icon-btn", "slide-frame-format-bold"); bold.dataset.formatGroup = "text";
  bold.setAttribute("aria-label", language === "zh" ? "加粗" : "Bold"); bold.title = bold.getAttribute("aria-label"); bold.append(slidesIcon("bold"));
  const divider = document.createElement("span"); divider.className = "slide-format-divider"; divider.dataset.formatGroup = "text";
  // 形状控件（填充色 + 圆角 + 不透明度）
  const radius = document.createElement("input"); radius.type = "number"; radius.min = "0"; radius.max = "200"; radius.step = "1";
  radius.className = "slide-format-field-input"; radius.value = "0"; radius.setAttribute("aria-label", language === "zh" ? "圆角" : "Corner radius");
  const radiusField = document.createElement("label"); radiusField.className = "slide-format-field"; radiusField.title = radius.getAttribute("aria-label");
  radiusField.append(slidesIcon("radius"), radius);
  const opacity = document.createElement("input"); opacity.type = "number"; opacity.min = "0"; opacity.max = "100"; opacity.step = "1";
  opacity.className = "slide-format-field-input"; opacity.value = "100"; opacity.setAttribute("aria-label", language === "zh" ? "不透明度" : "Opacity");
  const opacityField = document.createElement("label"); opacityField.className = "slide-format-field"; opacityField.title = opacity.getAttribute("aria-label");
  opacityField.append(slidesIcon("opacity"), opacity);
  const shapeGroup = document.createElement("div"); shapeGroup.className = "slide-format-shape"; shapeGroup.dataset.formatGroup = "shape";
  shapeGroup.append(shapeColorWrap, radiusField, opacityField);
  const lock = makeButton("lock", ""); lock.classList.add("slide-format-icon-btn"); lock.setAttribute("aria-label", language === "zh" ? "锁定元素" : "Lock element"); lock.title = lock.getAttribute("aria-label"); lock.append(slidesIcon("lock"));
  const remove = makeButton("delete", ""); remove.classList.add("slide-format-icon-btn", "danger"); remove.setAttribute("aria-label", language === "zh" ? "删除元素" : "Delete element"); remove.title = remove.getAttribute("aria-label"); remove.append(slidesIcon("trash"));
  const webReplace = makeButton("web-replace", language === "zh" ? "更换网址" : "Replace URL"); webReplace.dataset.formatGroup = "web";
  const webReload = makeButton("web-reload", language === "zh" ? "刷新" : "Reload"); webReload.dataset.formatGroup = "web";
  const webOpen = makeButton("web-open", language === "zh" ? "打开网页" : "Open page"); webOpen.dataset.formatGroup = "web";
  const webInteract = makeButton("web-interact", language === "zh" ? "与网页交互" : "Interact"); webInteract.dataset.formatGroup = "web";
  const chartEdit = makeButton("chart-edit", language === "zh" ? "编辑图表" : "Edit chart"); chartEdit.dataset.formatGroup = "chart"; chartEdit.prepend(slidesIcon("chart"));
  const aiEdit = makeButton("ai-edit", language === "zh" ? "AI 修改元素" : "AI edit element"); aiEdit.classList.add("slide-format-ai-edit"); aiEdit.prepend(slidesIcon("sparkles"));
  format.append(colorWrap, fontWrap, sizeWrap, alignGroup, bold, divider, shapeGroup, chartEdit, webReplace, webReload, webOpen, webInteract, aiEdit, lock, remove);
  format.hidden = true;

  // —— 动画编辑器（Tab 结构：元素动画 | 页面切换，参考 WPS Animation Panel）——
  const animationPanel = document.createElement("aside");
  animationPanel.className = "slide-frame-editor-animation";
  animationPanel.setAttribute("role", "region");
  animationPanel.setAttribute("aria-label", _t("动画编辑", "Animation editor"));

  const animSvg = {
    appear: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="20" height="20" rx="3"/></svg>`,
    fade: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="8"/><path d="M16 8 A8 8 0 0 1 24 16" fill="currentColor" fill-opacity=".3"/><line x1="2" y1="16" x2="8" y2="16" stroke-linecap="round"/><line x1="24" y1="16" x2="30" y2="16" stroke-linecap="round"/></svg>`,
    flyIn: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16h18"/><polyline points="16,10 22,16 16,22" fill="none"/><circle cx="26" cy="16" r="2" fill="currentColor"/></svg>`,
    zoom: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13" cy="13" r="7"/><line x1="18" y1="18" x2="26" y2="26" stroke-linecap="round"/><line x1="10" y1="13" x2="16" y2="13" stroke-linecap="round"/><line x1="13" y1="10" x2="13" y2="16" stroke-linecap="round"/></svg>`,
    wipe: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="8" width="20" height="16" rx="2"/><line x1="16" y1="8" x2="16" y2="24" stroke-dasharray="2 2"/></svg>`,
    pulse: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="4" fill="currentColor"/><circle cx="16" cy="16" r="9" opacity=".5"/><circle cx="16" cy="16" r="13" opacity=".25"/></svg>`,
    spin: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M26 16 A10 10 0 1 1 16 6" stroke-linecap="round"/><polyline points="16,3 16,9 22,7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bounce: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 26 Q12 8 16 20 Q20 32 26 14" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22,10 26,14 24,18" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    fadeOut: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="8"/><path d="M16 8 A8 8 0 0 0 24 16" fill="currentColor" fill-opacity=".3"/><line x1="2" y1="16" x2="8" y2="16" stroke-linecap="round"/><line x1="24" y1="16" x2="30" y2="16" stroke-linecap="round"/></svg>`,
    disappear: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="20" height="20" rx="3" fill="currentColor" fill-opacity=".8"/><line x1="10" y1="10" x2="22" y2="22" stroke-width="3" stroke-linecap="round"/></svg>`,
    flyOut: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 16h18"/><polyline points="20,10 26,16 20,22" fill="none"/><circle cx="6" cy="16" r="2" fill="currentColor"/></svg>`,
    move: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 16h20"/><polyline points="22,10 28,16 22,22" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    glow: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4 L19 13 L28 16 L19 19 L16 28 L13 19 L4 16 L13 13 Z" fill="currentColor" fill-opacity=".3"/></svg>`,
    shake: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 16 Q10 12 14 16 Q18 20 22 16 Q26 12 28 16" stroke-linecap="round"/></svg>`,
    accent: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4 C10 12, 6 16, 6 20 A10 10 0 0 0 26 20 C26 16, 22 12, 16 4" stroke-linejoin="round"/><circle cx="16" cy="22" r="2" fill="currentColor"/></svg>`,
    launch: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 6 C16 12, 12 18, 8 26" stroke-linecap="round"/><polyline points="14,6 22,6 22,14" fill="none" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="26" x2="12" y2="20" stroke-linecap="round"/></svg>`,
    vanish: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="8" stroke-dasharray="3 3"/><line x1="10" y1="10" x2="22" y2="22" stroke-width="3" stroke-linecap="round"/></svg>`,
    sparkle: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 6 L18 14 L26 16 L18 18 L16 26 L14 18 L6 16 L14 14 Z" stroke-linejoin="round"/></svg>`,
    flyOutRight: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 16h18"/><polyline points="20,10 26,16 20,22" fill="none"/><path d="M26 12 L30 16 L26 20" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    flyOutUp: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 26 V8"/><polyline points="10,14 16,8 22,14" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    flyOutDown: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 6 V24"/><polyline points="10,18 16,24 22,18" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    dim: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="8"/><path d="M16 8 A8 8 0 1 1 8 16" fill="currentColor" fill-opacity=".4"/></svg>`,
    collapse: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="20" height="20" rx="2"/><line x1="6" y1="6" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/><line x1="26" y1="6" x2="20" y2="12" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="26" x2="12" y2="20" stroke-width="2" stroke-linecap="round"/><line x1="26" y1="26" x2="20" y2="20" stroke-width="2" stroke-linecap="round"/></svg>`,
    expand: `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="16" height="16" rx="2"/><line x1="4" y1="4" x2="10" y2="10" stroke-width="2" stroke-linecap="round"/><line x1="28" y1="4" x2="22" y2="10" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="28" x2="10" y2="22" stroke-width="2" stroke-linecap="round"/><line x1="28" y1="28" x2="22" y2="22" stroke-width="2" stroke-linecap="round"/></svg>`
  };

  const EFFECT_CATEGORIES = {
    entrance: [
      { v: "entrance_appear", iconSvg: animSvg.appear, label: T ? "出现" : "Appear" },
      { v: "entrance_fade", iconSvg: animSvg.fade, label: T ? "淡入" : "Fade" },
      { v: "entrance_fly_in", iconSvg: animSvg.flyIn, label: T ? "飞入" : "Fly In" },
      { v: "entrance_zoom", iconSvg: animSvg.zoom, label: T ? "缩放" : "Zoom" },
      { v: "entrance_wipe", iconSvg: animSvg.wipe, label: T ? "擦除" : "Wipe" },
      { v: "entrance_move", iconSvg: animSvg.move, label: T ? "移动" : "Move" }
    ],
    emphasis: [
      { v: "emphasis_pulse", iconSvg: animSvg.pulse, label: T ? "脉冲" : "Pulse" },
      { v: "emphasis_spin", iconSvg: animSvg.spin, label: T ? "旋转" : "Spin" },
      { v: "emphasis_bounce", iconSvg: animSvg.bounce, label: T ? "弹跳" : "Bounce" },
      { v: "emphasis_glow", iconSvg: animSvg.glow, label: T ? "发光" : "Glow" },
      { v: "emphasis_shake", iconSvg: animSvg.shake, label: T ? "抖动" : "Shake" },
      { v: "emphasis_accent", iconSvg: animSvg.accent, label: T ? "强调" : "Accent" }
    ],
    exit: [
      { v: "exit_fade_out", iconSvg: animSvg.fadeOut, label: T ? "淡出" : "Fade Out" },
      { v: "exit_disappear", iconSvg: animSvg.disappear, label: T ? "消失" : "Disappear" },
      { v: "exit_fly_out", iconSvg: animSvg.flyOut, label: T ? "飞出" : "Fly Out" },
      { v: "exit_vanish", iconSvg: animSvg.vanish, label: T ? "隐藏" : "Vanish" },
      { v: "exit_collapse", iconSvg: animSvg.collapse, label: T ? "收缩" : "Collapse" },
      { v: "exit_launch", iconSvg: animSvg.launch, label: T ? "发射" : "Launch" }
    ]
  };

  const TRANSITION_EFFECTS = [
    { v: "fade", iconSvg: animSvg.fade, label: T ? "平滑淡入" : "Smooth Fade" },
    { v: "cut", iconSvg: animSvg.appear, label: T ? "剪切" : "Cut" },
    { v: "push_left", iconSvg: animSvg.move, label: T ? "向左推入" : "Push L" },
    { v: "push_right", iconSvg: animSvg.move, label: T ? "向右推入" : "Push R" },
    { v: "push_up", iconSvg: animSvg.move, label: T ? "向上推入" : "Push T" },
    { v: "push_down", iconSvg: animSvg.move, label: T ? "向下推入" : "Push B" },
    { v: "wipe_left", iconSvg: animSvg.wipe, label: T ? "向左擦除" : "Wipe L" },
    { v: "wipe_right", iconSvg: animSvg.wipe, label: T ? "向右擦除" : "Wipe R" },
    { v: "split", iconSvg: animSvg.expand, label: T ? "分割" : "Split" },
    { v: "cover", iconSvg: animSvg.expand, label: T ? "覆盖" : "Cover" },
    { v: "none", iconSvg: animSvg.dim, label: T ? "无" : "None" }
  ];

  const EFFECT_ICONS = {};
  for (const cat of Object.values(EFFECT_CATEGORIES)) for (const e of cat) EFFECT_ICONS[e.v] = { iconSvg: e.iconSvg, label: e.label };
  const TRIGGER_OPTIONS = [
    { value: "on_click", label: T ? "点击时" : "On Click" },
    { value: "with_previous", label: T ? "与上一同时" : "With Previous" },
    { value: "after_previous", label: T ? "上一之后" : "After Previous" }
  ];

  const saveAnimation = () => {
    if (!object.animation) object.animation = { preset: "custom", groups: [] };
    object.animation.preset = "custom";
    updateObjectOnServer(object.id, { animation: object.animation });
  };
  const saveTransition = () => {
    updateObjectOnServer(object.id, { transition: object.transition });
  };

  // ---- 顶部 Tab 栏 ----
  const elementIconSvg = {
    text: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>`,
    shape: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
    image: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>`,
    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    "web-embed": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    media: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
    table: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`
  };

  const getElementIcon = (type) => {
    if (elementIconSvg[type]) return elementIconSvg[type];
    return elementIconSvg.text;
  };

  const animTabs = document.createElement("div");
  animTabs.className = "anim-tabs";
  const tabElement = document.createElement("button");
  tabElement.className = "anim-tab active";
  tabElement.textContent = T ? "元素动画" : "Element";
  const tabTransition = document.createElement("button");
  tabTransition.className = "anim-tab";
  tabTransition.textContent = T ? "页面切换" : "Transition";
  const tabPreview = document.createElement("button");
  tabPreview.type = "button";
  tabPreview.className = "anim-header-btn";
  tabPreview.textContent = T ? "预览" : "Preview";
  animTabs.append(tabElement, tabTransition, tabPreview);

  // ---- 元素动画 Tab 内容 ----
  const elementTab = document.createElement("div");
  elementTab.className = "anim-tab-content";
  let expandedRowIndex = -1;
  let effectPanelOpen = false;

  // 顺序列表
  const orderSection = document.createElement("div");
  orderSection.className = "anim-order-section";
  const orderHeader = document.createElement("div");
  orderHeader.className = "anim-order-header";
  const orderLabel = document.createElement("div");
  orderLabel.className = "anim-order-label";
  orderLabel.textContent = T ? "顺序" : "Order";
  const orderPreview = document.createElement("button");
  orderPreview.className = "anim-order-preview";
  orderPreview.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>${T ? "预览" : "Preview"}</span>`;
  orderPreview.addEventListener("click", () => {
    resetAnimationStyles(shell);
    playSlideAnimations(shell, object);
  });
  orderHeader.append(orderLabel, orderPreview);
  const orderList = document.createElement("div");
  orderList.className = "anim-order-list";

  const renderOrderList = () => {
    orderList.innerHTML = "";
    const anim = object.animation || { groups: [] };
    const groups = (Array.isArray(anim.groups) ? anim.groups : []).filter((g) => g && g.effect && g.effect !== "none").sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!groups.length) {
      const empty = document.createElement("div");
      empty.className = "anim-empty";
      empty.textContent = T ? "点击下方按钮添加动画" : "Click below to add";
      orderList.append(empty);
      return;
    }
    groups.forEach((group, index) => {
      const row = document.createElement("div");
      row.className = "anim-order-row" + (expandedRowIndex === index ? " is-expanded" : "");
      row.dataset.groupIndex = String(index);
      const dragHandle = document.createElement("span");
      dragHandle.className = "anim-order-drag";
      dragHandle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>`;
      dragHandle.title = T ? "拖拽调整顺序" : "Drag to reorder";
      const el = elements.find((e) => e.id === group.elementId);
      const elName = el ? String(el.text || el.name || el.id) : group.elementId;
      const elType = el?.type || "text";
      const elIcon = document.createElement("span");
      elIcon.className = "anim-order-el-icon";
      elIcon.innerHTML = getElementIcon(elType);
      const nameSpan = document.createElement("span");
      nameSpan.className = "anim-order-el-name";
      nameSpan.textContent = elName;
      const elWrap = document.createElement("span");
      elWrap.className = "anim-order-el";
      elWrap.append(elIcon, nameSpan);
      const ic = EFFECT_ICONS[group.effect];
      const effectTag = document.createElement("span");
      effectTag.className = "anim-order-effect-tag";
      effectTag.innerHTML = `${ic?.iconSvg || ""}<span>${ic?.label || group.effect}</span>`;
      const actBtn = document.createElement("button");
      actBtn.className = "anim-order-action";
      actBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      actBtn.title = T ? "预览" : "Preview";
      actBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const node = shell.querySelector(`[data-slide-element-id="${group.elementId}"]`);
        if (node) {
          resetAnimationStyles(shell);
          applyAnimationEffect(node, group.effect, (group.duration || 500) / 1000);
        }
      });
      const delBtn = document.createElement("button");
      delBtn.className = "anim-order-del";
      delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M5 6l1 14h12l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
      delBtn.title = T ? "删除" : "Delete";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = (object.animation.groups || []).indexOf(group);
        if (idx >= 0) object.animation.groups.splice(idx, 1);
        saveAnimation();
        expandedRowIndex = -1;
        renderOrderList();
      });
      const rowMain = document.createElement("div");
      rowMain.className = "anim-order-row-main";
      rowMain.append(dragHandle, elWrap, effectTag, actBtn, delBtn);
      row.append(rowMain);
      rowMain.addEventListener("click", () => {
        expandedRowIndex = expandedRowIndex === index ? -1 : index;
        renderOrderList();
      });
      if (expandedRowIndex === index) {
        row.append(buildSettingsRow(group, index));
      }
      orderList.append(row);
    });
  };

  const buildSettingsRow = (group, index) => {
    const panel = document.createElement("div");
    panel.className = "anim-order-settings";
    const makeRow = (label, input) => {
      const r = document.createElement("div");
      r.className = "anim-setting-row";
      const l = document.createElement("label");
      l.className = "anim-setting-label";
      l.textContent = label;
      const c = document.createElement("div");
      c.className = "anim-setting-control";
      c.append(input);
      r.append(l, c);
      return r;
    };
    const effectSel = document.createElement("select");
    effectSel.className = "anim-setting-select";
    for (const cat of Object.keys(EFFECT_CATEGORIES)) {
      for (const ef of EFFECT_CATEGORIES[cat]) {
        const opt = document.createElement("option");
        opt.value = ef.v;
        opt.textContent = ef.label;
        if (ef.v === group.effect) opt.selected = true;
        effectSel.append(opt);
      }
    }
    effectSel.addEventListener("change", () => {
      group.effect = effectSel.value;
      saveAnimation();
      renderOrderList();
    });
    const triggerSel = document.createElement("select");
    triggerSel.className = "anim-setting-select";
    const triggers = [
      { v: "on_click", l: T ? "单击时" : "On click" },
      { v: "with_previous", l: T ? "与上一动画同时" : "With previous" },
      { v: "after_previous", l: T ? "上一动画结束后" : "After previous" }
    ];
    for (const tr of triggers) {
      const opt = document.createElement("option");
      opt.value = tr.v; opt.textContent = tr.l;
      if (tr.v === (group.trigger || "on_click")) opt.selected = true;
      triggerSel.append(opt);
    }
    triggerSel.addEventListener("change", () => { group.trigger = triggerSel.value; saveAnimation(); });
    const durSel = document.createElement("select");
    durSel.className = "anim-setting-select";
    const durs = [
      { v: 250, l: T ? "极快 (0.25秒)" : "Very fast (0.25s)" },
      { v: 500, l: T ? "快速 (0.5秒)" : "Fast (0.5s)" },
      { v: 800, l: T ? "正常 (0.8秒)" : "Normal (0.8s)" },
      { v: 1200, l: T ? "中 (1.2秒)" : "Medium (1.2s)" },
      { v: 2000, l: T ? "慢 (2秒)" : "Slow (2s)" }
    ];
    for (const d of durs) {
      const opt = document.createElement("option");
      opt.value = String(d.v); opt.textContent = d.l;
      if (d.v === (group.duration || 500)) opt.selected = true;
      durSel.append(opt);
    }
    durSel.addEventListener("change", () => { group.duration = Number(durSel.value); saveAnimation(); });
    const delayWrap = document.createElement("div");
    delayWrap.className = "anim-setting-num";
    const delayInput = document.createElement("input");
    delayInput.type = "number"; delayInput.min = "0"; delayInput.max = "10";
    delayInput.value = String((group.delay || 0) / 1000);
    const delayUnit = document.createElement("span");
    delayUnit.className = "anim-setting-unit"; delayUnit.textContent = T ? "秒" : "s";
    delayInput.addEventListener("input", () => { group.delay = Math.max(0, Number(delayInput.value) * 1000 || 0); saveAnimation(); });
    delayWrap.append(delayInput, delayUnit);
    const repeatWrap = document.createElement("div");
    repeatWrap.className = "anim-setting-num";
    const repeatInput = document.createElement("input");
    repeatInput.type = "number"; repeatInput.min = "0"; repeatInput.max = "100";
    repeatInput.value = String(group.repeat || 0);
    const repeatUnit = document.createElement("span");
    repeatUnit.className = "anim-setting-unit"; repeatUnit.textContent = T ? "次" : "x";
    repeatInput.addEventListener("input", () => { group.repeat = Math.max(0, Number(repeatInput.value) || 0); saveAnimation(); });
    repeatWrap.append(repeatInput, repeatUnit);
    panel.append(
      makeRow(T ? "动画效果" : "Effect", effectSel),
      makeRow(T ? "开始" : "Start", triggerSel),
      makeRow(T ? "持续时间" : "Duration", durSel),
      makeRow(T ? "延时" : "Delay", delayWrap),
      makeRow(T ? "重复" : "Repeat", repeatWrap)
    );
    return panel;
  };

  orderSection.append(orderHeader, orderList);

  // 添加按钮 + 效果选择区
  const addSection = document.createElement("div");
  addSection.className = "anim-add-section";
  const addBtn = document.createElement("button");
  addBtn.className = "anim-add-btn";
  addBtn.textContent = T ? "+ 添加动画" : "+ Add Animation";
  const effectPanel = document.createElement("div");
  effectPanel.className = "anim-effect-panel";
  effectPanel.hidden = true;

  const effectTabs = document.createElement("div");
  effectTabs.className = "anim-effect-tabs";
  const effectContent = document.createElement("div");
  effectContent.className = "anim-effect-content";

  const renderEffectGrid = (cat) => {
    effectContent.innerHTML = "";
    for (const e of EFFECT_CATEGORIES[cat]) {
      const tile = document.createElement("button");
      tile.className = "anim-effect-tile";
      tile.title = e.label;
      const icon = document.createElement("span");
      icon.className = "anim-effect-icon";
      icon.innerHTML = e.iconSvg;
      const label = document.createElement("span");
      label.className = "anim-effect-label";
      label.textContent = e.label;
      tile.append(icon, label);
      tile.addEventListener("click", () => {
        if (!object.animation) object.animation = { preset: "custom", groups: [] };
        object.animation.preset = "custom";
        if (!Array.isArray(object.animation.groups)) object.animation.groups = [];
        const selected = selectedModel();
        const targetId = selected?.id;
        if (!targetId) {
          showToast(T ? "请先选择一个元素" : "Please select an element first");
          return;
        }
        object.animation.groups.push({
          elementId: targetId,
          effect: e.v,
          trigger: cat === "entrance" || cat === "exit" ? "on_click" : "with_previous",
          duration: 500,
          delay: 0,
          repeat: 0,
          order: (object.animation.groups.length || 0) + 1
        });
        saveAnimation();
        renderOrderList();
      });
      effectContent.append(tile);
    }
  };
  let currentCat = "entrance";
  const makeCatTab = (cat, label) => {
    const b = document.createElement("button");
    b.className = "anim-effect-tab" + (cat === currentCat ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", () => {
      currentCat = cat;
      effectTabs.querySelectorAll(".anim-effect-tab").forEach((t) => t.classList.remove("active"));
      b.classList.add("active");
      renderEffectGrid(cat);
    });
    return b;
  };
  effectTabs.append(makeCatTab("entrance", T ? "进入" : "Entrance"), makeCatTab("emphasis", T ? "强调" : "Emphasis"), makeCatTab("exit", T ? "退出" : "Exit"));
  effectPanel.append(effectTabs, effectContent);
  renderEffectGrid(currentCat);

  addBtn.addEventListener("click", () => {
    const selected = selectedModel();
    if (!selected?.id) {
      showToast(T ? "请先选择一个元素" : "Please select an element first");
      return;
    }
    effectPanelOpen = !effectPanelOpen;
    effectPanel.hidden = !effectPanelOpen;
    addBtn.classList.toggle("is-expanded", effectPanelOpen);
  });
  addSection.append(addBtn, effectPanel);

  elementTab.append(orderSection, addSection);

  // ---- 页面切换 Tab 内容 ----
  const transitionTab = document.createElement("div");
  transitionTab.className = "anim-tab-content";
  transitionTab.hidden = true;

  const transLabel = document.createElement("div");
  transLabel.className = "anim-section-label";
  transLabel.textContent = T ? "效果" : "Effect";

  const transGrid = document.createElement("div");
  transGrid.className = "anim-effect-grid";
  const renderTransitionGrid = () => {
    transGrid.innerHTML = "";
    const current = object.transition?.type || "fade";
    for (const t of TRANSITION_EFFECTS) {
      const tile = document.createElement("button");
      tile.className = "anim-effect-tile" + (t.v === current ? " active" : "");
      tile.title = t.label;
      const icon = document.createElement("span");
      icon.className = "anim-effect-icon";
      icon.innerHTML = t.iconSvg;
      const label = document.createElement("span");
      label.className = "anim-effect-label";
      label.textContent = t.label;
      tile.append(icon, label);
      tile.addEventListener("click", () => {
        if (!object.transition || typeof object.transition !== "object") object.transition = { type: "fade", duration: 700, direction: null };
        object.transition.type = t.v;
        if (t.v === "none") { object.transition = null; }
        saveTransition();
        renderTransitionGrid();
      });
      transGrid.append(tile);
    }
  };

  const durLabel = document.createElement("div");
  durLabel.className = "anim-section-label";
  durLabel.textContent = T ? "持续时间" : "Duration";
  const durRow = document.createElement("div");
  durRow.className = "anim-dur-row";
  const durSlider = document.createElement("input");
  durSlider.type = "range";
  durSlider.min = "100";
  durSlider.max = "3000";
  durSlider.step = "100";
  durSlider.value = String(object.transition?.duration || 700);
  const durVal = document.createElement("span");
  durVal.className = "anim-dur-val";
  durVal.textContent = `${durSlider.value}ms`;
  durSlider.addEventListener("input", () => {
    durVal.textContent = `${durSlider.value}ms`;
    if (object.transition && typeof object.transition === "object") {
      object.transition.duration = Number(durSlider.value);
      saveTransition();
    }
  });
  durRow.append(durSlider, durVal);

  const animApplyAllBtn = document.createElement("button");
  animApplyAllBtn.className = "anim-apply-all";
  animApplyAllBtn.textContent = T ? "应用到全部" : "Apply to All";
  animApplyAllBtn.addEventListener("click", () => {
    const deck = state.objects.find((o) => o.type === "slides" && o.id === object.slidesDeckId);
    if (!deck) return;
    const slides = slidesForDeck(deck);
    const current = object.transition?.type || "fade";
    for (const s of slides) {
      if (s.id === object.id) continue;
      if (!s.transition || typeof s.transition !== "object") s.transition = { type: current, duration: Number(durSlider.value), direction: null };
      else { s.transition.type = current; s.transition.duration = Number(durSlider.value); }
      updateObjectOnServer(s.id, { transition: s.transition });
    }
    showToast(T ? "已应用到全部页面" : "Applied to all slides");
  });

  transitionTab.append(transLabel, transGrid, durLabel, durRow, animApplyAllBtn);

  // ---- 面板头部 ----
  const panelHeader = document.createElement("div");
  panelHeader.className = "anim-panel-header";
  const headerIcon = document.createElement("span");
  headerIcon.className = "anim-panel-header-icon";
  headerIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2 7h7l-5.5 4 2 7-5.5-4-5.5 4 2-7L3 9h7z"/></svg>`;
  const headerTitle = document.createElement("div");
  headerTitle.className = "anim-panel-header-title";
  headerTitle.textContent = T ? "动画" : "Animation";
  const headerClose = document.createElement("button");
  headerClose.className = "anim-panel-header-close";
  headerClose.type = "button";
  headerClose.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  headerClose.title = T ? "关闭" : "Close";
  headerClose.setAttribute("aria-label", T ? "关闭动画面板" : "Close animation panel");
  headerClose.addEventListener("click", () => {
    animationPanel.classList.remove("is-open");
    btnAnim.classList.remove("active");
    btnAnim.setAttribute("aria-expanded", "false");
  });
  panelHeader.append(headerIcon, headerTitle, headerClose);

  // ---- 组装 ----
  animationPanel.append(panelHeader, animTabs, elementTab, transitionTab);

  // ---- Tab 切换 ----
  tabElement.addEventListener("click", () => {
    tabElement.classList.add("active");
    tabTransition.classList.remove("active");
    elementTab.hidden = false;
    transitionTab.hidden = true;
  });
  tabTransition.addEventListener("click", () => {
    tabTransition.classList.add("active");
    tabElement.classList.remove("active");
    transitionTab.hidden = false;
    elementTab.hidden = true;
    renderTransitionGrid();
  });

  // ---- 添加动画按钮 ----
  addBtn.addEventListener("click", () => {
    if (!object.animation) object.animation = { preset: "custom", groups: [] };
    object.animation.preset = "custom";
    if (!Array.isArray(object.animation.groups)) object.animation.groups = [];
    const selected = selectedModel();
    const targetId = selected?.id;
    if (!targetId) {
      showToast(T ? "请先选择一个元素" : "Please select an element first");
      return;
    }
    object.animation.groups.push({
      elementId: targetId, effect: "entrance_fade", trigger: "on_click", duration: 500, delay: 0,
      order: (object.animation.groups.length || 0) + 1
    });
    saveAnimation();
    renderOrderList();
  });

  // ---- 预览按钮 ----
  tabPreview.addEventListener("click", () => {
    if (tabElement.classList.contains("active")) {
      resetAnimationStyles(shell);
      playSlideAnimations(shell, object);
    } else {
      showToast(T ? "预览页面切换效果（导出后生效）" : "Transition preview in exported PPTX");
    }
  });

  // ---- 初始渲染 ----
  renderOrderList();
  renderEffectGrid("entrance");

  // --- insertElement helper ---
  let _elementIdCounter = Date.now();
  const insertElement = (type, data = {}) => {
    const id = `el_${++_elementIdCounter}_${Math.random().toString(36).slice(2, 6)}`;
    const designW = Number(object.designWidth) || 1024;
    const designH = Number(object.designHeight) || 576;
    const isBackground = data.x == null || data.y == null;
    const base = {
      id, type,
      x: isBackground ? 40 : Math.round(designW / 2 - 100),
      y: isBackground ? 40 : Math.round(designH / 2 - 50),
      width: type === "table" ? (data.cols || 4) * 80 : 200,
      height: type === "table" ? (data.rows || 2) * 40 : 100,
      style: data.style || {}
    };
    if (type === "text") {
      base.text = data.text || "文本";
      base.style = { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: "18px", fontWeight: "400", color: "#111827", textAlign: "left", ...data.style };
    } else if (type === "shape") {
      base.text = data.text || "";
      base.geometry = data.geometry || "rect";
      base.style = { background: "#e0e7eb", borderRadius: 8, ...data.style };
    } else if (type === "image") {
      base.src = data.src || "";
      base.text = data.text || "";
    } else if (type === "media") {
      base.src = data.src || "";
      base.text = data.text || "";
      base.style = { background: "#000", ...data.style };
    } else if (type === "table") {
      base.rows = data.rows || 2;
      base.cols = data.cols || 4;
      base.text = data.text || `${base.cols}×${base.rows} 表格`;
      base.style = { background: "#fff", borderColor: "#d1d5db", borderWidth: "1px", borderRadius: "4px", ...data.style };
    } else {
      base.text = data.text || "";
    }
    elements.push(base);
    return base;
  };

  // --- getShapeSvg helper ---
  function getShapeSvg(type, skew = false) {
    const shapes = {
      rect: (s) => `<svg viewBox="0 0 64 64" width="40" height="40"><rect x="8" y="12" width="48" height="40" rx="${s ? 0 : 4}" fill="none" stroke="currentColor" stroke-width="2" ${s ? 'transform="skewX(-15)"' : ''}/></svg>`,
      "rounded-rect": () => `<svg viewBox="0 0 64 64" width="40" height="40"><rect x="8" y="12" width="48" height="40" rx="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      ellipse: () => `<svg viewBox="0 0 64 64" width="40" height="40"><ellipse cx="32" cy="32" rx="24" ry="18" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      circle: () => `<svg viewBox="0 0 64 64" width="40" height="40"><circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      pie: () => `<svg viewBox="0 0 64 64" width="40" height="40"><path d="M32 12 A20 20 0 0 1 50 32 L32 32 Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/></svg>`,
      ring: () => `<svg viewBox="0 0 64 64" width="40" height="40"><circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="32" r="10" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      arc: () => `<svg viewBox="0 0 64 64" width="40" height="40"><path d="M12 44 A20 20 0 0 1 52 44" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      triangle: () => `<svg viewBox="0 0 64 64" width="40" height="40"><polygon points="32,10 54,52 10,52" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      "right-triangle": () => `<svg viewBox="0 0 64 64" width="40" height="40"><polygon points="12,10 54,52 12,52" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      pentagon: () => `<svg viewBox="0 0 64 64" width="40" height="40"><polygon points="32,8 56,24 48,54 16,54 8,24" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      star: () => `<svg viewBox="0 0 64 64" width="40" height="40"><polygon points="32,8 39,26 58,26 43,38 49,56 32,46 15,56 21,38 6,26 25,26" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      trapezoid: () => `<svg viewBox="0 0 64 64" width="40" height="40"><polygon points="18,12 46,12 56,52 8,52" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      line: () => `<svg viewBox="0 0 64 64" width="40" height="40"><line x1="10" y1="32" x2="54" y2="32" stroke="currentColor" stroke-width="2"/></svg>`,
      arrow: () => `<svg viewBox="0 0 64 64" width="40" height="40"><line x1="10" y1="32" x2="50" y2="32" stroke="currentColor" stroke-width="2"/><polyline points="38,22 50,32 38,42" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      "double-arrow": () => `<svg viewBox="0 0 64 64" width="40" height="40"><line x1="14" y1="32" x2="50" y2="32" stroke="currentColor" stroke-width="2"/><polyline points="22,22 14,32 22,42" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="42,22 50,32 42,42" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      "dot-line": () => `<svg viewBox="0 0 64 64" width="40" height="40"><line x1="10" y1="32" x2="54" y2="32" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/></svg>`,
      "double-head-arrow": () => `<svg viewBox="0 0 64 64" width="40" height="40"><line x1="18" y1="32" x2="46" y2="32" stroke="currentColor" stroke-width="2"/><polyline points="26,24 18,32 26,40" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="38,24 46,32 38,40" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      chevron: () => `<svg viewBox="0 0 64 64" width="40" height="40"><polyline points="18,20 38,32 18,44" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      "chevron-double": () => `<svg viewBox="0 0 64 64" width="40" height="40"><polyline points="14,20 30,32 14,44" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="30,20 46,32 30,44" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      "right-angle-arrow": () => `<svg viewBox="0 0 64 64" width="40" height="40"><path d="M14 50 L14 20 L44 20 L44 12 L54 22 L44 32 L44 24 L22 24 L22 50" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      "curved-arrow": () => `<svg viewBox="0 0 64 64" width="40" height="40"><path d="M14 46 Q14 20 32 20 Q50 20 50 46" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="40,38 50,46 44,36" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      callout: () => `<svg viewBox="0 0 64 64" width="40" height="40"><rect x="10" y="10" width="44" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="20,42 14,54 28,42" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      "speech-bubble": () => `<svg viewBox="0 0 64 64" width="40" height="40"><path d="M10 12 L54 12 Q54 12 54 40 Q54 48 46 48 L24 48 L16 56 L16 48 Q10 48 10 40 Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      "thought-bubble": () => `<svg viewBox="0 0 64 64" width="40" height="40"><path d="M14 14 Q10 14 10 20 Q10 26 14 26 L50 26 Q54 26 54 20 Q54 14 50 14 Q46 10 40 14 Q34 10 28 14 Q22 10 14 14" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="42" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="48" r="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>`
    };
    const fn = shapes[type] || shapes.rect;
    return fn(skew);
  }

  // --- undo/redo wiring ---
  btnUndo.onclick = () => { if (history.length) { future.push(snapshot()); elements = history.pop(); selectedElementId = null; dirty = true; renderPage(); updateHistoryButtons(); } };
  btnRedo.onclick = () => { if (future.length) { history.push(snapshot()); elements = future.pop(); selectedElementId = null; dirty = true; renderPage(); updateHistoryButtons(); } };

  // --- zoom wiring ---
  zoomOutBtn.onclick = () => applyEditorZoom(editorZoom - 0.1);
  zoomInBtn.onclick = () => applyEditorZoom(editorZoom + 0.1);
  zoomLabel.onclick = () => applyEditorZoom(1);

  const closeEditor = () => {
    if (dirty && !confirm(language === "zh" ? "有未保存的更改，确定关闭？" : "Unsaved changes. Close anyway?")) return;
    document.body.classList.remove("slide-frame-editor-open");
    overlay.remove();
    document.removeEventListener("mousedown", onEditorMouseDown, true);
    document.removeEventListener("keydown", onEditorKeydown);
  };
  back.onclick = closeEditor;

  const onEditorKeydown = (e) => {
    if (e.key === "Escape") closeEditor();
  };
  document.addEventListener("keydown", onEditorKeydown);

  const onEditorMouseDown = (e) => {
    if (!activePanel) return;
    const panel = toolPanels[activePanel];
    const btn = panelButtons[activePanel];
    if (panel && panel.contains(e.target)) return;
    if (btn && btn.contains(e.target)) return;
    closePanels();
  };
  document.addEventListener("mousedown", onEditorMouseDown, true);

  // --- stage assembly ---
  const stage = document.createElement("main");
  const canvasWrap = document.createElement("div"); canvasWrap.className = "slide-frame-editor-canvas-wrap";
  const surface = document.createElement("div"); surface.className = "slide-frame-editor-surface";
  const shell = document.createElement("div"); shell.className = "slide-frame-editor-shell";
  surface.append(shell); canvasWrap.append(surface, format); stage.append(canvasWrap, formatPanel, animationPanel);
  overlay.append(header, stage); document.body.append(overlay);

  const selectedModel = () => elements.find((element) => element.id === selectedElementId) || null;
  const snapshot = () => structuredClone(elements);
  const updateHistoryButtons = () => { btnUndo.disabled = !history.length; btnRedo.disabled = !future.length; };
  const checkpoint = () => { history.push(snapshot()); if (history.length > 60) history.shift(); future = []; dirty = true; updateHistoryButtons(); };
  const syncFormat = () => {
    const model = selectedModel();
    format.hidden = !model;
    if (format.hidden) return;
    const style = model.style || (model.style = {});
    const isText = model.type === "text";
    const isWeb = model.type === "web-embed";
    const isChart = model.type === "chart";
    aiEdit.disabled = Boolean(model.locked || model.aiLocked);
    format.querySelectorAll('[data-format-group="text"]').forEach((control) => { control.hidden = !isText; });
    format.querySelectorAll('[data-format-group="shape"]').forEach((control) => { control.hidden = isText || isChart; });
    format.querySelectorAll('[data-format-group="web"]').forEach((control) => { control.hidden = !isWeb; });
    format.querySelectorAll('[data-format-group="chart"]').forEach((control) => { control.hidden = !isChart; });
    if (isText) {
      const currentFont = style.fontFamily || fonts[0][0];
      const fontMatch = fonts.find(([value]) => value === currentFont);
      fontLabel.textContent = fontMatch ? fontMatch[1] : "Aa";
      fontMenu.querySelectorAll(".slide-format-menu-item[data-font]").forEach((item) => item.classList.toggle("active", item.dataset.font === currentFont));
      const fontSize = Math.round(Number.parseFloat(style.fontSize) || 24);
      sizeLabel.textContent = String(fontSize);
      size.value = String(fontSize);
      sizeMenu.querySelectorAll(".slide-format-size-item[data-font-size]").forEach((item) => item.classList.toggle("active", Number(item.dataset.fontSize) === fontSize));
      const alignValue = ["left", "center", "right"].includes(style.textAlign) ? style.textAlign : "left";
      alignButtons.forEach((button, value) => button.classList.toggle("active", value === alignValue));
      color.value = /^#[0-9a-f]{6}$/i.test(style.color || "") ? style.color : "#172033";
      colorDot.style.background = color.value;
      bold.classList.toggle("active", Number(style.fontWeight) >= 600 || /bold/i.test(String(style.fontWeight || "")));
    } else {
      shapeColor.value = /^#[0-9a-f]{6}$/i.test(style.background || "") ? style.background : "#ffffff";
      shapeColorDot.style.background = shapeColor.value;
      radius.value = String(Math.max(0, Math.round(Number.parseFloat(style.borderRadius) || 0)));
      const opacityValue = Number.parseFloat(style.opacity);
      opacity.value = String(Math.round(Math.max(0, Math.min(1, Number.isFinite(opacityValue) ? opacityValue : 1)) * 100));
    }
    lock.classList.toggle("active", model.locked === true);
    webInteract.classList.toggle("active", interactingWebId === model.id);
    webInteract.textContent = interactingWebId === model.id ? (language === "zh" ? "退出交互" : "Stop interacting") : (language === "zh" ? "与网页交互" : "Interact");
    lock.setAttribute("aria-label", language === "zh" ? (model.locked ? "解锁元素" : "锁定元素") : (model.locked ? "Unlock element" : "Lock element"));
  };
  const positionFormat = (node) => {
    if (!node || format.hidden) return;
    const stageRect = canvasWrap.getBoundingClientRect(); const nodeRect = node.getBoundingClientRect();
    const width = format.offsetWidth || 420; const left = Math.max(12, Math.min(stageRect.width - width - 12, nodeRect.left - stageRect.left + nodeRect.width / 2 - width / 2));
    const above = nodeRect.top - stageRect.top - format.offsetHeight - 14;
    format.style.left = `${left}px`; format.style.top = `${above >= 12 ? above : Math.min(stageRect.height - format.offsetHeight - 12, nodeRect.bottom - stageRect.top + 14)}px`;
  };
  const updateSelectionOverlay = () => {
    const page = shell.querySelector(".slide-frame-page");
    page?.querySelector(".slide-frame-editor-selection")?.remove();
    const node = selectedElementId ? page?.querySelector(`[data-slide-element-id="${CSS.escape(selectedElementId)}"]`) : null;
    if (!page || !node) return;
    const model = selectedModel();
    const pageRect = page.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const centerX = (nodeRect.left + nodeRect.right) / 2;
    const centerY = (nodeRect.top + nodeRect.bottom) / 2;
    const box = document.createElement("div");
    box.className = "slide-frame-editor-selection";
    box.style.left = `${(centerX - pageRect.left) / editorZoom - node.offsetWidth / 2}px`;
    box.style.top = `${(centerY - pageRect.top) / editorZoom - node.offsetHeight / 2}px`;
    box.style.width = `${node.offsetWidth}px`;
    box.style.height = `${node.offsetHeight}px`;
    for (const direction of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
      const handle = document.createElement("span"); handle.className = `slide-frame-editor-handle handle-${direction}`; handle.dataset.resize = direction; box.append(handle);
    }
    if (!model?.locked) {
      const rotateHandle = document.createElement("span"); rotateHandle.className = "slide-frame-editor-rotate-handle"; rotateHandle.dataset.rotate = "true"; rotateHandle.title = language === "zh" ? "旋转元素" : "Rotate element"; rotateHandle.append(slidesIcon("rotate")); box.append(rotateHandle);
    }
    page.append(box);
    positionFormat(node);
  };
  const renderPage = () => {
    const page = createSlideFramePage({ ...object, elements });
    page.classList.add("slide-frame-editor-page");
    shell.replaceChildren(page);
    if (selectedElementId) page.querySelector(`[data-slide-element-id="${CSS.escape(selectedElementId)}"]`)?.classList.add("is-selected");
    if (interactingWebId) page.querySelector(`[data-slide-element-id="${CSS.escape(interactingWebId)}"]`)?.classList.add("is-interacting");
    window.requestAnimationFrame(updateSelectionOverlay);
    syncFormat();
  };
  const applyStyle = (patch) => {
    const model = selectedModel(); if (!model) return;
    checkpoint(); model.style = { ...(model.style || {}), ...patch }; renderPage();
  };
  const undoChange = () => { if (!history.length) return; future.push(snapshot()); elements = history.pop(); selectedElementId = null; dirty = true; renderPage(); updateHistoryButtons(); };
  const redoChange = () => { if (!future.length) return; history.push(snapshot()); elements = future.pop(); selectedElementId = null; dirty = true; renderPage(); updateHistoryButtons(); };
  let autoFitZoom = false;
  const applyEditorPan = () => { surface.style.translate = `${Math.round(editorPanX)}px ${Math.round(editorPanY)}px`; };
  const applyEditorZoom = (value) => {
    editorZoom = Math.max(0.5, Math.min(1.6, Math.round(value * 100) / 100));
    surface.style.width = `${1024 * editorZoom}px`; surface.style.height = `${576 * editorZoom}px`; shell.style.transform = `scale(${editorZoom})`;
    zoomValue.textContent = `${Math.round(editorZoom * 100)}%`; zoomOut.disabled = editorZoom <= 0.5; zoomIn.disabled = editorZoom >= 1.6;
    updateSelectionOverlay();
  };
  const resetEditorView = () => {
    editorPanX = 0; editorPanY = 0; applyEditorPan();
    applyEditorZoom(1);
  };
  const resetPage = () => {
    if (!dirty || window.confirm(language === "zh" ? "放弃所有未保存的修改并重置页面？" : "Discard all unsaved changes and reset the page?")) {
      elements = structuredClone(Array.isArray(object.elements) ? object.elements : []);
      history = []; future = [];
      selectedElementId = null; interactingWebId = null;
      dirty = false;
      resetEditorView();
      renderPage();
      updateHistoryButtons();
      showToast(language === "zh" ? "页面已重置" : "Page reset");
    }
  };
  const resizeObserver = new ResizeObserver(() => { if (autoFitZoom) resetEditorView(); }); resizeObserver.observe(stage); window.requestAnimationFrame(resetEditorView);
  const close = async ({ reload = false } = {}) => {
    resizeObserver.disconnect(); window.removeEventListener("keydown", keys, true); window.removeEventListener("keydown", panKeyDown, true); window.removeEventListener("keyup", panKeyUp, true); overlay.remove();
    if (reload) { lastLoadedStateSignature = null; suppressNextAutoFocus = true; await loadState(); }
    setLocalSelection([object.id], { fromUser:true }); render();
  };
  const save = async () => {
    if (saving) return; saving = true; done.disabled = true;
    try {
      const response = await fetch(apiPath(`/api/objects/${encodeURIComponent(object.id)}`), { method:"PATCH", headers:{ "content-type":"application/json" }, body:JSON.stringify({ elements }) });
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || t("jobFailed"));
      object.elements = structuredClone(elements); canvasObjectRenderSignatures.delete(object.id); state.objects.filter((item) => item.type === "slides").forEach((deck) => canvasObjectRenderSignatures.delete(deck.id));
      showToast(language === "zh" ? "结构化幻灯片已保存" : "Structured slide saved"); await close({ reload:true });
    } catch (error) { saving = false; done.disabled = false; showToast(error?.message || t("jobFailed")); }
  };
  const keys = (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || event.target?.isContentEditable) return;
    event.preventDefault(); event.shiftKey ? redoChange() : undoChange();
  };
  window.addEventListener("keydown", keys, true);
  const isTypingTarget = (target) => target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
  const panKeyDown = (event) => {
    if (event.code !== "Space" || isTypingTarget(event.target)) return;
    spacePanReady = true; stage.classList.add("is-pan-ready"); event.preventDefault();
  };
  const panKeyUp = (event) => {
    if (event.code !== "Space") return;
    spacePanReady = false; stage.classList.remove("is-pan-ready");
  };
  window.addEventListener("keydown", panKeyDown, true); window.addEventListener("keyup", panKeyUp, true);
  stage.addEventListener("contextmenu", (event) => event.preventDefault());
  stage.addEventListener("wheel", (event) => {
    if (!event.altKey) return;
    event.preventDefault(); autoFitZoom = false;
    applyEditorZoom(editorZoom + (event.deltaY < 0 ? 0.1 : -0.1));
  }, { passive:false });
  stage.addEventListener("pointerdown", (event) => {
    const shouldPan = event.button === 2 || (event.button === 0 && spacePanReady);
    if (!shouldPan) return;
    event.preventDefault(); event.stopPropagation(); autoFitZoom = false; stage.classList.add("is-panning");
    const start = { x:event.clientX, y:event.clientY, panX:editorPanX, panY:editorPanY, pointerId:event.pointerId };
    stage.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => { if (moveEvent.pointerId !== start.pointerId) return; editorPanX = start.panX + moveEvent.clientX - start.x; editorPanY = start.panY + moveEvent.clientY - start.y; applyEditorPan(); };
    const end = (endEvent) => { if (endEvent.pointerId !== start.pointerId) return; stage.releasePointerCapture?.(start.pointerId); stage.classList.remove("is-panning"); window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", end, true); window.removeEventListener("pointercancel", end, true); };
    window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", end, true); window.addEventListener("pointercancel", end, true);
  }, true);
  {
    stage.addEventListener("pointerdown", (event) => {
      const rotateHandle = event.target.closest("[data-rotate]");
      if (rotateHandle) {
        const model = selectedModel(); if (!model || model.locked) return;
        event.preventDefault(); event.stopPropagation(); checkpoint();
        const page = shell.querySelector(".slide-frame-page");
        const node = shell.querySelector(`[data-slide-element-id="${CSS.escape(model.id)}"]`);
        if (!page || !node) return;
        const nodeRect = node.getBoundingClientRect();
        const cx = (nodeRect.left + nodeRect.right) / 2;
        const cy = (nodeRect.top + nodeRect.bottom) / 2;
        const startAngle = parseSlideRotation(model.style?.transform);
        const startPointer = Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI;
        const move = (moveEvent) => {
          let angle = startAngle + Math.atan2(moveEvent.clientY - cy, moveEvent.clientX - cx) * 180 / Math.PI - startPointer;
          angle = ((angle % 360) + 360) % 360;
          for (const target of [0, 45, 90, 135, 180, 225, 270, 315]) { if (Math.min(Math.abs(angle - target), 360 - Math.abs(angle - target)) < 3) { angle = target; break; } }
          angle = Math.round(angle * 10) / 10;
          model.style = { ...(model.style || {}), transform: setSlideRotation(model.style?.transform, angle) };
          node.style.transform = model.style.transform;
          updateSelectionOverlay();
        };
        const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); dirty = true; renderPage(); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once:true }); return;
      }
      const handle = event.target.closest("[data-resize]");
      if (handle) {
        const model = selectedModel(); if (!model || model.locked) return;
        event.preventDefault(); event.stopPropagation(); checkpoint();
        const direction = handle.dataset.resize; const start = { x:event.clientX, y:event.clientY, width:model.width, height:model.height, left:model.x, top:model.y };
        const move = (moveEvent) => {
          const dx = (moveEvent.clientX - start.x) / editorZoom; const dy = (moveEvent.clientY - start.y) / editorZoom;
          if (direction.includes("e")) model.width = Math.max(24, Math.round(start.width + dx));
          if (direction.includes("s")) model.height = Math.max(18, Math.round(start.height + dy));
          if (direction.includes("w")) { const width = Math.max(24, Math.round(start.width - dx)); model.x = Math.round(start.left + start.width - width); model.width = width; }
          if (direction.includes("n")) { const height = Math.max(18, Math.round(start.height - dy)); model.y = Math.round(start.top + start.height - height); model.height = height; }
          const node = shell.querySelector(`[data-slide-element-id="${CSS.escape(model.id)}"]`); if (node) { node.style.width = `${model.width}px`; node.style.height = `${model.height}px`; if (!model.parentId || model.positionMode === "free") { node.style.left = `${model.x}px`; node.style.top = `${model.y}px`; } }
          updateSelectionOverlay();
        };
        const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); dirty = true; };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once:true }); return;
      }
      const target = event.target.closest("[data-slide-element-id]");
      const page = shell.querySelector(".slide-frame-page");
      page?.querySelectorAll(".is-selected").forEach((node) => node.classList.remove("is-selected"));
      if (!target) { selectedElementId = null; page?.querySelector(".slide-frame-editor-selection")?.remove(); syncFormat(); return; }
      selectedElementId = target.dataset.slideElementId; target.classList.add("is-selected"); updateSelectionOverlay(); syncFormat();
      const model = selectedModel();
      if (!model || model.locked || interactingWebId === model.id || event.target.isContentEditable) return;
      const parentModel = elements.find((item) => item.id === model.parentId);
      const convertsFromAutoLayout = Boolean(model.parentId && parentModel?.layout?.mode && parentModel.layout.mode !== "free" && model.positionMode !== "free");
      const start = { x:event.clientX, y:event.clientY, left:convertsFromAutoLayout ? target.offsetLeft : Number(model.x) || 0, top:convertsFromAutoLayout ? target.offsetTop : Number(model.y) || 0, moved:false };
      const peers = elements.filter((item) => item.id !== model.id && (item.parentId || null) === (model.parentId || null));
      const peerFrames = peers.map((item) => { const peerNode = page?.querySelector(`[data-slide-element-id="${CSS.escape(item.id)}"]`); return { x:peerNode?.offsetLeft ?? (Number(item.x) || 0), y:peerNode?.offsetTop ?? (Number(item.y) || 0), width:peerNode?.offsetWidth ?? (Number(item.width) || 0), height:peerNode?.offsetHeight ?? (Number(item.height) || 0) }; });
      const snapThreshold = 6;
      const nearestSnap = (moving, targets) => {
        let best = null;
        for (const edge of moving) for (const candidate of targets) { const delta = candidate - edge; if (Math.abs(delta) <= snapThreshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, candidate }; }
        return best;
      };
      const showGuide = (axis, coordinate) => {
        const pageNode = shell.querySelector(".slide-frame-page"); if (!pageNode) return;
        let guide = pageNode.querySelector(`[data-slide-editor-guide="${axis}"]`);
        if (!guide) { guide = document.createElement("div"); guide.className = `slide-frame-editor-guide guide-${axis}`; guide.dataset.slideEditorGuide = axis; pageNode.append(guide); }
        guide.hidden = false; guide.style[axis === "x" ? "left" : "top"] = `${coordinate}px`;
      };
      const hideGuides = () => shell.querySelectorAll("[data-slide-editor-guide]").forEach((guide) => { guide.hidden = true; });
      const move = (moveEvent) => {
        const dx = (moveEvent.clientX - start.x) / editorZoom; const dy = (moveEvent.clientY - start.y) / editorZoom;
        if (!start.moved && Math.hypot(dx,dy) < 4) return;
        if (!start.moved) {
          checkpoint(); start.moved = true;
          if (convertsFromAutoLayout) { model.positionMode = "free"; model.x = start.left; model.y = start.top; target.style.position = "absolute"; target.style.flex = "none"; target.style.left = `${start.left}px`; target.style.top = `${start.top}px`; }
        }
        let nextX = Math.round(start.left + dx); let nextY = Math.round(start.top + dy);
        const xTargets = [64, 512, 960, ...peerFrames.flatMap((item) => [item.x, item.x + item.width / 2, item.x + item.width])];
        const yTargets = [64, 288, 512, ...peerFrames.flatMap((item) => [item.y, item.y + item.height / 2, item.y + item.height])];
        const modelWidth = Number(model.width) || 0; const modelHeight = Number(model.height) || 0;
        const snapX = nearestSnap([nextX, nextX + modelWidth / 2, nextX + modelWidth], xTargets);
        const snapY = nearestSnap([nextY, nextY + modelHeight / 2, nextY + modelHeight], yTargets);
        hideGuides();
        if (snapX) { nextX += snapX.delta; showGuide("x", snapX.candidate); }
        if (snapY) { nextY += snapY.delta; showGuide("y", snapY.candidate); }
        model.x = Math.round(nextX); model.y = Math.round(nextY);
        target.style.left = `${model.x}px`; target.style.top = `${model.y}px`; updateSelectionOverlay();
      };
      const end = () => { window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",end); hideGuides(); if (start.moved) dirty = true; };
      window.addEventListener("pointermove",move); window.addEventListener("pointerup",end,{ once:true });
    });
  }
  // ---- 双击画布悬浮菜单 ----
  let floatMenu = null;
  const closeFloatMenu = () => {
    if (floatMenu) { floatMenu.remove(); floatMenu = null; }
    document.removeEventListener("pointerdown", floatMenuClose, true);
    document.removeEventListener("keydown", floatMenuKey);
  };
  const floatMenuClose = (e) => {
    if (floatMenu && !floatMenu.contains(e.target)) closeFloatMenu();
  };
  const floatMenuKey = (e) => { if (e.key === "Escape") closeFloatMenu(); };

  const openFloatMenu = (clientX, clientY) => {
    closeFloatMenu();
    const menu = document.createElement("div");
    menu.className = "canvas-float-menu";
    menu.innerHTML = `
      <button class="cfm-item" data-cfm="upload">
        <span class="cfm-icon">${slidesIcon("image")}</span>
        <span class="cfm-text">
          <span class="cfm-label">${_t("上传图片", "上传图片")}</span>
          <span class="cfm-desc">${_t("从电脑选择图片", "从电脑选择图片")}</span>
        </span>
      </button>
      <button class="cfm-item" data-cfm="text">
        <span class="cfm-icon">${slidesIcon("text")}</span>
        <span class="cfm-text">
          <span class="cfm-label">${_t("添加文字", "添加文字")}</span>
          <span class="cfm-desc">${_t("作为任务提示词", "作为任务提示词")}</span>
        </span>
      </button>
      <button class="cfm-item" data-cfm="ai">
        <span class="cfm-icon">${slidesIcon("sparkles")}</span>
        <span class="cfm-text">
          <span class="cfm-label">${_t("文生图", "文生图")}</span>
          <span class="cfm-desc">${_t("AI 生成图片", "AI 生成图片")}</span>
        </span>
      </button>`;
    const action = menu.querySelector("[data-cfm]");
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cfm]");
      if (!btn) return;
      const kind = btn.dataset.cfm;
      if (kind === "upload") {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
        inp.onchange = () => {
          for (const f of [...inp.files]) {
            const reader = new FileReader();
            reader.onload = () => {
              const el = insertElement("image", { src: reader.result });
              if (el) { selectedElementId = el.id; renderPage(); checkpoint(); }
            };
            reader.readAsDataURL(f);
          }
        };
        inp.click();
      } else if (kind === "text") {
        const el = insertElement("text", { text: _t("点击编辑文字", "点击编辑文字") });
        if (el) { selectedElementId = el.id; renderPage(); checkpoint(); }
      } else if (kind === "ai") {
        const rect = shell.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        dispatchEvent(new CustomEvent("codex-canvas:create-reference-generator", {
          detail: { objectIds: [], anchorBounds: { left: boardRect.left, top: boardRect.top, right: boardRect.right, bottom: boardRect.bottom } }
        }));
      }
      closeFloatMenu();
    });
    document.body.append(menu);
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    const pad = 8;
    let x = clientX, y = clientY;
    if (x + rect.width + pad > vw) x = vw - rect.width - pad;
    if (y + rect.height + pad > vh) y = vh - rect.height - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    menu.style.left = `${x}px`; menu.style.top = `${y}px`;
    floatMenu = menu;
    document.addEventListener("pointerdown", floatMenuClose, true);
    document.addEventListener("keydown", floatMenuKey);
  };

  document.addEventListener("dblclick", (event) => {
  if (!overlay.isConnected || overlay.hidden) return;
  if (!stage.contains(event.target)) return;
  const target = event.target.closest("[data-slide-element-id]");
  const model = elements.find((item) => item.id === target?.dataset.slideElementId);
  if (target && model?.type === "text") {
    checkpoint(); target.contentEditable = "true"; target.focus();
    const finish = () => { model.text = target.textContent || ""; target.removeAttribute("contenteditable"); dirty = true; renderPage(); };
    target.addEventListener("blur", finish, { once:true });
    return;
  }
  if (!target) {
    event.preventDefault();
    event.stopPropagation();
    openFloatMenu(event.clientX, event.clientY);
  }
}, true);
  const closeAllMenus = (except = null) => {
    for (const menu of [fontMenu, sizeMenu, colorPalette, shapeColorPalette]) if (menu !== except) menu.hidden = true;
  };
  const bindMenuToggle = (toggleButton, menu) => {
    toggleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closeAllMenus(menu);
      menu.hidden = !willOpen;
    });
  };
  bindMenuToggle(fontBtn, fontMenu);
  bindMenuToggle(sizeBtn, sizeMenu);
  bindMenuToggle(colorControl.button, colorPalette);
  bindMenuToggle(shapeColorControl.button, shapeColorPalette);
  window.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".slide-format-menu, .slide-format-palette")) return;
    closeAllMenus();
  }, true);
  fontMenu.addEventListener("click", (event) => {
    const item = event.target.closest(".slide-format-menu-item[data-font]");
    if (!item) return;
    applyStyle({ fontFamily:item.dataset.font }); closeAllMenus();
  });
  sizeMenu.addEventListener("click", (event) => {
    const item = event.target.closest(".slide-format-size-item[data-font-size]");
    if (!item) return;
    const next = Math.max(6, Math.min(160, Number(item.dataset.fontSize) || 24));
    sizeLabel.textContent = String(next); applyStyle({ fontSize:`${next}px` }); closeAllMenus();
  });
  colorPalette.addEventListener("click", (event) => {
    const swatch = event.target.closest(".slide-format-swatch[data-color]");
    if (!swatch) return;
    color.value = swatch.dataset.color; colorDot.style.background = color.value; applyStyle({ color:color.value }); closeAllMenus();
  });
  shapeColorPalette.addEventListener("click", (event) => {
    const swatch = event.target.closest(".slide-format-swatch[data-color]");
    if (!swatch) return;
    shapeColor.value = swatch.dataset.color; shapeColorDot.style.background = shapeColor.value; applyStyle({ background:shapeColor.value }); closeAllMenus();
  });
  color.onchange = () => { colorDot.style.background = color.value; applyStyle({ color:color.value }); };
  size.onchange = () => { const next = Math.max(6, Math.min(160, Number(size.value) || 24)); sizeLabel.textContent = String(next); applyStyle({ fontSize:`${next}px` }); };
  shapeColor.onchange = () => { shapeColorDot.style.background = shapeColor.value; applyStyle({ background:shapeColor.value }); };
  radius.onchange = () => applyStyle({ borderRadius:`${Math.max(0, Math.min(200, Number(radius.value) || 0))}px` });
  opacity.onchange = () => applyStyle({ opacity:String(Math.max(0, Math.min(100, Number(opacity.value) || 0)) / 100) });
  format.addEventListener("pointerdown", (event) => event.stopPropagation());
  overlay.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-frame-editor-action]")?.dataset.frameEditorAction; if (!action || saving) return;
    if (action === "undo") undoChange(); if (action === "redo") redoChange(); if (action === "bold") applyStyle({ fontWeight:bold.classList.contains("active") ? "400" : "700" });
    if (action === "refresh") resetPage();
    if (action === "zoom-out" || action === "zoom-in") { autoFitZoom = false; applyEditorZoom(editorZoom + (action === "zoom-in" ? 0.1 : -0.1)); }
    if (action === "zoom-fit") { autoFitZoom = false; resetEditorView(); }
    if (action === "size-down" || action === "size-up") { const next = Math.max(6, Math.min(160, (Number(size.value) || 24) + (action === "size-up" ? 1 : -1))); size.value = String(next); applyStyle({ fontSize:`${next}px` }); }
    if (action === "lock") { const model = selectedModel(); if (model) { checkpoint(); model.locked = !model.locked; renderPage(); } }
    if (action === "web-replace") { const model = selectedModel(); if (model?.type === "web-embed") { const url = await requestEmbeddedWebPageWithOptions({ mode: "replace" }); if (url) { checkpoint(); model.src = url; interactingWebId = null; renderPage(); } } }
    if (action === "web-reload") { const model = selectedModel(); if (model?.type === "web-embed") renderPage(); }
    if (action === "web-open") { const model = selectedModel(); if (model?.type === "web-embed" && /^https?:\/\//i.test(model.src || "")) window.open(model.src, "_blank", "noopener,noreferrer"); }
    if (action === "web-interact") { const model = selectedModel(); if (model?.type === "web-embed") { interactingWebId = interactingWebId === model.id ? null : model.id; renderPage(); } }
    if (action === "chart-edit") { const model = selectedModel(); if (model?.type === "chart") { const result = await requestSlideChartEdit({ ...model.chart, width:model.width, height:model.height }); if (result) { checkpoint(); model.chart = result.chart; model.src = result.src; model.text = result.chart.accessibilitySummary; renderPage(); } } }
    if (action === "ai-edit") {
      const model = selectedModel(); if (!model || model.locked || model.aiLocked) return;
      const instruction = await requestSlidesAiInstruction(language === "zh" ? "AI 修改选中元素" : "AI edit selected element", language === "zh" ? "描述希望如何修改这个元素。位置、大小、元素类型、事实数字和锁定内容会保持不变。" : "Describe how to change this element. Geometry, type, facts, and locked content remain protected.");
      if (!instruction) return;
      const deck = state.objects.find((item) => item.type === "slides" && (item.id === object.slideDeckId || item.slideIds?.includes(object.id)));
      if (!deck) { showToast(language === "zh" ? "此页面不属于幻灯片组" : "This page is not in a slide deck"); return; }
      aiEdit.disabled = true; showToast(language === "zh" ? "AI 正在生成元素修改预览…" : "AI is preparing the element edit…");
      try {
        const preview = await transformRequest(`/api/slides/${encodeURIComponent(deck.id)}/transform`, { actionId:"custom", instruction, slideId:object.id, elementId:model.id });
        if (!preview.targetElement) throw new Error(language === "zh" ? "AI 没有返回可用元素" : "AI did not return a usable element");
        checkpoint(); elements = elements.map((item) => item.id === model.id ? structuredClone(preview.targetElement) : item); selectedElementId = model.id; dirty = true; renderPage(); showToast(language === "zh" ? "元素修改已加入预览，点击完成后保存" : "Element edit added to the preview; click Done to save");
      } catch (error) { showToast(error?.message || t("jobFailed")); } finally { aiEdit.disabled = false; }
    }
    if (action === "delete") { const model = selectedModel(); if (model && !model.locked) { checkpoint(); const removed = new Set([model.id]); let changed = true; while (changed) { changed = false; for (const item of elements) if (removed.has(item.parentId) && !removed.has(item.id)) { removed.add(item.id); changed = true; } } elements = elements.filter((item) => !removed.has(item.id)); selectedElementId = null; renderPage(); } }
    if (action === "done") save();
    if (action === "back" && (!dirty || window.confirm(language === "zh" ? "放弃尚未保存的修改并返回画布？" : "Discard unsaved changes?"))) close();
  });
  renderPage(); updateHistoryButtons();
}

function openHtmlPageEditor(object) {
  if (!object || object.type !== "html" || document.querySelector(".html-page-editor")) return;
  hideSelectionToolbar();
  const overlay = document.createElement("section");
  overlay.className = "html-page-editor";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", language === "zh" ? "编辑 HTML 页面" : "Edit HTML page");
  const header = document.createElement("header");
  const left = document.createElement("div");
  const right = document.createElement("div");
  const makeButton = (action, icon, zh, en) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.htmlEditorAction = action;
    button.append(slidesIcon(icon), document.createTextNode(language === "zh" ? zh : en));
    return button;
  };
  const back = makeButton("back", "back", "返回画布", "Back to canvas");
  const undo = makeButton("undo", "undo", "撤销", "Undo");
  const redo = makeButton("redo", "redo", "重做", "Redo");
  const ai = makeButton("ai", "sparkles", "AI 修改", "AI edit");
  const done = makeButton("done", "check", "完成", "Done");
  done.classList.add("primary");
  undo.disabled = true;
  redo.disabled = true;
  ai.disabled = true;
  ai.title = language === "zh" ? "AI 局部修改将在后端 edit-html 动作接入后开放" : "AI editing will be enabled with the backend edit-html action";
  const title = document.createElement("strong");
  title.textContent = object.name || (language === "zh" ? "HTML 页面" : "HTML page");
  const zoomControls = document.createElement("div");
  zoomControls.className = "html-page-editor-zoom";
  const zoomOut = makeButton("zoom-out", "zoom-out", "缩小", "Zoom out");
  const zoomLabel = document.createElement("button");
  zoomLabel.type = "button";
  zoomLabel.dataset.htmlEditorAction = "zoom-fit";
  zoomLabel.className = "html-page-editor-zoom-label";
  zoomLabel.title = language === "zh" ? "适应窗口" : "Fit to window";
  const zoomIn = makeButton("zoom-in", "zoom-in", "放大", "Zoom in");
  zoomOut.classList.add("icon-only");
  zoomIn.classList.add("icon-only");
  zoomOut.replaceChildren(slidesIcon("zoom-out"));
  zoomIn.replaceChildren(slidesIcon("zoom-in"));
  zoomOut.setAttribute("aria-label", language === "zh" ? "缩小画板" : "Zoom out");
  zoomIn.setAttribute("aria-label", language === "zh" ? "放大画板" : "Zoom in");
  zoomControls.append(zoomOut, zoomLabel, zoomIn);
  left.append(back, title);
  right.append(undo, redo, ai, done);
  header.append(left, zoomControls, right);
  const stage = document.createElement("main");
  const surface = document.createElement("div");
  surface.className = "html-page-editor-surface";
  const shell = document.createElement("div");
  shell.className = "html-page-editor-canvas";
  const iframe = document.createElement("iframe");
  iframe.title = language === "zh" ? "HTML 页面编辑画布" : "HTML page editing canvas";
  iframe.setAttribute("sandbox", "allow-scripts");
  shell.append(iframe);
  surface.append(shell);
  stage.append(surface);
  overlay.append(header, stage);
  document.body.append(overlay);

  const token = `html-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  iframe.srcdoc = htmlEditorDocument(object.html || "", token);
  let dirty = false;
  let saving = false;
  let editorZoom = 1;
  let autoFitZoom = true;
  let editorPanX = 0;
  let editorPanY = 0;
  let editorPanSession = null;
  let spacePanHeld = false;
  let zoomFrame = 0;
  let queuedZoomDirection = 0;
  const applyEditorPan = () => {
    surface.style.translate = `${editorPanX}px ${editorPanY}px`;
  };
  const applyEditorZoom = (nextZoom) => {
    editorZoom = Math.max(0.5, Math.min(1.6, nextZoom));
    surface.style.width = `${1024 * editorZoom}px`;
    surface.style.height = `${576 * editorZoom}px`;
    shell.style.transform = `scale(${editorZoom})`;
    zoomLabel.textContent = `${Math.round(editorZoom * 100)}%`;
    zoomOut.disabled = editorZoom <= 0.5;
    zoomIn.disabled = editorZoom >= 1.6;
  };
  const queueEditorZoom = (direction) => {
    if (!direction) return;
    queuedZoomDirection += direction;
    if (zoomFrame) return;
    zoomFrame = window.requestAnimationFrame(() => {
      const step = Math.max(-2, Math.min(2, queuedZoomDirection)) * 0.05;
      queuedZoomDirection = 0;
      zoomFrame = 0;
      applyEditorZoom(editorZoom + step);
    });
  };
  const fitEditorToStage = () => {
    const width = Math.max(1, stage.clientWidth - 72);
    const height = Math.max(1, stage.clientHeight - 72);
    editorPanX = 0;
    editorPanY = 0;
    applyEditorPan();
    applyEditorZoom(Math.min(1, width / 1024, height / 576));
  };
  const editorResizeObserver = new ResizeObserver(() => {
    if (autoFitZoom) fitEditorToStage();
  });
  editorResizeObserver.observe(stage);
  window.requestAnimationFrame(fitEditorToStage);
  const send = (command, detail = {}) => iframe.contentWindow?.postMessage({ type: "codex-canvas:html-editor-command", token, command, ...detail }, "*");
  const close = async ({ reload = false } = {}) => {
    window.removeEventListener("message", receive);
    window.removeEventListener("keydown", editorKeyDown, true);
    window.removeEventListener("keyup", editorKeyUp, true);
    if (zoomFrame) window.cancelAnimationFrame(zoomFrame);
    editorResizeObserver.disconnect();
    overlay.remove();
    if (reload) {
      lastLoadedStateSignature = null;
      suppressNextAutoFocus = true;
      await loadState();
    }
    setLocalSelection([object.id], { fromUser: true });
    render();
  };
  const receive = async (event) => {
    if (event.source !== iframe.contentWindow || event.data?.token !== token) return;
    if (event.data.type === "codex-canvas:html-editor-state") {
      dirty = Boolean(event.data.dirty);
      undo.disabled = !event.data.canUndo;
      redo.disabled = !event.data.canRedo;
    }
    if (event.data.type === "codex-canvas:html-editor-pan") {
      if (event.data.phase === "start") {
        autoFitZoom = false;
        editorPanSession = { x: event.data.x, y: event.data.y, panX: editorPanX, panY: editorPanY };
        stage.classList.add("is-panning");
      } else if (event.data.phase === "move" && editorPanSession) {
        editorPanX = editorPanSession.panX + event.data.x - editorPanSession.x;
        editorPanY = editorPanSession.panY + event.data.y - editorPanSession.y;
        applyEditorPan();
      } else if (event.data.phase === "end") {
        editorPanSession = null;
        stage.classList.remove("is-panning");
      }
    }
    if (event.data.type === "codex-canvas:html-editor-zoom") {
      autoFitZoom = false;
      queueEditorZoom(Math.sign(event.data.direction));
    }
    if (event.data.type === "codex-canvas:html-editor-save") {
      saving = true;
      done.disabled = true;
      try {
        const html = String(event.data.html || "");
        const elements = Array.isArray(event.data.elements) ? event.data.elements : [];
        const response = await fetch(apiPath(`/api/objects/${encodeURIComponent(object.id)}`), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ html, elements })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || t("jobFailed"));
        Object.assign(object, payload?.object || payload, { html, elements });
        canvasObjectRenderSignatures.delete(object.id);
        state.objects.filter((item) => item.type === "slides").forEach((deck) => canvasObjectRenderSignatures.delete(deck.id));
        showToast(language === "zh" ? "页面已保存，AI 幻灯片已同步" : "Page saved and synced to AI Slides");
        await close({ reload: true });
      } catch (error) {
        saving = false;
        done.disabled = false;
        showToast(error?.message || t("jobFailed"));
      }
    }
  };
  window.addEventListener("message", receive);
  const editorKeyDown = (event) => {
    if (event.code !== "Space" || event.repeat || isShortcutEditingTarget(event.target)) return;
    event.preventDefault();
    spacePanHeld = true;
    stage.classList.add("is-pan-ready");
    iframe.style.pointerEvents = "none";
  };
  const editorKeyUp = (event) => {
    if (event.code !== "Space") return;
    spacePanHeld = false;
    stage.classList.remove("is-pan-ready", "is-panning");
    iframe.style.pointerEvents = "";
    editorPanSession = null;
  };
  window.addEventListener("keydown", editorKeyDown, true);
  window.addEventListener("keyup", editorKeyUp, true);
  header.addEventListener("click", (event) => {
    const action = event.target.closest("[data-html-editor-action]")?.dataset.htmlEditorAction;
    if (!action || saving) return;
    if (action === "undo" || action === "redo") send(action);
    if (action === "zoom-out" || action === "zoom-in") {
      autoFitZoom = false;
      applyEditorZoom(editorZoom + (action === "zoom-in" ? 0.1 : -0.1));
    }
    if (action === "zoom-fit") {
      autoFitZoom = true;
      fitEditorToStage();
    }
    if (action === "done") send("save");
    if (action === "back") {
      if (!dirty || window.confirm(language === "zh" ? "放弃尚未保存的修改并返回画布？" : "Discard unsaved changes and return to canvas?")) close();
    }
  });
  stage.addEventListener("wheel", (event) => {
    if (!event.altKey) return;
    event.preventDefault();
    autoFitZoom = false;
    queueEditorZoom(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  stage.addEventListener("contextmenu", (event) => event.preventDefault());
  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 2 && !spacePanHeld) return;
    event.preventDefault();
    autoFitZoom = false;
    editorPanSession = { x: event.clientX, y: event.clientY, panX: editorPanX, panY: editorPanY, id: event.pointerId };
    stage.setPointerCapture?.(event.pointerId);
    stage.classList.add("is-panning");
  });
  stage.addEventListener("pointermove", (event) => {
    if (!editorPanSession || editorPanSession.id !== event.pointerId) return;
    editorPanX = editorPanSession.panX + event.clientX - editorPanSession.x;
    editorPanY = editorPanSession.panY + event.clientY - editorPanSession.y;
    applyEditorPan();
  });
  const finishStagePan = (event) => {
    if (!editorPanSession || editorPanSession.id !== event.pointerId) return;
    editorPanSession = null;
    stage.classList.remove("is-panning");
  };
  stage.addEventListener("pointerup", finishStagePan);
  stage.addEventListener("pointercancel", finishStagePan);
}

function htmlEditorDocument(source, token) {
  const tokenLiteral = JSON.stringify(token).replaceAll("<", "\\u003c");
  const bridge = `<style data-codex-html-editor>html,body{min-width:1024px;min-height:576px}*[data-codex-editor-selected]{outline:1px solid #2563eb!important;outline-offset:0!important;box-shadow:0 0 0 1px rgb(255 255 255 / 55%)!important;cursor:move!important}*[contenteditable="true"]{cursor:text!important}</style><script data-codex-html-editor>(()=>{const token=${tokenLiteral};let history=[],future=[],dirty=false,selected=null,start=null;const notify=()=>parent.postMessage({type:'codex-canvas:html-editor-state',token,dirty,canUndo:history.length>0,canRedo:future.length>0},'*');const snapshot=()=>document.body.innerHTML;const checkpoint=()=>{history.push(snapshot());if(history.length>50)history.shift();future=[];dirty=true;notify()};const select=(el)=>{selected?.removeAttribute('data-codex-editor-selected');selected=el&&el!==document.body&&el!==document.documentElement?el:null;selected?.setAttribute('data-codex-editor-selected','')};document.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();select(e.target) },true);document.addEventListener('dblclick',e=>{const el=e.target;if(el.children.length===0||/^(P|H1|H2|H3|H4|H5|H6|SPAN|A|BUTTON|LI|TD|TH|LABEL)$/.test(el.tagName)){checkpoint();el.contentEditable='true';el.focus()}},true);document.addEventListener('blur',e=>{if(e.target?.isContentEditable){e.target.removeAttribute('contenteditable');dirty=true;notify()}},true);document.addEventListener('pointerdown',e=>{if(!selected||e.target!==selected||selected.isContentEditable)return;checkpoint();const s=getComputedStyle(selected);if(s.position==='static')selected.style.position='relative';start={x:e.clientX,y:e.clientY,left:parseFloat(s.left)||0,top:parseFloat(s.top)||0,id:e.pointerId};selected.setPointerCapture?.(e.pointerId);e.preventDefault()},true);document.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.id)return;selected.style.left=(start.left+e.clientX-start.x)+'px';selected.style.top=(start.top+e.clientY-start.y)+'px'},true);document.addEventListener('pointerup',e=>{if(start?.id===e.pointerId){start=null;dirty=true;notify()}},true);document.addEventListener('keydown',e=>{const modifier=e.ctrlKey||e.metaKey;if(modifier&&e.key.toLowerCase()==='z'&&!selected?.isContentEditable){if(e.shiftKey&&future.length){history.push(snapshot());document.body.innerHTML=future.pop()}else if(!e.shiftKey&&history.length){future.push(snapshot());document.body.innerHTML=history.pop()}else return;selected=null;dirty=true;notify();e.preventDefault();return}if(modifier&&e.key.toLowerCase()==='y'&&!selected?.isContentEditable&&future.length){history.push(snapshot());document.body.innerHTML=future.pop();selected=null;dirty=true;notify();e.preventDefault();return}if((e.key==='Delete'||e.key==='Backspace')&&selected&&!selected.isContentEditable){checkpoint();selected.remove();selected=null;e.preventDefault()}},true);addEventListener('message',e=>{const d=e.data;if(d?.type!=='codex-canvas:html-editor-command'||d.token!==token)return;if(d.command==='undo'&&history.length){future.push(snapshot());document.body.innerHTML=history.pop();selected=null;dirty=true;notify()}if(d.command==='redo'&&future.length){history.push(snapshot());document.body.innerHTML=future.pop();selected=null;dirty=true;notify()}if(d.command==='save'){let sequence=0;const rootRect=document.body.getBoundingClientRect();const nodes=[...document.body.querySelectorAll('*')].filter(n=>!n.matches('[data-codex-html-editor],script,style,link,meta')).slice(0,300);nodes.forEach(n=>{if(!n.dataset.slideElementId)n.dataset.slideElementId='element-'+(++sequence)});const elements=nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),p=n.parentElement?.closest('[data-slide-element-id]');const isText=n.children.length===0&&n.textContent?.trim();const mode=s.display==='grid'?'grid':s.display==='flex'?(s.flexDirection.startsWith('column')?'column':'row'):'free';return{id:n.dataset.slideElementId,type:n.tagName==='IMG'?'image':isText?'text':n.children.length?'group':'shape',tag:n.tagName.toLowerCase(),parentId:p?.dataset.slideElementId||null,x:Math.round(r.left-rootRect.left),y:Math.round(r.top-rootRect.top),width:Math.max(1,Math.round(r.width)),height:Math.max(1,Math.round(r.height)),text:isText?n.textContent:'',src:n.tagName==='IMG'?(n.getAttribute('src')||''):'',locked:n.dataset.locked==='true',aiLocked:n.dataset.aiLocked==='true',style:{color:s.color,background:s.background,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,textAlign:s.textAlign,borderRadius:s.borderRadius,opacity:s.opacity,transform:s.transform==='none'?'':s.transform},layout:{mode,gap:s.gap,padding:s.padding,align:s.alignItems,justify:s.justifyContent,columns:s.gridTemplateColumns}}});const clone=document.documentElement.cloneNode(true);clone.querySelectorAll('[data-codex-html-editor]').forEach(n=>n.remove());clone.querySelectorAll('[data-codex-editor-selected]').forEach(n=>n.removeAttribute('data-codex-editor-selected'));clone.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'));parent.postMessage({type:'codex-canvas:html-editor-save',token,html:'<!doctype html>'+clone.outerHTML,elements},'*')}});notify()})()<\/script>`;
  const stableBridge = bridge.replace(
    "document.addEventListener('pointerdown',e=>{if(!selected||e.target!==selected||selected.isContentEditable)return;checkpoint();const s=getComputedStyle(selected);if(s.position==='static')selected.style.position='relative';start={x:e.clientX,y:e.clientY,left:parseFloat(s.left)||0,top:parseFloat(s.top)||0,id:e.pointerId};selected.setPointerCapture?.(e.pointerId);e.preventDefault()},true);document.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.id)return;selected.style.left=(start.left+e.clientX-start.x)+'px';selected.style.top=(start.top+e.clientY-start.y)+'px'},true);document.addEventListener('pointerup',e=>{if(start?.id===e.pointerId){start=null;dirty=true;notify()}},true);",
    "document.addEventListener('pointerdown',e=>{if(e.button===2||window.__codexEditorSpacePan||!selected||e.target!==selected||selected.isContentEditable)return;const s=getComputedStyle(selected);start={x:e.clientX,y:e.clientY,left:parseFloat(s.left)||0,top:parseFloat(s.top)||0,id:e.pointerId,moved:false,wasStatic:s.position==='static'};selected.setPointerCapture?.(e.pointerId);e.preventDefault()},true);document.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(!start.moved&&Math.hypot(dx,dy)<=4)return;if(!start.moved){checkpoint();if(start.wasStatic)selected.style.position='relative';start.moved=true}selected.style.left=(start.left+dx)+'px';selected.style.top=(start.top+dy)+'px'},true);document.addEventListener('pointerup',e=>{if(start?.id===e.pointerId){const moved=start.moved;start=null;if(moved){dirty=true;notify()}}},true);"
  ).replace(
    "document.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();select(e.target) },true);",
    "document.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(window.__codexSuppressEditorClick){window.__codexSuppressEditorClick=false;return}select(e.target) },true);"
  );
  const guideBridge = `<script data-codex-html-editor>(${htmlEditorGuidesRuntime.toString()})()<\/script>`;
  const panBridge = `<script data-codex-html-editor>(${htmlEditorPanRuntime.toString()})(${tokenLiteral})<\/script>`;
  const html = source || "<!doctype html><html><head></head><body></body></html>";
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${stableBridge}${guideBridge}${panBridge}</body>`) : `${html}${stableBridge}${guideBridge}${panBridge}`;
}

function htmlEditorPanRuntime(token) {
  let spaceHeld = false;
  let panning = false;
  let panFrame = 0;
  let pendingMove = null;
  let zoomFrame = 0;
  let pendingZoomDirection = 0;
  const editable = (target) => target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || "");
  const send = (phase, event) => parent.postMessage({ type: "codex-canvas:html-editor-pan", token, phase, x: event.clientX, y: event.clientY }, "*");
  addEventListener("keydown", (event) => {
    if (event.code !== "Space" || editable(event.target)) return;
    spaceHeld = true;
    window.__codexEditorSpacePan = true;
    event.preventDefault();
  }, true);
  addEventListener("keyup", (event) => {
    if (event.code !== "Space") return;
    spaceHeld = false;
    window.__codexEditorSpacePan = false;
  }, true);
  addEventListener("pointerdown", (event) => {
    if (event.button !== 2 && !spaceHeld) return;
    panning = true;
    window.__codexSuppressEditorClick = true;
    event.target?.setPointerCapture?.(event.pointerId);
    send("start", event);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  addEventListener("pointermove", (event) => {
    if (!panning) return;
    pendingMove = { clientX: event.clientX, clientY: event.clientY };
    if (!panFrame) panFrame = requestAnimationFrame(() => {
      panFrame = 0;
      if (pendingMove) send("move", pendingMove);
      pendingMove = null;
    });
    event.preventDefault();
  }, true);
  const finish = (event) => {
    if (!panning) return;
    panning = false;
    if (panFrame) cancelAnimationFrame(panFrame);
    panFrame = 0;
    if (pendingMove) send("move", pendingMove);
    pendingMove = null;
    send("end", event);
    event.preventDefault();
  };
  addEventListener("pointerup", finish, true);
  addEventListener("pointercancel", finish, true);
  addEventListener("contextmenu", (event) => event.preventDefault(), true);
  addEventListener("wheel", (event) => {
    if (!event.altKey) return;
    pendingZoomDirection += event.deltaY < 0 ? 1 : -1;
    if (!zoomFrame) zoomFrame = requestAnimationFrame(() => {
      if (pendingZoomDirection) parent.postMessage({ type: "codex-canvas:html-editor-zoom", token, direction: pendingZoomDirection }, "*");
      pendingZoomDirection = 0;
      zoomFrame = 0;
    });
    event.preventDefault();
  }, { capture: true, passive: false });
}

function htmlEditorGuidesRuntime() {
  const makeGuide = (axis) => {
    const guide = document.createElement("div");
    guide.dataset.codexHtmlEditor = "";
    guide.style.cssText = `position:fixed;z-index:2147483646;display:none;pointer-events:none;opacity:.9;${axis === "x" ? "top:0;bottom:0;width:1px;background:repeating-linear-gradient(to bottom,#2563eb 0 4px,transparent 4px 8px)" : "left:0;right:0;height:1px;background:repeating-linear-gradient(to right,#2563eb 0 4px,transparent 4px 8px)"}`;
    document.documentElement.append(guide);
    return guide;
  };
  const vertical = makeGuide("x");
  const horizontal = makeGuide("y");
  let dragging = null;
  let dragOrigin = null;
  let xTargets = [];
  let yTargets = [];
  const hide = () => { vertical.style.display = "none"; horizontal.style.display = "none"; };
  document.addEventListener("pointerdown", (event) => {
    dragging = event.target?.closest?.("[data-codex-editor-selected]") || null;
    if (!dragging || dragging.isContentEditable) { dragging = null; return; }
    dragOrigin = { x: event.clientX, y: event.clientY, active: false };
    const candidates = [...document.body.querySelectorAll("*")].filter((node) => (
      node !== dragging
      && !node.contains(dragging)
      && !dragging.contains(node)
      && !node.matches("script,style,[data-codex-html-editor]")
    )).slice(0, 300);
    xTargets = [];
    yTargets = [];
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      xTargets.push(rect.left, rect.left + rect.width / 2, rect.right);
      yTargets.push(rect.top, rect.top + rect.height / 2, rect.bottom);
    }
  }, true);
  document.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    if (!dragOrigin.active && Math.hypot(event.clientX - dragOrigin.x, event.clientY - dragOrigin.y) <= 4) return;
    dragOrigin.active = true;
    const rect = dragging.getBoundingClientRect();
    const xEdges = [rect.left, rect.left + rect.width / 2, rect.right];
    const yEdges = [rect.top, rect.top + rect.height / 2, rect.bottom];
    const nearest = (edges, targets) => {
      let best = null;
      for (const edge of edges) for (const target of targets) {
        const delta = target - edge;
        if (Math.abs(delta) <= 6 && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, target };
      }
      return best;
    };
    const snapX = nearest(xEdges, xTargets);
    const snapY = nearest(yEdges, yTargets);
    if (snapX) {
      dragging.style.left = `${(parseFloat(dragging.style.left) || 0) + snapX.delta}px`;
      vertical.style.left = `${snapX.target}px`;
      vertical.style.display = "block";
    } else vertical.style.display = "none";
    if (snapY) {
      dragging.style.top = `${(parseFloat(dragging.style.top) || 0) + snapY.delta}px`;
      horizontal.style.top = `${snapY.target}px`;
      horizontal.style.display = "block";
    } else horizontal.style.display = "none";
  }, true);
  document.addEventListener("pointerup", () => { dragging = null; dragOrigin = null; hide(); }, true);
  document.addEventListener("pointercancel", () => { dragging = null; dragOrigin = null; hide(); }, true);
}

function updateSlidesCleanMode(object) {
  const selectedDeck = hasUserSelection && object?.type === "slides" ? object : null;
  if (selectedDeck) {
    lastSlidesDeckId = selectedDeck.id;
    localStorage.setItem("codex-canvas:last-slides-deck-id", selectedDeck.id);
  }
  const deck = state?.objects.find((item) => item.type === "slides" && item.id === lastSlidesDeckId)
    || state?.objects.find((item) => item.type === "slides")
    || null;
  activeSlidesDeckId = slidesWorkspaceOpen ? deck?.id || null : null;
  document.body.classList.toggle("slides-workspace-open", Boolean(slidesWorkspaceOpen));
  document.querySelector('[data-view-action="add-slides"]')?.classList.toggle("active", Boolean(slidesWorkspaceOpen));
  document.querySelector('[data-view-action="add-slides"]')?.setAttribute("aria-pressed", String(Boolean(slidesWorkspaceOpen)));
  if (!deck) return;
  const candidates = selectedSlideCandidates(deck);
  document.querySelectorAll(`.slides-deck-add[data-deck-id="${CSS.escape(deck.id)}"], .slides-deck-add-selected[data-deck-id="${CSS.escape(deck.id)}"]`).forEach((button) => {
    updateAddSelectedSlidesButton(button, deck, candidates);
  });
}

function setSlidesWorkspaceOpen(open) {
  slidesWorkspaceOpen = Boolean(open);
  localStorage.setItem("codex-canvas:slides-workspace-open", String(slidesWorkspaceOpen));
}

async function toggleSlidesWorkspace() {
  if (slidesWorkspaceOpen) {
    setSlidesWorkspaceOpen(false);
    render();
    return;
  }
  setSlidesWorkspaceOpen(true);
  const existingDeck = state?.objects.find((item) => item.type === "slides" && item.id === lastSlidesDeckId)
    || state?.objects.find((item) => item.type === "slides");
  if (existingDeck) {
    lastSlidesDeckId = existingDeck.id;
    localStorage.setItem("codex-canvas:last-slides-deck-id", existingDeck.id);
    render();
    return;
  }
  await createSlideObject("slides");
}

async function createSlidesDeck(mode, { deckTemplate, count: resolvedCount }) {
  // Invocation pattern: createSlidesDeck("auto", { deckTemplate, count: resolvedCount })
  if (mode !== "auto") throw new Error(`Unsupported deck mode: ${mode}`);
  const deck = await createSlideObject("slides");
  if (!deck) return null;
  const draft = freshSlidesGeneratorDraft({ count: resolvedCount || 5, deckTemplateId: deckTemplate || "freeform" });
  slidesGeneratorDraftByDeck.set(deck.id, draft);
  setSlidesWorkspaceOpen(true);
  lastSlidesDeckId = deck.id;
  localStorage.setItem("codex-canvas:last-slides-deck-id", deck.id);
  activeSlidesDeckId = deck.id;
  render();
  return deck;
}

function selectedSlideCandidates(deck) {
  if (!deck) return [];
  return selectedObjects().filter((item) => {
    const type = item.type || "image";
    return ["image", "html", "slide-frame"].includes(type) && item.slideDeckId !== deck.id && isSlideCompatibleAspectRatio(item);
  });
}

function isSlideCompatibleAspectRatio(item) {
  const width = Number(item.width) || 0;
  const height = Number(item.height) || 0;
  if (!width || !height) return true;
  const ratio = width / height;
  const target = 16 / 9;
  return ratio >= target * 0.95 && ratio <= target * 1.05;
}

async function addSelectedObjectsToSlides(deckId = activeSlidesDeckId) {
  const deck = state?.objects.find((item) => item.id === deckId && item.type === "slides");
  if (!deck) return;
  const additions = selectedSlideCandidates(deck);
  if (!additions.length) {
    const hasSelected = selectedObjects().some((item) => {
      const type = item.type || "image";
      return ["image", "html", "slide-frame"].includes(type) && item.slideDeckId !== deck.id;
    });
    showToast(language === "zh"
      ? (hasSelected ? "选中的内容不符合 16:9 比例，无法添加" : "请先单选或框选画布上的图片")
      : (hasSelected ? "Selected content is not 16:9 aspect ratio" : "Select canvas images first"));
    return;
  }
  await addObjectsToSlides(deck, additions);
}

async function addObjectsToSlides(deck, additions) {
  if (!deck || !additions.length) return;
  const existing = slidesForDeck(deck).filter((item) => !additions.some((addition) => addition.id === item.id));
  const activeIndex = existing.length ? Math.min(activeSlideIndexByDeck.get(deck.id) ?? (existing.length - 1), existing.length - 1) : -1;
  const insertAt = Math.min(existing.length, Math.max(0, activeIndex + 1));
  const members = [...existing.slice(0, insertAt), ...additions, ...existing.slice(insertAt)];
  const updates = [{ id: deck.id, patch: { slideIds: members.map((item) => item.id) } }];
  members.forEach((item, slideOrder) => updates.push({ id: item.id, patch: { slideDeckId: deck.id, slideOrder } }));
  const payload = await patchCanvasObjects(updates, selectionSnapshotForIds(additions.map((item) => item.id)), currentCanvasScopeMeta());
  replaceLocalObjects(payload.objects || []);
  refreshKnownObjectIds();
  canvasObjectRenderSignatures.delete(deck.id);
  setLocalSelection([]);
  slidesGeneratorOpenByDeck.delete(deck.id);
  activeSlideIndexByDeck.set(deck.id, insertAt);
  render();
  showToast(language === "zh" ? `已添加 ${additions.length} 张幻灯片` : `Added ${additions.length} slide${additions.length === 1 ? "" : "s"}`);
}

function slidesForDeck(deck) {
  if (!deck) return [];
  const legacyOrder = new Map((deck.slideIds || []).map((id, index) => [id, index]));
  return state.objects
    .filter((item) => ["image", "html", "slide-frame"].includes(item.type || "image")
      && (item.slideDeckId === deck.id || legacyOrder.has(item.id)))
    .sort((left, right) => {
      const leftOrder = left.slideDeckId === deck.id && Number.isFinite(left.slideOrder) ? left.slideOrder : legacyOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.slideDeckId === deck.id && Number.isFinite(right.slideOrder) ? right.slideOrder : legacyOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.x - right.x;
    });
}

function slidesDeckDisplayName(deck) {
  const name = String(deck?.name || "").trim();
  if (language === "zh" && (!name || name === "AI Slides" || name === "Al Slides")) return "AI幻灯片";
  return name || "AI Slides";
}

async function slidesReferenceDataUrl(file) {
  const source = await readFileAsDataUrl(file);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const width = 320; const height = 180; const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d"); const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight); const drawWidth = image.naturalWidth * scale; const drawHeight = image.naturalHeight * scale;
      context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight); resolve({ kind:"image", name:String(file.name || "reference image").slice(0, 160), dataUrl:canvas.toDataURL("image/jpeg", 0.68) });
    };
    image.onerror = () => resolve(null); image.src = source;
  });
}

async function slidesPresentationReference(file) {
  if (/\.ppt$/i.test(file.name || "")) throw new Error(language === "zh" ? "旧版 .ppt 暂不支持，请先在 PowerPoint 中另存为 .pptx。" : "Legacy .ppt is not supported. Save it as .pptx first.");
  if (!/\.pptx$/i.test(file.name || "") && !/presentationml\.presentation/i.test(file.type || "")) return null;
  if (file.size > 16 * 1024 * 1024) throw new Error(language === "zh" ? "PPTX 参考文件不能超过 16 MB。" : "PPTX references must be 16 MB or smaller.");
  return { kind:"pptx", name:String(file.name || "reference.pptx").slice(0, 160), dataUrl:await readFileAsDataUrl(file) };
}

function renderSlidesGenerator(deck, { append = false } = {}) {
  const panel = document.createElement("form"); panel.className = "slides-generator slides-generator-workflow";
  panel.addEventListener("pointerdown", (event) => event.stopPropagation());
  panel.addEventListener("click", (event) => event.stopPropagation());
  const draft = slidesGeneratorDraftByDeck.get(deck.id) || freshSlidesGeneratorDraft();
  const deckSlides = slidesForDeck(deck);
  if (!deckSlides.length && (draft.targetSlideId || ["review","done"].includes(draft.phase))) Object.assign(draft, freshSlidesGeneratorDraft());
  slidesGeneratorDraftByDeck.set(deck.id, draft);
  let count = draft.count; let references = draft.references; let outline = draft.outline; let brief = draft.brief; let requirements = draft.requirements; let storyline = draft.storyline || draft.outline?.storyline || null; let structure = draft.structure || draft.outline?.structure || null; let designSystem = draft.designSystem || draft.outline?.designSystem || null; let visualRhythm = draft.visualRhythm || draft.outline?.visualRhythm || null; let draggedIndex = -1;
  let outlineCountdownTimer = null; let phaseEffectCleanup = null;
  const clearOutlineCountdown = () => {
    if (outlineCountdownTimer) window.clearInterval(outlineCountdownTimer);
    outlineCountdownTimer = null;
    phaseEffectCleanup?.(); phaseEffectCleanup = null;
  };
  const selectedPresetIds = new Set(draft.presetIds);
  const syncDraft = (patch = {}) => { Object.assign(draft, { topic:draft.topic || "", count, references, presetIds:[...selectedPresetIds], outline, brief, requirements, storyline, structure, designSystem, visualRhythm }, patch); slidesGeneratorDraftByDeck.set(deck.id, draft); persistSlidesDrafts(); };
  const setPanelMode = (mode = "") => {
    panel.onkeydown = null; panel.onsubmit = null;
    panel.classList.remove("is-entry", "is-brief-review", "is-requirements", "is-storyline", "is-structure", "is-visual-system", "is-outline", "is-progress", "is-generation");
    if (mode) panel.classList.add(`is-${mode}`);
  };
  const installIdleAutoConfirm = ({ phase, button, toggle, label, badge, submit, idleLabel = null }) => {
    let remaining = 15; let idleResumeTimer = null; let lastPointerSignal = 0;
    const stopTicking = () => { if (outlineCountdownTimer) window.clearInterval(outlineCountdownTimer); outlineCountdownTimer = null; };
    const update = (paused = false) => {
      badge.textContent = toggle.checked ? String(remaining) : "—";
      badge.setAttribute("aria-label", language === "zh" ? `${remaining} 秒后自动确认` : `Auto-confirm in ${remaining} seconds`);
      label.textContent = idleLabel || (!toggle.checked
        ? (language === "zh" ? "自动确认已关闭" : "Auto-confirm is off")
        : paused
          ? (language === "zh" ? "正在操作，倒计时已暂停" : "Paused while you edit")
          : (language === "zh" ? `${remaining} 秒无操作后自动确认` : `Auto-confirm after ${remaining}s idle`));
      button.style.setProperty("--outline-countdown-progress", `${toggle.checked ? (remaining / 15) * 100 : 0}%`);
    };
    const startTicking = () => {
      stopTicking();
      if (!toggle.checked) { update(); return; }
      update(false);
      outlineCountdownTimer = window.setInterval(() => {
        if (!panel.isConnected || draft.phase !== phase || !toggle.checked) { stopTicking(); return; }
        if (panel.contains(document.activeElement) && document.activeElement.matches("input,textarea,[contenteditable='true']")) { update(true); return; }
        remaining -= 1; update(false);
        if (remaining <= 0) { stopTicking(); button.disabled = true; submit(); }
      }, 1000);
    };
    const signalActivity = (event) => {
      if (event?.type === "pointermove") {
        const now = performance.now(); if (now - lastPointerSignal < 180) return; lastPointerSignal = now;
      }
      if (!toggle.checked) return;
      stopTicking(); remaining = 15; update(true);
      if (idleResumeTimer) window.clearTimeout(idleResumeTimer);
      idleResumeTimer = window.setTimeout(startTicking, 1600);
    };
    const events = ["pointerdown", "pointermove", "input", "change", "keydown", "focusin", "focusout", "dragstart", "dragover"];
    events.forEach((name) => panel.addEventListener(name, signalActivity, true));
    toggle.onchange = () => {
      remaining = 15;
      if (toggle.checked) signalActivity();
      else { stopTicking(); if (idleResumeTimer) window.clearTimeout(idleResumeTimer); update(); }
    };
    startTicking();
    phaseEffectCleanup = () => {
      stopTicking(); if (idleResumeTimer) window.clearTimeout(idleResumeTimer);
      events.forEach((name) => panel.removeEventListener(name, signalActivity, true));
    };
    return signalActivity;
  };
  const presetCatalog = [
    { id:"product", zh:"产品发布", en:"Product launch", category:"use" }, { id:"report", zh:"项目汇报", en:"Project report", category:"use" }, { id:"pitch", zh:"融资路演", en:"Investor pitch", category:"use" }, { id:"portfolio", zh:"作品集", en:"Portfolio", category:"use" },
    { id:"professional", zh:"专业简洁", en:"Professional", category:"style" }, { id:"technology", zh:"科技视觉", en:"Technology", category:"style" }, { id:"editorial", zh:"编辑杂志", en:"Editorial", category:"style" }, { id:"minimal", zh:"极简留白", en:"Minimal", category:"style" },
    { id:"executive", zh:"管理层", en:"Executives", category:"audience" }, { id:"customer", zh:"客户", en:"Customers", category:"audience" }, { id:"investor", zh:"投资人", en:"Investors", category:"audience" }, { id:"public", zh:"大众", en:"General audience", category:"audience" }
  ];
  const presetLabel = (preset) => `@${language === "zh" ? preset.zh : preset.en}`;
  const recommendedPresetIds = (topic = "") => {
    const text = topic.toLowerCase();
    if (/融资|路演|投资|fund|pitch/.test(text)) return ["pitch","investor","professional"];
    if (/作品集|求职|设计|portfolio|ux|ui/.test(text)) return ["portfolio","editorial","executive"];
    if (/发布|产品|客户|launch|product/.test(text)) return ["product","customer","technology"];
    if (/汇报|总结|进展|report|review/.test(text)) return ["report","executive","professional"];
    return ["professional","executive","product"];
  };
  const pollSlidesJob = pollSlidesJobGlobal;
  const briefPrompt = () => JSON.stringify(brief, null, 2);
  const requirementsFromBrief = (source) => {
    const text = `${source?.topic || ""} ${source?.goal || ""} ${source?.audience || ""}`.toLowerCase();
    const portfolio = /ui|ux|作品集|portfolio|求职|面试/.test(text);
    const goalOptions = portfolio ? ["求职作品集展示","个人设计能力展示","项目案例汇报","设计流程与方法论分享"] : [source?.goal,"清晰传达主题并推动理解","展示成果与专业能力","说服决策并推动行动"];
    const audienceOptions = portfolio ? ["互联网求职面试官","企业 HR 与设计团队","设计评审委员会","客户或合作方"] : [source?.audience,"管理层与决策者","专业团队","客户与合作伙伴"];
    const scenarioOptions = portfolio ? ["现场求职面试","线上面试与屏幕共享","作品集自主投递阅读","设计评审与答辩"] : [source?.scenario,"现场演示，画面为主","线上会议与屏幕共享","自行阅读，信息更完整"];
    const recommended = String(Math.max(1, Math.min(20, Number(source?.recommendedPageCount) || count || 8)));
    const clean = (items) => [...new Set(items.map((item) => String(item || "").trim()).filter((item) => item && !/AI 智能判断|^Auto$/i.test(item)))].slice(0,4);
    return {
      goal:{ selected:clean(goalOptions)[0], options:clean(goalOptions), customOptions:[] },
      audience:{ selected:clean(audienceOptions)[0], options:clean(audienceOptions), customOptions:[] },
      scenario:{ selected:clean(scenarioOptions)[0], options:clean(scenarioOptions), customOptions:[] },
      length:{ selected:recommended, options:[recommended,"8","12","15"], customOptions:[] }
    };
  };
  const finishOutlineJob = async (job, status, elapsed, token) => {
    try {
      job = await pollSlidesJob(job, (current) => {
        if (draft.pollToken !== token) return;
        const seconds = Math.max(0, Number(current.elapsedSeconds) || 0);
        status.textContent = language === "zh" ? "AI 正在规划叙事结构和页面角色…" : "AI is planning the narrative and page roles…";
        elapsed.textContent = `${formatSlidesElapsed(seconds)} · ${language === "zh" ? "完成后会自动提醒" : "You will be notified"}`;
      });
      if (draft.pollToken !== token) return;
      outline = job.outline;
      const continueToOutline = Boolean(draft.continueToOutlineAfterPlanning);
      const continueToStoryline = Boolean(draft.continueToStorylineAfterPlanning);
      const continueToStructure = Boolean(draft.continueToStructureAfterPlanning);
      storyline = (continueToOutline || continueToStructure) && draft.confirmedStoryline ? structuredClone(draft.confirmedStoryline) : outline.storyline;
      outline.storyline = structuredClone(storyline);
      structure = continueToOutline && draft.confirmedStructure ? structuredClone(draft.confirmedStructure) : outline.structure;
      outline.structure = structuredClone(structure);
      designSystem = outline.designSystem || designSystem;
      visualRhythm = outline.visualRhythm || visualRhythm;
      outline.slides.forEach((slide, index) => { const page = structure?.pages?.[index]; if (!page) return; slide.role = page.role; slide.chapterId = page.chapterId; slide.layoutFamily = page.layoutFamily; });
      const fallbackRequirements = {
        goal:{ selected:brief?.goal && !/AI|Auto/i.test(brief.goal) ? brief.goal : (language === "zh" ? "清晰传达主题并推动理解" : "Explain the topic clearly"), options:language === "zh" ? ["清晰传达主题并推动理解","说服决策并推动行动","展示成果与专业能力"] : ["Explain the topic clearly","Drive a decision or action","Showcase outcomes and expertise"] },
        audience:{ selected:brief?.audience && !/AI|Auto/i.test(brief.audience) ? brief.audience : (language === "zh" ? "与主题相关的专业受众" : "Relevant professional audience"), options:language === "zh" ? ["与主题相关的专业受众","管理层与决策者","客户与合作伙伴"] : ["Relevant professional audience","Executives and decision-makers","Customers and partners"] },
        scenario:{ selected:brief?.scenario && !/AI|Auto/i.test(brief.scenario) ? brief.scenario : (language === "zh" ? "现场演示，画面为主" : "Live presentation, visual first"), options:language === "zh" ? ["现场演示，画面为主","线上会议与屏幕共享","自行阅读，信息更完整"] : ["Live presentation, visual first","Online meeting and screen sharing","Self-read with more detail"] },
        length:{ selected:String(outline.slides.length), options:[String(outline.slides.length), "8", "12"] }
      };
      requirements = requirements || outline.requirements || fallbackRequirements;
      for (const key of ["goal","audience","scenario","length"]) {
        const fallback = fallbackRequirements[key]; const group = requirements?.[key] || fallback;
        const selected = String(group.selected || fallback.selected).trim();
        requirements[key] = { selected, options:[...new Set([selected, ...(group.options || []), ...fallback.options].map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 6), customOptions:Array.isArray(group.customOptions) ? group.customOptions.map((item) => String(item || "").trim()).filter(Boolean) : [] };
      }
      requirements.length = { ...(requirements.length || fallbackRequirements.length), selected:String(outline.slides.length) };
      outline.requirements = structuredClone(requirements);
      const requirementsBaseline = {
        goal:requirements.goal.selected,
        audience:requirements.audience.selected,
        scenario:requirements.scenario.selected,
        length:String(outline.slides.length)
      };
      const nextPhase = "structure";
      syncDraft({ outline, storyline, structure, designSystem, visualRhythm, deckTemplateId:job.deckTemplateId || "freeform", templateConfidence:Number(job.templateConfidence) || 0, templateRecommendations:Array.isArray(job.templateRecommendations) ? job.templateRecommendations : [], storylineBaseline:JSON.stringify(storyline), structureBaseline:JSON.stringify(structure), requirements, requirementsBaseline, activeJobId:null, phase:nextPhase, continueToOutlineAfterPlanning:false, continueToStorylineAfterPlanning:false, continueToStructureAfterPlanning:false, confirmedStoryline:null, confirmedStructure:null, lastError:null });
      showToast(language === "zh" ? `大纲生成成功 · ${outline.slides.length} 页` : `Outline ready · ${outline.slides.length} pages`);
      renderStructure();
    } catch (error) {
      if (draft.pollToken !== token) return;
      const message = error?.message || t("jobFailed"); syncDraft({ activeJobId:null, phase:"brief", lastError:message });
      showToast(language === "zh" ? `大纲生成失败：${message}` : `Outline failed: ${message}`);
      renderBrief(); const restoredStatus = panel.querySelector(".slides-generator-status"); restoredStatus.textContent = language === "zh" ? `生成失败：${message}` : `Generation failed: ${message}`; restoredStatus.classList.add("error");
    }
  };
  const renderWorkflowStageBar = (activeStep = 0) => {
    const labels = language === "zh" ? ["分析需求", "整理大纲", "视觉生成"] : ["Analyze", "Outline", "Design"];
    return `<nav class="slides-progress-stage slides-workflow-stage-bar" aria-label="${language === "zh" ? "幻灯片生成阶段" : "Presentation generation stages"}">${labels.map((label, index) => `<span class="${index < activeStep ? "done" : index === activeStep ? "active" : ""}"${index === activeStep ? ' aria-current="step"' : ""}>${label}</span>`).join("")}</nav>`;
  };
  const renderPlanning = async (initialJob = null) => {
    clearOutlineCountdown(); setPanelMode("progress");
    panel.innerHTML = `<section class="slides-progress-card"><div class="slides-progress-stage"><span class="active">${language === "zh" ? "分析需求" : "Analyze"}</span><span>${language === "zh" ? "整理大纲" : "Outline"}</span><span>${language === "zh" ? "视觉生成" : "Design"}</span></div><div class="slides-progress-hero" role="status" aria-live="polite"><span class="slides-planning-spinner" aria-hidden="true"></span><div><span class="slides-outline-eyebrow">${language === "zh" ? "正在规划" : "Planning"}</span><strong>${language === "zh" ? "正在把需求整理成可确认的方案" : "Turning your brief into a plan you can confirm"}</strong><p>${language === "zh" ? "AI 正在提取核心目标、目标受众、演示场景，并建立连贯的页面叙事。" : "AI is extracting the goal, audience, scenario, and a coherent page narrative."}</p><small>${language === "zh" ? "正在连接任务…" : "Connecting to task…"}</small></div></div><div class="slides-progress-line" aria-hidden="true"><i></i></div><button type="button" class="slides-planning-stop">${language === "zh" ? "停止生成" : "Stop generation"}</button></section>`;
    const status = panel.querySelector(".slides-progress-hero p"); const elapsed = panel.querySelector(".slides-progress-hero small"); const token = {}; draft.pollToken = token;
    panel.querySelector(".slides-planning-stop").onclick = async () => { if (!draft.activeJobId) return; const jobId = draft.activeJobId; draft.pollToken = {}; try { await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(jobId)}`), { method:"DELETE" }); } catch {} syncDraft({ activeJobId:null, phase:"brief" }); showToast(language === "zh" ? "已停止大纲生成" : "Outline generation stopped"); renderBrief(); };
    try {
      let job = initialJob;
      if (!job) { const response = await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.activeJobId)}`)); job = await response.json(); if (!response.ok) throw new Error(job.error || t("jobFailed")); }
      await finishOutlineJob(job, status, elapsed, token);
    } catch (error) {
      if (draft.pollToken !== token) return; const message = error?.message || t("jobFailed"); syncDraft({ activeJobId:null, phase:"brief", lastError:message }); showToast(language === "zh" ? `无法恢复大纲任务：${message}` : `Could not resume outline task: ${message}`); renderBrief();
    }
  };
  const startOutlineFromBrief = async (nextBrief, nextCount = count, statusElement = null) => {
    brief = nextBrief;
    count = Math.max(1, Math.min(20, Number(nextCount) || 5));
    syncDraft({ topic:brief.topic || draft.topic || "", brief, count, optimizedBrief:brief, briefJobId:null, phase:"planning", lastError:null });
    try {
      const response = await fetch(apiPath("/api/slides/jobs"), { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"plan-slides", deckId:deck.id, prompt:briefPrompt(), pageCount:count, references }) });
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || t("jobFailed"));
      syncDraft({ activeJobId:job.id, phase:"planning", lastError:null });
      showToast(language === "zh" ? "需求已确认，AI 正在规划大纲" : "Brief confirmed; AI is planning the outline");
      renderPlanning(job);
    } catch (error) {
      const message = error?.message || t("jobFailed");
      requirements ||= requirementsFromBrief(brief);
      syncDraft({ activeJobId:null, requirements, phase:"requirements", lastError:message });
      if (statusElement) { statusElement.textContent = language === "zh" ? `启动失败：${message}` : `Could not start: ${message}`; statusElement.classList.add("error"); }
      showToast(language === "zh" ? `大纲生成启动失败：${message}` : `Could not start outline: ${message}`);
      renderRequirements();
    }
  };
  const renderBriefOptimizing = async (initialJob = null, continueToOutline = false) => {
    clearOutlineCountdown();
    if (!panel.querySelector(".slides-prompt-shell")) renderBrief();
    const promptInput = panel.querySelector(".slides-prompt-shell textarea");
    const optimizeButton = panel.querySelector(".slides-brief-optimize");
    const status = panel.querySelector(".slides-generator-status");
    panel.querySelector(".slides-prompt-shell")?.classList.add("is-optimizing");
    optimizeButton?.replaceChildren(document.createElement("span"));
    optimizeButton?.firstElementChild?.classList.add("slides-inline-color-ring");
    if (optimizeButton) { optimizeButton.disabled = true; optimizeButton.setAttribute("aria-label", language === "zh" ? "正在一键优化" : "Optimizing"); }
    status.textContent = "";
    try {
      let job = initialJob;
      if (!job) { const response = await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.briefJobId)}`)); job = await response.json(); if (!response.ok) throw new Error(job.error || t("jobFailed")); }
      job = await pollSlidesJob(job);
      if (!job.brief) throw new Error(language === "zh" ? "AI 没有返回可用的需求方案。" : "AI did not return a usable brief.");
      brief = { ...job.brief, presets:draft.brief?.presets || [] };
      count = brief.recommendedPageCount || count;
      if (continueToOutline) {
        syncDraft({ brief, optimizedBrief:brief, count, pageCountMode:"auto", briefJobId:null, lastError:null });
        showToast(language === "zh" ? `AI 根据内容推荐 ${count} 页，正在生成大纲` : `AI recommends ${count} slides and is preparing the outline`);
        await startOutlineFromBrief(brief, count, status);
        return;
      }
      const factRule = brief.factsAndSources || (language === "zh" ? "全部内容由 AI 自主生成；需要修改时由用户主动提供替换内容" : "AI generates the complete draft; user-provided replacements override it when edits are needed");
      const scenario = [brief.duration, brief.scenario].filter((item, index, list) => item && !list.some((other, otherIndex) => otherIndex !== index && String(other).includes(String(item)))).join(" ");
      const compactBriefValue = (value, maxLength) => {
        const normalized = String(value || "").replace(/\s+/g, " ").trim();
        return normalized.length > maxLength ? `${normalized.slice(0, maxLength).replace(/[，,；;：:\s]+$/u, "")}…` : normalized;
      };
      const generatedPrompt = language === "zh"
        ? `请帮我制作一套${compactBriefValue(brief.style?.includes("红") ? "红色基调的" : "", 20)}${compactBriefValue(brief.topic.replace(/^(帮我|请帮我|请|为我)?(?:生成|制作|做一套|做一个)?/u, "").replace(/[，,].*$/u, ""), 80)}PPT${count ? `，约 ${count} 页` : ""}，整体风格${compactBriefValue(brief.style, 100)}，适合${compactBriefValue(brief.audience, 50)}用于${compactBriefValue(scenario, 60)}。内容可围绕${compactBriefValue(brief.coreMessage || brief.narrative || "主题相关的核心内容", 140)}展开，目标是${compactBriefValue(brief.goal, 60)}，页面结构清晰、重点突出并便于后续编辑。${compactBriefValue(factRule, 100)}。`
        : `Create an approximately ${count}-slide presentation about “${compactBriefValue(brief.topic, 100)}” from the perspective of ${compactBriefValue(brief.presenterRole || "a suitable subject-matter professional", 60)}. It should ${compactBriefValue(brief.goal, 80)}, be intended for ${compactBriefValue(brief.audience, 70)}, and be used for ${compactBriefValue(scenario, 80)}. Focus the content on ${compactBriefValue(brief.coreMessage || brief.narrative || "a clear and complete structure around the topic", 160)}, use ${compactBriefValue(brief.style, 120)} visually, and ${compactBriefValue(factRule, 120)}.`;
      const normalizeExpandedPrompt = (value) => String(value || "")
        .replace(/身份身份/g, "身份")
        .replace(/采用采用/g, "采用")
        .replace(/围绕“([^”]+)”制作一套/g, "围绕“$1”制作一套")
        .replace(/[；;]\s*[。.]+/g, "。")
        .replace(/[。.]\s*[。.]+/g, "。")
        .replace(/[；;]\s*[；;]+/g, "；")
        .replace(/，\s*，+/g, "，")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([，。；：！？])/g, "$1")
        .trim();
      const optimizedPrompt = normalizeExpandedPrompt(brief.expandedPrompt || generatedPrompt);
      syncDraft({ brief, optimizedBrief:brief, count, briefJobId:null, phase:"brief", lastError:null });
      panel.querySelector(".slides-prompt-shell")?.classList.remove("is-optimizing");
      if (optimizeButton) { optimizeButton.hidden = true; optimizeButton.replaceChildren(); }
      promptInput.value = "";
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (reduceMotion) promptInput.value = optimizedPrompt;
      else for (let index = 0; index < optimizedPrompt.length; index += 1) { promptInput.value += optimizedPrompt[index]; promptInput.scrollTop = promptInput.scrollHeight; if (index % 2 === 0) { panel._positionOptimizeButton?.(); await new Promise((resolve) => window.setTimeout(resolve, 9)); } }
      promptInput.dispatchEvent(new Event("input", { bubbles:true }));
      syncDraft({ topic:optimizedPrompt, briefOptimized:true, phase:"brief" });
      renderBrief();
      window.requestAnimationFrame(() => { const optimizedInput = panel.querySelector(".slides-prompt-shell textarea"); if (!optimizedInput) return; optimizedInput.scrollTop = optimizedInput.scrollHeight; panel._positionOptimizeButton?.(); });
    } catch (error) {
      const message = error?.message || t("jobFailed"); syncDraft({ briefJobId:null, phase:"brief", lastError:message }); showToast(language === "zh" ? `需求完善失败：${message}` : `Could not improve brief: ${message}`); renderBrief();
    }
  };
  const renderBrief = () => {
    clearOutlineCountdown(); setPanelMode();
    panel.innerHTML = `<div class="slides-workflow-steps" aria-label="${language === "zh" ? "生成步骤" : "Generation steps"}"><b class="active">1 ${language === "zh" ? "描述" : "Prompt"}</b><span>2 ${language === "zh" ? "大纲" : "Outline"}</span><span>3 ${language === "zh" ? "生成" : "Generate"}</span></div><div class="slides-generator-heading"><div><strong>${language === "zh" ? (append ? "使用 AI 添加幻灯片" : "一句话生成幻灯片") : (append ? "Add slides with AI" : "Create slides from one prompt")}</strong><span class="slides-generator-mode">Codex AI</span></div><span>${language === "zh" ? "描述你想讲什么；输入 @ 或点击推荐预设即可控制用途、风格与受众。" : "Describe what you want to present. Type @ or choose a preset to control purpose, style and audience."}</span></div><div class="slides-prompt-shell"><textarea required maxlength="6000" aria-label="${language === "zh" ? "幻灯片提示词" : "Slide prompt"}" placeholder="${language === "zh" ? "例如：为智慧水务平台制作一套产品发布演示，突出客户价值和落地计划。输入 @ 选择风格…" : "Describe the deck you want. Type @ to choose a style…"}"></textarea><div class="slides-selected-presets" aria-live="polite"></div><div class="slides-mention-menu" role="listbox" hidden></div></div><div class="slides-recommended-presets"><span>${language === "zh" ? "智能推荐" : "Recommended"}</span><div></div></div><div class="slides-simple-actions"><label class="slides-reference-picker"><input type="file" accept="image/*" multiple><span>${language === "zh" ? "＋ 参考图" : "+ References"}</span></label><div class="slides-generator-references" aria-live="polite"></div><details class="slides-advanced-settings"><summary>${language === "zh" ? "更多设置" : "More settings"}</summary><div class="slides-brief-grid"><label><span>${language === "zh" ? "核心目标" : "Goal"}</span><select data-brief="goal"><option>${language === "zh" ? "AI 智能判断" : "Auto"}</option><option>${language === "zh" ? "说服决策与推动行动" : "Drive a decision"}</option><option>${language === "zh" ? "汇报成果与进展" : "Report outcomes"}</option><option>${language === "zh" ? "教学与知识讲解" : "Teach and explain"}</option><option>${language === "zh" ? "展示作品与能力" : "Showcase work"}</option></select></label><label><span>${language === "zh" ? "目标受众" : "Audience"}</span><select data-brief="audience"><option>${language === "zh" ? "AI 智能判断" : "Auto"}</option><option>${language === "zh" ? "管理层与决策者" : "Executives"}</option><option>${language === "zh" ? "客户与合作伙伴" : "Customers"}</option><option>${language === "zh" ? "专业团队" : "Professional team"}</option><option>${language === "zh" ? "大众受众" : "General audience"}</option></select></label><label><span>${language === "zh" ? "演示场景" : "Scenario"}</span><select data-brief="scenario"><option>${language === "zh" ? "AI 智能判断" : "Auto"}</option><option>${language === "zh" ? "现场演示，画面为主" : "Live presentation"}</option><option>${language === "zh" ? "自行阅读，信息较完整" : "Self-read document"}</option><option>${language === "zh" ? "线上会议与屏幕共享" : "Online meeting"}</option></select></label><label><span>${language === "zh" ? "视觉方向" : "Visual direction"}</span><select data-brief="style"><option>${language === "zh" ? "跟随 @ 预设或智能判断" : "Use presets or auto"}</option><option>${language === "zh" ? "专业简洁" : "Professional"}</option><option>${language === "zh" ? "编辑杂志感" : "Editorial"}</option><option>${language === "zh" ? "科技视觉" : "Technology"}</option><option>${language === "zh" ? "大胆创意" : "Creative"}</option></select></label></div><div class="slides-page-count" role="group" aria-label="${language === "zh" ? "幻灯片页数" : "Slide count"}"><button type="button" data-slide-count-mode="auto">${language === "zh" ? "AI 自动推荐" : "AI recommended"}</button>${[3,5,10].map((value) => `<button type="button" data-slide-count="${value}">${value} ${language === "zh" ? "页" : "pages"}</button>`).join("")}<label><span>${language === "zh" ? "自定义" : "Custom"}</span><input type="number" min="1" max="20" value="5"></label></div></details></div><div class="slides-generator-status" role="status" aria-live="polite"></div><button class="slides-generator-submit" type="submit">${language === "zh" ? "开始生成" : "Start generating"}</button>`;
    const inputFeedback = panel.querySelector(".slides-generator-status");
    panel.classList.toggle("is-entry", !append && !draft.targetSlideId);
    if (!append && !draft.targetSlideId) {
      panel.querySelector(".slides-workflow-steps")?.remove();
      panel.querySelector(".slides-generator-mode")?.remove();
      const heading = panel.querySelector(".slides-generator-heading strong");
      const help = panel.querySelector(".slides-generator-heading>span");
      heading.textContent = language === "zh" ? "把一个想法，变成一套好演示" : "Turn one idea into a great presentation";
      help.textContent = language === "zh" ? "输入主题、粘贴内容或上传资料，AI 会先为你整理故事线和大纲。" : "Enter a topic, paste content, or upload material. AI will shape the story and outline first.";
      const mark = document.createElement("span"); mark.className = "slides-entry-mark"; mark.append(slidesIcon("sparkles")); heading.parentElement.prepend(mark);
      panel.querySelector(".slides-recommended-presets>span").textContent = language === "zh" ? "AI 已理解" : "AI understands";
      panel.querySelector(".slides-advanced-settings summary").textContent = draft.pageCountMode === "manual" ? (language === "zh" ? `${count} 页 · 自动风格 · 修改` : `${count} pages · Auto style · Change`) : (language === "zh" ? "AI 推荐页数 · 自动风格 · 修改" : "AI-recommended length · Auto style · Change");
      panel.querySelector(".slides-generator-submit").replaceChildren(slidesIcon("sparkles"), document.createTextNode(language === "zh" ? "开始生成" : "Start generating"));
      const compose = document.createElement("section"); compose.className = "slides-entry-compose";
      compose.append(panel.querySelector(".slides-prompt-shell"), panel.querySelector(".slides-recommended-presets"), panel.querySelector(".slides-simple-actions"), panel.querySelector(".slides-generator-status"), panel.querySelector(".slides-generator-submit"));
      panel.querySelector(".slides-generator-heading").after(compose);
      const shortcuts = document.createElement("section"); shortcuts.className = "slides-intent-shortcuts";
      const shortcutItems = language === "zh" ? [["sparkles","优化现有幻灯片","优化画布中已选内容的布局与视觉","优化画布中已选中的幻灯片，保留核心内容并提升叙事、布局与视觉表现。"],["refresh","内容转幻灯片","将文件或画布素材转为结构化页面","将我添加的文件或画布素材整理成一套结构清晰、可编辑的幻灯片。"],["palette","使用品牌模板","参考上传页面保持品牌视觉一致","参考我上传的幻灯片或图片作为品牌模板，生成视觉风格一致的演示。"]] : [["sparkles","Improve slides","Refine selected canvas slides","Improve the selected slides while preserving their core content."],["refresh","Convert content","Turn files or canvas content into slides","Convert my files or canvas content into an editable presentation."],["palette","Use brand template","Match an uploaded visual system","Use my uploaded slide as a brand template for the presentation."]];
      shortcutItems.forEach(([icon,title,description,prompt]) => { const button = document.createElement("button"); button.type = "button"; button.append(slidesIcon(icon)); const copy = document.createElement("span"); const strong = document.createElement("strong"); strong.textContent = title; const small = document.createElement("small"); small.textContent = description; copy.append(strong,small); button.append(copy); button.onclick = () => { const input = panel.querySelector(".slides-prompt-shell textarea"); input.value = prompt; input.dispatchEvent(new Event("input", { bubbles:true })); input.focus(); }; shortcuts.append(button); }); panel.append(shortcuts);
    }
    const heading = panel.querySelector(".slides-generator-heading strong");
    const help = panel.querySelector(".slides-generator-heading>span");
    if (draft.targetSlideId) {
      heading.textContent = language === "zh" ? "重新生成当前页" : "Regenerate this slide";
      help.textContent = language === "zh" ? "描述需要保留和改变的内容；生成完成后会在原位置替换当前页。" : "Describe what to keep and change. The result replaces this page in place.";
      count = 1;
      panel.querySelector(".slides-page-count").hidden = true;
    }
    if (draft.lastError) { inputFeedback.textContent = language === "zh" ? "上次生成未完成，你的输入已经保留。请修改需求或重新生成。" : "The last generation did not finish. Your input was kept; edit it or try again."; inputFeedback.classList.add("error"); inputFeedback.title = draft.lastError; }
    const autoPageCountButton = panel.querySelector("[data-slide-count-mode='auto']");
    autoPageCountButton.onclick = () => { draft.pageCountMode = "auto"; autoPageCountButton.classList.add("active"); panel.querySelectorAll("[data-slide-count]").forEach((item) => item.classList.remove("active")); syncDraft(); };
    panel.querySelectorAll("[data-slide-count]").forEach((button) => button.onclick = () => { draft.pageCountMode = "manual"; autoPageCountButton.classList.remove("active"); panel.querySelectorAll("[data-slide-count]").forEach((item) => item.classList.toggle("active", item === button)); panel.querySelector(".slides-page-count input").value = button.dataset.slideCount; count = Number(button.dataset.slideCount); syncDraft(); });
    panel.querySelector(".slides-page-count input").oninput = (event) => { draft.pageCountMode = "manual"; autoPageCountButton.classList.remove("active"); panel.querySelectorAll("[data-slide-count]").forEach((item) => item.classList.remove("active")); count = Math.max(1, Math.min(20, Number(event.target.value) || 5)); syncDraft(); };
    panel.querySelector(".slides-page-count input").value = String(count);
    autoPageCountButton.classList.toggle("active", draft.pageCountMode !== "manual");
    panel.querySelectorAll("[data-slide-count]").forEach((item) => item.classList.toggle("active", draft.pageCountMode === "manual" && Number(item.dataset.slideCount) === count));
    const promptInput = panel.querySelector(".slides-prompt-shell textarea");
    const promptCounter = document.createElement("span"); promptCounter.className = "slides-prompt-counter"; panel.querySelector(".slides-prompt-shell").append(promptCounter);
    const updatePromptCounter = () => { promptCounter.textContent = `${promptInput.value.length} / ${promptInput.maxLength}`; };
    const resizePromptInput = () => { promptInput.style.height = "auto"; promptInput.style.height = `${Math.min(180, Math.max(82, promptInput.scrollHeight))}px`; window.requestAnimationFrame(() => panel._positionOptimizeButton?.()); };
    const selectedHost = panel.querySelector(".slides-selected-presets");
    const recommendedHost = panel.querySelector(".slides-recommended-presets>div");
    const mentionMenu = panel.querySelector(".slides-mention-menu");
    const referencePreview = panel.querySelector(".slides-generator-references");
    const referenceInput = panel.querySelector(".slides-reference-picker input");
    referenceInput.accept = "image/*,.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint";
    const renderReferencePreview = () => {
      referencePreview.replaceChildren(...references.map((entry, index) => { const reference = typeof entry === "string" ? { kind:"image", dataUrl:entry, name:`Reference ${index + 1}` } : entry; const item = document.createElement("span"); item.className = `slides-reference-attachment is-${reference.kind || "image"}`; if (reference.kind === "pptx") { const file = document.createElement("span"); file.className = "slides-reference-file"; file.append(slidesIcon("presentation"), document.createElement("b")); file.querySelector("b").textContent = reference.name || "PowerPoint.pptx"; item.append(file); } else { const image = document.createElement("img"); image.src = reference.dataUrl || ""; image.alt = language === "zh" ? `参考图 ${index + 1}` : `Reference ${index + 1}`; image.onload = () => panel._positionOptimizeButton?.(); item.append(image); } const remove = document.createElement("button"); remove.type = "button"; remove.setAttribute("aria-label", language === "zh" ? `移除参考素材 ${index + 1}` : `Remove reference ${index + 1}`); remove.textContent = "×"; remove.onclick = () => { references.splice(index, 1); syncDraft(); renderReferencePreview(); }; item.append(remove); return item; }));
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => panel._positionOptimizeButton?.()));
      panel.querySelector(".slides-prompt-shell")?.classList.toggle("has-content", Boolean(promptInput.value.trim() || references.length));
    };
    if (panel.classList.contains("is-entry")) {
      const shell = panel.querySelector(".slides-prompt-shell"); const simpleActions = panel.querySelector(".slides-simple-actions"); const picker = panel.querySelector(".slides-reference-picker"); const advanced = panel.querySelector(".slides-advanced-settings"); const submit = panel.querySelector(".slides-generator-submit"); const recommended = panel.querySelector(".slides-recommended-presets");
      const toolbar = document.createElement("div"); toolbar.className = "slides-ai-toolbar"; picker.querySelector("span").replaceChildren(slidesIcon("link")); picker.title = language === "zh" ? "添加参考图片或 PPTX；聚焦输入框后可直接粘贴图片" : "Add reference images or PPTX; focus the prompt to paste images"; picker.setAttribute("aria-label", picker.title); advanced.hidden = true; recommended.hidden = true; const inlineAction = document.createElement("div"); inlineAction.className = "slides-prompt-inline-action"; const improve = document.createElement("button"); improve.type = "button"; improve.className = "slides-brief-optimize"; inlineAction.append(improve); shell.querySelector("textarea").after(inlineAction); toolbar.append(picker, submit); shell.prepend(referencePreview); shell.append(advanced, recommended, toolbar); simpleActions.remove();
      promptInput.placeholder = language === "zh" ? "描述主题、目标或想呈现的内容…" : "Describe the topic, goal, or content…";
    }
    const optimizeButton = panel.querySelector(".slides-brief-optimize");
    const updateComposerState = () => { const shell = panel.querySelector(".slides-prompt-shell"); if (!shell) return; shell.classList.toggle("has-content", Boolean(promptInput.value.trim() || references.length)); shell.classList.toggle("is-complete", Boolean(draft.briefOptimized)); };
    const positionOptimizeButton = () => {
      const action = panel.querySelector(".slides-prompt-inline-action"); const shell = panel.querySelector(".slides-prompt-shell");
      if (!action || !shell || !promptInput.isConnected) return;
      const style = getComputedStyle(promptInput); const mirror = document.createElement("div"); mirror.className = "slides-prompt-end-mirror";
      Object.assign(mirror.style, { width:`${promptInput.clientWidth}px`, font:style.font, fontFamily:style.fontFamily, fontSize:style.fontSize, fontWeight:style.fontWeight, lineHeight:style.lineHeight, letterSpacing:style.letterSpacing, whiteSpace:"pre-wrap", overflowWrap:"break-word", wordBreak:style.wordBreak, padding:style.padding, border:"0" });
      mirror.append(document.createTextNode(promptInput.value || promptInput.placeholder || "")); const marker = document.createElement("i"); marker.textContent = "\u200b"; mirror.append(marker); document.body.append(mirror);
      const mirrorRect = mirror.getBoundingClientRect(); const markerRect = marker.getBoundingClientRect(); const shellRect = shell.getBoundingClientRect(); const inputRect = promptInput.getBoundingClientRect(); const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.55;
      const markerOffsetTop = Math.max(0, markerRect.top - mirrorRect.top); const markerTopInInput = markerOffsetTop - promptInput.scrollTop; const endIsVisible = markerTopInInput >= 0 && markerTopInInput <= promptInput.clientHeight - Math.min(lineHeight, action.offsetHeight || lineHeight);
      action.hidden = Boolean(promptInput.value) && !endIsVisible;
      if (action.hidden) { mirror.remove(); return; }
      let left = inputRect.left - shellRect.left + markerRect.left - mirrorRect.left - promptInput.scrollLeft + 7; let top = inputRect.top - shellRect.top + markerTopInInput + Math.max(0, (lineHeight - action.offsetHeight) / 2);
      if (left + action.offsetWidth > shell.clientWidth - 18) { left = inputRect.left - shellRect.left; top += lineHeight; }
      action.style.left = `${Math.max(18, left)}px`; action.style.top = `${Math.max(18, top)}px`; mirror.remove();
    };
    panel._positionOptimizeButton = positionOptimizeButton;
    const refreshOptimizeButton = () => {
      if (!optimizeButton || optimizeButton.disabled) return;
      optimizeButton.classList.toggle("is-discard", Boolean(draft.briefOptimized));
      optimizeButton.replaceChildren(slidesIcon(draft.briefOptimized ? "trash" : "sparkles"), document.createTextNode(language === "zh" ? (draft.briefOptimized ? "弃用" : "一键优化") : (draft.briefOptimized ? "Discard" : "One-click optimize")));
    };
    refreshOptimizeButton();
    window.requestAnimationFrame(() => window.requestAnimationFrame(positionOptimizeButton));
    const renderSelectedPresets = () => {
      selectedHost.replaceChildren(...[...selectedPresetIds].map((id) => {
        const preset = presetCatalog.find((item) => item.id === id); const chip = document.createElement("button"); chip.type = "button"; chip.className = "slides-preset-chip selected"; chip.textContent = `${presetLabel(preset)} ×`; chip.setAttribute("aria-label", `${language === "zh" ? "移除" : "Remove"} ${presetLabel(preset)}`); chip.onclick = () => { selectedPresetIds.delete(id); syncDraft(); renderSelectedPresets(); renderRecommendedPresets(); }; return chip;
      }));
    };
    const choosePreset = (id) => {
      selectedPresetIds.add(id); syncDraft(); renderSelectedPresets(); renderRecommendedPresets(); mentionMenu.hidden = true;
      promptInput.value = promptInput.value.replace(/@[^\s@]*$/, "").trimEnd(); promptInput.focus();
      draft.topic = promptInput.value; syncDraft();
    };
    const renderRecommendedPresets = () => {
      const ids = recommendedPresetIds(promptInput.value).filter((id) => !selectedPresetIds.has(id));
      recommendedHost.replaceChildren(...ids.map((id) => { const preset = presetCatalog.find((item) => item.id === id); const button = document.createElement("button"); button.type = "button"; button.className = "slides-preset-chip"; button.textContent = presetLabel(preset); button.onclick = () => choosePreset(id); return button; }));
      const understood = panel.querySelector(".slides-recommended-presets");
      understood?.classList.toggle("has-input", Boolean(promptInput.value.trim() || selectedPresetIds.size));
      const label = understood?.querySelector(":scope>span");
      if (label && panel.classList.contains("is-entry")) label.textContent = language === "zh" ? (promptInput.value.trim() || selectedPresetIds.size ? "AI 已理解" : "快速选择") : (promptInput.value.trim() || selectedPresetIds.size ? "AI understands" : "Quick choices");
    };
    const updateMentionMenu = () => {
      const match = /@([^\s@]*)$/.exec(promptInput.value); if (!match) { mentionMenu.hidden = true; return; }
      const query = match[1].toLowerCase(); const options = presetCatalog.filter((preset) => !selectedPresetIds.has(preset.id) && `${preset.zh} ${preset.en}`.toLowerCase().includes(query));
      mentionMenu.replaceChildren(...options.map((preset) => { const button = document.createElement("button"); button.type = "button"; button.setAttribute("role","option"); button.textContent = `${presetLabel(preset)} · ${preset.category}`; button.onclick = () => choosePreset(preset.id); return button; })); mentionMenu.hidden = options.length === 0;
    };
    promptInput.addEventListener("input", () => { draft.topic = promptInput.value; syncDraft({ briefOptimized:false }); refreshOptimizeButton(); updateComposerState(); inputFeedback.textContent = ""; inputFeedback.className = "slides-generator-status"; resizePromptInput(); positionOptimizeButton(); updatePromptCounter(); renderRecommendedPresets(); updateMentionMenu(); });
    promptInput.addEventListener("scroll", positionOptimizeButton, { passive:true });
    promptInput.addEventListener("keydown", (event) => { if (event.key === "Escape") mentionMenu.hidden = true; });
    promptInput.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); panel.requestSubmit(); } });
    promptInput.value = draft.topic || brief?.topic || "";
    updateComposerState();
    resizePromptInput();
    const repositionOptimizeButton = () => positionOptimizeButton(); window.addEventListener("resize", repositionOptimizeButton, { passive:true });
    const optimizeResizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(repositionOptimizeButton) : null; optimizeResizeObserver?.observe(panel.querySelector(".slides-prompt-shell")); optimizeResizeObserver?.observe(promptInput); optimizeResizeObserver?.observe(referencePreview);
    const optimizeMutationObserver = new MutationObserver(() => window.requestAnimationFrame(repositionOptimizeButton)); optimizeMutationObserver.observe(referencePreview, { childList:true, subtree:true });
    phaseEffectCleanup = () => { window.removeEventListener("resize", repositionOptimizeButton); optimizeResizeObserver?.disconnect(); optimizeMutationObserver.disconnect(); };
    updatePromptCounter();
    if (brief) {
      for (const key of ["goal", "audience", "scenario", "style"]) {
        const control = panel.querySelector(`[data-brief="${key}"]`);
        const value = String(brief[key] || "").trim();
        if (!control || !value) continue;
        if (![...control.options].some((option) => option.value === value)) {
          const option = document.createElement("option"); option.value = value; option.textContent = `${language === "zh" ? "AI 推荐" : "AI recommended"} · ${value}`; option.dataset.aiRecommended = "true"; control.prepend(option);
        }
        control.value = value;
      }
    }
    renderSelectedPresets(); renderRecommendedPresets();
    renderReferencePreview();
    panel.querySelectorAll("[data-brief]").forEach((control) => control.onchange = () => { syncDraft({ advanced:{ goal:panel.querySelector('[data-brief="goal"]').value, audience:panel.querySelector('[data-brief="audience"]').value, scenario:panel.querySelector('[data-brief="scenario"]').value, style:panel.querySelector('[data-brief="style"]').value } }); });
    if (draft.advanced) for (const key of ["goal","audience","scenario","style"]) panel.querySelector(`[data-brief="${key}"]`).value = draft.advanced[key];
    const addReferenceFiles = async (files) => {
      const remaining = Math.max(0, 4 - references.length);
      if (!remaining) {
        showToast(language === "zh" ? "最多添加 4 个参考素材" : "You can add up to 4 references");
        return;
      }
      try {
        const additions = (await Promise.all([...files].slice(0, remaining).map(async (file) => /\.(?:pptx?|PPTX?)$/i.test(file.name || "") || /presentation/i.test(file.type || "") ? slidesPresentationReference(file) : slidesReferenceDataUrl(file)))).filter(Boolean);
        references = [...references, ...additions].slice(0, 4);
        syncDraft();
        renderReferencePreview();
      } catch (error) {
        showToast(error?.message || t("uploadFailed"));
      }
    };
    referenceInput.onchange = async (event) => {
      await addReferenceFiles(event.target.files);
      event.target.value = "";
    };
    promptInput.addEventListener("paste", async (event) => {
      const files = clipboardImageFiles(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      await addReferenceFiles(files);
    });
    panel.querySelector(".slides-brief-optimize")?.addEventListener("click", async (event) => {
      const button = event.currentTarget; const topic = promptInput.value.replace(/@[^\s@]*$/, "").trim();
      if (draft.briefOptimized) { const original = String(draft.briefOriginalTopic || ""); syncDraft({ topic:original, brief:null, optimizedBrief:null, briefOptimized:false, briefOriginalTopic:"", lastError:null }); renderBrief(); window.requestAnimationFrame(() => { const restored = panel.querySelector(".slides-prompt-shell textarea"); restored?.focus(); restored?.setSelectionRange(original.length, original.length); }); return; }
      if (!topic) { inputFeedback.textContent = language === "zh" ? "先写一句你想做什么，例如“帮我做一个咖啡品牌介绍”。" : "Start with one sentence about the presentation you need."; inputFeedback.classList.add("error"); promptInput.focus(); return; }
      const explicitBrief = parseExplicitSlideBriefInput(topic);
      const requestedPageCount = explicitBrief.recommendedPageCount || (draft.pageCountMode === "manual" ? count : null);
      const roughBrief = { topic:explicitBrief.topic || topic, sourcePrompt:topic, presets:[...selectedPresetIds].map((id) => presetLabel(presetCatalog.find((item) => item.id === id))), goal:explicitBrief.goal || panel.querySelector('[data-brief="goal"]').value, audience:explicitBrief.audience || panel.querySelector('[data-brief="audience"]').value, scenario:explicitBrief.scenario || panel.querySelector('[data-brief="scenario"]').value, narrative:explicitBrief.narrative || "", style:explicitBrief.style || panel.querySelector('[data-brief="style"]').value, factsAndSources:explicitBrief.factsAndSources || "", recommendedPageCount:explicitBrief.recommendedPageCount || null };
      button.disabled = true; button.replaceChildren(document.createElement("span")); button.firstElementChild.className = "slides-inline-color-ring"; inputFeedback.textContent = ""; inputFeedback.className = "slides-generator-status"; panel.querySelector(".slides-prompt-shell")?.classList.add("is-optimizing");
      try {
        const response = await fetch(apiPath("/api/slides/jobs"), { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"optimize-brief", deckId:deck.id, prompt:JSON.stringify(roughBrief, null, 2), ...(requestedPageCount ? { pageCount:requestedPageCount } : {}), references }) });
        let job = await response.json(); if (!response.ok) throw new Error(job.error || t("jobFailed"));
        syncDraft({ topic, brief:roughBrief, briefOriginalTopic:topic, briefJobId:job.id, phase:"optimizing-brief", lastError:null });
        await renderBriefOptimizing(job);
      } catch (error) {
        const message = error?.message || t("jobFailed"); syncDraft({ briefJobId:null, phase:"brief", lastError:message }); inputFeedback.textContent = language === "zh" ? `需求优化失败：${message}` : `Could not optimize the brief: ${message}`; inputFeedback.classList.add("error"); button.disabled = false; panel.querySelector(".slides-prompt-shell")?.classList.remove("is-optimizing"); refreshOptimizeButton();
      }
    });
    panel.onsubmit = async (event) => {
      event.preventDefault(); const topic = promptInput.value.replace(/@[^\s@]*$/, "").trim(); if (!topic) return;
      const explicitBrief = parseExplicitSlideBriefInput(topic);
      const explicitCount = explicitBrief.recommendedPageCount || null;
      brief = { topic:explicitBrief.topic || topic, sourcePrompt:topic, presets:[...selectedPresetIds].map((id) => presetLabel(presetCatalog.find((item) => item.id === id))), goal:explicitBrief.goal || panel.querySelector('[data-brief="goal"]').value, audience:explicitBrief.audience || panel.querySelector('[data-brief="audience"]').value, scenario:explicitBrief.scenario || panel.querySelector('[data-brief="scenario"]').value, narrative:explicitBrief.narrative || "", style:explicitBrief.style || panel.querySelector('[data-brief="style"]').value, factsAndSources:explicitBrief.factsAndSources || "", recommendedPageCount:explicitCount };
      const submit = panel.querySelector(".slides-generator-submit"); const status = panel.querySelector(".slides-generator-status"); const busyLabel = document.createElement("span"); busyLabel.textContent = language === "zh" ? "生成中..." : "Generating..."; submit.disabled = true; submit.classList.add("is-analyzing"); submit.replaceChildren(slidesIcon("sparkles"), busyLabel); submit.setAttribute("aria-busy", "true"); submit.setAttribute("aria-label", language === "zh" ? "生成中" : "Generating");
      const requestedCount = explicitCount || (draft.pageCountMode === "manual" ? count : null);
      if (requestedCount) brief.recommendedPageCount = requestedCount;
      status.textContent = "";
      try {
        const response = await fetch(apiPath("/api/slides/jobs"), { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"optimize-brief", deckId:deck.id, prompt:JSON.stringify(brief, null, 2), ...(requestedCount ? { pageCount:requestedCount } : {}), references }) });
        let job = await response.json(); if (!response.ok) throw new Error(job.error || t("jobFailed"));
        syncDraft({ topic, brief, briefOriginalTopic:"", optimizedBrief:null, briefOptimized:false, briefJobId:job.id, pageCountMode:"auto", lastError:null });
        job = await pollSlidesJobGlobal(job, (current) => { const seconds=Math.max(0,Number(current.elapsedSeconds) || 0); submit.setAttribute("aria-label", `${language === "zh" ? "正在分析并准备生成" : "Analyzing and preparing generation"}，${formatSlidesElapsed(seconds)}`); });
        const recommendedCount = Math.max(1, Math.min(20, Number(job.brief?.recommendedPageCount) || count));
        brief = { ...brief, ...(job.brief || {}), topic, sourcePrompt:topic, recommendedPageCount:recommendedCount };
        requirements = requirementsFromBrief(brief);
        syncDraft({ topic, brief, optimizedBrief:brief, requirements, count:recommendedCount, briefJobId:null, phase:"requirements", pageCountMode:requestedCount ? "manual" : "auto", lastError:null });
        renderRequirements();
      } catch (error) {
        const message = error?.message || t("jobFailed"); syncDraft({ briefJobId:null, phase:"brief", optimizedBrief:null, briefOptimized:false, lastError:message }); status.textContent = language === "zh" ? `页数评估失败：${message}` : `Length recommendation failed: ${message}`; status.classList.add("error"); submit.disabled = false; submit.classList.remove("is-analyzing"); submit.replaceChildren(slidesIcon("sparkles"), document.createTextNode(language === "zh" ? "开始生成" : "Start generating")); submit.removeAttribute("aria-busy"); submit.removeAttribute("aria-label");
      }
    };
  };
  const resizeOutline = (nextCount) => {
    nextCount = Math.max(1, Math.min(20, Number(nextCount) || outline.slides.length));
    if (nextCount < outline.slides.length) outline.slides.splice(nextCount);
    while (outline.slides.length < nextCount) outline.slides.push({ title:language === "zh" ? `新幻灯片 ${outline.slides.length + 1}` : `New slide ${outline.slides.length + 1}`, message:"", type:"insight", visual:language === "zh" ? "根据内容选择合适布局" : "Choose a suitable layout" });
    count = nextCount;
  };
  const replanOutlineForCount = async (nextCount, changedKeys = []) => {
    const confirmedRequirements = {
      goal:requirements.goal.selected,
      audience:requirements.audience.selected,
      scenario:requirements.scenario.selected,
      length:String(nextCount)
    };
    const planningPrompt = JSON.stringify({
      ...(brief || {}),
      confirmedRequirements,
      existingOutline:outline.slides,
      changedRequirements:changedKeys,
      instruction:changedKeys.length === 1 && changedKeys[0] === "length"
        ? `Resize the existing narrative to exactly ${nextCount} non-empty slides. Preserve its intent and strongest ideas, then add substantive pages or consolidate overlapping pages. Every page must have a specific title, key message, page type, and visual direction. Do not append placeholder pages.`
        : `Replan the complete narrative as exactly ${nextCount} non-empty slides around the confirmed goal, audience, and presentation scenario. Rewrite emphasis, terminology, evidence, and page sequence where needed. Preserve only existing ideas that still serve the confirmed requirements. Every page must have a specific title, key message, page type, and visual direction.`
    }, null, 2);
    syncDraft({ count:nextCount, continueToStorylineAfterPlanning:true, phase:"planning", lastError:null });
    const response = await fetch(apiPath("/api/slides/jobs"), { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"plan-slides", deckId:deck.id, prompt:planningPrompt, pageCount:nextCount, references }) });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || t("jobFailed"));
    syncDraft({ activeJobId:job.id, phase:"planning", continueToStorylineAfterPlanning:true, lastError:null });
    showToast(language === "zh" ? `AI 正在将大纲补全为 ${nextCount} 页` : `AI is replanning the outline to ${nextCount} pages`);
    renderPlanning(job);
  };
  const renderRequirements = () => {
    const enteringRequirements = draft.phase !== "requirements";
    clearOutlineCountdown(); setPanelMode("requirements"); syncDraft({ phase:"requirements" });
    panel.tabIndex = -1;
    const copy = language === "zh" ? {
      eyebrow:"第一步 · 需求确认", title:"请确认创作意图", help:"AI 已根据你的输入总结出四项关键信息。确认后才会生成大纲，原始内容不会被改写。",
      goal:["核心目标","决定整套演示最终要让观众理解或采取什么行动。"], audience:["目标受众","受众背景会影响术语、证据和信息解释方式。"], scenario:["演示场景","场景决定页面信息密度，以及画面和讲述的比例。"], length:["篇幅长度","根据你需要展示的项目数量和深度来决定幻灯片的页数。"],
      add:"自定义", addPlaceholder:"输入自定义选项", cancel:"取消", confirm:"确认需求并生成大纲", back:"返回修改需求"
    } : {
      eyebrow:"AI extracted the essentials", title:"Confirm what this presentation needs to achieve", help:"These choices guide narrative density and visual execution. Choose a suggestion or add your own.",
      goal:["Core goal","Define what the audience should understand or do."], audience:["Target audience","Audience context shapes terminology, evidence, and explanation."], scenario:["Presentation scenario","The scenario sets the balance between visuals and detail."], length:["Deck length","AI recommended a length from the content; you can change it."],
      add:"Add option", addPlaceholder:"Type a custom option", cancel:"Cancel", confirm:"Confirm and review outline", back:"Edit prompt"
    };
    panel.innerHTML = `<section class="slides-confirmation-card"><header class="slides-confirmation-header"><span class="slides-outline-eyebrow">${copy.eyebrow}</span><h2>${copy.title}</h2><p>${copy.help}</p></header><div class="slides-requirement-groups"></div><label class="slides-requirement-notes"><span>${language === "zh" ? "补充说明（可选）" : "Additional notes (optional)"}</span><textarea maxlength="1200" placeholder="${language === "zh" ? "例如：需要包含哪些项目案例、突出哪些工具或方法论、是否有指定风格。" : "For example: required cases, tools, methods, or visual preferences."}">${escapeSlideBriefHtml(draft.requirementNotes || "")}</textarea></label><footer class="slides-outline-footer"><button type="button" class="slides-footer-back" data-requirements-back>${copy.back}</button><button class="slides-generator-submit slides-outline-confirm" type="submit"><span>${copy.confirm}</span></button></footer></section>`;
    panel.querySelector(".slides-confirmation-card")?.insertAdjacentHTML("afterbegin", renderWorkflowStageBar(0));
    const host = panel.querySelector(".slides-requirement-groups");
    const groupMeta = { goal:copy.goal, audience:copy.audience, scenario:copy.scenario, length:copy.length };
    const renderGroup = (key) => {
      const group = requirements[key]; const section = document.createElement("section"); section.className = "slides-requirement-group"; section.dataset.requirementGroup = key;
      group.customOptions = Array.isArray(group.customOptions) ? [...new Set(group.customOptions.map((item) => String(item || "").trim()).filter(Boolean))] : [];
      const heading = document.createElement("div"); heading.className = "slides-requirement-heading"; const title = document.createElement("h3"); const order={goal:1,audience:2,scenario:3,length:4}; title.textContent = `${order[key]}. ${groupMeta[key][0]}`; const help = document.createElement("p"); help.textContent = groupMeta[key][1]; heading.append(title, help);
      const choices = document.createElement("div"); choices.className = "slides-requirement-choices"; choices.setAttribute("role","radiogroup"); choices.setAttribute("aria-label", groupMeta[key][0]);
      if (key === "length") {
        const selectedLength = /^\d+$/.test(String(group.selected || "")) ? String(group.selected) : null;
        group.options = [...new Set(["auto", "8", "12", "15", ...(selectedLength ? [selectedLength] : [])])];
      }
      const lengthLabels = language === "zh"
        ? { auto:`智能适配（推荐 ${count} 页）`, "8":"精简版（8 页）", "12":"标准版（12 页）", "15":"深入版（15 页）" }
        : { auto:`Smart fit (${count} pages recommended)`, "8":"Concise (8 pages)", "12":"Standard (12 pages)", "15":"In-depth (15 pages)" };
      group.options.forEach((option) => { const button = document.createElement("button"); button.type = "button"; button.className = "slides-requirement-choice"; button.setAttribute("role","radio"); button.setAttribute("aria-checked", String(option === group.selected)); if (option === group.selected) button.classList.add("selected"); button.textContent = key === "length" ? (lengthLabels[option] || `${option} ${language === "zh" ? "页" : "pages"}`) : option; button.onclick = () => { group.selected = option; choices.querySelectorAll(".slides-requirement-choice").forEach((choice) => { const selected = choice === button; choice.classList.toggle("selected", selected); choice.setAttribute("aria-checked", String(selected)); }); syncDraft({ requirements }); }; if (!group.customOptions.includes(option)) { choices.append(button); return; } const customOption = document.createElement("div"); customOption.className = "slides-requirement-custom-option"; const remove = document.createElement("button"); remove.type = "button"; remove.className = "slides-requirement-custom-remove"; remove.setAttribute("aria-label", language === "zh" ? `删除自定义选项：${option}` : `Delete custom option: ${option}`); remove.title = remove.getAttribute("aria-label"); remove.append(slidesIcon("close")); remove.onclick = (event) => { event.preventDefault(); event.stopPropagation(); group.options = group.options.filter((item) => item !== option); group.customOptions = group.customOptions.filter((item) => item !== option); customOption.remove(); if (group.selected === option) { group.selected = group.options[0] || ""; const fallbackButton = choices.querySelector(".slides-requirement-choice"); fallbackButton?.classList.add("selected"); fallbackButton?.setAttribute("aria-checked","true"); } syncDraft({ requirements }); }; customOption.append(button, remove); choices.append(customOption); });
      const add = document.createElement("button"); add.type = "button"; add.className = "slides-requirement-add"; add.append(slidesIcon("plus"), document.createTextNode(copy.add));
      const editor = document.createElement("div"); editor.className = "slides-requirement-custom"; editor.hidden = true; const input = document.createElement("input"); input.maxLength = 180; if (key === "length") { input.type = "number"; input.min = "1"; input.max = "20"; } input.placeholder = copy.addPlaceholder; input.setAttribute("aria-label", `${groupMeta[key][0]} · ${copy.add}`); const save = document.createElement("button"); save.type = "button"; save.textContent = language === "zh" ? "添加" : "Add"; const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = copy.cancel; editor.append(input, save, cancel);
      add.onclick = () => { add.hidden = true; editor.hidden = false; input.focus(); };
      cancel.onclick = () => { editor.hidden = true; add.hidden = false; input.value = ""; };
      const saveCustomOption = () => { let value = input.value.trim(); if (key === "length") { const parsed = Number.parseInt(value, 10); if (!Number.isFinite(parsed)) return; value = String(Math.max(1, Math.min(20, parsed))); } if (!value) return; group.options = [...new Set([value, ...group.options])].slice(0, 7); group.customOptions = [...new Set([value, ...group.customOptions])].filter((item) => group.options.includes(item)); group.selected = value; syncDraft({ requirements }); renderRequirements(); };
      save.onclick = saveCustomOption; input.onkeydown = (event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); saveCustomOption(); } };
      choices.append(add, editor); section.append(heading, choices); return section;
    };
    for (const key of ["goal","audience","scenario","length"]) host.append(renderGroup(key));
    const advance = async () => {
      const nextCount = Math.max(1, Math.min(20, Number.parseInt(requirements.length.selected, 10) || count || 8));
      const notes = panel.querySelector(".slides-requirement-notes textarea").value.trim();
      brief = { ...(brief || {}), goal:requirements.goal.selected, audience:requirements.audience.selected, scenario:requirements.scenario.selected, recommendedPageCount:nextCount, additionalNotes:notes };
      syncDraft({ brief, requirements, requirementNotes:notes, count:nextCount, phase:"planning" });
      await startOutlineFromBrief(brief, nextCount, panel.querySelector(".slides-generator-status"));
    };
    panel.querySelector("[data-requirements-back]").onclick = () => { syncDraft({ phase:"brief" }); renderBrief(); };
    panel.querySelector(".slides-requirement-notes textarea").oninput = (event) => syncDraft({ requirementNotes:event.target.value });
    panel.onsubmit = (event) => { event.preventDefault(); clearOutlineCountdown(); advance(); };
    panel.onkeydown = (event) => { if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return; if (event.target.matches("button,input,textarea,select") || event.target.closest(".slides-requirement-custom")) return; event.preventDefault(); panel.requestSubmit(); };
    window.requestAnimationFrame(() => { if (enteringRequirements) panel.closest(".slides-deck-stage")?.scrollTo({ top:0 }); panel.focus({ preventScroll:true }); });
  };
  const renderStoryline = () => {
    if (outline?.slides?.length) { structure = outline.structure || structure; syncDraft({ storyline:outline.storyline || storyline, structure, phase:"structure" }); renderStructure(); return; }
    clearOutlineCountdown(); setPanelMode("storyline"); syncDraft({ phase:"storyline" });
    if (!storyline?.chapters?.length) storyline = { path:outline.slides.slice(0,4).map((slide) => slide.title).join(" → "), tag:language === "zh" ? "演示方案" : "Presentation plan", chapters:outline.slides.slice(0,4).map((slide,index) => ({ title:slide.title, role:index === 0 ? (language === "zh" ? "背景铺垫" : "Context") : (language === "zh" ? "论据展开" : "Development"), summary:slide.message, slideNumbers:[index + 1] })) };
    panel.innerHTML = `<section class="slides-storyline-card"><header><span class="slides-storyline-icon" aria-hidden="true"></span><div><span class="slides-outline-eyebrow">${language === "zh" ? "内部叙事参考" : "Internal narrative reference"}</span><h2>${language === "zh" ? "大纲故事线" : "Outline storyline"}</h2><p>${language === "zh" ? "故事线只用于 AI 判断内容推进方式，不会把页面强制拆成四章或生成四个章节页。下方仍按每一页确认具体内容。" : "The storyline guides AI reasoning only. It does not force chapter pages; confirm every page below."}</p></div></header><div class="slides-storyline-reference"><strong data-storyline-path></strong><span data-storyline-tag></span></div><div class="slides-storyline-pages"></div><footer class="slides-outline-footer"><button type="button" class="slides-footer-back">${language === "zh" ? "返回修改需求" : "Back"}</button><button class="slides-generator-submit" type="submit">${language === "zh" ? "确认逐页内容，查看页面结构" : "Confirm pages and review structure"}</button></footer></section>`;
    panel.querySelector(".slides-storyline-icon").append(slidesIcon("storyline"));
    panel.querySelector("[data-storyline-path]").textContent = storyline.path || "";
    panel.querySelector("[data-storyline-tag]").textContent = storyline.tag || (language === "zh" ? "演示方案" : "Presentation plan");
    const pagesHost = panel.querySelector(".slides-storyline-pages");
    outline.slides.forEach((slide,index) => {
      const row = document.createElement("article"); row.className = "slides-storyline-page";
      const pageRole = outline.structure?.pages?.[index]?.role || (index === 0 ? "cover" : index === outline.slides.length - 1 ? "closing" : "content");
      const role = (language === "zh" ? { cover:"封面", agenda:"目录", section:"章节", content:"内容", summary:"总结", closing:"结尾" } : { cover:"Cover", agenda:"Agenda", section:"Section", content:"Content", summary:"Summary", closing:"Closing" })[pageRole] || pageRole;
      row.innerHTML = `<span>${language === "zh" ? `第 ${index + 1} 页` : `Page ${index + 1}`}</span><b>${role}</b><div><input maxlength="120" data-storyline-page-title aria-label="${language === "zh" ? `第 ${index + 1} 页标题` : `Page ${index + 1} title`}"><textarea maxlength="600" data-storyline-page-message aria-label="${language === "zh" ? `第 ${index + 1} 页内容` : `Page ${index + 1} content`}"></textarea><small>${escapeSlideBriefHtml(slide.visual || "")}</small></div>`;
      const title = row.querySelector("[data-storyline-page-title]"); const message = row.querySelector("[data-storyline-page-message]"); title.value = slide.title || ""; message.value = slide.message || "";
      const save = () => { slide.title = title.value; slide.message = message.value; syncDraft({ outline }); }; title.oninput = save; message.oninput = save; pagesHost.append(row);
    });
    panel.querySelector(".slides-footer-back").onclick = () => { syncDraft({ phase:"requirements" }); renderRequirements(); };
    panel.onsubmit = async (event) => {
      event.preventDefault();
      outline.storyline = structuredClone(storyline); structure = outline.structure || structure; syncDraft({ storyline, outline, structure, phase:"structure" }); renderStructure();
    };
    window.requestAnimationFrame(() => panel.focus({ preventScroll:true }));
  };

  const applyAutomaticVisualRhythm = () => {
    const silhouettes = ["full-bleed","left-visual","right-visual","centered","split","grid","timeline"];
    const routeFor = (slide) => ["chart","dashboard"].includes(slide.intent) ? "chart" : ["process","timeline","architecture"].includes(slide.intent) ? "diagram" : ["cover","hero","image","case"].includes(slide.intent) ? "visual" : "native";
    visualRhythm = outline.slides.map((slide,index) => ({ pageNumber:index + 1, treatment:routeFor(slide) === "chart" ? "chart" : routeFor(slide) === "diagram" ? "diagram" : routeFor(slide) === "visual" ? "hero-image" : index % 3 === 0 ? "editorial" : "minimal", density:index === 0 ? "low" : "medium", silhouette:silhouettes[index % silhouettes.length], specialistRoute:routeFor(slide) }));
    for (let index = 1; index < visualRhythm.length; index += 1) if (visualRhythm[index].silhouette === visualRhythm[index - 1].silhouette) visualRhythm[index].silhouette = silhouettes[(silhouettes.indexOf(visualRhythm[index].silhouette) + 1) % silhouettes.length];
    outline.designSystem = structuredClone(designSystem || outline.designSystem || {}); outline.visualRhythm = structuredClone(visualRhythm); outline.slides.forEach((slide,index) => Object.assign(slide, visualRhythm[index] || {})); syncDraft({ designSystem, visualRhythm, outline });
  };

  const renderSlideThumbnail = (slide, index) => {
    const intent = String(slide.intent || "hero");
    const specialistRoute = String(slide.specialistRoute || slide.specialistRouteForIntent || "native");
    const bgClass = specialistRoute === "visual" ? "is-visual" : specialistRoute === "chart" ? "is-chart" : specialistRoute === "diagram" ? "is-diagram" : intent === "cover" ? "is-cover" : "is-content";
    const layoutClass = (() => {
      if (intent === "cover") return "is-cover-hero";
      if (specialistRoute === "visual") return index % 2 === 0 ? "is-hero-right" : "is-hero-left";
      if (intent === "case") return "is-case-study";
      if (intent === "comparison") return "is-split-50";
      return "";
    })();
    const hasVisual = specialistRoute === "visual";
    const hasChart = specialistRoute === "chart";
    const hasDiagram = specialistRoute === "diagram";
    const hasComparison = intent === "comparison";
    const thumb = document.createElement("div");
    thumb.className = `slides-outline-preview-thumb ${layoutClass}`;
    const bg = document.createElement("div");
    bg.className = `thumb-bg ${bgClass}`;
    thumb.append(bg);
    const titleZone = document.createElement("div");
    titleZone.className = "thumb-title";
    const titleBar = document.createElement("div");
    titleBar.className = "thumb-title-bar";
    titleZone.append(titleBar);
    thumb.append(titleZone);
    if (intent !== "cover") {
      const subBar = document.createElement("div");
      subBar.className = "thumb-subtitle-bar";
      thumb.append(subBar);
    }
    if (hasVisual) {
      const visual = document.createElement("div");
      visual.className = "thumb-visual";
      thumb.append(visual);
    } else if (hasChart) {
      const chart = document.createElement("div");
      chart.className = "thumb-chart";
      for (let b = 0; b < 5; b++) {
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.height = `${30 + Math.sin(b * 1.2) * 25 + 25}%`;
        chart.append(bar);
      }
      thumb.append(chart);
    } else if (hasDiagram) {
      const diagram = document.createElement("div");
      diagram.className = "thumb-diagram";
      const nodeCount = intent === "architecture" ? 3 : intent === "timeline" ? 4 : 3;
      for (let n = 0; n < nodeCount; n++) {
        const node = document.createElement("div");
        node.className = "diagram-node";
        diagram.append(node);
        if (n < nodeCount - 1) {
          const arrow = document.createElement("div");
          arrow.className = "diagram-arrow";
          diagram.append(arrow);
        }
      }
      thumb.append(diagram);
    } else if (hasComparison) {
      const comp = document.createElement("div");
      comp.className = "thumb-comparison";
      comp.append(document.createElement("div"), document.createElement("div"));
      thumb.append(comp);
    } else {
      const content = document.createElement("div");
      content.className = "thumb-content";
      const lineConfigs = [["accent", ""], ["medium", ""], ["short", ""], ["medium", ""], ["short", ""]];
      lineConfigs.forEach(([cls], i) => {
        const line = document.createElement("div");
        line.className = `content-line ${cls}`;
        line.style.opacity = 0.7 - i * 0.08;
        content.append(line);
      });
      thumb.append(content);
    }
    return thumb;
  };

  const renderSlidePreviewCard = (slide, index, page, isEditing) => {
    const intent = String(slide.intent || "hero");
    const specialistRoute = String(slide.specialistRoute || "native");
    const slideTitle = String(slide.title || "");
    const keyPoints = Array.isArray(slide.keyPoints) ? slide.keyPoints : [];
    const visualText = String(slide.visual || "");
    const narrativeLogic = String(slide.narrativeLogic || "");
    const subtitle = String(slide.subtitle || "");
    const lead = String(slide.lead || slide.message || "");
    const quote = String(slide.quote || "");
    const visualPrompts = (Array.isArray(slide.visualPrompts) ? slide.visualPrompts : []).map((item) => String(item || "").trim()).filter(Boolean);
    if (visualText && !visualPrompts.length) visualPrompts.push(visualText);
    const createVisualPrompt = (text) => {
      const prompt = document.createElement("span");
      prompt.className = "visual-prompt";
      const icon = document.createElement("span");
      icon.className = "prompt-icon";
      icon.append(slidesIcon("image"));
      prompt.append(icon, document.createTextNode(language === "zh" ? `生成图片：${text}` : `Generate image: ${text}`));
      return prompt;
    };
    const routeLabel = language === "zh"
      ? { visual:"视觉", chart:"图表", diagram:"图形/流程", native:"内容" }
      : { visual:"Visual", chart:"Chart", diagram:"Diagram", native:"Content" };
    const intentLabel = language === "zh"
      ? { cover:"封面", hero:"主视觉", chart:"图表", comparison:"对比", process:"流程", timeline:"时间线", architecture:"架构", case:"案例", dashboard:"仪表盘", summary:"总结", image:"图片" }
      : { cover:"Cover", hero:"Hero", chart:"Chart", comparison:"Compare", process:"Process", timeline:"Timeline", architecture:"Architecture", case:"Case", dashboard:"Dashboard", summary:"Summary", image:"Image" };
    const card = document.createElement("article");
    const isVisualInterspersed = specialistRoute === "visual";
    const isContentOnly = specialistRoute === "native" || specialistRoute === "chart" || specialistRoute === "diagram";
    card.className = `slides-outline-preview-card ${isEditing ? "is-editing" : ""} ${isVisualInterspersed ? "is-visual-interspersed" : isContentOnly ? "is-content-only" : ""}`;
    const header = document.createElement("div");
    header.className = "slides-outline-preview-header";
    const pageLabel = document.createElement("span");
    pageLabel.className = "page-label";
    pageLabel.textContent = language === "zh" ? `第 ${index + 1} 页` : `Page ${index + 1}`;
    const badge = document.createElement("span");
    badge.className = `intent-badge is-${specialistRoute === "visual" ? "visual" : specialistRoute === "chart" ? "chart" : specialistRoute === "diagram" ? "diagram" : intent === "cover" ? "cover" : "content"}`;
    badge.textContent = `${intentLabel[intent] || intent} · ${routeLabel[specialistRoute] || specialistRoute}`;
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = `slides-outline-edit-btn ${isEditing ? "is-active" : ""}`;
    editBtn.innerHTML = `${isEditing ? (language === "zh" ? "完成" : "Done") : (language === "zh" ? "编辑" : "Edit")}`;
    header.append(pageLabel, badge, editBtn);
    card.append(header);
    const body = document.createElement("div");
    body.className = "slides-outline-preview-body";
    if (isVisualInterspersed) {
      const title = document.createElement("div");
      title.className = "slide-title";
      title.textContent = slideTitle;
      body.append(title);
      const list = document.createElement("div");
      list.className = "visual-block-list";
      if (keyPoints.length) {
        keyPoints.forEach((point, pi) => {
          const block = document.createElement("div");
          block.className = "visual-block";
          if (visualPrompts[pi]) block.append(createVisualPrompt(visualPrompts[pi]));
          if (point?.heading) {
            const h = document.createElement("h4");
            h.textContent = point.heading;
            block.append(h);
          }
          if (point?.body) {
            const ul = document.createElement("ul");
            const li = document.createElement("li");
            li.innerHTML = point.body.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
            ul.append(li);
            block.append(ul);
          }
          list.append(block);
        });
      } else if (lead || visualText) {
        const block = document.createElement("div");
        block.className = "visual-block";
        if (visualText) {
          block.append(createVisualPrompt(visualText));
        }
        if (lead) {
          const ul = document.createElement("ul");
          const li = document.createElement("li");
          li.innerHTML = lead.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          ul.append(li);
          block.append(ul);
        }
        list.append(block);
      }
      body.append(list);
    } else if (isContentOnly) {
      const title = document.createElement("div");
      title.className = "slide-title";
      title.textContent = slideTitle;
      body.append(title);
      const sections = document.createElement("div");
      sections.className = "content-sections";
      if (visualPrompts.length) {
        const visualPlan = document.createElement("div");
        visualPlan.className = "content-section visual-prompt-plan";
        for (const promptText of visualPrompts) visualPlan.append(createVisualPrompt(promptText));
        sections.append(visualPlan);
      }
      if (subtitle) {
        const sec = document.createElement("div");
        sec.className = "content-section";
        const h = document.createElement("h4");
        h.textContent = subtitle;
        const p = document.createElement("p");
        p.style.margin = "0";
        p.style.color = "#475467";
        p.style.fontSize = "13px";
        p.style.lineHeight = "1.55";
        p.innerHTML = lead.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        sec.append(h, p);
        sections.append(sec);
      }
      keyPoints.forEach((point) => {
        const sec = document.createElement("div");
        sec.className = "content-section";
        if (point?.heading) {
          const h = document.createElement("h4");
          h.textContent = point.heading;
          sec.append(h);
        }
        if (point?.body) {
          const ul = document.createElement("ul");
          const li = document.createElement("li");
          li.innerHTML = point.body.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          ul.append(li);
          sec.append(ul);
        }
        sections.append(sec);
      });
      if (!subtitle && !keyPoints.length && lead) {
        const sec = document.createElement("div");
        sec.className = "content-section";
        const p = document.createElement("p");
        p.style.margin = "0";
        p.style.color = "#475467";
        p.style.fontSize = "13px";
        p.style.lineHeight = "1.55";
        p.textContent = lead;
        sec.append(p);
        sections.append(sec);
      }
      if (quote) {
        const sec = document.createElement("div");
        sec.className = "content-section";
        const p = document.createElement("p");
        p.style.margin = "0";
        p.style.color = "#344054";
        p.style.fontSize = "13px";
        p.style.fontWeight = "600";
        p.textContent = `"${quote}"`;
        sec.append(p);
        sections.append(sec);
      }
      body.append(sections);
    } else {
      const title = document.createElement("div");
      title.className = "slide-title";
      title.textContent = slideTitle;
      body.append(title);
      if (keyPoints.length) {
        const points = document.createElement("div");
        points.className = "slide-points";
        keyPoints.slice(0, 3).forEach((point) => {
          const p = document.createElement("div");
          p.className = "slide-point";
          const text = point?.heading ? `<strong>${point.heading}</strong> ${point?.body || ""}` : (point?.body || "");
          p.innerHTML = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          points.append(p);
        });
        body.append(points);
      } else if (lead) {
        const p = document.createElement("div");
        p.className = "slide-point";
        p.textContent = lead;
        body.append(p);
      }
    }
    if (narrativeLogic) {
      const narr = document.createElement("div");
      narr.className = "slide-narrative";
      narr.textContent = language === "zh" ? `叙事逻辑：${narrativeLogic}` : `Narrative: ${narrativeLogic}`;
      body.append(narr);
    }
    card.append(body);
    const roleLabels = language === "zh" ? { cover:"封面", agenda:"目录", section:"章节", content:"内容", summary:"总结", closing:"结尾" } : { cover:"Cover", agenda:"Agenda", section:"Section", content:"Content", summary:"Summary", closing:"Closing" };
    const roleOptions = Object.entries(roleLabels).map(([value,label]) => `<option value="${value}">${label}</option>`).join("");
    const form = document.createElement("form");
    form.className = "slides-outline-edit-form";
    form.innerHTML = `
      <label><span>${language === "zh" ? "页面角色" : "Page role"}</span><select data-edit-role>${roleOptions}</select></label>
      <label><span>${language === "zh" ? "页面标题" : "Page title"}</span><input data-edit-title maxlength="120"></label>
      <label><span>${language === "zh" ? "副标题／核心判断" : "Subtitle / key claim"}</span><input data-edit-subtitle maxlength="240"></label>
      <label><span>${language === "zh" ? "引导语／核心内容" : "Lead / key content"}</span><textarea data-edit-message maxlength="800"></textarea></label>
      <div class="key-points-editor" data-edit-points></div>
      <label><span>${language === "zh" ? "图片生成方向" : "Image direction"}</span><textarea data-edit-visual maxlength="400"></textarea></label>
      <label><span>${language === "zh" ? "叙事逻辑" : "Narrative logic"}</span><textarea data-edit-narrative maxlength="600"></textarea></label>
      <label><span>${language === "zh" ? "演讲者备注" : "Speaker notes"}</span><textarea data-edit-notes maxlength="1200"></textarea></label>
      <div class="form-actions"><button type="button" data-edit-cancel>${language === "zh" ? "取消" : "Cancel"}</button><button type="button" class="is-primary" data-edit-save>${language === "zh" ? "保存" : "Save"}</button></div>
    `;
    card.append(form);
    return { card, editBtn, form };
  };

  const populateEditForm = (form, slide, page, index) => {
    const roleSel = form.querySelector("[data-edit-role]");
    roleSel.value = page.role || slide.role || "content";
    roleSel.disabled = index === 0 || index === structure.pages.length - 1;
    form.querySelector("[data-edit-title]").value = slide.title || page.title || "";
    form.querySelector("[data-edit-subtitle]").value = slide.subtitle || "";
    form.querySelector("[data-edit-message]").value = slide.lead || slide.message || "";
    form.querySelector("[data-edit-visual]").value = slide.visual || "";
    form.querySelector("[data-edit-narrative]").value = slide.narrativeLogic || page.narrativePurpose || "";
    form.querySelector("[data-edit-notes]").value = slide.speakerNotes || "";
    const pointsHost = form.querySelector("[data-edit-points]");
    pointsHost.innerHTML = "";
    const keyPoints = Array.isArray(slide.keyPoints) && slide.keyPoints.length ? slide.keyPoints : [];
    if (!keyPoints.length) {
      const label = document.createElement("strong");
      label.textContent = language === "zh" ? "内容要点（可选）" : "Content points (optional)";
      pointsHost.append(label);
      const hint = document.createElement("span");
      hint.className = "editor-hint";
      hint.textContent = language === "zh" ? "当前页面无要点，保存后将自动生成。" : "No points for this page. They will be auto-generated on save.";
      hint.style.cssText = "color:#98a2b3;font-size:11px;margin-top:4px;display:block";
      pointsHost.append(hint);
      return;
    }
    const label = document.createElement("strong");
    label.textContent = language === "zh" ? "内容要点" : "Content points";
    pointsHost.append(label);
    keyPoints.forEach((point, pi) => {
      const row = document.createElement("div");
      row.className = "point-row";
      const headingInput = document.createElement("input");
      headingInput.type = "text";
      headingInput.placeholder = language === "zh" ? "要点标题（可选）" : "Point heading (optional)";
      headingInput.maxLength = 120;
      headingInput.value = point.heading || "";
      headingInput.dataset.pointHeading = String(pi);
      const bodyInput = document.createElement("textarea");
      bodyInput.placeholder = language === "zh" ? "具体内容" : "Point content";
      bodyInput.maxLength = 600;
      bodyInput.value = point.body || "";
      bodyInput.dataset.pointBody = String(pi);
      row.append(headingInput, bodyInput);
      pointsHost.append(row);
    });
  };

  const collectEditForm = (form) => {
    const roleSel = form.querySelector("[data-edit-role]");
    const title = form.querySelector("[data-edit-title]").value.trim();
    const subtitle = form.querySelector("[data-edit-subtitle]").value.trim();
    const lead = form.querySelector("[data-edit-message]").value.trim();
    const visual = form.querySelector("[data-edit-visual]").value.trim();
    const narrativeLogic = form.querySelector("[data-edit-narrative]").value.trim();
    const speakerNotes = form.querySelector("[data-edit-notes]").value.trim();
    const pointsHost = form.querySelector("[data-edit-points]");
    const keyPoints = [];
    pointsHost.querySelectorAll(".point-row").forEach((row) => {
      const heading = row.querySelector("input").value.trim();
      const body = row.querySelector("textarea").value.trim();
      if (heading || body) keyPoints.push({ heading, body });
    });
    return { role: roleSel.value, title, subtitle, lead, keyPoints, visual, narrativeLogic, speakerNotes };
  };

  const renderStructure = () => {
    clearOutlineCountdown(); setPanelMode("structure"); syncDraft({ phase:"structure" });
    if (!structure?.pages?.length) structure = { agendaMode:"off", sectionMode:"off", summaryMode:"off", closingMode:"required", pages:outline.slides.map((slide,index) => ({ id:`page-${index + 1}`, order:index + 1, role:index === 0 ? "cover" : index === outline.slides.length - 1 ? "closing" : "content", chapterId:null, title:slide.title, narrativePurpose:slide.message, layoutFamily:index === 0 ? "title" : index === outline.slides.length - 1 ? "closing" : "title-content" })) };
    const roleLabels = language === "zh" ? { cover:"封面", agenda:"目录", section:"章节", content:"内容", summary:"总结", closing:"结尾" } : { cover:"Cover", agenda:"Agenda", section:"Section", content:"Content", summary:"Summary", closing:"Closing" };
    const layoutByRole = { cover:"title", agenda:"agenda", section:"section-header", content:"title-content", summary:"summary", closing:"closing" };
    storyline = outline.storyline || storyline || { path:outline.slides.slice(0,4).map((slide) => slide.title).join(" → "), chapters:[] };
    if (!Array.isArray(storyline.chapters) || !storyline.chapters.length) storyline.chapters = [{ id:"chapter-1", title:language === "zh" ? "主体内容" : "Main content", role:language === "zh" ? "论据展开" : "Development", summary:language === "zh" ? "围绕核心目标展开逐页内容" : "Develop the page sequence around the core goal", slideNumbers:outline.slides.map((_, index) => index + 1) }];
    outline.storyline = storyline;
    panel.innerHTML = `<section class="slides-structure-card slides-content-structure-card"><header><span class="slides-structure-icon" aria-hidden="true"></span><div><span class="slides-outline-eyebrow">${language === "zh" ? "第二步 · 大纲确认" : "Step 2 · Outline confirmation"}</span><h2>${language === "zh" ? "确认全局叙事框架与逐页内容" : "Confirm the narrative framework and page plan"}</h2><p>${language === "zh" ? "先查看 AI 规划的整套故事线，再逐页编辑内容。只有确认大纲后才会开始正式生成。" : "Review the AI-planned deck story, then edit each page. Formal generation starts only after approval."}</p></div><span class="slides-structure-count">${structure.pages.length} ${language === "zh" ? "页" : "pages"}</span></header><section class="slides-narrative-plan" aria-labelledby="slides-narrative-plan-title"><header class="slides-narrative-plan-header"><div><span class="slides-narrative-plan-icon" aria-hidden="true"></span><h3 id="slides-narrative-plan-title">${language === "zh" ? "大纲故事线" : "Outline storyline"}</h3></div><button type="button" data-narrative-toggle aria-expanded="true"><span>${language === "zh" ? "收起" : "Collapse"}</span><i aria-hidden="true"></i></button></header><div class="slides-narrative-plan-body"><strong class="slides-narrative-path-text"></strong><span class="slides-narrative-tag"></span><div data-narrative-chapter-list></div></div></section><div class="slides-structure-pages"></div><button type="button" class="slides-structure-add">＋ ${language === "zh" ? "在结尾前添加内容页" : "Add content page before closing"}</button><footer class="slides-outline-footer"><button type="button" class="slides-footer-back">${language === "zh" ? "返回需求确认" : "Back to requirements"}</button><button class="slides-generator-submit" type="submit">${language === "zh" ? "确认大纲并开始生成" : "Confirm outline and generate"}</button></footer></section>`;
    panel.querySelector(".slides-content-structure-card")?.insertAdjacentHTML("afterbegin", renderWorkflowStageBar(1));
    const structureConfirmButton = panel.querySelector(".slides-content-structure-card .slides-outline-footer .slides-generator-submit");
    if (structureConfirmButton) {
      structureConfirmButton.classList.add("slides-structure-confirm");
      structureConfirmButton.textContent = language === "zh" ? "确认大纲" : "Confirm outline";
    }
    panel.querySelector(".slides-structure-icon").append(slidesIcon("layout"));
    panel.querySelector(".slides-narrative-plan-icon").append(slidesIcon("storyline"));
    panel.querySelector(".slides-narrative-path-text").textContent = storyline.path || (language === "zh" ? "情境引入 → 能力拆解 → 价值验证 → 愿景收束" : "Context → Capability → Validation → Vision");
    const genericNarrativeTag = /^(通用品牌汇报|演示方案|presentation plan)$/i;
    const narrativeTag = String(storyline.tag || "").trim();
    panel.querySelector(".slides-narrative-tag").textContent = narrativeTag && !genericNarrativeTag.test(narrativeTag) ? narrativeTag : (language === "zh" ? "专业说服型" : "Professional persuasive");
    const narrativePlan = panel.querySelector(".slides-narrative-plan");
    const narrativeToggle = panel.querySelector("[data-narrative-toggle]");
    let narrativeCollapsed = Boolean(draft.narrativeCollapsed);
    const renderNarrativeCollapsedState = () => {
      narrativePlan.classList.toggle("is-collapsed", narrativeCollapsed);
      narrativeToggle.setAttribute("aria-expanded", String(!narrativeCollapsed));
      narrativeToggle.querySelector("span").textContent = language === "zh" ? (narrativeCollapsed ? "展开" : "收起") : (narrativeCollapsed ? "Expand" : "Collapse");
      const iconHost = narrativeToggle.querySelector("i"); iconHost.replaceChildren(slidesIcon(narrativeCollapsed ? "chevron-down" : "chevron-up"));
    };
    narrativeToggle.onclick = () => { narrativeCollapsed = !narrativeCollapsed; syncDraft({ narrativeCollapsed }); renderNarrativeCollapsedState(); };
    renderNarrativeCollapsedState();
    const chapterList = panel.querySelector("[data-narrative-chapter-list]");
    const chapterNumerals = language === "zh" ? ["一","二","三","四","五","六"] : [];
    storyline.chapters.slice(0,6).forEach((chapter, chapterIndex) => {
      const chapterPageNumbers = structure.pages.map((page, index) => page.chapterId === chapter.id ? index + 1 : null).filter(Boolean);
      const fallbackNumbers = Array.isArray(chapter.slideNumbers) ? chapter.slideNumbers : [];
      const pageNumbers = chapterPageNumbers.length ? chapterPageNumbers : fallbackNumbers;
      const pageRange = pageNumbers.length ? (pageNumbers.length === 1 ? String(pageNumbers[0]) : `${Math.min(...pageNumbers)}–${Math.max(...pageNumbers)}`) : "—";
      const row = document.createElement("article"); row.className = "slides-narrative-chapter";
      const chapterLabel = language === "zh" ? `第${chapterNumerals[chapterIndex] || chapterIndex + 1}章 ${chapter.title || ""}：` : `Chapter ${chapterIndex + 1} · ${chapter.title || ""}`;
      row.innerHTML = `<strong class="slides-narrative-chapter-title"></strong><span class="slides-narrative-chapter-purpose"></span><small>${language === "zh" ? `第 ${pageRange} 页` : `Pages ${pageRange}`}</small>`;
      row.querySelector(".slides-narrative-chapter-title").textContent = chapterLabel;
      row.querySelector(".slides-narrative-chapter-purpose").textContent = [chapter.role, chapter.summary].filter(Boolean).join(" — ");
      chapter.slideNumbers = pageNumbers; chapterList.append(row);
    });
    const host = panel.querySelector(".slides-structure-pages");
    structure.pages.forEach((page, index) => {
      page.order = index + 1; page.title = outline.slides[index]?.title || page.title;
      const slideDraft = outline.slides[index] || {};
      const row = document.createElement("article"); row.className = "slides-structure-page preview-mode"; row.draggable = index > 0 && index < structure.pages.length - 1;
      const handle = document.createElement("span"); handle.className = "slides-structure-handle"; handle.append(slidesIcon("grip")); row.append(handle);
      const { card, editBtn, form } = renderSlidePreviewCard(slideDraft, index, page, false);
      const header = card.querySelector(".slides-outline-preview-header");
      const navGroup = document.createElement("span"); navGroup.className = "preview-card-nav-group";
      const moveUpBtn = document.createElement("button"); moveUpBtn.type = "button"; moveUpBtn.className = "preview-card-nav"; moveUpBtn.setAttribute("aria-label", language === "zh" ? "上移" : "Move up"); moveUpBtn.append(slidesIcon("move-up")); moveUpBtn.disabled = index <= 1;
      const moveDownBtn = document.createElement("button"); moveDownBtn.type = "button"; moveDownBtn.className = "preview-card-nav"; moveDownBtn.setAttribute("aria-label", language === "zh" ? "下移" : "Move down"); moveDownBtn.append(slidesIcon("move-down")); moveDownBtn.disabled = index >= structure.pages.length - 2;
      const delBtn = document.createElement("button"); delBtn.type = "button"; delBtn.className = "preview-card-nav preview-card-nav-delete"; delBtn.setAttribute("aria-label", language === "zh" ? "删除" : "Delete"); delBtn.append(slidesIcon("trash")); delBtn.disabled = structure.pages.length <= 3 || index === 0 || index === structure.pages.length - 1;
      navGroup.append(moveUpBtn, moveDownBtn, delBtn);
      header.insertBefore(navGroup, editBtn);
      row.append(card);
      const actions = document.createElement("div"); actions.className = "slides-structure-actions"; actions.style.display = "none"; row.append(actions);
      const doMove = (from, to) => { if (from === 0 || from === structure.pages.length - 1 || to <= 0 || to >= structure.pages.length - 1) return; structure.pages.splice(to, 0, structure.pages.splice(from, 1)[0]); outline.slides.splice(to, 0, outline.slides.splice(from, 1)[0]); syncDraft({ structure, outline }); renderStructure(); };
      moveUpBtn.onclick = () => doMove(index, index - 1);
      moveDownBtn.onclick = () => doMove(index, index + 1);
      delBtn.onclick = () => { if (structure.pages.length <= 3 || index === 0 || index === structure.pages.length - 1) return; structure.pages.splice(index, 1); outline.slides.splice(index, 1); count = outline.slides.length; syncDraft({ structure, outline, count }); renderStructure(); };
      editBtn.onclick = () => { const willEdit = !card.classList.contains("is-editing"); if (willEdit) populateEditForm(form, slideDraft, page, index); card.classList.toggle("is-editing", willEdit); editBtn.innerHTML = willEdit ? (language === "zh" ? "完成" : "Done") : (language === "zh" ? "编辑" : "Edit"); };
      form.querySelector("[data-edit-save]").onclick = () => { const data = collectEditForm(form); page.role = data.role; page.layoutFamily = layoutByRole[page.role]; page.title = data.title; page.narrativePurpose = data.narrativeLogic; if (outline.slides[index]) { const target = outline.slides[index]; target.title = data.title; target.subtitle = data.subtitle; target.lead = data.lead; target.keyPoints = data.keyPoints; target.narrativeLogic = data.narrativeLogic; target.speakerNotes = data.speakerNotes; target.visual = data.visual; target.message = data.lead || data.keyPoints[0]?.body || page.narrativePurpose; target.role = data.role; target.layoutFamily = page.layoutFamily; } syncDraft({ structure, outline }); renderStructure(); };
      form.querySelector("[data-edit-cancel]").onclick = () => { card.classList.remove("is-editing"); editBtn.innerHTML = language === "zh" ? "编辑" : "Edit"; };
      row.ondragstart = () => { draggedIndex = index; row.classList.add("dragging"); }; row.ondragend = () => row.classList.remove("dragging"); row.ondragover = (event) => event.preventDefault(); row.ondrop = (event) => { event.preventDefault(); if (draggedIndex <= 0 || draggedIndex >= structure.pages.length - 1 || index <= 0 || index >= structure.pages.length - 1 || draggedIndex === index) return; structure.pages.splice(index, 0, structure.pages.splice(draggedIndex, 1)[0]); outline.slides.splice(index, 0, outline.slides.splice(draggedIndex, 1)[0]); draggedIndex = -1; syncDraft({ structure, outline }); renderStructure(); };
      host.append(row);
    });
    panel.querySelector(".slides-structure-add").onclick = () => { if (structure.pages.length >= 20) return showToast(language === "zh" ? "最多生成 20 页" : "Maximum 20 pages"); const insertAt = structure.pages.length - 1; const newSlide = { title:language === "zh" ? "新内容页" : "New content page", message:"", type:"insight", intent:"hero", visual:language === "zh" ? "根据内容选择视觉表达" : "Choose a visual treatment", role:"content", chapterId:null, layoutFamily:"title-content" }; outline.slides.splice(insertAt,0,newSlide); structure.pages.splice(insertAt,0,{ id:`page-${Date.now()}`, order:insertAt + 1, role:"content", chapterId:null, title:newSlide.title, narrativePurpose:"", layoutFamily:"title-content" }); count = outline.slides.length; syncDraft({ structure, outline, count }); renderStructure(); };
    panel.querySelector(".slides-footer-back").onclick = () => { syncDraft({ phase:"requirements" }); renderRequirements(); };
    panel.onsubmit = async (event) => {
      event.preventDefault(); structure.pages[0].role = "cover"; structure.pages[0].layoutFamily = "title"; structure.pages.at(-1).role = "closing"; structure.pages.at(-1).layoutFamily = "closing"; outline.structure = structuredClone(structure); syncDraft({ structure, outline });
      outline.storyline = structuredClone(storyline); applyAutomaticVisualRhythm(); await generateConfirmedOutline();
    };
    window.requestAnimationFrame(() => panel.focus({ preventScroll:true }));
  };

  const renderVisualSystem = () => {
    clearOutlineCountdown(); setPanelMode("visual-system"); syncDraft({ phase:"visual-system" });
    const brandProfile = draft.brandProfile || loadSlidesBrandProfile();
    const stylePresets = language === "zh" ? [
      { id:"professional", name:"专业商务", note:"克制、清晰，适合汇报与合作方案", primaryColor:"#315ff4", secondaryColor:"#dbeafe", backgroundColor:"#ffffff", textColor:"#172033", typography:"现代无衬线，清晰三级字阶", shapeLanguage:"克制圆角、细线与充足留白", imageLanguage:"真实商务场景，统一光线与色彩", chartLanguage:"扁平可编辑图表，重点色突出结论" },
      { id:"editorial", name:"精品杂志", note:"大图、留白与鲜明的编辑排版", primaryColor:"#7c3aed", secondaryColor:"#ede9fe", backgroundColor:"#fffdf9", textColor:"#241b2f", typography:"现代编辑字体，高对比标题", shapeLanguage:"非对称网格、细线与大留白", imageLanguage:"纪实主视觉，统一色调与裁切", chartLanguage:"极简图表，弱网格线与直接标注" },
      { id:"technology", name:"未来科技", note:"深色氛围、发光强调与数据视觉", primaryColor:"#22d3ee", secondaryColor:"#312e81", backgroundColor:"#07111f", textColor:"#f8fafc", typography:"几何无衬线，紧凑清晰", shapeLanguage:"玻璃面板、细线轨迹与柔和光晕", imageLanguage:"科技场景，深色统一调色", chartLanguage:"深色可编辑图表，高亮关键数据" },
      { id:"creative", name:"大胆创意", note:"高对比色、强主视觉与变化版式", primaryColor:"#f97316", secondaryColor:"#fde68a", backgroundColor:"#fffaf2", textColor:"#29180d", typography:"大胆标题与简洁正文", shapeLanguage:"几何切片、色块与动态构图", imageLanguage:"高饱和主视觉，富有动势", chartLanguage:"高对比图表，结论优先" }
    ] : [
      { id:"professional", name:"Professional", note:"Clear and restrained for business decks", primaryColor:"#315ff4", secondaryColor:"#dbeafe", backgroundColor:"#ffffff", textColor:"#172033", typography:"Modern sans serif with clear hierarchy", shapeLanguage:"Restrained corners, fine lines, generous whitespace", imageLanguage:"Authentic business scenes with consistent grading", chartLanguage:"Flat editable charts with takeaway accents" },
      { id:"editorial", name:"Editorial", note:"Hero imagery, whitespace, and magazine rhythm", primaryColor:"#7c3aed", secondaryColor:"#ede9fe", backgroundColor:"#fffdf9", textColor:"#241b2f", typography:"Editorial typography with strong headlines", shapeLanguage:"Asymmetric grids, fine rules, broad whitespace", imageLanguage:"Documentary hero imagery with consistent crops", chartLanguage:"Minimal charts with direct labels" },
      { id:"technology", name:"Technology", note:"Dark atmosphere, glow, and data visuals", primaryColor:"#22d3ee", secondaryColor:"#312e81", backgroundColor:"#07111f", textColor:"#f8fafc", typography:"Geometric sans serif with compact hierarchy", shapeLanguage:"Glass panels, fine tracks, soft glow", imageLanguage:"Dark technology scenes with unified grading", chartLanguage:"Dark editable charts with highlighted data" },
      { id:"creative", name:"Creative", note:"High contrast, bold visuals, varied layouts", primaryColor:"#f97316", secondaryColor:"#fde68a", backgroundColor:"#fffaf2", textColor:"#29180d", typography:"Bold headlines with clean body copy", shapeLanguage:"Geometric slices, color blocks, dynamic composition", imageLanguage:"High-saturation focal imagery with motion", chartLanguage:"High-contrast charts with takeaway first" }
    ];
    designSystem ||= brandProfile?.enabled ? { ...stylePresets[0], primaryColor:brandProfile.primaryColor || stylePresets[0].primaryColor, secondaryColor:brandProfile.secondaryColor || stylePresets[0].secondaryColor, backgroundColor:brandProfile.backgroundColor || stylePresets[0].backgroundColor, typography:brandProfile.fontFamily ? `${brandProfile.fontFamily}，严格使用企业品牌字体层级` : stylePresets[0].typography } : { ...stylePresets[0] }; delete designSystem.id; delete designSystem.name; delete designSystem.note;
    const selectedStyle = stylePresets.find((preset) => preset.primaryColor.toLowerCase() === String(designSystem.primaryColor || "").toLowerCase())?.id || "custom";
    panel.innerHTML = `<section class="slides-visual-system-card slides-simple-visual-card"><header><span class="slides-visual-system-icon" aria-hidden="true"></span><div><span class="slides-outline-eyebrow">${language === "zh" ? "整体视觉" : "Overall visual style"}</span><h2>${language === "zh" ? "选择整套演示的风格" : "Choose the deck style"}</h2><p>${language === "zh" ? "只需选择整体感觉和品牌颜色。字体、图片、图表与逐页版式由 AI 自动保持统一并制造变化。" : "Choose the overall feel and brand colors. AI handles typography, imagery, charts, and page rhythm automatically."}</p></div></header><div class="slides-style-presets"></div><div class="slides-simple-colors"><label>${language === "zh" ? "品牌主色" : "Brand color"}<input type="color" data-simple-color="primaryColor"></label><label>${language === "zh" ? "页面背景" : "Background"}<input type="color" data-simple-color="backgroundColor"></label><span>${language === "zh" ? "AI 将自动生成辅助色，并避免连续页面使用相同版式。" : "AI generates supporting colors and avoids repeating adjacent layouts."}</span></div><footer class="slides-outline-footer"><button type="button" class="slides-footer-back">${language === "zh" ? "返回内容结构" : "Back to content"}</button><button class="slides-generator-submit" type="submit">${language === "zh" ? "确认风格并开始生成" : "Confirm style and generate"}</button></footer></section>`;
    const brand = document.createElement("details"); brand.className="slides-brand-profile"; brand.open=Boolean(brandProfile?.enabled); brand.innerHTML=`<summary>${language === "zh" ? "企业品牌模板（保存到当前项目）" : "Enterprise brand profile (saved in this project)"}</summary><label class="slides-brand-enable"><input type="checkbox" data-brand="enabled" ${brandProfile?.enabled ? "checked" : ""}><span>${language === "zh" ? "生成时强制使用品牌规则" : "Enforce brand rules during generation"}</span></label><div class="slides-brand-grid"><label>${language === "zh" ? "品牌／公司名称" : "Brand / company"}<input data-brand="name" maxlength="120" value="${escapeSlideBriefHtml(brandProfile?.name || "")}"></label><label>${language === "zh" ? "品牌字体" : "Brand font"}<input data-brand="fontFamily" maxlength="120" value="${escapeSlideBriefHtml(brandProfile?.fontFamily || "")}" placeholder="Microsoft YaHei / Arial"></label><label>${language === "zh" ? "主色" : "Primary"}<input type="color" data-brand="primaryColor" value="${brandProfile?.primaryColor || designSystem.primaryColor}"></label><label>${language === "zh" ? "辅助色" : "Secondary"}<input type="color" data-brand="secondaryColor" value="${brandProfile?.secondaryColor || designSystem.secondaryColor}"></label><label>${language === "zh" ? "背景色" : "Background"}<input type="color" data-brand="backgroundColor" value="${brandProfile?.backgroundColor || designSystem.backgroundColor}"></label><label>${language === "zh" ? "页脚规范" : "Footer rule"}<input data-brand="footerText" maxlength="160" value="${escapeSlideBriefHtml(brandProfile?.footerText || "")}" placeholder="© Company · Confidential"></label></div><p>${language === "zh" ? "启用后覆盖普通风格的颜色、字体和署名，不改变已确认的内容与数据。" : "Brand colors, font and attribution override generic styling without changing confirmed content or data."}</p>`;
    panel.querySelector(".slides-simple-colors").before(brand);
    panel.querySelector(".slides-visual-system-icon").append(slidesIcon("sparkles"));
    const presetsHost = panel.querySelector(".slides-style-presets");
    stylePresets.forEach((preset) => { const button = document.createElement("button"); button.type = "button"; button.className = `slides-style-preset${preset.id === selectedStyle ? " selected" : ""}`; button.setAttribute("aria-pressed", String(preset.id === selectedStyle)); const swatches = document.createElement("span"); swatches.className = "slides-style-swatches"; [preset.primaryColor,preset.secondaryColor,preset.backgroundColor].forEach((color) => { const swatch = document.createElement("i"); swatch.style.background = color; swatches.append(swatch); }); const copy = document.createElement("span"); const strong = document.createElement("strong"); strong.textContent = preset.name; const small = document.createElement("small"); small.textContent = preset.note; copy.append(strong,small); button.append(swatches,copy); button.onclick = () => { const { id,name,note,...tokens } = preset; designSystem = { ...designSystem, ...tokens }; outline.designSystem = structuredClone(designSystem); syncDraft({ designSystem, outline }); renderVisualSystem(); }; presetsHost.append(button); });
    panel.querySelectorAll("[data-simple-color]").forEach((input) => { input.value = designSystem[input.dataset.simpleColor] || "#ffffff"; input.oninput = () => { designSystem[input.dataset.simpleColor] = input.value; outline.designSystem = structuredClone(designSystem); syncDraft({ designSystem, outline }); }; });
    const persistBrand = () => { const profile={}; panel.querySelectorAll("[data-brand]").forEach((input) => { profile[input.dataset.brand]=input.type === "checkbox" ? input.checked : input.value.trim(); }); draft.brandProfile=profile; saveSlidesBrandProfile(profile); if (profile.enabled) { designSystem.primaryColor=profile.primaryColor; designSystem.secondaryColor=profile.secondaryColor; designSystem.backgroundColor=profile.backgroundColor; if (profile.fontFamily) designSystem.typography=`${profile.fontFamily}，严格使用企业品牌字体层级`; } outline.designSystem=structuredClone(designSystem); syncDraft({ brandProfile:profile, designSystem, outline }); };
    panel.querySelectorAll("[data-brand]").forEach((input) => input.addEventListener(input.type === "checkbox" || input.type === "color" ? "change" : "input", persistBrand));
    panel.querySelector(".slides-footer-back").onclick = () => { syncDraft({ phase:"structure" }); renderStructure(); };
    panel.onsubmit = async (event) => { event.preventDefault(); const silhouettes = ["full-bleed","left-visual","right-visual","centered","split","grid","timeline"]; const routeFor = (slide) => ["chart","dashboard"].includes(slide.intent) ? "chart" : ["process","timeline","architecture"].includes(slide.intent) ? "diagram" : ["cover","hero","image","case"].includes(slide.intent) ? "visual" : "native"; visualRhythm = outline.slides.map((slide,index) => ({ pageNumber:index + 1, treatment:routeFor(slide) === "chart" ? "chart" : routeFor(slide) === "diagram" ? "diagram" : routeFor(slide) === "visual" ? "hero-image" : index % 3 === 0 ? "editorial" : "minimal", density:index === 0 ? "low" : "medium", silhouette:silhouettes[index % silhouettes.length], specialistRoute:routeFor(slide) })); outline.designSystem = structuredClone(designSystem); outline.visualRhythm = structuredClone(visualRhythm); outline.slides.forEach((slide,index) => Object.assign(slide, visualRhythm[index])); syncDraft({ designSystem, visualRhythm, outline }); await generateConfirmedOutline(); };
    window.requestAnimationFrame(() => panel.focus({ preventScroll:true }));
  };

  const renderVisualSystemLegacy = () => {
    clearOutlineCountdown(); setPanelMode("visual-system");
    designSystem ||= { primaryColor:"#2563eb", secondaryColor:"#dbeafe", backgroundColor:"#ffffff", textColor:"#0f172a", typography:language === "zh" ? "现代无衬线，三级字阶，标题高对比" : "Modern sans serif with three type levels", shapeLanguage:language === "zh" ? "克制圆角、细线与充足留白" : "Restrained corners, fine lines, generous whitespace", imageLanguage:outline.style || brief?.style || (language === "zh" ? "真实、自然、统一光线与色彩处理" : "Authentic scenes with consistent light and color"), chartLanguage:language === "zh" ? "扁平可编辑图表，弱化网格线，重点色强调结论" : "Flat editable charts, quiet grids, accent the takeaway" };
    const silhouettes = ["full-bleed","left-visual","right-visual","centered","split","grid","timeline"];
    const routeFor = (slide) => ["chart","dashboard"].includes(slide.intent) ? "chart" : ["process","timeline","architecture"].includes(slide.intent) ? "diagram" : ["cover","hero","image","case"].includes(slide.intent) ? "visual" : "native";
    visualRhythm = Array.from({ length:outline.slides.length }, (_, index) => visualRhythm?.[index] || { pageNumber:index + 1, treatment:routeFor(outline.slides[index]) === "chart" ? "chart" : routeFor(outline.slides[index]) === "diagram" ? "diagram" : routeFor(outline.slides[index]) === "visual" ? "hero-image" : index % 3 === 0 ? "editorial" : "minimal", density:index === 0 ? "low" : "medium", silhouette:silhouettes[index % silhouettes.length], specialistRoute:routeFor(outline.slides[index]) });
    panel.innerHTML = `<section class="slides-visual-system-card"><header><span class="slides-visual-system-icon" aria-hidden="true"></span><div><span class="slides-outline-eyebrow">${language === "zh" ? "全局视觉工作流" : "Deck visual workflow"}</span><h2>${language === "zh" ? "确认设计系统与页面节奏" : "Confirm design system and page rhythm"}</h2><p>${language === "zh" ? "全局规则保持统一；逐页处理决定主视觉、图表、图形和版式变化。" : "Global rules keep the deck coherent; page treatments create deliberate variety."}</p></div></header><div class="slides-design-system-grid"><label>${language === "zh" ? "主色" : "Primary"}<input type="color" data-design="primaryColor"></label><label>${language === "zh" ? "辅助色" : "Secondary"}<input type="color" data-design="secondaryColor"></label><label>${language === "zh" ? "背景色" : "Background"}<input type="color" data-design="backgroundColor"></label><label>${language === "zh" ? "正文色" : "Text"}<input type="color" data-design="textColor"></label><label class="wide">${language === "zh" ? "字体层级" : "Typography"}<input data-design="typography" maxlength="240"></label><label class="wide">${language === "zh" ? "图形语言" : "Shape language"}<input data-design="shapeLanguage" maxlength="240"></label><label class="wide">${language === "zh" ? "图片语言" : "Image language"}<input data-design="imageLanguage" maxlength="240"></label><label class="wide">${language === "zh" ? "图表语言" : "Chart language"}<input data-design="chartLanguage" maxlength="240"></label></div><div class="slides-visual-rhythm"><div class="slides-visual-rhythm-head"><strong>${language === "zh" ? "逐页视觉节奏" : "Page-by-page visual rhythm"}</strong><small>${language === "zh" ? "相邻页面自动避免相同轮廓" : "Adjacent pages avoid the same silhouette"}</small></div><div class="slides-visual-rhythm-list"></div></div><footer class="slides-outline-footer"><button type="button" class="slides-footer-back">${language === "zh" ? "返回页面结构" : "Back to structure"}</button><button class="slides-generator-submit" type="submit">${language === "zh" ? "确认视觉系统，查看逐页大纲" : "Confirm visuals and review outline"}</button></footer></section>`;
    panel.querySelector(".slides-visual-system-icon").append(slidesIcon("sparkles"));
    panel.querySelectorAll("[data-design]").forEach((input) => { input.value = designSystem[input.dataset.design] || ""; input.oninput = () => { designSystem[input.dataset.design] = input.value; outline.designSystem = structuredClone(designSystem); syncDraft({ designSystem, outline }); }; });
    const labels = language === "zh" ? { "hero-image":"主视觉", chart:"图表", diagram:"图形/流程", comparison:"对比", editorial:"编辑排版", metrics:"指标", minimal:"极简" } : { "hero-image":"Hero visual", chart:"Chart", diagram:"Diagram", comparison:"Comparison", editorial:"Editorial", metrics:"Metrics", minimal:"Minimal" };
    const host = panel.querySelector(".slides-visual-rhythm-list");
    visualRhythm.forEach((item,index) => { const row = document.createElement("article"); row.innerHTML = `<b>${String(index + 1).padStart(2,"0")}</b><span title="${escapeSlideBriefHtml(outline.slides[index].title)}">${escapeSlideBriefHtml(outline.slides[index].title)}</span><select data-rhythm="treatment">${Object.entries(labels).map(([value,label]) => `<option value="${value}">${label}</option>`).join("")}</select><select data-rhythm="density"><option value="low">${language === "zh" ? "低密度" : "Low"}</option><option value="medium">${language === "zh" ? "中密度" : "Medium"}</option><option value="high">${language === "zh" ? "高密度" : "High"}</option></select><select data-rhythm="silhouette">${silhouettes.map((value) => `<option value="${value}">${value}</option>`).join("")}</select>`; row.querySelectorAll("[data-rhythm]").forEach((select) => { select.value = item[select.dataset.rhythm]; select.onchange = () => { item[select.dataset.rhythm] = select.value; item.specialistRoute = select.dataset.rhythm === "treatment" ? ({ "hero-image":"visual", chart:"chart", diagram:"diagram" }[select.value] || "native") : item.specialistRoute; outline.visualRhythm = structuredClone(visualRhythm); syncDraft({ visualRhythm, outline }); }; }); host.append(row); });
    panel.querySelector(".slides-footer-back").onclick = () => { syncDraft({ phase:"structure" }); renderStructure(); };
    panel.onsubmit = (event) => { event.preventDefault(); for (let index = 1; index < visualRhythm.length; index += 1) if (visualRhythm[index].silhouette === visualRhythm[index - 1].silhouette) visualRhythm[index].silhouette = silhouettes[(silhouettes.indexOf(visualRhythm[index].silhouette) + 1) % silhouettes.length]; outline.designSystem = structuredClone(designSystem); outline.visualRhythm = structuredClone(visualRhythm); outline.slides.forEach((slide,index) => Object.assign(slide, visualRhythm[index] || {})); syncDraft({ designSystem, visualRhythm, outline, phase:"outline" }); renderOutline(); };
    window.requestAnimationFrame(() => panel.focus({ preventScroll:true }));
  };

  const renderOutline = () => {
    structure = outline?.structure || structure;
    syncDraft({ structure, phase:"structure" });
    renderStructure();
    return;
    clearOutlineCountdown(); setPanelMode("outline"); syncDraft({ phase:"outline" });
    panel.tabIndex = -1;
    panel.innerHTML = `<section class="slides-outline-proposal"><header class="slides-outline-proposal-header"><div><span class="slides-outline-eyebrow">${language === "zh" ? "AI 已完成大纲" : "AI outline ready"}</span><h2>${language === "zh" ? "确认大纲与视觉方向" : "Confirm outline and visual direction"}</h2><p>${language === "zh" ? "可直接编辑页面标题与核心信息，拖动调整叙事顺序。" : "Edit page titles and key messages, then reorder the narrative."}</p></div><span class="slides-outline-page-count">${outline.slides.length} ${language === "zh" ? "页" : "pages"}</span></header><div class="slides-outline-visual"><span>${language === "zh" ? "视觉方向" : "Visual direction"}</span><strong></strong><small>${language === "zh" ? "AI 将以确认后的大纲、受众和演示场景作为每页视觉生成约束。" : "AI will use the confirmed outline, audience and scenario as visual constraints."}</small></div><div class="slides-outline-requirements"><label><span>${language === "zh" ? "页数" : "Pages"}</span><input data-outline-requirement="count" type="number" min="1" max="20" value="${outline.slides.length}"></label><label><span>${language === "zh" ? "核心目标" : "Goal"}</span><select data-outline-requirement="goal"><option>${language === "zh" ? "AI 智能判断" : "Auto"}</option><option>${language === "zh" ? "说服决策与推动行动" : "Drive a decision"}</option><option>${language === "zh" ? "汇报成果与进展" : "Report outcomes"}</option><option>${language === "zh" ? "教学与知识讲解" : "Teach and explain"}</option><option>${language === "zh" ? "展示作品与能力" : "Showcase work"}</option></select></label><label><span>${language === "zh" ? "目标受众" : "Audience"}</span><select data-outline-requirement="audience"><option>${language === "zh" ? "AI 智能判断" : "Auto"}</option><option>${language === "zh" ? "管理层与决策者" : "Executives"}</option><option>${language === "zh" ? "客户与合作伙伴" : "Customers"}</option><option>${language === "zh" ? "专业团队" : "Professional team"}</option><option>${language === "zh" ? "大众受众" : "General audience"}</option></select></label><label><span>${language === "zh" ? "演示场景" : "Scenario"}</span><select data-outline-requirement="scenario"><option>${language === "zh" ? "AI 智能判断" : "Auto"}</option><option>${language === "zh" ? "现场演示，画面为主" : "Live presentation"}</option><option>${language === "zh" ? "自行阅读，信息较完整" : "Self-read document"}</option><option>${language === "zh" ? "线上会议与屏幕共享" : "Online meeting"}</option></select></label><label><span>${language === "zh" ? "视觉风格" : "Visual style"}</span><select data-outline-requirement="style"><option>${language === "zh" ? "跟随提示词或智能判断" : "Use prompt or auto"}</option><option>${language === "zh" ? "专业简洁" : "Professional"}</option><option>${language === "zh" ? "编辑杂志感" : "Editorial"}</option><option>${language === "zh" ? "科技视觉" : "Technology"}</option><option>${language === "zh" ? "大胆创意" : "Creative"}</option></select></label></div><div class="slides-outline-list" aria-label="${language === "zh" ? "幻灯片大纲" : "Slide outline"}"></div><footer class="slides-outline-footer"><label class="slides-outline-auto"><input type="checkbox" checked data-outline-auto><span>${language === "zh" ? "15 秒后自动确认" : "Auto-confirm in 15 seconds"}</span></label><div class="slides-outline-actions"><button type="button" data-outline-action="back">${language === "zh" ? "返回修改" : "Back"}</button><button type="button" data-outline-action="add">＋ ${language === "zh" ? "添加一页" : "Add page"}</button><button class="slides-generator-submit slides-outline-confirm" type="submit"><span>${language === "zh" ? "确认并开始生成" : "Confirm and generate"}</span><b data-outline-countdown aria-live="polite">15</b></button></div></footer></section>`;
    panel.querySelector(".slides-outline-visual")?.remove();
    panel.querySelector(".slides-outline-requirements")?.remove();
    panel.querySelector(".slides-outline-footer").innerHTML = `<label class="slides-outline-auto"><input type="checkbox" data-outline-auto><span>${language === "zh" ? "15 秒无操作后自动开始生成" : "Start automatically after 15 seconds idle"}</span></label><div class="slides-outline-actions"><button type="button" class="slides-footer-back" data-outline-action="back">${language === "zh" ? "返回修改" : "Back"}</button><button class="slides-generator-submit slides-outline-confirm" type="submit"><span>${language === "zh" ? "继续生成" : "Continue"}</span><i class="slides-continue-icon" aria-hidden="true"></i><b data-outline-countdown aria-live="polite">—</b></button></div>`;
    panel.querySelector(".slides-outline-eyebrow").textContent = language === "zh" ? "第二步 · 大纲确认" : "Step 2 · Outline confirmation";
    panel.querySelector(".slides-outline-proposal h2").textContent = language === "zh" ? "确认页面大纲" : "Confirm the page outline";
    panel.querySelector(".slides-outline-proposal-header p").textContent = language === "zh" ? "编辑标题与核心信息，拖动六点手柄调整叙事顺序。" : "Edit titles and key messages, then drag the six-dot handle to reorder.";
    const templateNote = document.createElement("section");
    templateNote.className = "slides-template-match";
    const confidence = Math.round((Number(draft.templateConfidence) || 0) * 100);
    const candidates = [...new Map([...(draft.templateRecommendations || []), { id:"freeform", confidence:0 }].filter((item) => item?.id).map((item) => [item.id,item])).values()].slice(0, 4);
    const templateTitle = document.createElement("strong"); templateTitle.textContent = language === "zh" ? `演示模板${confidence ? ` · 推荐置信度 ${confidence}%` : ""}` : `Presentation template${confidence ? ` · ${confidence}% confidence` : ""}`;
    const templateChoices = document.createElement("div"); templateChoices.className = "slides-template-choices";
    candidates.forEach((candidate) => { const button = document.createElement("button"); button.type = "button"; button.className = candidate.id === draft.deckTemplateId ? "selected" : ""; button.textContent = candidate.id === "freeform" ? (language === "zh" ? "AI 自由设计" : "AI freeform") : candidate.id; button.onclick = () => { syncDraft({ deckTemplateId:candidate.id }); renderOutline(); }; templateChoices.append(button); });
    const dataTitle = document.createElement("strong"); dataTitle.textContent = language === "zh" ? "缺少真实数值时" : "When real values are missing";
    const dataChoices = document.createElement("div"); dataChoices.className = "slides-template-choices";
    [["ai-generated",language === "zh" ? "AI 自主生成全部内容" : "AI generates all content"],["supplied",language === "zh" ? "使用我提供的内容" : "Use my supplied content"]].forEach(([value,label]) => { const button = document.createElement("button"); button.type="button"; button.className = value === draft.dataMode ? "selected" : ""; button.textContent=label; button.onclick=()=>{ syncDraft({ dataMode:value }); renderOutline(); }; dataChoices.append(button); });
    templateNote.append(templateTitle,templateChoices,dataTitle,dataChoices);
    panel.querySelector(".slides-outline-proposal-header").after(templateNote);
    const list = panel.querySelector(".slides-outline-list");
    outline.slides.forEach((slide, index) => {
      const item = document.createElement("article"); item.className = "slides-outline-item"; item.draggable = true; item.dataset.index = String(index);
      item.innerHTML = `<span class="slides-outline-handle" aria-hidden="true"></span><span class="slides-outline-number">${String(index + 1).padStart(2,"0")}</span><div><input data-outline-title maxlength="120" aria-label="${language === "zh" ? `第 ${index + 1} 页标题` : `Slide ${index + 1} title`}"><textarea data-outline-message maxlength="600" aria-label="${language === "zh" ? `第 ${index + 1} 页核心信息` : `Slide ${index + 1} key message`}"></textarea><small></small></div><div class="slides-outline-item-actions"><button type="button" data-move="up" aria-label="${language === "zh" ? "上移" : "Move up"}"></button><button type="button" data-move="down" aria-label="${language === "zh" ? "下移" : "Move down"}"></button><button type="button" data-remove aria-label="${language === "zh" ? "删除此页" : "Delete page"}"></button></div>`;
      item.querySelector(".slides-outline-handle").append(slidesIcon("grip")); item.querySelector("small").textContent = `${slide.type} · ${slide.visual}`;
      item.querySelector('[data-move="up"]').append(slidesIcon("move-up")); item.querySelector('[data-move="down"]').append(slidesIcon("move-down")); item.querySelector("[data-remove]").append(slidesIcon("trash"));
      item.querySelector("[data-outline-title]").value = slide.title; item.querySelector("[data-outline-message]").value = slide.message;
      item.querySelector("[data-outline-title]").oninput = (event) => { slide.title = event.target.value; syncDraft({ outline }); }; item.querySelector("[data-outline-message]").oninput = (event) => { slide.message = event.target.value; syncDraft({ outline }); };
      const move = (target) => { if (target < 0 || target >= outline.slides.length) return; outline.slides.splice(target, 0, outline.slides.splice(index, 1)[0]); syncDraft({ outline }); renderOutline(); };
      item.querySelector('[data-move="up"]').onclick = () => move(index - 1); item.querySelector('[data-move="down"]').onclick = () => move(index + 1); item.querySelector("[data-remove]").onclick = () => { if (outline.slides.length <= 1) return; outline.slides.splice(index,1); syncDraft({ outline }); renderOutline(); };
      item.ondragstart = () => { draggedIndex = index; item.classList.add("dragging"); }; item.ondragend = () => item.classList.remove("dragging"); item.ondragover = (event) => event.preventDefault(); item.ondrop = (event) => { event.preventDefault(); if (draggedIndex < 0 || draggedIndex === index) return; outline.slides.splice(index,0,outline.slides.splice(draggedIndex,1)[0]); draggedIndex = -1; syncDraft({ outline }); renderOutline(); };
      list.append(item);
    });
    const addOutlineOption = document.createElement("button");
    addOutlineOption.type = "button";
    addOutlineOption.className = "slides-outline-add-option";
    addOutlineOption.append(slidesIcon("plus"), document.createTextNode(language === "zh" ? "添加选项" : "Add option"));
    addOutlineOption.onclick = () => {
      if (outline.slides.length >= 20) { showToast(language === "zh" ? "最多生成 20 页" : "Maximum 20 slides"); return; }
      outline.slides.push({ title:language === "zh" ? "新页面" : "New page", message:"", type:"insight", visual:language === "zh" ? "根据本页内容选择合适的视觉表达" : "Choose a suitable visual treatment for this page" });
      count = outline.slides.length;
      if (requirements?.length) requirements.length.selected = String(count);
      syncDraft({ outline, requirements, count });
      renderOutline();
      window.requestAnimationFrame(() => {
        const titles = panel.querySelectorAll("[data-outline-title]");
        const target = titles[titles.length - 1];
        target?.focus(); target?.select();
      });
    };
    list.append(addOutlineOption);
    const autoToggle = panel.querySelector("[data-outline-auto]");
    const countdown = panel.querySelector("[data-outline-countdown]");
    const autoLabel = panel.querySelector(".slides-outline-auto span");
    const confirmButton = panel.querySelector(".slides-outline-confirm");
    panel.querySelector(".slides-continue-icon").append(slidesIcon("return"));
    installIdleAutoConfirm({ phase:"outline", button:confirmButton, toggle:autoToggle, label:autoLabel, badge:countdown, submit:() => panel.requestSubmit() });
    panel.querySelector(".slides-outline-confirm span").textContent = language === "zh" ? "确认大纲并开始生成" : "Confirm outline and generate";
    panel.querySelector('[data-outline-action="back"]').onclick = () => { clearOutlineCountdown(); syncDraft({ phase:"requirements" }); renderRequirements(); };
    panel.onsubmit = async (event) => { event.preventDefault(); clearOutlineCountdown(); await generateConfirmedOutline(); };
    panel.onkeydown = (event) => { if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return; if (event.target.matches("input,textarea") || event.target.closest("button")) return; event.preventDefault(); panel.requestSubmit(); };
    window.requestAnimationFrame(() => panel.focus({ preventScroll:true }));
  };
  const finishGenerationJob = async (job, pages, status, token, onPreview = null) => {
    const labels = language === "zh" ? { planning:"正在锁定整套叙事与视觉规划…", generating:"正在分批生成并持续显示页面…", validating:"正在检查前置约束与最终版式…", illustrating:"正在生成并按主体焦点裁切视觉素材…", importing:"正在同步画布和幻灯片面板…", pausing:"正在完成当前步骤并暂停…", paused:"生成已暂停，当前结果已保留" } : { planning:"Locking the deck-wide narrative and visual plan…", generating:"Generating in batches with progressive previews…", validating:"Checking pre-layout constraints and final geometry…", illustrating:"Generating and focal-point cropping key visuals…", importing:"Syncing the canvas and slide panel…", pausing:"Finishing the current step before pausing…", paused:"Generation paused; current results are preserved" };
    labels["final-review"] = language === "zh" ? "正在进行素材落位后的最终视觉检查…" : "Running the final post-asset visual review…";
    labels["final-repair"] = language === "zh" ? "正在仅修复未通过终检的页面…" : "Repairing only pages that failed final review…";
    try {
      job = await pollSlidesJob(job, (current) => {
        if (draft.pollToken !== token) return;
        onPreview?.(current);
        const seconds = Math.max(0, Number(current.elapsedSeconds) || 0);
        const readyCount = current.pages?.filter((page) => ["ready","done","failed"].includes(page.status)).length || 0;
        const allDraftsReady = readyCount === current.pageCount && current.stage === "generating";
        const stageLabel = allDraftsReady ? (language === "zh" ? "页面草稿已生成，正在进入质量检查…" : "Page drafts are ready; moving into quality review…") : (labels[current.status] || labels[current.stage] || (language === "zh" ? "AI 正在工作…" : "AI is working…"));
        const percent = Math.max(1, Math.min(100, Number(current.progressPercent) || 1));
        const eta = Math.max(0, Number(current.etaSeconds) || 0);
        const stageMeta = current.stage === "generating"
          ? (language === "zh" ? `第 ${current.batchIndex || 1}/${current.batchTotal || 1} 批 · ${readyCount}/${current.pageCount} 页草稿` : `Batch ${current.batchIndex || 1}/${current.batchTotal || 1} · ${readyCount}/${current.pageCount} page drafts`)
          : current.stage === "illustrating" && current.visualTotal
            ? (language === "zh" ? `${current.visualIndex || 0}/${current.visualTotal} 个视觉素材` : `${current.visualIndex || 0}/${current.visualTotal} visual assets`)
            : (language === "zh" ? "全流程" : "Overall");
        const etaText = eta > 0 ? ` · ${formatSlidesRemaining(eta)}` : "";
        const elapsedText = formatSlidesElapsed(seconds);
        status.querySelector("strong").textContent = stageLabel;
        status.querySelector("span").textContent = `${stageMeta} · ${percent}% · ${elapsedText}${etaText}`;
        const card = pages.closest(".slides-progress-card");
        card?.style.setProperty("--slides-generation-progress", `${percent}%`);
        card?.querySelector(".slides-progress-line")?.setAttribute("aria-valuenow", String(percent));
        const stageOrder = ["generating","validating","illustrating","final-review","importing"];
        const normalizedStage = current.stage === "planning" ? "generating" : current.stage === "final-repair" ? "final-review" : current.stage === "revising" ? "validating" : current.stage;
        const activeStage = Math.max(0, stageOrder.indexOf(normalizedStage));
        card?.querySelectorAll("[data-generation-step]").forEach((step, index) => {
          step.classList.toggle("active", index === activeStage);
          step.classList.toggle("done", index < activeStage || current.status === "done");
          step.setAttribute("aria-current", index === activeStage ? "step" : "false");
        });
        const pause = panel.querySelector("[data-slides-pause]");
        if (pause) { const canResume = current.status === "paused" || current.status === "pausing"; pause.dataset.mode = canResume ? "resume" : "pause"; pause.textContent = canResume ? (language === "zh" ? "继续生成" : "Resume") : (language === "zh" ? "暂停" : "Pause"); pause.disabled = false; }
        const skipQuality = panel.querySelector("[data-slides-skip-quality]");
        if (skipQuality) skipQuality.hidden = !(current.status === "running" && current.stage === "revising" && current.qualityRepair?.scope === "page");
        pages.querySelectorAll("em").forEach((item, index) => { const pageStatus = current.pages?.[index]?.status; item.textContent = pageStatus === "failed" ? (language === "zh" ? "失败，已跳过" : "Failed, skipped") : pageStatus === "done" ? (language === "zh" ? "已完成" : "Done") : pageStatus === "ready" ? (language === "zh" ? "草稿就绪" : "Draft ready") : current.status === "paused" ? (language === "zh" ? "已暂停" : "Paused") : current.stage === "validating" ? (language === "zh" ? "检查中" : "Reviewing") : current.stage === "illustrating" ? (language === "zh" ? "视觉增强中" : "Enhancing") : current.stage === "importing" ? (language === "zh" ? "同步中" : "Syncing") : pageStatus === "waiting" ? (language === "zh" ? "待生成" : "Waiting") : (language === "zh" ? "生成中" : "Generating"); item.closest("div")?.classList.toggle("is-ready", ["ready","done","failed"].includes(pageStatus)); });
      });
      if (draft.pollToken !== token) return;
      saveSlidesGenerationHistory(deck, draft, outline, job);
      const quality = job.qualityReport?.summary;
      if (quality) showToast(language === "zh" ? `质量检查通过 · ${quality.warnings || 0} 项提醒` : `Quality check passed · ${quality.warnings || 0} warning(s)`);
      if (job.partialFailureCount) showToast(language === "zh" ? `已完成，其余页面继续生成成功；${job.partialFailureCount} 个失败页面已保留，可从页面菜单删除` : `Completed with ${job.partialFailureCount} failed page(s) retained; delete them from the page menu.`);
      syncDraft({ generationJobId:null, activeJobId:null, phase:"brief", lastError:null, completedImported:job.imported, targetSlideId:null });
      activeSlideIndexByDeck.set(deck.id, draft.existingSlideCount || 0);
      await loadState();
      setLocalSelection([]);
      render();
    } catch (error) {
      if (draft.pollToken !== token) return;
      if (error?.job?.status === "interrupted") throw error;
      const hasPreservedSlides = error?.job?.previewSlides?.some(Boolean) || error?.job?.pages?.some((page) => ["ready", "done"].includes(page?.status));
      if (["failed", "quality_failed"].includes(error?.job?.status) && hasPreservedSlides) {
        syncDraft({ phase:"generating", lastError:error?.message || t("jobFailed") });
        throw error;
      }
      const message = error?.message || t("jobFailed"); syncDraft({ phase:"generating", lastError:message }); showToast(language === "zh" ? `任务暂时中断，当前页面与进度已保留：${message}` : `Generation paused with current pages and progress preserved: ${message}`); throw error;
    }
  };
  const renderGeneration = async (initialJob = null) => {
    clearOutlineCountdown(); setPanelMode("progress"); panel.classList.add("is-generation");
    panel.innerHTML = `<section class="slides-progress-card slides-generation-progress"><span class="slides-outline-eyebrow">${language === "zh" ? "第三步 · 正式生成" : "Step 3 · Generation"}</span><header class="slides-generation-gallery-header"><button type="button" data-slides-background aria-label="${language === "zh" ? "返回画布" : "Back to canvas"}"></button><h2>${escapeSlideBriefHtml(outline.title || brief?.topic || (language === "zh" ? "AI 幻灯片" : "AI presentation"))}</h2><div class="slides-generation-gallery-actions"><button type="button" data-slides-skip-quality hidden>${language === "zh" ? "跳过并继续" : "Skip and continue"}</button><button type="button" data-slides-pause data-mode="pause">${language === "zh" ? "暂停" : "Pause"}</button><button type="button" class="slides-planning-stop">${language === "zh" ? "取消" : "Cancel"}</button></div></header><ol class="slides-generation-steps" aria-label="${language === "zh" ? "生成全流程" : "Full generation workflow"}"><li data-generation-step>${language === "zh" ? "生成草稿" : "Draft pages"}</li><li data-generation-step>${language === "zh" ? "质量检查" : "Quality check"}</li><li data-generation-step>${language === "zh" ? "视觉素材" : "Visual assets"}</li><li data-generation-step>${language === "zh" ? "最终检查" : "Final review"}</li><li data-generation-step>${language === "zh" ? "导入交付" : "Import"}</li></ol><div class="slides-progress-line" role="progressbar" aria-label="${language === "zh" ? "幻灯片生成总进度" : "Overall slide generation progress"}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="1"><i></i></div><div class="slides-generator-status slides-generation-status" role="status" aria-live="polite"><strong>${language === "zh" ? "正在连接生成任务…" : "Connecting to generation task…"}</strong><span>${language === "zh" ? "准备读取全流程状态" : "Preparing the full workflow status"}</span></div><div class="slides-generation-live"><aside class="slides-generation-live-thumbs" aria-live="polite" aria-label="${language === "zh" ? "生成页面与状态" : "Generated pages and statuses"}"></aside><main class="slides-generation-live-stage" aria-hidden="true"></main></div><div class="slides-generation-pages" hidden></div><label class="slides-generation-follow sr-only"><input type="checkbox" checked data-slides-follow><span>${language === "zh" ? "跟随最新页面" : "Follow newest page"}</span></label></section>`;
    panel.querySelector(".slides-generation-progress")?.insertAdjacentHTML("afterbegin", renderWorkflowStageBar(2));
    panel.querySelector(".slides-generation-progress > .slides-outline-eyebrow")?.remove();
    panel.querySelector("[data-slides-background]").append(slidesIcon("back"));
    const pages = panel.querySelector(".slides-generation-pages"); outline.slides.forEach((slide,index) => { const row = document.createElement("div"); const number = document.createElement("b"); number.textContent = String(index+1).padStart(2,"0"); const title = document.createElement("span"); title.textContent = slide.title; const stage = document.createElement("em"); stage.textContent = language === "zh" ? "等待生成" : "Waiting"; row.append(number,title,stage); pages.append(row); });
    const status = panel.querySelector(".slides-generator-status"); const liveThumbs = panel.querySelector(".slides-generation-live-thumbs"); const liveStage = panel.querySelector(".slides-generation-live-stage"); const follow = panel.querySelector("[data-slides-follow]"); let liveIndex = -1; const token = {}; draft.pollToken = token;
    const renderLivePreview = (current) => {
      const previews = Array.isArray(current.previewSlides) ? current.previewSlides : [];
      const readyIndexes = previews.map((slide,index) => slide ? index : -1).filter((index) => index >= 0);
      const newest = readyIndexes.at(-1) ?? -1;
      if (newest >= 0 && (liveIndex < 0 || follow.checked)) liveIndex = newest;
      if (liveIndex >= 0 && !previews[liveIndex]) liveIndex = newest;
      const allDraftsReady = (current.pages?.filter((page) => ["ready","done","failed"].includes(page?.status)).length || 0) === current.pageCount;
      const normalizedStage = current.status === "done" ? "done" : current.stage === "planning" ? "generating" : current.stage === "final-repair" ? "final-review" : current.stage === "revising" ? "validating" : allDraftsReady && current.stage === "generating" ? "validating" : current.stage;
      const thumbnailStageOrder = ["generating","validating","illustrating","final-review","importing"];
      const globalStageIndex = normalizedStage === "done" ? thumbnailStageOrder.length : Math.max(0, thumbnailStageOrder.indexOf(normalizedStage));
      const pageStatusLabel = (index) => {
        const page = current.pages?.[index] || {}; const review = page.reviewStatus || "";
        if (current.status === "paused") return language === "zh" ? "已暂停" : "Paused";
        if (page.status === "failed") return language === "zh" ? "生成失败，已跳过" : "Failed, skipped";
        if (review === "repairing") {
          const repair = current.qualityRepair;
          if (repair?.scope === "page" && repair.pageIndex === index) return language === "zh" ? `正在修复 ${repair.attempt}/${repair.limit}` : `Repairing ${repair.attempt}/${repair.limit}`;
          return language === "zh" ? "正在修复" : "Repairing";
        }
        if (normalizedStage === "validating") return language === "zh" ? "质量检查中…" : "Quality checking…";
        if (normalizedStage === "illustrating") return language === "zh" ? "视觉检查中…" : "Visual checking…";
        if (normalizedStage === "final-review") return language === "zh" ? "最终检查中…" : "Final checking…";
        if (normalizedStage === "importing") return language === "zh" ? "导入交付中…" : "Importing…";
        if (review === "reviewed" || page.status === "done" || normalizedStage === "done") return language === "zh" ? "已完成" : "Done";
        if (page.status === "ready" || previews[index]) return language === "zh" ? "草稿已生成" : "Draft ready";
        const readyBefore = current.pages?.slice(0,index).filter((item) => ["ready","done","failed"].includes(item?.status)).length || 0;
        return readyBefore === index ? (language === "zh" ? "正在生成中" : "Generating") : (language === "zh" ? "等待生成" : "Waiting");
      };
      liveThumbs.replaceChildren(...outline.slides.map((slide,index) => { const button = document.createElement("button"); button.type = "button"; button.className = `slides-generation-live-thumb${index === liveIndex ? " active" : ""}${previews[index] ? " ready" : " waiting"}${current.pages?.[index]?.status === "failed" ? " failed" : ""}`; button.disabled = !previews[index]; const shell = document.createElement("span"); shell.className = "slides-generation-thumb-preview"; if (previews[index]) shell.append(createSlidesMedia(previews[index], `${language === "zh" ? "第" : "Slide "}${index + 1}${language === "zh" ? "页预览" : " preview"}`, true)); else { const waiting = document.createElement("span"); waiting.className = "slides-generation-thumb-waiting"; const spinner = document.createElement("i"); spinner.setAttribute("aria-hidden", "true"); waiting.append(spinner); shell.append(waiting); } const meta = document.createElement("span"); meta.className = "slides-generation-thumb-meta"; const pageNumber = document.createElement("b"); pageNumber.textContent = language === "zh" ? `${index + 1} 页` : `Page ${index + 1}`; const divider = document.createElement("i"); divider.textContent = "｜"; const state = document.createElement("em"); state.textContent = pageStatusLabel(index); const isWorking = current.status !== "paused" && current.status !== "done" && /中|ing|checking|repairing/i.test(state.textContent); state.classList.toggle("is-working", isWorking); meta.append(pageNumber,divider,state); const flow = document.createElement("span"); flow.className = "slides-generation-thumb-flow"; const readyBefore = current.pages?.slice(0,index).filter((item) => ["ready","done","failed"].includes(item?.status)).length || 0; const pageStageIndex = previews[index] ? globalStageIndex : readyBefore === index ? 0 : -1; const flowLabels = language === "zh" ? ["草稿","质量","视觉","终检"] : ["Draft","Quality","Visual","Final"]; flowLabels.forEach((label,flowIndex) => { const item = document.createElement("i"); item.textContent = label; item.classList.toggle("done", normalizedStage === "done" || flowIndex < pageStageIndex); item.classList.toggle("active", flowIndex === pageStageIndex && normalizedStage !== "done"); flow.append(item); }); button.append(shell,meta,flow); button.setAttribute("aria-label", `${pageNumber.textContent}，${state.textContent}`); button.onclick = () => { follow.checked = false; liveIndex = index; renderLivePreview(current); }; return button; }));
      liveThumbs.querySelectorAll(".slides-generation-thumb-flow").forEach((flow) => flow.remove());
      liveThumbs.querySelectorAll(".slides-generation-live-thumb").forEach((button, index) => { const reviewStatus = current.pages?.[index]?.reviewStatus || ""; if (reviewStatus) { button.dataset.reviewStatus = reviewStatus; const repair = current.qualityRepair; button.title = reviewStatus === "repairing" ? (repair?.pageIndex === index ? `${language === "zh" ? "局部修复" : "Targeted repair"} ${repair.attempt}/${repair.limit} · ${repair.reason || ""}` : (language === "zh" ? "此页正在局部修复" : "Targeted repair in progress")) : reviewStatus === "reviewed" ? (language === "zh" ? "此页已通过终检" : "Passed final review") : (language === "zh" ? "此页正在终检" : "Final review in progress"); } else delete button.dataset.reviewStatus; });
      if (liveIndex >= 0 && previews[liveIndex]) liveStage.replaceChildren(createSlidesMedia(previews[liveIndex], `${language === "zh" ? "第" : "Slide "}${liveIndex + 1}${language === "zh" ? "页" : ""}`));
    };
    panel.querySelector("[data-slides-background]").onclick = () => { slidesGeneratorOpenByDeck.delete(deck.id); render(); };
    panel.querySelector("[data-slides-pause]").onclick = async (event) => { if (!draft.generationJobId) return; const button = event.currentTarget; button.disabled = true; const action = button.dataset.mode === "resume" ? "resume" : "pause"; try { const response = await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.generationJobId)}`), { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ action }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || t("jobFailed")); button.dataset.mode = action === "pause" ? "resume" : "pause"; button.textContent = action === "pause" ? (language === "zh" ? "继续生成" : "Resume") : (language === "zh" ? "暂停" : "Pause"); showToast(action === "pause" ? (language === "zh" ? "任务将在当前安全点暂停，可随时继续生成" : "The task will pause at the next safe point; you can resume immediately") : (language === "zh" ? "已继续生成" : "Generation resumed")); } catch (error) { showToast(error?.message || t("jobFailed")); } finally { button.disabled = false; } };
    panel.querySelector("[data-slides-skip-quality]").onclick = async (event) => {
      if (!draft.generationJobId) return;
      const confirmed = await showConfirmDialog({
        title:language === "zh" ? "跳过当前页的质量修复？" : "Skip quality repair for this page?",
        message:language === "zh" ? "当前草稿会保留并标记为质量待处理，任务将继续生成视觉素材并导入其他页面。之后可在质量问题中心修复或删除此页。" : "The current draft will be retained and marked for review. Generation will continue, and you can repair or delete this page later from the quality center.",
        confirmText:language === "zh" ? "跳过并继续" : "Skip and continue",
        cancelText:language === "zh" ? "继续修复" : "Keep repairing"
      });
      if (!confirmed) return;
      const button = event.currentTarget; button.disabled = true;
      try {
        const response = await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.generationJobId)}`), { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"skip-quality" }) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error || t("jobFailed"));
        button.hidden = true;
        showToast(language === "zh" ? "已跳过当前页质量修复，正在继续下一阶段" : "Quality repair skipped; continuing to the next stage");
      } catch (error) { button.disabled = false; showToast(error?.message || t("jobFailed")); }
    };
    panel.querySelector(".slides-planning-stop").onclick = async () => { if (!draft.generationJobId) return; const confirmed = await showConfirmDialog({ title:language === "zh" ? "取消本次生成？" : "Cancel this generation?", message:language === "zh" ? "当前输入会保留；尚未完成并导入的页面将停止处理。" : "Your input will be kept; pages not yet completed and imported will stop processing.", confirmText:language === "zh" ? "取消生成" : "Cancel generation", cancelText:language === "zh" ? "继续等待" : "Keep generating", danger:true }); if (!confirmed) return; const jobId = draft.generationJobId; draft.pollToken = {}; try { await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(jobId)}`), { method:"DELETE" }); } catch {} syncDraft({ generationJobId:null, activeJobId:null, phase:"brief", targetSlideId:null }); showToast(language === "zh" ? "生成已取消，已返回输入首页" : "Generation cancelled; returned to the input page"); renderBrief(); };
    try { let job = initialJob; if (!job) { const response = await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.generationJobId)}`)); job = await response.json(); if (!response.ok) throw new Error(job.error || t("jobFailed")); } renderLivePreview(job); await finishGenerationJob(job, pages, status, token, renderLivePreview); }
    catch (error) {
      if (draft.pollToken !== token) return;
      const message = error?.message || t("jobFailed");
      const hasPreservedSlides = error?.job?.previewSlides?.some(Boolean) || error?.job?.pages?.some((page) => ["ready", "done"].includes(page?.status));
      if (["failed", "quality_failed"].includes(error?.job?.status) && hasPreservedSlides) {
        renderLivePreview(error.job);
        syncDraft({ phase:"generating", lastError:message });
        const visualAuthFailure = error.job.failedStage === "illustrating" && error.job.failureKind === "authentication";
        const visualAssetFailure = error.job.failedStage === "illustrating";
        status.querySelector("strong").textContent = visualAuthFailure
          ? (language === "zh" ? "视觉素材服务鉴权失败，页面草稿已保留" : "Visual service authentication failed; slide drafts are preserved")
          : visualAssetFailure
            ? (language === "zh" ? "视觉素材生成失败，页面草稿已保留" : "Visual generation failed; slide drafts are preserved")
            : (language === "zh" ? "质量检查发现问题，草稿已保留" : "Quality review found an issue; drafts are preserved");
        status.querySelector("span").textContent = message;
        status.classList.add("error");
        const pauseButton = panel.querySelector("[data-slides-pause]"); if (pauseButton) pauseButton.hidden = true;
        const retryButton = panel.querySelector(".slides-planning-stop");
        retryButton.textContent = visualAssetFailure ? (language === "zh" ? "重新连接并重试" : "Reconnect and retry") : (language === "zh" ? "修复并继续" : "Repair and continue");
        retryButton.onclick = async () => {
          retryButton.disabled = true;
          try {
            const response = await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.generationJobId)}`), { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"retry" }) });
            const resumed = await response.json(); if (!response.ok) throw new Error(resumed.error || t("jobFailed"));
            showToast(visualAssetFailure ? (language === "zh" ? "草稿已保留，正在重试视觉素材" : "Drafts preserved; retrying visual assets") : (language === "zh" ? "草稿已保留，正在修复质量问题" : "Drafts preserved; repairing the quality issue")); renderGeneration(resumed);
          } catch (retryError) { retryButton.disabled = false; showToast(retryError?.message || t("jobFailed")); }
        };
        const continueWithoutVisuals = panel.querySelector("[data-slides-skip-quality]");
        if (visualAssetFailure && continueWithoutVisuals) {
          continueWithoutVisuals.hidden = false;
          continueWithoutVisuals.disabled = false;
          continueWithoutVisuals.textContent = language === "zh" ? "无图片继续" : "Continue without images";
          continueWithoutVisuals.onclick = async () => {
            continueWithoutVisuals.disabled = true;
            try {
              const response = await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.generationJobId)}`), { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"continue-without-visuals" }) });
              const resumed = await response.json(); if (!response.ok) throw new Error(resumed.error || t("jobFailed"));
              showToast(language === "zh" ? "已保留全部页面，正在无图片完成导入" : "All slide drafts preserved; importing without unavailable images");
              renderGeneration(resumed);
            } catch (continueError) { continueWithoutVisuals.disabled = false; showToast(continueError?.message || t("jobFailed")); }
          };
        }
        return;
      }
      if (error?.job?.status === "interrupted") {
        syncDraft({ phase:"generating", lastError:message });
        status.querySelector("strong").textContent = language === "zh" ? "Canvas 已重启，生成进度已保留" : "Canvas restarted; generation progress is preserved";
        status.querySelector("span").textContent = language === "zh" ? "可从已完成的页面和视觉素材继续，无需返回首页。" : "Continue from completed pages and visual assets without returning home.";
        status.classList.add("error");
        const pauseButton = panel.querySelector("[data-slides-pause]"); if (pauseButton) pauseButton.hidden = true;
        const retryButton = panel.querySelector(".slides-planning-stop");
        retryButton.textContent = language === "zh" ? "继续未完成阶段" : "Continue unfinished stage";
        retryButton.onclick = async () => {
          retryButton.disabled = true;
          try {
            const response = await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.generationJobId)}`), { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"retry" }) });
            const resumed = await response.json(); if (!response.ok) throw new Error(resumed.error || t("jobFailed"));
            showToast(language === "zh" ? "已从恢复点继续生成" : "Generation resumed from the recovery point"); renderGeneration(resumed);
          } catch (retryError) { retryButton.disabled = false; showToast(retryError?.message || t("jobFailed")); }
        };
        return;
      }
      syncDraft({ phase:"generating", lastError:message });
      status.querySelector("strong").textContent = language === "zh" ? "暂时无法连接生成任务" : "Could not connect to the generation task";
      status.querySelector("span").textContent = language === "zh" ? "任务编号和当前进度仍已保留，请稍后重试。" : "The task id and progress are preserved; please retry shortly.";
      showToast(language === "zh" ? `生成任务连接中断：${message}` : `Generation connection interrupted: ${message}`);
    }
  };
  const generateConfirmedOutline = async () => {
    clearOutlineCountdown();
    const confirmButton = panel.querySelector(".slides-generator-submit"); if (confirmButton) { confirmButton.disabled = true; confirmButton.textContent = language === "zh" ? "正在启动生成…" : "Starting…"; }
    count = outline.slides.length; syncDraft({ count, existingSlideCount:slidesForDeck(deck).length, phase:"outline", lastError:null }); showToast(language === "zh" ? "正在启动幻灯片生成…" : "Starting slide generation…");
    try { const response = await fetch(apiPath("/api/slides/jobs"), { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"generate-slides", deckId:deck.id, prompt:briefPrompt(), pageCount:count, deckTemplateId:draft.deckTemplateId || "freeform", dataMode:draft.dataMode || "ai-generated", outline:outline.slides.map((slide,index) => ({ ...slide, ...(visualRhythm?.[index] || {}), order:index + 1 })), visualDirection:{ deckStyle:outline.style || brief?.style || "", goal:brief?.goal || "", audience:brief?.audience || "", scenario:brief?.scenario || "", presets:brief?.presets || [], designSystem, visualRhythm, brandProfile:draft.brandProfile?.enabled ? draft.brandProfile : null }, references, targetSlideId:draft.targetSlideId || null }) }); const job = await response.json(); if (!response.ok) throw new Error(job.error || t("jobFailed")); syncDraft({ generationJobId:job.id, phase:"generating" }); showToast(language === "zh" ? "已调用幻灯片工作流，正在按设计系统和视觉节奏生成" : "Slide workflow started with the confirmed design system and visual rhythm"); renderGeneration(job); }
    catch (error) { const message = error?.message || t("jobFailed"); syncDraft({ generationJobId:null, activeJobId:null, phase:"brief", lastError:message, targetSlideId:null }); showToast(language === "zh" ? `启动生成失败：${message}` : `Could not start generation: ${message}`); renderBrief(); }
  };
  if (draft.phase === "optimizing-brief" && draft.briefJobId) renderBriefOptimizing();
  else if (draft.phase === "brief-review" && draft.optimizedBrief) { brief = draft.optimizedBrief; requirements = draft.requirements || requirementsFromBrief(brief); syncDraft({ brief, requirements, phase:"requirements" }); renderRequirements(); }
  else if (draft.phase === "planning" && draft.activeJobId) renderPlanning();
  else if (draft.phase === "generating" && draft.generationJobId && outline?.slides?.length) renderGeneration();
  else if (draft.phase === "requirements" && requirements) renderRequirements();
  else if (draft.phase === "storyline" && outline?.slides?.length && storyline?.chapters?.length) renderStructure();
  else if (draft.phase === "structure" && outline?.slides?.length && structure?.pages?.length) renderStructure();
  else if (draft.phase === "visual-system" && outline?.slides?.length) renderStructure();
  else if (draft.phase === "outline" && outline?.slides?.length) renderStructure();
  else renderBrief();
  return panel;
}

function slidesHistoryDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", {
    month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"
  }).format(date);
}

function openSlidesGenerationHistory(deck) {
  document.querySelector(".slides-history-backdrop")?.remove();
  const backdrop = document.createElement("div");
  backdrop.className = "slides-history-backdrop";
  const dialog = document.createElement("section");
  dialog.className = "slides-history-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "slides-history-title");
  const header = document.createElement("header");
  const headerCopy = document.createElement("div");
  const title = document.createElement("h2");
  title.id = "slides-history-title";
  title.textContent = language === "zh" ? "幻灯片生成记录" : "Slide generation history";
  const help = document.createElement("p");
  help.textContent = language === "zh"
    ? "最近 5 份保留完整大纲和结果引用，更早记录保留为摘要。"
    : "The latest five keep their outline and result references; older entries remain as summaries.";
  headerCopy.append(title, help);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "slides-history-close";
  close.setAttribute("aria-label", language === "zh" ? "关闭生成记录" : "Close generation history");
  close.append(slidesIcon("close"));
  header.append(headerCopy, close);
  const body = document.createElement("div");
  body.className = "slides-history-list";
  const records = readSlidesGenerationHistory(deck.id);
  const dismiss = () => {
    document.removeEventListener("keydown", onKeydown);
    backdrop.remove();
  };
  const onKeydown = (event) => { if (event.key === "Escape") dismiss(); };
  close.onclick = dismiss;
  backdrop.addEventListener("pointerdown", (event) => { if (event.target === backdrop) dismiss(); });
  document.addEventListener("keydown", onKeydown);
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "slides-history-empty";
    empty.append(slidesIcon("history"));
    const emptyTitle = document.createElement("strong");
    emptyTitle.textContent = language === "zh" ? "还没有生成记录" : "No generation history yet";
    const emptyHelp = document.createElement("span");
    emptyHelp.textContent = language === "zh" ? "完成一次幻灯片生成后，记录会自动出现在这里。" : "Completed slide generations will appear here automatically.";
    empty.append(emptyTitle, emptyHelp);
    body.append(empty);
  } else {
    records.forEach((record, index) => {
      const item = document.createElement("article");
      item.className = "slides-history-item";
      const itemHeader = document.createElement("div");
      itemHeader.className = "slides-history-item-header";
      const itemCopy = document.createElement("div");
      const itemTitle = document.createElement("strong");
      itemTitle.textContent = record.title || record.topic || (language === "zh" ? "未命名幻灯片" : "Untitled presentation");
      const meta = document.createElement("span");
      meta.textContent = `${slidesHistoryDate(record.createdAt)} · ${record.pageCount || 0} ${language === "zh" ? "页" : "pages"}${record.style ? ` · ${record.style}` : ""}`;
      itemCopy.append(itemTitle, meta);
      const badge = document.createElement("span");
      badge.className = `slides-history-badge ${record.full ? "is-full" : "is-summary"}`;
      badge.textContent = record.full ? (language === "zh" ? `完整版本 ${index + 1}/5` : `Full ${index + 1}/5`) : (language === "zh" ? "历史摘要" : "Summary");
      itemHeader.append(itemCopy, badge);
      const topic = document.createElement("p");
      topic.textContent = record.topic || (language === "zh" ? "未记录需求描述" : "No saved brief");
      item.append(itemHeader, topic);
      if (record.full) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = language === "zh" ? "查看已确认大纲" : "View confirmed outline";
        const outlineList = document.createElement("ol");
        for (const slide of record.outline?.slides || []) {
          const outlineItem = document.createElement("li");
          outlineItem.textContent = slide.title || slide.message || (language === "zh" ? "未命名页面" : "Untitled slide");
          outlineList.append(outlineItem);
        }
        details.append(summary, outlineList);
        const actions = document.createElement("div");
        actions.className = "slides-history-item-actions";
        const reuse = document.createElement("button");
        reuse.type = "button";
        reuse.textContent = language === "zh" ? "沿用大纲" : "Reuse outline";
        reuse.disabled = !record.outline?.slides?.length;
        reuse.onclick = () => {
          const restoredOutline = record.outline ? structuredClone(record.outline) : null;
          const restoredBrief = record.brief ? structuredClone(record.brief) : { topic:record.topic || "" };
          const restoredRequirements = restoredOutline?.requirements ? structuredClone(restoredOutline.requirements) : {
            goal:{ label:"核心目标", help:"确认这套演示最重要的结果。", selected:restoredBrief.goal || "清晰传达核心观点", options:[restoredBrief.goal || "清晰传达核心观点", "推动决策与行动", "展示专业能力与成果"].filter(Boolean) },
            audience:{ label:"目标受众", help:"受众决定信息密度和表达方式。", selected:restoredBrief.audience || "通用受众", options:[restoredBrief.audience || "通用受众", "管理层与决策者", "客户与合作伙伴"].filter(Boolean) },
            scenario:{ label:"演示场景", help:"场景决定页面节奏与留白。", selected:restoredBrief.scenario || "现场演示", options:[restoredBrief.scenario || "现场演示", "自己阅读", "工作汇报"].filter(Boolean) },
            length:{ label:"篇幅长度", help:"根据内容深度确认最终页数。", selected:String(record.pageCount || restoredOutline?.slides?.length || 5), options:[String(record.pageCount || restoredOutline?.slides?.length || 5), "8", "12"] }
          };
          if (restoredOutline) restoredOutline.requirements = structuredClone(restoredRequirements);
          slidesGeneratorDraftByDeck.set(deck.id, freshSlidesGeneratorDraft({
            topic:record.topic || restoredBrief?.topic || "",
            count:record.pageCount || restoredOutline?.slides?.length || 5,
            outline:restoredOutline,
            brief:restoredBrief,
            requirements:restoredRequirements,
            phase:restoredOutline?.slides?.length ? "requirements" : "brief"
          }));
          persistSlidesDrafts();
          slidesGeneratorOpenByDeck.add(deck.id);
          dismiss();
          render();
          showToast(language === "zh" ? "已载入历史大纲，可修改后再次生成" : "Historical outline loaded and ready to regenerate");
        };
        const restore = document.createElement("button");
        restore.type = "button";
        restore.className = "primary";
        restore.textContent = language === "zh" ? "恢复到面板" : "Restore to panel";
        const availableSlides = (record.slideIds || []).map((id) => state?.objects?.find((object) => object.id === id)).filter((object) => object && ["image","html","slide-frame"].includes(object.type || "image"));
        restore.disabled = availableSlides.length === 0;
        restore.title = restore.disabled ? (language === "zh" ? "对应页面已不在当前画布中" : "The generated pages are no longer on this canvas") : "";
        restore.onclick = async () => {
          const currentSlides = slidesForDeck(deck);
          const sameVersion = currentSlides.length === availableSlides.length && currentSlides.every((slide, slideIndex) => slide.id === availableSlides[slideIndex]?.id);
          if (!sameVersion && currentSlides.length) {
            const confirmed = await showConfirmDialog({
              title:language === "zh" ? "恢复这个历史版本？" : "Restore this historical version?",
              message:language === "zh" ? "面板会切换到历史页面；当前页面仍保留在画布上。" : "The panel will switch to the historical pages; current pages stay on the canvas.",
              confirmText:language === "zh" ? "恢复版本" : "Restore version",
              cancelText:language === "zh" ? "取消" : "Cancel"
            });
            if (!confirmed) return;
          }
          restore.disabled = true;
          const restoredIds = new Set(availableSlides.map((slide) => slide.id));
          const updates = [
            { id:deck.id, patch:{ slideIds:availableSlides.map((slide) => slide.id) } },
            ...currentSlides.filter((slide) => !restoredIds.has(slide.id)).map((slide) => ({ id:slide.id, patch:{ slideDeckId:null, slideOrder:0 } })),
            ...availableSlides.map((slide, slideOrder) => ({ id:slide.id, patch:{ slideDeckId:deck.id, slideOrder } }))
          ];
          try {
            await patchCanvasObjects(updates, selectionSnapshotForIds([]), currentCanvasScopeMeta());
            activeSlideIndexByDeck.set(deck.id, 0);
            slidesGeneratorOpenByDeck.delete(deck.id);
            await loadState();
            setLocalSelection([]);
            dismiss();
            render();
            showToast(language === "zh" ? `已恢复 ${availableSlides.length} 页历史版本` : `Restored ${availableSlides.length} historical slides`);
          } catch (error) {
            restore.disabled = false;
            showToast(error?.message || t("jobFailed"));
          }
        };
        actions.append(reuse, restore);
        item.append(details, actions);
      }
      body.append(item);
    });
  }
  dialog.append(header, body);
  backdrop.append(dialog);
  document.body.append(backdrop);
  window.requestAnimationFrame(() => close.focus());
}

function renderSlidesObject(deck) {
  const frame = document.createElement("section");
  frame.className = "slides-deck-content";
  frame.dataset.slidesDeckFrame = deck.id;
  const header = document.createElement("header"); header.className = "slides-deck-topbar";
  const title = document.createElement("strong"); title.textContent = slidesDeckDisplayName(deck);
  const titleWrap = document.createElement("div"); titleWrap.className = "slides-deck-title"; titleWrap.append(title);
  const actions = document.createElement("div"); actions.className = "slides-deck-actions";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "slides-deck-refresh";
  refresh.setAttribute("aria-label", language === "zh" ? "刷新幻灯片" : "Refresh slides");
  refresh.title = language === "zh" ? "重新加载幻灯片，清除错误状态并重置到首页" : "Reload slides, clear errors and reset to the first page";
  refresh.append(slidesIcon("refresh"));
  refresh.addEventListener("pointerdown", (event) => event.stopPropagation());
  refresh.addEventListener("click", async (event) => {
    event.stopPropagation();
    refresh.disabled = true;
    try {
      // 清理生成器状态：错误信息、活动任务、生成器面板
      const draft = slidesGeneratorDraftByDeck.get(deck.id);
      if (draft) {
        draft.pollToken = {};
        if (draft.activeJobId) {
          try { await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.activeJobId)}`), { method: "DELETE" }); } catch {}
        }
        if (draft.generationJobId && draft.generationJobId !== draft.activeJobId) {
          try { await fetch(apiPath(`/api/slides/jobs/${encodeURIComponent(draft.generationJobId)}`), { method: "DELETE" }); } catch {}
        }
        slidesGeneratorDraftByDeck.delete(deck.id);
        persistSlidesDrafts();
      }
      slidesRegenerateStateByDeck.delete(deck.id);
      slidesGeneratorOpenByDeck.delete(deck.id);
      activeSlideIndexByDeck.set(deck.id, 0);
      await loadState();
      render();
      showToast(language === "zh" ? "已刷新并清除错误状态" : "Refreshed and errors cleared");
    } finally {
      refresh.disabled = false;
    }
  });
  const history = document.createElement("button");
  history.type = "button";
  history.className = "slides-deck-history";
  history.setAttribute("aria-label", language === "zh" ? "查看幻灯片生成记录" : "View slide generation history");
  history.append(slidesIcon("history"), document.createTextNode(language === "zh" ? "生成记录" : "History"));
  history.addEventListener("pointerdown", (event) => event.stopPropagation());
  history.addEventListener("click", (event) => { event.stopPropagation(); openSlidesGenerationHistory(deck); });
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "slides-deck-clear";
  clear.setAttribute("aria-label", language === "zh" ? "清空当前幻灯片" : "Clear current slide deck");
  clear.title = language === "zh" ? "清空当前幻灯片中的全部页面" : "Remove every page from this deck";
  clear.append(slidesIcon("trash"), document.createTextNode(language === "zh" ? "清空" : "Clear"));
  clear.addEventListener("pointerdown", (event) => event.stopPropagation());
  clear.addEventListener("click", async (event) => { event.stopPropagation(); await clearSlidesDeck(deck); });
  const exportWrap = document.createElement("div"); exportWrap.className = "slides-deck-export-wrap";
  const exportPptx = document.createElement("button");
  exportPptx.type = "button";
  exportPptx.className = "slides-deck-export";
  exportPptx.setAttribute("aria-label", language === "zh" ? "导出 PowerPoint" : "Export PowerPoint");
  exportPptx.title = language === "zh" ? "将当前幻灯片导出为可编辑的 PPTX" : "Export this deck as an editable PPTX";
  exportPptx.append(slidesIcon("download"), document.createTextNode(language === "zh" ? "导出" : "Export"));
  exportPptx.addEventListener("pointerdown", (event) => event.stopPropagation());
  const exportMenu = document.createElement("div"); exportMenu.className = "slides-deck-export-menu"; exportMenu.hidden = true;
  const exportChoice = (format, zh, en) => { const button = document.createElement("button"); button.type = "button"; button.dataset.slidesExportFormat = format; button.textContent = language === "zh" ? zh : en; return button; };
  exportMenu.append(exportChoice("pptx", "可编辑 PPTX", "Editable PPTX"), exportChoice("pdf", "PDF 文档", "PDF document"), exportChoice("images", "逐页图片包 ZIP", "Page images ZIP"), exportChoice("long-png", "整套长图 PNG", "Long PNG"));
  exportPptx.addEventListener("click", (event) => { event.stopPropagation(); exportMenu.hidden = !exportMenu.hidden; });
  exportMenu.addEventListener("pointerdown", (event) => event.stopPropagation());
  exportMenu.addEventListener("click", async (event) => { const format = event.target.closest("[data-slides-export-format]")?.dataset.slidesExportFormat; if (!format) return; event.stopPropagation(); exportMenu.hidden = true; if (format === "pptx") await showSlidesExportCheck(deck, exportPptx); else await downloadSlidesDocument(deck, format, exportPptx); });
  exportWrap.append(exportPptx, exportMenu);
  const qualityCenter = document.createElement("button");
  qualityCenter.type = "button"; qualityCenter.className = "slides-deck-quality-center";
  qualityCenter.setAttribute("aria-label", language === "zh" ? "打开集中质量问题中心" : "Open quality issue center");
  qualityCenter.title = language === "zh" ? "检查页面布局、生成失败和整套视觉一致性" : "Audit layout, generation failures, and deck-wide consistency";
  qualityCenter.append(slidesIcon("bolt"), document.createTextNode(language === "zh" ? "质量检查" : "Quality check"));
  qualityCenter.addEventListener("pointerdown", (event) => event.stopPropagation());
  qualityCenter.addEventListener("click", (event) => { event.stopPropagation(); openSlidesQualityCenter(deck, (index) => showSlide(index)); });
  const transformDeck = document.createElement("button");
  transformDeck.type = "button";
  transformDeck.className = "slides-deck-transform";
  transformDeck.setAttribute("aria-label", language === "zh" ? "整套 AI 修改" : "Transform whole deck with AI");
  transformDeck.append(slidesIcon("sparkles"), document.createTextNode(language === "zh" ? "整套 AI 修改" : "AI transform"));
  transformDeck.addEventListener("pointerdown", (event) => event.stopPropagation());
  transformDeck.addEventListener("click", (event) => { event.stopPropagation(); openDeckTransformDialog(deck); });
  const present = document.createElement("button");
  present.type = "button";
  present.className = "slides-deck-present";
  present.append(slidesIcon("play"), document.createTextNode(language === "zh" ? "演示 Slides" : "Present Slides"));
  present.addEventListener("pointerdown", (event) => event.stopPropagation());
  present.addEventListener("click", (event) => { event.stopPropagation(); openSlidesPresentation(deck.id); });
  const closeDeck = document.createElement("button");
  closeDeck.type = "button";
  closeDeck.className = "slides-deck-close";
  closeDeck.setAttribute("aria-label", language === "zh" ? "关闭幻灯片面板" : "Close slides panel");
  closeDeck.title = language === "zh" ? "关闭幻灯片面板，返回画布" : "Close the slides panel and return to canvas";
  closeDeck.append(slidesIcon("close"));
  closeDeck.addEventListener("pointerdown", (event) => event.stopPropagation());
  closeDeck.addEventListener("click", (event) => { event.stopPropagation(); toggleSlidesWorkspace(); });
  actions.append(refresh, history, clear, qualityCenter, transformDeck, exportWrap, present, closeDeck); header.append(titleWrap, actions);
  const slides = slidesForDeck(deck);
  frame.classList.toggle("is-empty", slides.length === 0);
  clear.hidden = slides.length === 0;
  exportPptx.hidden = slides.length === 0;
  qualityCenter.hidden = slides.length === 0;
  transformDeck.hidden = slides.length === 0;
  present.hidden = slides.length === 0;
  clear.disabled = slides.length === 0;
  exportPptx.disabled = slides.length === 0;
  qualityCenter.disabled = slides.length === 0;
  transformDeck.disabled = slides.length === 0;
  present.disabled = slides.length === 0;
  present.title = slides.length
    ? (language === "zh" ? "演示 Slides" : "Present Slides")
    : (language === "zh" ? "添加页面后才能演示" : "Add a page before presenting");
  let activeIndex = Math.min(activeSlideIndexByDeck.get(deck.id) || 0, Math.max(0, slides.length - 1));
  const workspace = document.createElement("div"); workspace.className = "slides-deck-workspace";
  const sidebar = document.createElement("aside"); sidebar.className = "slides-deck-sidebar"; sidebar.setAttribute("aria-label", language === "zh" ? "幻灯片缩略图" : "Slide thumbnails");
  const sidebarHeader = document.createElement("div"); sidebarHeader.className = "slides-deck-sidebar-header";
  const sidebarTitle = document.createElement("strong"); sidebarTitle.textContent = language === "zh" ? "幻灯片" : "Slides";
  const sidebarCount = document.createElement("span"); sidebarCount.textContent = String(slides.length);
  const sidebarHeading = document.createElement("div"); sidebarHeading.append(sidebarTitle, sidebarCount);
  const reorderActions = document.createElement("div"); reorderActions.className = "slides-deck-reorder-actions";
  const moveUp = document.createElement("button"); moveUp.type = "button"; moveUp.setAttribute("aria-label", language === "zh" ? "上移当前幻灯片" : "Move current slide up"); moveUp.title = moveUp.getAttribute("aria-label"); moveUp.append(slidesIcon("move-up"));
  const moveDown = document.createElement("button"); moveDown.type = "button"; moveDown.setAttribute("aria-label", language === "zh" ? "下移当前幻灯片" : "Move current slide down"); moveDown.title = moveDown.getAttribute("aria-label"); moveDown.append(slidesIcon("move-down"));
  moveUp.addEventListener("pointerdown", (event) => event.stopPropagation()); moveDown.addEventListener("pointerdown", (event) => event.stopPropagation());
  moveUp.addEventListener("click", async (event) => { event.stopPropagation(); await reorderDeckSlide(deck, activeIndex, activeIndex - 1); });
  moveDown.addEventListener("click", async (event) => { event.stopPropagation(); await reorderDeckSlide(deck, activeIndex, activeIndex + 1); });
  reorderActions.append(moveUp, moveDown); sidebarHeader.append(sidebarHeading, reorderActions);
  const list = document.createElement("div"); list.className = "slides-deck-thumbnails";
  sidebar.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const delta = normalizedWheelDelta(event);
    list.scrollTop += delta.y || delta.x;
  }, { passive: false });
  const main = document.createElement("main"); main.className = "slides-deck-main";
  const mainHeader = document.createElement("div"); mainHeader.className = "slides-deck-main-header";
  const currentName = document.createElement("strong");
  const counter = document.createElement("span"); counter.className = "slides-deck-counter";
  mainHeader.append(currentName, counter);
  const stage = document.createElement("div"); stage.className = "slides-deck-stage";
  const showSlide = (index) => {
    if (!slides.length) return;
    slidesGeneratorOpenByDeck.delete(deck.id);
    activeIndex = Math.max(0, Math.min(slides.length - 1, index));
    activeSlideIndexByDeck.set(deck.id, activeIndex);
    const slide = slides[activeIndex];
    currentName.textContent = slide.name || `${language === "zh" ? "幻灯片" : "Slide"} ${activeIndex + 1}`;
    counter.textContent = `${activeIndex + 1}/${slides.length}`;
    moveUp.disabled = activeIndex === 0;
    moveDown.disabled = activeIndex === slides.length - 1;
    stage.replaceChildren(createSlidesMedia(slide, `${language === "zh" ? "第" : "Slide "}${activeIndex + 1}${language === "zh" ? " 页" : ""}`));
    list.querySelectorAll("[data-slide-index]").forEach((button) => {
      const selected = Number(button.dataset.slideIndex) === activeIndex;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-current", selected ? "true" : "false");
    });
  };
  const showGenerator = ({ fresh = false } = {}) => {
    if (fresh) {
      slidesGeneratorDraftByDeck.set(deck.id, freshSlidesGeneratorDraft());
      persistSlidesDrafts();
    }
    slidesGeneratorOpenByDeck.add(deck.id); stage.replaceChildren(renderSlidesGenerator(deck, { append: slides.length > 0 })); currentName.textContent = language === "zh" ? "生成新幻灯片" : "Generate new slides"; counter.textContent = `${slides.length}+`; moveUp.disabled = true; moveDown.disabled = true;
    list.querySelectorAll("[data-slide-index]").forEach((button) => { button.classList.remove("active"); button.setAttribute("aria-current", "false"); });
  };
  if (!slides.length) {
    slidesGeneratorOpenByDeck.add(deck.id);
    currentName.textContent = slidesDeckDisplayName(deck); counter.textContent = "0/0";
  }
  slides.forEach((slide, index) => {
    const item = document.createElement("div"); item.className = "slides-deck-thumbnail-item"; item.dataset.slideIndex = String(index); item.tabIndex = 0; item.setAttribute("role", "option");
    item.setAttribute("aria-label", `${language === "zh" ? "选择第" : "Select slide "}${index + 1}${language === "zh" ? "张幻灯片，按删除键可删除" : "; press Delete to remove"}`);
    item.title = language === "zh" ? "选中后按 Delete 或 Backspace 删除" : "Select, then press Delete or Backspace to remove";
    const number = document.createElement("span"); number.className = "slides-deck-thumbnail-number"; number.textContent = String(index + 1);
    const thumb = document.createElement("div");
    thumb.className = "slides-deck-thumbnail";
    thumb.append(createSlidesMedia(slide, `${language === "zh" ? "第" : "Slide "}${index + 1}${language === "zh" ? " 页预览" : " preview"}`, true));
    if (slide.type === "slide-frame" && slide.qualityStatus && slide.qualityStatus !== "unknown") {
      const qualityBadge = document.createElement("button"); qualityBadge.type = "button"; qualityBadge.className = `slides-page-quality is-${slide.qualityStatus}`;
      const issueCount = Array.isArray(slide.qualityIssues) ? slide.qualityIssues.length : 0;
      qualityBadge.title = slide.qualityStatus === "passed" ? (language === "zh" ? "质量检查通过" : "Quality check passed") : (slide.qualityIssues || []).map((issue) => issue.message).join("\n");
      qualityBadge.setAttribute("aria-label", qualityBadge.title || (language === "zh" ? "页面质量状态" : "Page quality status"));
      qualityBadge.append(slidesIcon(slide.qualityStatus === "passed" ? "check" : "bolt"), document.createTextNode(slide.qualityStatus === "passed" ? (language === "zh" ? "通过" : "Passed") : `${issueCount}`));
      qualityBadge.onclick = (event) => { event.stopPropagation(); const details = qualityBadge.title; showToast(details || qualityBadge.getAttribute("aria-label")); };
      thumb.append(qualityBadge);
    }
    const grip = document.createElement("button"); grip.type = "button"; grip.className = "slides-deck-drag-handle"; grip.draggable = true; grip.setAttribute("aria-label", language === "zh" ? `拖动第 ${index + 1} 张幻灯片调整顺序` : `Drag slide ${index + 1} to reorder`); grip.title = grip.getAttribute("aria-label"); grip.append(slidesIcon("grip"));
    const menuButton = document.createElement("button"); menuButton.type = "button"; menuButton.className = "slides-deck-page-menu-button"; menuButton.setAttribute("aria-label", language === "zh" ? `第 ${index + 1} 页操作` : `Slide ${index + 1} actions`); menuButton.setAttribute("aria-expanded", "false"); menuButton.append(slidesIcon("more"));
    const menu = document.createElement("div"); menu.className = "slides-deck-page-menu"; menu.hidden = true; menu.setAttribute("role", "menu");
    const menuAction = (action, icon, zh, en, disabled = false) => { const button = document.createElement("button"); button.type = "button"; button.dataset.slidePageAction = action; button.disabled = disabled; button.setAttribute("role", "menuitem"); button.append(slidesIcon(icon), document.createTextNode(language === "zh" ? zh : en)); return button; };
    menu.append(
      menuAction("edit", "edit", "编辑页面", "Edit page", slide.type !== "slide-frame"),
      menuAction("regenerate", "refresh", "AI 重新生成", "Regenerate with AI", slidesDeckHasActiveRegenerate(deck.id)),
      menuAction("delete", "trash", "清空当前页面", "Clear slide")
    );
    menuButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    menuButton.addEventListener("click", (event) => { event.stopPropagation(); const open = menu.hidden; list.querySelectorAll(".slides-deck-page-menu").forEach((node) => { node.hidden = true; }); list.querySelectorAll(".slides-deck-page-menu-button").forEach((node) => node.setAttribute("aria-expanded", "false")); menu.hidden = !open; menuButton.setAttribute("aria-expanded", String(open)); });
    menu.addEventListener("pointerdown", (event) => event.stopPropagation());
    menu.addEventListener("click", async (event) => { const action = event.target.closest("[data-slide-page-action]")?.dataset.slidePageAction; if (!action) return; event.stopPropagation(); menu.hidden = true; menuButton.setAttribute("aria-expanded", "false"); if (action === "edit") openSlideFrameEditor(slide); if (action === "regenerate") { const ongoing = slidesRegenerateStateByDeck.get(deck.id); if (ongoing && ["confirm","starting","generating"].includes(ongoing.status)) { showToast(language === "zh" ? "当前已有页面正在重新生成" : "A regeneration is already running"); } else { startInlineRegenerate(deck, slide, index, item); } } if (action === "delete") await removeSlideFromDeck(deck, slide); });
    grip.addEventListener("pointerdown", (event) => event.stopPropagation());
    grip.addEventListener("dragstart", (event) => { if (slidesDeckHasActiveRegenerate(deck.id)) { event.preventDefault(); showToast(language === "zh" ? "生成期间不能调整顺序" : "Cannot reorder during regeneration"); return; } event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); item.classList.add("is-dragging"); });
    grip.addEventListener("dragend", () => { item.classList.remove("is-dragging"); list.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target")); });
    item.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; item.classList.add("is-drop-target"); });
    item.addEventListener("dragleave", () => item.classList.remove("is-drop-target"));
    item.addEventListener("drop", async (event) => { event.preventDefault(); event.stopPropagation(); item.classList.remove("is-drop-target"); const from = Number(event.dataTransfer.getData("text/plain")); if (Number.isInteger(from)) await reorderDeckSlide(deck, from, index); });
    item.append(number, thumb, grip, menuButton, menu); item.addEventListener("pointerdown", (event) => event.stopPropagation()); item.addEventListener("click", (event) => { if (event.target.closest(".slides-deck-drag-handle,.slides-deck-page-menu-button,.slides-deck-page-menu")) return; event.stopPropagation(); const regen = slidesRegenerateStateByDeck.get(deck.id); if (regen && ["confirm","starting","generating"].includes(regen.status) && regen.slideIndex !== index) { showToast(language === "zh" ? "正在重新生成，请先完成或取消" : "Finish or cancel the ongoing regeneration first"); return; } showSlide(index); }); item.addEventListener("keydown", (event) => { if ((event.key === "Enter" || event.key === " ") && !event.target.closest(".slides-deck-drag-handle")) { event.preventDefault(); const regen = slidesRegenerateStateByDeck.get(deck.id); if (regen && ["confirm","starting","generating"].includes(regen.status) && regen.slideIndex !== index) { showToast(language === "zh" ? "正在重新生成，请先完成或取消" : "Finish or cancel the ongoing regeneration first"); return; } showSlide(index); } }); list.append(item);
  });
  const footer = document.createElement("footer"); footer.className = "slides-deck-sidebar-footer"; footer.append(createSlidesAddMenu(deck));
  sidebar.append(sidebarHeader, list, footer); main.append(mainHeader, stage); workspace.append(sidebar, main); frame.append(header, workspace);
  if (slidesGeneratorOpenByDeck.has(deck.id) || !slides.length) showGenerator(); else showSlide(activeIndex);
  reattachRegenerateState(frame, deck);
  frame.addEventListener("dragover", (event) => {
    if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    frame.classList.add("is-dragover");
  });
  frame.addEventListener("dragleave", (event) => {
    if (!frame.contains(event.relatedTarget)) frame.classList.remove("is-dragover");
  });
  frame.addEventListener("drop", async (event) => {
    if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes("Files")) return;
    const files = [...(event.dataTransfer.files || [])].filter(isUploadImageCandidate);
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    frame.classList.remove("is-dragover");
    const before = new Set(state.objects.map((item) => item.id));
    await uploadImageFiles(files);
    const additions = state.objects.filter((item) => !before.has(item.id) && (item.type || "image") === "image");
    if (additions.length) await addObjectsToSlides(deck, additions);
  });
  return frame;
}

async function clearSlidesDeck(deck) {
  const slides = slidesForDeck(deck);
  if (!slides.length) return;
  const confirmed = await showConfirmDialog({
    title: language === "zh" ? "清空 AI 幻灯片面板？" : "Clear the AI Slides panel?",
    message: language === "zh" ? `将从面板移除 ${slides.length} 个页面并返回生成界面。画布上的图片、HTML 和 Frame 会全部保留。` : `This removes ${slides.length} pages from the panel and returns to generation. Images, HTML pages and Frames remain on the canvas.`,
    confirmText: language === "zh" ? "仅清空面板" : "Clear panel only",
    cancelText: language === "zh" ? "取消" : "Cancel"
  });
  if (!confirmed) return;
  activeSlideIndexByDeck.set(deck.id, 0);
  slidesGeneratorOpenByDeck.add(deck.id);
  const updates = [
    { id:deck.id, patch:{ slideIds:[] } },
    ...slides.map((slide) => ({ id:slide.id, patch:{ slideDeckId:null, slideOrder:0 } }))
  ];
  try {
    const payload = await patchCanvasObjects(updates, selectionSnapshotForIds([]), currentCanvasScopeMeta());
    replaceLocalObjects(payload.objects || []);
    refreshKnownObjectIds();
    canvasObjectRenderSignatures.delete(deck.id);
    slidesGeneratorDraftByDeck.set(deck.id, freshSlidesGeneratorDraft());
    persistSlidesDrafts();
    setLocalSelection([]);
    render();
    showToast(language === "zh" ? "面板已清空，画布内容已保留" : "Panel cleared; canvas content was kept");
  } catch (error) {
    showToast(error?.message || t("jobFailed"));
  }
}

async function openSlidesQualityCenter(deck, onSelectPage) {
  const backdrop = document.createElement("div"); backdrop.className = "slides-quality-backdrop";
  const dialog = document.createElement("section"); dialog.className = "slides-quality-dialog"; dialog.setAttribute("role","dialog"); dialog.setAttribute("aria-modal","true");
  dialog.innerHTML = `<header><div><h2>${language === "zh" ? "集中质量问题中心" : "Quality issue center"}</h2><p>${language === "zh" ? "检查页面布局、生成失败、数据来源，以及全套字体和页面构图一致性。" : "Audit layout, generation failures, data sources, and cross-slide typography and composition consistency."}</p></div><button type="button" data-quality-close aria-label="${language === "zh" ? "关闭" : "Close"}">×</button></header><div class="slides-quality-summary" aria-live="polite"><span>${language === "zh" ? "正在检查整套幻灯片…" : "Auditing the deck…"}</span></div><div class="slides-quality-filters" role="group"></div><main class="slides-quality-list"></main><footer><button type="button" data-quality-refresh>${language === "zh" ? "重新检查" : "Run audit again"}</button><button type="button" class="primary" data-quality-done>${language === "zh" ? "完成" : "Done"}</button></footer>`;
  backdrop.append(dialog); document.body.append(backdrop);
  const list = dialog.querySelector(".slides-quality-list"); const summary = dialog.querySelector(".slides-quality-summary"); const filters = dialog.querySelector(".slides-quality-filters");
  let report = null; let filter = "all";
  const close = () => { document.removeEventListener("keydown", onKeydown); backdrop.remove(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  dialog.querySelector("[data-quality-close]").onclick = close; dialog.querySelector("[data-quality-done]").onclick = close; backdrop.onpointerdown = (event) => { if (event.target === backdrop) close(); };
  const labels = { all:language === "zh" ? "全部" : "All", error:language === "zh" ? "错误" : "Errors", warning:language === "zh" ? "警告" : "Warnings", consistency:language === "zh" ? "跨页一致性" : "Consistency", source:language === "zh" ? "来源一致性" : "Sources" };
  for (const key of Object.keys(labels)) { const button=document.createElement("button");button.type="button";button.dataset.qualityFilter=key;button.textContent=labels[key];button.onclick=()=>{filter=key;renderReport();};filters.append(button); }
  const renderReport = () => {
    if (!report) return;
    const s=report.summary; summary.innerHTML = `<strong>${s.errors ? `${s.errors} ${language === "zh" ? "个错误" : "errors"}` : (language === "zh" ? "无阻断错误" : "No blocking errors")}</strong><span>${s.warnings} ${language === "zh" ? "个警告" : "warnings"} · ${s.passed}/${s.pages} ${language === "zh" ? "页通过" : "pages passed"} · ${s.sources} ${language === "zh" ? "条来源记录" : "source records"}</span>`;
    filters.querySelectorAll("button").forEach((button)=>button.classList.toggle("active",button.dataset.qualityFilter===filter)); list.replaceChildren();
    const records = [
      ...report.deckIssues.map((issue)=>({ ...issue, kind:String(issue.id || "").startsWith("source-") ? "source" : "consistency", title:String(issue.id || "").startsWith("source-") ? (language === "zh" ? "整套来源一致性" : "Deck source consistency") : (language === "zh" ? "整套视觉一致性" : "Deck visual consistency"), pageIndex:issue.pageIndexes?.[0] })),
      ...report.pages.flatMap((page)=>page.issues.map((issue)=>({ ...issue, kind:issue.id?.includes("source") ? "source" : "page", title:`${language === "zh" ? "第" : "Slide "}${page.index + 1}${language === "zh" ? "页" : ""} · ${page.title}`, pageIndex:page.index })))
    ].filter((item)=>filter === "all" || item.severity === filter || filter === "source" && item.kind === "source" || filter === "consistency" && item.kind === "consistency");
    if (!records.length) { const empty=document.createElement("p");empty.className="slides-quality-empty";empty.textContent=language === "zh" ? "当前筛选下没有质量问题。" : "No issues in this filter.";list.append(empty);return; }
    for (const item of records) { const row=document.createElement("button");row.type="button";row.className=`slides-quality-item is-${item.severity}`;const icon=document.createElement("i");icon.textContent=item.severity === "error" ? "!" : "△";const copy=document.createElement("span");const title=document.createElement("strong");title.textContent=item.title;const message=document.createElement("span");message.textContent=item.message;copy.append(title,message);row.append(icon,copy);if(Number.isInteger(item.pageIndex)){row.onclick=()=>{close();onSelectPage?.(item.pageIndex);};}else{row.setAttribute("aria-disabled","true");row.classList.add("is-deck-wide");}list.append(row); }
  };
  const load = async () => { summary.innerHTML=`<span>${language === "zh" ? "正在重新检查…" : "Running audit…"}</span>`; list.replaceChildren(); try { const response=await fetch(apiPath(`/api/slides/${encodeURIComponent(deck.id)}/quality`));const payload=await response.json();if(!response.ok)throw new Error(payload.error||t("jobFailed"));report=payload;renderReport(); } catch(error){summary.innerHTML=`<strong>${language === "zh" ? "检查失败" : "Audit failed"}</strong><span>${escapeSlideBriefHtml(error.message||t("jobFailed"))}</span>`;} };
  dialog.querySelector("[data-quality-refresh]").onclick=load; requestAnimationFrame(()=>dialog.querySelector("[data-quality-close]")?.focus()); await load();
}

function openDeckTransformDialog(deck) {
  const backdrop = document.createElement("div"); backdrop.className = "slides-transform-backdrop";
  const dialog = document.createElement("section"); dialog.className = "slides-transform-dialog"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
  const options = language === "zh" ? [
    ["businesslike", "整套更商务", "统一专业表达与视觉层级，保持页面结构"],
    ["shorten-30", "全部缩短 30%", "压缩可编辑正文，保留事实、数字和图表"],
    ["dark-brand", "统一深色品牌风格", "只调整整套配色与对比度，不改文案"]
  ] : [
    ["businesslike", "More businesslike", "Unify professional wording and hierarchy while preserving structure"],
    ["shorten-30", "Shorten all copy by 30%", "Compress editable body copy while preserving facts, numbers, and charts"],
    ["dark-brand", "Apply a dark brand style", "Change deck-wide color and contrast without rewriting copy"]
  ];
  const heading = document.createElement("header");
  const headingText = document.createElement("div"); headingText.innerHTML = `<h2>${language === "zh" ? "整套 AI 修改" : "Transform whole deck"}</h2><p>${language === "zh" ? "先生成差异预览，确认后才会应用；页面数量、顺序和结构保持不变。" : "A preview is created first. Slide count, order, and structure stay unchanged."}</p>`;
  const close = document.createElement("button"); close.type = "button"; close.setAttribute("aria-label", language === "zh" ? "关闭" : "Close"); close.append(slidesIcon("close"));
  heading.append(headingText, close);
  const list = document.createElement("div"); list.className = "slides-transform-options";
  let selectedActionId = "businesslike";
  options.forEach(([id, title, description], index) => { const button = document.createElement("button"); button.type = "button"; button.dataset.actionId = id; button.setAttribute("aria-pressed", String(index === 0)); button.classList.toggle("selected", index === 0); button.innerHTML = `<strong>${title}</strong><span>${description}</span>`; list.append(button); });
  const custom = document.createElement("div"); custom.className = "slides-transform-custom";
  const customInput = document.createElement("textarea"); customInput.rows = 4; customInput.maxLength = 4000; customInput.placeholder = language === "zh" ? "例如：把整套改得更适合董事会汇报，标题更直接，正文更精炼，但保留所有数据和引用。" : "Example: Make the deck board-ready with sharper headings and shorter body copy, while preserving all data and citations.";
  custom.append(customInput); list.append(custom);
  const status = document.createElement("p"); status.className = "slides-transform-status"; status.setAttribute("aria-live", "polite");
  const footer = document.createElement("footer");
  const lastId = lastDeckTransformByDeck.get(deck.id);
  if (lastId) { const restore = document.createElement("button"); restore.type = "button"; restore.textContent = language === "zh" ? "撤销上次整套修改" : "Undo last transform"; restore.onclick = async () => { setBusy(true, language === "zh" ? "正在恢复修改前版本…" : "Restoring…"); try { await transformRequest(`/api/slides/transforms/${encodeURIComponent(lastId)}/restore`); lastDeckTransformByDeck.delete(deck.id); await loadState(); dismiss(); render(); showToast(language === "zh" ? "已恢复修改前版本" : "Previous version restored"); } catch (error) { setBusy(false, error.message); } }; footer.append(restore); }
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = language === "zh" ? "取消" : "Cancel"; footer.append(cancel);
  const previewButton = document.createElement("button"); previewButton.type = "button"; previewButton.className = "primary"; previewButton.textContent = language === "zh" ? "生成影响预览" : "Preview impact"; footer.append(previewButton);
  dialog.append(heading, list, status, footer); backdrop.append(dialog); document.body.append(backdrop);
  const dismiss = () => { document.removeEventListener("keydown", onKeydown); backdrop.remove(); };
  const setBusy = (busy, message = "") => { backdrop.classList.toggle("is-busy", busy); list.querySelectorAll("button").forEach((button) => { button.disabled = busy; }); close.disabled = busy; cancel.disabled = busy; status.textContent = message; };
  close.onclick = dismiss; cancel.onclick = dismiss;
  const onKeydown = (event) => { if (event.key === "Escape" && !backdrop.classList.contains("is-busy")) dismiss(); };
  document.addEventListener("keydown", onKeydown);
  backdrop.onpointerdown = (event) => { if (event.target === backdrop && !backdrop.classList.contains("is-busy")) dismiss(); };
  list.onclick = (event) => { const button = event.target.closest("[data-action-id]"); if (!button) return; selectedActionId = button.dataset.actionId; list.querySelectorAll("[data-action-id]").forEach((item) => { const selected = item === button; item.classList.toggle("selected", selected); item.setAttribute("aria-pressed", String(selected)); }); status.textContent = ""; };
  customInput.addEventListener("focus", () => { selectedActionId = "custom"; list.querySelectorAll("[data-action-id]").forEach((item) => { item.classList.remove("selected"); item.setAttribute("aria-pressed","false"); }); });
  const runPreview = async () => {
    const instruction = selectedActionId === "custom" ? customInput.value.trim() : "";
    if (selectedActionId === "custom" && !instruction) { customInput.focus(); status.textContent = language === "zh" ? "请先输入修改要求" : "Enter an instruction first"; return; }
    setBusy(true, language === "zh" ? "AI 正在分析整套内容并生成安全修改预览…" : "AI is preparing a safe deck-wide preview…");
    try {
      const preview = await transformRequest(`/api/slides/${encodeURIComponent(deck.id)}/transform`, { actionId:selectedActionId, instruction });
      const reduction = preview.beforeCharacters ? Math.round((1 - preview.afterCharacters / preview.beforeCharacters) * 100) : 0;
      setBusy(false);
      if (!preview.changedItems) { status.textContent = language === "zh" ? "没有发现需要修改的内容，请选择其他方式或补充要求。" : "No applicable changes were found. Choose another option or add an instruction."; return; }
      const review = document.createElement("div"); review.className = "slides-transform-review";
      const reviewSummary = document.createElement("div"); reviewSummary.className = "slides-transform-review-summary";
      reviewSummary.innerHTML = `<strong>${language === "zh" ? `影响 ${preview.changedPages} 页、${preview.changedItems} 项` : `${preview.changedPages} slides and ${preview.changedItems} items affected`}</strong><span>${selectedActionId === "shorten-30" ? (language === "zh" ? `文字缩短约 ${Math.max(0,reduction)}% · ` : `Copy shortened about ${Math.max(0,reduction)}% · `) : ""}${language === "zh" ? "取消勾选即可保留该页原版" : "Uncheck a slide to keep its original version"}</span>`;
      const selectActions = document.createElement("div"); selectActions.className = "slides-transform-review-select";
      const selectAll = document.createElement("button"); selectAll.type = "button"; selectAll.textContent = language === "zh" ? "全选" : "Select all";
      const selectNone = document.createElement("button"); selectNone.type = "button"; selectNone.textContent = language === "zh" ? "全不选" : "Select none";
      selectActions.append(selectAll,selectNone); reviewSummary.append(selectActions); review.append(reviewSummary);
      const typeLabels = language === "zh" ? { text:"文字",style:"样式",background:"背景",image:"图片",chart:"图表" } : { text:"Copy",style:"Style",background:"Background",image:"Image",chart:"Chart" };
      const rows = document.createElement("div"); rows.className = "slides-transform-review-list";
      for (const page of preview.pageChanges || []) {
        const row = document.createElement("article"); row.className = "slides-transform-review-page"; row.dataset.pageIndex = String(page.pageIndex);
        const label = document.createElement("label"); label.className = "slides-transform-review-page-heading";
        const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = true; checkbox.dataset.transformPage = String(page.pageIndex);
        const headingCopy = document.createElement("span"); headingCopy.innerHTML = `<strong>${language === "zh" ? `第 ${page.pageIndex + 1} 页` : `Slide ${page.pageIndex + 1}`} · ${escapeSlideBriefHtml(page.title)}</strong><small>${(page.changedTypes || []).map((type) => typeLabels[type] || type).join(" · ")} · ${page.changedItems} ${language === "zh" ? "项修改" : "changes"}</small>`;
        label.append(checkbox,headingCopy); row.append(label);
        const compare = document.createElement("div"); compare.className = "slides-transform-compare";
        const previewPane = (titleText, slide, changed) => { const pane=document.createElement("section");pane.className=`slides-transform-compare-pane${changed ? " is-after" : ""}`;const titleNode=document.createElement("b");titleNode.textContent=titleText;const thumb=document.createElement("div");thumb.className="slides-transform-compare-thumb";thumb.append(createSlidesMedia(slide, titleText, true));pane.append(titleNode,thumb);return pane; };
        compare.append(previewPane(language === "zh" ? "原版" : "Before",page.beforeSlide,false),previewPane(language === "zh" ? "修改后" : "After",page.afterSlide,true)); row.append(compare); rows.append(row);
      }
      review.append(rows); list.hidden = true; status.hidden = true; dialog.classList.add("is-reviewing"); dialog.insertBefore(review,footer);
      headingText.querySelector("h2").textContent = language === "zh" ? "逐页确认修改" : "Review changes by slide";
      headingText.querySelector("p").textContent = language === "zh" ? "对比原版与修改后版本，只应用勾选的页面。" : "Compare before and after; only checked slides will be applied.";
      const back = document.createElement("button"); back.type="button"; back.textContent=language === "zh" ? "返回修改方式" : "Back";
      const apply = document.createElement("button"); apply.type="button"; apply.className="primary";
      const updateApplyState = () => { const count=review.querySelectorAll('[data-transform-page]:checked').length;apply.disabled=count===0;apply.textContent=language === "zh" ? `应用 ${count} 页修改` : `Apply ${count} slides`; };
      footer.replaceChildren(back,apply); updateApplyState();
      review.addEventListener("change",updateApplyState); selectAll.onclick=()=>{review.querySelectorAll('[data-transform-page]').forEach((item)=>item.checked=true);updateApplyState();}; selectNone.onclick=()=>{review.querySelectorAll('[data-transform-page]').forEach((item)=>item.checked=false);updateApplyState();};
      back.onclick=()=>{dismiss();openDeckTransformDialog(deck);};
      apply.onclick=async()=>{ const pageIndexes=[...review.querySelectorAll('[data-transform-page]:checked')].map((item)=>Number(item.dataset.transformPage));apply.disabled=true;back.disabled=true;review.classList.add("is-applying");try{await transformRequest(`/api/slides/transforms/${encodeURIComponent(preview.id)}/apply`,{pageIndexes});lastDeckTransformByDeck.set(deck.id,preview.id);await loadState();dismiss();render();showToast(language === "zh" ? `已应用 ${pageIndexes.length} 页修改，可随时撤销` : `${pageIndexes.length} slide changes applied; undo is available`);}catch(error){review.classList.remove("is-applying");back.disabled=false;updateApplyState();reviewSummary.querySelector("span").textContent=error.message||t("jobFailed");}};
      requestAnimationFrame(()=>review.querySelector('[data-transform-page]')?.focus());
    } catch (error) { setBusy(false, error.message || t("jobFailed")); }
  };
  previewButton.onclick = runPreview;
  requestAnimationFrame(()=>list.querySelector('[data-action-id="businesslike"]')?.focus());
}

function requestSlidesAiInstruction(title, description) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div"); backdrop.className = "slides-transform-backdrop";
    const dialog = document.createElement("section"); dialog.className = "slides-transform-dialog slides-ai-instruction-dialog"; dialog.setAttribute("role","dialog"); dialog.setAttribute("aria-modal","true");
    const header = document.createElement("header"); const copy = document.createElement("div"); const heading = document.createElement("h2"); heading.textContent = title; const paragraph = document.createElement("p"); paragraph.textContent = description; copy.append(heading,paragraph); header.append(copy);
    const input = document.createElement("textarea"); input.rows = 5; input.maxLength = 4000;
    const footer = document.createElement("footer"); const cancel = document.createElement("button"); cancel.type="button"; cancel.textContent = language === "zh" ? "取消" : "Cancel"; const submit = document.createElement("button"); submit.type="button"; submit.className="primary"; submit.textContent = language === "zh" ? "生成修改" : "Generate edit"; footer.append(cancel,submit);
    dialog.append(header,input,footer); backdrop.append(dialog); document.body.append(backdrop);
    const close = (value = null) => { backdrop.remove(); resolve(value); }; cancel.onclick=()=>close(); submit.onclick=()=>{ const value=input.value.trim(); if(value) close(value); else input.focus(); }; backdrop.onpointerdown=(event)=>{if(event.target===backdrop)close();}; input.onkeydown=(event)=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")submit.click();if(event.key==="Escape")close();}; requestAnimationFrame(()=>input.focus());
  });
}

async function transformRequest(pathname, body) {
  const response = await fetch(apiPath(pathname), { method: "POST", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
  return payload;
}

async function downloadSlidesPptx(deck, button) {
  if (!slidesForDeck(deck).length || button.disabled) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.replaceChildren(slidesIcon("download"), document.createTextNode(language === "zh" ? "正在导出…" : "Exporting…"));
  try {
    const href = apiPath(`/api/slides/${encodeURIComponent(deck.id)}/pptx`);
    const filename = `${downloadStem(slidesDeckDisplayName(deck))}.pptx`;
    await saveUrlWithPicker(href, filename, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    showToast(language === "zh" ? "PPTX 导出完成" : "PPTX export complete");
  } catch (error) {
    if (error?.name !== "AbortError") showToast(error?.message || (language === "zh" ? "PPTX 导出失败" : "PPTX export failed"));
  } finally {
    button.innerHTML = original;
    button.disabled = slidesForDeck(deck).length === 0;
  }
}

async function downloadSlidesDocument(deck, format, button) {
  if (!slidesForDeck(deck).length || button.disabled) return;
  const config = { pdf:{ extension:"pdf", mime:"application/pdf", zh:"PDF", en:"PDF" }, images:{ extension:"zip", mime:"application/zip", zh:"逐页图片包", en:"page image package" }, "long-png":{ extension:"png", mime:"image/png", zh:"整套长图", en:"long image" } }[format];
  if (!config) return;
  const original = button.innerHTML; button.disabled = true; button.replaceChildren(slidesIcon("download"), document.createTextNode(language === "zh" ? "正在导出…" : "Exporting…"));
  try {
    await saveUrlWithPicker(apiPath(`/api/slides/${encodeURIComponent(deck.id)}/export/${format}`), `${downloadStem(slidesDeckDisplayName(deck))}.${config.extension}`, config.mime);
    showToast(language === "zh" ? `${config.zh}导出完成` : `${config.en} export complete`);
  } catch (error) {
    if (error?.name !== "AbortError") showToast(error?.message || (language === "zh" ? `${config.zh}导出失败` : `${config.en} export failed`));
  } finally { button.innerHTML = original; button.disabled = slidesForDeck(deck).length === 0; }
}

async function showSlidesExportCheck(deck, sourceButton = null) {
  const slides = slidesForDeck(deck); if (!slides.length) return;
  const structured = slides.filter((slide) => slide.type === "slide-frame").length;
  const html = slides.filter((slide) => slide.type === "html").length;
  const images = slides.length - structured - html;
  let fidelity = null;
  try {
    const response = await fetch(apiPath(`/api/slides/${encodeURIComponent(deck.id)}/pptx-check`));
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || (language === "zh" ? "无法完成导出检查" : "Could not complete export check"));
    fidelity = payload.fidelity;
  } catch (error) {
    showToast(error?.message || (language === "zh" ? "PPTX保真检查失败" : "PPTX fidelity check failed"));
    return;
  }
  const fidelityDiffs = Array.isArray(fidelity?.diffs) ? fidelity.diffs : [];
  const criticalIssues = new Set(["missing-input","unzip-failed","slide-count-mismatch","verification-error","missing-report","invalid-geometry","out-of-bounds","geometry-mismatch","invalid-font-size","font-size-mismatch","gradient-missing","rounded-geometry-missing","mask-missing","crop-missing","invalid-crop"]);
  const criticalCount = fidelityDiffs.filter((item) => criticalIssues.has(item?.issue)).length;
  const fidelitySummary = criticalCount
    ? (language === "zh" ? `保真检查发现 ${criticalCount} 项关键错误，当前不能导出。` : `Fidelity check found ${criticalCount} critical issue(s); export is blocked.`)
    : fidelityDiffs.length
      ? (language === "zh" ? `保真检查通过关键项，另有 ${fidelityDiffs.length} 项兼容性提醒。` : `Critical fidelity checks passed with ${fidelityDiffs.length} compatibility warning(s).`)
      : (language === "zh" ? "保真检查全部通过。" : "All fidelity checks passed.");
  if (criticalCount) { showToast(fidelitySummary); return; }
  const confirmed = await showConfirmDialog({
    title: language === "zh" ? "PPTX 导出兼容性检查" : "PPTX compatibility check",
    message: language === "zh"
      ? `${fidelitySummary}\n共 ${slides.length} 页：${structured} 个结构化页面可编辑，${images} 个图片页面将保持为图片，${html} 个 HTML 页面将以静态画面导出${html ? "，交互按钮和表单不会保留" : ""}。页面比例统一为 16:9。`
      : `${fidelitySummary}\n${slides.length} slides: ${structured} structured pages remain editable, ${images} image pages remain images, and ${html} HTML pages export as static visuals${html ? "; interactions will not be preserved" : ""}. All pages use 16:9.`,
    confirmText: language === "zh" ? "确认导出 PPTX" : "Export PPTX",
    cancelText: language === "zh" ? "返回检查" : "Go back"
  });
  if (!confirmed) return;
  const button = sourceButton || document.createElement("button");
  await downloadSlidesPptx(deck, button);
}

async function reorderDeckSlide(deck, fromIndex, toIndex) {
  if (slidesDeckHasActiveRegenerate(deck.id)) { showToast(language === "zh" ? "生成期间不能调整顺序" : "Cannot reorder during regeneration"); return; }
  const members = slidesForDeck(deck);
  if (!members.length || fromIndex === toIndex || fromIndex < 0 || fromIndex >= members.length || toIndex < 0 || toIndex >= members.length) return;
  const [moved] = members.splice(fromIndex, 1);
  members.splice(toIndex, 0, moved);
  const updates = [{ id: deck.id, patch: { slideIds: members.map((item) => item.id) } }];
  members.forEach((item, slideOrder) => updates.push({ id: item.id, patch: { slideDeckId: deck.id, slideOrder } }));
  await patchCanvasObjects(updates, selectionSnapshotForIds([moved.id]), currentCanvasScopeMeta());
  activeSlideIndexByDeck.set(deck.id, toIndex);
  await loadState();
  render();
}

function requestEmbeddedWebPage() {
  return requestEmbeddedWebPageWithOptions();
}

function requestEmbeddedWebPageWithOptions({ mode = "insert" } = {}) {
  return new Promise((resolve) => {
    const isReplace = mode === "replace";
    const title = language === "zh" ? (isReplace ? "更换网址" : "嵌入网页") : (isReplace ? "Replace URL" : "Embed a web page");
    const desc = language === "zh" ? (isReplace ? "输入新的网页地址以替换当前嵌入页面。" : "网页将作为新幻灯片中的可移动元素插入。") : (isReplace ? "Enter a new web address to replace the current embedded page." : "The page will be inserted as a movable element on a new slide.");
    const submitLabel = language === "zh" ? (isReplace ? "更换" : "插入为新页面") : (isReplace ? "Replace" : "Insert as new slide");
    const backdrop = document.createElement("div"); backdrop.className = "embed-web-dialog-backdrop";
    const dialog = document.createElement("section"); dialog.className = "embed-web-dialog"; dialog.setAttribute("role","dialog"); dialog.setAttribute("aria-modal","true"); dialog.setAttribute("aria-labelledby","embed-web-title");
    dialog.innerHTML = `<header><div><h2 id="embed-web-title">${title}</h2><p>${desc}</p></div><button type="button" data-embed-close aria-label="${language === "zh" ? "关闭" : "Close"}">×</button></header><label><span>${language === "zh" ? "网页地址" : "Web address"}</span><input type="url" inputmode="url" autocomplete="url" placeholder="https://example.com" aria-describedby="embed-web-help embed-web-error"></label><small id="embed-web-help">${language === "zh" ? "仅支持 HTTP 或 HTTPS。部分网站可能禁止在幻灯片中显示。" : "HTTP and HTTPS only. Some sites may block embedding."}</small><div id="embed-web-error" class="embed-web-error" role="alert" aria-live="polite"></div><footer><button type="button" data-embed-cancel>${language === "zh" ? "取消" : "Cancel"}</button><button type="button" class="primary" data-embed-submit>${submitLabel}</button></footer>`;
    backdrop.append(dialog); document.body.append(backdrop);
    const input = dialog.querySelector("input"); const error = dialog.querySelector(".embed-web-error"); const submit = dialog.querySelector("[data-embed-submit]");
    const close = (value = null) => { document.removeEventListener("keydown", keys, true); backdrop.remove(); resolve(value); };
    const normalizedUrl = () => { const raw = input.value.trim(); if (!raw) throw new Error(language === "zh" ? "请输入网页地址" : "Enter a web address"); const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`; const parsed = new URL(candidate); if (!["http:","https:"].includes(parsed.protocol)) throw new Error(language === "zh" ? "仅支持 HTTP 或 HTTPS 地址" : "Only HTTP or HTTPS addresses are supported"); return parsed.href; };
    const accept = () => { try { close(normalizedUrl()); } catch (cause) { error.textContent = cause.message; input.setAttribute("aria-invalid","true"); input.focus(); } };
    const keys = (event) => { if (event.key === "Escape") { event.preventDefault(); close(); } if (event.key === "Tab") { const controls = [...dialog.querySelectorAll("button,input")].filter((node) => !node.disabled); const first = controls[0]; const last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } };
    dialog.querySelector("[data-embed-close]").onclick = () => close(); dialog.querySelector("[data-embed-cancel]").onclick = () => close(); submit.onclick = accept;
    input.oninput = () => { error.textContent = ""; input.removeAttribute("aria-invalid"); }; input.onkeydown = (event) => { if (event.key === "Enter") { event.preventDefault(); accept(); } };
    backdrop.addEventListener("pointerdown", (event) => { if (event.target === backdrop) close(); }); document.addEventListener("keydown", keys, true); window.requestAnimationFrame(() => input.focus());
  });
}

async function addEmbeddedWebSlide(deck) {
  const url = await requestEmbeddedWebPage(); if (!url) return;
  const existing = slidesForDeck(deck);
  try {
    const response = await fetch(apiPath("/api/objects"), { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({
      type:"slide-frame", name:language === "zh" ? "嵌入网页" : "Embedded web page", x:deck.x + 12 + existing.length * 1056, y:deck.y + 12, width:1024, height:576, background:"#f4f5f7", templateId:"web-embed",
      elements:[{ id:`web-embed-${Date.now()}`, type:"web-embed", tag:"iframe", parentId:null, x:96, y:58, width:832, height:460, text:language === "zh" ? "嵌入网页" : "Embedded web page", src:url, locked:false, style:{ background:"#ffffff", border:"1px solid #d0d5dd", borderRadius:"16px", boxShadow:"0 18px 42px rgba(15,23,42,.16)" }, layout:{ mode:"free" } }]
    }) });
    const created = await response.json(); if (!response.ok) throw new Error(created.error || t("jobFailed"));
    state.objects.push(created);
    refreshKnownObjectIds();
    const slideIds = [...existing.map((slide) => slide.id), created.id];
    const payload = await patchCanvasObjects([{ id:deck.id, patch:{ slideIds } }, ...slideIds.map((id,slideOrder) => ({ id, patch:{ slideDeckId:deck.id, slideOrder } }))], selectionSnapshotForIds([created.id]), currentCanvasScopeMeta());
    replaceLocalObjects(payload.objects || []);
    refreshKnownObjectIds();
    canvasObjectRenderSignatures.delete(deck.id);
    activeSlideIndexByDeck.set(deck.id, slideIds.length - 1); slidesGeneratorOpenByDeck.delete(deck.id);
    render();
    const inserted = state.objects.find((object) => object.id === created.id); if (inserted) openSlideFrameEditor(inserted);
  } catch (error) { showToast(language === "zh" ? `网页插入失败：${error?.message || t("jobFailed")}` : `Could not embed page: ${error?.message || t("jobFailed")}`); }
}

function createSlidesAddMenu(deck) {
  const wrap = document.createElement("div"); wrap.className = "slides-deck-add-menu";
  const trigger = document.createElement("button"); trigger.type = "button"; trigger.className = "slides-deck-add"; trigger.setAttribute("aria-haspopup","menu"); trigger.setAttribute("aria-expanded","false"); trigger.append(slidesIcon("plus"), document.createTextNode(language === "zh" ? "添加幻灯片" : "Add slide"));
  const menu = document.createElement("div"); menu.className = "slides-deck-add-popover"; menu.hidden = true; menu.setAttribute("role","menu");
  const option = (icon, zh, en, action) => { const button = document.createElement("button"); button.type = "button"; button.role = "menuitem"; button.dataset.addSlideAction = action; const span = document.createElement("span"); span.textContent = language === "zh" ? zh : en; button.append(slidesIcon(icon), span); return button; };
  const selectedOption = option("plus", "添加已选内容", "Add selected content", "selected");
  selectedOption.classList.add("slides-deck-add-selected");
  selectedOption.dataset.deckId = deck.id;
  const candidates = selectedSlideCandidates(deck);
  updateAddSelectedSlidesButton(selectedOption, deck, candidates);
  menu.append(selectedOption, option("layout", "嵌入网页", "Embed web page", "web"));
  trigger.onclick = (event) => { event.stopPropagation(); menu.hidden = !menu.hidden; trigger.setAttribute("aria-expanded",String(!menu.hidden)); };
  menu.onclick = async (event) => { const action = event.target.closest("[data-add-slide-action]")?.dataset.addSlideAction; if (!action) return; event.stopPropagation(); menu.hidden = true; trigger.setAttribute("aria-expanded","false"); if (action === "selected") await addSelectedObjectsToSlides(deck.id); if (action === "web") await addEmbeddedWebSlide(deck); };
  wrap.addEventListener("pointerdown", (event) => event.stopPropagation()); wrap.append(trigger,menu); return wrap;
}

function updateAddSelectedSlidesButton(button, deck, candidates = selectedSlideCandidates(deck)) {
  const allSelected = selectedObjects().filter((item) => {
    const type = item.type || "image";
    return ["image", "html", "slide-frame"].includes(type) && item.slideDeckId !== deck.id;
  });
  const compatible = candidates.length;
  const total = allSelected.length;
  let text; let title;
  if (total === 0) {
    text = language === "zh" ? "添加已选内容" : "Add selected";
    title = language === "zh" ? "先在画布上选择 16:9 比例的图片" : "Select 16:9 images on the canvas first";
  } else if (compatible === 0) {
    text = language === "zh" ? `添加已选内容（0/${total}）` : `Add selected (0/${total})`;
    title = language === "zh" ? "选中的内容均不符合 16:9 比例，无法添加" : "Selected content is not 16:9 aspect ratio";
  } else if (compatible < total) {
    text = language === "zh" ? `添加已选内容（${compatible}/${total}）` : `Add selected (${compatible}/${total})`;
    title = language === "zh" ? `仅添加 ${compatible} 个符合 16:9 比例的内容` : `Only ${compatible} items match 16:9 aspect ratio`;
  } else {
    text = language === "zh" ? `添加已选内容（${compatible}）` : `Add selected (${compatible})`;
    title = language === "zh" ? "将画布中已选素材追加到此幻灯片组" : "Append selected canvas items to this deck";
  }
  button.querySelector("span").textContent = text;
  button.title = title;
  button.classList.toggle("has-selected", compatible > 0);
  button.classList.toggle("has-incompatible", total > 0 && compatible === 0);
}

function slidesIcon(name) {
  const paths = {
    presentation: ["M4 3h16", "M5 3v14h14V3", "M8 21l4-4 4 4", "M9 9h6", "M9 12h4"],
    play: ["M7 4v16l13-8z"], close: ["M18 6 6 18", "M6 6 18 18"], back: ["M19 12H5", "m12 19-7-7 7-7"],
    previous: ["m15 18-6-6 6-6"], next: ["m9 18 6-6-6-6"], "chevron-up": ["m18 15-6-6-6 6"], "chevron-down": ["m6 9 6 6 6-6"],
    layout: ["M4 5h16v14H4z", "M8 9h8", "M8 13h5"], plus: ["M12 5v14", "M5 12h14"],
    "move-up": ["M12 19V5", "m6 11 6-6 6 6"], "move-down": ["M12 5v14", "m18 13-6 6-6-6"],
    grip: ["M9 5h.01", "M9 12h.01", "M9 19h.01", "M15 5h.01", "M15 12h.01", "M15 19h.01"],
    trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 13h10l1-13", "M9 7V4h6v3"], lock: ["M6 10V7a6 6 0 0 1 12 0v3", "M5 10h14v11H5z"],
    download: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
    more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"], edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"], image:["M4 5h16v14H4z", "m4 10 3-3 3 3 4-4 3 3", "M9 9h.01"], chart:["M4 19V9", "M10 19V5", "M16 19v-7", "M22 19H2"], link:["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
    copy: ["M8 8h11v11H8z", "M5 16H4V4h12v1"], refresh: ["M20 11a8 8 0 1 0-2.34 5.66", "M20 4v7h-7"], history: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5", "M12 7v5l3 2"]
    ,undo: ["M9 7 4 12l5 5", "M4 12h9a7 7 0 0 1 7 7"], redo: ["m15 7 5 5-5 5", "M20 12h-9a7 7 0 0 0-7 7"], return: ["M9 10 5 14l4 4", "M5 14h8a6 6 0 0 0 6-6V5"], storyline: ["M6 5h8", "M14 5l4 4-4 4", "M18 9H9a3 3 0 0 0-3 3v1", "M6 13l4 4-4 4", "M10 17h8"], sparkles: ["m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5Z", "M5 3v4", "M3 5h4", "M19 17v4", "M17 19h4"], check: ["m5 12 4 4L19 6"], audience: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"], scenario: ["M5 4h14v16H5z", "M9 2v4", "M15 2v4", "M8 10h8"], palette: ["M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4 0c0-1.1.9-2 2-2h2a9 9 0 0 0 0-18Z", "M7.5 10h.01", "M10 6.5h.01", "M14 6.5h.01", "M16.5 10h.01"], bolt: ["m13 2-9 12h8l-1 8 9-12h-8z"], "zoom-out": ["M5 12h14", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"], "zoom-in": ["M12 8v8", "M8 12h8", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"],
    minus: ["M5 12h14"], bold: ["M7 5h6a3.5 3.5 0 0 1 0 7H7z", "M7 12h7a3.5 3.5 0 0 1 0 7H7z"],
    "align-left": ["M4 4v16", "M8 7h9", "M8 12h12", "M8 17h7"], "align-center": ["M12 3v18", "M7 7h10", "M5 12h14", "M8 17h8"], "align-right": ["M20 4v16", "M7 7h9", "M4 12h12", "M9 17h7"],
    rotate: ["M21 2v6h-6", "M21 13a9 9 0 1 1-3-7.7L21 8"], radius: ["M21 11a8 8 0 0 0-8-8H5v8", "M21 11v8a2 2 0 0 1-2 2h-8"], opacity: ["M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z", "M9 17.5a3.2 3.2 0 0 0 3 2.5"],
    text: ["M4 7V4h16v3", "M12 4v16", "M9 20h6"],
    shape: ["M3 3h8v8H3z", "M21 21a8 8 0 1 0-8-8", "M13 13l4 4"],
    table: ["M3 3h18v18H3z", "M3 9h18", "M3 15h18", "M9 3v18", "M15 3v18"]
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("slides-icon"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  for (const d of paths[name] || []) { const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", d); svg.append(path); }
  return svg;
}

function createSlidesMedia(slide, title, thumbnail = false, onBlankClick = null) {
  if (slide.type === "slide-frame") {
    const viewport = document.createElement("div");
    viewport.className = "slides-frame-viewport";
    viewport.append(createSlideFramePage(slide));
    const updateScale = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (!width || !height) return;
      viewport.style.setProperty("--slides-frame-scale", String(Math.min(width / 1024, height / 576)));
      viewport.classList.add("is-scale-ready");
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    window.requestAnimationFrame(updateScale);
    return viewport;
  }
  if (slide.type === "html") {
    const viewport = document.createElement("div");
    viewport.className = "slides-html-viewport";
    const iframe = document.createElement("iframe");
    let html = slide.html || "";
    if (onBlankClick) {
      const bridgeToken = `slides-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tokenLiteral = JSON.stringify(bridgeToken).replaceAll("<", "\\u003c");
      html += `<script>(()=>{const token=${tokenLiteral};const selector='a[href],button,input,select,textarea,summary,video,audio,canvas,[contenteditable="true"],[onclick],[role="button"],[role="link"],[role="menuitem"],[role="tab"]';document.addEventListener('click',(event)=>{let target=event.target?.nodeType===1?event.target:event.target?.parentElement;if(event.defaultPrevented||target?.closest?.(selector))return;for(let node=target;node&&node!==document.documentElement;node=node.parentElement){if(getComputedStyle(node).cursor==='pointer')return}parent.postMessage({type:'codex-canvas:slide-blank-click',token},'*')})})()</script>`;
      const messageHandler = (event) => {
        if (!iframe.isConnected) { window.removeEventListener("message", messageHandler); return; }
        if (event.source === iframe.contentWindow && event.data?.type === "codex-canvas:slide-blank-click" && event.data?.token === bridgeToken) onBlankClick();
      };
      window.addEventListener("message", messageHandler);
    }
    iframe.srcdoc = html; iframe.title = title; iframe.setAttribute("sandbox", "allow-scripts");
    if (thumbnail) iframe.tabIndex = -1;
    viewport.append(iframe);
    const updateScale = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (!width || !height) return;
      viewport.style.setProperty("--slides-html-scale", String(Math.min(width / 1024, height / 576)));
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    window.requestAnimationFrame(updateScale);
    return viewport;
  }
  const image = document.createElement("img"); image.src = assetUrl(slide.src, slide); image.alt = title; image.draggable = false; return image;
}

async function createSlideObject(type) {
  const center = screenToWorld(board.clientWidth / 2, board.clientHeight / 2);
  const payload = type === "slides"
    ? { type, name: language === "zh" ? "AI幻灯片" : "AI Slides", x: Math.round(center.x - 640), y: Math.round(center.y - 450), width: 1280, height: 900 }
    : { type, name: language === "zh" ? "嵌入 HTML" : "Embedded HTML", x: Math.round(center.x - 320), y: Math.round(center.y - 180), width: 640, height: 360 };
  const response = await fetch(apiPath("/api/objects"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const object = await response.json();
  if (!response.ok) { showToast(object.error || t("jobFailed")); return; }
  if (type === "slides") {
    setSlidesWorkspaceOpen(true);
    lastSlidesDeckId = object.id;
    localStorage.setItem("codex-canvas:last-slides-deck-id", object.id);
  }
  await loadState(); setLocalSelection(type === "slides" ? [] : [object.id], { fromUser: true }); render();
}

// CSS 动画映射（用于播放器和编辑器试播预览）
const ANIMATION_CSS_MAP = {
  entrance_fade:      { initial: { opacity: "0" }, final: { opacity: "1" } },
  entrance_appear:    { initial: { opacity: "0" }, final: { opacity: "1" }, forceDuration: 1 },
  entrance_fly_in:    { initial: { opacity: "0", transform: "translateX(-120%)" }, final: { opacity: "1", transform: "translateX(0)" } },
  entrance_wipe:      { initial: { clipPath: "inset(0 0 100% 0)" }, final: { clipPath: "inset(0 0 0 0)" } },
  entrance_zoom:      { initial: { opacity: "0", transform: "scale(0.3)" }, final: { opacity: "1", transform: "scale(1)" } },
  entrance_move:      { initial: { opacity: "0", transform: "translateX(-80px)" }, final: { opacity: "1", transform: "translateX(0)" } },
  emphasis_pulse:     { initial: { transform: "scale(1)" }, final: { transform: "scale(1.08)" }, restore: { transform: "scale(1)" } },
  emphasis_spin:      { initial: { transform: "rotate(0deg)" }, final: { transform: "rotate(360deg)" } },
  emphasis_bounce:    { initial: { transform: "translateY(0)" }, final: { transform: "translateY(-20px)" }, restore: { transform: "translateY(0)" } },
  emphasis_glow:      { initial: { boxShadow: "0 0 0 rgba(37,99,235,0)" }, final: { boxShadow: "0 0 20px rgba(37,99,235,0.6)" }, restore: { boxShadow: "none" } },
  emphasis_shake:     { initial: { transform: "translateX(0)" }, final: { transform: "translateX(6px)" }, restore: { transform: "translateX(0)" } },
  emphasis_accent:    { initial: { filter: "brightness(1)" }, final: { filter: "brightness(1.3)" }, restore: { filter: "brightness(1)" } },
  exit_fade_out:      { initial: { opacity: "1" }, final: { opacity: "0" } },
  exit_disappear:     { initial: { opacity: "1", transform: "scale(1)" }, final: { opacity: "0", transform: "scale(0)" } },
  exit_fly_out:       { initial: { opacity: "1", transform: "translateX(0)" }, final: { opacity: "0", transform: "translateX(120%)" } },
  exit_vanish:        { initial: { opacity: "1" }, final: { opacity: "0", transform: "scale(0.5)" } },
  exit_collapse:      { initial: { transform: "scale(1)", opacity: "1" }, final: { transform: "scale(0)", opacity: "0" } },
  exit_launch:        { initial: { transform: "translateY(0)", opacity: "1" }, final: { transform: "translateY(-200px)", opacity: "0" } }
};

function applyAnimationEffect(node, effect, duration) {
  const map = ANIMATION_CSS_MAP[effect];
  if (!node || !map) return;
  const dur = map.forceDuration != null ? map.forceDuration : Math.max(1, duration || 500);
  Object.assign(node.style, map.initial);
  node.style.transition = `opacity ${dur}ms ease, transform ${dur}ms ease, clip-path ${dur}ms ease`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    Object.assign(node.style, map.final);
    if (map.restore) setTimeout(() => Object.assign(node.style, map.restore), dur);
  }));
}

// 重置元素的动画相关样式，供试播重复使用
function resetAnimationStyles(shell) {
  shell.querySelectorAll("[data-slide-element-id]").forEach((node) => {
    node.style.opacity = "";
    node.style.transform = "";
    node.style.clipPath = "";
    node.style.transition = "";
  });
}

// 幻灯片动画预览控制器：按 order 排序 groups，按 on_click 分组，自动播放首组，后续组等 next() 触发
function playSlideAnimations(shell, slide) {
  const animation = slide?.animation;
  if (!animation || animation.preset === "none") return null;
  const groups = (Array.isArray(animation.groups) ? animation.groups : [])
    .filter((g) => g && g.elementId && g.effect)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!groups.length) return null;

  // 初始化：entrance 效果的元素先隐藏
  for (const g of groups) {
    const node = shell.querySelector(`[data-slide-element-id="${CSS.escape(g.elementId)}"]`);
    if (!node) continue;
    const map = ANIMATION_CSS_MAP[g.effect];
    if (map && g.effect.startsWith("entrance_")) Object.assign(node.style, map.initial);
  }

  // 按 on_click 分组：每组以 on_click 开头，后续 with_previous/after_previous 跟随
  const clickGroups = [];
  let current = [];
  for (const g of groups) {
    if (g.trigger === "on_click" && current.length) { clickGroups.push(current); current = [g]; }
    else current.push(g);
  }
  if (current.length) clickGroups.push(current);

  const playGroup = (group) => {
    let lastEnd = 0;
    for (const g of group) {
      const node = shell.querySelector(`[data-slide-element-id="${CSS.escape(g.elementId)}"]`);
      if (!node) continue;
      const map = ANIMATION_CSS_MAP[g.effect];
      const dur = map?.forceDuration != null ? map.forceDuration : Math.max(1, g.duration || 500);
      const delay = g.trigger === "after_previous" ? lastEnd + (g.delay || 0) : (g.delay || 0);
      setTimeout(() => applyAnimationEffect(node, g.effect, g.duration || 500), delay);
      lastEnd = Math.max(lastEnd, delay + dur);
    }
    return lastEnd;
  };

  // 自动播放第一组
  let clickIndex = 0;
  if (clickGroups.length) playGroup(clickGroups[clickIndex++]);

  return {
    next: () => {
      if (clickIndex < clickGroups.length) { playGroup(clickGroups[clickIndex++]); return true; }
      return false;
    }
  };
}

function openSlidesPresentation(deckId) {
  const deck = state.objects.find((item) => item.id === deckId && item.type === "slides");
  const slides = slidesForDeck(deck);
  if (!slides.length) { showToast(language === "zh" ? "请先将图片或 HTML 页面拖入 Slides" : "Add images or HTML pages first"); return; }
  let index = 0;
  let animationController = null;
  const overlay = document.createElement("div"); overlay.className = "slides-presentation"; overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-label", language === "zh" ? "AI幻灯片演示器" : "AI Slides viewer");
  const renderSlide = () => {
    const slide = slides[index];
    stage.replaceChildren();
    const shell = document.createElement("div"); shell.className = "slides-presentation-slide"; shell.append(createSlidesMedia(slide, `${language === "zh" ? "第" : "Slide "}${index + 1}${language === "zh" ? " 页" : ""}`, false, () => { if (overlay.classList.contains("is-presenting")) advance(); })); stage.append(shell);
    counter.textContent = `${index + 1} / ${slides.length}`;
    thumbs.querySelectorAll("button").forEach((button, i) => button.classList.toggle("active", i === index));
    previous.disabled = index === 0; next.disabled = index >= slides.length - 1;
    // 播放当前页的 CSS 动画预览
    animationController = playSlideAnimations(shell, slide);
  };
  const close = async () => { document.removeEventListener("keydown", keys); document.removeEventListener("fullscreenchange", fullscreenChanged); if (document.fullscreenElement === overlay) await document.exitFullscreen().catch(() => {}); overlay.remove(); };
  const advance = () => { if (animationController?.next()) return; if (index < slides.length - 1) go(1); else close(); };
  const go = (delta) => { index = Math.max(0, Math.min(slides.length - 1, index + delta)); renderSlide(); };
  const keys = (event) => { if (event.key === "Escape" && !document.fullscreenElement) close(); if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); advance(); } if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); } };
  const fullscreenChanged = () => overlay.classList.toggle("is-presenting", document.fullscreenElement === overlay);
  const top = document.createElement("header");
  const identity = document.createElement("div"); identity.className = "slides-presentation-identity";
  const closeButton = document.createElement("button"); closeButton.type = "button"; closeButton.className = "slides-presentation-icon-button"; closeButton.setAttribute("aria-label", language === "zh" ? "重新编辑" : "Back to editing"); closeButton.title = closeButton.getAttribute("aria-label"); closeButton.append(slidesIcon("back")); closeButton.onclick = close;
  const divider = document.createElement("span"); divider.className = "slides-presentation-divider";
  const deckName = document.createElement("strong"); deckName.textContent = slidesDeckDisplayName(deck); identity.append(closeButton, divider, deckName);
  const nav = document.createElement("nav"); nav.className = "slides-presentation-nav"; nav.setAttribute("aria-label", language === "zh" ? "翻页控制" : "Slide navigation");
  const previous = document.createElement("button"); previous.type = "button"; previous.setAttribute("aria-label", language === "zh" ? "上一页" : "Previous slide"); previous.append(slidesIcon("previous")); previous.onclick = () => go(-1);
  const counter = document.createElement("span");
  const next = document.createElement("button"); next.type = "button"; next.setAttribute("aria-label", language === "zh" ? "下一页" : "Next slide"); next.append(slidesIcon("next")); next.onclick = () => advance(); nav.append(previous, counter, next);
  const play = document.createElement("button"); play.type = "button"; play.className = "slides-presentation-play"; play.append(slidesIcon("play"), document.createTextNode(language === "zh" ? "播放" : "Play")); play.onclick = () => overlay.requestFullscreen?.().catch(() => overlay.classList.add("is-presenting")); top.append(identity, nav, play);
  const thumbs = document.createElement("aside"); thumbs.setAttribute("aria-label", language === "zh" ? "Slides 页面预览" : "Slide previews");
  slides.forEach((slide, i) => { const button = document.createElement("button"); button.type = "button"; button.setAttribute("aria-label", `${language === "zh" ? "跳转到第" : "Go to slide "}${i + 1}${language === "zh" ? " 页" : ""}`); const number = document.createElement("span"); number.textContent = String(i + 1); const thumb = document.createElement("span"); thumb.className = "slides-presentation-thumb-shell"; thumb.append(createSlidesMedia(slide, `${language === "zh" ? "第" : "Slide "}${i + 1}${language === "zh" ? " 页预览" : " preview"}`, true)); button.append(number, thumb); button.onclick = () => { index = i; renderSlide(); }; thumbs.append(button); });
  const stage = document.createElement("main"); stage.onclick = (event) => { if (overlay.classList.contains("is-presenting") && !event.target.closest("iframe,button")) advance(); };
  overlay.append(top, thumbs, stage); document.body.append(overlay); document.addEventListener("keydown", keys); document.addEventListener("fullscreenchange", fullscreenChanged); renderSlide();
}

function applyImageAnnotationMetadata(element, object) {
  const label = imageAnnotationLabel(object);
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", label);
  element.dataset.objectName = object.name || "Canvas image";
  if (object.assetPath) element.dataset.fileMention = `@${object.assetPath}`;
  if (object.assetPath) element.dataset.assetPath = object.assetPath;
  if (object.sourcePath) element.dataset.sourcePath = object.sourcePath;
}

function imageAnnotationLabel(object) {
  const parts = [
    `Codex-Canvas image`,
    `name: ${object.name || "Image"}`,
    `objectId: ${object.id}`,
    imageSizeLabel(object) ? `size: ${imageSizeLabel(object)}` : "",
    object.assetPath ? `@file: ${object.assetPath}` : "",
    object.sourcePath ? `source: ${object.sourcePath}` : ""
  ].filter(Boolean);
  return parts.join(" | ");
}

function applyImageCrop(image, object) {
  const crop = normalizedCrop(object);
  if (!crop) return;
  image.classList.add("cropped-image");
  image.style.width = `${100 / crop.width}%`;
  image.style.height = `${100 / crop.height}%`;
  image.style.transform = `translate(${-crop.x * 100}%, ${-crop.y * 100}%)`;
}

function normalizedCrop(object) {
  const crop = object?.crop;
  if (!crop || typeof crop !== "object") return null;
  const x = Number(crop.x);
  const y = Number(crop.y);
  const width = Number(crop.width);
  const height = Number(crop.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  const left = clamp(x, 0, 0.98);
  const top = clamp(y, 0, 0.98);
  const right = clamp(left + width, left + 0.01, 1);
  const bottom = clamp(top + height, top + 0.01, 1);
  if (left <= 0.0001 && top <= 0.0001 && right >= 0.9999 && bottom >= 0.9999) return null;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function renderCropOverlay(object) {
  const overlay = document.createElement("div");
  overlay.className = "crop-overlay";
  overlay.addEventListener("pointerdown", (event) => event.stopPropagation());

  const box = cropSessionBoxFor(object);
  for (const [className, style] of cropScrimRects(object, box)) {
    const scrim = document.createElement("div");
    scrim.className = `crop-scrim ${className}`;
    Object.assign(scrim.style, style);
    overlay.append(scrim);
  }

  const cropBox = document.createElement("div");
  cropBox.className = "crop-box";
  cropBox.style.left = `${box.x}px`;
  cropBox.style.top = `${box.y}px`;
  cropBox.style.width = `${box.width}px`;
  cropBox.style.height = `${box.height}px`;
  cropBox.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, .crop-handle")) return;
    startCropDrag(event, "move");
  });

  for (const direction of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
    const handle = document.createElement("div");
    handle.className = `crop-handle crop-${direction}`;
    handle.dataset.crop = direction;
    handle.addEventListener("pointerdown", (event) => startCropDrag(event, direction));
    cropBox.append(handle);
  }

  const actions = document.createElement("div");
  actions.className = "crop-actions";
  const apply = document.createElement("button");
  apply.type = "button";
  apply.textContent = t("cropApply");
  apply.addEventListener("click", applyCropSession);
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "secondary-action";
  cancel.textContent = t("cancel");
  cancel.addEventListener("click", cancelCropSession);
  actions.append(cancel, apply);
  cropBox.append(actions);
  overlay.append(cropBox);
  return overlay;
}

function cropScrimRects(object, box) {
  return [
    ["top", { left: "0px", top: "0px", width: `${object.width}px`, height: `${box.y}px` }],
    ["right", { left: `${box.x + box.width}px`, top: `${box.y}px`, width: `${object.width - box.x - box.width}px`, height: `${box.height}px` }],
    ["bottom", { left: "0px", top: `${box.y + box.height}px`, width: `${object.width}px`, height: `${object.height - box.y - box.height}px` }],
    ["left", { left: "0px", top: `${box.y}px`, width: `${box.x}px`, height: `${box.height}px` }]
  ];
}

function cropSessionBoxFor(object) {
  if (!cropSession || cropSession.objectId !== object.id) return defaultCropBox(object);
  return clampCropBox(cropSession.box, object);
}

function defaultCropBox(object) {
  const insetX = Math.round(Math.min(42, Math.max(12, object.width * 0.12)));
  const insetY = Math.round(Math.min(42, Math.max(12, object.height * 0.12)));
  return clampCropBox({
    x: insetX,
    y: insetY,
    width: object.width - insetX * 2,
    height: object.height - insetY * 2
  }, object);
}

function renderResizeHandles(object) {
  const fragment = document.createDocumentFragment();
  const label = object.type === "text" ? "调整文字大小" : "调整图片大小";
  for (const direction of ["nw", "ne", "se", "sw"]) {
    const handle = document.createElement("div");
    handle.className = `resize-handle resize-${direction}`;
    handle.dataset.resize = direction;
    handle.title = label;
    handle.setAttribute("aria-hidden", "true");
    handle.addEventListener("pointerdown", (event) => startResize(event, object, direction));
    fragment.append(handle);
  }
  return fragment;
}

function startDrag(event, object, options = {}) {
  if (event.button !== 0 || event.isPrimary === false) return;
  event.preventDefault();
  event.stopPropagation();
  const element = options.element || event.currentTarget;
  const isExpandPreviewDrag = quickEditAction === "expand"
    && quickEditObjectId === object.id
    && !quickEditComposer.hidden
    && !options.forceGroup;
  const isMultiSelectionDrag = !options.forceGroup && selectedIds.size > 1 && selectedIds.has(object.id);
  const isolatedObject = state.objects.find((item) => item.id === isolatedLayerSelectionId);
  const isLayerIsolationClick = !options.forceGroup
    && isolatedObject?.layerGroupId
    && object.id === isolatedObject.id
    && object.layerGroupId === isolatedObject.layerGroupId;
  const useLayerGroup = object.layerGroupId
    && !isLayerIsolationClick
    && (options.forceGroup || object.layerGroupLocked);
  const groupMembers = useLayerGroup ? layerGroupMembers(object.layerGroupId) : [];
  const multiMembers = isMultiSelectionDrag ? selectedObjects() : [];
  if (element.setPointerCapture) {
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Continue with window-level pointer listeners if capture is unavailable.
    }
  }
  if (!isMultiSelectionDrag) {
    const isToggleSelect = (event.shiftKey || event.metaKey || event.ctrlKey) && !useLayerGroup && !isLayerIsolationClick;
    if (isToggleSelect) {
      const currentIds = new Set(selectedIds);
      if (currentIds.has(object.id)) currentIds.delete(object.id);
      else currentIds.add(object.id);
      setLocalSelection([...currentIds], { fromUser: true });
      updateSelectionClasses();
      updateSelectionUi();
    } else if (useLayerGroup) {
      setLocalSelection(groupMembers.map((member) => member.id), { fromUser: true });
    } else {
      setLocalSelection([object.id], {
        fromUser: true,
        isolateLayer: isLayerIsolationClick
      });
    }
  }
  element.classList.add("selected");
  // Persist the pointer in world coordinates.  A client-pixel delta is usually
  // equivalent, but it drifts when the board has an offset or the viewport is
  // being scaled, which was especially visible on the large AI Slides surface.
  const startWorld = pointerToWorld(event);
  drag = {
    id: object.id,
    groupId: useLayerGroup ? object.layerGroupId : null,
    expandPreview: isExpandPreviewDrag ? {
      frame: expandPreviewRect(object)
    } : null,
    multiIds: isMultiSelectionDrag ? multiMembers.map((item) => item.id) : [],
    multiMembers: multiMembers.map((item) => ({ id: item.id, x: item.x, y: item.y })),
    members: groupMembers.map((item) => ({ id: item.id, x: item.x, y: item.y })),
    element,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startWorld,
    objectX: object.x,
    objectY: object.y,
    selectionBefore: captureSelectionSnapshot(),
    scopeMeta: currentCanvasScopeMeta(),
    moved: false
  };
  updateSelectionUi();
  fetch(apiPath("/api/selection"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selection: selectedId })
  }).catch(() => {});

  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag, { once: true });
  window.addEventListener("pointercancel", endDrag, { once: true });
}

function moveDrag(event) {
  if (!drag) return;
  const pointerDistance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
  if (!drag.moved && pointerDistance < 4) return;
  if (!drag.moved) {
    drag.moved = true;
    drag.element.classList.add("dragging");
  }
  const pointerWorld = pointerToWorld(event);
  const dx = Math.round(pointerWorld.x - drag.startWorld.x);
  const dy = Math.round(pointerWorld.y - drag.startWorld.y);
  if (drag.expandPreview) {
    const object = state.objects.find((item) => item.id === drag.id);
    if (!object) return;
    const frame = drag.expandPreview.frame;
    object.x = clamp(Math.round(drag.objectX + dx), frame.x, frame.x + frame.width - object.width);
    object.y = clamp(Math.round(drag.objectY + dy), frame.y, frame.y + frame.height - object.height);
    drag.element.style.left = `${object.x}px`;
    drag.element.style.top = `${object.y}px`;
  } else if (drag.multiMembers?.length) {
    for (const memberStart of drag.multiMembers) {
      const member = state.objects.find((item) => item.id === memberStart.id);
      if (!member) continue;
      member.x = memberStart.x + dx;
      member.y = memberStart.y + dy;
      const memberElement = objectLayer.querySelector(`[data-id="${member.id}"]`);
      if (memberElement) {
        memberElement.style.left = `${member.x}px`;
        memberElement.style.top = `${member.y}px`;
      }
    }
  } else if (drag.groupId) {
    for (const memberStart of drag.members) {
      const member = state.objects.find((item) => item.id === memberStart.id);
      if (!member) continue;
      member.x = memberStart.x + dx;
      member.y = memberStart.y + dy;
      const memberElement = objectLayer.querySelector(`[data-id="${member.id}"]`);
      if (memberElement) {
        memberElement.style.left = `${member.x}px`;
        memberElement.style.top = `${member.y}px`;
      }
    }
  } else {
    const object = state.objects.find((item) => item.id === drag.id);
    if (!object) return;
    object.x = Math.round(drag.objectX + dx);
    object.y = Math.round(drag.objectY + dy);
    drag.element.style.left = `${object.x}px`;
    drag.element.style.top = `${object.y}px`;
  }
  updateLayerGroupSelectionElement(drag.groupId || selectedLayerGroupId());
  updateVersionDiffOverlayElement();
  updateExpandPreviewElement();
  updateSelectionUi();
}

function updateExpandPreviewElement() {
  const element = objectLayer.querySelector(".expand-preview-frame");
  if (!element) return;
  const nextElement = renderExpandPreviewFrame();
  if (nextElement) element.replaceWith(nextElement);
  else element.remove();
}

function updateVersionDiffOverlayElement() {
  const element = objectLayer.querySelector(".version-diff-overlay");
  if (!element) return;
  versionDiffHeatmapToken += 1;
  const nextElement = renderVersionDiffOverlay();
  if (nextElement) element.replaceWith(nextElement);
  else element.remove();
}

async function endDrag(event) {
  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
  if (!drag) return;
  const activeDrag = drag;
  const object = state.objects.find((item) => item.id === activeDrag.id);
  const element = activeDrag.element;
  element.classList.remove("dragging");
  if (element.releasePointerCapture) {
    try {
      element.releasePointerCapture(activeDrag.pointerId);
    } catch {
      // Pointer capture may already be gone after cancellation.
    }
  }
  drag = null;
  const before = activeDrag.multiMembers?.length
    ? activeDrag.multiMembers.map((item) => ({ id: item.id, patch: { x: item.x, y: item.y } }))
    : activeDrag.groupId
      ? activeDrag.members.map((item) => ({ id: item.id, patch: { x: item.x, y: item.y } }))
      : [{ id: activeDrag.id, patch: { x: activeDrag.objectX, y: activeDrag.objectY } }];
  const after = before.map((update) => {
    const member = state.objects.find((item) => item.id === update.id);
    return {
      id: update.id,
      patch: { x: member?.x ?? update.patch.x, y: member?.y ?? update.patch.y }
    };
  });
  if (event?.type === "pointercancel") {
    applyObjectPatchesLocally(before);
    render();
    return;
  }
  if (!objectUpdatesChanged(before, after)) {
    updateSelectionUi();
    return;
  }
  if (activeDrag.expandPreview) {
    updateExpandPreviewPosition();
    updateSelectionUi();
    return;
  }
  if (object || activeDrag.multiMembers?.length || activeDrag.groupId) {
    const isDeckDropCandidate = object && ["image", "html", "slide-frame"].includes(object.type || "image")
      && !activeDrag.groupId;
    const droppedDeck = isDeckDropCandidate
      ? findSlidesDeckAtPoint(object.x + object.width / 2, object.y + object.height / 2)
      : null;
    if (droppedDeck) {
      // Dropped on a slides deck: keep canvas objects in place, only sync deck membership
      applyObjectPatchesLocally(before);
      render();
      if (activeDrag.multiMembers?.length) {
        const members = activeDrag.multiMembers
          .map((m) => state.objects.find((o) => o.id === m.id))
          .filter((o) => o && ["image", "html", "slide-frame"].includes(o.type || "image"));
        await syncMultiSlideDeckMembershipAfterDrop(members, droppedDeck);
      } else {
        const revertedObject = state.objects.find((item) => item.id === activeDrag.id);
        await syncSlideDeckMembershipAfterDrop(revertedObject, droppedDeck);
      }
    } else {
      await commitObjectUpdateHistory({
        before,
        after,
        selectionBefore: activeDrag.selectionBefore,
        selectionAfter: captureSelectionSnapshot(),
        scopeMeta: activeDrag.scopeMeta
      });
      // Notify workflow that canvas objects have moved
      window.dispatchEvent(new CustomEvent("codex-canvas:object-updated", {
        detail: { objectId: activeDrag.id }
      }));
      if (object && ["image", "html", "slide-frame"].includes(object.type || "image")) await syncSlideDeckMembershipAfterDrop(object);
    }
  }
}

function findSlidesDeckAtPoint(x, y) {
  return state.objects
    .filter((item) => {
      if (item.type !== "slides") return false;
      const geometry = canvasObjectGeometry(item);
      return x >= item.x && x <= item.x + geometry.width
        && y >= item.y && y <= item.y + geometry.height;
    })
    .sort((left, right) => {
      const leftGeometry = canvasObjectGeometry(left);
      const rightGeometry = canvasObjectGeometry(right);
      return leftGeometry.width * leftGeometry.height - rightGeometry.width * rightGeometry.height;
    })[0] || null;
}

async function syncMultiSlideDeckMembershipAfterDrop(objects, targetDeck) {
  if (!objects.length || !targetDeck) return;
  const existing = slidesForDeck(targetDeck).filter((item) => !objects.some((o) => o.id === item.id));
  const activeIndex = existing.length ? Math.min(activeSlideIndexByDeck.get(targetDeck.id) ?? (existing.length - 1), existing.length - 1) : -1;
  const insertAt = Math.min(existing.length, Math.max(0, activeIndex + 1));
  const members = [...existing.slice(0, insertAt), ...objects, ...existing.slice(insertAt)];
  const updates = [{ id: targetDeck.id, patch: { slideIds: members.map((item) => item.id) } }];
  members.forEach((item, slideOrder) => updates.push({ id: item.id, patch: { slideDeckId: targetDeck.id, slideOrder } }));
  try {
    const payload = await patchCanvasObjects(updates, captureSelectionSnapshot(), currentCanvasScopeMeta());
    replaceLocalObjects(payload.objects || []);
    refreshKnownObjectIds();
    canvasObjectRenderSignatures.delete(targetDeck.id);
    slidesGeneratorOpenByDeck.delete(targetDeck.id);
    activeSlideIndexByDeck.set(targetDeck.id, insertAt);
    render();
    showToast(language === "zh" ? `已添加 ${objects.length} 张幻灯片` : `Added ${objects.length} slide${objects.length === 1 ? "" : "s"}`);
  } catch (error) {
    await loadState(); render(); showToast(error?.message || t("jobFailed"));
  }
}

async function syncSlideDeckMembershipAfterDrop(object, targetDeckOverride = null) {
  const center = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
  const targetDeck = targetDeckOverride || findSlidesDeckAtPoint(center.x, center.y);
  const legacyDeck = state.objects.find((item) => item.type === "slides" && (item.slideIds || []).includes(object.id));
  const previousDeck = state.objects.find((item) => item.id === object.slideDeckId) || legacyDeck || null;
  if (!targetDeck && !previousDeck) return;
  // Once a canvas object is part of a deck, clicking it or moving it elsewhere on
  // the canvas must not silently remove its slide. Removal is intentionally tied
  // to the explicit Delete/Backspace object action; deck-to-deck moves still work.
  if (previousDeck && !targetDeck) return;

  const affectedDecks = new Map();
  let insertedIndex = -1;
  if (previousDeck) affectedDecks.set(previousDeck.id, slidesForDeck(previousDeck).filter((item) => item.id !== object.id));
  if (targetDeck) {
    const members = slidesForDeck(targetDeck).filter((item) => item.id !== object.id);
    const activeIndex = members.length ? Math.min(activeSlideIndexByDeck.get(targetDeck.id) ?? (members.length - 1), members.length - 1) : -1;
    const insertAt = Math.min(members.length, Math.max(0, activeIndex + 1));
    members.splice(insertAt, 0, object);
    affectedDecks.set(targetDeck.id, members);
    insertedIndex = insertAt;
  }

  const updates = [];
  for (const [deckId, members] of affectedDecks) {
    updates.push({ id: deckId, patch: { slideIds: members.map((item) => item.id) } });
    members.forEach((item, slideOrder) => updates.push({ id: item.id, patch: { slideDeckId: deckId, slideOrder } }));
  }
  try {
    const payload = await patchCanvasObjects(updates, captureSelectionSnapshot(), currentCanvasScopeMeta());
    replaceLocalObjects(payload.objects || []);
    refreshKnownObjectIds();
    if (targetDeck) {
      slidesGeneratorOpenByDeck.delete(targetDeck.id);
      if (insertedIndex >= 0) activeSlideIndexByDeck.set(targetDeck.id, insertedIndex);
    }
    render();
    showToast(language === "zh" ? "已加入 AI幻灯片" : "Added to AI Slides");
  } catch (error) {
    await loadState(); render(); showToast(error?.message || t("jobFailed"));
  }
}

function startResize(event, object, direction) {
  event.preventDefault();
  event.stopPropagation();
  const element = event.currentTarget.closest(".canvas-object");
  if (object.type === "text" && element) {
    element.dataset.autoWidth = "false";
    object._autoWidth = "false";
  }
  setLocalSelection([object.id], { fromUser: true });
  element?.classList.add("resizing");
  resize = {
    id: object.id,
    element,
    direction,
    startX: event.clientX,
    startY: event.clientY,
    objectX: object.x,
    objectY: object.y,
    objectWidth: object.width,
    objectHeight: object.height,
    aspectRatio: object.width / Math.max(1, object.height),
    preserveAspect: object.type !== "text",
    anchorX: direction.includes("w") ? object.x + object.width : object.x,
    anchorY: direction.includes("n") ? object.y + object.height : object.y,
    selectionBefore: captureSelectionSnapshot(),
    scopeMeta: currentCanvasScopeMeta()
  };
  fetch(apiPath("/api/selection"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selection: object.id })
  }).catch(() => {});

  window.addEventListener("pointermove", moveResize);
  window.addEventListener("pointerup", endResize, { once: true });
  window.addEventListener("pointercancel", endResize, { once: true });
}

function moveResize(event) {
  if (!resize) return;
  const object = state.objects.find((item) => item.id === resize.id);
  if (!object) return;

  const dx = (event.clientX - resize.startX) / viewport.zoom;
  const dy = (event.clientY - resize.startY) / viewport.zoom;
  const next = resizedImageRect(resize, dx, dy);
  Object.assign(object, next);

  if (resize.element) {
    resize.element.style.left = `${object.x}px`;
    resize.element.style.top = `${object.y}px`;
    resize.element.style.width = `${object.width}px`;
    resize.element.style.height = `${object.height}px`;
  }
  updateSelectionUi();
}

function endResize(event) {
  window.removeEventListener("pointermove", moveResize);
  window.removeEventListener("pointerup", endResize);
  window.removeEventListener("pointercancel", endResize);
  if (!resize) return;
  const activeResize = resize;
  const object = state.objects.find((item) => item.id === activeResize.id);
  activeResize.element?.classList.remove("resizing");
  resize = null;
  if (!object) return;
  const before = [{
    id: object.id,
    patch: {
      x: activeResize.objectX,
      y: activeResize.objectY,
      width: activeResize.objectWidth,
      height: activeResize.objectHeight
    }
  }];
  const after = [{
    id: object.id,
    patch: { x: object.x, y: object.y, width: object.width, height: object.height }
  }];
  if (event?.type === "pointercancel") {
    applyObjectPatchesLocally(before);
    render();
    return;
  }
  commitObjectUpdateHistory({
    before,
    after,
    selectionBefore: activeResize.selectionBefore,
    selectionAfter: captureSelectionSnapshot(),
    scopeMeta: activeResize.scopeMeta
  });
  // Notify workflow that canvas object has been resized
  window.dispatchEvent(new CustomEvent("codex-canvas:object-updated", {
    detail: { objectId: activeResize.id }
  }));
}

function resizedImageRect(start, dx, dy) {
  const direction = start.direction;
  const minSize = 48;
  let width = start.objectWidth;
  let height = start.objectHeight;

  if (direction.includes("e")) width = start.objectWidth + dx;
  if (direction.includes("w")) width = start.objectWidth - dx;
  if (direction.includes("s")) height = start.objectHeight + dy;
  if (direction.includes("n")) height = start.objectHeight - dy;

  if (start.preserveAspect !== false) {
    const ratio = Number.isFinite(start.aspectRatio) && start.aspectRatio > 0 ? start.aspectRatio : 1;
    const widthFromHeight = height * ratio;
    const heightFromWidth = width / ratio;
    if (direction.length === 1 && (direction === "n" || direction === "s")) {
      width = widthFromHeight;
    } else if (direction.length === 1) {
      height = heightFromWidth;
    } else if (Math.abs(width - start.objectWidth) / Math.max(1, start.objectWidth) >= Math.abs(height - start.objectHeight) / Math.max(1, start.objectHeight)) {
      height = heightFromWidth;
    } else {
      width = widthFromHeight;
    }
    height = width / ratio;
    if (height < minSize) {
      height = minSize;
      width = height * ratio;
    }
  }

  width = Math.max(minSize, width);
  height = Math.max(minSize, height);
  width = Math.round(width);
  height = Math.round(height);

  let x = start.objectX;
  let y = start.objectY;
  if (direction.includes("w")) x = start.anchorX - width;
  else if (direction.includes("e")) x = start.anchorX;
  else x = start.objectX + (start.objectWidth - width) / 2;

  if (direction.includes("n")) y = start.anchorY - height;
  else if (direction.includes("s")) y = start.anchorY;
  else y = start.objectY + (start.objectHeight - height) / 2;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width,
    height
  };
}

function startCropMode() {
  const object = state.objects.find((item) => item.id === selectedId);
  if (!object || (object.type || "image") !== "image" || !hasUserSelection) return;
  closeQuickEdit({ keepPrompt: true });
  beginImageEdit("crop", object.id);
  cropSession = {
    objectId: object.id,
    box: defaultCropBox(object)
  };
  render();
}

function cancelCropSession(event) {
  event?.preventDefault();
  event?.stopPropagation();
  cropSession = null;
  cropDrag = null;
  endImageEdit();
  render();
}

function applyCropSession(event) {
  event?.preventDefault();
  event?.stopPropagation();
  if (!cropSession) return;
  const object = state.objects.find((item) => item.id === cropSession.objectId);
  if (!object) {
    cancelCropSession();
    return;
  }

  const box = clampCropBox(cropSession.box, object);
  const previousCrop = normalizedCrop(object) || { x: 0, y: 0, width: 1, height: 1 };
  const crop = normalizeCropPatch({
    x: previousCrop.x + previousCrop.width * (box.x / object.width),
    y: previousCrop.y + previousCrop.height * (box.y / object.height),
    width: previousCrop.width * (box.width / object.width),
    height: previousCrop.height * (box.height / object.height)
  });
  const scopeMeta = currentCanvasScopeMeta();
  const selectionBefore = captureSelectionSnapshot();

  return canvasHistory.commit(async () => {
    try {
      const dataUrl = await renderCroppedImageDataUrl(object, crop);
      const croppedWidth = Math.max(1, Math.round(box.width));
      const croppedHeight = Math.max(1, Math.round(box.height));
      const response = await fetch(apiPath("/api/images"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(withExpectedCanvasScope({
          dataUrl,
          name: croppedImageName(object),
          prompt: `Cropped from ${object.name || object.id}`,
          layoutMode: "canvas-row",
          sourceObjectId: object.id,
          x: Math.round(object.x + object.width + 72),
          y: Math.round(object.y),
          width: croppedWidth,
          height: croppedHeight
        }, scopeMeta))
      });
      const croppedObject = await response.json();
      if (!response.ok) throw new Error(croppedObject.error || t("jobFailed"));
      const index = state.objects.length;
      state.objects.push(croppedObject);
      cropSession = null;
      cropDrag = null;
      endImageEdit();
      setLocalSelection([croppedObject.id], { fromUser: true });
      refreshKnownObjectIds();
      render();
      return {
        action: {
          type: "create",
          entries: [{ object: cloneCanvasObject(croppedObject), index }],
          selectionBefore,
          selectionAfter: selectionSnapshotForIds([croppedObject.id]),
          scopeMeta
        }
      };
    } catch (error) {
      showToast(error?.message || t("jobFailed"));
      return null;
    }
  });
}

async function renderCroppedImageDataUrl(object, crop) {
  const image = await loadImageForCanvas(assetUrl(object.src, object));
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceX = Math.round(crop.x * sourceWidth);
  const sourceY = Math.round(crop.y * sourceHeight);
  const sourceCropWidth = Math.max(1, Math.round(crop.width * sourceWidth));
  const sourceCropHeight = Math.max(1, Math.round(crop.height * sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = sourceCropWidth;
  canvas.height = sourceCropHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(t("jobFailed"));
  context.drawImage(image, sourceX, sourceY, sourceCropWidth, sourceCropHeight, 0, 0, sourceCropWidth, sourceCropHeight);
  return canvas.toDataURL("image/png");
}

function loadImageForCanvas(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(t("jobFailed")));
    image.src = src;
  });
}

function croppedImageName(object) {
  const name = String(object.name || "cropped-image").trim() || "cropped-image";
  const withoutExtension = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  return `${withoutExtension}-crop.png`;
}

function normalizeCropPatch(crop) {
  const left = clamp(crop.x, 0, 0.98);
  const top = clamp(crop.y, 0, 0.98);
  const right = clamp(left + crop.width, left + 0.01, 1);
  const bottom = clamp(top + crop.height, top + 0.01, 1);
  return {
    x: Number(left.toFixed(4)),
    y: Number(top.toFixed(4)),
    width: Number((right - left).toFixed(4)),
    height: Number((bottom - top).toFixed(4))
  };
}

function startCropDrag(event, direction) {
  if (!cropSession) return;
  event.preventDefault();
  event.stopPropagation();
  const object = state.objects.find((item) => item.id === cropSession.objectId);
  if (!object) return;
  cropDrag = {
    direction,
    objectId: object.id,
    startX: event.clientX,
    startY: event.clientY,
    objectWidth: object.width,
    objectHeight: object.height,
    box: { ...cropSession.box }
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", moveCropDrag);
  window.addEventListener("pointerup", endCropDrag, { once: true });
  window.addEventListener("pointercancel", endCropDrag, { once: true });
}

function moveCropDrag(event) {
  if (!cropDrag || !cropSession) return;
  const object = state.objects.find((item) => item.id === cropDrag.objectId);
  if (!object) return;
  const dx = Math.round((event.clientX - cropDrag.startX) / viewport.zoom);
  const dy = Math.round((event.clientY - cropDrag.startY) / viewport.zoom);
  cropSession.box = cropBoxFromDrag(cropDrag, dx, dy);
  updateCropOverlayElement(object);
}

function endCropDrag() {
  window.removeEventListener("pointermove", moveCropDrag);
  window.removeEventListener("pointerup", endCropDrag);
  window.removeEventListener("pointercancel", endCropDrag);
  cropDrag = null;
}

function cropBoxFromDrag(start, dx, dy) {
  const direction = start.direction;
  const box = { ...start.box };
  if (direction === "move") {
    box.x += dx;
    box.y += dy;
    return clampCropBox(box, { width: start.objectWidth, height: start.objectHeight });
  }
  if (direction.includes("w")) {
    box.x += dx;
    box.width -= dx;
  }
  if (direction.includes("e")) box.width += dx;
  if (direction.includes("n")) {
    box.y += dy;
    box.height -= dy;
  }
  if (direction.includes("s")) box.height += dy;
  return clampCropBox(box, { width: start.objectWidth, height: start.objectHeight });
}

function clampCropBox(box, object) {
  const minSize = Math.min(48, Math.max(24, Math.floor(Math.min(object.width, object.height) / 2)));
  let width = Math.max(minSize, Math.round(box.width));
  let height = Math.max(minSize, Math.round(box.height));
  width = Math.min(width, Math.max(minSize, object.width));
  height = Math.min(height, Math.max(minSize, object.height));
  const x = clamp(Math.round(box.x), 0, Math.max(0, object.width - width));
  const y = clamp(Math.round(box.y), 0, Math.max(0, object.height - height));
  return { x, y, width, height };
}

function updateCropOverlayElement(object) {
  const element = objectLayer.querySelector(`.canvas-object[data-id="${CSS.escape(object.id)}"] .crop-overlay`);
  if (!element) return;
  element.replaceWith(renderCropOverlay(object));
}

async function selectObject(id, { fromUser = false, renderNow = true } = {}) {
  setLocalSelection(id ? [id] : [], { fromUser });
  if (editingTextId && editingTextId !== id) editingTextId = null;
  if (renderNow) render();
  else updateSelectionUi();
  await fetch(apiPath("/api/selection"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selection: id })
  });
}

function setLocalSelection(ids, { fromUser = true, isolateLayer = false } = {}) {
  const nextIds = ids.filter(Boolean);
  workflowSelectionObjectId = null;
  workflowSelectionObjectIds = [];
  workflowSelectionGrouped = false;
  workflowSelectionBounds = null;
  workflowSelectionExport = null;
  if (cropSession && (nextIds.length !== 1 || nextIds[0] !== cropSession.objectId)) {
    cropSession = null;
    cropDrag = null;
  }
  if (versionDiffOverlay && !sameIdSet(nextIds, versionDiffOverlay.ids || [])) {
    versionDiffOverlay = null;
  }
  selectedIds = new Set(nextIds);
  selectedId = nextIds.length === 1 ? nextIds[0] : null;
  isolatedLayerSelectionId = isolateLayer && nextIds.length === 1 ? nextIds[0] : null;
  hasUserSelection = nextIds.length > 0 && fromUser;
  if (state) state.selection = selectedId;
  window.dispatchEvent(new CustomEvent("codex-canvas:selection-changed", {
    detail: { objectIds: [...nextIds], fromUser }
  }));
}

function updateObjectExportSettings(resolution, format) {
  if (!state || !state.objects) return;
  
  const targetIds = selectedIds.size > 0 ? [...selectedIds] : (selectedId ? [selectedId] : []);
  const targets = state.objects.filter((obj) => targetIds.includes(obj.id) && (obj.type || "image") === "image");
  
  if (!targets.length) return;

  const validResolution = SUPPORTED_EXPORT_RESOLUTIONS.includes(resolution) ? resolution : DEFAULT_EXPORT_RESOLUTION;
  const validFormat = SUPPORTED_EXPORT_FORMATS.includes(format) ? format : DEFAULT_EXPORT_FORMAT;

  for (const object of targets) {
    object.exportResolution = validResolution;
    object.exportFormat = validFormat;
  }

  // Persist to server
  fetch(apiPath("/api/objects/export-settings"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      objectIds: targetIds,
      exportResolution: validResolution,
      exportFormat: validFormat
    })
  }).catch(() => {});

  updateSelectionUi();
}

function sameIdSet(left, right) {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return right.every((id) => leftSet.has(id));
}

function selectedObjectIds() {
  if (!hasUserSelection) return new Set();
  if (selectedIds.size) return selectedIds;
  return selectedId ? new Set([selectedId]) : new Set();
}

function selectedObjects() {
  const ids = selectedObjectIds();
  return state?.objects.filter((object) => ids.has(object.id)) || [];
}

function startMarqueeSelection(event) {
  event.preventDefault();
  closeQuickEdit({ keepPrompt: true });
  const imageMarquee = event.shiftKey;
  setLocalSelection([]);
  render();
  board.setPointerCapture(event.pointerId);

  const start = pointerToWorld(event);
  const element = document.createElement("div");
  element.className = "marquee-selection";
  element.hidden = true;
  objectLayer.append(element);

  marquee = {
    pointerId: event.pointerId,
    start,
    current: start,
    startClientX: event.clientX,
    startClientY: event.clientY,
    element,
    moved: false,
    imageMarquee
  };

  board.addEventListener("pointermove", moveMarqueeSelection);
  board.addEventListener("pointerup", endMarqueeSelection, { once: true });
  board.addEventListener("pointercancel", cancelMarqueeSelection, { once: true });
}

function moveMarqueeSelection(event) {
  if (!marquee) return;
  marquee.current = pointerToWorld(event);
  marquee.moved ||= Math.hypot(event.clientX - marquee.startClientX, event.clientY - marquee.startClientY) > 4;
  const rect = normalizedRect(marquee.start, marquee.current);

  marquee.element.hidden = !marquee.moved;
  marquee.element.style.left = `${rect.x}px`;
  marquee.element.style.top = `${rect.y}px`;
  marquee.element.style.width = `${rect.width}px`;
  marquee.element.style.height = `${rect.height}px`;

  const framedIds = marquee.moved
    ? state.objects
      .filter((object) => !object.hidden && ((object.type || "image") === "image" || object.type === "slide-frame") && rectsIntersect(rect, object))
      .map((object) => object.id)
    : [];
  const ids = framedIds;
  const workflowDetail = { rect, moved: marquee.moved, objects: state.objects, objectIds: [], bounds: null, grouped: false };
  window.dispatchEvent(new CustomEvent("codex-canvas:workflow-marquee-hit-test", { detail: workflowDetail }));
  const nextIds = [...new Set([...ids, ...workflowDetail.objectIds])];
  setLocalSelection(nextIds, { fromUser: true });
  if (workflowDetail.objectIds.length) {
    workflowSelectionObjectId = nextIds.length === 1 ? nextIds[0] : null;
    workflowSelectionObjectIds = [...nextIds];
    workflowSelectionGrouped = workflowDetail.grouped === true;
    workflowSelectionBounds = workflowDetail.bounds;
  }
  updateSelectionClasses();
  updateSelectionUi();
}

async function endMarqueeSelection() {
  board.removeEventListener("pointermove", moveMarqueeSelection);
  board.removeEventListener("pointercancel", cancelMarqueeSelection);
  if (!marquee) return;
  const activeMarquee = marquee;
  marquee = null;
  activeMarquee.element.remove();
  releaseBoardPointer(activeMarquee.pointerId);
  if (!activeMarquee.moved) {
    setLocalSelection([]);
  }
  render();
  updateSelectionUi();
  await fetch(apiPath("/api/selection"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selection: selectedId })
  }).catch(() => {});
}

function cancelMarqueeSelection() {
  board.removeEventListener("pointermove", moveMarqueeSelection);
  if (!marquee) return;
  const activeMarquee = marquee;
  marquee = null;
  activeMarquee.element.remove();
  releaseBoardPointer(activeMarquee.pointerId);
  setLocalSelection([]);
  render();
  updateSelectionUi();
}

function releaseBoardPointer(pointerId) {
  try {
    board.releasePointerCapture(pointerId);
  } catch {
    // Pointer capture may already be released by the browser.
  }
}

function updateSelectionClasses() {
  const ids = selectedObjectIds();
  objectLayer.querySelectorAll(".canvas-object").forEach((element) => {
    element.classList.toggle("selected", ids.has(element.dataset.id));
  });
  updateLayerBrowserSelection();
}

function normalizedRect(a, b) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.max(1, Math.round(right - left)),
    height: Math.max(1, Math.round(bottom - top))
  };
}

function rectsIntersect(a, object) {
  return a.x <= object.x + object.width
    && a.x + a.width >= object.x
    && a.y <= object.y + object.height
    && a.y + a.height >= object.y;
}

function updateSelectionUi() {
  const groupId = selectedLayerGroupId();
  const isGroupSelection = Boolean(groupId);
  const selectedObjects = state.objects.filter((item) => selectedIds.has(item.id));
  const isMultiImageSelection = selectedObjects.length > 1
    && selectedObjects.every((item) => (item.type || "image") === "image");
  const isMultiSelection = selectedObjects.length > 1;
  const object = state.objects.find((item) => item.id === selectedId)
    || selectedObjects[0]
    || (isGroupSelection ? layerGroupMembers(groupId)[0] : null);

  updateSlidesCleanMode(object);

  if (quickEditObjectId) {
    const quickEditObject = state.objects.find((item) => item.id === quickEditObjectId);
    if (!quickEditObject || (quickEditObject.type || "image") !== "image") {
      hideSelectionToolbar();
      closeQuickEdit({ keepPrompt: true });
      return;
    }
    hideSelectionToolbar();
    updateQuickEditPosition();
    return;
  }

  if (cropSession?.objectId === selectedId) {
    hideSelectionToolbar();
    closeQuickEdit({ keepPrompt: true });
    return;
  }

  if (!object || !hasUserSelection) {
    hideSelectionToolbar();
    hideTextToolbar();
    closeQuickEdit({ keepPrompt: true });
    return;
  }

  // Text objects: show text toolbar instead of image selection toolbar
  if (object.type === "text" && !isMultiSelection) {
    hideSelectionToolbar();
    closeQuickEdit({ keepPrompt: true });
    showTextToolbarForObject(object);
    return;
  }

  if (["html", "slide-frame"].includes(object.type) && !isMultiSelection) {
    hideTextToolbar();
    closeQuickEdit({ keepPrompt: true });
    toolbar.querySelectorAll("[data-action]").forEach((button) => {
      button.hidden = button.dataset.action !== "edit-page";
    });
    toolbar.hidden = false;
    positionSelectionToolbarForObject(object);
    return;
  }

  if ((!isMultiSelection && object.type !== "image")) {
    hideSelectionToolbar();
    hideTextToolbar();
    closeQuickEdit({ keepPrompt: true });
    return;
  }

  hideTextToolbar();

  updateToolbarForSelection(isGroupSelection, isMultiImageSelection, isMultiSelection);
  if (isGroupSelection) closeQuickEdit({ keepPrompt: true });
  toolbar.hidden = Boolean(quickEditObjectId);

  // 同步分辨率切换按钮的显示状态（不重置，保持用户选择）
  updateResolutionToggleUi();

  const bounds = isGroupSelection
    ? layerGroupBounds(groupId)
    : boundsForObjects(isMultiSelection ? selectedObjects : [object]);
  const usesWorkflowBounds = workflowSelectionObjectIds.length > 0 && workflowSelectionBounds;
  const topLeft = usesWorkflowBounds
    ? { x: workflowSelectionBounds.left, y: workflowSelectionBounds.top }
    : worldToScreen(bounds.x, bounds.y);
  const bottomRight = usesWorkflowBounds
    ? { x: workflowSelectionBounds.right, y: workflowSelectionBounds.bottom }
    : worldToScreen(bounds.x + bounds.width, bounds.y + bounds.height);
  const toolbarRect = toolbar.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  const objectCenter = (topLeft.x + bottomRight.x) / 2;
  const topSafeArea = 76;
  const aboveTop = topLeft.y - toolbarRect.height - 26;
  const belowTop = bottomRight.y + 16;
  const preferredTop = aboveTop >= topSafeArea ? aboveTop : belowTop;
  const top = clamp(preferredTop, topSafeArea, Math.max(topSafeArea, boardRect.height - toolbarRect.height - 16));
  const left = clamp(objectCenter - toolbarRect.width / 2, 16, Math.max(16, boardRect.width - toolbarRect.width - 16));
  toolbar.style.transform = `translate(${left}px, ${top}px)`;
  updateQuickEditPosition();
}

function positionSelectionToolbarForObject(object) {
  const boardRect = board.getBoundingClientRect();
  const objectElement = objectLayer.querySelector(`.canvas-object[data-id="${CSS.escape(object.id)}"]`);
  const objectRect = objectElement?.getBoundingClientRect();
  // Prefer the actual painted box. This keeps controls attached to legacy
  // Frames whose persisted geometry may differ from the canonical page size.
  const topLeft = objectRect
    ? { x: objectRect.left - boardRect.left, y: objectRect.top - boardRect.top }
    : worldToScreen(object.x, object.y);
  const bottomRight = objectRect
    ? { x: objectRect.right - boardRect.left, y: objectRect.bottom - boardRect.top }
    : worldToScreen(object.x + object.width, object.y + object.height);
  const toolbarRect = toolbar.getBoundingClientRect();
  const topSafeArea = 76;
  const aboveTop = topLeft.y - toolbarRect.height - 26;
  const top = clamp(aboveTop >= topSafeArea ? aboveTop : bottomRight.y + 16, topSafeArea, Math.max(topSafeArea, boardRect.height - toolbarRect.height - 16));
  const left = clamp((topLeft.x + bottomRight.x) / 2 - toolbarRect.width / 2, 16, Math.max(16, boardRect.width - toolbarRect.width - 16));
  toolbar.style.transform = `translate(${left}px, ${top}px)`;
}

function hideSelectionToolbar() {
  toolbar.hidden = true;
  toolbar.classList.remove("has-layer-group-actions");
  const groupBreak = toolbar.querySelector("[data-toolbar-group-break]");
  if (groupBreak) groupBreak.hidden = true;
  
  toolbar.querySelectorAll("[data-action]").forEach((button) => {
    if (groupSelectionActions.has(button.dataset.action) || multiLayoutActions.has(button.dataset.action)) button.hidden = true;
    button.disabled = false;
  });
}

function showTextToolbarForObject(object) {
  if (!textToolbar) return;
  textToolbar.hidden = false;
  updateTextToolbarState(object);
  positionTextToolbar(object);
}

function hideTextToolbar() {
  if (!textToolbar) return;
  textToolbar.hidden = true;
  closeTextToolbarDropdowns();
}

function positionTextToolbar(object) {
  if (!textToolbar || !object) return;
  const bounds = boundsForObjects([object]);
  const topLeft = worldToScreen(bounds.x, bounds.y);
  const bottomRight = worldToScreen(bounds.x + bounds.width, bounds.y + bounds.height);
  const toolbarRect = textToolbar.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  const objectCenter = (topLeft.x + bottomRight.x) / 2;
  const topSafeArea = 76;
  const aboveTop = topLeft.y - toolbarRect.height - 26;
  const belowTop = bottomRight.y + 16;
  const preferredTop = aboveTop >= topSafeArea ? aboveTop : belowTop;
  const top = clamp(preferredTop, topSafeArea, Math.max(topSafeArea, boardRect.height - toolbarRect.height - 16));
  const left = clamp(objectCenter - toolbarRect.width / 2, 16, Math.max(16, boardRect.width - toolbarRect.width - 16));
  textToolbar.style.transform = `translate(${left}px, ${top}px)`;
}

function updateTextToolbarState(object) {
  if (!textToolbar || !object) return;
  const fontSizeLabel = textToolbar.querySelector("#textFontSizeLabel");
  const fontLabel = textToolbar.querySelector("#textFontLabel");
  const colorDot = textToolbar.querySelector("#textColorDot");
  const colorBtn = textToolbar.querySelector('[data-action="text-color"]');
  const fontBtn = textToolbar.querySelector('[data-action="text-font-family"]');
  const fontSizeBtn = textToolbar.querySelector('[data-action="text-font-size"]');
  const alignBtn = textToolbar.querySelector('[data-action="text-align"]');
  const boldBtn = textToolbar.querySelector('[data-action="text-bold"]');
  const italicBtn = textToolbar.querySelector('[data-action="text-italic"]');
  const underlineBtn = textToolbar.querySelector('[data-action="text-underline"]');
  const lockBtn = textToolbar.querySelector('[data-action="text-lock"]');

  const currentColor = object.color || "#202124";
  const currentFont = object.fontFamily || "Inter";
  const currentSize = object.fontSize || 28;
  const currentAlign = object.textAlign || "left";

  if (fontSizeLabel) fontSizeLabel.textContent = String(currentSize);
  if (fontLabel) fontLabel.textContent = getFontDisplayName(currentFont);
  if (colorDot) {
    colorDot.textContent = "";
    colorDot.style.background = currentColor;
  }

  if (colorBtn) {
    const tip = `颜色：${getColorDisplayName(currentColor)}`;
    colorBtn.dataset.tooltip = tip;
    colorBtn.title = tip;
  }
  if (fontBtn) {
    const tip = `字体：${getFontDisplayName(currentFont)}`;
    fontBtn.dataset.tooltip = tip;
    fontBtn.title = tip;
  }
  if (fontSizeBtn) {
    const tip = `字号：${currentSize}`;
    fontSizeBtn.dataset.tooltip = tip;
    fontSizeBtn.title = tip;
  }
  if (alignBtn) {
    const tip = `对齐：${getAlignDisplayName(currentAlign)}`;
    alignBtn.dataset.tooltip = tip;
    alignBtn.title = tip;
  }

  const boldOn = (object.fontWeight || "400") >= "600";
  if (boldBtn) {
    boldBtn.setAttribute("aria-pressed", String(boldOn));
    const tip = boldOn ? "加粗（已开启）" : "加粗";
    boldBtn.dataset.tooltip = tip;
    boldBtn.title = tip;
  }

  const italicOn = object.fontStyle === "italic";
  if (italicBtn) {
    italicBtn.setAttribute("aria-pressed", String(italicOn));
    const tip = italicOn ? "倾斜（已开启）" : "倾斜";
    italicBtn.dataset.tooltip = tip;
    italicBtn.title = tip;
  }

  const underlineOn = object.textDecoration === "underline";
  if (underlineBtn) {
    underlineBtn.setAttribute("aria-pressed", String(underlineOn));
    const tip = underlineOn ? "下划线（已开启）" : "下划线";
    underlineBtn.dataset.tooltip = tip;
    underlineBtn.title = tip;
  }

  if (lockBtn) {
    const locked = object.locked === true;
    const tip = locked ? "已锁定（点击解锁）" : "锁定";
    lockBtn.dataset.tooltip = tip;
    lockBtn.title = tip;
    lockBtn.querySelector("svg").innerHTML = locked
      ? '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="3" y1="3" x2="21" y2="21"/>'
      : '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
  }

  textToolbar.querySelectorAll(".text-color-swatch").forEach((swatch) => {
    swatch.classList.toggle("active", swatch.dataset.color === currentColor);
  });
  textToolbar.querySelectorAll('[data-dropdown="font-family"] .text-dropdown-item').forEach((item) => {
    item.classList.toggle("active", item.dataset.font === currentFont);
  });
  textToolbar.querySelectorAll('[data-dropdown="font-size"] .text-dropdown-item').forEach((item) => {
    item.classList.toggle("active", item.dataset.size === String(currentSize));
  });
  textToolbar.querySelectorAll('[data-dropdown="align"] .text-dropdown-item').forEach((item) => {
    item.classList.toggle("active", item.dataset.align === currentAlign);
  });

  // Final safety: strip any text nodes that may have appeared in buttons
  textToolbar.querySelectorAll("button").forEach((btn) => {
    [...btn.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        btn.removeChild(node);
      }
    });
  });
}

const FONT_DISPLAY_NAMES = {
  "Inter": "简洁",
  "Georgia, serif": "典雅",
  "'Nunito', sans-serif": "柔和",
  "'JetBrains Mono', monospace": "等宽",
  "'Caveat', cursive": "手写",
  "'Permanent Marker', cursive": "马克笔"
};

const COLOR_DISPLAY_NAMES = {
  "#202124": "黑色",
  "#ffffff": "白色",
  "#ff3b30": "红色",
  "#ff9500": "橙色",
  "#ffcc00": "黄色",
  "#34c759": "绿色",
  "#5ac8fa": "浅蓝",
  "#007aff": "蓝色",
  "#af52de": "紫色",
  "#ff2d55": "粉红"
};

const ALIGN_DISPLAY_NAMES = {
  "left": "左对齐",
  "center": "居中",
  "right": "右对齐",
  "justify": "两端对齐"
};

function getFontDisplayName(fontFamily) {
  if (!fontFamily) return "Aa";
  // 优先使用映射的中文名称
  if (FONT_DISPLAY_NAMES[fontFamily]) {
    return FONT_DISPLAY_NAMES[fontFamily];
  }
  // 从 fontFamily 字符串中提取第一个字体名称作为回退
  const firstFont = fontFamily.split(",")[0].trim().replace(/['"]/g, "");
  return firstFont || "Aa";
}

function getColorDisplayName(color) {
  if (!color) return "自定义颜色";
  return COLOR_DISPLAY_NAMES[color] || "自定义颜色";
}

function getAlignDisplayName(align) {
  return ALIGN_DISPLAY_NAMES[align] || "左对齐";
}

function closeTextToolbarDropdowns() {
  if (!textToolbar) return;
  textToolbar.querySelectorAll(".text-dropdown-menu, .text-color-palette").forEach((el) => {
    el.hidden = true;
  });
}

function updateTextObjectProperty(id, patch) {
  const object = state.objects.find((obj) => obj.id === id);
  if (!object) return;
  Object.assign(object, patch);
  const textEl = document.querySelector(`.text-object[data-id="${CSS.escape(id)}"] .text-content`);
  if (textEl) {
    if (patch.fontSize) textEl.style.fontSize = `${patch.fontSize}px`;
    if (patch.color) textEl.style.color = patch.color;
    if (patch.fontFamily) textEl.style.fontFamily = patch.fontFamily;
    if (patch.fontWeight) textEl.style.fontWeight = patch.fontWeight;
    if (patch.fontStyle) textEl.style.fontStyle = patch.fontStyle;
    if (patch.textDecoration) textEl.style.textDecoration = patch.textDecoration;
    if (patch.textAlign) textEl.style.textAlign = patch.textAlign;
  }
  const sizePatch = {};
  if (["fontSize", "fontFamily", "fontWeight", "fontStyle", "textDecoration"].some((key) => key in patch)) {
    const size = measureTextContentSize(object);
    object.width = size.width;
    object.height = size.height;
    sizePatch.width = size.width;
    sizePatch.height = size.height;
    const objectEl = document.querySelector(`.text-object[data-id="${CSS.escape(id)}"]`);
    if (objectEl) {
      objectEl.style.width = `${size.width}px`;
      objectEl.style.height = `${size.height}px`;
    }
  }
  updateObjectOnServer(id, { ...patch, ...sizePatch });
  updateTextToolbarState(object);
}

function updateObjectOnServer(id, patch) {
  fetch(apiPath(`/api/objects/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch)
  }).catch(() => {});
}

function shouldStartPan(event) {
  if (event.isPrimary === false) return false;
  if (event.button === 1 || event.button === 2) return true;
  return event.button === 0 && (activeTool === "hand" || spacePanPressed);
}

function isCanvasPanBlockedTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("button, input, textarea, select, [contenteditable='true'], .selection-toolbar, .quick-edit-composer, .layer-browser-panel, .text-toolbar"));
}

function startPan(event) {
  if (pan) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  board.classList.add("dragging");
  const clickedObject = event.target instanceof Element ? event.target.closest(".canvas-object") : null;
  pan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    viewportX: viewport.x,
    viewportY: viewport.y,
    moved: false,
    selectOnClick: event.button === 0 && activeTool === "hand" && !spacePanPressed,
    clickedObjectId: clickedObject?.dataset.id || null,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey || event.ctrlKey
  };
  window.addEventListener("pointermove", movePan);
  window.addEventListener("pointerup", endPan);
  window.addEventListener("pointercancel", endPan);
  board.addEventListener("lostpointercapture", endPan);
  try {
    board.setPointerCapture(event.pointerId);
  } catch {
    // Window-level listeners keep panning usable when capture is unavailable.
  }
}

function startAnnotation(event) {
  const start = pointerToWorld(event);
  const targets = annotationImageTargets();
  if (!targets.length) {
    showToast(t("annotationTargetMissing"));
    return;
  }
  const target = annotationTargetForGesture(start, start);

  event.preventDefault();
  event.stopPropagation();
  if (editingAnnotationId) flushEditingAnnotationObject();
  setLocalSelection([]);
  updateSelectionClasses();
  board.classList.add("annotating");
  const preview = createAnnotationPreview();
  objectLayer.append(preview.element);
  annotationDraft = {
    pointerId: event.pointerId,
    start,
    end: start,
    preview,
    targetId: target?.id || null
  };
  try {
    board.setPointerCapture(event.pointerId);
  } catch {
    // Window listeners below keep the gesture working when capture is unavailable.
  }
  updateAnnotationPreview();
  window.addEventListener("pointermove", moveAnnotation);
  window.addEventListener("pointerup", endAnnotation, { once: true });
  window.addEventListener("pointercancel", cancelAnnotation, { once: true });
}

function createAnnotationPreview() {
  const element = document.createElement("div");
  element.className = "annotation-draft";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "annotation-draft-arrowhead");
  marker.setAttribute("viewBox", "0 0 12 12");
  marker.setAttribute("refX", "10");
  marker.setAttribute("refY", "6");
  marker.setAttribute("markerWidth", "12");
  marker.setAttribute("markerHeight", "12");
  marker.setAttribute("markerUnits", "userSpaceOnUse");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrowhead = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowhead.setAttribute("d", "M 2 2 L 10 6 L 2 10");
  arrowhead.setAttribute("fill", "none");
  arrowhead.setAttribute("stroke", activeColor);
  arrowhead.setAttribute("stroke-width", "2.2");
  arrowhead.setAttribute("stroke-linecap", "round");
  arrowhead.setAttribute("stroke-linejoin", "round");
  marker.append(arrowhead);
  defs.append(marker);
  svg.append(defs);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", activeColor);
  path.setAttribute("stroke-width", "3");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("marker-end", "url(#annotation-draft-arrowhead)");
  svg.append(path);
  element.append(svg);
  return { element, svg, path };
}

function moveAnnotation(event) {
  if (!annotationDraft || event.pointerId !== annotationDraft.pointerId) return;
  annotationDraft.end = pointerToWorld(event);
  updateAnnotationPreview();
}

function updateAnnotationPreview() {
  if (!annotationDraft) return;
  const { start, end, preview } = annotationDraft;
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.max(1, Math.abs(end.x - start.x));
  const height = Math.max(1, Math.abs(end.y - start.y));
  preview.element.style.left = `${x}px`;
  preview.element.style.top = `${y}px`;
  preview.element.style.width = `${width}px`;
  preview.element.style.height = `${height}px`;
  preview.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const target = state.objects.find((item) => item.id === annotationDraft.targetId && (item.type || "image") === "image")
    || annotationTargetForGesture(start, end);
  const geometry = target
    ? orientAnnotationGeometry(start, end, target)
    : { labelPoint: start, targetPoint: end };
  preview.path.setAttribute("d", annotationCurvePath(
    { x: geometry.labelPoint.x - x, y: geometry.labelPoint.y - y },
    { x: geometry.targetPoint.x - x, y: geometry.targetPoint.y - y }
  ));
}

async function endAnnotation(event) {
  const active = takeAnnotationDraft();
  if (!active) return;
  if (event?.type === "pointercancel") return;
  const lengthPx = Math.hypot(active.end.x - active.start.x, active.end.y - active.start.y) * viewport.zoom;
  if (lengthPx < annotationMinimumLengthPx) return;

  const target = state.objects.find((item) => item.id === active.targetId && (item.type || "image") === "image")
    || annotationTargetForGesture(active.start, active.end);
  if (!target) {
    showToast(t("annotationTargetMissing"));
    return;
  }
  const x = Math.min(active.start.x, active.end.x);
  const y = Math.min(active.start.y, active.end.y);
  const width = Math.max(1, Math.abs(active.end.x - active.start.x));
  const height = Math.max(1, Math.abs(active.end.y - active.start.y));
  const geometry = orientAnnotationGeometry(active.start, active.end, target);
  const targetAnchorX = clamp((geometry.targetPoint.x - target.x) / Math.max(1, target.width), 0, 1);
  const targetAnchorY = clamp((geometry.targetPoint.y - target.y) / Math.max(1, target.height), 0, 1);

  try {
    const object = await createObject({
      type: "annotation",
      annotationKind: "arrow-note",
      annotationTargetId: target.id,
      annotationSessionId: ensureQuickEditAnnotationSessionId(),
      annotationRole: "note",
      label: "",
      color: activeColor,
      strokeWidth: 3,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      labelX: Math.round(geometry.labelPoint.x - x),
      labelY: Math.round(geometry.labelPoint.y - y),
      tipX: Math.round(geometry.targetPoint.x - x),
      tipY: Math.round(geometry.targetPoint.y - y),
      targetAnchorX,
      targetAnchorY
    });
    editingAnnotationId = object.id;
    setLocalSelection([object.id], { fromUser: true });
    render();
    focusAnnotationLabel(object.id);
    updateQuickEditRunState();
  } catch (error) {
    showToast(error?.message || t("jobFailed"));
  }
}

function cancelAnnotation() {
  takeAnnotationDraft();
}

function annotationImageTargets() {
  return state?.objects?.filter((item) => (item.type || "image") === "image") || [];
}

function annotationTargetForGesture(start, end) {
  const targets = annotationImageTargets();
  const preferredId = quickEditAction === "quick-edit" && quickEditObjectId
    ? quickEditObjectId
    : selectedIds.size <= 1
      ? selectedId
      : null;
  const preferred = targets.find((item) => item.id === preferredId);
  if (preferred) return preferred;

  return targets
    .map((item) => ({
      item,
      distance: Math.min(pointDistanceToRect(start, item), pointDistanceToRect(end, item))
    }))
    .filter((candidate) => candidate.distance === 0)
    .sort((left, right) => left.distance - right.distance)[0]?.item || null;
}

function takeAnnotationDraft() {
  window.removeEventListener("pointermove", moveAnnotation);
  window.removeEventListener("pointerup", endAnnotation);
  window.removeEventListener("pointercancel", cancelAnnotation);
  board.classList.remove("annotating");
  if (!annotationDraft) return null;
  const active = annotationDraft;
  annotationDraft = null;
  active.preview.element.remove();
  releaseBoardPointer(active.pointerId);
  return active;
}

function startDrawing(event) {
  event.preventDefault();
  selectObject(null, { renderNow: false });
  board.classList.add("drawing");
  board.setPointerCapture(event.pointerId);
  const start = pointerToWorld(event);
  const preview = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  preview.classList.add("drawing-preview");
  preview.setAttribute("width", "1");
  preview.setAttribute("height", "1");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", activeColor);
  path.setAttribute("stroke-width", "4");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  preview.append(path);
  objectLayer.append(preview);
  drawing = {
    pointerId: event.pointerId,
    points: [start],
    preview,
    path
  };
  updateDrawingPreview();
  board.addEventListener("pointermove", moveDrawing);
  board.addEventListener("pointerup", endDrawing, { once: true });
  board.addEventListener("pointercancel", cancelDrawing, { once: true });
}

function moveDrawing(event) {
  if (!drawing) return;
  drawing.points.push(pointerToWorld(event));
  updateDrawingPreview();
}

async function endDrawing() {
  board.classList.remove("drawing");
  board.removeEventListener("pointermove", moveDrawing);
  board.removeEventListener("pointercancel", cancelDrawing);
  if (!drawing) return;
  const points = simplifyPoints(drawing.points);
  drawing.preview.remove();
  drawing = null;
  if (points.length < 2) return;

  const bounds = boundsForPoints(points, 10);
  try {
    const object = await createObject({
      type: "drawing",
      ...quickEditAnnotationMetadata("mask"),
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      points: points.map((point) => ({ x: point.x - bounds.x, y: point.y - bounds.y })),
      stroke: activeColor,
      strokeWidth: 4
    });
    setLocalSelection([object.id], { fromUser: true });
    render();
    setActiveTool(defaultCanvasTool);
  } catch (error) {
    showToast(error?.message || t("jobFailed"));
  }
}

function cancelDrawing() {
  board.classList.remove("drawing");
  board.removeEventListener("pointermove", moveDrawing);
  if (!drawing) return;
  drawing.preview.remove();
  drawing = null;
}

function updateDrawingPreview() {
  if (!drawing) return;
  drawing.path.setAttribute("d", pathForPoints(drawing.points));
}

async function createTextObject(event) {
  event.preventDefault();
  const point = pointerToWorld(event);
  try {
    const placeholderText = t("textPlaceholder");
    const fontSize = 28;
    const lineHeight = Math.round(fontSize * TEXT_LINE_HEIGHT_FACTOR);
    const object = await createObject({
      type: "text",
      ...quickEditAnnotationMetadata("text-note"),
      text: placeholderText,
      x: Math.round(point.x),
      y: Math.round(point.y),
      width: TEXT_DEFAULT_WIDTH,
      height: lineHeight,
      fontSize,
      color: activeColor
    });
    setLocalSelection([object.id], { fromUser: true });
    editingTextId = object.id;
    render();
    focusTextObject(object.id);
    setActiveTool(defaultCanvasTool);
  } catch (error) {
    showToast(error?.message || t("jobFailed"));
  }
}

async function createObject(payload) {
  const scopeMeta = currentCanvasScopeMeta();
  const selectionBefore = captureSelectionSnapshot();
  return canvasHistory.commit(async () => {
    const response = await fetch(apiPath("/api/objects"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withExpectedCanvasScope(payload, scopeMeta))
    });
    const object = await response.json();
    if (!response.ok) throw new Error(object.error || t("jobFailed"));
    const index = state.objects.length;
    state.objects.push(object);
    refreshKnownObjectIds();
    return {
      value: object,
      action: {
        type: "create",
        entries: [{ object: cloneCanvasObject(object), index }],
        selectionBefore,
        selectionAfter: selectionSnapshotForIds([object.id]),
        scopeMeta
      }
    };
  });
}

async function removeSlideFromDeck(deck, slide) {
  const scopeMeta = currentCanvasScopeMeta();
  const newSlideIds = (deck.slideIds || []).filter((id) => id !== slide.id);
  const remaining = state.objects.filter((o) => newSlideIds.includes(o.id));
  remaining.sort((a, b) => newSlideIds.indexOf(a.id) - newSlideIds.indexOf(b.id));
  const deckPatchUpdates = [
    { id: deck.id, patch: { slideIds: newSlideIds } },
    { id: slide.id, patch: { slideDeckId: null } }
  ];
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].slideOrder !== i) {
      remaining[i].slideOrder = i;
      deckPatchUpdates.push({ id: remaining[i].id, patch: { slideOrder: i } });
    }
  }
  slide.slideDeckId = null;
  deck.slideIds = newSlideIds;
  // 删除后确保不再走生成器界面：有剩余则选中上一张，空 deck 也保持 deck 视图
  slidesGeneratorOpenByDeck.delete(deck.id);
  if (newSlideIds.length) {
    const newIndex = Math.min(activeSlideIndexByDeck.get(deck.id) || 0, newSlideIds.length - 1);
    activeSlideIndexByDeck.set(deck.id, newIndex);
  } else {
    activeSlideIndexByDeck.set(deck.id, 0);
  }
  setLocalSelection([]);
  state.selection = null;
  const payload = await patchCanvasObjects(deckPatchUpdates, selectionSnapshotForIds([]), scopeMeta);
  replaceLocalObjects(payload.objects || []);
  refreshKnownObjectIds();
  canvasObjectRenderSignatures.delete(deck.id);
  render();
  showToast(language === "zh" ? "已从幻灯片面板移除" : "Removed from slides deck");
}

function deleteSelectedObject() {
  const ids = selectedIds.size ? [...selectedIds] : (selectedId ? [selectedId] : []);
  if (!ids.length) return;
  const groupId = ids.length === 1 ? selectedLayerGroupId() : null;
  const deleteIds = groupId ? layerGroupMembers(groupId).map((object) => object.id) : ids;
  const blockedJob = state.objects.find((object) => deleteIds.includes(object.id)
    && object.type === "job"
    && !["done", "failed"].includes(object.status));
  if (blockedJob) {
    showToast(t("jobDeleteBlocked"));
    return;
  }

  const previousObjects = state.objects.map(cloneCanvasObject);
  const previousSelection = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();
  const deletedEntriesFor = (deleteIds) => state.objects
    .map((object, index) => ({ object: cloneCanvasObject(object), index }))
    .filter((entry) => deleteIds.includes(entry.object.id));
  const undoEntries = deletedEntriesFor(deleteIds);

  const decksAffected = new Map();
  for (const obj of state.objects) {
    if (!deleteIds.includes(obj.id)) continue;
    if (!["slide-frame", "image", "html"].includes(obj.type)) continue;
    const deckId = obj.slideDeckId;
    if (!deckId) continue;
    if (!decksAffected.has(deckId)) decksAffected.set(deckId, { deck: null, removedIds: [] });
    decksAffected.get(deckId).removedIds.push(obj.id);
  }
  for (const [deckId, info] of decksAffected) {
    info.deck = state.objects.find((o) => o.id === deckId && o.type === "slides") || null;
  }

  const restoreDeletedState = (error) => {
    state.objects = previousObjects;
    restoreSelectionSnapshot(previousSelection);
    refreshKnownObjectIds();
    render();
    showToast(error?.message || t("jobFailed"));
  };

  return canvasHistory.commit(async () => {
    setLocalSelection([]);
    editingTextId = null;
    state.objects = state.objects.filter((object) => !deleteIds.includes(object.id));

    const deckPatchUpdates = [];
    for (const [deckId, info] of decksAffected) {
      if (!info.deck) continue;
      const newSlideIds = (info.deck.slideIds || []).filter((id) => !info.removedIds.includes(id));
      info.deck.slideIds = newSlideIds;
      deckPatchUpdates.push({ id: deckId, patch: { slideIds: newSlideIds } });
      const remaining = state.objects.filter((o) => newSlideIds.includes(o.id));
      remaining.sort((a, b) => newSlideIds.indexOf(a.id) - newSlideIds.indexOf(b.id));
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].slideOrder !== i) {
          remaining[i].slideOrder = i;
          deckPatchUpdates.push({ id: remaining[i].id, patch: { slideOrder: i } });
        }
      }
    }

    state.selection = null;
    refreshKnownObjectIds();
    render();
    try {
      await deleteObjectsById(deleteIds, scopeMeta);
      if (deckPatchUpdates.length) {
        await patchCanvasObjects(deckPatchUpdates, selectionSnapshotForIds([]), scopeMeta);
      }
      return {
        action: {
          type: "delete",
          entries: undoEntries,
          selectionBefore: previousSelection,
          selectionAfter: selectionSnapshotForIds([]),
          scopeMeta
        }
      };
    } catch (error) {
      restoreDeletedState(error);
      return null;
    }
  });
}

async function runCanvasHistoryAction(direction) {
  if (!['undo', 'redo'].includes(direction)) return;
  try {
    await canvasHistory[direction](applyCanvasHistoryAction);
  } catch (error) {
    showToast(error?.message || t("jobFailed"));
  }
}

async function applyCanvasHistoryAction(action, direction) {
  const restore = (action.type === "delete" && direction === "undo")
    || (action.type === "create" && direction === "redo");
  const remove = (action.type === "create" && direction === "undo")
    || (action.type === "delete" && direction === "redo");
  const selection = direction === "undo" ? action.selectionBefore : action.selectionAfter;

  if (restore) {
    const payload = await restoreCanvasObjects(action.entries, selection, action.scopeMeta);
    restoreEntriesLocally(action.entries, payload.objects || []);
  } else if (remove) {
    await deleteObjectsById(action.entries.map((entry) => entry.object.id), action.scopeMeta);
    const removedIds = new Set(action.entries.map((entry) => entry.object.id));
    state.objects = state.objects.filter((object) => !removedIds.has(object.id));
  } else if (action.type === "update") {
    const updates = direction === "undo" ? action.before : action.after;
    const payload = await patchCanvasObjects(updates, selection, action.scopeMeta);
    replaceLocalObjects(payload.objects || []);
  } else if (action.type === "reorder") {
    const objectIds = direction === "undo" ? action.beforeOrder : action.afterOrder;
    const payload = await setCanvasLayerGroupOrder({
      groupId: action.groupId,
      objectIds,
      selection,
      scopeMeta: action.scopeMeta
    });
    replaceLocalLayerGroupObjects(action.groupId, payload.objects || []);
  } else {
    return;
  }

  restoreSelectionSnapshot(selection);
  refreshKnownObjectIds();
  suppressNextAutoFocus = true;
  render();
}

function cloneCanvasObject(object) {
  return JSON.parse(JSON.stringify(object));
}

function updateCanvasScope(serverScope = null) {
  const project = registeredProjects.find((item) => item.id === currentProjectId)
    || registeredProjects.find((item) => item.chatThreadId && item.chatThreadId === currentThreadId)
    || null;
  const nextScope = serverScope && typeof serverScope === "object"
    ? serverScope
    : {
        projectId: project?.id || currentProjectId || null,
        canvasId: project?.canvasId || null,
        threadId: project?.chatThreadId || currentThreadId || null
      };
  if (!nextScope.projectId && !nextScope.canvasId && !nextScope.threadId) return;
  canvasScope = {
    projectId: typeof nextScope.projectId === "string" ? nextScope.projectId : null,
    canvasId: typeof nextScope.canvasId === "string" ? nextScope.canvasId : null,
    threadId: typeof nextScope.threadId === "string" ? nextScope.threadId : null
  };
  canvasHistory.setScope(canvasScope);
}

function currentCanvasScopeMeta() {
  if (!canvasScope) updateCanvasScope();
  return canvasScope ? { ...canvasScope } : {
    projectId: currentProjectId || null,
    canvasId: null,
    threadId: currentThreadId || null
  };
}

function withExpectedCanvasScope(payload, scopeMeta = currentCanvasScopeMeta()) {
  return {
    ...payload,
    expectedProjectId: scopeMeta?.projectId || null,
    expectedCanvasId: scopeMeta?.canvasId || null
  };
}

function captureSelectionSnapshot() {
  return {
    ids: [...selectedIds],
    primary: selectedId,
    fromUser: hasUserSelection
  };
}

function selectionSnapshotForIds(ids, { fromUser = true } = {}) {
  const normalized = ids.filter(Boolean);
  return {
    ids: normalized,
    primary: normalized.length === 1 ? normalized[0] : null,
    fromUser: normalized.length > 0 && fromUser
  };
}

function restoreSelectionSnapshot(snapshot = null) {
  const existingIds = new Set(state.objects.map((object) => object.id));
  const ids = Array.isArray(snapshot?.ids) ? snapshot.ids.filter((id) => existingIds.has(id)) : [];
  setLocalSelection(ids, { fromUser: snapshot?.fromUser !== false });
  if (snapshot?.primary && existingIds.has(snapshot.primary) && ids.length <= 1) {
    selectedId = snapshot.primary;
    state.selection = selectedId;
  }
}

function refreshKnownObjectIds() {
  knownObjectIds = new Set(state.objects.map((object) => object.id));
}

async function restoreCanvasObjects(entries, selection, scopeMeta) {
  const response = await fetch(apiPath("/api/objects/restore"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withExpectedCanvasScope({
      objects: entries,
      selection: selection?.primary || null
    }, scopeMeta))
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || t("jobFailed"));
  return payload;
}

async function patchCanvasObjects(updates, selection, scopeMeta) {
  const response = await fetch(apiPath("/api/objects"), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withExpectedCanvasScope({
      updates,
      selection: selection?.primary || null
    }, scopeMeta))
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || t("jobFailed"));
  return payload;
}

async function reorderCanvasLayerGroup({ groupId, objectId, direction, scopeMeta }) {
  const response = await fetch(apiPath(`/api/layer-groups/${encodeURIComponent(groupId)}/reorder`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withExpectedCanvasScope({ objectId, direction }, scopeMeta))
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || t("jobFailed"));
  return payload;
}

async function setCanvasLayerGroupOrder({ groupId, objectIds, selection, scopeMeta }) {
  const response = await fetch(apiPath(`/api/layer-groups/${encodeURIComponent(groupId)}/order`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withExpectedCanvasScope({
      objectIds,
      selection: selection?.primary || null
    }, scopeMeta))
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || t("jobFailed"));
  return payload;
}

function restoreEntriesLocally(entries, restoredObjects) {
  const byId = new Map(restoredObjects.map((object) => [object.id, object]));
  const objects = [...state.objects];
  for (const entry of entries) {
    const object = byId.get(entry.object.id) || cloneCanvasObject(entry.object);
    const index = Number.isInteger(entry.index)
      ? Math.min(Math.max(entry.index, 0), objects.length)
      : objects.length;
    objects.splice(index, 0, object);
  }
  state.objects = objects;
}

function replaceLocalObjects(objects) {
  const byId = new Map(objects.map((object) => [object.id, object]));
  state.objects = state.objects.map((object) => byId.get(object.id) || object);
}

function replaceLocalLayerGroupObjects(groupId, objects) {
  const firstGroupIndex = state.objects.findIndex((object) => object.layerGroupId === groupId);
  if (firstGroupIndex < 0 || !objects.length) return;
  const otherObjects = state.objects.filter((object) => object.layerGroupId !== groupId);
  const insertIndex = Math.min(firstGroupIndex, otherObjects.length);
  state.objects = [
    ...otherObjects.slice(0, insertIndex),
    ...objects,
    ...otherObjects.slice(insertIndex)
  ];
}

function applyObjectPatchesLocally(updates) {
  const byId = new Map(updates.map((update) => [update.id, update.patch]));
  state.objects = state.objects.map((object) => byId.has(object.id)
    ? { ...object, ...byId.get(object.id) }
    : object);
}

function commitObjectUpdateHistory({ before, after, selectionBefore, selectionAfter, scopeMeta }) {
  if (!objectUpdatesChanged(before, after)) {
    render();
    return Promise.resolve();
  }
  return canvasHistory.commit(async () => {
    try {
      const payload = await patchCanvasObjects(after, selectionAfter, scopeMeta);
      replaceLocalObjects(payload.objects || []);
      refreshKnownObjectIds();
      render();
      return {
        action: {
          type: "update",
          before: cloneCanvasObject(before),
          after: cloneCanvasObject(after),
          selectionBefore,
          selectionAfter,
          scopeMeta
        }
      };
    } catch (error) {
      applyObjectPatchesLocally(before);
      refreshKnownObjectIds();
      render();
      showToast(error?.message || t("jobFailed"));
      return null;
    }
  });
}

function objectUpdatesChanged(before, after) {
  if (before.length !== after.length) return true;
  return before.some((update, index) => update.id !== after[index]?.id
    || JSON.stringify(update.patch) !== JSON.stringify(after[index]?.patch));
}

function renderCanvasHistoryStatus(status = canvasHistory.status) {
  if (undoButton) {
    undoButton.disabled = !status.canUndo;
    undoButton.setAttribute("aria-disabled", String(undoButton.disabled));
  }
  if (redoButton) {
    redoButton.disabled = !status.canRedo;
    redoButton.setAttribute("aria-disabled", String(redoButton.disabled));
  }
}

async function deleteObjectsById(ids, scopeMeta = currentCanvasScopeMeta()) {
  if (!ids.length) return;
  const response = await fetch(apiPath("/api/objects"), {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withExpectedCanvasScope({ ids }, scopeMeta))
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || t("jobFailed"));
  return payload;
}

function uploadImageFiles(files, { prompt = "Uploaded from local file" } = {}) {
  const scopeMeta = currentCanvasScopeMeta();
  const selectionBefore = captureSelectionSnapshot();
  return canvasHistory.commit(async () => {
    let nextX = null;
    let lastObject = null;
    let lastError = null;
    const entries = [];

    for (const file of files) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const naturalSize = await readImageFileSize(dataUrl);
        const displaySize = displaySizeForUpload(naturalSize);
        const position = uploadPosition(displaySize, nextX);
        nextX = position.x + displaySize.width + 72;

        const response = await fetch(apiPath("/api/images"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(withExpectedCanvasScope({
            dataUrl,
            name: file.name || `pasted-image-${Date.now()}.png`,
            prompt,
            layoutMode: "manual",
            x: position.x,
            y: position.y,
            width: displaySize.width,
            height: displaySize.height
          }, scopeMeta))
        });
        const object = await response.json();
        if (!response.ok) throw new Error(object.error || t("uploadFailed"));
        entries.push({ object: cloneCanvasObject(object), index: state.objects.length });
        state.objects.push(object);
        lastObject = object;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastObject) {
      setLocalSelection([lastObject.id], { fromUser: true });
      refreshKnownObjectIds();
      render();
    }

    if (lastError) showToast(lastError?.message || t("uploadFailed"));
    else if (lastObject) showToast(t("uploadDone"));
    if (!entries.length) return null;
    return {
      action: {
        type: "create",
        entries,
        selectionBefore,
        selectionAfter: selectionSnapshotForIds([lastObject.id]),
        scopeMeta
      }
    };
  });
}

function isUploadImageCandidate(file) {
  if (String(file.type || "").startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name || "");
}

function clipboardImageFiles(clipboardData) {
  const directFiles = [...(clipboardData?.files || [])].filter(isUploadImageCandidate);
  if (directFiles.length) return directFiles;
  return [...(clipboardData?.items || [])]
    .filter((item) => item.kind === "file" && String(item.type || "").startsWith("image/"))
    .map((item) => item.getAsFile?.())
    .filter((file) => file && isUploadImageCandidate(file));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error(t("uploadFailed")));
    reader.readAsDataURL(file);
  });
}

function readImageFileSize(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (size) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(size);
    };
    const timeout = window.setTimeout(() => finish(null), 1500);
    image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => finish(null);
    image.src = dataUrl;
  });
}

function displaySizeForUpload(size) {
  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) {
    return { width: 360, height: 360 };
  }
  const scale = Math.min(1, uploadMaxDisplaySize / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale))
  };
}

function uploadPosition(size, nextX) {
  const boardRect = board.getBoundingClientRect();
  const center = screenToWorld(boardRect.width / 2, boardRect.height / 2);
  return {
    x: Math.round(Number.isFinite(nextX) ? nextX : center.x - size.width / 2),
    y: Math.round(center.y - size.height / 2)
  };
}

async function startImageJob(action, options = {}) {
  const object = state.objects.find((item) => item.id === selectedId);
  if (!object || (object.type || "image") !== "image") return;

  showToast(`${labelAction(action)} ${t("jobStarted")}`);
  try {
    const response = await fetch(apiPath("/api/jobs"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        objectId: object.id,
        prompt: options.prompt || "",
        ...(action === "quick-edit" && options.annotationSessionId
          ? { annotationSessionId: options.annotationSessionId }
          : {}),
        ...(action === "expand" && options.expand ? { expand: options.expand } : {})
      })
    });
    const job = await response.json();
    if (!response.ok) {
      showToast(job.error || `${labelAction(action)} ${t("jobFailed")}`);
      return;
    }
    if (isGenerationTask(job)) {
      jobCenterJobs = [job, ...jobCenterJobs.filter((item) => item.id !== job.id)];
    }
    renderJobCenter();
    await loadState();
    pollImageJob(job.id);
  } catch (error) {
    showToast(error?.message || `${labelAction(action)} ${t("jobFailed")}`);
  }
}

async function sendSelectedImageToChat() {
  const object = state.objects.find((item) => item.id === selectedId);
  if (!object || (object.type || "image") !== "image") return;

  showToast(t("chatSendStarted"));
  try {
    const response = await fetch(apiPath("/api/chat-turn"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "send-to-chat",
        objectId: object.id
      })
    });
    const result = await response.json();
    if (!response.ok) {
      const fallback = response.status === 409 ? t("chatNotBound") : `${labelAction("send-to-chat")} ${t("jobFailed")}`;
      throw new Error(result.error || fallback);
    }
    showToast(t("chatSendDone"));
  } catch (error) {
    showToast(error?.message || `${labelAction("send-to-chat")} ${t("jobFailed")}`);
  }
}

async function copySelectedFileMention() {
  const object = state.objects.find((item) => item.id === selectedId);
  if (!object || (object.type || "image") !== "image") return;
  const filePath = object.assetPath || object.sourcePath || "";
  if (!filePath) {
    showToast(t("fileMentionCopyFailed"));
    return;
  }

  try {
    await copyTextToClipboard(`@${filePath}`);
    showToast(t("fileMentionCopied"));
  } catch {
    showToast(t("fileMentionCopyFailed"));
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy failed");
}

function openImageActionComposer(action) {
  const object = state.objects.find((item) => item.id === selectedId);
  if (!object || (object.type || "image") !== "image" || !hasUserSelection) return;
  quickEditAction = action;
  beginImageEdit(action, object.id);
  quickEditObjectId = object.id;
  quickEditAnnotationSessionId = null;
  if (action === "quick-edit") ensureQuickEditAnnotationSessionId();
  quickEditPrompt.placeholder = composerPlaceholder(action);
  configureComposerMode(action, object);
  applyQuickEditDefaultMarkColor(action);
  quickEditComposer.hidden = false;
  updateQuickEditRunState();
  updateColorPalette();
  if (!object.hidden && !workflowResultScreenBounds(object.id)) {
    frameObjectForQuickEdit(object, action);
  }
  updateSelectionUi();
  updateQuickEditPosition();
  if (action === "edit-text") {
    startTextRecognition(object.id);
  } else if (action === "expand") {
    window.requestAnimationFrame(() => expandScale?.focus());
  } else if (action === "quick-edit") {
    setActiveTool("annotation");
    window.requestAnimationFrame(() => board.focus());
  } else {
    window.requestAnimationFrame(() => quickEditPrompt.focus());
  }
}

function closeQuickEdit({ keepPrompt = false, cancelTextSession = true, restoreExpandPreview = true } = {}) {
  const closingAction = quickEditAction;
  const textRecognitionId = quickEditAction === "edit-text" ? activeTextRecognitionId : null;
  if (cancelTextSession && textRecognitionId) {
    if (textRecognitionId.startsWith("text_")) {
      cancelTextRecognitionSession(textRecognitionId);
    } else {
      pendingTextRecognitionCancels.add(textRecognitionId);
    }
  }
  if (restoreExpandPreview && quickEditAction === "expand") {
    restoreExpandPreviewSource();
  }
  cancelAnnotation();
  if (editingAnnotationId) {
    objectLayer.querySelector(`[data-id="${CSS.escape(editingAnnotationId)}"] .annotation-label`)?.blur();
  }
  quickEditComposer.hidden = true;
  quickEditObjectId = null;
  quickEditAction = null;
  quickEditAnnotationSessionId = null;
  restoreQuickEditDefaultMarkColor();
  activeTextRecognitionId = null;
  editTextItems = [];
  editTextList.replaceChildren();
  editTextStatus.textContent = "";
  quickEditRun.disabled = false;
  quickEditComposer.classList.remove("edit-text-mode", "quick-edit-mode", "expand-mode");
  expandConfig.frame = null;
  expandConfig.sourceStart = null;
  expandConfig.placement = null;
  if (!keepPrompt) quickEditPrompt.value = "";
  if (closingAction === "quick-edit" && quickEditMarkupTools.has(activeTool)) {
    setActiveTool(defaultCanvasTool);
  }
  updateColorPalette();
  updateExpandPreview();
  endImageEdit();
}

function applyQuickEditDefaultMarkColor(action) {
  if (action !== "quick-edit") return;
  if (localStorage.getItem(toolColorStorageKey)) return;
  if (activeColor === defaultQuickEditMarkColor) return;
  quickEditAutoColorPrevious = activeColor;
  activeColor = defaultQuickEditMarkColor;
}

function restoreQuickEditDefaultMarkColor() {
  if (!quickEditAutoColorPrevious) return;
  if (!localStorage.getItem(toolColorStorageKey) && activeColor === defaultQuickEditMarkColor) {
    activeColor = quickEditAutoColorPrevious;
  }
  quickEditAutoColorPrevious = null;
}

async function submitQuickEdit() {
  const action = quickEditAction || "quick-edit";
  if (action === "edit-text") {
    await submitEditText();
    return;
  }
  await flushEditingAnnotationObject();
  await flushEditingTextObject();
  const objectId = quickEditObjectId;
  if (!objectId) return;
  const prompt = quickEditPrompt.value.trim();
  const hasAnnotations = action === "quick-edit" && quickEditAnnotationsForTarget(objectId).length > 0;
  if (!prompt && action !== "expand" && !hasAnnotations) {
    showToast(composerEmptyMessage(action));
    if (action === "quick-edit") setActiveTool("annotation");
    else quickEditPrompt.focus();
    return;
  }
  const annotationSessionId = action === "quick-edit" ? ensureQuickEditAnnotationSessionId() : null;
  const expandOptions = action === "expand" ? currentExpandOptions() : null;
  if (action === "expand" && workflowResultScreenBounds(objectId)) {
    const detail = { action, objectId, prompt, expand: expandOptions, handled: false };
    window.dispatchEvent(new CustomEvent("codex-canvas:workflow-run-image-action", { detail }));
    if (detail.handled) {
      closeQuickEdit();
      return;
    }
  }
  setLocalSelection([objectId], { fromUser: true });
  closeQuickEdit();
  await startImageJob(action, {
    prompt,
    annotationSessionId,
    expand: expandOptions
  });
}

async function flushEditingTextObject() {
  if (!editingTextId) return;
  const id = editingTextId;
  const element = objectLayer.querySelector(`[data-id="${CSS.escape(id)}"] .text-content`);
  editingTextId = null;
  if (!element) return;
  await saveTextObject(id, element.textContent || t("textPlaceholder"));
}

async function submitEditText() {
  const objectId = quickEditObjectId;
  const sessionId = activeTextRecognitionId;
  if (!objectId || !sessionId) return;
  const changes = editTextItems
    .map((item, index) => ({
      index: index + 1,
      from: item.text,
      to: String(item.editedText || "").trim(),
      location: item.location,
      style: item.style
    }))
    .filter((item) => item.to && item.to !== item.from);
  if (!changes.length) {
    showToast(t("editTextNoChanges"));
    editTextList.querySelector("input")?.focus();
    return;
  }

  setLocalSelection([objectId], { fromUser: true });
  quickEditRun.disabled = true;

  try {
    const response = await fetch(apiPath(`/api/text-recognition/${sessionId}/run`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "edit-text", changes })
    });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || `${labelAction("edit-text")} ${t("jobFailed")}`);
    closeQuickEdit({ cancelTextSession: false });
    await loadState();
    frameJobPlacement(objectId, job.placeholder || null);
    pollEditTextSession(job.id);
  } catch (error) {
    quickEditRun.disabled = false;
    showToast(error?.message || `${labelAction("edit-text")} ${t("jobFailed")}`);
  }
}

function configureComposerMode(action, object = null) {
  const isEditText = action === "edit-text";
  const isExpand = action === "expand";
  quickEditComposer.classList.toggle("edit-text-mode", isEditText);
  quickEditComposer.classList.toggle("expand-mode", isExpand);
  quickEditComposer.classList.toggle("quick-edit-mode", !isEditText && !isExpand);
  editTextPanel.hidden = !isEditText;
  expandPanel.hidden = !isExpand;
  quickEditPrompt.hidden = isEditText || isExpand;
  if (quickEditHint) quickEditHint.hidden = isEditText || isExpand;
  editTextPanel.querySelector(".edit-text-title").textContent = t("editTextTitle");
  quickEditRun.textContent = !isEditText && !isExpand ? t("applyAnnotations") : t("run");
  if (isExpand) {
    quickEditPrompt.value = "";
    activeTextRecognitionId = null;
    editTextItems = [];
    editTextList.replaceChildren();
    editTextStatus.textContent = "";
    quickEditRun.disabled = false;
    initializeExpandPreview(object);
    syncExpandControls();
    updateExpandPreview();
    return;
  }
  if (isEditText) {
    quickEditPrompt.value = "";
    editTextItems = [];
    renderEditTextItems("loading");
  } else {
    activeTextRecognitionId = null;
    editTextItems = [];
    editTextList.replaceChildren();
    editTextStatus.textContent = "";
    quickEditRun.disabled = false;
    updateExpandPreview();
    updateQuickEditRunState();
  }
}

function updateQuickEditRunState() {
  if (quickEditAction !== "quick-edit" || !quickEditObjectId || quickEditComposer.hidden) return;
  const hasPrompt = Boolean(quickEditPrompt.value.trim());
  const hasAnnotations = quickEditAnnotationsForTarget(quickEditObjectId).length > 0;
  quickEditRun.disabled = !hasPrompt && !hasAnnotations;
}

async function startTextRecognition(objectId) {
  const recognitionToken = `${objectId}:${Date.now()}`;
  activeTextRecognitionId = recognitionToken;
  quickEditRun.disabled = true;
  renderEditTextItems("loading");

  try {
    const response = await fetch(apiPath("/api/text-recognition"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objectId })
    });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || t("jobFailed"));
    if (pendingTextRecognitionCancels.delete(recognitionToken) || activeTextRecognitionId !== recognitionToken) {
      cancelTextRecognitionSession(job.id);
      return;
    }
    activeTextRecognitionId = job.id;
    pollTextRecognitionJob(job.id);
  } catch (error) {
    if (activeTextRecognitionId !== recognitionToken) return;
    editTextStatus.textContent = error?.message || t("jobFailed");
    quickEditRun.disabled = true;
  }
}

function cancelTextRecognitionSession(sessionId) {
  fetch(apiPath(`/api/text-recognition/${sessionId}/run`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "edit-text", cancelled: true })
  }).catch(() => {});
}

function pollTextRecognitionJob(jobId) {
  const tick = async () => {
    if (quickEditAction !== "edit-text" || activeTextRecognitionId !== jobId) return;
    try {
      const response = await fetch(apiPath(`/api/text-recognition/${jobId}`));
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || "Text recognition request failed.");
      if (job.stage === "ready") {
        editTextItems = (job.items || []).map((item) => ({
          ...item,
          editedText: item.text
        }));
        renderEditTextItems("done");
        return;
      }
      if (job.status === "done") return;
      if (job.status === "failed") {
        editTextItems = [];
        editTextStatus.textContent = `${labelAction("edit-text")} ${t("jobFailed")} ${job.error || ""}`.trim();
        quickEditRun.disabled = true;
        return;
      }
      window.setTimeout(tick, 1800);
    } catch (error) {
      editTextStatus.textContent = error?.message || t("jobFailed");
      quickEditRun.disabled = true;
    }
  };
  window.setTimeout(tick, 900);
}

function pollEditTextSession(jobId) {
  const tick = async () => {
    try {
      const response = await fetch(apiPath(`/api/text-recognition/${jobId}`));
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || "Edit Text status request failed.");
      if (job.status === "done") {
        showToast(`${labelAction("edit-text")} ${t("jobDone")}`);
        await loadState();
        return;
      }
      if (job.status === "failed") {
        showToast(`${labelAction("edit-text")} ${t("jobFailed")} ${job.error || ""}`.trim());
        return;
      }
      window.setTimeout(tick, 2500);
    } catch (error) {
      showToast(error?.message || t("jobFailed"));
    }
  };
  window.setTimeout(tick, 2500);
}

function renderEditTextItems(status) {
  editTextList.replaceChildren();
  editTextStatus.textContent = "";

  if (status === "loading") {
    editTextStatus.textContent = t("editTextRecognizing");
    quickEditRun.disabled = true;
    return;
  }

  if (!editTextItems.length) {
    editTextStatus.textContent = t("editTextNoText");
    quickEditRun.disabled = true;
    return;
  }

  editTextItems.forEach((item, index) => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = item.editedText || item.text;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", `${t("editTextTitle")} ${index + 1}`);
    input.addEventListener("input", () => {
      editTextItems[index].editedText = input.value;
      updateEditTextRunState();
    });
    editTextList.append(input);
  });

  updateEditTextRunState();
  window.requestAnimationFrame(() => {
    updateQuickEditPosition();
    editTextList.querySelector("input")?.focus();
  });
}

function updateEditTextRunState() {
  if (quickEditAction !== "edit-text") return;
  quickEditRun.disabled = !editTextItems.some((item) => String(item.editedText || "").trim() && String(item.editedText || "").trim() !== item.text);
}

function syncExpandControls() {
  if (expandScale) expandScale.value = expandConfig.scale || "1";
  if (expandPreset) expandPreset.value = expandConfig.preset || "general";
  updateExpandRatioButtons();
}

function updateExpandRatioButtons() {
  expandRatios?.querySelectorAll("[data-expand-ratio]").forEach((button) => {
    const active = button.dataset.expandRatio === expandConfig.ratio;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
  });
}

function updateExpandPreviewPosition() {
  const object = state?.objects?.find((item) => item.id === quickEditObjectId);
  if (!object || !expandConfig.frame) return;
  expandConfig.placement = expandPlacementForObject(object, expandConfig.frame);
}

function currentExpandOptions() {
  const object = state?.objects?.find((item) => item.id === quickEditObjectId);
  const frame = object ? expandPreviewRect(object) : expandConfig.frame;
  return {
    scale: expandConfig.scale || "1",
    preset: expandConfig.preset || "general",
    ratio: expandConfig.ratio || "original",
    placement: object && frame ? expandPlacementForObject(object, frame) : expandConfig.placement || null
  };
}

function expandPlacementForObject(object, frame) {
  return {
    x: Number(((object.x - frame.x) / Math.max(1, frame.width)).toFixed(5)),
    y: Number(((object.y - frame.y) / Math.max(1, frame.height)).toFixed(5)),
    width: Number((object.width / Math.max(1, frame.width)).toFixed(5)),
    height: Number((object.height / Math.max(1, frame.height)).toFixed(5))
  };
}

function restoreExpandPreviewSource() {
  const start = expandConfig.sourceStart;
  if (!start?.id) return;
  const object = state?.objects?.find((item) => item.id === start.id);
  if (!object) return;
  object.x = start.x;
  object.y = start.y;
  const element = objectLayer.querySelector(`[data-id="${CSS.escape(object.id)}"]`);
  if (element) {
    element.style.left = `${object.x}px`;
    element.style.top = `${object.y}px`;
  }
}

function updateExpandPreview() {
  if (quickEditAction === "expand" && quickEditObjectId && !quickEditComposer.hidden) {
    const object = state?.objects?.find((item) => item.id === quickEditObjectId);
    if (object) {
      if (!expandConfig.frame) expandConfig.frame = expandPreviewRect(object);
      updateExpandPreviewPosition();
      if (!workflowResultScreenBounds(object.id)) frameObjectForQuickEdit(object, "expand");
    }
  }
  objectLayer.querySelector(".expand-preview-frame")?.remove();
  const frame = renderExpandPreviewFrame();
  if (frame) objectLayer.append(frame);
  updateQuickEditPosition();
}

function composerPlaceholder(action) {
  if (action === "edit-text") return t("editTextPlaceholder");
  if (action === "expand") return t("expandPlaceholder");
  return t("quickEditPlaceholder");
}

function composerEmptyMessage(action) {
  if (action === "edit-text") return t("editTextEmpty");
  if (action === "expand") return t("expandEmpty");
  return t("quickEditEmpty");
}

function isComposerActive() {
  return Boolean(quickEditComposer && !quickEditComposer.hidden && quickEditComposer.contains(document.activeElement));
}

function pollImageJob(jobId) {
  window.clearTimeout(runningJobs.get(jobId));
  const tick = async () => {
    try {
      const response = await fetch(apiPath(`/api/jobs/${jobId}`));
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || "Job status request failed.");
      if (job.status === "done") {
        runningJobs.delete(jobId);
        jobCenterJobs = jobCenterJobs.map((item) => item.id === job.id ? job : item);
        renderJobCenter();
        showToast(`${labelAction(job.action)} ${t("jobDone")}`);
        await loadState();
        return;
      }
      if (job.status === "failed") {
        runningJobs.delete(jobId);
        jobCenterJobs = jobCenterJobs.map((item) => item.id === job.id ? job : item);
        renderJobCenter();
        showToast(`${labelAction(job.action)} ${t("jobFailed")} ${job.error || ""}`.trim());
        return;
      }
      if (job.status === "cancelled") {
        runningJobs.delete(jobId);
        jobCenterJobs = jobCenterJobs.map((item) => item.id === job.id ? job : item);
        renderJobCenter();
        await loadState();
        return;
      }
      runningJobs.set(jobId, window.setTimeout(tick, 2500));
    } catch (error) {
      runningJobs.delete(jobId);
      showToast(error?.message || t("jobFailed"));
    }
  };
  runningJobs.set(jobId, window.setTimeout(tick, 2500));
}

function ensureQuickEditAnnotationSessionId() {
  if (quickEditAnnotationSessionId) return quickEditAnnotationSessionId;
  quickEditAnnotationSessionId = typeof crypto.randomUUID === "function"
    ? `qe_${crypto.randomUUID()}`
    : `qe_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return quickEditAnnotationSessionId;
}

function quickEditAnnotationMetadata(role) {
  if (quickEditAction !== "quick-edit" || !quickEditObjectId) return {};
  return {
    annotationTargetId: quickEditObjectId,
    annotationSessionId: ensureQuickEditAnnotationSessionId(),
    annotationRole: role
  };
}

function quickEditAnnotationsForTarget(targetId) {
  const target = state?.objects?.find((object) => object.id === targetId && (object.type || "image") === "image");
  if (!target) return [];
  return state.objects.filter((object) => {
    if (!object || object.id === targetId) return false;
    if (typeof object.annotationTargetId === "string" && object.annotationTargetId) {
      return object.annotationTargetId === targetId
        && ["annotation", "drawing", "text"].includes(object.type);
    }
    return ["drawing", "text"].includes(object.type) && rectsIntersect(target, object);
  });
}

function saveAnnotationLabel(id, value) {
  const object = state.objects.find((item) => item.id === id && item.type === "annotation");
  if (!object) return Promise.resolve();
  const nextLabel = String(value || "").trim();
  const previousLabel = String(object.label || "");
  if (nextLabel === previousLabel) {
    render();
    updateQuickEditRunState();
    return Promise.resolve();
  }
  const selection = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();
  object.label = nextLabel;
  updateQuickEditRunState();
  return commitObjectUpdateHistory({
    before: [{ id, patch: { label: previousLabel } }],
    after: [{ id, patch: { label: nextLabel } }],
    selectionBefore: selection,
    selectionAfter: selection,
    scopeMeta
  });
}

function focusAnnotationLabel(id) {
  window.requestAnimationFrame(() => {
    const label = objectLayer.querySelector(`[data-id="${CSS.escape(id)}"] .annotation-label`);
    if (!label) return;
    label.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(label);
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
}

function flushEditingAnnotationObject() {
  if (!editingAnnotationId) return Promise.resolve();
  const id = editingAnnotationId;
  const label = objectLayer.querySelector(`[data-id="${CSS.escape(id)}"] .annotation-label`);
  editingAnnotationId = null;
  return saveAnnotationLabel(id, label?.textContent || "");
}

// Text layout constants (similar to Figma/Photoshop behavior)
const TEXT_DEFAULT_WIDTH = 200;
const TEXT_MIN_WIDTH = 60;
const TEXT_MAX_AUTO_WIDTH = 400;
const TEXT_LINE_HEIGHT_FACTOR = 1.4;

function measureTextContentSize(object, text, options = {}) {
  const probe = document.createElement("div");
  probe.className = "text-content";
  probe.textContent = text ?? object.text ?? "";
  probe.style.cssText = [
    "position: fixed",
    "visibility: hidden",
    "left: -99999px",
    "top: 0",
    "width: max-content",
    "height: auto",
    "min-height: 0",
    "pointer-events: none"
  ].join(";");
  probe.style.fontSize = `${object.fontSize || 28}px`;
  probe.style.fontFamily = object.fontFamily || getComputedStyle(document.body).fontFamily;
  probe.style.fontWeight = object.fontWeight || "400";
  probe.style.fontStyle = object.fontStyle || "normal";
  probe.style.textDecoration = object.textDecoration || "none";
  probe.style.textAlign = object.textAlign || "left";
  document.body.append(probe);
  let width = Math.ceil(probe.getBoundingClientRect().width);
  let height = Math.ceil(probe.getBoundingClientRect().height);
  if (options.maxWidth && width > options.maxWidth) {
    probe.style.width = `${options.maxWidth}px`;
    width = options.maxWidth;
    height = Math.ceil(probe.getBoundingClientRect().height);
  }
  probe.remove();
  return { width, height };
}

function saveTextObject(id, text) {
  const object = state.objects.find((item) => item.id === id);
  if (!object) return;
  const nextText = text.trim() || t("textPlaceholder");
  const previousText = object.text || t("textPlaceholder");
  const currentWidth = object.width;
  const currentHeight = object.height;
  const selection = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();
  const previousSize = { width: currentWidth, height: currentHeight };
  object.text = nextText;
  commitObjectUpdateHistory({
    before: [{ id, patch: { text: previousText, ...previousSize } }],
    after: [{ id, patch: { text: nextText, width: currentWidth, height: currentHeight } }],
    selectionBefore: selection,
    selectionAfter: selection,
    scopeMeta
  });
}

function focusTextObject(id) {
  window.requestAnimationFrame(() => {
    const text = objectLayer.querySelector(`[data-id="${id}"] .text-content`);
    if (!text) return;
    text.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(text);
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

function frameSelectedImageForViewing(object) {
  if (!object || (object.type || "image") !== "image") return;
  closeQuickEdit({ keepPrompt: true });
  setLocalSelection([object.id], { fromUser: true });
  const groupId = selectedLayerGroupId();
  frameWorldBounds(groupId ? layerGroupBounds(groupId) : boundsForObjects([object]), {
    paddingX: 88,
    paddingTop: 104,
    paddingBottom: 148,
    minZoom: 0.18,
    maxZoom: 1.28
  });
}

function isShortcutEditingTarget(target) {
  if (isEditableTarget(target)) return true;
  return Boolean(target.closest("button, [role='button'], .selection-toolbar, .quick-edit-composer, .settings-menu, .color-palette, .prompt-history-panel, .layer-browser-panel, .canvas-search"));
}

function canvasHistoryShortcut(event) {
  if (event.defaultPrevented || event.altKey || event.isComposing) return null;
  const key = event.key.toLowerCase();
  if (key === "z" && (event.metaKey || event.ctrlKey)) {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) return "redo";
  return null;
}

function isNativeUndoTarget(target) {
  return isEditableTarget(target) || Boolean(target.closest(".quick-edit-composer, .prompt-history-panel, .layer-browser-panel, .canvas-search"));
}

function isDeleteEditingTarget(target) {
  if (target.closest("input, textarea, .layer-browser-panel")) return true;
  const editableText = target.closest(".text-content[contenteditable='true']");
  const editableAnnotation = target.closest(".annotation-label[contenteditable='true']");
  return Boolean((editableText && editingTextId === selectedId)
    || (editableAnnotation && editingAnnotationId === selectedId));
}

function setActiveTool(tool) {
  activeTool = tool || defaultCanvasTool;
  toolDock.querySelectorAll("[data-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === activeTool);
  });
  quickEditMarkupControls?.querySelectorAll("[data-quick-edit-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.quickEditTool === activeTool);
    button.setAttribute("aria-pressed", String(button.dataset.quickEditTool === activeTool));
  });
  board.classList.toggle("tool-hand", activeTool === "hand");
  board.classList.toggle("tool-pencil", activeTool === "pencil");
  board.classList.toggle("tool-text", activeTool === "text");
  board.classList.toggle("tool-annotation", activeTool === "annotation");
  updateColorPalette();
}

function setSpacePanPressed(pressed) {
  spacePanPressed = Boolean(pressed);
  board.classList.toggle("space-pan", spacePanPressed);
}

function loadToolColor() {
  const stored = localStorage.getItem(toolColorStorageKey);
  return toolColors.includes(stored) ? stored : toolColors[0];
}

function renderColorPalette() {
  renderColorPaletteInto(colorPalette);
  if (quickEditColorPalette) renderColorPaletteInto(quickEditColorPalette);
  updateColorPalette();
}

function renderColorPaletteInto(container) {
  container.replaceChildren();
  for (const color of toolColors) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-swatch";
    button.dataset.color = color;
    button.style.setProperty("--swatch-color", color);
    button.title = color;
    button.setAttribute("aria-label", `Use color ${color}`);
    container.append(button);
  }
}

function updateColorPalette() {
  const showDockPalette = imageEditState.mode === "idle"
    && !quickEditObjectId
    && ["annotation", "pencil", "text"].includes(activeTool);
  colorPalette.hidden = !showDockPalette;
  toolDock.classList.toggle("has-visible-color-palette", showDockPalette);
  for (const palette of [colorPalette, quickEditColorPalette].filter(Boolean)) {
    palette.querySelectorAll("[data-color]").forEach((button) => {
      button.classList.toggle("active", button.dataset.color === activeColor);
    });
  }
}

function setActiveColor(color) {
  if (!toolColors.includes(color)) return;
  activeColor = color;
  localStorage.setItem(toolColorStorageKey, activeColor);
  updateColorPalette();
  const object = state?.objects.find((item) => item.id === selectedId);
  if (!object) return;
  const selection = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();
  if (object.type === "drawing") {
    const previous = object.stroke || "#202124";
    if (previous === activeColor) return;
    object.stroke = activeColor;
    commitObjectUpdateHistory({
      before: [{ id: object.id, patch: { stroke: previous } }],
      after: [{ id: object.id, patch: { stroke: activeColor } }],
      selectionBefore: selection,
      selectionAfter: selection,
      scopeMeta
    });
  } else if (object.type === "text") {
    const previous = object.color || "#202124";
    if (previous === activeColor) return;
    object.color = activeColor;
    commitObjectUpdateHistory({
      before: [{ id: object.id, patch: { color: previous } }],
      after: [{ id: object.id, patch: { color: activeColor } }],
      selectionBefore: selection,
      selectionAfter: selection,
      scopeMeta
    });
  } else if (object.type === "annotation") {
    const previous = object.color || defaultQuickEditMarkColor;
    if (previous === activeColor) return;
    object.color = activeColor;
    commitObjectUpdateHistory({
      before: [{ id: object.id, patch: { color: previous } }],
      after: [{ id: object.id, patch: { color: activeColor } }],
      selectionBefore: selection,
      selectionAfter: selection,
      scopeMeta
    });
  }
}

function loadLanguage() {
  const stored = localStorage.getItem(languageStorageKey);
  if (stored === "en" || stored === "zh") return stored;
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function setLanguage(nextLanguage) {
  if (!translations[nextLanguage]) return;
  language = nextLanguage;
  localStorage.setItem(languageStorageKey, language);
  applyLanguage();
}

async function refreshAppUpdateStatus({ checkRemote = false, showToastOnError = false } = {}) {
  appUpdateBusy = true;
  renderAppUpdateStatus({ label: t("updateChecking"), disabled: true });
  try {
    const response = await fetch(apiPath(checkRemote ? "/api/app-update/check" : "/api/app-update"), checkRemote ? {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    } : undefined);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t("updateFailed"));
    appUpdateInfo = payload;
    renderAppUpdateStatus();
  } catch (error) {
    appUpdateInfo = null;
    renderAppUpdateStatus({ label: t("updateUnavailable"), disabled: false });
    if (showToastOnError) showToast(error?.message || t("updateFailed"));
  } finally {
    appUpdateBusy = false;
  }
}

async function runAppUpdate() {
  appUpdateBusy = true;
  renderAppUpdateStatus({ label: t("updateRunning"), disabled: true });
  try {
    const response = await fetch(apiPath("/api/app-update"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t("updateFailed"));
    appUpdateInfo = payload;
    renderAppUpdateStatus();
    showToast(t("updateDone"));
  } catch (error) {
    renderAppUpdateStatus({ label: t("updateFailed"), disabled: false });
    showToast(error?.message || t("updateFailed"));
  } finally {
    appUpdateBusy = false;
  }
}

function renderAppUpdateStatus(override = null) {
  renderSettingsUpdateIndicator();
  if (!appUpdateButton || !appVersionValue || !appUpdateStatus) return;
  const version = runtimeServerInfo?.version || appUpdateInfo?.installedVersion || appUpdateInfo?.pluginVersion || appUpdateInfo?.version || "...";
  renderRuntimeIdentity();
  appUpdateButton.disabled = Boolean(override?.disabled);

  if (override) {
    appUpdateStatus.textContent = override.label || "";
    appUpdateButton.title = "";
    appUpdateButton.setAttribute("aria-label", `${t("appVersion")}: ${version}`);
    return;
  }

  if (!appUpdateInfo) {
    appUpdateStatus.textContent = "";
    appUpdateButton.title = "";
    appUpdateButton.setAttribute("aria-label", `${t("appVersion")}: ${version}`);
    return;
  }

  if (!appUpdateInfo.canUpdate) {
    appUpdateStatus.textContent = appUpdateBlockedLabel(appUpdateInfo.blockedReason);
    appUpdateButton.title = appUpdateInfo.blockedMessage || "";
    appUpdateButton.setAttribute("aria-label", `${t("appVersion")}: ${version}, ${appUpdateStatus.textContent}`);
    return;
  }
  appUpdateButton.title = appUpdateInfo.manualCommand || "";

  if (appUpdateInfo.updateAvailable) {
    appUpdateStatus.textContent = t("updateAvailable");
  } else {
    appUpdateStatus.textContent = t("updateCurrent");
  }
  appUpdateButton.setAttribute("aria-label", `${t("appVersion")}: ${version}, ${appUpdateStatus.textContent}`);
}

function renderSettingsUpdateIndicator() {
  const updateAvailable = Boolean(appUpdateInfo?.updateAvailable);
  settingsButton.classList.toggle("update-available", updateAvailable);
  const label = updateAvailable
    ? `${t("settings")}: ${t("updateAvailable")}`
    : t("settings");
  settingsButton.title = label;
  settingsButton.setAttribute("aria-label", label);
}

function appUpdateBlockedLabel(reason) {
  const labels = {
    "dirty-worktree": "updateBlockedDirty",
    "local-ahead": "updateBlockedAhead",
    "detached-head": "updateBlockedDetached",
    "no-upstream": "updateBlockedNoUpstream",
    "not-git": "updateBlockedNotGit",
    "source-not-found": "updateBlockedSource",
    "plugin-reinstall-unavailable": "updateBlockedSource",
    "remote-check-failed": "updateBlockedRemote",
    "release-check-failed": "updateBlockedRemote",
    "release-version-mismatch": "updateBlockedRelease",
    "release-not-fast-forward": "updateBlockedRelease",
    "plugin-reinstall-invalid": "updateBlockedRelease"
  };
  return t(labels[reason] || "updateUnavailable");
}

function applyLanguage() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  if (quickEditAction) {
    quickEditPrompt.placeholder = composerPlaceholder(quickEditAction);
    if (quickEditHint) quickEditHint.textContent = t("quickEditHint");
    quickEditRun.textContent = quickEditAction === "quick-edit" ? t("applyAnnotations") : t("run");
    editTextPanel.querySelector(".edit-text-title").textContent = t("editTextTitle");
    if (quickEditAction === "edit-text" && !editTextItems.length && editTextStatus.textContent) {
      editTextStatus.textContent = activeTextRecognitionId ? t("editTextRecognizing") : t("editTextNoText");
    }
  }

  projectOptionsButton.title = t("projectOptions");
  projectOptionsButton.setAttribute("aria-label", t("projectOptions"));
  settingsButton.title = t("settings");
  settingsButton.setAttribute("aria-label", t("settings"));
  board.setAttribute("aria-label", t("codexCanvas"));
  toolDock.setAttribute("aria-label", t("canvasTools"));
  canvasSearch.input.placeholder = t("searchPlaceholder");
  canvasSearch.input.setAttribute("aria-label", t("searchLabel"));
  canvasSearch.type.setAttribute("aria-label", t("searchLabel"));
  canvasSearch.panel.setAttribute("aria-label", t("searchLabel"));
  canvasSearch.type.querySelectorAll("[data-search-type-option]").forEach((option) => {
    option.textContent = option.value ? objectTypeLabel(option.value) : t("searchAllTypes");
  });
  if (canvasSearch.panel.classList.contains("active")) {
    renderCanvasSearchResults(searchResults);
  }
  document.querySelector(".canvas-controls")?.setAttribute("aria-label", t("canvasViewControls"));
  settingsMenu.querySelector("[data-settings-row='language']")?.setAttribute("aria-label", t("language"));
  const currentLanguage = settingsMenu.querySelector("[data-language-current]");
  if (currentLanguage) currentLanguage.textContent = language === "zh" ? "简体中文" : "English";
  renderAppUpdateStatus();
  renderProjectMenu();
  updateLayerBrowserLabels();
  updateJobCenterLabels();
  updatePromptHistoryLabels();

  settingsMenu.querySelectorAll("[data-language]").forEach((button) => {
    const isSelected = button.dataset.language === language;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    // 排除文字工具栏的所有按钮（通过 closest 或 data-text-toolbar 属性）
    if (button.closest("#textToolbar") || button.closest("[data-text-toolbar]")) return;
    const label = actionLabel(button.dataset.action);
    button.dataset.tooltip = label;
    button.title = label;
    button.setAttribute("aria-label", label);
    const span = button.querySelector("span:not(.context-icon):not(.resolution-label):not(.text-select-label):not(.text-color-dot)");
    if (span) span.textContent = label;
  });

  document.querySelectorAll("[data-tool]").forEach((button) => {
    const label = toolLabel(button.dataset.tool);
    button.dataset.tooltip = label;
    button.title = label;
    button.setAttribute("aria-label", label);
  });

  document.querySelectorAll("[data-quick-edit-tool]").forEach((button) => {
    const label = toolLabel(button.dataset.quickEditTool);
    button.dataset.tooltip = label;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(button.dataset.quickEditTool === activeTool));
  });

  document.querySelectorAll("[data-view-action]").forEach((button) => {
    const label = viewActionLabel(button.dataset.viewAction);
    button.dataset.tooltip = label;
    button.title = label;
    button.setAttribute("aria-label", label);
  });

  document.querySelectorAll("[data-history-action]").forEach((button) => {
    const label = historyActionLabel(button.dataset.historyAction);
    button.dataset.tooltip = label;
    button.title = label;
    button.setAttribute("aria-label", label);
  });

  renderCanvasHistoryStatus();

  // 分辨率切换按钮的 tooltip/label 由 updateResolutionToggleUi 单独管理，
  // 需在 applyLanguage 覆盖后重新同步，避免显示为 action 名。
  updateResolutionToggleUi();

  // 恢复文字工具栏的标签，防止被全局 actionLabel 覆盖
  restoreTextToolbarLabels();

  if (state) updateSelectionUi();
}

// 恢复文字工具栏的内部标签，防止被全局 actionLabel 覆盖
function restoreTextToolbarLabels() {
  if (!textToolbar) return;
  
  // 恢复字体标签 "Aa"
  const fontLabel = textToolbar.querySelector("#textFontLabel");
  if (fontLabel) fontLabel.textContent = "Aa";
  
  // 恢复字号标签（保持当前值）
  const fontSizeLabel = textToolbar.querySelector("#textFontSizeLabel");
  if (fontSizeLabel) {
    const currentText = fontSizeLabel.textContent;
    if (!currentText.match(/^\d+$/)) {
      fontSizeLabel.textContent = "28";
    }
  }
  
  // 清空颜色圆点的文字内容，只通过 background 显示颜色
  const colorDot = textToolbar.querySelector("#textColorDot");
  if (colorDot) colorDot.textContent = "";
  
  // 确保文字工具栏主按钮的直接文本节点被清理（排除下拉菜单内的按钮）
  textToolbar.querySelectorAll("button").forEach((btn) => {
    if (btn.closest(".text-dropdown-menu, .text-color-palette, .text-color-custom-wrap, .text-size-custom-wrap")) return;
    // 清理直接文本节点
    [...btn.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        btn.removeChild(node);
      }
    });
  });
}

function updatePromptHistoryLabels() {
  if (!promptHistoryUi) return;
  const label = t("promptHistory");
  promptHistoryUi.button.title = label;
  promptHistoryUi.button.dataset.tooltip = label;
  promptHistoryUi.button.setAttribute("aria-label", label);
  promptHistoryUi.title.textContent = label;
  promptHistoryUi.search.placeholder = promptHistoryMode === "versions" ? t("versionBrowserSearch") : t("promptHistorySearch");
  promptHistoryUi.search.setAttribute("aria-label", promptHistoryUi.search.placeholder);
  promptHistoryUi.groupByLabel.textContent = t("versionGroupLabel");
  promptHistoryUi.groupByWrap.hidden = promptHistoryMode !== "versions";
  promptHistoryUi.tabs.forEach((tab) => {
    const active = tab.dataset.discoveryMode === promptHistoryMode;
    tab.textContent = tab.dataset.discoveryMode === "versions" ? t("versionBrowserTab") : t("promptHistoryTab");
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.setAttribute("role", "tab");
  });
  const labels = {
    sourceObjectId: t("versionGroupSource"),
    batchId: t("versionGroupBatch"),
    layoutMode: t("versionGroupLayout"),
    prompt: t("versionGroupPrompt")
  };
  promptHistoryUi.groupBy.querySelectorAll("option").forEach((option) => {
    option.textContent = labels[option.value] || option.value;
  });
}

function t(key) {
  return translations[language]?.[key] || translations.en[key] || key;
}

function actionLabel(action) {
  return translations[language].actions[action] || translations.en.actions[action] || action;
}

function toolLabel(tool) {
  return translations[language].tools[tool] || translations.en.tools[tool] || tool;
}

function viewActionLabel(action) {
  if (action === "upload") return translations[language].tools["upload-image"];
  if (action === "add-slides") return language === "zh" ? "添加幻灯片" : "Add slides";
  if (action === "reset") return translations[language].controls.reset;
  return action;
}

function historyActionLabel(action) {
  return translations[language].controls[action] || translations.en.controls[action] || action;
}

function objectTypeLabel(type) {
  const key = type || "image";
  return translations[language].objectTypes[key] || translations.en.objectTypes[key] || key;
}

function pointerToWorld(event) {
  const rect = board.getBoundingClientRect();
  return screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
}

function shouldUseNativeWheel(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], .quick-edit-composer, .canvas-search, .prompt-history-panel, .layer-browser-panel, .slides-generator, .slides-deck-sidebar"));
}

function normalizedWheelDelta(event) {
  if (event.deltaMode === 1) {
    return {
      x: event.deltaX * wheelLinePixelSize,
      y: event.deltaY * wheelLinePixelSize
    };
  }
  if (event.deltaMode === 2) {
    return {
      x: event.deltaX * Math.max(1, board.clientWidth),
      y: event.deltaY * Math.max(1, board.clientHeight)
    };
  }
  return { x: event.deltaX, y: event.deltaY };
}

function pathForPoints(points) {
  if (!points.length) return "";
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y}${rest.map((point) => ` L ${point.x} ${point.y}`).join("")}`;
}

function simplifyPoints(points) {
  const simplified = [];
  for (const point of points) {
    const previous = simplified.at(-1);
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
      simplified.push({ x: Math.round(point.x), y: Math.round(point.y) });
    }
  }
  return simplified;
}

function boundsForPoints(points, padding) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.max(1, Math.round(maxX - minX)),
    height: Math.max(1, Math.round(maxY - minY))
  };
}

function isEditableTarget(target) {
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

function movePan(event) {
  if (!pan || event.pointerId !== pan.pointerId) return;
  pan.moved ||= Math.hypot(event.clientX - pan.startX, event.clientY - pan.startY) > 4;
  if (!pan.moved) return;
  viewport.x = pan.viewportX + event.clientX - pan.startX;
  viewport.y = pan.viewportY + event.clientY - pan.startY;
  applyViewport();
  updateSelectionUi();
}

function endPan(event) {
  if (!pan || event.pointerId !== pan.pointerId) return;
  const activePan = pan;
  const pointerId = activePan.pointerId;
  pan = null;
  board.classList.remove("dragging");
  window.removeEventListener("pointermove", movePan);
  window.removeEventListener("pointerup", endPan);
  window.removeEventListener("pointercancel", endPan);
  board.removeEventListener("lostpointercapture", endPan);
  releaseBoardPointer(pointerId);
  if (event.type === "pointerup" && activePan.selectOnClick && !activePan.moved) {
    const objectId = state?.objects?.some((object) => object.id === activePan.clickedObjectId)
      ? activePan.clickedObjectId
      : null;
    if (objectId && (activePan.shiftKey || activePan.metaKey)) {
      const currentIds = new Set(selectedIds);
      if (currentIds.has(objectId)) currentIds.delete(objectId);
      else currentIds.add(objectId);
      setLocalSelection([...currentIds], { fromUser: true });
      render();
    } else {
      selectObject(objectId, { fromUser: Boolean(objectId) }).catch(() => {});
    }
    return;
  }
  saveViewport();
}

function scheduleViewportSave() {
  window.clearTimeout(viewportSaveTimer);
  viewportSaveTimer = window.setTimeout(saveViewport, 220);
}

async function saveViewport() {
  if (!state) return;
  state.viewport = viewport;
  await fetch(apiPath("/api/state"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ viewport })
  }).catch(() => {});
}

function resetViewport() {
  viewport = { x: 0, y: 0, zoom: 0.72 };
  applyViewport();
  updateSelectionUi();
  saveViewport();
}

function fitAllObjects() {
  const bounds = computeTightBounds();
  const rect = board.getBoundingClientRect();
  const margin = 80;

  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;

  if (worldWidth <= 0 || worldHeight <= 0) {
    resetViewport();
    return;
  }

  const zoomX = (rect.width - margin * 2) / worldWidth;
  const zoomY = (rect.height - margin * 2) / worldHeight;
  const newZoom = Math.max(0.12, Math.min(2.2, Math.min(zoomX, zoomY)));

  const worldCenterX = (bounds.minX + bounds.maxX) / 2;
  const worldCenterY = (bounds.minY + bounds.maxY) / 2;

  viewport.zoom = newZoom;
  viewport.x = rect.width / 2 - worldCenterX * newZoom;
  viewport.y = rect.height / 2 - worldCenterY * newZoom;

  applyViewport();
  updateSelectionUi();
  saveViewport();
}

function zoomViewport(factor) {
  const rect = board.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const newZoom = clamp(viewport.zoom * factor, 0.12, 2.2);
  const actualFactor = newZoom / viewport.zoom;

  viewport.x = centerX - (centerX - viewport.x) * actualFactor;
  viewport.y = centerY - (centerY - viewport.y) * actualFactor;
  viewport.zoom = newZoom;

  applyViewport();
  updateSelectionUi();
  scheduleViewportSave();
}

async function saveProjectTitle() {
  if (!state) return;
  const title = projectTitle.value.trim() || "Untitled";
  projectTitle.value = title;
  state.title = title;
  await fetch(apiPath("/api/state"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title })
  }).catch(() => {});
}

function renderBoardGrid() {
  if (!boardGrid || !boardGridContext) return;

  const rect = board.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));

  // Keep both the CSS box and backing store synchronized with the live board.
  // Internal workspace layout changes do not necessarily fire window.resize.
  boardGrid.style.width = `${width}px`;
  boardGrid.style.height = `${height}px`;
  if (boardGrid.width !== pixelWidth || boardGrid.height !== pixelHeight) {
    boardGrid.width = pixelWidth;
    boardGrid.height = pixelHeight;
    boardGridContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const ctx = boardGridContext;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Grid parameters: dot size in screen pixels (constant), spacing in world units
  const dotScreenSize = 2; // Fixed screen size for dots
  const minScreenSpacing = 20; // Minimum spacing in screen pixels

  // Calculate world spacing that produces desired screen spacing
  const worldSpacing = minScreenSpacing / viewport.zoom;

  // Convert viewport to world coordinates
  const worldLeft = -viewport.x / viewport.zoom;
  const worldTop = -viewport.y / viewport.zoom;
  const worldRight = (width - viewport.x) / viewport.zoom;
  const worldBottom = (height - viewport.y) / viewport.zoom;

  // Calculate grid start position (aligned to world spacing)
  const startX = Math.floor(worldLeft / worldSpacing) * worldSpacing;
  const startY = Math.floor(worldTop / worldSpacing) * worldSpacing;

  // Dot color: subtle dark gray dots
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";

  // Draw dots
  const dotScreenSizeScaled = dotScreenSize; // Keep screen size constant
  const radius = dotScreenSizeScaled / 2;

  for (let wx = startX; wx <= worldRight + worldSpacing; wx += worldSpacing) {
    for (let wy = startY; wy <= worldBottom + worldSpacing; wy += worldSpacing) {
      // Convert world coordinates to screen coordinates
      const sx = wx * viewport.zoom + viewport.x;
      const sy = wy * viewport.zoom + viewport.y;

      if (sx < -radius || sx > width + radius || sy < -radius || sy > height + radius) continue;

      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

let boardGridResizeFrame = 0;
const scheduleBoardGridRender = () => {
  window.cancelAnimationFrame(boardGridResizeFrame);
  boardGridResizeFrame = window.requestAnimationFrame(renderBoardGrid);
};

if (board && typeof ResizeObserver === "function") {
  const boardGridResizeObserver = new ResizeObserver(scheduleBoardGridRender);
  boardGridResizeObserver.observe(board);
} else {
  window.addEventListener("resize", scheduleBoardGridRender, { passive: true });
}

function applyViewport() {
  world.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
  world.style.setProperty("--canvas-inverse-zoom", String(1 / viewport.zoom));
  world.style.setProperty("--selection-border-width", `${1.5 / viewport.zoom}px`);
  world.style.setProperty("--resize-handle-size", `${10 / viewport.zoom}px`);
  world.style.setProperty("--resize-handle-offset", `${-5 / viewport.zoom}px`);
  world.style.setProperty("--resize-handle-border", `${1.5 / viewport.zoom}px`);
  world.style.setProperty("--resize-handle-radius", `${3 / viewport.zoom}px`);
  zoomLabel.textContent = `${Math.round(viewport.zoom * 100)}%`;
  updateCanvasMapViewport();
  renderBoardGrid();
  updateSelectionUi();
}

function syncMapWidthToControls() {
  const controls = document.querySelector(".canvas-controls");
  if (!controls || !canvasMap) return;
  const width = controls.getBoundingClientRect().width;
  if (width <= 0) return;
  // Set the container width first so clientWidth/clientHeight reflect final layout.
  canvasMap.style.width = `${Math.round(width)}px`;
  requestAnimationFrame(() => {
    // Use clientWidth/clientHeight (layout-complete integer pixels) instead of
    // getBoundingClientRect, which can return transitional fractional values while
    // the map is still laying out. Reading a mid-transition height previously left
    // the canvas backing store tiny (e.g. 22px), so all map content drew off-canvas.
    const cssW = Math.round(canvasMap.clientWidth);
    const cssH = Math.round(canvasMap.clientHeight);
    // Skip when layout isn't ready (mid-transition / hidden); keep the last good
    // backing-store size instead of clobbering it with a bogus value.
    if (cssW < 10 || cssH < 50) return;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    // Only reset (which clears the canvas) when the target size actually changed.
    if (canvasMapCanvas.width === targetW && canvasMapCanvas.height === targetH) return;
    canvasMapCanvas.width = targetW;
    canvasMapCanvas.height = targetH;
    canvasMapContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (canvasMapVisible) {
      renderCanvasMap();
      updateCanvasMapViewport();
    }
  });
}

// Get bounds for all workflow nodes (studio and result nodes)
function getWorkflowNodesBounds() {
  // Get workflow nodes from DOM to use actual rendered sizes
  const nodeElements = document.querySelectorAll("#workflowLayer .studio-node, #workflowLayer .result-node");
  if (!nodeElements || nodeElements.length === 0) {
    return null;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasNode = false;

  for (const element of nodeElements) {
    const left = parseFloat(element.style.left) || 0;
    const top = parseFloat(element.style.top) || 0;
    const width = element.offsetWidth || 0;
    const height = element.offsetHeight || 0;
    const right = left + width;
    const bottom = top + height;

    if (left < minX) minX = left;
    if (top < minY) minY = top;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
    hasNode = true;
  }

  if (!hasNode) return null;
  return { minX, minY, maxX, maxY };
}

function computeCanvasBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasObject = false;

  // Include canvas objects
  if (state && state.objects && state.objects.length > 0) {
    for (const obj of state.objects) {
      if (obj.hidden) continue;
      const left = obj.x || 0;
      const top = obj.y || 0;
      const right = left + (obj.width || 0);
      const bottom = top + (obj.height || 0);
      
      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
      hasObject = true;
    }
  }

  // Include workflow nodes
  const wfBounds = getWorkflowNodesBounds();
  if (wfBounds) {
    if (wfBounds.minX < minX) minX = wfBounds.minX;
    if (wfBounds.minY < minY) minY = wfBounds.minY;
    if (wfBounds.maxX > maxX) maxX = wfBounds.maxX;
    if (wfBounds.maxY > maxY) maxY = wfBounds.maxY;
    hasObject = true;
  }

  if (!hasObject) {
    canvasMapBounds = { minX: -2000, minY: -1500, maxX: 2000, maxY: 1500 };
    return canvasMapBounds;
  }

  // Keep enough breathing room without shrinking real content into thin marks.
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const padding = clamp(Math.round(Math.max(contentWidth, contentHeight) * 0.06), 120, 360);
  canvasMapBounds = {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding
  };
  return canvasMapBounds;
}

// Compute tight bounds without padding for fit-all view
function computeTightBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasObject = false;

  // Include canvas objects
  if (state && state.objects && state.objects.length > 0) {
    for (const obj of state.objects) {
      if (obj.hidden) continue;
      const left = obj.x || 0;
      const top = obj.y || 0;
      const right = left + (obj.width || 0);
      const bottom = top + (obj.height || 0);
      
      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
      hasObject = true;
    }
  }

  // Include workflow nodes
  const wfBounds = getWorkflowNodesBounds();
  if (wfBounds) {
    if (wfBounds.minX < minX) minX = wfBounds.minX;
    if (wfBounds.minY < minY) minY = wfBounds.minY;
    if (wfBounds.maxX > maxX) maxX = wfBounds.maxX;
    if (wfBounds.maxY > maxY) maxY = wfBounds.maxY;
    hasObject = true;
  }

  if (!hasObject) {
    return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
  }

  return { minX, minY, maxX, maxY };
}

function renderCanvasMap() {
  if (!canvasMapContext) return;
  
  const bounds = computeCanvasBounds();
  const mapWidth = canvasMap.clientWidth;
  const mapHeight = canvasMap.clientHeight;
  
  if (!mapWidth || !mapHeight) return;

  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;

  // Clear (transparent — CSS provides the dark grid background)
  canvasMapContext.clearRect(0, 0, mapWidth, mapHeight);

  if (!state || !state.objects) return;

  const scaleX = mapWidth / worldWidth;
  const scaleY = mapHeight / worldHeight;
  const scale = Math.min(scaleX, scaleY);
  
  const offsetX = (mapWidth - worldWidth * scale) / 2;
  const offsetY = (mapHeight - worldHeight * scale) / 2;
  canvasMapContext.imageSmoothingEnabled = false;

  // Higgsfield-style minimal rendering: dark muted blocks for light theme
  for (const obj of state.objects) {
    if (obj.hidden) continue;
    
    const x = (obj.x - bounds.minX) * scale + offsetX;
    const y = (obj.y - bounds.minY) * scale + offsetY;
    const w = (obj.width || 1) * scale;
    const h = (obj.height || 1) * scale;
    const isSelected = obj.id && selectedObjectIds().has(obj.id);
    const minSize = 4;

    if (obj.type === "html" || obj.type === "slide-frame") {
      const pageWidth = Math.max(minSize, w);
      const pageHeight = Math.max(minSize, h);
      canvasMapContext.fillStyle = isSelected ? "rgba(14, 165, 233, 0.22)" : "rgba(255, 255, 255, 0.88)";
      canvasMapContext.strokeStyle = isSelected ? "#0ea5e9" : "rgba(14, 165, 233, 0.72)";
      canvasMapContext.lineWidth = isSelected ? 1.5 : 1;
      canvasMapContext.fillRect(x, y, pageWidth, pageHeight);
      canvasMapContext.strokeRect(x + 0.5, y + 0.5, Math.max(1, pageWidth - 1), Math.max(1, pageHeight - 1));
      if (pageWidth >= 10 && pageHeight >= 7) {
        canvasMapContext.fillStyle = "rgba(14, 165, 233, 0.6)";
        canvasMapContext.fillRect(x + pageWidth * 0.12, y + pageHeight * 0.22, pageWidth * 0.5, Math.max(1, pageHeight * 0.08));
        canvasMapContext.fillStyle = "rgba(100, 116, 139, 0.35)";
        canvasMapContext.fillRect(x + pageWidth * 0.12, y + pageHeight * 0.42, pageWidth * 0.7, Math.max(1, pageHeight * 0.05));
        canvasMapContext.fillRect(x + pageWidth * 0.12, y + pageHeight * 0.56, pageWidth * 0.55, Math.max(1, pageHeight * 0.05));
      }
    } else if (obj.type === "image" || obj.type === "job") {
      if (isSelected) {
        // Selected object: blue accent color with border
        canvasMapContext.fillStyle = "rgba(47, 128, 237, 0.25)";
        canvasMapContext.fillRect(x, y, Math.max(minSize, w), Math.max(minSize, h));
        canvasMapContext.strokeStyle = "#2f80ed";
        canvasMapContext.lineWidth = 1.5;
        canvasMapContext.strokeRect(x, y, Math.max(minSize, w), Math.max(minSize, h));
      } else {
        // Unselected: light gray for minimal visual noise
        canvasMapContext.fillStyle = "rgba(100, 105, 115, 0.2)";
        canvasMapContext.fillRect(x, y, Math.max(minSize, w), Math.max(minSize, h));
        canvasMapContext.strokeStyle = "rgba(100, 105, 115, 0.3)";
        canvasMapContext.lineWidth = 0.5;
        canvasMapContext.strokeRect(x + 0.25, y + 0.25, Math.max(minSize, w) - 0.5, Math.max(minSize, h) - 0.5);
      }
    } else if (obj.type === "text") {
      if (isSelected) {
        canvasMapContext.fillStyle = "rgba(47, 128, 237, 0.22)";
      } else {
        canvasMapContext.fillStyle = "rgba(140, 145, 155, 0.2)";
      }
      canvasMapContext.fillRect(x, y, Math.max(1, w), Math.max(1, h));
    } else if (obj.type === "annotation") {
      if (isSelected) {
        canvasMapContext.fillStyle = "rgba(47, 128, 237, 0.25)";
      } else {
        canvasMapContext.fillStyle = "rgba(140, 145, 155, 0.25)";
      }
      canvasMapContext.beginPath();
      canvasMapContext.arc(x + w / 2, y + h / 2, Math.max(2, Math.max(w, h) / 2), 0, Math.PI * 2);
      canvasMapContext.fill();
    } else if (obj.type === "group-anchor") {
      if (isSelected) {
        canvasMapContext.fillStyle = "rgba(47, 128, 237, 0.2)";
      } else {
        canvasMapContext.fillStyle = "rgba(140, 145, 155, 0.18)";
      }
      canvasMapContext.fillRect(x, y, Math.max(1, w), Math.max(1, h));
    }
  }

  // Workflow nodes participate in the overview bounds, so they must also be
  // rendered; otherwise they create large blank areas and squash images into
  // misleading vertical lines.
  const workflowNodes = document.querySelectorAll("#workflowLayer .studio-node, #workflowLayer .result-node");
  for (const element of workflowNodes) {
    const left = Number.parseFloat(element.style.left) || 0;
    const top = Number.parseFloat(element.style.top) || 0;
    const width = element.offsetWidth || 1;
    const height = element.offsetHeight || 1;
    const x = (left - bounds.minX) * scale + offsetX;
    const y = (top - bounds.minY) * scale + offsetY;
    const w = Math.max(5, width * scale);
    const h = Math.max(5, height * scale);
    const selected = element.classList.contains("selected") || element.classList.contains("multi-selected");
    canvasMapContext.fillStyle = selected ? "rgba(47, 128, 237, 0.28)" : "rgba(112, 85, 214, 0.18)";
    canvasMapContext.strokeStyle = selected ? "#2f80ed" : "rgba(112, 85, 214, 0.42)";
    canvasMapContext.lineWidth = selected ? 1.5 : 1;
    canvasMapContext.fillRect(x, y, w, h);
    canvasMapContext.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
  }
}

function updateCanvasMapViewport() {
  if (!canvasMapViewport || !canvasMap) return;
  
  // Always compute fresh bounds
  const bounds = computeCanvasBounds();
  const mapWidth = canvasMap.clientWidth;
  const mapHeight = canvasMap.clientHeight;
  
  if (!mapWidth || !mapHeight) return;

  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;

  const scaleX = mapWidth / worldWidth;
  const scaleY = mapHeight / worldHeight;
  const scale = Math.min(scaleX, scaleY);
  
  const offsetX = (mapWidth - worldWidth * scale) / 2;
  const offsetY = (mapHeight - worldHeight * scale) / 2;

  const rect = board.getBoundingClientRect();
  
  // Convert viewport to world coordinates
  const worldLeft = -viewport.x / viewport.zoom;
  const worldTop = -viewport.y / viewport.zoom;
  const worldVisibleWidth = rect.width / viewport.zoom;
  const worldVisibleHeight = rect.height / viewport.zoom;

  // Convert to map coordinates
  let mapX = (worldLeft - bounds.minX) * scale + offsetX;
  let mapY = (worldTop - bounds.minY) * scale + offsetY;
  let mapW = worldVisibleWidth * scale;
  let mapH = worldVisibleHeight * scale;

  // Inner padding so the viewport box never touches the map edges
  const padding = 6;
  const innerLeft = padding;
  const innerTop = padding;
  const innerRight = mapWidth - padding;
  const innerBottom = mapHeight - padding;
  const innerWidth = innerRight - innerLeft;
  const innerHeight = innerBottom - innerTop;

  // Ensure minimum viewport size for visibility, but clamp to inner bounds
  const minSize = 16;
  const maxW = Math.max(minSize, innerWidth);
  const maxH = Math.max(minSize, innerHeight);
  
  // Clamp size first
  mapW = Math.min(Math.max(minSize, mapW), maxW);
  mapH = Math.min(Math.max(minSize, mapH), maxH);

  // Then clamp position
  mapX = Math.max(innerLeft, Math.min(innerRight - mapW, mapX));
  mapY = Math.max(innerTop, Math.min(innerBottom - mapH, mapY));

  canvasMapViewport.style.left = `${mapX}px`;
  canvasMapViewport.style.top = `${mapY}px`;
  canvasMapViewport.style.width = `${mapW}px`;
  canvasMapViewport.style.height = `${mapH}px`;
}

function panViewportToWorldPoint(worldX, worldY) {
  viewport.x = -worldX * viewport.zoom;
  viewport.y = -worldY * viewport.zoom;
  applyViewport();
  updateSelectionUi();
  scheduleViewportSave();
}

function handleCanvasMapPointerDown(event) {
  event.stopPropagation();
  
  canvasMapDragging = true;
  canvasMapMoved = false;
  canvasMapStartPointer = { x: event.clientX, y: event.clientY };
  canvasMapLastPointer = { x: event.clientX, y: event.clientY };
  
  window.addEventListener("pointermove", handleCanvasMapPointerMove);
  window.addEventListener("pointerup", handleCanvasMapPointerUp, { once: true });
  window.addEventListener("pointercancel", handleCanvasMapPointerUp, { once: true });
}

function handleCanvasMapPointerMove(event) {
  if (!canvasMapDragging) return;
  
  const dx = event.clientX - canvasMapStartPointer.x;
  const dy = event.clientY - canvasMapStartPointer.y;
  
  // Only start panning if pointer moved more than 3 pixels
  if (!canvasMapMoved && Math.sqrt(dx * dx + dy * dy) > 3) {
    canvasMapMoved = true;
  }
  
  if (canvasMapMoved) {
    panCanvasMapFromEvent(event);
  }
}

function handleCanvasMapPointerUp(event) {
  if (!canvasMapDragging) return;
  
  const wasDragging = canvasMapMoved;
  const startPtr = canvasMapStartPointer;
  const endX = event ? event.clientX : canvasMapLastPointer?.x;
  const endY = event ? event.clientY : canvasMapLastPointer?.y;
  
  canvasMapDragging = false;
  canvasMapMoved = false;
  canvasMapLastPointer = null;
  canvasMapStartPointer = null;
  
  window.removeEventListener("pointermove", handleCanvasMapPointerMove);
  window.removeEventListener("pointerup", handleCanvasMapPointerUp);
  window.removeEventListener("pointercancel", handleCanvasMapPointerUp);
  
  // If it was a click (not drag), navigate to that point
  if (!wasDragging && startPtr && endX != null && endY != null) {
    // Clear cached bounds to ensure fresh calculation
    canvasMapBounds = null;
    navigateToMapPoint(endX, endY);
  }
}

function navigateToMapPoint(screenX, screenY) {
  if (!canvasMap) return;
  
  // Force fresh bounds calculation
  const bounds = computeCanvasBounds();
  const mapWidth = canvasMap.clientWidth;
  const mapHeight = canvasMap.clientHeight;
  
  if (!mapWidth || !mapHeight) return;
  
  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;
  
  if (worldWidth <= 0 || worldHeight <= 0) return;
  
  const scaleX = mapWidth / worldWidth;
  const scaleY = mapHeight / worldHeight;
  const scale = Math.min(scaleX, scaleY);
  
  const offsetX = (mapWidth - worldWidth * scale) / 2;
  const offsetY = (mapHeight - worldHeight * scale) / 2;
  
  const rect = canvasMap.getBoundingClientRect();
  const localX = screenX - rect.left;
  const localY = screenY - rect.top;
  
  // Clamp to map bounds
  const clampedX = Math.max(0, Math.min(mapWidth, localX));
  const clampedY = Math.max(0, Math.min(mapHeight, localY));
  
  const worldX = (clampedX - offsetX) / scale + bounds.minX;
  const worldY = (clampedY - offsetY) / scale + bounds.minY;
  
  panViewportToWorldPoint(worldX, worldY);
}

function panCanvasMapFromEvent(event) {
  // Always use fresh bounds during drag
  const bounds = computeCanvasBounds();
  const mapWidth = canvasMap.clientWidth;
  const mapHeight = canvasMap.clientHeight;
  
  if (!mapWidth || !mapHeight) return;

  const worldWidth = bounds.maxX - bounds.minX;
  const worldHeight = bounds.maxY - bounds.minY;

  const scaleX = mapWidth / worldWidth;
  const scaleY = mapHeight / worldHeight;
  const scale = Math.min(scaleX, scaleY);
  
  const offsetX = (mapWidth - worldWidth * scale) / 2;
  const offsetY = (mapHeight - worldHeight * scale) / 2;

  const rect = canvasMap.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;

  const worldX = (localX - offsetX) / scale + bounds.minX;
  const worldY = (localY - offsetY) / scale + bounds.minY;

  panViewportToWorldPoint(worldX, worldY);
}

// --- Canvas Map Toggle ---

function toggleCanvasMap() {
  canvasMapVisible = !canvasMapVisible;
  canvasMap.classList.toggle("hidden-map", !canvasMapVisible);
  const toggleBtn = document.getElementById("mapToggle");
  if (toggleBtn) {
    toggleBtn.classList.toggle("active", canvasMapVisible);
    toggleBtn.setAttribute("aria-pressed", String(canvasMapVisible));
  }
  if (canvasMapVisible) {
    requestAnimationFrame(() => {
      syncMapWidthToControls();
      renderCanvasMap();
      updateCanvasMapViewport();
    });
  }
}

// Attach canvas map interactions
if (canvasMap) {
  canvasMap.addEventListener("pointerdown", handleCanvasMapPointerDown);
  canvasMap.addEventListener("pointermove", (e) => {
    if (!canvasMapDragging) return;
    handleCanvasMapPointerMove(e);
  });
  // Sync map width to control bar
  const controls = document.querySelector(".canvas-controls");
  if (controls && "ResizeObserver" in window) {
    const ro = new ResizeObserver(() => syncMapWidthToControls());
    ro.observe(controls);
  }
  // Initial sync + multiple delayed syncs to catch final layout
  syncMapWidthToControls();
  requestAnimationFrame(() => requestAnimationFrame(syncMapWidthToControls));
  // Extra delayed syncs for font loading and final layout
  setTimeout(syncMapWidthToControls, 100);
  setTimeout(syncMapWidthToControls, 300);
  setTimeout(syncMapWidthToControls, 500);
  window.addEventListener("resize", () => {
    syncMapWidthToControls();
    renderBoardGrid();
  });
  // Sync after fonts are loaded (critical for accurate width calculation)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      syncMapWidthToControls();
      setTimeout(syncMapWidthToControls, 50);
    });
  }
}

function frameObjectForQuickEdit(object, action = "quick-edit") {
  const boardRect = board.getBoundingClientRect();
  if (action === "expand") {
    const preview = expandPreviewRect(object);
    const panelWidth = Math.min(220, Math.max(180, boardRect.width - 48));
    const sideGap = 18;
    const sideMargins = 56;
    const bottomReserve = 120;
    const availableWidth = Math.max(140, boardRect.width - panelWidth - sideGap - sideMargins);
    const availableHeight = Math.max(140, boardRect.height - 96 - bottomReserve);
    const targetZoom = clamp(
      Math.min(availableWidth / preview.width, availableHeight / preview.height),
      0.08,
      0.9
    );
    const previewScreenWidth = preview.width * targetZoom;
    const previewScreenHeight = preview.height * targetZoom;
    const previewLeft = Math.max(24, Math.round((boardRect.width - panelWidth - sideGap - previewScreenWidth) / 2));
    const previewTop = Math.max(72, Math.round((boardRect.height - bottomReserve - previewScreenHeight) / 2));
    viewport.zoom = targetZoom;
    viewport.x = Math.round(previewLeft - preview.x * targetZoom);
    viewport.y = Math.round(previewTop - preview.y * targetZoom);
    applyViewport();
    scheduleViewportSave();
    return;
  }

  if (action === "edit-text") {
    const panelWidth = Math.min(240, Math.max(180, boardRect.width - 48));
    const sideGap = 16;
    const sideMargins = 48;
    const bottomReserve = 132;
    const availableWidth = Math.max(120, boardRect.width - panelWidth - sideGap - sideMargins);
    const availableHeight = Math.max(140, boardRect.height - 104 - bottomReserve);
    const targetZoom = clamp(
      Math.min(availableWidth / object.width, availableHeight / object.height),
      0.18,
      1.05
    );
    const objectScreenWidth = object.width * targetZoom;
    const objectScreenHeight = object.height * targetZoom;
    const objectLeft = Math.max(24, Math.round((boardRect.width - panelWidth - sideGap - objectScreenWidth) / 2));
    const objectTop = Math.max(72, Math.round((boardRect.height - bottomReserve - objectScreenHeight) / 2));
    viewport.zoom = targetZoom;
    viewport.x = Math.round(objectLeft - object.x * targetZoom);
    viewport.y = Math.round(objectTop - object.y * targetZoom);
    applyViewport();
    scheduleViewportSave();
    return;
  }

  const targetZoom = clamp(
    Math.min((boardRect.width - 96) / object.width, (boardRect.height - 240) / object.height),
    0.18,
    0.9
  );
  const objectCenterX = object.x + object.width / 2;
  viewport.zoom = targetZoom;
  viewport.x = Math.round(boardRect.width / 2 - objectCenterX * targetZoom);
  viewport.y = Math.round(82 - object.y * targetZoom);
  applyViewport();
  scheduleViewportSave();
}

function frameJobPlacement(sourceId, placeholder) {
  const source = state.objects.find((item) => item.id === sourceId);
  const target = placeholder
    ? state.objects.find((item) => item.id === placeholder.id) || placeholder
    : null;
  if (!source || !target) return;
  frameWorldBounds(boundsForObjects([source, target]), {
    paddingX: 96,
    paddingTop: 92,
    paddingBottom: 132,
    maxZoom: 0.9
  });
}

function frameWorldBounds(bounds, options = {}) {
  const boardRect = board.getBoundingClientRect();
  const paddingX = options.paddingX ?? 96;
  const paddingTop = options.paddingTop ?? 96;
  const paddingBottom = options.paddingBottom ?? 120;
  const availableWidth = Math.max(120, boardRect.width - paddingX * 2);
  const availableHeight = Math.max(120, boardRect.height - paddingTop - paddingBottom);
  const targetZoom = clamp(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
    options.minZoom ?? 0.12,
    options.maxZoom ?? 1
  );
  const contentCenterX = bounds.x + bounds.width / 2;
  const contentCenterY = bounds.y + bounds.height / 2;
  const screenCenterY = paddingTop + availableHeight / 2;
  viewport.zoom = targetZoom;
  viewport.x = Math.round(boardRect.width / 2 - contentCenterX * targetZoom);
  viewport.y = Math.round(screenCenterY - contentCenterY * targetZoom);
  applyViewport();
  updateSelectionUi();
  scheduleViewportSave();
}

function canvasObjectBorderExtent(object) {
  // slide-frame 使用 content-box + 1px 边框，视觉右/下边缘比内容尺寸多出 1px
  return object?.type === "slide-frame" ? 1 : 0;
}

function boundsForObjects(objects) {
  const left = Math.min(...objects.map((object) => object.x));
  const top = Math.min(...objects.map((object) => object.y));
  const right = Math.max(...objects.map((object) => object.x + canvasObjectGeometry(object).width + canvasObjectBorderExtent(object)));
  const bottom = Math.max(...objects.map((object) => object.y + canvasObjectGeometry(object).height + canvasObjectBorderExtent(object)));
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function expandPreviewRect(object) {
  if (expandConfig.frame && quickEditAction === "expand" && quickEditObjectId === object.id) {
    return { ...expandConfig.frame };
  }
  const size = expandTargetSize(object.width, object.height, expandConfig.ratio, Number(expandConfig.scale) || 1);
  return {
    x: Math.round(object.x + (object.width - size.width) / 2),
    y: Math.round(object.y + (object.height - size.height) / 2),
    width: size.width,
    height: size.height
  };
}

function initializeExpandPreview(object) {
  if (!object) {
    expandConfig.frame = null;
    expandConfig.sourceStart = null;
    return;
  }
  const previousFrame = expandConfig.frame;
  expandConfig.frame = null;
  const frame = expandPreviewRect(object);
  expandConfig.frame = previousFrame || frame;
  expandConfig.sourceStart = {
    id: object.id,
    x: object.x,
    y: object.y
  };
  expandConfig.placement = expandPlacementForObject(object, expandConfig.frame);
}

function expandTargetSize(width, height, ratio, scale = 1) {
  const targetRatio = ratio === "original" ? width / Math.max(1, height) : ratioToNumber(ratio);
  let targetWidth = width;
  let targetHeight = height;
  const currentRatio = width / Math.max(1, height);
  if (currentRatio < targetRatio) {
    targetWidth = height * targetRatio;
  } else if (currentRatio > targetRatio) {
    targetHeight = width / targetRatio;
  }
  return {
    width: Math.max(1, Math.round(Math.max(width, targetWidth * scale))),
    height: Math.max(1, Math.round(Math.max(height, targetHeight * scale)))
  };
}

function ratioToNumber(ratio) {
  const [left, right] = String(ratio || "1:1").split(":").map(Number);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return 1;
  return left / right;
}

function selectedLayerGroupId() {
  if (workflowSelectionObjectIds.length) return null;
  if (selectedIds.size === 1 && selectedId === isolatedLayerSelectionId) return null;
  const completeGroupId = selectedCompleteLayerGroupId();
  if (completeGroupId) return completeGroupId;
  const groupId = selectedObjectLayerGroupId();
  return groupId && isLayerGroupLocked(groupId) ? groupId : null;
}

function selectedObjectLayerGroupId() {
  if (workflowSelectionObjectIds.length) return null;
  const completeGroupId = selectedCompleteLayerGroupId();
  if (completeGroupId) return completeGroupId;
  if (!hasUserSelection || !selectedId || !state?.objects) return null;
  const object = state.objects.find((item) => item.id === selectedId);
  return object?.layerGroupId || null;
}

function selectedCompleteLayerGroupId() {
  if (!hasUserSelection || selectedIds.size < 2 || !state?.objects) return null;
  const selected = state.objects.filter((object) => selectedIds.has(object.id));
  const groupId = selected[0]?.layerGroupId;
  if (!groupId || selected.some((object) => object.layerGroupId !== groupId)) return null;
  const members = layerGroupMembers(groupId);
  return members.length === selected.length && members.every((member) => selectedIds.has(member.id))
    ? groupId
    : null;
}

function layerGroupMembers(groupId) {
  if (!groupId || !state?.objects) return [];
  return state.objects
    .filter((object) => object.layerGroupId === groupId)
    .sort((a, b) => (a.layerGroupIndex || 0) - (b.layerGroupIndex || 0));
}

function layerGroupBounds(groupId) {
  const members = layerGroupMembers(groupId).filter((member) => !member.hidden);
  return members.length ? boundsForObjects(members) : { x: 0, y: 0, width: 1, height: 1 };
}

function isLayerGroupLocked(groupId) {
  return layerGroupMembers(groupId).some((member) => member.layerGroupLocked === true);
}

function layerGroupLabel(groupId) {
  const member = layerGroupMembers(groupId)[0];
  return member?.layerGroupName || "Layer group";
}

function layerGroupBackgroundLabel(groupId) {
  const status = layerGroupBackgroundStatus(groupId);
  if (!status || status === "ready") return "";
  if (status === "filling") return language === "zh" ? " · 背景补全中" : " · BG filling";
  if (status === "failed") return language === "zh" ? " · 背景补全失败" : " · BG failed";
  return "";
}

function layerGroupBackgroundStatus(groupId) {
  const background = layerGroupMembers(groupId).find((item) => item.layerGroupKind === "background");
  return background?.layerGroupBackgroundStatus || "";
}

function layerGroupOrigin(groupId) {
  const members = layerGroupMembers(groupId);
  const anchor = members.find((item) => item.layerGroupKind === "background")
    || members.find((item) => item.layerGroupRelativeX === 0 && item.layerGroupRelativeY === 0)
    || members[0];
  if (!anchor) return { x: 0, y: 0 };
  return {
    x: anchor.x - (Number.isFinite(anchor.layerGroupRelativeX) ? anchor.layerGroupRelativeX : 0),
    y: anchor.y - (Number.isFinite(anchor.layerGroupRelativeY) ? anchor.layerGroupRelativeY : 0)
  };
}

function updateToolbarForSelection(isGroupSelection, isMultiImageSelection = false, isMultiSelection = false) {
  const editPageButton = toolbar.querySelector('[data-action="edit-page"]');
  if (editPageButton) editPageButton.hidden = true;
  const selectedGroupMemberId = selectedObjectLayerGroupId();
  const isElementLayerSelection = Boolean(selectedGroupMemberId);
  const selectedLayerCount = selectedIds.size || (selectedId ? 1 : 0);
  toolbar.classList.toggle("has-layer-group-actions", Boolean(selectedGroupMemberId) || isMultiSelection);
  const groupBreak = toolbar.querySelector("[data-toolbar-group-break]");
  if (groupBreak) groupBreak.hidden = true;

  if (isElementLayerSelection) {
    const visibleLayerActions = isGroupSelection
      ? new Set(["download", "group-layer-group"])
      : new Set(["layer-down", "layer-up", "download"]);
    if (!isGroupSelection && selectedLayerCount >= 2) visibleLayerActions.add("group-layer-group");
    toolbar.querySelectorAll("[data-action]").forEach((button) => {
      button.hidden = !visibleLayerActions.has(button.dataset.action);
    });
    updateGroupActionButton(isGroupSelection);
    updateLayerOrderButtons();
    return;
  }

  if (isMultiSelection) {
    const visibleMultiActions = new Set(multiLayoutActions);
    if (isMultiImageSelection) {
      visibleMultiActions.add("download");
      visibleMultiActions.add("group-layer-group");
      visibleMultiActions.add("reference-generate");
    }
    toolbar.querySelectorAll("[data-action]").forEach((button) => {
      button.hidden = !visibleMultiActions.has(button.dataset.action);
      button.disabled = (button.dataset.action === "distribute-horizontal" || button.dataset.action === "distribute-vertical")
        && selectedObjectsForLayout().length < 3;
    });
    updateGroupActionButton(isGroupSelection);
    return;
  }

  toolbar.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;
    if (groupSelectionActions.has(action)) button.hidden = !selectedGroupMemberId;
    if (singleSelectionActions.has(action)) button.hidden = isGroupSelection;
  });
  updateGroupActionButton(isGroupSelection);
  updateLayerOrderButtons();
}

function selectedObjectsForLayout() {
  return state.objects.filter((object) => selectedIds.has(object.id));
}

function updateGroupActionButton(isGroupSelection) {
  const button = toolbar.querySelector('[data-action="group-layer-group"]');
  if (!button) return;
  const groupId = selectedObjectLayerGroupId();
  const locked = workflowSelectionObjectIds.length > 1
    ? workflowSelectionGrouped
    : isGroupSelection && groupId && isLayerGroupLocked(groupId);
  const label = locked
    ? (workflowSelectionObjectIds.length > 1
      ? (language === "zh" ? "解组" : "Ungroup")
      : (language === "zh" ? "取消编组" : "Ungroup"))
    : actionLabel("group-layer-group");
  button.dataset.tooltip = label;
  button.title = label;
  button.setAttribute("aria-label", label);
  const span = button.querySelector("span:not(.context-icon)");
  if (span) span.textContent = label;
}

function updateLayerOrderButtons() {
  const groupId = selectedObjectLayerGroupId();
  const members = layerGroupMembers(groupId);
  const index = members.findIndex((member) => member.id === selectedId);
  const downButton = toolbar.querySelector('[data-action="layer-down"]');
  const upButton = toolbar.querySelector('[data-action="layer-up"]');
  if (downButton) downButton.disabled = layerGroupReorderTargetIndex(members, index, "down") < 0;
  if (upButton) upButton.disabled = layerGroupReorderTargetIndex(members, index, "up") < 0;
}

function layerGroupReorderTargetIndex(members, currentIndex, direction) {
  const selected = members[currentIndex];
  if (!selected) return -1;
  if (direction === "up") {
    for (let index = currentIndex + 1; index < members.length; index += 1) {
      if (objectsOverlap(selected, members[index])) return index;
    }
    return -1;
  }
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (objectsOverlap(selected, members[index])) return index;
  }
  return -1;
}

function objectsOverlap(left, right) {
  const leftBounds = boundsForObjects([left]);
  const rightBounds = boundsForObjects([right]);
  return leftBounds.x < rightBounds.x + rightBounds.width
    && leftBounds.x + leftBounds.width > rightBounds.x
    && leftBounds.y < rightBounds.y + rightBounds.height
    && leftBounds.y + leftBounds.height > rightBounds.y;
}

function worldToScreen(x, y) {
  return {
    x: viewport.x + x * viewport.zoom,
    y: viewport.y + y * viewport.zoom
  };
}

function screenToWorld(x, y) {
  return {
    x: (x - viewport.x) / viewport.zoom,
    y: (y - viewport.y) / viewport.zoom
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function apiPath(pathname) {
  const url = new URL(pathname, window.location.origin);
  if (currentProjectId) url.searchParams.set("project", currentProjectId);
  if (currentThreadId) url.searchParams.set("threadId", currentThreadId);
  return `${url.pathname}${url.search}`;
}

function assetUrl(src, object = null) {
  if (!src) return "";
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin === window.location.origin && url.pathname.startsWith("/assets/") && currentProjectId) {
      url.searchParams.set("project", currentProjectId);
      if (currentThreadId) url.searchParams.set("threadId", currentThreadId);
      if (Number.isFinite(object?.assetVersion)) url.searchParams.set("v", String(object.assetVersion));
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return src;
  }
  return src;
}

function basename(filePath) {
  return String(filePath || "").split(/[\\/]/).filter(Boolean).at(-1) || "";
}

async function downloadSelectedImage() {
  const groupId = selectedLayerGroupId();
  const selectedImages = state.objects.filter((item) => (
    selectedIds.has(item.id) && (item.type || "image") === "image" && item.src
  ));
  if (!groupId && selectedImages.length > 1) {
    showToast(t("downloadPreparing"));
    selectedImages.forEach((item, index) => {
      const name = downloadName(item);
      window.setTimeout(() => fallbackAnchorDownload(assetUrl(item.src, item), name, mimeTypeForDownloadName(name)), index * 160);
    });
    showToast(t("downloadStarted"));
    return;
  }
  const object = state.objects.find((item) => item.id === selectedId)
    || (groupId ? layerGroupMembers(groupId)[0] : null);
  if (!object || (object.type || "image") !== "image" || !object.src) return;

  if (groupId) {
    const href = apiPath(`/api/layer-groups/${encodeURIComponent(groupId)}/psd`);
    const suggestedName = `${downloadStem(layerGroupLabel(groupId))}.psd`;
    const mimeType = "image/vnd.adobe.photoshop";
    try {
      showToast(t("downloadPreparing"));
      await saveUrlWithPicker(href, suggestedName, mimeType);
      showToast(t("downloadStarted"));
    } catch (error) {
      if (error?.name === "AbortError") return;
      showToast(error?.message || t("downloadFailed"));
    }
    return;
  }

  // 2x 分辨率提升：通过 Canvas 放大并自动识别透明通道选择格式
  if (exportResolutionScale === "2x") {
    await downloadUpscaledImage(object);
    return;
  }

  // 1x 原始分辨率：直接下载
  const href = assetUrl(object.src, object);
  const suggestedName = downloadName(object);
  const mimeType = mimeTypeForDownloadName(suggestedName);

  try {
    showToast(t("downloadPreparing"));
    await saveUrlWithPicker(href, suggestedName, mimeType);
    showToast(t("downloadStarted"));
  } catch (error) {
    if (error?.name === "AbortError") return;
    showToast(error?.message || t("downloadFailed"));
  }
}

// 切换分辨率倍率 (1x <-> 2x)
function toggleExportResolution() {
  exportResolutionScale = exportResolutionScale === "2x" ? "1x" : "2x";
  updateResolutionToggleUi();
}

// 更新分辨率切换按钮的显示状态
function updateResolutionToggleUi() {
  const toggle = toolbar.querySelector('[data-action="toggle-resolution"]');
  if (!toggle) return;
  const is2x = exportResolutionScale === "2x";
  // 按钮显示当前状态的图标：1x 显示 "1"，2x 显示 "2"
  // 使用 setAttribute/removeAttribute 确保 CSS [hidden] 选择器正确匹配
  const icon1 = toggle.querySelector('[data-res-icon="1"]');
  const icon2 = toggle.querySelector('[data-res-icon="2"]');
  if (icon1) {
    if (is2x) icon1.setAttribute("hidden", "");
    else icon1.removeAttribute("hidden");
  }
  if (icon2) {
    if (!is2x) icon2.setAttribute("hidden", "");
    else icon2.removeAttribute("hidden");
  }
  const tooltipText = is2x ? "2倍分辨率" : "原图";
  toggle.dataset.resolution = exportResolutionScale;
  toggle.dataset.tooltip = tooltipText;
  toggle.title = tooltipText;
  toggle.setAttribute("aria-label", tooltipText);
  toggle.setAttribute("aria-pressed", String(is2x));
}

async function downloadUpscaledImage(object) {
  // 2x 像素提升：交由后端端口识别源图像真实分辨率后用 Pillow LANCZOS 放大，
  // 避免前端 Canvas 受 CORS/ tainted canvas 限制，且质量更高。
  // 格式按透明通道自动选择：有透明 -> png，否则 -> jpeg。
  // hasAlpha 未设置时默认 png（安全回退，避免把带透明的图存成 jpeg 丢透明）。
  const hasAlpha = object.hasAlpha !== undefined ? Boolean(object.hasAlpha) : true;
  const format = hasAlpha ? "png" : "jpeg";
  const extension = format === "png" ? "png" : "jpg";
  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  const href = apiPath(
    `/api/workflow/export?objectId=${encodeURIComponent(object.id)}&scale=2&format=${format}`
  );
  const stem = downloadStem(object.name || object.id);
  const suggestedName = `${stem}-2x.${extension}`;

  try {
    showToast(t("downloadPreparing"));
    await saveUrlWithPicker(href, suggestedName, mimeType);
    showToast(t("downloadStarted"));
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.error("Upscale error:", error);
    showToast(error?.message || t("downloadFailed"));
  }
}

function openReferenceGenerationForSelection() {
  const ids = state.objects
    .filter((object) => selectedIds.has(object.id) || object.id === selectedId)
    .filter((object) => (object.type || "image") === "image" && object.src)
    .map((object) => object.id)
    .slice(0, 6);
  if (!ids.length) return;
  const isMulti = ids.length >= 2;
  const groupId = selectedLayerGroupId();
  const selectedObjects = state.objects.filter((object) => ids.includes(object.id));
  const worldBounds = groupId ? layerGroupBounds(groupId) : boundsForObjects(selectedObjects);
  const boardRect = board.getBoundingClientRect();
  const topLeft = workflowSelectionObjectIds.length > 0 && workflowSelectionBounds
    ? { x: workflowSelectionBounds.left, y: workflowSelectionBounds.top }
    : worldToScreen(worldBounds.x, worldBounds.y);
  const bottomRight = workflowSelectionObjectIds.length > 0 && workflowSelectionBounds
    ? { x: workflowSelectionBounds.right, y: workflowSelectionBounds.bottom }
    : worldToScreen(worldBounds.x + worldBounds.width, worldBounds.y + worldBounds.height);
  window.dispatchEvent(new CustomEvent("codex-canvas:create-reference-generator", {
    detail: {
      objectIds: ids,
      anchorBounds: {
        left: boardRect.left + topLeft.x,
        top: boardRect.top + topLeft.y,
        right: boardRect.left + bottomRight.x,
        bottom: boardRect.top + bottomRight.y
      }
    }
  }));
  if (language === "zh") {
    showToast(isMulti ? `已选 ${ids.length} 张图片，进入多图融合` : "已选 1 张图片，进入参考生图");
  } else {
    showToast(isMulti ? `Selected ${ids.length} images, entering multi-image fusion` : "Selected 1 image, entering reference generation");
  }
}

async function saveUrlWithPicker(href, suggestedName, mimeType) {
  // 先获取并校验下载内容，校验通过后才调用本地保存，避免把错误响应存成目标文件
  const validated = await fetchAndValidateDownload(href, suggestedName, mimeType);
  if (!("showSaveFilePicker" in window)) {
    triggerBlobDownload(validated.blob, suggestedName);
    return;
  }

  const pickerOptions = {
    suggestedName,
    types: downloadPickerTypes(suggestedName, validated.type)
  };
  const handle = await window.showSaveFilePicker(pickerOptions);
  const writable = await handle.createWritable();
  await writable.write(validated.blob);
  await writable.close();
}

// 获取下载内容并验证：HTTP 成功、内容非空、文件魔数与扩展名匹配
async function fetchAndValidateDownload(href, suggestedName, mimeType) {
  const response = await fetch(href);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(errorMessageFromResponse(detail) || t("downloadFailed"));
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error(t("downloadFailed"));
  await validateDownloadSignature(blob, suggestedName);
  return { blob, type: blob.type || mimeType || "application/octet-stream" };
}

// 从服务端错误响应中提取可读信息（JSON {error} 或纯文本）
function errorMessageFromResponse(detail) {
  const trimmed = String(detail || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim();
  } catch {
    // 非 JSON，按纯文本处理
  }
  return trimmed.slice(0, 300);
}

// 校验文件魔数与目标扩展名一致，防止把错误响应（如 JSON）保存成 .pptx/.png 等
async function validateDownloadSignature(blob, suggestedName) {
  const extension = downloadExtension(suggestedName).toLowerCase();
  const magic = {
    ".pptx": [0x50, 0x4b, 0x03, 0x04],
    ".png": [0x89, 0x50, 0x4e, 0x47],
    ".jpg": [0xff, 0xd8, 0xff],
    ".jpeg": [0xff, 0xd8, 0xff],
    ".gif": [0x47, 0x49, 0x46, 0x38],
    ".psd": [0x38, 0x42, 0x50, 0x53]
  }[extension];
  if (!magic) return;
  const prefix = new Uint8Array(await blob.slice(0, magic.length).arrayBuffer());
  if (!magic.every((byte, index) => prefix[index] === byte)) {
    throw new Error(t("downloadFailed"));
  }
}

// 校验通过后触发浏览器本地下载
function triggerBlobDownload(blob, suggestedName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function fallbackAnchorDownload(href, suggestedName, mimeType) {
  try {
    const validated = await fetchAndValidateDownload(href, suggestedName, mimeType);
    triggerBlobDownload(validated.blob, suggestedName);
  } catch (error) {
    if (error?.name !== "AbortError") showToast(error?.message || t("downloadFailed"));
  }
}

function downloadPickerTypes(name, mimeType) {
  const extension = downloadExtension(name);
  return [{
    description: extension === ".psd" ? "Photoshop document" : "Image",
    accept: {
      [mimeType || "application/octet-stream"]: [extension]
    }
  }];
}

function mimeTypeForDownloadName(name) {
  const extension = downloadExtension(name);
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".psd") return "image/vnd.adobe.photoshop";
  return "image/png";
}

function downloadExtension(name) {
  const match = String(name || "").match(/(\.[a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : ".png";
}

function downloadName(object) {
  const name = String(object.name || "canvas-image").trim() || "canvas-image";
  const hasExt = /\.[a-z0-9]{2,5}$/i.test(name);
  return hasExt ? name : `${name}.png`;
}

function downloadStem(name) {
  return String(name || "canvas-image")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "canvas-image";
}

async function resetSelectedLayerGroup() {
  const groupId = selectedObjectLayerGroupId();
  if (!groupId) return;
  const origin = layerGroupOrigin(groupId);
  const members = layerGroupMembers(groupId);
  const selectionBefore = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();
  const before = members.map((member) => ({
    id: member.id,
    patch: { x: member.x, y: member.y, width: member.width, height: member.height }
  }));
  for (const member of members) {
    const relativeX = Number.isFinite(member.layerGroupRelativeX) ? member.layerGroupRelativeX : member.x - origin.x;
    const relativeY = Number.isFinite(member.layerGroupRelativeY) ? member.layerGroupRelativeY : member.y - origin.y;
    member.x = Math.round(origin.x + relativeX);
    member.y = Math.round(origin.y + relativeY);
    if (Number.isFinite(member.layerGroupOriginalLayerWidth)) member.width = member.layerGroupOriginalLayerWidth;
    if (Number.isFinite(member.layerGroupOriginalLayerHeight)) member.height = member.layerGroupOriginalLayerHeight;
  }
  const after = members.map((member) => ({
    id: member.id,
    patch: { x: member.x, y: member.y, width: member.width, height: member.height }
  }));
  render();
  await commitObjectUpdateHistory({
    before,
    after,
    selectionBefore,
    selectionAfter: captureSelectionSnapshot(),
    scopeMeta
  });
}

async function arrangeSelectedObjects(action) {
  const selected = state.objects.filter((object) => selectedIds.has(object.id));
  if (selected.length < 2 || !multiLayoutActions.has(action)) return;
  if ((action === "distribute-horizontal" || action === "distribute-vertical") && selected.length < 3) return;
  const selectionBefore = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();
  const before = selected.map((object) => ({ id: object.id, patch: { x: object.x, y: object.y } }));
  const bounds = boundsForObjects(selected);

  if (action === "align-left") selected.forEach((object) => { object.x = Math.round(bounds.x); });
  if (action === "align-center") selected.forEach((object) => { object.x = Math.round(bounds.x + (bounds.width - object.width) / 2); });
  if (action === "align-right") selected.forEach((object) => { object.x = Math.round(bounds.x + bounds.width - object.width); });
  if (action === "align-top") selected.forEach((object) => { object.y = Math.round(bounds.y); });
  if (action === "align-middle") selected.forEach((object) => { object.y = Math.round(bounds.y + (bounds.height - object.height) / 2); });
  if (action === "align-bottom") selected.forEach((object) => { object.y = Math.round(bounds.y + bounds.height - object.height); });

  if (action === "distribute-horizontal") {
    const ordered = [...selected].sort((left, right) => left.x - right.x || left.y - right.y);
    const contentWidth = ordered.reduce((total, object) => total + object.width, 0);
    const gap = (bounds.width - contentWidth) / Math.max(1, ordered.length - 1);
    let cursor = bounds.x;
    ordered.forEach((object) => {
      object.x = Math.round(cursor);
      cursor += object.width + gap;
    });
  }
  if (action === "distribute-vertical") {
    const ordered = [...selected].sort((left, right) => left.y - right.y || left.x - right.x);
    const contentHeight = ordered.reduce((total, object) => total + object.height, 0);
    const gap = (bounds.height - contentHeight) / Math.max(1, ordered.length - 1);
    let cursor = bounds.y;
    ordered.forEach((object) => {
      object.y = Math.round(cursor);
      cursor += object.height + gap;
    });
  }
  if (action === "tidy-grid") {
    const ordered = [...selected].sort((left, right) => left.y - right.y || left.x - right.x);
    const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
    const gap = 24;
    const rows = [];
    for (let index = 0; index < ordered.length; index += columns) rows.push(ordered.slice(index, index + columns));
    const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(0, ...rows.map((row) => row[column]?.width || 0)));
    const rowHeights = rows.map((row) => Math.max(0, ...row.map((object) => object.height)));
    const columnX = columnWidths.map((_, column) => bounds.x + columnWidths.slice(0, column).reduce((sum, width) => sum + width + gap, 0));
    const rowY = rowHeights.map((_, row) => bounds.y + rowHeights.slice(0, row).reduce((sum, height) => sum + height + gap, 0));
    rows.forEach((row, rowIndex) => row.forEach((object, columnIndex) => {
      object.x = Math.round(columnX[columnIndex] + (columnWidths[columnIndex] - object.width) / 2);
      object.y = Math.round(rowY[rowIndex] + (rowHeights[rowIndex] - object.height) / 2);
    }));
  }

  const after = selected.map((object) => ({ id: object.id, patch: { x: object.x, y: object.y } }));
  render();
  await commitObjectUpdateHistory({
    before,
    after,
    selectionBefore,
    selectionAfter: captureSelectionSnapshot(),
    scopeMeta
  });
  // 同步工作流节点坐标，保持工作流图与画布对象位置一致
  if (workflowSelectionObjectIds.length > 1) {
    const updates = selected
      .filter((object) => workflowSelectionObjectIds.includes(object.id))
      .map((object) => ({ id: object.id, patch: { x: object.x, y: object.y } }));
    if (updates.length) {
      window.dispatchEvent(new CustomEvent("codex-canvas:workflow-nodes-aligned", { detail: { updates } }));
    }
  }
}

async function ungroupSelectedCanvasGroup() {
  const groupId = selectedObjectLayerGroupId() || selectedCompleteLayerGroupId();
  if (!groupId?.startsWith("canvas_group_")) return;
  const members = layerGroupMembers(groupId);
  if (!members.length) return;
  const selectionBefore = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();
  const fields = ["layerGroupId", "layerGroupName", "layerGroupIndex", "layerGroupRelativeX", "layerGroupRelativeY", "layerGroupLocked"];
  const before = members.map((member) => ({
    id: member.id,
    patch: Object.fromEntries(fields.map((field) => [field, member[field] ?? (field === "layerGroupLocked" ? false : null)]))
  }));
  members.forEach((member) => {
    member.layerGroupId = null;
    member.layerGroupName = null;
    member.layerGroupIndex = null;
    member.layerGroupRelativeX = null;
    member.layerGroupRelativeY = null;
    member.layerGroupLocked = false;
  });
  const after = members.map((member) => ({
    id: member.id,
    patch: { layerGroupId: "", layerGroupName: "", layerGroupIndex: 0, layerGroupRelativeX: 0, layerGroupRelativeY: 0, layerGroupLocked: false }
  }));
  render();
  await commitObjectUpdateHistory({ before, after, selectionBefore, selectionAfter: captureSelectionSnapshot(), scopeMeta });
}

function toggleSelectedImageGroup({ ungroup = null } = {}) {
  const isWorkflowSelection = workflowSelectionObjectIds.length > 1
    && workflowSelectionObjectIds.every((id) => selectedIds.has(id));
  if (isWorkflowSelection) {
    if (ungroup === null || (ungroup && workflowSelectionGrouped) || (ungroup === false && !workflowSelectionGrouped)) {
      window.dispatchEvent(new CustomEvent("codex-canvas:toggle-workflow-result-group"));
    }
    return;
  }
  if (ungroup === true) ungroupSelectedCanvasGroup();
  else toggleSelectedLayerGroupLock();
}

async function toggleSelectedLayerGroupLock() {
  let groupId = selectedObjectLayerGroupId();
  if (!groupId && selectedIds.size >= 2) {
    const selected = state.objects.filter((object) => (
      selectedIds.has(object.id) && (
        (object.type || "image") === "image"
        || (object.type === "job" && object.src)
      )
    ));
    if (selected.length < 2) {
      const totalImages = state.objects.filter((object) => selectedIds.has(object.id) && (object.type || "image") === "image").length;
      if (totalImages < 2) {
        showToast(language === "zh" ? "请至少选择两张图片进行编组" : "Select at least two images to group");
      } else {
        showToast(language === "zh" ? "所选对象类型不支持编组" : "Selected objects cannot be grouped");
      }
      return;
    }
    groupId = `canvas_group_${crypto.randomUUID()}`;
    const bounds = boundsForObjects(selected);
    const selectionBefore = captureSelectionSnapshot();
    const scopeMeta = currentCanvasScopeMeta();
    const before = selected.map((member) => ({
      id: member.id,
      patch: {
        layerGroupId: member.layerGroupId || null,
        layerGroupName: member.layerGroupName || null,
        layerGroupIndex: member.layerGroupIndex ?? null,
        layerGroupRelativeX: member.layerGroupRelativeX ?? null,
        layerGroupRelativeY: member.layerGroupRelativeY ?? null,
        layerGroupLocked: member.layerGroupLocked === true
      }
    }));
    selected.forEach((member, index) => {
      member.layerGroupId = groupId;
      member.layerGroupName = language === "zh" ? "图片编组" : "Image group";
      member.layerGroupIndex = index;
      member.layerGroupRelativeX = member.x - bounds.x;
      member.layerGroupRelativeY = member.y - bounds.y;
      member.layerGroupLocked = true;
    });
    const after = selected.map((member) => ({
      id: member.id,
      patch: {
        layerGroupId: member.layerGroupId,
        layerGroupName: member.layerGroupName,
        layerGroupIndex: member.layerGroupIndex,
        layerGroupRelativeX: member.layerGroupRelativeX,
        layerGroupRelativeY: member.layerGroupRelativeY,
        layerGroupLocked: true
      }
    }));
    render();
    await commitObjectUpdateHistory({
      before,
      after,
      selectionBefore,
      selectionAfter: captureSelectionSnapshot(),
      scopeMeta
    });
    return;
  }
  if (!groupId) return;
  if (groupId.startsWith("canvas_group_") && isLayerGroupLocked(groupId)) {
    await ungroupSelectedCanvasGroup();
    return;
  }
  const members = layerGroupMembers(groupId);
  if (!members.length) return;
  const selectionBefore = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();
  const before = members.map((member) => ({
    id: member.id,
    patch: { layerGroupLocked: member.layerGroupLocked === true }
  }));
  const nextLocked = !isLayerGroupLocked(groupId);
  for (const member of members) {
    member.layerGroupLocked = nextLocked;
  }
  const after = members.map((member) => ({
    id: member.id,
    patch: { layerGroupLocked: nextLocked }
  }));
  render();
  await commitObjectUpdateHistory({
    before,
    after,
    selectionBefore,
    selectionAfter: captureSelectionSnapshot(),
    scopeMeta
  });
}

async function moveSelectedLayerInGroup(direction) {
  const groupId = selectedObjectLayerGroupId();
  if (!groupId || !selectedId) return;
  const members = layerGroupMembers(groupId);
  const currentIndex = members.findIndex((member) => member.id === selectedId);
  if (layerGroupReorderTargetIndex(members, currentIndex, direction) < 0) return;
  const objectId = selectedId;
  const beforeOrder = members.map((member) => member.id);
  const selectionBefore = captureSelectionSnapshot();
  const scopeMeta = currentCanvasScopeMeta();

  return canvasHistory.commit(async () => {
    try {
      const payload = await reorderCanvasLayerGroup({ groupId, objectId, direction, scopeMeta });
      if (!payload.changed) return null;
      replaceLocalLayerGroupObjects(groupId, payload.objects || []);
      refreshKnownObjectIds();
      render();
      const afterOrder = (payload.objects || []).map((member) => member.id);
      return {
        action: {
          type: "reorder",
          groupId,
          objectId,
          direction,
          beforeOrder,
          afterOrder,
          selectionBefore,
          selectionAfter: captureSelectionSnapshot(),
          scopeMeta
        }
      };
    } catch (error) {
      showToast(error?.message || `${labelAction(direction === "up" ? "layer-up" : "layer-down")} ${t("jobFailed")}`);
      return null;
    }
  });
}

function updateQuickEditPosition() {
  if (quickEditComposer.hidden || !quickEditObjectId) return;
  const object = state.objects.find((item) => item.id === quickEditObjectId);
  if (!object) {
    closeQuickEdit();
    return;
  }

  const resultBounds = workflowResultScreenBounds(object.id);
  const usesWorkflowBounds = Boolean(resultBounds);
  const topLeft = usesWorkflowBounds
    ? { x: resultBounds.left, y: resultBounds.top }
    : worldToScreen(object.x, object.y);
  const bottomRight = usesWorkflowBounds
    ? { x: resultBounds.right, y: resultBounds.bottom }
    : worldToScreen(object.x + object.width, object.y + object.height);
  const boardRect = board.getBoundingClientRect();
  const composerRect = quickEditComposer.getBoundingClientRect();
  const objectCenter = (topLeft.x + bottomRight.x) / 2;

  if (quickEditAction === "edit-text") {
    const gap = 12;
    const margin = 16;
    const maxTop = Math.max(margin, boardRect.height - composerRect.height - 88);
    const maxLeft = Math.max(margin, boardRect.width - composerRect.width - margin);
    const objectBox = {
      left: topLeft.x,
      top: topLeft.y,
      right: bottomRight.x,
      bottom: bottomRight.y
    };
    const candidates = [
      { left: bottomRight.x + gap, top: topLeft.y },
      { left: bottomRight.x + gap, top: bottomRight.y - composerRect.height },
      { left: topLeft.x - composerRect.width - gap, top: topLeft.y },
      { left: topLeft.x - composerRect.width - gap, top: bottomRight.y - composerRect.height },
      { left: objectCenter - composerRect.width / 2, top: bottomRight.y + gap },
      { left: objectCenter - composerRect.width / 2, top: topLeft.y - composerRect.height - gap }
    ].map((candidate, index) => {
      const left = clamp(candidate.left, margin, maxLeft);
      const top = clamp(candidate.top, margin, maxTop);
      const rect = {
        left,
        top,
        right: left + composerRect.width,
        bottom: top + composerRect.height
      };
      return { left, top, index, overlap: rectOverlapArea(rect, objectBox) };
    }).sort((a, b) => a.overlap - b.overlap || a.index - b.index);

    quickEditComposer.style.transform = `translate(${candidates[0].left}px, ${candidates[0].top}px)`;
    return;
  }

  if (quickEditAction === "expand" && usesWorkflowBounds) {
    const gap = 18;
    const margin = 16;
    const maxLeft = Math.max(margin, boardRect.width - composerRect.width - margin);
    const maxTop = Math.max(margin, boardRect.height - composerRect.height - 88);
    const rightSideFits = bottomRight.x + gap + composerRect.width <= boardRect.width - margin;
    const left = rightSideFits
      ? bottomRight.x + gap
      : Math.max(margin, topLeft.x - composerRect.width - gap);
    const top = clamp(topLeft.y, margin, maxTop);
    quickEditComposer.style.transform = `translate(${clamp(left, margin, maxLeft)}px, ${top}px)`;
    return;
  }

  if (quickEditAction === "expand") {
    const preview = expandPreviewRect(object);
    const previewTopLeft = worldToScreen(preview.x, preview.y);
    const previewBottomRight = worldToScreen(preview.x + preview.width, preview.y + preview.height);
    const previewCenter = (previewTopLeft.x + previewBottomRight.x) / 2;
    const gap = 12;
    const margin = 16;
    const maxTop = Math.max(margin, boardRect.height - composerRect.height - 88);
    const maxLeft = Math.max(margin, boardRect.width - composerRect.width - margin);
    const previewBox = {
      left: previewTopLeft.x,
      top: previewTopLeft.y,
      right: previewBottomRight.x,
      bottom: previewBottomRight.y
    };
    const candidates = [
      { left: previewBottomRight.x + gap, top: previewTopLeft.y },
      { left: previewBottomRight.x + gap, top: previewBottomRight.y - composerRect.height },
      { left: previewTopLeft.x - composerRect.width - gap, top: previewTopLeft.y },
      { left: previewTopLeft.x - composerRect.width - gap, top: previewBottomRight.y - composerRect.height },
      { left: previewCenter - composerRect.width / 2, top: previewBottomRight.y + gap }
    ].map((candidate, index) => {
      const left = clamp(candidate.left, margin, maxLeft);
      const top = clamp(candidate.top, margin, maxTop);
      const rect = {
        left,
        top,
        right: left + composerRect.width,
        bottom: top + composerRect.height
      };
      return { left, top, index, overlap: rectOverlapArea(rect, previewBox) };
    }).sort((a, b) => a.overlap - b.overlap || a.index - b.index);
    quickEditComposer.style.transform = `translate(${candidates[0].left}px, ${candidates[0].top}px)`;
    return;
  }

  const top = clamp(bottomRight.y + 10, 16, boardRect.height - composerRect.height - 88);
  const left = clamp(objectCenter - composerRect.width / 2, 16, boardRect.width - composerRect.width - 16);
  quickEditComposer.style.transform = `translate(${left}px, ${top}px)`;
}

function rectOverlapArea(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function imageSizeLabel(object) {
  const width = Math.round(object.naturalWidth || object.width || 0);
  const height = Math.round(object.naturalHeight || object.height || 0);
  return width && height ? `${width} × ${height}` : "";
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function labelAction(action) {
  return translations[language].actionNames[action] || translations.en.actionNames[action] || action;
}
