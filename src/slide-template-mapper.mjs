import { listTemplates } from "./slide-templates.mjs";

const FIELD_WEIGHTS = {
  purpose: 3,
  style: 3,
  audience: 2,
  scenario: 1.5,
  industry: 1,
  expression: 1,
  density: 0.5
};
const MAX_SCORE = Object.values(FIELD_WEIGHTS).reduce((sum, w) => sum + w, 0);
const HIGH_CONFIDENCE_THRESHOLD = 0.6;

const PURPOSE_KEYWORDS = {
  "年度总结": ["年度总结", "年终总结", "工作总结", "述职", "年终", "年度工作", "年度汇报", "业绩报告", "业绩汇报", "年度业绩", "年度回顾", "年终汇报"],
  "产品发布": ["产品发布", "发布会", "新品发布", "产品上市"],
  "毕业答辩": ["毕业答辩", "论文答辩", "学位答辩", "开题答辩", "答辩"],
  "商业计划书": ["商业计划书", "创业计划", "bp", "路演", "融资计划", "商业计划"],
  "培训课件": ["培训课件", "培训", "教学课件", "课件", "课程", "培训材料"],
  "项目汇报": ["项目汇报", "项目进展", "进度汇报", "项目总结", "项目复盘", "项目报告"],
  "行业研究": ["行业研究", "市场研究", "行业分析", "市场分析", "调研报告", "行业报告"],
  "战略规划": ["战略规划", "战略复盘", "年度规划", "战略方向", "战略目标"],
  "方案汇报": ["方案汇报", "解决方案", "咨询方案", "提案", "方案介绍"],
  "公司介绍": ["公司介绍", "公司简介", "团队介绍", "企业介绍", "公司概览"],
  "竞品分析": ["竞品分析", "竞品", "竞争对手", "竞争分析", "对标分析"],
  "增长复盘": ["增长复盘", "数据复盘", "增长汇报", "运营复盘", "增长报告"]
};

const INDUSTRY_KEYWORDS = {
  "科技": ["科技", "互联网", "ai", "技术", "软件", "数字化"],
  "教育学术": ["教育", "学术", "学校", "大学", "学院"],
  "医疗": ["医疗", "医药", "医院", "临床", "医学"],
  "早期项目": ["早期项目", "创业", "初创", "startup"]
};

const STYLE_KEYWORDS = {
  "扁平简约": ["扁平简约", "扁平", "扁平化", "扁平风"],
  "专业商务": ["专业商务", "商务", "专业", "正式", "商务风"],
  "未来科技": ["未来科技", "科技风", "未来", "赛博"],
  "极简清新": ["极简清新", "极简", "清新", "极简风"]
};

const EXPRESSION_KEYWORDS = {
  "教学图解型": ["教学图解", "教学", "课件"],
  "图表型": ["图表型", "图表"],
  "数据驱动型": ["数据驱动", "数据型"],
  "全图大字型": ["全图", "大字", "大字型"],
  "图解型": ["图解", "示意图"]
};

const AUDIENCE_KEYWORDS = {
  "管理层": ["管理层", "老板", "高管", "领导", "总监", "vp", "董事", "董事会", "经营层"],
  "评委": ["评委", "评审"],
  "投资人": ["投资人", "vc", "资本", "投资方"],
  "学员": ["学员", "学生"]
};

const SCENARIO_KEYWORDS = {
  "现场汇报": ["现场汇报", "汇报", "述职"],
  "现场发布": ["现场发布", "发布会", "发布"],
  "现场答辩": ["现场答辩", "答辩"],
  "路演": ["路演", "融资路演"],
  "教学": ["教学", "培训"]
};

function inferFromKeywords(text, keywordMap, fallback) {
  if (!text) return fallback;
  const lower = String(text).toLowerCase();
  for (const [value, keywords] of Object.entries(keywordMap)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return value;
    }
  }
  return fallback;
}

function inferDensity(pageCount, scenario) {
  if (Number.isFinite(pageCount)) {
    if (pageCount <= 8) return "sparse";
    if (pageCount >= 16) return "dense";
    return "balanced";
  }
  if (scenario && /教学|培训/.test(scenario)) return "dense";
  return "balanced";
}

export function normalizeBrief(brief) {
  const topic = String(brief?.topic || "").trim();
  const goal = String(brief?.goal || "").trim();
  const style = String(brief?.style || "").trim();
  const narrative = String(brief?.narrative || "").trim();
  const audience = String(brief?.audience || "").trim();
  const scenario = String(brief?.scenario || "").trim();
  const pageCount = Number(brief?.recommendedPageCount);

  const purposeText = [topic, goal].join(" ");
  const industryText = [topic, goal, narrative].join(" ");
  const styleText = [style, goal, topic].join(" ");
  const expressionText = [narrative, goal, topic].join(" ");
  const audienceText = [audience, goal, topic].join(" ");
  const scenarioText = [scenario, goal, topic].join(" ");

  return {
    purpose: inferFromKeywords(purposeText, PURPOSE_KEYWORDS, null),
    industry: inferFromKeywords(industryText, INDUSTRY_KEYWORDS, null),
    style: inferFromKeywords(styleText, STYLE_KEYWORDS, style || null),
    expression: inferFromKeywords(expressionText, EXPRESSION_KEYWORDS, null),
    audience: inferFromKeywords(audienceText, AUDIENCE_KEYWORDS, audience || null),
    scenario: inferFromKeywords(scenarioText, SCENARIO_KEYWORDS, scenario || null),
    density: inferDensity(pageCount, scenario)
  };
}

function tokenize(str) {
  if (!str) return [];
  const lower = String(str).toLowerCase();
  const tokens = [];
  const enWords = lower.match(/[a-z]+/g) || [];
  tokens.push(...enWords);
  const cjkSegments = lower.match(/[\u4e00-\u9fff]+/g) || [];
  for (const seg of cjkSegments) {
    if (seg.length === 1) {
      tokens.push(seg);
    } else {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.push(seg.substring(i, i + 2));
      }
    }
  }
  return [...new Set(tokens)];
}

function fieldMatch(briefValue, templateValue) {
  if (!briefValue || !templateValue) return 0;
  const b = String(briefValue).toLowerCase().trim();
  const t = String(templateValue).toLowerCase().trim();
  if (!b || !t) return 0;
  if (t === "通用" || t === "general") return 0.5;
  if (b === t) return 1;
  if (b.includes(t) || t.includes(b)) return 0.7;
  const bTokens = tokenize(b);
  const tTokens = tokenize(t);
  if (bTokens.length && tTokens.length) {
    const common = bTokens.filter((tok) => tTokens.includes(tok));
    if (common.length) {
      return Math.min(0.6, common.length / Math.max(bTokens.length, tTokens.length));
    }
  }
  return 0;
}

export function mapBriefToTemplate(brief) {
  const templates = listTemplates();
  if (!templates.length) {
    return { templateId: "freeform", confidence: 0, recommendations: [] };
  }
  const normalized = normalizeBrief(brief);
  const scored = templates.map((template) => {
    let score = 0;
    const reasons = [];
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      const match = fieldMatch(normalized[field], template[field]);
      score += weight * match;
      if (match > 0) {
        reasons.push(`${field}: ${normalized[field] || "?"} ~ ${template[field]} (${Math.round(match * 100)}%)`);
      }
    }
    return {
      id: template.id,
      score: Number(score.toFixed(3)),
      confidence: Number((score / MAX_SCORE).toFixed(3)),
      reasons
    };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (top.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return {
      templateId: top.id,
      confidence: top.confidence,
      recommendations: scored.slice(0, 3)
    };
  }
  return {
    templateId: null,
    confidence: top.confidence,
    recommendations: scored.slice(0, 3)
  };
}
