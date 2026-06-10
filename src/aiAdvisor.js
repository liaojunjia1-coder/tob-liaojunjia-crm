const stageChance = {
  新线索: 10,
  已联系: 20,
  需求确认: 40,
  方案报价: 60,
  谈判中: 80,
  已成交: 100,
  暂缓: 0,
};

function cleanHtml(input) {
  return String(input || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function inferPainPoints(customer = {}) {
  const text = `${customer.industry || ""} ${customer.tags || ""} ${customer.note || ""}`;
  if (/外贸|询盘|SaaS/i.test(text)) return ["线索分配慢", "跟进断档", "报价反馈周期长"];
  if (/自动化|制造|设备|产线/i.test(text)) return ["产线停机成本高", "售后响应要求高", "项目决策链较长"];
  return ["需求优先级不清", "预算和决策人未确认", "下一步动作容易丢失"];
}

function customerScore(customer = {}, data = {}) {
  const activities = data.activities || [];
  const tasks = data.tasks || [];
  let score = 35;
  score += (stageChance[customer.stage] ?? 10) * 0.35;
  if (customer.priority === "A") score += 18;
  if (customer.amount && Number(customer.amount) >= 100000) score += 10;
  if (customer.closeDate) score += 7;
  if (activities.some((item) => item.customerId === customer.id)) score += 10;
  if (tasks.some((item) => item.customerId === customer.id && !item.done)) score += 8;
  return Math.max(1, Math.min(100, Math.round(score)));
}

export async function searchCompany(company, industry) {
  const query = encodeURIComponent(`${company} ${industry || ""} 公司 新闻 招聘 业务`);
  const keepRelevant = (items) => {
    const tokens = [company, industry, String(company || "").slice(0, 4), String(industry || "").slice(0, 2)]
      .filter(Boolean)
      .filter((item) => item.length >= 2);
    return items.filter((item) => {
      const text = `${item.title} ${item.snippet}`;
      return tokens.some((token) => text.includes(token));
    });
  };

  try {
    const response = await fetch(`https://duckduckgo.com/html/?q=${query}`, {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(7000),
    });
    const html = await response.text();
    const results = [...html.matchAll(/<a rel="nofollow" class="result__a" href="[^"]+">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[\s\S]*?>([\s\S]*?)<\/a>/g)]
      .slice(0, 3)
      .map((match) => ({ title: cleanHtml(match[1]), snippet: cleanHtml(match[2]) }))
      .filter((item) => item.title || item.snippet);
    const relevant = keepRelevant(results);
    if (relevant.length) return relevant;
  } catch {
  }

  try {
    const response = await fetch(`https://www.bing.com/search?format=rss&q=${query}`, {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(7000),
    });
    const xml = await response.text();
    const results = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<description>([\s\S]*?)<\/description>/g)]
      .slice(0, 3)
      .map((match) => ({ title: cleanHtml(match[1]), snippet: cleanHtml(match[2]) }))
      .filter((item) => item.title || item.snippet);
    return keepRelevant(results);
  } catch {
    return [];
  }
}

export function buildCustomerInsight(customer = {}, data = {}, webResults = []) {
  const pains = inferPainPoints(customer);
  const score = customerScore(customer, data);
  const probability = stageChance[customer.stage] ?? 10;
  const amount = Number(customer.amount || 0);
  const forecast = Math.round((amount * probability) / 100);

  return {
    score,
    level: score >= 75 ? "高价值线索" : score >= 50 ? "值得推进" : "需要先验证",
    summary: `${customer.company} 当前处于「${customer.stage || "新线索"}」，按阶段估算成交概率约 ${probability}%。`,
    fit: [
      amount ? `预计金额 ${amount.toLocaleString("zh-CN")} 元，加权预测约 ${forecast.toLocaleString("zh-CN")} 元。` : "暂未录入预计金额，建议先问预算区间。",
      customer.priority === "A" ? "客户评级为 A，建议先确认预算、决策人和时间表。" : "客户评级还不算最高，建议先判断是否有明确痛点和近期项目。",
      `可能痛点：${pains.join("、")}。`,
    ],
    nextActions: [
      "补齐决策人、预算范围、上线时间这三个字段。",
      "把下一次动作写成待办，不只写在备注里。",
      "用一次短沟通确认客户是否愿意进入下一阶段。",
    ],
    webResults,
    webSummary: webResults.length
      ? "已参考公开搜索结果，但销售判断仍以你录入的一手信息为主。"
      : "暂未抓到稳定公开结果，先根据你录入的信息做销售判断。",
  };
}

export function buildFollowupSuggestion(customer = {}, content = "") {
  const text = content || "";
  const talksPrice = /价格|报价|预算|贵|费用/.test(text);
  const talksDecision = /老板|总|采购|决策|审批/.test(text);
  const talksTime = /月底|下周|明天|时间|上线|交付/.test(text);

  const nextStep = talksPrice
    ? "把报价拆成基础版和推荐版，并问清预算审批人。"
    : talksDecision
      ? "确认决策链：谁使用、谁拍板、谁付款。"
      : talksTime
        ? "把客户提到的时间点变成明确待办，并提前一天提醒。"
        : "追问一个具体业务场景，再约下一次沟通。";

  return {
    summary: `${customer?.company || "这个客户"} 的下一步建议`,
    nextStep,
    taskTitle: nextStep,
  };
}
