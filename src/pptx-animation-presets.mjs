// PowerPoint 元素级动画 preset 注册表
// 一期 8 个常用效果（5 进入 + 2 强调 + 1 退出），OOXML row 模板借鉴 ppt-master 的 pptx_animation_presets.json（MIT）。
// 接口设计成可热加载扩展：二期可直接把完整 203 条 preset 灌入 REGISTRY 而不改 loadPreset/listPresets 签名。
// 占位符约定（buildTimingXml 负责替换）：
//   {ID}        cTn 起始 id（每行递增，保证全 timing 树唯一）
//   {NODE_TYPE} clickEffect / withEffect / afterEffect（由 trigger 决定）
//   {DELAY}     起始延迟（毫秒）
//   {DUR}       持续时间（毫秒）；durationScalable=false 时固定为 defaultDuration
//   {SPID}      目标形状 id（PPTX 的 cNvPr id）

export const PRESET_REGISTRY = {
  // ===== 进入动画 =====
  entrance_fade: {
    effect: "entrance_fade",
    presetID: 10,
    presetClass: "entr",
    presetSubtype: 0,
    durationScalable: true,
    defaultDuration: 500,
    label: "淡入",
    rowTemplate:
      '<p:par><p:cTn id="{ID}" fill="hold" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="{DELAY}"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID1}" fill="hold">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID2}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst>'
      + '<p:set><p:cBhvr><p:cTn id="{ID3}" dur="{DUR}" fill="hold"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
      + '<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{ID4}" dur="{DUR}"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl></p:cBhvr></p:animEffect>'
      + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  },

  entrance_appear: {
    effect: "entrance_appear",
    presetID: 1,
    presetClass: "entr",
    presetSubtype: 0,
    durationScalable: false, // PowerPoint Appear 是 1ms 翻转，不能被 duration 缩放（踩坑规避）
    defaultDuration: 1,
    label: "出现",
    rowTemplate:
      '<p:par><p:cTn id="{ID}" fill="hold" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="{DELAY}"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID1}" fill="hold">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID2}" presetID="1" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst>'
      + '<p:set><p:cBhvr><p:cTn id="{ID3}" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
      + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  },

  entrance_fly_in: {
    effect: "entrance_fly_in",
    presetID: 2,
    presetClass: "entr",
    presetSubtype: 4, // 从左（PowerPoint subtype: 1=from bottom,2=from left,3=from right,4=from top... 实际从左是 2，这里用 4 作为常见默认，buildTimingXml 可按 effect_options 覆盖）
    durationScalable: true,
    defaultDuration: 500,
    label: "飞入",
    rowTemplate:
      '<p:par><p:cTn id="{ID}" fill="hold" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="{DELAY}"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID1}" fill="hold">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID2}" presetID="2" presetClass="entr" presetSubtype="{SUBTYPE}" fill="hold" grpId="0" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst>'
      + '<p:set><p:cBhvr><p:cTn id="{ID3}" dur="{DUR}" fill="hold"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
      + '<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="{ID4}" dur="{DUR}"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl><p:attrNameLst><p:attrName>ppt_x</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="0-#ppt_w/2"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="#ppt_x"/></p:val></p:tav></p:tavLst></p:anim>'
      + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  },

  entrance_wipe: {
    effect: "entrance_wipe",
    presetID: 22, // PowerPoint Wipe entrance presetID
    presetClass: "entr",
    presetSubtype: 8, // 从左到右
    durationScalable: true,
    defaultDuration: 500,
    label: "擦除",
    rowTemplate:
      '<p:par><p:cTn id="{ID}" fill="hold" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="{DELAY}"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID1}" fill="hold">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID2}" presetID="22" presetClass="entr" presetSubtype="{SUBTYPE}" fill="hold" grpId="0" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst>'
      + '<p:set><p:cBhvr><p:cTn id="{ID3}" dur="{DUR}" fill="hold"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
      + '<p:animEffect transition="in" filter="wipe({SUBTYPE})"><p:cBhvr><p:cTn id="{ID4}" dur="{DUR}"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl></p:cBhvr></p:animEffect>'
      + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  },

  entrance_zoom: {
    effect: "entrance_zoom",
    presetID: 23, // PowerPoint Zoom entrance presetID
    presetClass: "entr",
    presetSubtype: 0,
    durationScalable: true,
    defaultDuration: 500,
    label: "缩放",
    rowTemplate:
      '<p:par><p:cTn id="{ID}" fill="hold" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="{DELAY}"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID1}" fill="hold">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID2}" presetID="23" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst>'
      + '<p:set><p:cBhvr><p:cTn id="{ID3}" dur="{DUR}" fill="hold"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
      + '<p:animScale><p:cBhvr><p:cTn id="{ID4}" dur="{DUR}"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl></p:cBhvr><p:by x="100000" y="100000"/><p:from x="0" y="0"/><p:to x="100000" y="100000"/></p:animScale>'
      + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  },

  // ===== 强调动画 =====
  emphasis_pulse: {
    effect: "emphasis_pulse",
    presetID: 1, // Pulse emphasis presetID
    presetClass: "emph",
    presetSubtype: 0,
    durationScalable: true,
    defaultDuration: 500,
    label: "脉冲",
    rowTemplate:
      '<p:par><p:cTn id="{ID}" fill="hold" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="{DELAY}"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID1}" presetID="1" presetClass="emph" presetSubtype="0" fill="hold" grpId="0" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst>'
      + '<p:animClr clrSpc="rgb" dir="cw"><p:cBhvr additive="base"><p:cTn id="{ID2}" dur="{DUR}"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl><p:attrNameLst><p:attrName>style.color</p:attrName></p:attrNameLst></p:cBhvr><p:by><p:hsl val="0"/><p:hsl val="0"/><p:hsl val="0"/></p:by></p:animClr>'
      + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  },

  emphasis_spin: {
    effect: "emphasis_spin",
    presetID: 8, // Spin emphasis presetID
    presetClass: "emph",
    presetSubtype: 0,
    durationScalable: true,
    defaultDuration: 500,
    label: "旋转",
    rowTemplate:
      '<p:par><p:cTn id="{ID}" fill="hold" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="{DELAY}"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID1}" presetID="8" presetClass="emph" presetSubtype="0" fill="hold" grpId="0" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst>'
      + '<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="{ID2}" dur="{DUR}"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl><p:attrNameLst><p:attrName>style.rotation</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:fltVal val="0"/></p:val></p:tav><p:tav tm="100000"><p:val><p:fltVal val="360"/></p:val></p:tav></p:tavLst></p:anim>'
      + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  },

  // ===== 退出动画 =====
  exit_fade_out: {
    effect: "exit_fade_out",
    presetID: 10, // Fade exit presetID
    presetClass: "exit",
    presetSubtype: 0,
    durationScalable: true,
    defaultDuration: 500,
    label: "淡出",
    rowTemplate:
      '<p:par><p:cTn id="{ID}" fill="hold" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="{DELAY}"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID1}" fill="hold">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst><p:par><p:cTn id="{ID2}" presetID="10" presetClass="exit" presetSubtype="0" fill="hold" grpId="0" nodeType="{NODE_TYPE}">'
      + '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
      + '<p:childTnLst>'
      + '<p:animEffect transition="out" filter="fade"><p:cBhvr><p:cTn id="{ID3}" dur="{DUR}"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl></p:cBhvr></p:animEffect>'
      + '<p:set><p:cBhvr><p:cTn id="{ID4}" dur="{DUR}" fill="hold"/><p:tgtEl><p:spTgt spid="{SPID}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="hidden"/></p:to></p:set>'
      + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
  }
};

// trigger → nodeType 映射（ECMA-376 标准，借鉴 ppt-master）
export const TRIGGER_NODE_TYPES = {
  on_click: "clickEffect",
  with_previous: "withEffect",
  after_previous: "afterEffect"
};

// 按效果类查找默认触发（进入/强调通常 on_click，退出通常 after_previous）
export function defaultTriggerForEffect(effect) {
  const preset = PRESET_REGISTRY[effect];
  if (!preset) return "after_previous";
  return preset.presetClass === "entr" ? "on_click" : preset.presetClass === "exit" ? "after_previous" : "on_click";
}

/**
 * 加载一个动画 preset 定义。
 * @param {string} effect - 效果名（如 "entrance_fade"）
 * @returns {{effect, presetID, presetClass, presetSubtype, durationScalable, defaultDuration, label, rowTemplate}|null}
 * 二期可在此函数注入完整 203 条 preset 的加载逻辑而不改签名。
 */
export function loadPreset(effect) {
  return PRESET_REGISTRY[effect] || null;
}

/**
 * 列出所有已注册 preset（供前端下拉选择）。
 * @returns {Array<{effect, label, presetClass, defaultDuration}>}
 */
export function listPresets() {
  return Object.values(PRESET_REGISTRY).map((p) => ({
    effect: p.effect,
    label: p.label,
    presetClass: p.presetClass,
    defaultDuration: p.defaultDuration
  }));
}

/**
 * 判断 effect 是否已注册。
 */
export function isRegisteredEffect(effect) {
  return Object.prototype.hasOwnProperty.call(PRESET_REGISTRY, effect);
}
