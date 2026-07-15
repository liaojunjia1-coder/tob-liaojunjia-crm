import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  ClipboardList,
  Download,
  Edit3,
  FileText,
  HandCoins,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import {
  CLOUD_MODE,
  changeCloudPassword,
  cloudLogin,
  cloudLogout,
  cloudRegister,
  restoreCloudSession,
  saveCloudData,
  saveCloudProfile,
} from "./cloudCrm";
import { buildCustomerInsight, buildFollowupSuggestion } from "./aiAdvisor";

const STORAGE_KEY = "apprentice-sales-crm-v1";
const TOKEN_KEY = "sales-crm-token-v2";
const USER_KEY = "sales-crm-user-v2";
const REMEMBER_KEY = "sales-crm-remember-v1";
const REVIEW_DRAFT_KEY = "sales-crm-review-draft-v1";
const FORM_DRAFT_PREFIX = "sales-crm-form-draft-v1";
const DATA_VERSION = 3;
const STATIC_LOCAL_MODE = import.meta.env.VITE_STATIC_LOCAL_MODE === "true";

const STAGES = [
  { id: "新线索", probability: 10, tone: "lead" },
  { id: "已联系", probability: 20, tone: "contacted" },
  { id: "需求确认", probability: 40, tone: "discovery" },
  { id: "方案报价", probability: 60, tone: "proposal" },
  { id: "谈判中", probability: 80, tone: "negotiation" },
  { id: "已成交", probability: 100, tone: "won" },
  { id: "暂缓", probability: 0, tone: "paused" },
];

const METHODS = ["电话", "微信", "邮件", "拜访", "视频会议"];
const PRIORITIES = ["A", "B", "C", "D"];
const TASK_PRIORITIES = ["高", "中", "低"];
const PLAN_TYPES = ["日计划", "周计划", "月计划"];
const PLAN_STATUSES = ["进行中", "未开始", "已完成", "已延期"];
const CONTRACT_STATUS = ["合同审核", "已签约", "部分回款", "已回款", "逾期", "暂停"];
const CUSTOMER_TYPES = ["终端客户", "企业客户", "集成商/服务商", "渠道/代理商", "政府/事业单位", "科研院校", "其他"];
const APPLICATION_SCENARIOS = ["生产制造", "仓储物流", "设备运维", "企业管理", "商业服务", "科研教学", "其他"];
const FOLLOWUP_TEMPLATES = [
  {
    label: "电话沟通",
    method: "电话",
    content: "沟通结论：\n客户当前情况：\n核心问题：\n预算/决策人：\n客户态度：",
    nextStep: "下一步：补齐预算和决策链，约定下次沟通时间。",
  },
  {
    label: "拜访复盘",
    method: "拜访",
    content: "拜访结论：\n现场看到的问题：\n关键人态度：\n竞品/替代方案：\n风险点：",
    nextStep: "下一步：整理拜访纪要和方案范围，发给客户确认。",
  },
  {
    label: "报价跟进",
    method: "微信",
    content: "报价反馈：\n客户卡点：\n价格/范围是否匹配：\n审批流程：\n还缺什么材料：",
    nextStep: "下一步：约 15 分钟报价复盘，确认价格、范围和决策流程。",
  },
];

const VIEWS = [
  { id: "dashboard", label: "今日工作台", shortLabel: "今日", icon: LayoutDashboard },
  { id: "leads", label: "线索池", shortLabel: "线索", icon: Target },
  { id: "customers", label: "客户", shortLabel: "客户", icon: Users },
  { id: "pipeline", label: "销售漏斗", shortLabel: "漏斗", icon: TrendingUp },
  { id: "followups", label: "跟进记录", shortLabel: "跟进", icon: MessageSquare },
  { id: "tasks", label: "日周月计划", shortLabel: "计划", icon: CalendarDays },
  { id: "contracts", label: "合同与回款", shortLabel: "合同", icon: HandCoins },
  { id: "review", label: "销售复盘", shortLabel: "复盘", icon: ClipboardList },
];

const NAV_GROUPS = [
  { id: "customer", label: "客户经营", views: ["dashboard", "leads", "customers", "pipeline"] },
  { id: "execution", label: "销售执行", views: ["followups", "tasks", "contracts", "review"] },
];

const MOBILE_VIEWS = ["dashboard", "customers", "followups", "tasks"];

const emptyCustomer = {
  company: "",
  contact: "",
  phone: "",
  industry: "",
  stage: "新线索",
  amount: "",
  priority: "B",
  source: "",
  recordedAt: "",
  painPoint: "",
  decisionMaker: "",
  competitor: "",
  tags: "",
  note: "",
  customerType: "",
  productInterest: "",
  applicationScenario: "",
  workpiece: "",
  robotModel: "",
  accuracyRequirement: "",
  cycleRequirement: "",
  siteChallenges: "",
  testMaterials: "",
  projectTimeline: "",
  technicalContact: "",
};

const emptyContract = {
  customerId: "",
  title: "",
  contractNo: "",
  amount: "",
  paidAmount: "",
  status: "合同审核",
  signDate: "",
  paymentDue: "",
  note: "",
};

const defaultSettings = {
  reminderDays: 2,
  defaultTaskPriority: "中",
  compactCustomers: true,
  aiMode: "实用销售参谋",
};

const defaultData = {
  dataVersion: DATA_VERSION,
  customers: [],
  activities: [],
  tasks: [],
  contracts: [],
  contractFiles: [],
  salesDiary: "",
  logs: [],
  settings: defaultSettings,
};

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dedupeLogs(logs = []) {
  const seen = new Set();
  return logs.filter((log) => {
    const key = `${log.type || ""}|${log.text || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

function withLog(data, type, text) {
  return {
    ...data,
    logs: dedupeLogs([
      {
        id: makeId("log"),
        type,
        text,
        createdAt: new Date().toISOString(),
      },
      ...(data.logs || []),
    ]),
  };
}

function formDraftKey(key) {
  return `${FORM_DRAFT_PREFIX}:${key}`;
}

function loadFormDraft(key, fallback) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(formDraftKey(key)));
    if (saved && typeof saved === "object" && !Array.isArray(saved) && fallback && typeof fallback === "object") {
      return { ...fallback, ...saved };
    }
    return saved ?? fallback;
  } catch {
    return fallback;
  }
}

function saveFormDraft(key, value) {
  window.localStorage.setItem(formDraftKey(key), JSON.stringify(value));
}

function clearFormDraft(key) {
  window.localStorage.removeItem(formDraftKey(key));
}

function useStoredDraft(key, initialValue) {
  const initialRef = useRef();
  if (initialRef.current === undefined) {
    initialRef.current = typeof initialValue === "function" ? initialValue() : initialValue;
  }
  const skipNextSave = useRef(false);
  const [value, setValue] = useState(() => loadFormDraft(key, initialRef.current));

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveFormDraft(key, value);
  }, [key, value]);

  function resetDraft(nextValue = initialRef.current) {
    clearFormDraft(key);
    if (Object.is(value, nextValue)) {
      skipNextSave.current = false;
      return;
    }
    skipNextSave.current = true;
    setValue(nextValue);
  }

  return [value, setValue, resetDraft];
}

function downloadTextFile(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function stageMeta(stage) {
  return STAGES.find((item) => item.id === stage) || STAGES[0];
}

function normalizeData(raw) {
  const incoming = raw && typeof raw === "object" ? raw : defaultData;
  const source = Number(incoming.dataVersion || 0) < DATA_VERSION
    ? { ...defaultData, settings: { ...defaultSettings, ...(incoming.settings || {}) } }
    : incoming;
  return {
    dataVersion: DATA_VERSION,
    customers: (source.customers || []).map((customer) => ({
      ...emptyCustomer,
      ...customer,
      interestedProducts: [],
      productInterest: customer.productInterest || "",
      recordedAt: customer.recordedAt || customer.closeDate || todayInputValue(),
    })),
    activities: source.activities || [],
    tasks: (source.tasks || []).map((task) => ({
      priority: "中",
      ...task,
      planType: task.planType || "日计划",
      status: task.done ? "已完成" : task.status || "进行中",
    })),
    contracts: (source.contracts || []).map((contract) => ({
      ...emptyContract,
      ...contract,
      contractNo: String(contract.contractNo || "").replace(/^LJ-/, "TOB-"),
    })),
    contractFiles: source.contractFiles || [],
    salesDiary: source.salesDiary || "",
    logs: dedupeLogs(source.logs || []),
    settings: { ...defaultSettings, ...(source.settings || {}) },
  };
}

function clearPreviousContentDrafts() {
  window.localStorage.removeItem(REVIEW_DRAFT_KEY);
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(FORM_DRAFT_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
}

function loadLocalData() {
  try {
    window.localStorage.removeItem(formDraftKey("learning-notes"));
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : defaultData;
    if (Number(parsed.dataVersion || 0) < DATA_VERSION) clearPreviousContentDrafts();
    return normalizeData(parsed);
  } catch {
    return normalizeData(defaultData);
  }
}

function rememberedCredentials() {
  try {
    return JSON.parse(window.localStorage.getItem(REMEMBER_KEY));
  } catch {
    return null;
  }
}

function emptyReviewDraft() {
  return {
    conclusion: "",
    blocker: "",
    nextStep: "",
    ability: "",
  };
}

function loadReviewDraft() {
  try {
    return { ...emptyReviewDraft(), ...JSON.parse(window.localStorage.getItem(REVIEW_DRAFT_KEY)) };
  } catch {
    return emptyReviewDraft();
  }
}

function staticAuthPayload(account, password, name = "tob廖俊嘉") {
  const cleanAccount = String(account || "").trim();
  if (!cleanAccount) throw new Error("请先填写账号。");
  if (!password || password.length < 6) throw new Error("密码至少需要 6 位。");

  return {
    token: `static-${cleanAccount}-${Date.now()}`,
    user: {
      id: `static-${cleanAccount.toLowerCase()}`,
      email: cleanAccount,
      account: cleanAccount,
      name: name || "tob廖俊嘉",
      title: "ToB 销售",
      phone: "",
    },
    data: loadLocalData(),
  };
}

function money(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "¥0";
  return number.toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  });
}

function formatFileSize(size) {
  const number = Number(size || 0);
  if (!number) return "未知大小";
  if (number < 1024 * 1024) return `${Math.round(number / 1024)}KB`;
  return `${(number / 1024 / 1024).toFixed(1)}MB`;
}

function customerName(customers, id) {
  return customers.find((customer) => customer.id === id)?.company || "未关联客户";
}

async function api(path, options = {}) {
  const token = window.localStorage.getItem(TOKEN_KEY);
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

function App() {
  const remembered = rememberedCredentials();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [rememberLogin, setRememberLogin] = useState(Boolean(remembered?.remember));
  const [authForm, setAuthForm] = useState({
    name: "tob廖俊嘉",
    email: remembered?.email || (CLOUD_MODE ? "" : "liaojunjia@crm.local"),
    password: remembered?.password || (CLOUD_MODE ? "" : "12345678"),
  });
  const [profileForm, setProfileForm] = useState({ name: "tob廖俊嘉", title: "ToB 销售", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ nextPassword: "12345678" });
  const [data, setData] = useState(loadLocalData);
  const [syncStatus, setSyncStatus] = useState("本机缓存");
  const [backupStatus, setBackupStatus] = useState("");
  const [reportCopied, setReportCopied] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true,
  );
  const [activeView, setActiveView] = useState("dashboard");
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [stageFilter, setStageFilter] = useState("全部");
  const [priorityFilter, setPriorityFilter] = useState("全部评级");
  const [riskFilter, setRiskFilter] = useState("全部风险");
  const [customerSort, setCustomerSort] = useState("风险优先");
  const [todoFilter, setTodoFilter] = useState("日计划");
  const [customerForm, setCustomerForm] = useState(emptyCustomer);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [followupAi, setFollowupAi] = useState(null);
  const [activityForm, setActivityForm, clearActivityDraft] = useStoredDraft("followup", () => ({
    customerId: "",
    method: "电话",
    date: todayInputValue(),
    content: "",
    nextStep: "",
    makeTask: true,
    taskDueDate: todayInputValue(),
    taskPriority: "中",
  }));
  const [taskForm, setTaskForm, clearTaskDraft] = useStoredDraft("task", () => ({
    customerId: "",
    title: "",
    dueDate: todayInputValue(),
    priority: defaultSettings.defaultTaskPriority,
    planType: "日计划",
    status: "进行中",
  }));
  const [contractForm, setContractForm, clearContractDraft] = useStoredDraft("contract", () => ({
    ...emptyContract,
    paymentDue: todayInputValue(),
  }));

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const action = params.get("action");

    if ([...VIEWS.map((item) => item.id), "settings"].includes(view)) {
      setActiveView(view);
    }
    if (action === "new-customer") {
      openNewCustomerForm();
    }
  }, []);

  useEffect(() => {
    async function restoreSession() {
      if (STATIC_LOCAL_MODE) {
        const token = window.localStorage.getItem(TOKEN_KEY);
        const savedUser = window.localStorage.getItem(USER_KEY);
        if (token && savedUser) {
          try {
            acceptLogin({ user: JSON.parse(savedUser), data: loadLocalData() }, token);
            return;
          } catch {
            window.localStorage.removeItem(TOKEN_KEY);
            window.localStorage.removeItem(USER_KEY);
          }
        }

        const saved = rememberedCredentials();
        if (saved?.remember && saved.email && saved.password) {
          try {
            const payload = staticAuthPayload(saved.email, saved.password);
            acceptLogin(payload, payload.token);
            return;
          } catch {
            setAuthError("自动登录失败，请手动确认密码。");
          }
        }
        setAuthReady(true);
        return;
      }

      if (CLOUD_MODE) {
        try {
          const payload = await restoreCloudSession(defaultData);
          if (payload) {
            acceptLogin(payload, payload.token);
            return;
          }
        } catch {
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(USER_KEY);
        }

        const saved = rememberedCredentials();
        if (saved?.remember && saved.email && saved.password) {
          try {
            const payload = await loginRequest(saved.email, saved.password);
            acceptLogin(payload, payload.token);
            return;
          } catch {
            setAuthError("自动登录失败，请手动确认密码。");
          }
        }
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        setUser(null);
        setAuthReady(true);
        return;
      }

      const token = window.localStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const payload = await api("/api/session");
          acceptLogin(payload, token);
          return;
        } catch {
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(USER_KEY);
        }
      }

      const saved = rememberedCredentials();
      if (saved?.remember && saved.email && saved.password) {
        try {
          const payload = await loginRequest(saved.email, saved.password);
          acceptLogin(payload, payload.token);
          return;
        } catch {
          setAuthError("自动登录失败，请手动确认密码。");
        }
      }
      setAuthReady(true);
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (!selectedCustomerId && data.customers[0]?.id) {
      const firstId = data.customers[0].id;
      setSelectedCustomerId(firstId);
      setActivityForm((form) => ({ ...form, customerId: firstId }));
      setTaskForm((form) => ({
        ...form,
        customerId: firstId,
        priority: data.settings.defaultTaskPriority || "中",
      }));
      setContractForm((form) => ({ ...form, customerId: firstId }));
    }
  }, [data.customers, data.settings.defaultTaskPriority, selectedCustomerId]);

  async function loginRequest(email, password) {
    if (STATIC_LOCAL_MODE) return staticAuthPayload(email, password, authForm.name);
    if (CLOUD_MODE) return cloudLogin(email, password, defaultData);
    return api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  function acceptLogin(payload, token) {
    const nextData = normalizeData(payload.data);
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    setUser(payload.user);
    setProfileForm({
      name: payload.user.name || "tob廖俊嘉",
      title: payload.user.title || "ToB 销售",
      phone: payload.user.phone || "",
    });
    setData(nextData);
    setSelectedCustomerId(nextData.customers[0]?.id || "");
    setSyncStatus(CLOUD_MODE ? "云端已同步" : "本机已保存");
    setAuthReady(true);
  }

  async function saveRemote(nextData) {
    if (STATIC_LOCAL_MODE) {
      setSyncStatus("本机已保存");
      return;
    }
    if (!CLOUD_MODE && !window.localStorage.getItem(TOKEN_KEY)) return;
    setSyncStatus("同步中");
    try {
      if (CLOUD_MODE) {
        await saveCloudData(nextData);
      } else {
        await api("/api/crm", {
          method: "PUT",
          body: JSON.stringify({ data: nextData }),
        });
      }
      setSyncStatus(CLOUD_MODE ? "云端已同步" : "本机已保存");
    } catch {
      setSyncStatus(CLOUD_MODE ? "云端待同步" : "本机待保存");
    }
  }

  function commit(nextData) {
    const normalized = normalizeData(nextData);
    setData(normalized);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    saveRemote(normalized);
  }

  function go(view) {
    setShowCustomerForm(false);
    setShowMobileMore(false);
    setActiveView(view);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");
    try {
      const payload =
        authMode === "login"
          ? await loginRequest(authForm.email, authForm.password)
          : STATIC_LOCAL_MODE
            ? staticAuthPayload(authForm.email, authForm.password, authForm.name)
            : CLOUD_MODE
              ? await cloudRegister(authForm, defaultData)
              : await api("/api/auth/register", { method: "POST", body: JSON.stringify(authForm) });
      if (rememberLogin) {
        window.localStorage.setItem(
          REMEMBER_KEY,
          JSON.stringify({ remember: true, email: authForm.email, password: authForm.password }),
        );
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
      }
      acceptLogin(payload, payload.token);
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function logout() {
    if (STATIC_LOCAL_MODE) {
      // 静态镜像只清理本机登录态，不访问任何云服务。
    } else if (CLOUD_MODE) {
      await cloudLogout().catch(() => {});
    } else {
      await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    }
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
    setAuthMode("login");
    setSyncStatus("已退出");
  }

  async function saveProfile(event) {
    event.preventDefault();
    const nextUser = STATIC_LOCAL_MODE
      ? { ...user, ...profileForm }
      : CLOUD_MODE
        ? await saveCloudProfile(profileForm)
        : (
          await api("/api/me", {
            method: "PATCH",
            body: JSON.stringify(profileForm),
          })
        ).user;
    setUser(nextUser);
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setSyncStatus("个人资料已保存");
  }

  async function changePassword(event) {
    event.preventDefault();
    if (STATIC_LOCAL_MODE) {
      // 静态镜像的密码只用于本机快速进入，无需调用服务器。
    } else if (CLOUD_MODE) {
      await changeCloudPassword(passwordForm.nextPassword);
    } else {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(passwordForm),
      });
    }
    setAuthForm((form) => ({ ...form, password: passwordForm.nextPassword }));
    if (rememberLogin) {
      window.localStorage.setItem(
        REMEMBER_KEY,
        JSON.stringify({ remember: true, email: authForm.email || user.email, password: passwordForm.nextPassword }),
      );
    }
    setSyncStatus("密码已更新");
  }

  function saveSettings(nextSettings) {
    commit({ ...data, settings: { ...data.settings, ...nextSettings } });
  }

  function exportBackup() {
    const payload = {
      app: "tob-liaojunjia-crm",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: normalizeData(data),
    };
    downloadTextFile(
      `tob-crm-backup-${todayInputValue()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
    setBackupStatus("已生成备份文件。换手机或换浏览器时，可用这个文件导入恢复。");
  }

  function exportCustomersCsv() {
    const rows = [
      [
        "公司",
        "联系人",
        "电话",
        "行业",
        "阶段",
        "评级",
        "预计金额",
        "来源",
        "建档日期",
        "核心痛点",
        "决策链",
        "竞品",
        "标签",
        "备注",
      ],
      ...data.customers.map((customer) => [
        customer.company,
        customer.contact,
        customer.phone,
        customer.industry,
        customer.stage,
        customer.priority,
        customer.amount,
        customer.source,
        customer.recordedAt,
        customer.painPoint,
        customer.decisionMaker,
        customer.competitor,
        customer.tags,
        customer.note,
      ]),
    ];
    downloadTextFile(`客户清单-${todayInputValue()}.csv`, `\ufeff${toCsv(rows)}`, "text/csv;charset=utf-8");
    setBackupStatus("已导出客户 CSV，可直接用 Excel 或表格软件打开。");
  }

  function exportTasksCsv() {
    const rows = [
      ["计划", "关联客户", "计划日期", "计划类型", "优先级", "状态", "创建时间"],
      ...data.tasks.map((task) => [
        task.title,
        customerName(data.customers, task.customerId),
        task.dueDate,
        task.planType,
        task.priority,
        task.status || (task.done ? "已完成" : "进行中"),
        String(task.createdAt || "").slice(0, 10),
      ]),
    ];
    downloadTextFile(`计划清单-${todayInputValue()}.csv`, `\ufeff${toCsv(rows)}`, "text/csv;charset=utf-8");
    setBackupStatus("已导出计划 CSV，适合做日报、复盘或外部整理。");
  }

  async function importCustomersCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rows = parseCsv((await file.text()).replace(/^\ufeff/, ""));
      const headers = rows[0]?.map((header) => header.trim()) || [];
      const bodyRows = rows.slice(1);
      const getValue = (row, names) => {
        const index = names.map((name) => headers.indexOf(name)).find((item) => item >= 0);
        return index >= 0 ? String(row[index] || "").trim() : "";
      };
      const imported = bodyRows
        .map((row) => {
          const stage = getValue(row, ["阶段", "客户阶段"]) || "新线索";
          const priority = (getValue(row, ["评级", "客户评级"]) || "B").replace("类", "").trim();
          return {
            id: makeId("c"),
            company: getValue(row, ["公司", "公司名", "客户公司"]),
            contact: getValue(row, ["联系人", "客户姓名", "姓名"]),
            phone: getValue(row, ["电话", "电话/微信", "联系方式", "手机号"]),
            industry: getValue(row, ["行业"]),
            stage: STAGES.some((item) => item.id === stage) ? stage : "新线索",
            amount: getValue(row, ["预计金额", "金额", "预算"]),
            priority: PRIORITIES.includes(priority) ? priority : "B",
            source: getValue(row, ["来源", "线索来源"]),
            recordedAt: getValue(row, ["建档日期", "记录日期", "日期"]) || todayInputValue(),
            painPoint: getValue(row, ["核心痛点", "痛点", "需求"]),
            decisionMaker: getValue(row, ["决策链", "决策人", "关键人"]),
            competitor: getValue(row, ["竞品", "竞品/替代方案", "替代方案"]),
            tags: getValue(row, ["标签"]),
            note: getValue(row, ["备注", "说明"]),
            createdAt: new Date().toISOString(),
          };
        })
        .filter((customer) => customer.company);

      if (!imported.length) {
        setBackupStatus("没有识别到客户。CSV 至少需要一列「公司」或「公司名」。");
        return;
      }

      const confirmed = window.confirm(`识别到 ${imported.length} 个客户，将追加到当前客户池，不会覆盖现有数据。是否导入？`);
      if (!confirmed) {
        setBackupStatus("已取消客户 CSV 导入。");
        return;
      }

      commit({
        ...withLog(data, "客户", `批量导入客户：${imported.length} 个`),
        customers: [...imported, ...data.customers],
      });
      setSelectedCustomerId(imported[0].id);
      setBackupStatus(`已导入 ${imported.length} 个客户。`);
    } catch {
      setBackupStatus("导入失败，请确认文件是 CSV 格式，并包含表头。");
    }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      const sourceData = payload?.data || payload;
      if (!Array.isArray(sourceData?.customers) || !Array.isArray(sourceData?.activities) || !Array.isArray(sourceData?.tasks)) {
        throw new Error("文件不是有效的 CRM 备份。");
      }
      const nextData = normalizeData(sourceData);
      const confirmed = window.confirm(
        `将导入 ${nextData.customers.length} 个客户、${nextData.activities.length} 条跟进、${nextData.tasks.length} 个计划，并覆盖当前浏览器里的 CRM 数据。是否继续？`,
      );
      if (!confirmed) {
        setBackupStatus("已取消导入，当前数据未改变。");
        return;
      }
      commit(nextData);
      const firstId = nextData.customers[0]?.id || "";
      setSelectedCustomerId(firstId);
      setActivityForm((form) => ({ ...form, customerId: firstId }));
      setTaskForm((form) => ({ ...form, customerId: firstId }));
      setContractForm((form) => ({ ...form, customerId: firstId }));
      setBackupStatus("导入成功。当前浏览器已恢复这份 CRM 数据。");
    } catch (error) {
      setBackupStatus(error.message || "导入失败，请确认文件格式。");
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  }

  const selectedCustomer = useMemo(
    () => data.customers.find((customer) => customer.id === selectedCustomerId) || data.customers[0],
    [data.customers, selectedCustomerId],
  );

  const sortedActivities = useMemo(
    () => [...data.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.activities],
  );

  const filteredCustomers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return data.customers
      .filter((customer) => {
        const risk = customerRisk(customer, data.activities, data.tasks);
        const matchesKeyword =
          !keyword ||
          [customer.company, customer.contact, customer.phone, customer.industry, customer.tags, customer.source]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        const matchesStage = stageFilter === "全部" || customer.stage === stageFilter;
        const matchesPriority = priorityFilter === "全部评级" || `${customer.priority}类` === priorityFilter;
        const matchesRisk =
          riskFilter === "全部风险" ||
          (riskFilter === "高风险" && risk.level === "risk") ||
          (riskFilter === "需动作" && risk.level === "watch") ||
          (riskFilter === "健康" && risk.level === "good");
        return matchesKeyword && matchesStage && matchesPriority && matchesRisk;
      })
      .sort((a, b) => {
        if (customerSort === "金额高到低") return Number(b.amount || 0) - Number(a.amount || 0);
        if (customerSort === "评级优先") return customerPriorityRank(a.priority) - customerPriorityRank(b.priority);
        if (customerSort === "新建优先") return String(b.recordedAt || b.createdAt || "").localeCompare(String(a.recordedAt || a.createdAt || ""));
        return (
          riskRank(customerRisk(a, data.activities, data.tasks).level) -
            riskRank(customerRisk(b, data.activities, data.tasks).level) ||
          customerPriorityRank(a.priority) - customerPriorityRank(b.priority)
        );
      });
  }, [data.customers, data.activities, data.tasks, searchText, stageFilter, priorityFilter, riskFilter, customerSort]);

  const visibleTasks = useMemo(() => {
    return data.tasks
      .filter((task) => {
        if (todoFilter === "日计划") return !task.done && task.planType === "日计划";
        if (todoFilter === "周计划") return !task.done && task.planType === "周计划";
        if (todoFilter === "月计划") return !task.done && task.planType === "月计划";
        if (todoFilter === "已完成") return task.done;
        return true;
      })
      .sort(
        (a, b) =>
          a.done - b.done ||
          planTypeRank(a.planType) - planTypeRank(b.planType) ||
          priorityRank(a.priority) - priorityRank(b.priority) ||
          String(a.dueDate).localeCompare(String(b.dueDate)),
      );
  }, [data.tasks, todoFilter]);

  const metrics = useMemo(() => {
    const today = todayInputValue();
    const openTasks = data.tasks.filter((task) => !task.done);
    const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < today);
    const dayPlans = openTasks.filter((task) => task.planType === "日计划");
    const weekPlans = openTasks.filter((task) => task.planType === "周计划");
    const monthPlans = openTasks.filter((task) => task.planType === "月计划");
    const doneTasks = data.tasks.filter((task) => task.done);
    const totalAmount = data.customers.reduce((sum, customer) => sum + Number(customer.amount || 0), 0);
    const forecast = data.customers.reduce((sum, customer) => {
      const probability = stageMeta(customer.stage).probability / 100;
      return sum + Number(customer.amount || 0) * probability;
    }, 0);
    const aCustomers = data.customers.filter((customer) => customer.priority === "A").length;
    const atRisk = data.customers.filter((customer) => customerRisk(customer, data.activities, data.tasks).level === "risk");
    const receivable = data.contracts.reduce(
      (sum, contract) => sum + Math.max(0, Number(contract.amount || 0) - Number(contract.paidAmount || 0)),
      0,
    );
    const fileCount = data.contractFiles.length;
    return { openTasks, overdueTasks, dayPlans, weekPlans, monthPlans, doneTasks, totalAmount, forecast, aCustomers, atRisk, receivable, fileCount };
  }, [data]);

  const customerActivities = useMemo(
    () => sortedActivities.filter((activity) => activity.customerId === selectedCustomer?.id),
    [sortedActivities, selectedCustomer],
  );

  function openNewCustomerForm() {
    const fallback = { ...emptyCustomer, recordedAt: todayInputValue() };
    setEditingCustomerId("");
    setCustomerForm(loadFormDraft("customer:new", fallback));
    setShowCustomerForm(true);
    setActiveView("customers");
  }

  function openEditCustomerForm(customer) {
    setEditingCustomerId(customer.id);
    setCustomerForm(loadFormDraft(`customer:${customer.id}`, { ...emptyCustomer, ...customer }));
    setShowCustomerForm(true);
    setActiveView("customers");
  }

  function changeCustomerForm(nextForm) {
    setCustomerForm(nextForm);
    saveFormDraft(`customer:${editingCustomerId || "new"}`, nextForm);
  }

  function saveCustomer(event) {
    event.preventDefault();
    const clean = {
      ...customerForm,
      company: customerForm.company.trim(),
      contact: customerForm.contact.trim(),
      phone: customerForm.phone.trim(),
      industry: customerForm.industry.trim(),
      amount: String(customerForm.amount || "").trim(),
      source: customerForm.source.trim(),
      recordedAt: customerForm.recordedAt || todayInputValue(),
      painPoint: customerForm.painPoint.trim(),
      decisionMaker: customerForm.decisionMaker.trim(),
      competitor: customerForm.competitor.trim(),
      tags: customerForm.tags.trim(),
      note: customerForm.note.trim(),
      customerType: customerForm.customerType.trim(),
      productInterest: customerForm.productInterest.trim(),
      applicationScenario: customerForm.applicationScenario.trim(),
      workpiece: customerForm.workpiece.trim(),
      robotModel: customerForm.robotModel.trim(),
      accuracyRequirement: customerForm.accuracyRequirement.trim(),
      cycleRequirement: customerForm.cycleRequirement.trim(),
      siteChallenges: customerForm.siteChallenges.trim(),
      testMaterials: customerForm.testMaterials.trim(),
      projectTimeline: customerForm.projectTimeline.trim(),
      technicalContact: customerForm.technicalContact.trim(),
    };
    if (!clean.company) return;

    if (editingCustomerId) {
      commit({
        ...withLog(data, "客户", `更新客户档案：${clean.company}`),
        customers: data.customers.map((customer) =>
          customer.id === editingCustomerId ? { ...customer, ...clean } : customer,
        ),
      });
    } else {
      const nextCustomer = { id: makeId("c"), ...clean, createdAt: new Date().toISOString() };
      commit({ ...withLog(data, "客户", `新增客户：${nextCustomer.company}`), customers: [nextCustomer, ...data.customers] });
      setSelectedCustomerId(nextCustomer.id);
      setActivityForm((form) => ({ ...form, customerId: nextCustomer.id }));
      setTaskForm((form) => ({ ...form, customerId: nextCustomer.id }));
      setContractForm((form) => ({ ...form, customerId: nextCustomer.id }));
    }

    clearFormDraft(`customer:${editingCustomerId || "new"}`);
    setShowCustomerForm(false);
    setCustomerForm(emptyCustomer);
    setEditingCustomerId("");
  }

  function deleteCustomer(id) {
    const remainingCustomers = data.customers.filter((customer) => customer.id !== id);
    commit({
      ...data,
      customers: remainingCustomers,
      activities: data.activities.filter((activity) => activity.customerId !== id),
      tasks: data.tasks.filter((task) => task.customerId !== id),
      contracts: data.contracts.filter((contract) => contract.customerId !== id),
    });
    setSelectedCustomerId(remainingCustomers[0]?.id || "");
    setAiInsight(null);
  }

  function updateCustomerField(customerId, field, value) {
    const targetCustomer = data.customers.find((customer) => customer.id === customerId);
    commit({
      ...withLog(data, "客户", `更新${targetCustomer?.company || "客户"}：${field === "stage" ? "阶段" : "字段"}`),
      customers: data.customers.map((customer) =>
        customer.id === customerId ? { ...customer, [field]: value } : customer,
      ),
    });
  }

  async function analyzeCustomer(customerId) {
    setAiLoading(true);
    setAiInsight(null);
    try {
      const customer = data.customers.find((item) => item.id === customerId);
      const payload = STATIC_LOCAL_MODE
        ? { insight: buildCustomerInsight(customer, data) }
        : CLOUD_MODE
          ? await api("/api/ai/customer-insight", {
            method: "POST",
            body: JSON.stringify({ customer, data }),
          }).catch(() => ({ insight: buildCustomerInsight(customer, data) }))
          : await api("/api/ai/customer-insight", {
              method: "POST",
              body: JSON.stringify({ customerId }),
            });
      setAiInsight(payload.insight);
    } catch (error) {
      setAiInsight({ error: error.message });
    } finally {
      setAiLoading(false);
    }
  }

  async function suggestFollowup() {
    if (!activityForm.content.trim()) return;
    setFollowupAi(null);
    const customer = data.customers.find((item) => item.id === activityForm.customerId);
    const payload = STATIC_LOCAL_MODE
      ? { suggestion: buildFollowupSuggestion(customer, activityForm.content) }
      : CLOUD_MODE
        ? await api("/api/ai/followup-suggest", {
          method: "POST",
          body: JSON.stringify({ customer, content: activityForm.content }),
        }).catch(() => ({ suggestion: buildFollowupSuggestion(customer, activityForm.content) }))
        : await api("/api/ai/followup-suggest", {
            method: "POST",
            body: JSON.stringify({ customerId: activityForm.customerId, content: activityForm.content }),
          });
    setFollowupAi(payload.suggestion);
  }

  function saveActivity(event) {
    event.preventDefault();
    if (!activityForm.customerId || !activityForm.content.trim()) return;
    const { makeTask, taskDueDate, taskPriority, ...activityFields } = activityForm;
    const nextActivity = {
      id: makeId("a"),
      ...activityFields,
      content: activityForm.content.trim(),
      nextStep: activityForm.nextStep.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextTasks =
      makeTask && activityForm.nextStep.trim()
        ? [
          {
            id: makeId("t"),
            customerId: activityForm.customerId,
            title: activityForm.nextStep.trim(),
            dueDate: taskDueDate || todayInputValue(),
            priority: taskPriority || "中",
            planType: "日计划",
            status: "进行中",
            done: false,
            createdAt: new Date().toISOString(),
          },
          ...data.tasks,
        ]
        : data.tasks;
    const targetCustomer = data.customers.find((customer) => customer.id === activityForm.customerId);
    commit({
      ...withLog(data, "跟进", `记录跟进：${targetCustomer?.company || "客户"}`),
      activities: [nextActivity, ...data.activities],
      tasks: nextTasks,
    });
    setSelectedCustomerId(activityForm.customerId);
    clearActivityDraft({
      ...activityForm,
      content: "",
      nextStep: "",
      taskDueDate: todayInputValue(),
      taskPriority: data.settings.defaultTaskPriority || "中",
    });
    setFollowupAi(null);
    go("customers");
  }

  function saveTask(event) {
    event.preventDefault();
    if (!taskForm.title.trim()) return;
    const nextTask = {
      id: makeId("t"),
      ...taskForm,
      title: taskForm.title.trim(),
      planType: taskForm.planType || "日计划",
      status: taskForm.status || "进行中",
      done: taskForm.status === "已完成",
      completedAt: taskForm.status === "已完成" ? new Date().toISOString() : "",
      createdAt: new Date().toISOString(),
    };
    commit({ ...withLog(data, "计划", `新增计划：${nextTask.title}`), tasks: [nextTask, ...data.tasks] });
    clearTaskDraft({ ...taskForm, title: "" });
    go("tasks");
  }

  function toggleTask(taskId) {
    const targetTask = data.tasks.find((task) => task.id === taskId);
    const nextDone = !targetTask?.done;
    commit({
      ...withLog(data, "计划", `${targetTask?.done ? "恢复" : "完成"}计划：${targetTask?.title || ""}`),
      tasks: data.tasks.map((task) =>
        task.id === taskId
          ? { ...task, done: nextDone, status: nextDone ? "已完成" : "进行中", completedAt: nextDone ? new Date().toISOString() : "" }
          : task,
      ),
    });
  }

  function updateTaskStatus(taskId, status) {
    commit({
      ...withLog(data, "计划", `更新计划状态：${status}`),
      tasks: data.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              done: status === "已完成",
              completedAt: status === "已完成" ? new Date().toISOString() : "",
            }
          : task,
      ),
    });
  }

  function delayTask(taskId) {
    commit({
      ...withLog(data, "计划", "延期计划"),
      tasks: data.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: "已延期",
              done: false,
              dueDate: nextDateValue(task.dueDate || todayInputValue(), 1),
            }
          : task,
      ),
    });
  }

  function deleteTask(taskId) {
    commit({ ...withLog(data, "计划", "删除计划"), tasks: data.tasks.filter((task) => task.id !== taskId) });
  }

  async function copyReport(text) {
    try {
      await navigator.clipboard.writeText(text);
      setReportCopied(true);
      setSyncStatus("日报已复制");
      window.setTimeout(() => setReportCopied(false), 1800);
    } catch {
      setSyncStatus("复制失败，请手动选择日报文本");
    }
  }

  async function copyCustomerPlan(customerId) {
    const customer = data.customers.find((item) => item.id === customerId);
    if (!customer) return;
    const plan = customerDealPlan(customer, data.activities, data.tasks);
    try {
      await navigator.clipboard.writeText(formatCustomerPlan(customer, plan));
      setSyncStatus("推进计划已复制");
    } catch {
      setSyncStatus("复制失败，请手动选择推进计划");
    }
  }

  function startPlannedFollowup(customerId) {
    const customer = data.customers.find((item) => item.id === customerId);
    if (!customer) return;
    const plan = customerDealPlan(customer, data.activities, data.tasks);
    setSelectedCustomerId(customerId);
    setActivityForm((form) => ({
      ...form,
      customerId,
      method: plan.method,
      date: todayInputValue(),
      content: plan.followupTemplate,
      nextStep: plan.nextStep,
      makeTask: true,
      taskDueDate: todayInputValue(),
      taskPriority: plan.priority,
    }));
    go("followups");
  }

  function saveCustomerPlan(customerId, draft) {
    const customer = data.customers.find((item) => item.id === customerId);
    if (!customer || !draft.nextStep.trim()) return false;
    const nextData = withLog(data, "计划", `保存推进计划：${customer.company}`);
    const savedPlan = {
      nextStep: draft.nextStep.trim(),
      method: draft.method,
      dueDate: draft.dueDate || todayInputValue(),
      priority: draft.priority || "中",
      status: draft.status || "进行中",
      planType: draft.planType || "不加入计划",
      updatedAt: new Date().toISOString(),
    };
    const nextTasks =
      draft.planType === "不加入计划"
        ? data.tasks
        : [
            {
              id: makeId("t"),
              customerId,
              title: draft.nextStep.trim(),
              dueDate: draft.dueDate || todayInputValue(),
              priority: draft.priority || "中",
              planType: draft.planType,
              status: draft.status || "进行中",
              done: draft.status === "已完成",
              completedAt: draft.status === "已完成" ? new Date().toISOString() : "",
              createdAt: new Date().toISOString(),
            },
            ...data.tasks,
          ];
    commit({
      ...nextData,
      customers: data.customers.map((item) => (item.id === customerId ? { ...item, dealPlan: savedPlan } : item)),
      tasks: nextTasks,
    });
    setSyncStatus(draft.planType === "不加入计划" ? "推进计划已保存" : `已加入${draft.planType}`);
    return true;
  }

  function createLeadFollowTask(customerId) {
    const customer = data.customers.find((item) => item.id === customerId);
    if (!customer) return;
    const risk = customerRisk(customer, data.activities, data.tasks);
    const nextTask = {
      id: makeId("t"),
      customerId,
      title: leadTaskTitle(customer, risk),
      dueDate: todayInputValue(),
      priority: risk.level === "risk" || customer.priority === "A" ? "高" : "中",
      planType: "日计划",
      status: "进行中",
      done: false,
      createdAt: new Date().toISOString(),
    };
    commit({ ...withLog(data, "计划", `生成客户计划：${customer.company}`), tasks: [nextTask, ...data.tasks] });
    setSyncStatus("已生成客户计划");
  }

  function generateDailyPlan() {
    const today = todayInputValue();
    const candidates = data.customers.filter((customer) => {
      if (customer.stage === "已成交" || customer.stage === "暂缓") return false;
      const hasOpenTask = data.tasks.some((task) => task.customerId === customer.id && !task.done);
      if (hasOpenTask) return false;
      const risk = customerRisk(customer, data.activities, data.tasks);
      return (
        risk.level !== "good" ||
        customer.priority === "A" ||
        customer.stage === "方案报价" ||
        customer.stage === "谈判中"
      );
    });

    const nextTasks = candidates.slice(0, 8).map((customer) => {
      const risk = customerRisk(customer, data.activities, data.tasks);
      return {
        id: makeId("t"),
        customerId: customer.id,
        title: leadTaskTitle(customer, risk),
        dueDate: today,
        priority: risk.level === "risk" || customer.priority === "A" || customer.stage === "谈判中" ? "高" : "中",
        planType: "日计划",
        status: "进行中",
        done: false,
        createdAt: new Date().toISOString(),
      };
    });

    if (!nextTasks.length) {
      setSyncStatus("日计划已是最新");
      return;
    }

    commit({
      ...withLog(data, "计划", `生成日计划：${nextTasks.length} 个动作`),
      tasks: [...nextTasks, ...data.tasks],
    });
    setSyncStatus(`已生成 ${nextTasks.length} 个日计划`);
    setTodoFilter("日计划");
  }

  function saveSalesDiary(text) {
    commit({ ...withLog(data, "日记", "更新销售日记"), salesDiary: text });
    setSyncStatus("销售日记已保存");
  }

  function saveReviewAction(draft, customerId) {
    const title = String(draft?.nextStep || "").trim();
    if (!title) {
      setSyncStatus("请先填写下一步动作");
      return false;
    }
    const nextTask = {
      id: makeId("t"),
      customerId: customerId || data.customers[0]?.id || "",
      title,
      dueDate: todayInputValue(),
      priority: "高",
      planType: "日计划",
      status: "进行中",
      done: false,
      createdAt: new Date().toISOString(),
    };
    commit({ ...withLog(data, "复盘", `从销售复盘生成日计划：${title}`), tasks: [nextTask, ...data.tasks] });
    setSyncStatus("已从复盘生成日计划");
    setTodoFilter("日计划");
    return true;
  }

  async function saveContractFiles(customerId, fileList) {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length) return;
    try {
      const records = await Promise.all(
        files.slice(0, 8).map(async (file) => ({
          id: makeId("file"),
          customerId: customerId || data.customers[0]?.id || "",
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: await readFileAsDataUrl(file),
          note: "",
          createdAt: new Date().toISOString(),
        })),
      );
      commit({
        ...withLog(data, "合同", `上传合同文件：${records.length} 个`),
        contractFiles: [...records, ...data.contractFiles],
      });
      setSyncStatus(`已保存 ${records.length} 个文件`);
    } catch (error) {
      setSyncStatus(error.message || "文件保存失败");
    }
  }

  function deleteContractFile(fileId) {
    commit({
      ...withLog(data, "合同", "删除合同文件"),
      contractFiles: data.contractFiles.filter((file) => file.id !== fileId),
    });
  }

  function saveContract(event) {
    event.preventDefault();
    if (!contractForm.customerId || !contractForm.title.trim()) return;
    const nextContract = {
      id: makeId("ct"),
      ...contractForm,
      title: contractForm.title.trim(),
      contractNo: contractForm.contractNo.trim(),
      amount: String(contractForm.amount || "").trim(),
      paidAmount: String(contractForm.paidAmount || "").trim(),
      note: contractForm.note.trim(),
      createdAt: new Date().toISOString(),
    };
    commit({ ...withLog(data, "合同", `新增合同：${nextContract.title}`), contracts: [nextContract, ...data.contracts] });
    clearContractDraft({
      ...emptyContract,
      customerId: contractForm.customerId,
      paymentDue: todayInputValue(),
    });
    go("contracts");
  }

  function deleteContract(contractId) {
    commit({ ...withLog(data, "合同", "删除合同/回款记录"), contracts: data.contracts.filter((contract) => contract.id !== contractId) });
  }

  function updateContract(contractId, patch) {
    commit({
      ...withLog(data, "合同", "更新合同/回款状态"),
      contracts: data.contracts.map((contract) => (contract.id === contractId ? { ...contract, ...patch } : contract)),
    });
  }

  function markContractPaid(contractId) {
    const contract = data.contracts.find((item) => item.id === contractId);
    if (!contract) return;
    updateContract(contractId, {
      paidAmount: String(contract.amount || contract.paidAmount || 0),
      status: "已回款",
      paymentDue: contract.paymentDue || todayInputValue(),
    });
  }

  if (!authReady) return <LoadingScreen />;

  if (!user) {
    return (
      <AuthScreen
        authError={authError}
        authForm={authForm}
        authMode={authMode}
        onChange={setAuthForm}
        onModeChange={setAuthMode}
        onRememberChange={setRememberLogin}
        onSubmit={submitAuth}
        rememberLogin={rememberLogin}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TOB</div>
          <div>
            <h1>Tob廖俊嘉</h1>
            <p>个人销售中台</p>
          </div>
        </div>
        <nav className="nav-list" aria-label="主导航">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.id}>
              <span className="nav-group-label">{group.label}</span>
              {group.views.map((viewId) => {
                const view = VIEWS.find((item) => item.id === viewId);
                const Icon = view.icon;
                return (
                  <button
                    className={activeView === view.id ? "nav-item active" : "nav-item"}
                    key={view.id}
                    onClick={() => go(view.id)}
                    type="button"
                  >
                    <Icon size={18} />
                    <span>{view.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-status">
          <div>
            <span>{CLOUD_MODE ? "本地优先" : "本机保存"}</span>
            <strong>{syncStatus}</strong>
          </div>
          <div className="sidebar-sync-track"><span /></div>
          <div>
            <span>客户资产</span>
            <strong>{data.customers.length} 位</strong>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h2>{viewTitle(activeView)}</h2>
            <p>{viewSubtitle(activeView)}</p>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={16} />
              <input
                onChange={(event) => setSearchText(event.target.value)}
                onFocus={() => activeView !== "customers" && go("customers")}
                placeholder="搜索客户、联系人或记录"
                value={searchText}
              />
            </label>
            <span className="sync-pill">
              <ShieldCheck size={16} />
              {syncStatus}
            </span>
            {installPrompt && !isInstalled && (
              <button className="secondary-button" onClick={installApp} type="button">
                <Download size={18} />
                安装App
              </button>
            )}
            <button className="secondary-button" onClick={() => go("settings")} type="button">
              <Settings size={18} />
              设置
            </button>
            <button className="primary-button" onClick={openNewCustomerForm} type="button">
              <UserPlus size={18} />
              新增客户
            </button>
            <button className="icon-button" onClick={logout} title="退出登录" type="button">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {activeView === "dashboard" && (
          <DashboardView
            data={data}
            metrics={metrics}
            onAddCustomer={openNewCustomerForm}
            onGeneratePlan={generateDailyPlan}
            onPickCustomer={(id) => {
              setSelectedCustomerId(id);
              go("customers");
            }}
            onToggleTask={toggleTask}
            onViewContracts={() => go("contracts")}
            onViewCustomers={() => go("customers")}
            onViewFollowups={() => go("followups")}
            onViewPipeline={() => go("pipeline")}
            onViewReview={() => go("review")}
            onViewTasks={() => go("tasks")}
            onSaveSalesDiary={saveSalesDiary}
          />
        )}

        {activeView === "pipeline" && (
          <PipelineView
            activities={data.activities}
            customers={data.customers}
            onStageChange={(id, stage) => updateCustomerField(id, "stage", stage)}
            onPickCustomer={(id) => {
              setSelectedCustomerId(id);
              go("customers");
            }}
            tasks={data.tasks}
          />
        )}

        {activeView === "customers" && (
          <CustomersView
            activities={customerActivities}
            aiInsight={aiInsight}
            aiLoading={aiLoading}
            customer={selectedCustomer}
            customers={filteredCustomers}
            data={data}
            onAddCustomer={openNewCustomerForm}
            onAnalyze={analyzeCustomer}
            onCopyPlan={copyCustomerPlan}
            onDelete={deleteCustomer}
            onEdit={openEditCustomerForm}
            onFieldChange={updateCustomerField}
            onPickCustomer={setSelectedCustomerId}
            onPlanFollowup={startPlannedFollowup}
            onSavePlan={saveCustomerPlan}
            onViewContracts={() => go("contracts")}
            priorityFilter={priorityFilter}
            riskFilter={riskFilter}
            customerSort={customerSort}
            searchText={searchText}
            selectedCustomerId={selectedCustomer?.id}
            setCustomerSort={setCustomerSort}
            setPriorityFilter={setPriorityFilter}
            setRiskFilter={setRiskFilter}
            setSearchText={setSearchText}
            setStageFilter={setStageFilter}
            stageFilter={stageFilter}
          />
        )}

        {activeView === "leads" && (
          <LeadCenterView
            activities={data.activities}
            customers={data.customers}
            onAddCustomer={openNewCustomerForm}
            onCreateTask={createLeadFollowTask}
            onPickCustomer={(id) => {
              setSelectedCustomerId(id);
              go("customers");
            }}
            onStageChange={(id, stage) => updateCustomerField(id, "stage", stage)}
            tasks={data.tasks}
          />
        )}

        {activeView === "followups" && (
          <FollowupsView
            activityForm={activityForm}
            customers={data.customers}
            followupAi={followupAi}
            onAddCustomer={openNewCustomerForm}
            onAcceptAi={(suggestion) =>
              setActivityForm((form) => ({ ...form, nextStep: suggestion.nextStep }))
            }
            onChange={setActivityForm}
            onSave={saveActivity}
            onSuggest={suggestFollowup}
            sortedActivities={sortedActivities}
          />
        )}

        {activeView === "tasks" && (
          <TasksView
            customers={data.customers}
            metrics={metrics}
            onChange={setTaskForm}
            onDelay={delayTask}
            onDelete={deleteTask}
            onPickCustomer={(id) => {
              setSelectedCustomerId(id);
              go("customers");
            }}
            onPlanFollowup={startPlannedFollowup}
            onSave={saveTask}
            onToggle={toggleTask}
            onUpdateStatus={updateTaskStatus}
            setTodoFilter={setTodoFilter}
            taskForm={taskForm}
            todoFilter={todoFilter}
            visibleTasks={visibleTasks}
          />
        )}

        {activeView === "review" && (
          <ReviewView
            copied={reportCopied}
            data={data}
            metrics={metrics}
            onCopy={copyReport}
            onCreateTask={createLeadFollowTask}
            onGeneratePlan={generateDailyPlan}
            onPickCustomer={(id) => {
              setSelectedCustomerId(id);
              go("customers");
            }}
            onPlanFollowup={startPlannedFollowup}
            onToggleTask={toggleTask}
            onViewTasks={() => go("tasks")}
            onSaveReviewAction={saveReviewAction}
          />
        )}

        {activeView === "contracts" && (
          <ContractsView
            contractForm={contractForm}
            contractFiles={data.contractFiles}
            contracts={data.contracts}
            customers={data.customers}
            onContractChange={updateContract}
            onChange={setContractForm}
            onDelete={deleteContract}
            onDeleteFile={deleteContractFile}
            onMarkPaid={markContractPaid}
            onSave={saveContract}
            onUploadFiles={saveContractFiles}
          />
        )}

        {activeView === "settings" && (
          <SettingsView
            backupStatus={backupStatus}
            data={data}
            onChangePassword={changePassword}
            onExportBackup={exportBackup}
            onExportCustomersCsv={exportCustomersCsv}
            onExportTasksCsv={exportTasksCsv}
            onImportCustomersCsv={importCustomersCsv}
            onImportBackup={importBackup}
            onPasswordChange={setPasswordForm}
            onProfileChange={setProfileForm}
            onSaveProfile={saveProfile}
            onSaveSettings={saveSettings}
            passwordForm={passwordForm}
            profileForm={profileForm}
            rememberLogin={rememberLogin}
            setRememberLogin={(nextValue) => {
              setRememberLogin(nextValue);
              if (!nextValue) window.localStorage.removeItem(REMEMBER_KEY);
            }}
            user={user}
          />
        )}

        {showCustomerForm && (
          <CustomerForm
            customerForm={customerForm}
            editing={Boolean(editingCustomerId)}
            onChange={changeCustomerForm}
            onClose={() => setShowCustomerForm(false)}
            onSubmit={saveCustomer}
          />
        )}
      </main>
      <MobileNavigation
        activeView={activeView}
        onGo={go}
        onMore={() => setShowMobileMore((current) => !current)}
        showMore={showMobileMore}
      />
    </div>
  );
}

function MobileNavigation({ activeView, onGo, onMore, showMore }) {
  const isMoreActive = !MOBILE_VIEWS.includes(activeView);
  const moreViews = ["leads", "pipeline", "contracts", "review"];

  return (
    <>
      {showMore && (
        <div className="mobile-more-panel">
          <div className="mobile-more-head">
            <strong>更多功能</strong>
            <button className="icon-button" onClick={onMore} title="关闭更多功能" type="button">
              <X size={17} />
            </button>
          </div>
          <div className="mobile-more-grid">
            {moreViews.map((viewId) => {
              const view = VIEWS.find((item) => item.id === viewId);
              const Icon = view.icon;
              return (
                <button key={view.id} onClick={() => onGo(view.id)} type="button">
                  <Icon size={19} />
                  <span>{view.label}</span>
                </button>
              );
            })}
            <button onClick={() => onGo("settings")} type="button">
              <Settings size={19} />
              <span>设置与备份</span>
            </button>
          </div>
        </div>
      )}
      <nav className="mobile-tabbar" aria-label="手机主导航">
        {MOBILE_VIEWS.map((viewId) => {
          const view = VIEWS.find((item) => item.id === viewId);
          const Icon = view.icon;
          return (
            <button className={activeView === view.id ? "active" : ""} key={view.id} onClick={() => onGo(view.id)} type="button">
              <Icon size={18} />
              <span>{view.shortLabel}</span>
            </button>
          );
        })}
        <button className={isMoreActive || showMore ? "active" : ""} onClick={onMore} type="button">
          <MoreHorizontal size={19} />
          <span>更多</span>
        </button>
      </nav>
    </>
  );
}

function DashboardView({
  data,
  metrics,
  onAddCustomer,
  onGeneratePlan,
  onPickCustomer,
  onToggleTask,
  onViewContracts,
  onViewCustomers,
  onViewFollowups,
  onViewPipeline,
  onViewReview,
  onViewTasks,
  onSaveSalesDiary,
}) {
  const todayLabel = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
  const focusTasks = [...metrics.openTasks]
    .sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")),
    )
    .slice(0, 3);
  const weeklyFollowups = data.activities.filter((activity) => {
    const elapsed = daysSince(activity.date);
    return elapsed !== null && elapsed >= 0 && elapsed <= 6;
  });
  const riskItems = data.customers
    .map((customer) => ({ customer, risk: customerRisk(customer, data.activities, data.tasks) }))
    .filter((item) => item.risk.level !== "good")
    .sort((a, b) => riskRank(a.risk.level) - riskRank(b.risk.level));
  const aWithoutPlan = data.customers.filter(
    (customer) =>
      customer.priority === "A" &&
      !["已成交", "暂缓"].includes(customer.stage) &&
      !data.tasks.some((task) => task.customerId === customer.id && !task.done),
  );
  const healthIssues = metrics.overdueTasks.length + riskItems.length + aWithoutPlan.length;
  const healthScore = data.customers.length ? Math.max(0, 100 - Math.min(100, healthIssues * 8)) : 0;
  const topRisk = riskItems[0];
  const suggestion = topRisk
    ? { customer: topRisk.customer, ...nextBestAction(topRisk.customer, data.activities, data.tasks) }
    : null;

  return (
    <section className="view v2-dashboard">
      <div className="v2-dashboard-context">
        <span>{todayLabel}</span>
        <strong>先处理最可能影响成交的动作</strong>
      </div>

      <div className="v2-metric-line">
        <button onClick={onViewPipeline} type="button">
          <span>本月管道金额</span><strong>{money(metrics.totalAmount)}</strong><small>{data.customers.length} 位客户</small>
        </button>
        <button onClick={onViewPipeline} type="button">
          <span>加权预测</span><strong>{money(metrics.forecast)}</strong><small>{metrics.totalAmount ? `${Math.round((metrics.forecast / metrics.totalAmount) * 100)}% 管道` : "等待客户数据"}</small>
        </button>
        <button onClick={onViewFollowups} type="button">
          <span>本周已跟进</span><strong>{weeklyFollowups.length}</strong><small>覆盖 {new Set(weeklyFollowups.map((item) => item.customerId)).size} 位客户</small>
        </button>
        <button onClick={onViewContracts} type="button">
          <span>待回款</span><strong>{money(metrics.receivable)}</strong><small>{metrics.fileCount} 份合同资料</small>
        </button>
      </div>

      {data.customers.length === 0 && <FirstRunGuide onAddCustomer={onAddCustomer} />}

      <div className="v2-command-grid">
        <section className="surface v2-focus-panel">
          <div className="panel-heading">
            <div><h3>今天必须完成</h3><p>按优先级、计划日期和客户风险自动排序</p></div>
            <button className="ghost-button" onClick={onViewTasks} type="button">进入日计划 <ArrowRight size={15} /></button>
          </div>
          <div className="v2-focus-list">
            {focusTasks.map((task) => (
              <article className={`v2-focus-row task-priority-${task.priority}`} key={task.id}>
                <button className="v2-check-button" onClick={() => onToggleTask(task.id)} title="标记完成" type="button"><Circle size={19} /></button>
                <button className="v2-focus-main" disabled={!task.customerId} onClick={() => task.customerId && onPickCustomer(task.customerId)} type="button">
                  <strong>{task.title}</strong>
                  <span>{customerName(data.customers, task.customerId)} · {task.planType || "销售计划"}</span>
                </button>
                <div className="v2-focus-time"><span>{task.priority}优先</span><time>{task.dueDate || "未设日期"}</time></div>
                <button className="icon-button" disabled={!task.customerId} onClick={() => task.customerId && onPickCustomer(task.customerId)} title="打开客户" type="button"><ChevronRight size={17} /></button>
              </article>
            ))}
            {focusTasks.length === 0 && (
              <div className="v2-focus-empty">
                <Check size={22} />
                <div><strong>今天没有待完成动作</strong><span>{data.customers.length ? "可以从风险客户生成一组今日计划。" : "建立客户后，关键动作会自动出现在这里。"}</span></div>
                <button className="secondary-button" onClick={data.customers.length ? onGeneratePlan : onAddCustomer} type="button">{data.customers.length ? "生成今日动作" : "新增客户"}</button>
              </div>
            )}
          </div>
        </section>

        <aside className="v2-command-side">
          <section className="surface v2-health-panel">
            <div className="v2-health-head"><div><strong>客户池健康度</strong><span>{data.customers.filter((item) => !["已成交", "暂缓"].includes(item.stage)).length} 位活跃客户</span></div><b>{healthScore}<small>/100</small></b></div>
            <div className="v2-health-track"><span style={{ width: `${healthScore}%` }} /></div>
            <div className="v2-signal-list">
              <button onClick={onViewTasks} type="button"><i className="risk" /><span>超期销售动作</span><em>{metrics.overdueTasks.length} 个</em><ChevronRight size={14} /></button>
              <button onClick={() => (aWithoutPlan[0] ? onPickCustomer(aWithoutPlan[0].id) : onViewCustomers())} type="button"><i className="watch" /><span>A 类客户缺计划</span><em>{aWithoutPlan.length} 位</em><ChevronRight size={14} /></button>
              <button onClick={() => (topRisk ? onPickCustomer(topRisk.customer.id) : onViewCustomers())} type="button"><i className="good" /><span>需要关注客户</span><em>{riskItems.length} 位</em><ChevronRight size={14} /></button>
            </div>
          </section>
          <section className="v2-next-suggestion">
            <span>下一步建议</span>
            <h3>{suggestion ? `${suggestion.customer.company}：${suggestion.title}` : "客户推进节奏正常，可以补充新线索。"}</h3>
            <p>{suggestion?.body || "优先建立真实客户并记录首次沟通结论。"}</p>
            <button onClick={suggestion ? () => onPickCustomer(suggestion.customer.id) : onGeneratePlan} type="button">{suggestion ? "处理这位客户" : "生成今日动作"}</button>
          </section>
        </aside>
      </div>

      <section className="surface v2-pipeline-panel">
        <div className="panel-heading"><div><h3>销售漏斗</h3><p>点击阶段查看客户，拖动客户可在完整漏斗中推进</p></div><button className="ghost-button" onClick={onViewPipeline} type="button">打开完整漏斗 <ArrowRight size={15} /></button></div>
        <PipelineStrip customers={data.customers} onPick={onPickCustomer} />
      </section>

      <div className="v2-dashboard-lower">
        <SalesDiaryCard diary={data.salesDiary} onSave={onSaveSalesDiary} />
        <section className="surface"><SectionHeader title="最近操作" action="进入复盘" onClick={onViewReview} /><ActivityLog logs={data.logs} /></section>
      </div>
    </section>
  );
}

function FirstRunGuide({ onAddCustomer }) {
  return (
    <section className="surface first-run-guide">
      <div>
        <span className="eyebrow">从 0 开始</span>
        <h3>先建立第一位真实客户</h3>
        <p>客户建档后，跟进、计划、漏斗和复盘才会围绕同一条销售机会自动串起来。</p>
      </div>
      <div className="first-run-steps" aria-label="首次使用步骤">
        <span><strong>1</strong>建立客户档案</span>
        <span><strong>2</strong>记录沟通结论</span>
        <span><strong>3</strong>安排下一步计划</span>
      </div>
      <button className="primary-button" onClick={onAddCustomer} type="button">
        <UserPlus size={17} />
        新增第一位客户
      </button>
    </section>
  );
}

function SalesDiaryCard({ diary, onSave }) {
  const [draft, setDraft, clearDraft] = useStoredDraft("sales-diary", diary || "");

  useEffect(() => {
    if (!draft && diary) setDraft(diary);
  }, [diary, draft, setDraft]);

  function saveDiary() {
    onSave(draft);
    clearDraft(draft);
  }

  return (
    <section className="surface sales-diary-card">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">销售日记</span>
          <h3>记录今天的判断</h3>
          <p>适合写拜访后的真实判断、客户情绪、价格异议和下一步想法。</p>
        </div>
        <button className="primary-button" onClick={saveDiary} type="button">
          <Save size={17} />
          保存
        </button>
      </div>
      <textarea
        className="diary-textarea"
        onChange={(event) => setDraft(event.target.value)}
        placeholder="例如：客户今天不是单纯嫌贵，而是担心内部审批慢。下次沟通先确认最终审批人和付款节点。"
        rows="5"
        value={draft}
      />
    </section>
  );
}

function ActivityLog({ logs = [] }) {
  const visibleLogs = [...logs].slice(0, 5);
  if (!visibleLogs.length) return <EmptyState text="暂无操作记录" />;

  return (
    <div className="activity-log">
      {visibleLogs.map((log) => (
        <article className="activity-log-row" key={log.id}>
          <span>{log.type}</span>
          <div>
            <strong>{log.text}</strong>
            <small>{String(log.createdAt || "").slice(0, 16).replace("T", " ")}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function DashboardActionSummary({ metrics, onGeneratePlan, onViewContracts, onViewCustomers, onViewReview, onViewTasks }) {
  return (
    <section className="surface action-summary">
      <div>
        <span className="eyebrow">行动摘要</span>
        <h3>今天只展示关键提醒</h3>
        <div className="action-summary-chips">
          <button onClick={onViewTasks} type="button">今日 {metrics.dayPlans.length} 个进行中</button>
          <button onClick={onViewTasks} type="button">本周 {metrics.weekPlans.length} 个待推进</button>
          <button onClick={onViewTasks} type="button">本月 {metrics.monthPlans.length} 个经营客户</button>
          <button onClick={onViewCustomers} type="button">高风险 {metrics.atRisk.length} 个</button>
          <button onClick={onViewContracts} type="button">待回款 {money(metrics.receivable)}</button>
        </div>
      </div>
      <div className="action-summary-actions">
        <button className="secondary-button" onClick={onGeneratePlan} type="button">
          <Bell size={16} />
          生成日计划
        </button>
        <button className="primary-button" onClick={onViewTasks} type="button">
          进入计划
          <ArrowRight size={16} />
        </button>
        <button className="secondary-button" onClick={onViewReview} type="button">
          <ClipboardList size={16} />
          销售复盘
        </button>
      </div>
    </section>
  );
}

function PriorityActions({ data, onPickCustomer, onToggleTask, onViewTasks }) {
  const actions = data.tasks
    .filter((task) => !task.done)
    .sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        String(a.dueDate).localeCompare(String(b.dueDate)),
    )
    .slice(0, 4);

  return (
    <section className="surface priority-actions">
      <SectionHeader title="今日优先动作" action="查看计划" onClick={onViewTasks} />
      <div className="priority-action-list">
        {actions.map((task) => (
          <article className={`priority-action task-priority-${task.priority}`} key={task.id}>
            <span>{task.priority}</span>
            <div>
              <strong>{task.title}</strong>
              <small>
                {task.dueDate || "未设日期"} · {customerName(data.customers, task.customerId)}
              </small>
              <div className="priority-card-actions">
                <button className="ghost-button" onClick={() => onToggleTask(task.id)} type="button">
                  <Check size={15} />
                  完成
                </button>
                <button className="ghost-button" onClick={() => onPickCustomer(task.customerId)} type="button">
                  <ArrowRight size={15} />
                  客户
                </button>
              </div>
            </div>
          </article>
        ))}
        {actions.length === 0 && <EmptyState text="今天没有未完成动作" />}
      </div>
    </section>
  );
}

function BusinessHealth({ data, metrics, onAddCustomer, onGeneratePlan, onPickCustomer, onViewTasks }) {
  const today = todayInputValue();
  const activeCustomers = data.customers.filter((customer) => !["已成交", "暂缓"].includes(customer.stage));
  const aWithoutPlan = activeCustomers.filter(
    (customer) => customer.priority === "A" && !data.tasks.some((task) => task.customerId === customer.id && !task.done),
  );
  const staleCustomers = activeCustomers.filter((customer) => {
    const latest = data.activities
      .filter((activity) => activity.customerId === customer.id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const inactiveDays = daysSince(latest?.date);
    return (!latest && customer.stage !== "新线索") || (inactiveDays !== null && inactiveDays >= 14);
  });
  const incompleteCustomers = activeCustomers.filter((customer) => customerCompleteness(customer).score < 50);
  const issues = [
    {
      count: metrics.overdueTasks.length,
      detail: !data.customers.length ? "暂无客户数据，建档后开始检查。" : metrics.overdueTasks.length ? "计划日期已过，需要重新安排或完成。" : "当前没有超期动作。",
      onClick: data.customers.length ? onViewTasks : onAddCustomer,
      title: "超期动作",
      tone: "risk",
    },
    {
      count: aWithoutPlan.length,
      detail: !data.customers.length ? "暂无客户数据，建档后开始检查。" : aWithoutPlan.length ? "A 类客户没有明确的下一步。" : "A 类客户都有推进计划。",
      onClick: data.customers.length ? () => (aWithoutPlan[0] ? onPickCustomer(aWithoutPlan[0].id) : onViewTasks()) : onAddCustomer,
      title: "A 类无计划",
      tone: "watch",
    },
    {
      count: staleCustomers.length,
      detail: !data.customers.length ? "暂无客户数据，建档后开始检查。" : staleCustomers.length ? "超过 14 天未联系，或推进后没有跟进记录。" : "客户联系节奏正常。",
      onClick: data.customers.length ? () => (staleCustomers[0] ? onPickCustomer(staleCustomers[0].id) : onViewTasks()) : onAddCustomer,
      title: "久未跟进",
      tone: "blue",
    },
    {
      count: incompleteCustomers.length,
      detail: !data.customers.length ? "暂无客户数据，建档后开始检查。" : incompleteCustomers.length ? "联系方式、金额、痛点或决策链信息不足。" : "关键客户资料较完整。",
      onClick: data.customers.length ? () => (incompleteCustomers[0] ? onPickCustomer(incompleteCustomers[0].id) : onViewTasks()) : onAddCustomer,
      title: "资料待补齐",
      tone: "violet",
    },
  ];
  const totalIssues = issues.reduce((sum, item) => sum + item.count, 0);
  const score = data.customers.length ? Math.max(0, Math.round(100 - Math.min(100, totalIssues * 12))) : 0;

  return (
    <section className="surface self-check">
      <div className="self-check-head">
        <div>
          <span className="eyebrow">运营体检</span>
          <h3>客户池健康度</h3>
          <p>按今天 {today} 的客户、跟进和计划数据检查。点问题卡片可直接处理。</p>
        </div>
        <div className="health-actions">
          <div className="readiness-score">
            <strong>{score}</strong>
            <span>健康度</span>
          </div>
          {data.customers.length ? (
            <button className="secondary-button" onClick={onGeneratePlan} type="button">
              <Bell size={16} />
              补齐日计划
            </button>
          ) : (
            <button className="primary-button" onClick={onAddCustomer} type="button">
              <UserPlus size={16} />
              新增客户
            </button>
          )}
        </div>
      </div>
      <div className="readiness-track">
        <span style={{ width: `${score}%` }} />
      </div>
      <div className="health-check-grid">
        {issues.map((item) => (
          <button className={`health-check-card ${item.tone}${item.count === 0 ? " clear" : ""}`} key={item.title} onClick={item.onClick} type="button">
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <em>{item.count}</em>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
    </section>
  );
}

function PipelineView({ activities, customers, onPickCustomer, onStageChange, tasks }) {
  return (
    <section className="view">
      <div className="pipeline-board">
        {STAGES.map((stage) => {
          const stageCustomers = customers.filter((customer) => customer.stage === stage.id);
          const stageAmount = stageCustomers.reduce((sum, customer) => sum + Number(customer.amount || 0), 0);
          return (
            <section
              className={`stage-column stage-tone-${stage.tone}`}
              key={stage.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const customerId = event.dataTransfer.getData("text/customer-id");
                if (customerId) onStageChange(customerId, stage.id);
              }}
            >
              <div className="stage-heading">
                <span>{stage.id}</span>
                <strong>{money(stageAmount)}</strong>
              </div>
              <div className="stage-list">
                {stageCustomers.map((customer) => {
                  const risk = customerRisk(customer, activities, tasks);
                  return (
                    <button
                      className={`deal-card priority-card-${customer.priority.toLowerCase()} stage-tone-${stage.tone} risk-${risk.level}`}
                      draggable
                      key={customer.id}
                      onClick={() => onPickCustomer(customer.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/customer-id", customer.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      type="button"
                    >
                      <span className={`priority-dot priority-${customer.priority.toLowerCase()}`} />
                      <span className={`priority-label priority-label-${customer.priority.toLowerCase()}`}>{customer.priority}类</span>
                      <strong>{customer.company}</strong>
                      <small>{customer.contact || "未填联系人"} · {money(customer.amount)}</small>
                      <span className={`customer-risk-chip ${risk.level}`}>{risk.label}</span>
                      <em>{stage.probability}% 可能性</em>
                    </button>
                  );
                })}
                {stageCustomers.length === 0 && <div className="empty-mini">暂无机会</div>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function CustomersView({
  activities,
  aiInsight,
  aiLoading,
  customer,
  customers,
  data,
  onAddCustomer,
  onAnalyze,
  onCopyPlan,
  onDelete,
  onEdit,
  onFieldChange,
  onPickCustomer,
  onPlanFollowup,
  onSavePlan,
  onViewContracts,
  priorityFilter,
  riskFilter,
  customerSort,
  searchText,
  selectedCustomerId,
  setCustomerSort,
  setPriorityFilter,
  setRiskFilter,
  setSearchText,
  setStageFilter,
  stageFilter,
}) {
  return (
    <section className="view">
      <div className="customer-layout">
        <section className="surface customer-list-panel">
          <div className="panel-heading customer-list-heading">
            <div>
              <span className="section-kicker">客户资产</span>
              <h3>客户列表 <em>{customers.length}</em></h3>
            </div>
            <button className="icon-button customer-list-add" onClick={onAddCustomer} title="新增客户" type="button">
              <Plus size={17} />
            </button>
          </div>
          <div className="filters customer-filter-grid">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="搜索客户"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索公司、联系人"
                value={searchText}
              />
            </label>
            <select aria-label="按客户阶段筛选" onChange={(event) => setStageFilter(event.target.value)} value={stageFilter}>
              <option value="全部">全部阶段</option>
              {STAGES.map((stage) => (
                <option key={stage.id}>{stage.id}</option>
              ))}
            </select>
            <select aria-label="按客户评级筛选" onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}>
              <option>全部评级</option>
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}类</option>
              ))}
            </select>
            <select aria-label="按客户风险筛选" onChange={(event) => setRiskFilter(event.target.value)} value={riskFilter}>
              {["全部风险", "高风险", "需动作", "健康"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select aria-label="客户排序" onChange={(event) => setCustomerSort(event.target.value)} value={customerSort}>
              {["风险优先", "评级优先", "金额高到低", "新建优先"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="customer-card-grid">
            {customers.map((item) => {
              const risk = customerRisk(item, data.activities, data.tasks);
              const nextTask = data.tasks
                .filter((task) => task.customerId === item.id && !task.done)
                .sort((a, b) => String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")))[0];
              const latestActivity = data.activities
                .filter((activity) => activity.customerId === item.id)
                .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
              const activityPreview = latestActivity?.content?.split("\n").find(Boolean);
              return (
                <button
                  className={`mini-customer-card priority-card-${item.priority.toLowerCase()} stage-tone-${stageMeta(item.stage).tone} risk-${risk.level}${
                    selectedCustomerId === item.id ? " active" : ""
                  }`}
                  key={item.id}
                  onClick={() => onPickCustomer(item.id)}
                  type="button"
                >
                  <span className="customer-card-head">
                    <span className={`customer-priority-mark priority-${item.priority.toLowerCase()}`}>{item.priority}</span>
                    <span className="customer-card-identity">
                      <strong>{item.company}</strong>
                      <small>{item.contact || "未填联系人"} · {item.industry || "未填行业"}</small>
                    </span>
                    <span className={`customer-risk-chip ${risk.level}`}>{risk.label}</span>
                  </span>
                  <span className="customer-card-facts">
                    <StageBadge stage={item.stage} compact />
                    <span className="customer-card-value">
                      <small>机会金额</small>
                      <strong>{money(item.amount)}</strong>
                    </span>
                  </span>
                  <span className={`customer-card-next${nextTask ? " has-task" : ""}`}>
                    {nextTask ? <CalendarDays size={14} /> : <MessageSquare size={14} />}
                    <span>
                      {nextTask?.title || activityPreview || "尚未安排下一步"}
                    </span>
                    {nextTask?.dueDate && <time>{nextTask.dueDate.slice(5)}</time>}
                    <ChevronRight size={14} />
                  </span>
                </button>
              );
            })}
            {customers.length === 0 && (
              <EmptyState
                action={data.customers.length ? "清除筛选后查看" : "新增第一位客户"}
                onAction={data.customers.length ? () => {
                  setSearchText("");
                  setStageFilter("全部");
                  setPriorityFilter("全部评级");
                  setRiskFilter("全部风险");
                } : onAddCustomer}
                text={data.customers.length ? "当前筛选下没有客户" : "客户池还是空的，先建立第一位客户"}
              />
            )}
          </div>
        </section>

        <section className="surface customer-detail-panel">
          {customer ? (
            <CustomerDetail
              activities={activities}
              aiInsight={aiInsight}
              aiLoading={aiLoading}
              contractFiles={data.contractFiles}
              contracts={data.contracts}
              customer={customer}
              customers={data.customers}
              onAnalyze={onAnalyze}
              onCopyPlan={onCopyPlan}
              onDelete={onDelete}
              onEdit={onEdit}
              onFieldChange={onFieldChange}
              onPlanFollowup={onPlanFollowup}
              onSavePlan={onSavePlan}
              onViewContracts={onViewContracts}
              tasks={data.tasks}
            />
          ) : (
            <EmptyState action="新增客户" onAction={onAddCustomer} text="选择客户后，这里会显示画像、推进计划和跟进动态" />
          )}
        </section>
      </div>
    </section>
  );
}

function LeadCenterView({ activities, customers, onAddCustomer, onCreateTask, onPickCustomer, onStageChange, tasks }) {
  const [activeSource, setActiveSource] = useState("全部来源");
  const [activeStatus, setActiveStatus] = useState("A类");
  const [selectedLeadId, setSelectedLeadId] = useState(customers[0]?.id || "");
  const sourceStats = sourceSummary(customers);
  const priorityStats = PRIORITIES.map((priority) => ({
    priority,
    count: customers.filter((customer) => customer.priority === priority).length,
    amount: customers
      .filter((customer) => customer.priority === priority)
      .reduce((sum, customer) => sum + Number(customer.amount || 0), 0),
  }));
  const leadItems = customers
    .map((customer) => ({
      customer,
      risk: customerRisk(customer, activities, tasks),
      score: leadScore(customer, activities, tasks),
    }))
    .sort(
      (a, b) =>
        riskRank(a.risk.level) - riskRank(b.risk.level) ||
        customerPriorityRank(a.customer.priority) - customerPriorityRank(b.customer.priority),
    );
  const filteredLeadItems = leadItems.filter(({ customer, risk }) => {
    const sourceOk = activeSource === "全部来源" || (customer.source || "未填写来源") === activeSource;
    const statusOk = `${customer.priority}类` === activeStatus;
    return sourceOk && statusOk;
  });
  const selectedLead =
    leadItems.find(({ customer }) => customer.id === selectedLeadId) ||
    filteredLeadItems[0] ||
    leadItems[0];
  const selectedCustomer = selectedLead?.customer;
  const selectedRisk = selectedLead?.risk;
  const selectedScore = selectedLead?.score || 0;
  const sourceTotal = sourceStats.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="view">
      <div className="content-grid">
        <section className="surface">
          <div className="panel-heading">
            <div>
              <h3>来源质量</h3>
              <p>点来源可以筛选线索池。</p>
            </div>
            <Target size={18} />
          </div>
          <div className="source-grid">
            <button
              className={activeSource === "全部来源" ? "source-card active" : "source-card"}
              onClick={() => setActiveSource("全部来源")}
              type="button"
            >
              <small>全部来源</small>
              <strong>{sourceTotal} 个客户</strong>
              <span>查看完整线索池</span>
            </button>
            {sourceStats.map((item) => (
              <button
                className={activeSource === item.source ? "source-card active" : "source-card"}
                key={item.source}
                onClick={() => setActiveSource(item.source)}
                type="button"
              >
                <small>{item.source}</small>
                <strong>{item.count} 个客户</strong>
                <span>{money(item.amount)} 管道金额</span>
              </button>
            ))}
          </div>
        </section>

        <section className="surface">
          <SectionHeader title="线索分层" icon={ShieldCheck} />
          <div className="lead-grade-grid">
            {priorityStats.map((item) => (
              <button
                className={activeStatus === `${item.priority}类` ? `lead-grade-card active priority-card-${item.priority.toLowerCase()}` : `lead-grade-card priority-card-${item.priority.toLowerCase()}`}
                key={item.priority}
                onClick={() => setActiveStatus(`${item.priority}类`)}
                type="button"
              >
                <span className={`priority-label priority-label-${item.priority.toLowerCase()}`}>{item.priority}类</span>
                <strong>{item.count}</strong>
                <small>{money(item.amount)} 管道金额</small>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="surface">
        <div className="panel-heading">
          <div>
            <h3>线索工作台</h3>
            <p>上方分层卡片已是筛选入口，点线索后直接处理。</p>
          </div>
        </div>
        <div className="lead-workbench">
          <div className="activation-list">
            {filteredLeadItems.map(({ customer, risk, score }) => (
              <button
                className={`activation-row priority-card-${customer.priority.toLowerCase()} risk-${risk.level}${selectedCustomer?.id === customer.id ? " active" : ""}`}
                key={customer.id}
                onClick={() => setSelectedLeadId(customer.id)}
                type="button"
              >
                <span className={`priority-label priority-label-${customer.priority.toLowerCase()}`}>{customer.priority}类</span>
                <div>
                  <strong>{customer.company}</strong>
                  <small>{risk.reason}</small>
                </div>
                <em>{score}</em>
              </button>
            ))}
            {filteredLeadItems.length === 0 && (
              <EmptyState
                action={customers.length ? "查看 A 类线索" : "新增第一条线索"}
                onAction={customers.length ? () => setActiveStatus("A类") : onAddCustomer}
                text={customers.length ? "当前分层下没有线索" : "线索池为空，新增客户后会自动进入这里"}
              />
            )}
          </div>

          <aside className="lead-detail-card">
            {selectedCustomer ? (
              <>
                <div className="lead-score">
                  <span>线索分</span>
                  <strong>{selectedScore}</strong>
                  <small>{selectedRisk.label}</small>
                </div>
                <div className="lead-detail-main">
                  <StageBadge stage={selectedCustomer.stage} />
                  <h3>{selectedCustomer.company}</h3>
                  <p>{selectedCustomer.contact || "未填联系人"} · {selectedCustomer.source || "未填写来源"}</p>
                </div>
                <div className="lead-suggestion">
                  <strong>{leadActionTitle(selectedCustomer, selectedRisk)}</strong>
                  <span>{leadActionBody(selectedCustomer, selectedRisk)}</span>
                </div>
                <div className="lead-stage-picker">
                  <label>
                    快速改阶段
                    <select onChange={(event) => onStageChange(selectedCustomer.id, event.target.value)} value={selectedCustomer.stage}>
                      {STAGES.map((stage) => (
                        <option key={stage.id}>{stage.id}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="lead-actions">
                  <button className="primary-button" onClick={() => onCreateTask(selectedCustomer.id)} type="button">
                    <Bell size={17} />
                    生成计划
                  </button>
                  <button className="secondary-button" onClick={() => onPickCustomer(selectedCustomer.id)} type="button">
                    <ArrowRight size={17} />
                    客户详情
                  </button>
                </div>
              </>
            ) : (
              <EmptyState action="新增线索" onAction={onAddCustomer} text="选择线索后，这里会给出评分、风险和建议动作" />
            )}
          </aside>
        </div>
      </section>
    </section>
  );
}
function ContractsView({
  contractFiles,
  contractForm,
  contracts,
  customers,
  onChange,
  onContractChange,
  onDelete,
  onDeleteFile,
  onMarkPaid,
  onSave,
  onUploadFiles,
}) {
  const [showContractForm, setShowContractForm] = useState(false);
  const [fileCustomerId, setFileCustomerId] = useState(customers[0]?.id || "");
  const sortedContracts = [...contracts].sort((a, b) => String(a.paymentDue || "").localeCompare(String(b.paymentDue || "")));
  const receivable = contracts.reduce(
    (sum, contract) => sum + Math.max(0, Number(contract.amount || 0) - Number(contract.paidAmount || 0)),
    0,
  );
  const overdue = contracts.filter((contract) => contract.paymentDue && contract.paymentDue < todayInputValue() && contract.status !== "已回款");
  const submitContract = (event) => {
    onSave(event);
    if (contractForm.title.trim()) setShowContractForm(false);
  };

  return (
    <section className="view">
      <div className="metrics-grid">
        <Metric title="合同数量" value={contracts.length} detail="已记录合同/报价" />
        <Metric title="应收余额" value={money(receivable)} detail="合同金额减已回款" />
        <Metric title="逾期回款" value={overdue.length} detail="需要今天处理" />
        <Metric title="合同文件" value={contractFiles.length} detail="合同、照片、凭证" />
      </div>

      <div className="content-grid contract-workspace">
        <section className="surface">
          <div className="panel-heading">
            <div>
              <h3>合同与回款清单</h3>
              <p>先看合同和回款状态，新增合同用右上角按钮打开。</p>
            </div>
            <button className="primary-button" onClick={() => setShowContractForm(true)} type="button">
              <Plus size={17} />
              新增合同
            </button>
          </div>
          <div className="contract-list">
            {sortedContracts.map((contract) => {
              const balance = Math.max(0, Number(contract.amount || 0) - Number(contract.paidAmount || 0));
              const isOverdue = contract.paymentDue && contract.paymentDue < todayInputValue() && contract.status !== "已回款";
              return (
                <article className={isOverdue ? "contract-card overdue" : "contract-card"} key={contract.id}>
                  <div>
                    <span className="contract-status">{contract.status}</span>
                    <strong>{contract.title}</strong>
                    <small>{customerName(customers, contract.customerId)} · {contract.contractNo || "未填编号"}</small>
                  </div>
                  <div className="contract-money">
                    <strong>{money(balance)}</strong>
                    <small>待回款 / {contract.paymentDue || "未设日期"}</small>
                  </div>
                  <div className="contract-inline-actions">
                    <select onChange={(event) => onContractChange(contract.id, { status: event.target.value })} value={contract.status}>
                      {CONTRACT_STATUS.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                    <button className="secondary-button" onClick={() => onMarkPaid(contract.id)} type="button">
                      <Check size={16} />
                      已回款
                    </button>
                  </div>
                  <button className="icon-button danger" onClick={() => onDelete(contract.id)} title="删除合同" type="button">
                    <Trash2 size={17} />
                  </button>
                </article>
              );
            })}
            {sortedContracts.length === 0 && (
              <div className="empty-action">
                <strong>还没有合同或回款记录</strong>
                <button className="secondary-button" onClick={() => setShowContractForm(true)} type="button">
                  <Plus size={17} />
                  新增第一条合同
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="surface contract-file-panel">
          <div className="panel-heading">
            <div>
              <h3>合同文件</h3>
              <p>支持合同、报价单、付款截图、拜访照片。本地保存，适合演示和公司材料对接。</p>
            </div>
            <select onChange={(event) => setFileCustomerId(event.target.value)} value={fileCustomerId}>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company}
                </option>
              ))}
            </select>
          </div>
          <label
            className="file-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onUploadFiles(fileCustomerId, event.dataTransfer.files);
            }}
          >
            <Upload size={28} />
            <strong>拖入合同、图片或付款凭证</strong>
            <span>也可以点击选择文件。文件会挂到当前选择的客户。</span>
            <input
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
              multiple
              onChange={(event) => {
                onUploadFiles(fileCustomerId, event.target.files);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          <div className="contract-file-list">
            {contractFiles.map((file) => (
              <article className="contract-file-row" key={file.id}>
                <div>
                  <strong>{file.name}</strong>
                  <small>
                    {customerName(customers, file.customerId)} · {formatFileSize(file.size)} · {String(file.createdAt || "").slice(0, 10)}
                  </small>
                </div>
                <div className="contract-file-actions">
                  <a className="ghost-button" download={file.name} href={file.dataUrl}>
                    下载
                  </a>
                  <button className="icon-button danger" onClick={() => onDeleteFile(file.id)} title="删除文件" type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            {contractFiles.length === 0 && <EmptyState text="还没有上传合同、图片或回款凭证" />}
          </div>
        </section>
      </div>

      {showContractForm && (
        <div className="drawer-backdrop">
          <section className="drawer">
            <div className="panel-heading">
              <h3>新增合同/回款</h3>
              <button className="icon-button" onClick={() => setShowContractForm(false)} title="关闭" type="button">
                <X size={18} />
              </button>
            </div>
            <form className="form-grid" onSubmit={submitContract}>
              <label>
                关联客户
                <select onChange={(event) => onChange({ ...contractForm, customerId: event.target.value })} value={contractForm.customerId}>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company}
                    </option>
                  ))}
                </select>
              </label>
              <TextField label="合同/报价名称" required value={contractForm.title} onChange={(title) => onChange({ ...contractForm, title })} />
              <TextField label="合同编号" value={contractForm.contractNo} onChange={(contractNo) => onChange({ ...contractForm, contractNo })} />
              <TextField label="合同金额" value={contractForm.amount} onChange={(amount) => onChange({ ...contractForm, amount })} />
              <TextField label="已回款" value={contractForm.paidAmount} onChange={(paidAmount) => onChange({ ...contractForm, paidAmount })} />
              <label>
                状态
                <select onChange={(event) => onChange({ ...contractForm, status: event.target.value })} value={contractForm.status}>
                  {CONTRACT_STATUS.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                签约日期
                <input onChange={(event) => onChange({ ...contractForm, signDate: event.target.value })} type="date" value={contractForm.signDate} />
              </label>
              <label>
                回款提醒
                <input onChange={(event) => onChange({ ...contractForm, paymentDue: event.target.value })} type="date" value={contractForm.paymentDue} />
              </label>
              <label className="wide">
                备注
                <textarea onChange={(event) => onChange({ ...contractForm, note: event.target.value })} rows="3" value={contractForm.note} />
              </label>
              <div className="form-actions">
                <button className="secondary-button" onClick={() => setShowContractForm(false)} type="button">
                  <X size={18} />
                  取消
                </button>
                <button className="primary-button" type="submit">
                  <Save size={18} />
                  保存合同
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function FollowupsView({
  activityForm,
  customers,
  followupAi,
  onAddCustomer,
  onAcceptAi,
  onChange,
  onSave,
  onSuggest,
  sortedActivities,
}) {
  return (
    <section className="view">
      {customers.length === 0 ? (
        <section className="surface followup-empty-guide">
          <EmptyState
            action="先新增客户"
            onAction={onAddCustomer}
            text="跟进记录必须关联客户。建立客户后，就能记录电话、拜访、报价反馈和下一步计划。"
          />
        </section>
      ) : (
      <div className="content-grid">
        <section className="surface">
          <div className="panel-heading">
            <h3>快速记录跟进</h3>
            <button className="ghost-button" onClick={onSuggest} type="button">
              <WandSparkles size={16} />
              AI建议
            </button>
          </div>
          <div className="template-actions">
            {FOLLOWUP_TEMPLATES.map((template) => (
              <button
                className="template-button"
                key={template.label}
                onClick={() =>
                  onChange({
                    ...activityForm,
                    method: template.method,
                    content: template.content,
                    nextStep: template.nextStep,
                  })
                }
                type="button"
              >
                <ClipboardList size={15} />
                {template.label}
              </button>
            ))}
          </div>
          <form className="form-grid single" onSubmit={onSave}>
            <label>
              关联客户
              <select
                onChange={(event) => onChange({ ...activityForm, customerId: event.target.value })}
                value={activityForm.customerId}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company}
                  </option>
                ))}
              </select>
            </label>
            <label>
              跟进方式
              <select
                onChange={(event) => onChange({ ...activityForm, method: event.target.value })}
                value={activityForm.method}
              >
                {METHODS.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
            <label>
              跟进日期
              <input
                onChange={(event) => onChange({ ...activityForm, date: event.target.value })}
                type="date"
                value={activityForm.date}
              />
            </label>
            <label className="wide">
              跟进内容
              <textarea
                onChange={(event) => onChange({ ...activityForm, content: event.target.value })}
                required
                rows="4"
                value={activityForm.content}
              />
            </label>
            {followupAi && (
              <div className="ai-box wide">
                <strong>{followupAi.summary}</strong>
                <p>{followupAi.nextStep}</p>
                <button className="secondary-button" onClick={() => onAcceptAi(followupAi)} type="button">
                  采纳为下一步
                </button>
              </div>
            )}
            <label className="wide">
              下一步动作
              <textarea
                onChange={(event) => onChange({ ...activityForm, nextStep: event.target.value })}
                rows="3"
                value={activityForm.nextStep}
              />
            </label>
            <label className="switch-row compact wide">
                <span>同步生成计划</span>
              <input
                checked={activityForm.makeTask}
                onChange={(event) => onChange({ ...activityForm, makeTask: event.target.checked })}
                type="checkbox"
              />
            </label>
            {activityForm.makeTask && (
              <>
                <label>
                  计划日期
                  <input
                    onChange={(event) => onChange({ ...activityForm, taskDueDate: event.target.value })}
                    type="date"
                    value={activityForm.taskDueDate}
                  />
                </label>
                <label>
                  计划优先级
                  <select onChange={(event) => onChange({ ...activityForm, taskPriority: event.target.value })} value={activityForm.taskPriority}>
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <Save size={18} />
                保存跟进
              </button>
            </div>
          </form>
        </section>
        <section className="surface">
          <div className="panel-heading">
            <h3>全部跟进</h3>
          </div>
          <Timeline activities={sortedActivities} customers={customers} />
        </section>
      </div>
      )}
    </section>
  );
}

function TasksView({
  customers,
  metrics,
  onChange,
  onDelay,
  onDelete,
  onPickCustomer,
  onPlanFollowup,
  onSave,
  onToggle,
  onUpdateStatus,
  setTodoFilter,
  taskForm,
  todoFilter,
  visibleTasks,
}) {
  return (
    <section className="view">
      <div className="metrics-grid">
        <Metric title="日计划" value={metrics.dayPlans.length} detail="今天执行" />
        <Metric title="周计划" value={metrics.weekPlans.length} detail="本周推进" />
        <Metric title="月计划" value={metrics.monthPlans.length} detail="客户经营" />
        <Metric title="已完成" value={metrics.doneTasks.length} detail="动作闭环" />
      </div>

      <div className="content-grid plan-layout">
        <section className="surface">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">新增计划</span>
              <h3>安排销售动作</h3>
            </div>
          </div>
          <form className="form-grid single" onSubmit={onSave}>
            <label>
              计划事项
              <input
                onChange={(event) => onChange({ ...taskForm, title: event.target.value })}
                placeholder="例如：报价复盘：填写客户名称"
                required
                value={taskForm.title}
              />
            </label>
            <label>
              关联客户
              <select
                onChange={(event) => onChange({ ...taskForm, customerId: event.target.value })}
                value={taskForm.customerId}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company}
                  </option>
                ))}
              </select>
            </label>
            <label>
              计划类型
              <select onChange={(event) => onChange({ ...taskForm, planType: event.target.value })} value={taskForm.planType}>
                {PLAN_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              状态
              <select onChange={(event) => onChange({ ...taskForm, status: event.target.value })} value={taskForm.status}>
                {PLAN_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              优先级
              <select
                onChange={(event) => onChange({ ...taskForm, priority: event.target.value })}
                value={taskForm.priority}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label>
              计划日期
              <input
                onChange={(event) => onChange({ ...taskForm, dueDate: event.target.value })}
                type="date"
                value={taskForm.dueDate}
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <Save size={18} />
                保存计划
              </button>
            </div>
          </form>
        </section>

        <section className="surface">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">计划列表</span>
              <h3>销售推进节奏</h3>
            </div>
            <div className="segmented">
              {["日计划", "周计划", "月计划", "已完成", "全部"].map((item) => (
                <button className={todoFilter === item ? "active" : ""} key={item} onClick={() => setTodoFilter(item)} type="button">
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="task-list">
            {visibleTasks.map((task) => (
              <div className={`task-row plan-row task-priority-${task.priority}${task.done ? " done" : ""}`} key={task.id}>
                <button
                  className={`check-button plan-status-${statusClass(task.status)}`}
                  onClick={() => onUpdateStatus(task.id, task.done ? "进行中" : "已完成")}
                  title={task.done ? "恢复进行中" : "标记完成"}
                  type="button"
                >
                  {task.done ? <Check size={17} /> : <Circle size={17} />}
                  <span>{task.status || (task.done ? "已完成" : "进行中")}</span>
                </button>
                <div>
                  <strong>{task.title}</strong>
                  <small>
                    {task.planType || "日计划"} · {task.priority}优先级 · {task.dueDate || "未设日期"} · {customerName(customers, task.customerId)}
                  </small>
                </div>
                <div className="task-row-actions">
                  {!task.done && (
                    <>
                      <button className="ghost-button" onClick={() => onToggle(task.id)} type="button">
                        完成
                      </button>
                      <button className="ghost-button" onClick={() => onDelay(task.id)} type="button">
                        延期
                      </button>
                    </>
                  )}
                  <button className="ghost-button" onClick={() => onPlanFollowup(task.customerId)} type="button">
                    跟进
                  </button>
                  <button className="ghost-button" onClick={() => onPickCustomer(task.customerId)} type="button">
                    客户
                  </button>
                  <button className="icon-button danger" onClick={() => onDelete(task.id)} title="删除计划" type="button">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
            {visibleTasks.length === 0 && <EmptyState text="当前没有计划" />}
          </div>
        </section>
      </div>
    </section>
  );
}

function ReviewView({
  copied,
  data,
  metrics,
  onCopy,
  onCreateTask,
  onGeneratePlan,
  onPickCustomer,
  onPlanFollowup,
  onSaveReviewAction,
  onToggleTask,
  onViewTasks,
}) {
  const review = salesReview(data, metrics);
  const [reviewDraft, setReviewDraft] = useState(loadReviewDraft);
  const [reviewCustomerId, setReviewCustomerId] = useState(data.customers[0]?.id || "");

  useEffect(() => {
    if (!reviewCustomerId && data.customers[0]?.id) setReviewCustomerId(data.customers[0].id);
  }, [data.customers, reviewCustomerId]);

  function updateReviewDraft(field, value) {
    const nextDraft = { ...reviewDraft, [field]: value };
    setReviewDraft(nextDraft);
    window.localStorage.setItem(REVIEW_DRAFT_KEY, JSON.stringify(nextDraft));
  }

  function saveReviewPlan() {
    if (!onSaveReviewAction(reviewDraft, reviewCustomerId)) return;
    const emptyDraft = emptyReviewDraft();
    setReviewDraft(emptyDraft);
    window.localStorage.removeItem(REVIEW_DRAFT_KEY);
  }

  return (
    <section className="view">
      <div className="metrics-grid">
        <Metric title="今日跟进" value={review.todayActivities.length} detail={`${review.todayCustomers.length} 个客户有动作`} />
        <Metric title="今日完成" value={review.doneToday.length} detail={`${review.openToday.length} 个日计划未完成`} />
        <Metric title="高风险客户" value={review.riskCustomers.length} detail={`${review.watchCustomers.length} 个需动作`} />
        <Metric title="预计回款" value={money(metrics.receivable)} detail="未回款金额" />
      </div>

      <section className="surface report-hero">
        <div>
          <span className="eyebrow">日报复盘</span>
          <h3>日报只引用真实数据</h3>
          <p>来源包括今日跟进、已完成日计划、未闭环动作、风险客户和合同回款，不凭空生成内容。</p>
        </div>
        <div className="report-actions">
          <button className="primary-button" onClick={() => onCopy(review.reportText)} type="button">
            <ClipboardList size={18} />
            {copied ? "已复制" : "复制日报"}
          </button>
          <button className="secondary-button" onClick={onGeneratePlan} type="button">
            <Bell size={17} />
            生成日计划
          </button>
        </div>
      </section>

      <div className="content-grid review-grid">
        <section className="surface">
          <div className="panel-heading">
            <div>
              <h3>日报内容</h3>
              <p>
                数据来源：今日跟进 {review.todayActivities.length} 条，今日完成 {review.doneToday.length} 个，未闭环 {review.openToday.length} 个，合同待回款 {money(metrics.receivable)}。
              </p>
            </div>
            <ClipboardList size={18} />
          </div>
          <pre className="report-text">{review.reportText}</pre>
        </section>

        <section className="surface">
          <SectionHeader title="风险闭环" action="查看计划" onClick={onViewTasks} />
          <div className="risk-list">
            {review.priorityCustomers.map(({ customer, risk }) => (
              <article className={`risk-item ${risk.level}`} key={customer.id}>
                <div>
                  <span>{risk.label}</span>
                  <strong>{customer.company}</strong>
                  <small>{risk.reason}</small>
                  <em>{customerDealPlan(customer, data.activities, data.tasks).nextStep}</em>
                </div>
                <div className="risk-actions">
                  <button className="ghost-button" onClick={() => onPickCustomer(customer.id)} type="button">
                    <ArrowRight size={15} />
                    客户
                  </button>
                  <button className="ghost-button" onClick={() => onPlanFollowup(customer.id)} type="button">
                    <MessageSquare size={15} />
                    跟进
                  </button>
                  <button className="ghost-button" onClick={() => onCreateTask(customer.id)} type="button">
                    <Bell size={15} />
                    计划
                  </button>
                </div>
              </article>
            ))}
            {review.priorityCustomers.length === 0 && <EmptyState text="暂无需要处理的风险客户" />}
          </div>
        </section>
      </div>

      <div className="content-grid review-grid">
        <section className="surface manual-review-card">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">手写销售复盘</span>
              <h3>把真实判断沉淀成动作</h3>
              <p>你可以手动写复盘，下一步动作可以直接生成日计划。</p>
            </div>
            <select onChange={(event) => setReviewCustomerId(event.target.value)} value={reviewCustomerId}>
              {data.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company}
                </option>
              ))}
            </select>
          </div>
          <div className="review-form">
            <label>
              本次沟通结论
              <textarea
                onChange={(event) => updateReviewDraft("conclusion", event.target.value)}
                placeholder="客户真正关心什么？本次聊清楚了什么？"
                rows="3"
                value={reviewDraft.conclusion}
              />
            </label>
            <label>
              推进阻力
              <textarea
                onChange={(event) => updateReviewDraft("blocker", event.target.value)}
                placeholder="预算、时机、竞品、决策链，哪一项卡住？"
                rows="3"
                value={reviewDraft.blocker}
              />
            </label>
            <label>
              下一步动作
              <textarea
                onChange={(event) => updateReviewDraft("nextStep", event.target.value)}
                placeholder="写成可以执行的一句话，例如：明天确认最终审批人和付款节点。"
                rows="3"
                value={reviewDraft.nextStep}
              />
            </label>
            <label>
              能力复盘
              <textarea
                onChange={(event) => updateReviewDraft("ability", event.target.value)}
                placeholder="开场、需求挖掘、价值传递、异议处理、成交推动，各扣分在哪里？"
                rows="3"
                value={reviewDraft.ability}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="secondary-button" onClick={() => onGeneratePlan()} type="button">
              <Bell size={17} />
              补全今日计划
            </button>
            <button className="primary-button" onClick={saveReviewPlan} type="button">
              <Save size={17} />
              下一步写入日计划
            </button>
          </div>
        </section>

        <section className="surface">
          <SectionHeader title="复盘提示" icon={Sparkles} />
          <div className="review-source-list">
            <article>
              <strong>日报不会乱编</strong>
              <span>如果今天没有跟进或计划完成记录，日报会提示“暂无”，不会假装有动作。</span>
            </article>
            <article>
              <strong>复盘可以变成计划</strong>
              <span>手写“下一步动作”后，可以直接写入日计划，并关联到客户。</span>
            </article>
            <article>
              <strong>风险客户会单独列出</strong>
              <span>超期、久未联系、A 类无下一步的客户，会进入风险闭环。</span>
            </article>
          </div>
        </section>
      </div>

      <div className="content-grid review-grid">
        <section className="surface">
          <SectionHeader title="今日完成" icon={Check} />
          <div className="review-list">
            {review.doneToday.map((task) => (
              <article className="review-row done" key={task.id}>
                <Check size={16} />
                <div>
                  <strong>{task.title}</strong>
                  <small>{customerName(data.customers, task.customerId)}</small>
                </div>
              </article>
            ))}
            {review.doneToday.length === 0 && <EmptyState text="今天还没有完成日计划" />}
          </div>
        </section>

        <section className="surface">
          <SectionHeader title="今天未闭环" icon={Bell} />
          <div className="review-list">
            {review.openToday.map((task) => (
              <article className={`review-row task-priority-${task.priority}`} key={task.id}>
                <Circle size={16} />
                <div>
                  <strong>{task.title}</strong>
                  <small>{task.priority}优先级 · {customerName(data.customers, task.customerId)}</small>
                </div>
                <button className="ghost-button" onClick={() => onToggleTask(task.id)} type="button">
                  完成
                </button>
              </article>
            ))}
            {review.openToday.length === 0 && <EmptyState text="日计划已清空" />}
          </div>
        </section>
      </div>
    </section>
  );
}

function SettingsView({
  backupStatus,
  data,
  onChangePassword,
  onExportBackup,
  onExportCustomersCsv,
  onExportTasksCsv,
  onImportBackup,
  onImportCustomersCsv,
  onPasswordChange,
  onProfileChange,
  onSaveProfile,
  onSaveSettings,
  passwordForm,
  profileForm,
  rememberLogin,
  setRememberLogin,
  user,
}) {
  return (
    <section className="view">
      <div className="content-grid">
        <section className="surface">
          <div className="panel-heading">
            <h3>个人中心</h3>
            <User size={18} />
          </div>
          <form className="form-grid single" onSubmit={onSaveProfile}>
            <label>
              昵称
              <input onChange={(event) => onProfileChange({ ...profileForm, name: event.target.value })} value={profileForm.name} />
            </label>
            <label>
              岗位
              <input onChange={(event) => onProfileChange({ ...profileForm, title: event.target.value })} value={profileForm.title} />
            </label>
            <label>
              联系方式
              <input onChange={(event) => onProfileChange({ ...profileForm, phone: event.target.value })} value={profileForm.phone} />
            </label>
            <Info label="当前账号" value={user.email} />
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <Save size={18} />
                保存资料
              </button>
            </div>
          </form>
        </section>

        <section className="surface">
          <div className="panel-heading">
            <h3>使用设置</h3>
            <Settings size={18} />
          </div>
          <div className="setting-list">
            <label className="switch-row">
              <span>
                <strong>记住账号和密码</strong>
                <small>下次打开自动进入，不用重复输入。</small>
              </span>
              <input checked={rememberLogin} onChange={(event) => setRememberLogin(event.target.checked)} type="checkbox" />
            </label>
            <label>
              默认计划优先级
              <select
                onChange={(event) => onSaveSettings({ defaultTaskPriority: event.target.value })}
                value={data.settings.defaultTaskPriority}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label>
              提前提醒天数
              <input
                min="0"
                onChange={(event) => onSaveSettings({ reminderDays: Number(event.target.value || 0) })}
                type="number"
                value={data.settings.reminderDays}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="content-grid">
        <section className="surface">
          <div className="panel-heading">
            <h3>修改密码</h3>
            <Lock size={18} />
          </div>
          <form className="form-grid single" onSubmit={onChangePassword}>
            <label>
              新密码
              <input
                minLength="6"
                onChange={(event) => onPasswordChange({ nextPassword: event.target.value })}
                type="password"
                value={passwordForm.nextPassword}
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                保存密码
              </button>
            </div>
          </form>
        </section>

        <section className="surface">
          <div className="panel-heading">
            <h3>数据概览</h3>
            <ShieldCheck size={18} />
          </div>
          <div className="mini-stats-grid">
            <Info label="客户" value={data.customers.length} />
            <Info label="跟进" value={data.activities.length} />
            <Info label="计划" value={data.tasks.length} />
            <Info label="合同" value={data.contracts.length} />
            <Info label="AI模式" value={data.settings.aiMode} />
          </div>
        </section>
      </div>

      <section className="surface">
        <div className="panel-heading">
          <div>
            <h3>备份与迁移</h3>
            <p>国内静态版没有云同步。换手机或换浏览器前可导出一份备份，再导入恢复。</p>
          </div>
          <ShieldCheck size={18} />
        </div>
        <div className="backup-panel">
          <article>
            <strong>导出备份</strong>
            <span>生成 JSON 文件，里面包含客户、跟进、计划和设置。</span>
            <button className="secondary-button" onClick={onExportBackup} type="button">
              <Download size={17} />
              导出数据
            </button>
          </article>
          <article>
            <strong>导出客户表</strong>
            <span>导出 CSV，适合放进 Excel 做筛选、排序和日报整理。</span>
            <button className="secondary-button" onClick={onExportCustomersCsv} type="button">
              <Download size={17} />
              客户CSV
            </button>
          </article>
          <article>
            <strong>导出计划表</strong>
            <span>导出未完成和已完成动作，方便复盘今天做了什么。</span>
            <button className="secondary-button" onClick={onExportTasksCsv} type="button">
              <Download size={17} />
              计划CSV
            </button>
          </article>
          <article>
            <strong>导入客户表</strong>
            <span>从 CSV 追加客户，适合导入展会名单、渠道表和整理好的客户清单。</span>
            <label className="secondary-button file-button">
              <Upload size={17} />
              导入客户CSV
              <input accept=".csv,text/csv" onChange={onImportCustomersCsv} type="file" />
            </label>
          </article>
          <article>
            <strong>导入备份</strong>
            <span>在新设备打开国内链接后导入，会先确认再覆盖当前浏览器数据。</span>
            <label className="secondary-button file-button">
              <Upload size={17} />
              导入数据
              <input accept="application/json,.json" onChange={onImportBackup} type="file" />
            </label>
          </article>
        </div>
        {backupStatus && <div className="backup-status">{backupStatus}</div>}
      </section>
    </section>
  );
}

function AuthScreen({ authError, authForm, authMode, onChange, onModeChange, onRememberChange, onSubmit, rememberLogin }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark">TOB</div>
          <div>
            <h1>Tob廖俊嘉</h1>
            <p>本机保存客户、跟进和计划，打开即可使用。</p>
          </div>
        </div>
        {STATIC_LOCAL_MODE && (
          <div className="local-mode-note">
            <ShieldCheck size={16} />
            <span>国内静态模式：不用 VPN，不连接国外数据库，登录和数据都保存在当前浏览器。</span>
          </div>
        )}
        <div className="auth-tabs">
          <button className={authMode === "login" ? "active" : ""} onClick={() => onModeChange("login")} type="button">
            登录
          </button>
          <button className={authMode === "register" ? "active" : ""} onClick={() => onModeChange("register")} type="button">
            注册
          </button>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          {authMode === "register" && (
            <label>
              昵称
              <input onChange={(event) => onChange({ ...authForm, name: event.target.value })} value={authForm.name} />
            </label>
          )}
          <label>
            账号 / 手机号 / 微信号
            <input
              autoComplete="username"
              onChange={(event) => onChange({ ...authForm, email: event.target.value })}
              placeholder="例如 13800138000 或 liaojunjia"
              required
              value={authForm.email}
            />
          </label>
          <label>
            密码
            <input
              autoComplete={rememberLogin ? "current-password" : "off"}
              minLength="6"
              onChange={(event) => onChange({ ...authForm, password: event.target.value })}
              placeholder="至少 6 位"
              required
              type="password"
              value={authForm.password}
            />
          </label>
          <label className="switch-row compact">
            <span>记住账号和密码</span>
            <input checked={rememberLogin} onChange={(event) => onRememberChange(event.target.checked)} type="checkbox" />
          </label>
          {authError && <div className="form-error">{authError}</div>}
          <button className="primary-button wide-button" type="submit">
            <Lock size={18} />
            {authMode === "login" ? "进入 CRM" : "创建账号"}
          </button>
        </form>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="auth-shell">
      <section className="auth-panel loading-panel">
        <div className="brand-mark">TOB</div>
        <h1>正在打开 CRM</h1>
      </section>
    </main>
  );
}

function Metric({ detail, title, value }) {
  return (
    <section className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

function SectionHeader({ action, icon: Icon, onClick, title }) {
  return (
    <div className="panel-heading">
      <h3>{title}</h3>
      {action ? (
        <button className="ghost-button" onClick={onClick} type="button">
          {action}
          <ArrowRight size={16} />
        </button>
      ) : (
        Icon && <Icon size={18} />
      )}
    </div>
  );
}

function PipelineStrip({ customers, onPick }) {
  return (
    <div className="pipeline-strip">
      {STAGES.slice(0, 6).map((stage) => {
        const stageCustomers = customers.filter((customer) => customer.stage === stage.id);
        return (
            <button
              className={`pipeline-step stage-tone-${stage.tone}`}
              key={stage.id}
              onClick={() => stageCustomers[0] && onPick(stageCustomers[0].id)}
              type="button"
            >
            <span>{stage.id}</span>
            <strong>{stageCustomers.length}</strong>
            <em>{stage.probability}%</em>
          </button>
        );
      })}
    </div>
  );
}

function InsightList({ activities, customers, tasks }) {
  const insights = customers
    .map((customer) => ({ customer, risk: customerRisk(customer, activities, tasks) }))
    .sort((a, b) => riskRank(a.risk.level) - riskRank(b.risk.level))
    .slice(0, 5);

  return (
    <div className="insight-list">
      {insights.map(({ customer, risk }) => (
        <article className={`insight-row ${risk.level}`} key={customer.id}>
          <span>{risk.label}</span>
          <div>
            <strong>{customer.company}</strong>
            <small>{risk.reason}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function CustomerDetail({
  activities,
  aiInsight,
  aiLoading,
  contractFiles,
  contracts,
  customer,
  customers,
  onAnalyze,
  onCopyPlan,
  onDelete,
  onEdit,
  onFieldChange,
  onPlanFollowup,
  onSavePlan,
  onViewContracts,
  tasks,
}) {
  const [detailTab, setDetailTab] = useState("总览");
  const risk = customerRisk(customer, activities, tasks);
  const recommendation = nextBestAction(customer, activities, tasks);
  const completeness = customerCompleteness(customer);
  const plan = customerDealPlan(customer, activities, tasks);
  const planDraftKey = `customer-plan:${customer.id}`;
  const defaultPlanDraft = () => ({
    nextStep: plan.nextStep,
    method: plan.method,
    dueDate: plan.dueDate || todayInputValue(),
    priority: plan.priority,
    status: plan.status || "进行中",
    planType: plan.planType || "不加入计划",
  });
  const [planDraft, setPlanDraft] = useState(() => loadFormDraft(planDraftKey, defaultPlanDraft()));
  const customerContracts = contracts.filter((contract) => contract.customerId === customer.id);
  const customerFiles = contractFiles.filter((file) => file.customerId === customer.id);
  const customerTasks = tasks.filter((task) => task.customerId === customer.id);

  useEffect(() => {
    setPlanDraft(loadFormDraft(planDraftKey, defaultPlanDraft()));
    setDetailTab("总览");
  }, [customer.id]);

  function updatePlanDraft(patch) {
    setPlanDraft((current) => {
      const nextDraft = { ...current, ...patch };
      saveFormDraft(planDraftKey, nextDraft);
      return nextDraft;
    });
  }

  function savePlan() {
    if (!onSavePlan(customer.id, planDraft)) return;
    clearFormDraft(planDraftKey);
  }

  const tabs = [
    { id: "总览", label: "总览" },
    { id: "跟进动态", label: `跟进动态 ${activities.length}` },
    { id: "推进计划", label: `推进计划 ${customerTasks.filter((task) => !task.done).length}` },
    { id: "文件与合同", label: `文件与合同 ${customerContracts.length + customerFiles.length}` },
  ];

  return (
    <div className="v2-customer-detail">
      <header className="v2-customer-header">
        <div>
          <div className="v2-customer-title-row">
            <h3>{customer.company}</h3>
            <span className={`priority-label priority-label-${customer.priority.toLowerCase()}`}>{customer.priority}类</span>
            <StageBadge stage={customer.stage} compact />
          </div>
          <p>{customer.contact || "未填联系人"} · {customer.industry || "未填行业"} · {customer.phone || "未填联系方式"} · 最近跟进 {activities[0]?.date || "暂无"}</p>
        </div>
        <div className="v2-customer-actions">
          <button className="secondary-button" onClick={() => onPlanFollowup(customer.id)} type="button"><MessageSquare size={16} />记录跟进</button>
          <button className="primary-button" onClick={() => setDetailTab("推进计划")} type="button"><CalendarDays size={16} />安排下一步</button>
          <button className="icon-button" onClick={() => onEdit(customer)} title="编辑客户" type="button"><Edit3 size={17} /></button>
          <button className="icon-button danger" onClick={() => onDelete(customer.id)} title="删除客户" type="button"><Trash2 size={17} /></button>
        </div>
      </header>

      <nav className="v2-detail-tabs" aria-label="客户工作区">
        {tabs.map((tab) => (
          <button className={detailTab === tab.id ? "active" : ""} key={tab.id} onClick={() => setDetailTab(tab.id)} type="button">{tab.label}</button>
        ))}
      </nav>

      {detailTab === "总览" && (
        <div className="v2-customer-overview">
          <div className="v2-customer-primary">
            <section className={`surface v2-next-action-card ${risk.level}`}>
              <span className="eyebrow">当前推进重点</span>
              <h4>{recommendation.title}</h4>
              <p>{recommendation.body}</p>
              <div className="v2-next-action-fields">
                <label>
                  下一步动作
                  <input onChange={(event) => updatePlanDraft({ nextStep: event.target.value })} value={planDraft.nextStep} />
                </label>
                <label>
                  计划日期
                  <input onChange={(event) => updatePlanDraft({ dueDate: event.target.value })} type="date" value={planDraft.dueDate} />
                </label>
                <button className="primary-button" onClick={() => { updatePlanDraft({ planType: "日计划" }); setDetailTab("推进计划"); }} type="button">完善推进计划 <ArrowRight size={15} /></button>
              </div>
            </section>

            <section className="surface v2-timeline-card">
              <div className="panel-heading"><div><h3>销售时间线</h3><p>跟进、沟通结论和下一步统一保留</p></div><button className="ghost-button" onClick={() => setDetailTab("跟进动态")} type="button">查看全部 <ArrowRight size={15} /></button></div>
              <Timeline activities={activities.slice(0, 3)} customers={customers} />
            </section>

            <div className="ai-actions v2-ai-actions">
              <button className="secondary-button" disabled={aiLoading} onClick={() => onAnalyze(customer.id)} type="button"><Brain size={17} />{aiLoading ? "分析中" : "分析客户风险"}</button>
            </div>
            {aiInsight && <AiInsight insight={aiInsight} />}
          </div>

          <aside className="surface v2-customer-info-panel">
            <section className="v2-info-block">
              <div className="v2-info-title"><strong>商机概况</strong><button onClick={() => onEdit(customer)} type="button">编辑</button></div>
              <div className="v2-info-grid">
                <Info label="预计金额" value={money(customer.amount)} />
                <Info label="加权预测" value={money(Number(customer.amount || 0) * (stageMeta(customer.stage).probability / 100))} />
                <Info label="来源" value={customer.source || "未填写"} />
                <Info label="建档日期" value={customer.recordedAt || "未记录"} />
                <Info label="核心痛点" value={customer.painPoint || "未填写"} />
                <Info label="竞品" value={customer.competitor || "未确认"} />
              </div>
            </section>

            <section className="v2-info-block">
              <div className="v2-info-title"><strong>关键联系人</strong><button onClick={() => onEdit(customer)} type="button">补充</button></div>
              <div className="v2-contact-list">
                <article><span>{String(customer.contact || "待").slice(0, 1)}</span><div><strong>{customer.contact || "主要联系人待补齐"}</strong><small>{customer.phone || "尚未填写联系方式"}</small></div><em>主要沟通人</em></article>
                <article><span>{String(customer.technicalContact || "技").slice(0, 1)}</span><div><strong>{customer.technicalContact || "技术联系人待补齐"}</strong><small>技术条件与测试材料</small></div><em>影响者</em></article>
                <article><span>{String(customer.decisionMaker || "审").slice(0, 1)}</span><div><strong>{customer.decisionMaker || "最终审批人待补齐"}</strong><small>预算、合同与最终决策</small></div><em>决策人</em></article>
              </div>
            </section>

            <section className="v2-info-block">
              <div className="v2-info-title"><strong>项目需求</strong><button onClick={() => onEdit(customer)} type="button">查看全部</button></div>
              <div className="v2-info-grid">
                <Info label="应用场景" value={customer.applicationScenario || "未填写"} />
                <Info label="服务对象" value={customer.workpiece || "未填写"} />
                <Info label="精度要求" value={customer.accuracyRequirement || "未填写"} />
                <Info label="节拍要求" value={customer.cycleRequirement || "未填写"} />
                <Info label="测试材料" value={customer.testMaterials || "未填写"} />
                <Info label="时间窗口" value={customer.projectTimeline || "未填写"} />
              </div>
            </section>

            <section className="v2-completeness-row">
              <div><span>档案完整度</span><strong>{completeness.score}%</strong></div>
              <div className="readiness-track"><span style={{ width: `${completeness.score}%` }} /></div>
              <small>{completeness.missing.length ? `待补：${completeness.missing.join("、")}` : "关键资料已完整"}</small>
            </section>
          </aside>
        </div>
      )}

      {detailTab === "跟进动态" && (
        <section className="surface v2-tab-surface">
          <div className="panel-heading"><div><h3>全部跟进动态</h3><p>每次沟通都保留结论、时间和下一步。</p></div><button className="primary-button" onClick={() => onPlanFollowup(customer.id)} type="button"><Plus size={16} />记录跟进</button></div>
          <Timeline activities={activities} customers={customers} />
        </section>
      )}

      {detailTab === "推进计划" && (
        <CustomerPlanEditor
          customer={customer}
          onCopyPlan={onCopyPlan}
          onPlanFollowup={onPlanFollowup}
          onSave={savePlan}
          planDraft={planDraft}
          updatePlanDraft={updatePlanDraft}
        />
      )}

      {detailTab === "文件与合同" && (
        <section className="surface v2-tab-surface">
          <div className="panel-heading"><div><h3>文件与合同</h3><p>合同、报价单、回款凭证和拜访照片统一归档。</p></div><button className="primary-button" onClick={onViewContracts} type="button"><FileText size={16} />进入合同管理</button></div>
          <div className="v2-file-overview">
            <article><span>合同记录</span><strong>{customerContracts.length}</strong><small>{money(customerContracts.reduce((sum, item) => sum + Number(item.amount || 0), 0))} 合同金额</small></article>
            <article><span>客户文件</span><strong>{customerFiles.length}</strong><small>合同、图片与回款凭证</small></article>
            <article><span>待回款</span><strong>{money(customerContracts.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0) - Number(item.paidAmount || 0)), 0))}</strong><small>点击进入处理回款节点</small></article>
          </div>
          <div className="contract-list">
            {customerContracts.map((contract) => (
              <article className="contract-card" key={contract.id}><div><span className="contract-status">{contract.status}</span><strong>{contract.title}</strong><small>{contract.contractNo || "未填编号"}</small></div><div className="contract-money"><strong>{money(contract.amount)}</strong><small>{contract.paymentDue || "未设回款日期"}</small></div></article>
            ))}
            {!customerContracts.length && <EmptyState action="新增合同或上传文件" onAction={onViewContracts} text="该客户还没有合同、报价单或回款记录" />}
          </div>
        </section>
      )}
    </div>
  );
}

function CustomerPlanEditor({ customer, onCopyPlan, onPlanFollowup, onSave, planDraft, updatePlanDraft }) {
  return (
    <section className="surface v2-tab-surface customer-plan-card">
      <div className="plan-head editable-plan-head">
        <div><span className="eyebrow">客户推进计划</span><h4>{customer.company} · {customer.stage}</h4></div>
        <strong>{customer.priority}类 / {customer.stage}</strong>
      </div>
      <div className="editable-plan-grid">
        <label className="wide">下一步动作<input onChange={(event) => updatePlanDraft({ nextStep: event.target.value })} value={planDraft.nextStep} /></label>
        <label>跟进方式<select onChange={(event) => updatePlanDraft({ method: event.target.value })} value={planDraft.method}>{METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label>计划日期<input onChange={(event) => updatePlanDraft({ dueDate: event.target.value })} type="date" value={planDraft.dueDate} /></label>
        <label>优先级<select onChange={(event) => updatePlanDraft({ priority: event.target.value })} value={planDraft.priority}>{TASK_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        <label>状态<select onChange={(event) => updatePlanDraft({ status: event.target.value })} value={planDraft.status}>{PLAN_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      </div>
      <div className="plan-type-picker">{["不加入计划", ...PLAN_TYPES].map((type) => <button className={planDraft.planType === type ? "active" : ""} key={type} onClick={() => updatePlanDraft({ planType: type })} type="button">{type}</button>)}</div>
      <div className="plan-actions">
        <button className="secondary-button" onClick={() => onPlanFollowup(customer.id)} type="button"><MessageSquare size={17} />记录跟进</button>
        <button className="secondary-button" onClick={() => onCopyPlan(customer.id)} type="button"><ClipboardList size={17} />复制计划</button>
        <button className="primary-button" onClick={onSave} type="button"><Save size={17} />保存计划</button>
      </div>
    </section>
  );
}

function AiInsight({ insight }) {
  if (insight.error) return <div className="ai-box danger">{insight.error}</div>;

  return (
    <div className="ai-box">
      <div className="ai-score">
        <span>{insight.level}</span>
        <strong>{insight.score}</strong>
      </div>
      <p>{insight.summary}</p>
      <ul>
        {(insight.fit || []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <strong>下一步建议</strong>
      <ul>
        {(insight.nextActions || []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {!!insight.webResults?.length && (
        <>
          <strong>联网线索</strong>
          <div className="web-result-list">
            {insight.webResults.map((item) => (
              <article key={`${item.title}-${item.snippet}`}>
                <strong>{item.title}</strong>
                <small>{item.snippet}</small>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomerForm({ customerForm, editing, onChange, onClose, onSubmit }) {
  return (
    <div className="drawer-backdrop">
      <section className="drawer customer-drawer">
        <header className="customer-drawer-header">
          <span className="customer-drawer-icon"><UserPlus size={20} /></span>
          <div>
            <span className="section-kicker">客户档案 · 销售机会</span>
            <h3>{editing ? "编辑客户" : "新增客户"}</h3>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭" type="button">
            <X size={18} />
          </button>
        </header>
        <form className="customer-form" onSubmit={onSubmit}>
          <div className="customer-form-scroll">
            <section className="customer-form-section">
              <div className="customer-form-section-title">
                <span><User size={17} /></span>
                <div>
                  <strong>基本信息</strong>
                  <small>联系人与企业资料</small>
                </div>
              </div>
              <div className="customer-form-grid">
                <TextField className="wide" label="公司名称" placeholder="请输入客户公司全称" required value={customerForm.company} onChange={(company) => onChange({ ...customerForm, company })} />
                <TextField label="联系人" placeholder="姓名或称呼" value={customerForm.contact} onChange={(contact) => onChange({ ...customerForm, contact })} />
                <TextField label="电话 / 微信" placeholder="手机号或微信号" value={customerForm.phone} onChange={(phone) => onChange({ ...customerForm, phone })} />
                <TextField label="所属行业" placeholder="如 精密制造" value={customerForm.industry} onChange={(industry) => onChange({ ...customerForm, industry })} />
                <TextField label="客户来源" placeholder="如 转介绍、展会" value={customerForm.source} onChange={(source) => onChange({ ...customerForm, source })} />
              </div>
            </section>

            <section className="customer-form-section">
              <div className="customer-form-section-title">
                <span><Target size={17} /></span>
                <div>
                  <strong>商机判断</strong>
                  <small>阶段、评级与机会金额</small>
                </div>
              </div>
              <div className="customer-form-grid">
                <label>
                  客户阶段
                  <select onChange={(event) => onChange({ ...customerForm, stage: event.target.value })} value={customerForm.stage}>
                    {STAGES.map((stage) => (
                      <option key={stage.id}>{stage.id}</option>
                    ))}
                  </select>
                </label>
                <TextField inputMode="numeric" label="机会金额" placeholder="如 480000" value={customerForm.amount} onChange={(amount) => onChange({ ...customerForm, amount })} />
                <div className="customer-priority-field wide">
                  <span>客户评级</span>
                  <div className="customer-priority-picker" role="group" aria-label="客户评级">
                    {[
                      ["A", "重点"],
                      ["B", "优先"],
                      ["C", "培育"],
                      ["D", "观察"],
                    ].map(([priority, label]) => (
                      <button
                        aria-pressed={customerForm.priority === priority}
                        className={`priority-choice priority-choice-${priority.toLowerCase()}${customerForm.priority === priority ? " active" : ""}`}
                        key={priority}
                        onClick={() => onChange({ ...customerForm, priority })}
                        type="button"
                      >
                        <strong>{priority}</strong>
                        <small>{label}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  首次记录日期
                  <input onChange={(event) => onChange({ ...customerForm, recordedAt: event.target.value })} type="date" value={customerForm.recordedAt} />
                </label>
              </div>
            </section>

            <section className="customer-form-section">
              <div className="customer-form-section-title">
                <span><Brain size={17} /></span>
                <div>
                  <strong>销售判断</strong>
                  <small>痛点、决策链与竞争情况</small>
                </div>
              </div>
              <div className="customer-form-grid">
                <label className="wide">
                  核心痛点
                  <textarea onChange={(event) => onChange({ ...customerForm, painPoint: event.target.value })} placeholder="客户最需要解决的问题" rows="3" value={customerForm.painPoint} />
                </label>
                <TextField label="决策链" placeholder="使用人、影响者、决策人" value={customerForm.decisionMaker} onChange={(decisionMaker) => onChange({ ...customerForm, decisionMaker })} />
                <TextField label="竞品 / 替代方案" placeholder="已知竞品或现有方案" value={customerForm.competitor} onChange={(competitor) => onChange({ ...customerForm, competitor })} />
                <TextField className="wide" label="客户标签" placeholder="多个标签可用逗号分隔" value={customerForm.tags} onChange={(tags) => onChange({ ...customerForm, tags })} />
                <label className="wide">
                  备注
                  <textarea onChange={(event) => onChange({ ...customerForm, note: event.target.value })} placeholder="补充客户背景或沟通注意事项" rows="3" value={customerForm.note} />
                </label>
              </div>
            </section>

            <details className="form-section-details customer-project-details">
              <summary>
                <span>
                  <strong>项目需求</strong>
                  <small>产品意向、应用场景和技术条件</small>
                </span>
                <em>按需补充</em>
              </summary>
              <div className="project-form-grid">
                <label>
                  客户类型
                  <select onChange={(event) => onChange({ ...customerForm, customerType: event.target.value })} value={customerForm.customerType}>
                    <option value="">请选择</option>
                    {CUSTOMER_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  应用场景
                  <select onChange={(event) => onChange({ ...customerForm, applicationScenario: event.target.value })} value={customerForm.applicationScenario}>
                    <option value="">请选择</option>
                    {APPLICATION_SCENARIOS.map((scenario) => <option key={scenario}>{scenario}</option>)}
                  </select>
                </label>
                <TextField className="wide" label="意向产品 / 方案" value={customerForm.productInterest} onChange={(productInterest) => onChange({ ...customerForm, productInterest })} />
                <TextField label="工件 / 服务对象" value={customerForm.workpiece} onChange={(workpiece) => onChange({ ...customerForm, workpiece })} />
                <TextField label="现有机器人 / 设备" value={customerForm.robotModel} onChange={(robotModel) => onChange({ ...customerForm, robotModel })} />
                <TextField label="精度要求" value={customerForm.accuracyRequirement} onChange={(accuracyRequirement) => onChange({ ...customerForm, accuracyRequirement })} />
                <TextField label="节拍要求" value={customerForm.cycleRequirement} onChange={(cycleRequirement) => onChange({ ...customerForm, cycleRequirement })} />
                <TextField label="现场难点" value={customerForm.siteChallenges} onChange={(siteChallenges) => onChange({ ...customerForm, siteChallenges })} />
                <TextField label="可提供测试材料" value={customerForm.testMaterials} onChange={(testMaterials) => onChange({ ...customerForm, testMaterials })} />
                <TextField label="项目时间窗口" value={customerForm.projectTimeline} onChange={(projectTimeline) => onChange({ ...customerForm, projectTimeline })} />
                <TextField label="技术联系人" value={customerForm.technicalContact} onChange={(technicalContact) => onChange({ ...customerForm, technicalContact })} />
              </div>
            </details>
          </div>
          <div className="customer-form-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              <X size={18} />
              取消
            </button>
            <button className="primary-button" type="submit">
              <Save size={18} />
              {editing ? "保存修改" : "保存客户"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProjectRequirements({ customer, onEdit }) {
  const fields = [
    customer.customerType,
    customer.productInterest,
    customer.applicationScenario,
    customer.workpiece,
    customer.robotModel,
    customer.accuracyRequirement,
    customer.cycleRequirement,
    customer.siteChallenges,
    customer.testMaterials,
    customer.projectTimeline,
    customer.technicalContact,
  ];
  const completed = fields.filter(Boolean).length;

  return (
    <details className="project-requirements-card">
      <summary>
        <span>
          <strong>项目需求</strong>
          <small>产品匹配与技术条件</small>
        </span>
        <em>{completed}/{fields.length}</em>
      </summary>
      {completed ? (
        <div className="project-requirements-content">
          <div className="detail-grid project-detail-grid">
            <Info label="客户类型" value={customer.customerType || "未填写"} />
            <Info label="意向产品/方案" value={customer.productInterest || "未填写"} />
            <Info label="应用场景" value={customer.applicationScenario || "未填写"} />
            <Info label="工件/服务对象" value={customer.workpiece || "未填写"} />
            <Info label="现有机器人/设备" value={customer.robotModel || "未填写"} />
            <Info label="精度要求" value={customer.accuracyRequirement || "未填写"} />
            <Info label="节拍要求" value={customer.cycleRequirement || "未填写"} />
            <Info label="现场难点" value={customer.siteChallenges || "未填写"} />
            <Info label="测试材料" value={customer.testMaterials || "未填写"} />
            <Info label="项目时间窗口" value={customer.projectTimeline || "未填写"} />
            <Info label="技术联系人" value={customer.technicalContact || "未填写"} />
          </div>
          <button className="secondary-button requirement-edit-button" onClick={onEdit} type="button">
            <Edit3 size={16} />
            编辑项目需求
          </button>
        </div>
      ) : (
        <div className="project-requirements-empty">
          <p>补充应用场景和技术条件，后续方案沟通会更准确。</p>
          <button className="secondary-button" onClick={onEdit} type="button">
            <Plus size={16} />
            补充项目需求
          </button>
        </div>
      )}
    </details>
  );
}

function TextField({ className = "", inputMode, label, onChange, placeholder = "", required = false, type = "text", value }) {
  return (
    <label className={className}>
      {label}
      <input
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function StageBadge({ compact = false, stage }) {
  const meta = stageMeta(stage);
  return (
    <span className={`${compact ? "stage-badge compact" : "stage-badge"} stage-tone-${meta.tone}`}>
      {stage}
      <em>{meta.probability}%</em>
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div className="info-item">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function Timeline({ activities, customers }) {
  if (!activities.length) return <EmptyState text="暂无跟进记录" />;

  return (
    <div className="timeline">
      {activities.map((activity) => (
        <article className="timeline-item" key={activity.id}>
          <div className="timeline-dot" />
          <div>
            <div className="timeline-meta">
              <strong>{customerName(customers, activity.customerId)}</strong>
              <span>{activity.date} · {activity.method}</span>
            </div>
            <p>{activity.content}</p>
            {activity.nextStep && <small>下一步：{activity.nextStep}</small>}
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyState({ action, onAction, text }) {
  return (
    <div className="empty-state">
      <span>{text}</span>
      {action && onAction && (
        <button className="secondary-button" onClick={onAction} type="button">
          {action}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function viewTitle(view) {
  return {
    dashboard: "今日工作台",
    pipeline: "销售漏斗",
    customers: "客户",
    leads: "线索池",
    followups: "跟进记录",
    tasks: "日周月计划",
    review: "销售复盘",
    contracts: "合同与回款",
    settings: "设置与个人中心",
  }[view];
}

function viewSubtitle(view) {
  return {
    dashboard: "先完成关键动作，再处理客户风险。",
    pipeline: "按阶段查看管道金额、停滞机会和成交概率。",
    customers: "从总览、时间线和推进计划经营每一位客户。",
    leads: "按来源、评级和行动建议筛选潜在客户。",
    followups: "每次沟通都留下结论和下一步动作。",
    tasks: "按日、周、月管理销售动作。",
    review: "从真实跟进和计划完成情况生成日报与复盘。",
    contracts: "记录合同金额、回款节点、合同文件和现场照片。",
    settings: "账号、密码、提醒和数据偏好都在这里。",
  }[view];
}

function priorityRank(priority) {
  return { 高: 0, 中: 1, 低: 2 }[priority] ?? 3;
}

function planTypeRank(type) {
  return { 日计划: 0, 周计划: 1, 月计划: 2 }[type] ?? 3;
}

function statusClass(status) {
  return { 进行中: "doing", 未开始: "todo", 已完成: "done", 已延期: "delay" }[status] || "doing";
}

function customerPriorityRank(priority) {
  return { A: 0, B: 1, C: 2, D: 3 }[priority] ?? 4;
}

function riskRank(level) {
  return { risk: 0, watch: 1, good: 2 }[level] ?? 3;
}

function dateStartsToday(value, today = todayInputValue()) {
  return String(value || "").startsWith(today);
}

function daysSince(date) {
  if (!date) return null;
  const today = new Date(`${todayInputValue()}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
}

function nextDateValue(date, days = 1) {
  const base = new Date(`${date || todayInputValue()}T00:00:00`);
  if (Number.isNaN(base.getTime())) return todayInputValue();
  base.setDate(base.getDate() + days);
  return new Date(base.getTime() - base.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function salesReview(data, metrics) {
  const today = todayInputValue();
  const todayActivities = data.activities.filter(
    (activity) => activity.date === today || dateStartsToday(activity.createdAt, today),
  );
  const todayCustomers = [...new Set(todayActivities.map((activity) => activity.customerId))];
  const doneToday = data.tasks.filter(
    (task) => task.planType === "日计划" && task.done && (dateStartsToday(task.completedAt, today) || (!task.completedAt && task.dueDate === today)),
  );
  const openToday = data.tasks
    .filter((task) => task.planType === "日计划" && !task.done && task.dueDate && task.dueDate <= today)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || String(a.dueDate).localeCompare(String(b.dueDate)));
  const scoredCustomers = data.customers
    .map((customer) => ({ customer, risk: customerRisk(customer, data.activities, data.tasks) }))
    .sort(
      (a, b) =>
        riskRank(a.risk.level) - riskRank(b.risk.level) ||
        customerPriorityRank(a.customer.priority) - customerPriorityRank(b.customer.priority) ||
        Number(b.customer.amount || 0) - Number(a.customer.amount || 0),
    );
  const riskCustomers = scoredCustomers.filter((item) => item.risk.level === "risk");
  const watchCustomers = scoredCustomers.filter((item) => item.risk.level === "watch");
  const priorityCustomers = [...riskCustomers, ...watchCustomers].slice(0, 6);
  const nextActions = openToday.slice(0, 5);

  const reportText = [
    `销售日报 ${today}`,
    "",
    `1. 今日跟进：${todayActivities.length} 条，覆盖 ${todayCustomers.length} 个客户。`,
    todayActivities.length
      ? todayActivities
          .slice(0, 5)
          .map((activity) => `- ${customerName(data.customers, activity.customerId)}：${activity.content}`)
          .join("\n")
      : "- 今天还没有记录跟进。",
    "",
    `2. 今日完成：${doneToday.length} 个计划动作。`,
    doneToday.length
      ? doneToday.slice(0, 5).map((task) => `- ${task.title}（${customerName(data.customers, task.customerId)}）`).join("\n")
      : "- 暂无已完成日计划。",
    "",
    `3. 风险客户：${riskCustomers.length} 个高风险，${watchCustomers.length} 个需动作。`,
    priorityCustomers.length
      ? priorityCustomers.map(({ customer, risk }) => `- ${customer.company}：${risk.reason}`).join("\n")
      : "- 暂无明显风险。",
    "",
    `4. 日计划未闭环：${nextActions.length} 个。`,
    nextActions.length
      ? nextActions.map((task) => `- ${task.title}（${task.priority}，${customerName(data.customers, task.customerId)}）`).join("\n")
      : "- 日计划已闭环，明天优先补充新线索或复盘重点客户。",
    "",
    `5. 管道：总金额 ${money(metrics.totalAmount)}，加权预测 ${money(metrics.forecast)}，待回款 ${money(metrics.receivable)}。`,
  ].join("\n");

  return { todayActivities, todayCustomers, doneToday, openToday, riskCustomers, watchCustomers, priorityCustomers, reportText };
}

function customerRisk(customer, activities, tasks) {
  const today = todayInputValue();
  const customerActivities = activities
    .filter((activity) => activity.customerId === customer.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestActivity = customerActivities[0];
  const openTasks = tasks.filter((task) => task.customerId === customer.id && !task.done);
  const overdueTask = openTasks.find((task) => task.dueDate && task.dueDate < today);
  const inactiveDays = daysSince(latestActivity?.date);

  if (overdueTask) return { level: "risk", label: "超期", reason: `计划已过期：${overdueTask.title}` };
  if (["方案报价", "谈判中"].includes(customer.stage) && inactiveDays !== null && inactiveDays >= 7) {
    return { level: "risk", label: "停滞", reason: `${customer.stage} 已 ${inactiveDays} 天没有新跟进。` };
  }
  if (!latestActivity && customer.stage !== "新线索") {
    return { level: "risk", label: "缺跟进", reason: "客户已推进，但还没有跟进记录。" };
  }
  if (customer.priority === "A" && !openTasks.length && customer.stage !== "已成交") {
    return { level: "watch", label: "需动作", reason: "A 类客户没有下一步计划。" };
  }
  if (inactiveDays !== null && inactiveDays >= 14 && customer.stage !== "已成交" && customer.stage !== "暂缓") {
    return { level: "watch", label: "久未联系", reason: `已 ${inactiveDays} 天没有新跟进。` };
  }
  if (customer.priority === "D" && customer.stage !== "已成交") {
    return { level: "watch", label: "待激活", reason: "D 类客户需要判断是否继续投入时间。" };
  }
  return { level: "good", label: "健康", reason: latestActivity ? `最近跟进：${latestActivity.date}` : "等待首次沟通。" };
}

function duplicateCustomers(customers) {
  const groups = new Map();
  customers.forEach((customer) => {
    [
      { key: normalizeDuplicateKey(customer.phone), label: `联系方式：${customer.phone}` },
      { key: normalizeDuplicateKey(customer.company), label: `公司名：${customer.company}` },
    ].forEach((item) => {
      if (!item.key) return;
      if (!groups.has(item.key)) groups.set(item.key, { key: item.key, label: item.label, items: [] });
      groups.get(item.key).items.push(customer);
    });
  });
  return [...groups.values()].filter((group) => group.items.length > 1);
}

function normalizeDuplicateKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s|-/g, "")
    .trim();
}

function sourceSummary(customers) {
  const groups = new Map();
  customers.forEach((customer) => {
    const source = customer.source || "未填写来源";
    const current = groups.get(source) || { source, count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(customer.amount || 0);
    groups.set(source, current);
  });
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

function customerCompleteness(customer = {}) {
  const fields = [
    { key: "phone", label: "联系方式" },
    { key: "amount", label: "金额" },
    { key: "source", label: "来源" },
    { key: "painPoint", label: "痛点" },
    { key: "decisionMaker", label: "决策链" },
    { key: "competitor", label: "竞品" },
  ];
  const missing = fields.filter((field) => !String(customer[field.key] || "").trim()).map((field) => field.label);
  const score = Math.round(((fields.length - missing.length) / fields.length) * 100);
  return { score, missing };
}

function leadScore(customer, activities, tasks) {
  const risk = customerRisk(customer, activities, tasks);
  let score = 45;
  score += { A: 22, B: 14, C: 8, D: 0 }[customer.priority] ?? 6;
  score += Math.round(stageMeta(customer.stage).probability * 0.18);
  if (customer.amount && Number(customer.amount) > 0) score += 8;
  if (customer.painPoint) score += 6;
  if (customer.decisionMaker) score += 6;
  if (tasks.some((task) => task.customerId === customer.id && !task.done)) score += 5;
  if (risk.level === "risk") score -= 14;
  if (risk.level === "watch") score -= 6;
  return Math.max(0, Math.min(100, score));
}

function leadActionTitle(customer, risk) {
  if (risk.level === "risk") return "先补断点";
  if (customer.priority === "D") return "判断是否值得继续";
  if (customer.stage === "新线索") return "完成首次触达";
  if (customer.stage === "方案报价") return "追报价反馈";
  if (customer.stage === "谈判中") return "锁定成交条件";
  return "推进下一步";
}

function leadActionBody(customer, risk) {
  if (risk.level === "risk") return risk.reason;
  if (customer.priority === "D") return "先确认真实需求和时间点；没有明确项目就降低投入频率。";
  if (customer.stage === "新线索") return "建议今天确认联系人、核心痛点、预算大概区间和是否有下一次沟通。";
  if (customer.stage === "方案报价") return "不要只问看了吗，直接约 15 分钟复盘范围、价格和决策流程。";
  if (customer.stage === "谈判中") return "问清楚还差什么才能签，并拆成具体计划和回款节点。";
  return "把下一步动作写成计划，避免客户停在当前阶段。";
}

function leadTaskTitle(customer, risk) {
  if (risk.level === "risk") return `补跟进：${customer.company}`;
  if (customer.stage === "新线索") return `首次触达：${customer.company}`;
  if (customer.stage === "方案报价") return `报价复盘：${customer.company}`;
  if (customer.stage === "谈判中") return `确认成交条件：${customer.company}`;
  return `推进线索下一步：${customer.company}`;
}

function nextBestAction(customer, activities, tasks) {
  const risk = customerRisk(customer, activities, tasks);
  if (risk.level === "risk") return { title: "优先补下一步", body: "先处理超期或缺失跟进，避免机会在关键阶段断档。" };
  if (customer.stage === "新线索") return { title: "完成首次触达", body: "确认联系人、需求场景和是否有明确时间点。" };
  if (customer.stage === "需求确认") return { title: "锁定痛点与预算", body: "把痛点、预算、决策人和上线时间写进备注。" };
  if (customer.stage === "方案报价") return { title: "推动报价反馈", body: "约一次 15 分钟复盘，确认价格、方案范围和决策流程。" };
  if (customer.stage === "谈判中") return { title: "明确成交条件", body: "问清楚还差什么才能签，拆成可执行计划推进。" };
  return { title: "保持节奏", body: "继续沉淀跟进记录，确保每个客户都有明确下一步。" };
}

function customerDealPlan(customer, activities, tasks) {
  const risk = customerRisk(customer, activities, tasks);
  const completeness = customerCompleteness(customer);
  const stagePlan =
    {
      新线索: {
        focus: "确认是否是真需求",
        method: "电话",
        nextStep: `首次触达 ${customer.contact || "关键联系人"}，确认场景、痛点和下一次沟通时间。`,
        questions: ["现在怎么处理这个问题？", "这个问题影响了哪些指标？", "如果要推进，谁会参与判断？"],
      },
      已联系: {
        focus: "补齐需求和关键人",
        method: "微信",
        nextStep: "补齐痛点、预算区间和决策链，把客户从已联系推进到需求确认。",
        questions: ["目前最卡的是效率、成本还是管理？", "这个事情有没有明确时间点？", "除了您，还有谁会看方案？"],
      },
      需求确认: {
        focus: "把需求变成方案范围",
        method: "视频会议",
        nextStep: "约一次需求复盘，确认方案范围、预算区间、上线节奏和评估标准。",
        questions: ["如果这个问题不解决，会带来什么损失？", "您希望先试哪个场景？", "什么结果算试点成功？"],
      },
      方案报价: {
        focus: "追回报价反馈",
        method: "电话",
        nextStep: "约 15 分钟报价复盘，确认价格、范围、审批流程和竞品对比点。",
        questions: ["报价里哪一块最需要解释？", "目前卡在预算、范围还是审批？", "如果范围确认，下一步谁拍板？"],
      },
      谈判中: {
        focus: "锁定成交条件",
        method: "电话",
        nextStep: "确认还差什么才能签，把合同、回款、试点范围拆成具体计划。",
        questions: ["现在离签约还差哪一个条件？", "付款节点能否今天确认？", "如果我补齐材料，最快什么时候定？"],
      },
      已成交: {
        focus: "维护复购和转介绍",
        method: "微信",
        nextStep: "确认交付体验和复购/转介绍机会，记录客户反馈。",
        questions: ["目前使用效果是否达到预期？", "还有哪个团队可能也需要？", "是否方便介绍一个类似客户？"],
      },
      暂缓: {
        focus: "判断是否继续投入",
        method: "微信",
        nextStep: "确认暂缓原因和重启条件，没有明确时间点则降低跟进频率。",
        questions: ["暂缓主要是预算、时间还是优先级？", "什么条件出现后会重启？", "我下次什么时候联系更合适？"],
      },
    }[customer.stage] || {
      focus: "推进下一步",
      method: "电话",
      nextStep: "确认客户当前状态和下一步动作。",
      questions: ["当前最重要的问题是什么？", "下一步谁来判断？", "什么时候适合再沟通？"],
    };
  const priority = risk.level === "risk" || customer.priority === "A" || customer.stage === "谈判中" ? "高" : customer.priority === "D" ? "低" : "中";
  const cadence = customer.priority === "A" || ["方案报价", "谈判中"].includes(customer.stage) ? "48小时内" : customer.priority === "D" ? "7天内" : "3天内";
  const missing = completeness.missing.slice(0, 4);
  const missingText = missing.length ? `\n需要补齐：${missing.join("、")}` : "";
  const riskText = risk.level === "good" ? "" : `\n风险处理：${risk.reason}`;
  const savedPlan = customer.dealPlan || {};

  return {
    ...stagePlan,
    ...savedPlan,
    priority: savedPlan.priority || priority,
    cadence,
    missing,
    followupTemplate: `推进目标：${stagePlan.focus}\n本次要确认：${stagePlan.questions.join(" / ")}${missingText}${riskText}\n客户反馈：`,
  };
}

function formatCustomerPlan(customer, plan) {
  return [
    `客户推进计划：${customer.company}`,
    `阶段：${customer.stage} / ${customer.priority}类`,
    `推进重点：${plan.focus}`,
    `建议跟进：${plan.method}，${plan.cadence}`,
    `下一步：${plan.nextStep}`,
    `资料缺口：${plan.missing.length ? plan.missing.join("、") : "关键资料已完整"}`,
    "SPIN问题：",
    ...plan.questions.map((question) => `- ${question}`),
  ].join("\n");
}

export default App;
