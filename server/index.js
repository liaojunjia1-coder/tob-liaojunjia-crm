import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "crm-db.json");
const port = Number(process.env.CRM_API_PORT || 5174);

const defaultCrmData = {
  customers: [
    {
      id: "c-1",
      company: "深圳智造设备有限公司",
      contact: "林经理 / 设备部",
      phone: "138-0000-1001",
      industry: "工业自动化",
      stage: "方案报价",
      amount: "260000",
      priority: "A",
      source: "老客户转介绍",
      closeDate: "2026-07-05",
      tags: "产线升级,停机损失,技术评估,老板关注ROI",
      note: "客户有两条包装线准备升级，核心诉求是减少人工巡检和停机等待。采购会看价格，老板更关心三个月内能否看到效率提升。",
      createdAt: "2026-06-14T09:00:00.000Z",
    },
    {
      id: "c-2",
      company: "前海云贸科技",
      contact: "周总 / 创始人",
      phone: "微信 zhou-sales",
      industry: "外贸 SaaS",
      stage: "方案报价",
      amount: "88000",
      priority: "A",
      source: "展会线索",
      closeDate: "2026-06-27",
      tags: "询盘分配,销售过程看板,报价跟进,老板决策",
      note: "团队有 8 个外贸销售，询盘来自展会、阿里国际站和独立站。当前痛点是线索分配靠表格，报价后缺少提醒，容易丢单。",
      createdAt: "2026-06-14T09:15:00.000Z",
    },
    {
      id: "c-3",
      company: "华南精密制造",
      contact: "陈主管 / 生产主管",
      phone: "0755-8888-2233",
      industry: "制造业",
      stage: "需求确认",
      amount: "150000",
      priority: "B",
      source: "自拓",
      closeDate: "2026-07-15",
      tags: "巡检数字化,质量追溯,生产报表",
      note: "客户目前用纸质表记录设备巡检，质量问题追溯慢。下一步需要确认信息化预算和谁负责最终拍板。",
      createdAt: "2026-06-14T09:30:00.000Z",
    },
    {
      id: "c-4",
      company: "东莞欧瑞家居用品",
      contact: "李经理 / 外贸负责人",
      phone: "微信 euro-li",
      industry: "外贸制造",
      stage: "已联系",
      amount: "56000",
      priority: "B",
      source: "LinkedIn 开发",
      closeDate: "2026-07-10",
      tags: "海外客户开发,样品跟进,英文邮件,展会复盘",
      note: "客户做收纳和家居用品出口，最近在开发欧洲小 B 客户。适合管理海外询盘、样品寄送和报价提醒。",
      createdAt: "2026-06-16T10:10:00.000Z",
    },
    {
      id: "c-5",
      company: "深圳星禾企业服务",
      contact: "王总 / 销售总监",
      phone: "136-0000-2299",
      industry: "SaaS / 企业服务",
      stage: "谈判中",
      amount: "128000",
      priority: "A",
      source: "朋友介绍",
      closeDate: "2026-06-30",
      tags: "销售团队扩张,新人SOP,续费风险,过程管理",
      note: "客户销售团队从 12 人扩到 25 人，新人跟进习惯不稳定。这个客户适合观察销售过程、跟进风险和下一步动作是否清楚。",
      createdAt: "2026-06-17T14:20:00.000Z",
    },
  ],
  activities: [
    {
      id: "a-1",
      customerId: "c-1",
      method: "电话",
      date: "2026-06-18",
      content: "确认目前有两条产线准备升级，客户最关心停机时间、改造周期和售后响应。",
      nextStep: "整理 ROI 测算和现场调研问题，约技术同事一起开视频会。",
      createdAt: "2026-06-18T10:00:00.000Z",
    },
    {
      id: "a-2",
      customerId: "c-2",
      method: "微信",
      date: "2026-06-20",
      content: "周总反馈现在询盘分配靠人工转发，报价后没人提醒复盘，销售主管看不到每条线索卡在哪一步。",
      nextStep: "发一页方案，重点讲线索分配、报价提醒和销售过程看板。",
      createdAt: "2026-06-20T10:20:00.000Z",
    },
    {
      id: "a-3",
      customerId: "c-5",
      method: "视频会议",
      date: "2026-06-21",
      content: "王总确认团队扩张后新人跟进质量不稳定，希望先用小范围试点看是否能提升复盘效率。",
      nextStep: "把试点范围拆成 5 个销售、2 周、3 个指标：跟进及时率、商机阶段完整度、超期待办数。",
      createdAt: "2026-06-21T15:30:00.000Z",
    },
    {
      id: "a-4",
      customerId: "c-3",
      method: "拜访",
      date: "2026-06-19",
      content: "现场看到巡检表分散在班组，质量异常追溯要翻纸质记录，生产主管愿意先试一个车间。",
      nextStep: "确认信息化负责人和预算区间，再判断是否进入方案报价。",
      createdAt: "2026-06-19T16:00:00.000Z",
    },
    {
      id: "a-5",
      customerId: "c-4",
      method: "邮件",
      date: "2026-06-17",
      content: "发送英文开发信后客户回复，想了解样品寄送后的跟进提醒和报价记录管理。",
      nextStep: "准备一个外贸样品跟进场景，用截图说明从询盘到复盘的流程。",
      createdAt: "2026-06-17T11:40:00.000Z",
    },
  ],
  tasks: [
    {
      id: "t-1",
      customerId: "c-2",
      title: "给周总发外贸线索分配和报价提醒方案",
      dueDate: "2026-06-24",
      priority: "高",
      done: false,
      createdAt: "2026-06-20T11:00:00.000Z",
    },
    {
      id: "t-2",
      customerId: "c-1",
      title: "约林经理和技术同事做二次需求沟通",
      dueDate: "2026-06-25",
      priority: "中",
      done: false,
      createdAt: "2026-06-18T11:10:00.000Z",
    },
    {
      id: "t-3",
      customerId: "c-5",
      title: "给王总发 2 周销售过程试点计划",
      dueDate: "2026-06-24",
      priority: "高",
      done: false,
      createdAt: "2026-06-21T16:10:00.000Z",
    },
    {
      id: "t-4",
      customerId: "c-3",
      title: "补充华南精密的信息化负责人和预算区间",
      dueDate: "2026-06-26",
      priority: "中",
      done: false,
      createdAt: "2026-06-19T17:00:00.000Z",
    },
    {
      id: "t-5",
      customerId: "c-4",
      title: "准备外贸样品跟进流程截图",
      dueDate: "2026-06-27",
      priority: "低",
      done: false,
      createdAt: "2026-06-17T12:00:00.000Z",
    },
    {
      id: "t-6",
      customerId: "c-1",
      title: "已完成：整理产线升级痛点清单",
      dueDate: "2026-06-22",
      priority: "中",
      done: true,
      createdAt: "2026-06-18T11:20:00.000Z",
    },
  ],
  settings: {
    reminderDays: 2,
    defaultTaskPriority: "中",
    compactCustomers: true,
    aiMode: "实用销售参谋",
  },
};

function initialDb() {
  return { users: [], sessions: [], crm: {} };
}

function readDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initialDb(), null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function send(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, savedHash] = stored.split(":");
  const inputHash = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(inputHash, "hex"), Buffer.from(savedHash, "hex"));
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function currentUser(req, db) {
  const token = bearerToken(req);
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    title: user.title || "ToB 销售",
    phone: user.phone || "",
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function userData(db, userId) {
  db.crm[userId] ||= structuredClone(defaultCrmData);
  db.crm[userId].settings = { ...defaultCrmData.settings, ...(db.crm[userId].settings || {}) };
  return db.crm[userId];
}

function stageProbability(stage) {
  return {
    新线索: 10,
    已联系: 20,
    需求确认: 40,
    方案报价: 60,
    谈判中: 80,
    已成交: 100,
    暂缓: 0,
  }[stage] ?? 10;
}

function inferPainPoints(customer) {
  const text = `${customer.industry || ""} ${customer.tags || ""} ${customer.note || ""}`;
  if (/外贸|询盘|SaaS/i.test(text)) return ["线索分配慢", "跟进断档", "报价反馈周期长"];
  if (/自动化|制造|设备|产线/i.test(text)) return ["产线停机成本高", "售后响应要求高", "项目决策链较长"];
  return ["需求优先级不清", "预算和决策人未确认", "下一步动作容易丢失"];
}

function customerScore(customer, activities, tasks) {
  let score = 35;
  score += stageProbability(customer.stage) * 0.35;
  if (customer.priority === "A") score += 18;
  if (customer.amount && Number(customer.amount) >= 100000) score += 10;
  if (customer.closeDate) score += 7;
  if (activities.some((item) => item.customerId === customer.id)) score += 10;
  if (tasks.some((item) => item.customerId === customer.id && !item.done)) score += 8;
  return Math.max(1, Math.min(100, Math.round(score)));
}

async function searchCompany(company, industry) {
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
  const url = `https://duckduckgo.com/html/?q=${query}`;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(7000),
    });
    const html = await response.text();
    const results = [...html.matchAll(/<a rel="nofollow" class="result__a" href="[^"]+">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[\s\S]*?>([\s\S]*?)<\/a>/g)]
      .slice(0, 3)
      .map((match) => ({
        title: cleanHtml(match[1]),
        snippet: cleanHtml(match[2]),
      }))
      .filter((item) => item.title || item.snippet);
    const relevantResults = keepRelevant(results);
    if (relevantResults.length) return relevantResults;
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
      .map((match) => ({
        title: cleanHtml(match[1]),
        snippet: cleanHtml(match[2]),
      }))
      .filter((item) => item.title || item.snippet);
    return keepRelevant(results);
  } catch {
    return [];
  }
}

function cleanHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCustomerInsight(customer, data, webResults) {
  const activities = data.activities.filter((item) => item.customerId === customer.id);
  const tasks = data.tasks.filter((item) => item.customerId === customer.id);
  const pains = inferPainPoints(customer);
  const score = customerScore(customer, activities, tasks);
  const probability = stageProbability(customer.stage);
  const amount = Number(customer.amount || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const weightedAmount = Math.round((safeAmount * probability) / 100);

  return {
    score,
    level: score >= 75 ? "高价值线索" : score >= 55 ? "值得推进" : "需要补信息",
    summary: `${customer.company} 当前处于「${customer.stage}」，按阶段估算成交概率约 ${probability}%。`,
    fit: [
      `预计金额 ${safeAmount ? `${safeAmount.toLocaleString("zh-CN")} 元` : "未填写"}，加权预测约 ${weightedAmount.toLocaleString("zh-CN")} 元。`,
      `客户评级为 ${customer.priority || "B"}，建议先确认预算、决策人和时间表。`,
      `可能痛点：${pains.join("、")}。`,
    ],
    nextActions: [
      "补齐决策人、预算范围、上线时间这三个字段。",
      "把下一次动作写成待办，不只写在备注里。",
      customer.stage === "方案报价" ? "报价后 24 小时内约一次反馈沟通。" : "用一次短沟通确认客户是否愿意进入下一阶段。",
    ],
    webResults,
    webSummary: webResults.length
      ? "已联网检索到公开信息，建议把公开业务线索和你的实际沟通内容交叉验证。"
      : "暂未抓到稳定公开结果，先根据你录入的信息做销售判断。",
  };
}

function buildFollowupSuggestion(customer, content) {
  const text = String(content || "");
  const asksPrice = /价格|报价|费用|预算/.test(text);
  const asksTrial = /试用|案例|体验|场景/.test(text);
  const decision = /老板|总|采购|财务|决策|领导/.test(text);
  const nextSteps = [];

  if (asksPrice) nextSteps.push("发报价前先确认版本范围、采购数量和付款周期。");
  if (asksTrial) nextSteps.push("约 15 分钟场景确认，先对齐客户目标和关键流程。");
  if (!decision) nextSteps.push("下次沟通确认决策人、使用部门和采购流程。");
  if (customer?.stage === "需求确认") nextSteps.push("整理痛点清单，并把痛点对应到方案模块。");
  if (!nextSteps.length) nextSteps.push("把本次沟通结论变成一个明确待办，并约定下一次触达时间。");

  return {
    summary: text ? `本次跟进重点是：${text.slice(0, 80)}${text.length > 80 ? "..." : ""}` : "还没有输入跟进内容。",
    nextStep: nextSteps[0],
    taskTitle: nextSteps[0].replace(/[。.]$/, ""),
    checklist: nextSteps,
  };
}

async function handle(req, res) {
  if (!req.url?.startsWith("/api/")) {
    send(res, 404, { error: "Not found" });
    return;
  }

  const db = readDb();
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const name = String(body.name || "tob廖俊嘉").trim();

      if (!email || password.length < 6) {
        send(res, 400, { error: "请填写账号，并设置至少 6 位密码。" });
        return;
      }
      if (db.users.some((user) => user.email === email)) {
        send(res, 409, { error: "这个账号已经存在，请直接登录。" });
        return;
      }

      const user = {
        id: crypto.randomUUID(),
        email,
        name,
        title: "ToB 销售",
        phone: "",
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      const token = crypto.randomBytes(32).toString("hex");
      db.users.push(user);
      db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
      db.crm[user.id] = structuredClone(defaultCrmData);
      writeDb(db);
      send(res, 201, { token, user: publicUser(user), data: db.crm[user.id] });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const user = db.users.find((item) => item.email === email);

      if (!user || !verifyPassword(password, user.passwordHash)) {
        send(res, 401, { error: "账号或密码不正确。" });
        return;
      }

      const token = crypto.randomBytes(32).toString("hex");
      db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
      writeDb(db);
      send(res, 200, { token, user: publicUser(user), data: userData(db, user.id) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const token = bearerToken(req);
      db.sessions = db.sessions.filter((session) => session.token !== token);
      writeDb(db);
      send(res, 200, { ok: true });
      return;
    }

    const user = currentUser(req, db);
    if (!user) {
      send(res, 401, { error: "请先登录。" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/session") {
      writeDb(db);
      send(res, 200, { user: publicUser(user), data: userData(db, user.id) });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/crm") {
      const body = await readBody(req);
      db.crm[user.id] = { ...userData(db, user.id), ...(body.data || {}) };
      writeDb(db);
      send(res, 200, { ok: true, savedAt: new Date().toISOString() });
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/me") {
      const body = await readBody(req);
      user.name = String(body.name || user.name).trim();
      user.title = String(body.title || user.title || "").trim();
      user.phone = String(body.phone || user.phone || "").trim();
      writeDb(db);
      send(res, 200, { user: publicUser(user) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/change-password") {
      const body = await readBody(req);
      const nextPassword = String(body.nextPassword || "");
      if (nextPassword.length < 6) {
        send(res, 400, { error: "新密码至少 6 位。" });
        return;
      }
      user.passwordHash = hashPassword(nextPassword);
      writeDb(db);
      send(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/customer-insight") {
      const body = await readBody(req);
      const data = userData(db, user.id);
      const customer = data.customers.find((item) => item.id === body.customerId);
      if (!customer) {
        send(res, 404, { error: "没有找到这个客户。" });
        return;
      }
      const webResults = await searchCompany(customer.company, customer.industry);
      send(res, 200, { insight: buildCustomerInsight(customer, data, webResults) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/followup-suggest") {
      const body = await readBody(req);
      const data = userData(db, user.id);
      const customer = data.customers.find((item) => item.id === body.customerId);
      send(res, 200, { suggestion: buildFollowupSuggestion(customer, body.content) });
      return;
    }

    send(res, 404, { error: "Not found" });
  } catch (error) {
    send(res, 500, { error: error.message || "服务器开小差了。" });
  }
}

http.createServer(handle).listen(port, () => {
  console.log(`CRM API ready at http://localhost:${port}`);
});
