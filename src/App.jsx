import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Brain,
  Check,
  Circle,
  Download,
  Edit3,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
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

const STAGES = [
  { id: "新线索", probability: 10 },
  { id: "已联系", probability: 20 },
  { id: "需求确认", probability: 40 },
  { id: "方案报价", probability: 60 },
  { id: "谈判中", probability: 80 },
  { id: "已成交", probability: 100 },
  { id: "暂缓", probability: 0 },
];

const METHODS = ["电话", "微信", "邮件", "拜访", "视频会议"];
const PRIORITIES = ["A", "B", "C"];
const TASK_PRIORITIES = ["高", "中", "低"];

const VIEWS = [
  { id: "dashboard", label: "看板", icon: LayoutDashboard },
  { id: "pipeline", label: "漏斗", icon: TrendingUp },
  { id: "customers", label: "客户", icon: Users },
  { id: "followups", label: "跟进", icon: MessageSquare },
  { id: "tasks", label: "待办", icon: Bell },
];

const emptyCustomer = {
  company: "",
  contact: "",
  phone: "",
  industry: "",
  stage: "新线索",
  amount: "",
  priority: "B",
  source: "",
  closeDate: "",
  tags: "",
  note: "",
};

const defaultSettings = {
  reminderDays: 2,
  defaultTaskPriority: "中",
  compactCustomers: true,
  aiMode: "实用销售参谋",
};

const defaultData = {
  customers: [
    {
      id: "c-1",
      company: "深圳智造设备有限公司",
      contact: "林经理",
      phone: "138-0000-1001",
      industry: "工业自动化",
      stage: "需求确认",
      amount: "180000",
      priority: "A",
      source: "转介绍",
      closeDate: "2026-06-28",
      tags: "产线升级,售后响应",
      note: "关注产线改造和售后响应速度。",
      createdAt: "2026-06-09T09:00:00.000Z",
    },
    {
      id: "c-2",
      company: "前海云贸科技",
      contact: "周总",
      phone: "微信 zhou-sales",
      industry: "外贸 SaaS",
      stage: "方案报价",
      amount: "68000",
      priority: "B",
      source: "展会线索",
      closeDate: "2026-06-24",
      tags: "询盘分配,跟进提醒",
      note: "需要提升询盘跟进效率，月底前要看方案。",
      createdAt: "2026-06-09T09:15:00.000Z",
    },
    {
      id: "c-3",
      company: "华南精密制造",
      contact: "陈主管",
      phone: "0755-8888-2233",
      industry: "制造业",
      stage: "已联系",
      amount: "120000",
      priority: "B",
      source: "自拓",
      closeDate: "",
      tags: "巡检数字化",
      note: "先从设备巡检记录数字化切入。",
      createdAt: "2026-06-09T09:30:00.000Z",
    },
  ],
  activities: [
    {
      id: "a-1",
      customerId: "c-1",
      method: "电话",
      date: "2026-06-09",
      content: "确认目前有两条产线准备做自动化升级。",
      nextStep: "整理痛点清单，约技术同事一起沟通。",
      createdAt: "2026-06-09T10:00:00.000Z",
    },
    {
      id: "a-2",
      customerId: "c-2",
      method: "微信",
      date: "2026-06-09",
      content: "对方希望看到外贸询盘分配和跟进提醒。",
      nextStep: "明天发一页方案和报价区间。",
      createdAt: "2026-06-09T10:20:00.000Z",
    },
  ],
  tasks: [
    {
      id: "t-1",
      customerId: "c-2",
      title: "给周总发外贸 SaaS 方案",
      dueDate: "2026-06-10",
      priority: "高",
      done: false,
      createdAt: "2026-06-09T11:00:00.000Z",
    },
    {
      id: "t-2",
      customerId: "c-1",
      title: "约林经理二次需求沟通",
      dueDate: "2026-06-11",
      priority: "中",
      done: false,
      createdAt: "2026-06-09T11:10:00.000Z",
    },
  ],
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

function stageMeta(stage) {
  return STAGES.find((item) => item.id === stage) || STAGES[0];
}

function normalizeData(raw) {
  const source = raw && typeof raw === "object" ? raw : defaultData;
  return {
    customers: (source.customers || []).map((customer) => ({ ...emptyCustomer, ...customer })),
    activities: source.activities || [],
    tasks: (source.tasks || []).map((task) => ({ priority: "中", ...task })),
    settings: { ...defaultSettings, ...(source.settings || {}) },
  };
}

function loadLocalData() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return normalizeData(saved ? JSON.parse(saved) : defaultData);
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

function money(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "¥0";
  return number.toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  });
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
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true,
  );
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [stageFilter, setStageFilter] = useState("全部");
  const [todoFilter, setTodoFilter] = useState("未完成");
  const [customerForm, setCustomerForm] = useState(emptyCustomer);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [followupAi, setFollowupAi] = useState(null);
  const [activityForm, setActivityForm] = useState({
    customerId: "",
    method: "电话",
    date: todayInputValue(),
    content: "",
    nextStep: "",
  });
  const [taskForm, setTaskForm] = useState({
    customerId: "",
    title: "",
    dueDate: todayInputValue(),
    priority: defaultSettings.defaultTaskPriority,
  });

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
    }
  }, [data.customers, data.settings.defaultTaskPriority, selectedCustomerId]);

  async function loginRequest(email, password) {
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
    setSyncStatus("云端已同步");
    setAuthReady(true);
  }

  async function saveRemote(nextData) {
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
      setSyncStatus("云端已同步");
    } catch {
      setSyncStatus("云端待同步");
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
    if (CLOUD_MODE) {
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
    const nextUser = CLOUD_MODE
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
    if (CLOUD_MODE) {
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
    return data.customers.filter((customer) => {
      const matchesKeyword =
        !keyword ||
        [customer.company, customer.contact, customer.phone, customer.industry, customer.tags, customer.source]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchesStage = stageFilter === "全部" || customer.stage === stageFilter;
      return matchesKeyword && matchesStage;
    });
  }, [data.customers, searchText, stageFilter]);

  const visibleTasks = useMemo(() => {
    return data.tasks
      .filter((task) => {
        if (todoFilter === "未完成") return !task.done;
        if (todoFilter === "已完成") return task.done;
        return true;
      })
      .sort(
        (a, b) =>
          a.done - b.done ||
          priorityRank(a.priority) - priorityRank(b.priority) ||
          String(a.dueDate).localeCompare(String(b.dueDate)),
      );
  }, [data.tasks, todoFilter]);

  const metrics = useMemo(() => {
    const today = todayInputValue();
    const openTasks = data.tasks.filter((task) => !task.done);
    const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < today);
    const totalAmount = data.customers.reduce((sum, customer) => sum + Number(customer.amount || 0), 0);
    const forecast = data.customers.reduce((sum, customer) => {
      const probability = stageMeta(customer.stage).probability / 100;
      return sum + Number(customer.amount || 0) * probability;
    }, 0);
    const aCustomers = data.customers.filter((customer) => customer.priority === "A").length;
    const atRisk = data.customers.filter((customer) => customerRisk(customer, data.activities, data.tasks).level === "risk");
    return { openTasks, overdueTasks, totalAmount, forecast, aCustomers, atRisk };
  }, [data]);

  const customerActivities = useMemo(
    () => sortedActivities.filter((activity) => activity.customerId === selectedCustomer?.id),
    [sortedActivities, selectedCustomer],
  );

  function openNewCustomerForm() {
    setEditingCustomerId("");
    setCustomerForm(emptyCustomer);
    setShowCustomerForm(true);
    setActiveView("customers");
  }

  function openEditCustomerForm(customer) {
    setEditingCustomerId(customer.id);
    setCustomerForm({ ...emptyCustomer, ...customer });
    setShowCustomerForm(true);
    setActiveView("customers");
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
      tags: customerForm.tags.trim(),
      note: customerForm.note.trim(),
    };
    if (!clean.company) return;

    if (editingCustomerId) {
      commit({
        ...data,
        customers: data.customers.map((customer) =>
          customer.id === editingCustomerId ? { ...customer, ...clean } : customer,
        ),
      });
    } else {
      const nextCustomer = { id: makeId("c"), ...clean, createdAt: new Date().toISOString() };
      commit({ ...data, customers: [nextCustomer, ...data.customers] });
      setSelectedCustomerId(nextCustomer.id);
      setActivityForm((form) => ({ ...form, customerId: nextCustomer.id }));
      setTaskForm((form) => ({ ...form, customerId: nextCustomer.id }));
    }

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
    });
    setSelectedCustomerId(remainingCustomers[0]?.id || "");
    setAiInsight(null);
  }

  function updateCustomerField(customerId, field, value) {
    commit({
      ...data,
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
      const payload = CLOUD_MODE
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
    const payload = CLOUD_MODE
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
    const nextActivity = {
      id: makeId("a"),
      ...activityForm,
      content: activityForm.content.trim(),
      nextStep: activityForm.nextStep.trim(),
      createdAt: new Date().toISOString(),
    };
    commit({ ...data, activities: [nextActivity, ...data.activities] });
    setSelectedCustomerId(activityForm.customerId);
    setActivityForm((form) => ({ ...form, content: "", nextStep: "" }));
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
      done: false,
      createdAt: new Date().toISOString(),
    };
    commit({ ...data, tasks: [nextTask, ...data.tasks] });
    setTaskForm((form) => ({ ...form, title: "" }));
    go("tasks");
  }

  function toggleTask(taskId) {
    commit({
      ...data,
      tasks: data.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
    });
  }

  function deleteTask(taskId) {
    commit({ ...data, tasks: data.tasks.filter((task) => task.id !== taskId) });
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
          <div className="brand-mark">LJ</div>
          <div>
            <h1>tob廖俊嘉</h1>
            <p>个人销售中台</p>
          </div>
        </div>
        <nav className="nav-list" aria-label="主导航">
          {VIEWS.map((view) => {
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
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h2>{viewTitle(activeView)}</h2>
            <p>{viewSubtitle(activeView)}</p>
          </div>
          <div className="topbar-actions">
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
            onPickCustomer={(id) => {
              setSelectedCustomerId(id);
              go("customers");
            }}
            onViewPipeline={() => go("pipeline")}
          />
        )}

        {activeView === "pipeline" && (
          <PipelineView
            customers={data.customers}
            onPickCustomer={(id) => {
              setSelectedCustomerId(id);
              go("customers");
            }}
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
            onAnalyze={analyzeCustomer}
            onDelete={deleteCustomer}
            onEdit={openEditCustomerForm}
            onFieldChange={updateCustomerField}
            onNewFollow={() => {
              setActivityForm((form) => ({ ...form, customerId: selectedCustomer.id }));
              go("followups");
            }}
            onPickCustomer={setSelectedCustomerId}
            searchText={searchText}
            selectedCustomerId={selectedCustomer?.id}
            setSearchText={setSearchText}
            setStageFilter={setStageFilter}
            stageFilter={stageFilter}
          />
        )}

        {activeView === "followups" && (
          <FollowupsView
            activityForm={activityForm}
            customers={data.customers}
            followupAi={followupAi}
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
            onChange={setTaskForm}
            onDelete={deleteTask}
            onSave={saveTask}
            onToggle={toggleTask}
            setTodoFilter={setTodoFilter}
            taskForm={taskForm}
            todoFilter={todoFilter}
            visibleTasks={visibleTasks}
          />
        )}

        {activeView === "settings" && (
          <SettingsView
            data={data}
            onChangePassword={changePassword}
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
            onChange={setCustomerForm}
            onClose={() => setShowCustomerForm(false)}
            onSubmit={saveCustomer}
          />
        )}
      </main>
    </div>
  );
}

function DashboardView({ data, metrics, onPickCustomer, onViewPipeline }) {
  return (
    <section className="view">
      <div className="metrics-grid">
        <Metric title="客户总数" value={data.customers.length} detail={`${metrics.aCustomers} 个 A 类客户`} />
        <Metric title="销售管道" value={money(metrics.totalAmount)} detail="全部机会金额" />
        <Metric title="加权预测" value={money(metrics.forecast)} detail="按阶段概率折算" />
        <Metric title="超期待办" value={metrics.overdueTasks.length} detail={`${metrics.openTasks.length} 个未完成`} />
      </div>

      <div className="content-grid">
        <section className="surface">
          <SectionHeader title="销售漏斗" action="查看漏斗" onClick={onViewPipeline} />
          <PipelineStrip customers={data.customers} onPick={onPickCustomer} />
        </section>
        <section className="surface">
          <SectionHeader title="AI 今日建议" icon={Sparkles} />
          <InsightList customers={data.customers} activities={data.activities} tasks={data.tasks} />
        </section>
      </div>
    </section>
  );
}

function PipelineView({ customers, onPickCustomer }) {
  return (
    <section className="view">
      <div className="pipeline-board">
        {STAGES.map((stage) => {
          const stageCustomers = customers.filter((customer) => customer.stage === stage.id);
          const stageAmount = stageCustomers.reduce((sum, customer) => sum + Number(customer.amount || 0), 0);
          return (
            <section className="stage-column" key={stage.id}>
              <div className="stage-heading">
                <span>{stage.id}</span>
                <strong>{money(stageAmount)}</strong>
              </div>
              <div className="stage-list">
                {stageCustomers.map((customer) => (
                  <button className="deal-card" key={customer.id} onClick={() => onPickCustomer(customer.id)} type="button">
                    <span className={`priority-dot priority-${customer.priority.toLowerCase()}`} />
                    <strong>{customer.company}</strong>
                    <small>{customer.contact || "未填联系人"} · {money(customer.amount)}</small>
                    <em>{stage.probability}% 可能性</em>
                  </button>
                ))}
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
  onAnalyze,
  onDelete,
  onEdit,
  onFieldChange,
  onNewFollow,
  onPickCustomer,
  searchText,
  selectedCustomerId,
  setSearchText,
  setStageFilter,
  stageFilter,
}) {
  return (
    <section className="view">
      <div className="customer-layout">
        <section className="surface customer-list-panel">
          <div className="panel-heading">
            <h3>客户小卡片</h3>
          </div>
          <div className="filters">
            <label className="search-box">
              <Search size={16} />
              <input
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索公司、联系人、标签"
                value={searchText}
              />
            </label>
            <select onChange={(event) => setStageFilter(event.target.value)} value={stageFilter}>
              <option>全部</option>
              {STAGES.map((stage) => (
                <option key={stage.id}>{stage.id}</option>
              ))}
            </select>
          </div>
          <div className="customer-card-grid">
            {customers.map((item) => (
              <button
                className={selectedCustomerId === item.id ? "mini-customer-card active" : "mini-customer-card"}
                key={item.id}
                onClick={() => onPickCustomer(item.id)}
                type="button"
              >
                <span className={`priority-dot priority-${item.priority.toLowerCase()}`} />
                <strong>{item.company}</strong>
                <small>{item.contact || "未填联系人"} · {item.industry || "未填行业"}</small>
                <span className="mini-card-footer">
                  <StageBadge stage={item.stage} compact />
                  <em>{money(item.amount)}</em>
                </span>
              </button>
            ))}
            {customers.length === 0 && <EmptyState text="没有匹配的客户" />}
          </div>
        </section>

        <section className="surface customer-detail-panel">
          {customer ? (
            <CustomerDetail
              activities={activities}
              aiInsight={aiInsight}
              aiLoading={aiLoading}
              customer={customer}
              customers={data.customers}
              onAnalyze={onAnalyze}
              onDelete={onDelete}
              onEdit={onEdit}
              onFieldChange={onFieldChange}
              onNewFollow={onNewFollow}
              tasks={data.tasks}
            />
          ) : (
            <EmptyState text="先新增一个客户" />
          )}
        </section>
      </div>
    </section>
  );
}

function FollowupsView({
  activityForm,
  customers,
  followupAi,
  onAcceptAi,
  onChange,
  onSave,
  onSuggest,
  sortedActivities,
}) {
  return (
    <section className="view">
      <div className="content-grid">
        <section className="surface">
          <div className="panel-heading">
            <h3>快速记录跟进</h3>
            <button className="ghost-button" onClick={onSuggest} type="button">
              <WandSparkles size={16} />
              AI建议
            </button>
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
    </section>
  );
}

function TasksView({ customers, onChange, onDelete, onSave, onToggle, setTodoFilter, taskForm, todoFilter, visibleTasks }) {
  return (
    <section className="view">
      <div className="content-grid">
        <section className="surface">
          <div className="panel-heading">
            <h3>新增待办提醒</h3>
          </div>
          <form className="form-grid single" onSubmit={onSave}>
            <label>
              待办事项
              <input
                onChange={(event) => onChange({ ...taskForm, title: event.target.value })}
                placeholder="例如：明天发报价单"
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
              提醒日期
              <input
                onChange={(event) => onChange({ ...taskForm, dueDate: event.target.value })}
                type="date"
                value={taskForm.dueDate}
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <Save size={18} />
                保存待办
              </button>
            </div>
          </form>
        </section>

        <section className="surface">
          <div className="panel-heading">
            <h3>待办列表</h3>
            <div className="segmented">
              {["未完成", "已完成", "全部"].map((item) => (
                <button className={todoFilter === item ? "active" : ""} key={item} onClick={() => setTodoFilter(item)} type="button">
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="task-list">
            {visibleTasks.map((task) => (
              <div className={task.done ? "task-row done" : "task-row"} key={task.id}>
                <button className="check-button" onClick={() => onToggle(task.id)} title={task.done ? "标记未完成" : "标记完成"} type="button">
                  {task.done ? <Check size={17} /> : <Circle size={17} />}
                </button>
                <div>
                  <strong>{task.title}</strong>
                  <small>
                    {task.priority}优先级 · {task.dueDate} · {customerName(customers, task.customerId)}
                  </small>
                </div>
                <button className="icon-button danger" onClick={() => onDelete(task.id)} title="删除待办" type="button">
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            {visibleTasks.length === 0 && <EmptyState text="当前没有待办" />}
          </div>
        </section>
      </div>
    </section>
  );
}

function SettingsView({
  data,
  onChangePassword,
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
              默认待办优先级
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
            <Info label="待办" value={data.tasks.length} />
            <Info label="AI模式" value={data.settings.aiMode} />
          </div>
        </section>
      </div>
    </section>
  );
}

function AuthScreen({ authError, authForm, authMode, onChange, onModeChange, onRememberChange, onSubmit, rememberLogin }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark">LJ</div>
          <div>
            <h1>tob廖俊嘉</h1>
            <p>登录后，手机和电脑使用同一份客户数据。</p>
          </div>
        </div>
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
        <div className="brand-mark">LJ</div>
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
          <button className="pipeline-step" key={stage.id} onClick={() => stageCustomers[0] && onPick(stageCustomers[0].id)} type="button">
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
  customer,
  customers,
  onAnalyze,
  onDelete,
  onEdit,
  onFieldChange,
  onNewFollow,
  tasks,
}) {
  const risk = customerRisk(customer, activities, tasks);
  const recommendation = nextBestAction(customer, activities, tasks);

  return (
    <>
      <div className="detail-header">
        <div>
          <StageBadge stage={customer.stage} />
          <h3>{customer.company}</h3>
          <p>{customer.contact || "未填联系人"} · {customer.industry || "未填行业"}</p>
        </div>
        <div className="detail-actions">
          <button className="icon-button" onClick={() => onEdit(customer)} title="编辑客户" type="button">
            <Edit3 size={18} />
          </button>
          <button className="icon-button danger" onClick={() => onDelete(customer.id)} title="删除客户" type="button">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="quick-controls">
        <label>
          阶段
          <select onChange={(event) => onFieldChange(customer.id, "stage", event.target.value)} value={customer.stage}>
            {STAGES.map((stage) => (
              <option key={stage.id}>{stage.id}</option>
            ))}
          </select>
        </label>
        <label>
          评级
          <select onChange={(event) => onFieldChange(customer.id, "priority", event.target.value)} value={customer.priority}>
            {PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="detail-grid">
        <Info label="预计金额" value={money(customer.amount)} />
        <Info label="成交预测" value={money(Number(customer.amount || 0) * (stageMeta(customer.stage).probability / 100))} />
        <Info label="来源" value={customer.source || "未填写"} />
        <Info label="预计成交" value={customer.closeDate || "未设置"} />
      </div>

      <div className={`advice-box ${risk.level}`}>
        <Sparkles size={18} />
        <div>
          <strong>{recommendation.title}</strong>
          <p>{recommendation.body}</p>
        </div>
      </div>

      <div className="ai-actions">
        <button className="secondary-button" disabled={aiLoading} onClick={() => onAnalyze(customer.id)} type="button">
          <Brain size={18} />
          {aiLoading ? "分析中" : "AI分析客户"}
        </button>
        <button className="ghost-button" onClick={onNewFollow} type="button">
          <Plus size={16} />
          记录跟进
        </button>
      </div>

      {aiInsight && <AiInsight insight={aiInsight} />}

      <div className="note-box">
        <strong>标签</strong>
        <p>{customer.tags || "暂无标签"}</p>
        <strong>备注</strong>
        <p>{customer.note || "暂无备注"}</p>
      </div>

      <div className="section-title">
        <h4>跟进记录</h4>
      </div>
      <Timeline activities={activities} customers={customers} />
    </>
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
      <section className="drawer">
        <div className="panel-heading">
          <h3>{editing ? "编辑客户" : "新增客户"}</h3>
          <button className="icon-button" onClick={onClose} title="关闭" type="button">
            <X size={18} />
          </button>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <TextField label="公司名" required value={customerForm.company} onChange={(company) => onChange({ ...customerForm, company })} />
          <TextField label="联系人" value={customerForm.contact} onChange={(contact) => onChange({ ...customerForm, contact })} />
          <TextField label="电话/微信" value={customerForm.phone} onChange={(phone) => onChange({ ...customerForm, phone })} />
          <TextField label="行业" value={customerForm.industry} onChange={(industry) => onChange({ ...customerForm, industry })} />
          <label>
            客户阶段
            <select onChange={(event) => onChange({ ...customerForm, stage: event.target.value })} value={customerForm.stage}>
              {STAGES.map((stage) => (
                <option key={stage.id}>{stage.id}</option>
              ))}
            </select>
          </label>
          <label>
            客户评级
            <select onChange={(event) => onChange({ ...customerForm, priority: event.target.value })} value={customerForm.priority}>
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <TextField label="预计金额" value={customerForm.amount} onChange={(amount) => onChange({ ...customerForm, amount })} />
          <TextField label="来源" value={customerForm.source} onChange={(source) => onChange({ ...customerForm, source })} />
          <label>
            预计成交日期
            <input onChange={(event) => onChange({ ...customerForm, closeDate: event.target.value })} type="date" value={customerForm.closeDate} />
          </label>
          <TextField label="标签" value={customerForm.tags} onChange={(tags) => onChange({ ...customerForm, tags })} />
          <label className="wide">
            备注
            <textarea onChange={(event) => onChange({ ...customerForm, note: event.target.value })} rows="3" value={customerForm.note} />
          </label>
          <div className="form-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              <X size={18} />
              取消
            </button>
            <button className="primary-button" type="submit">
              <Save size={18} />
              保存
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TextField({ label, onChange, required = false, value }) {
  return (
    <label>
      {label}
      <input onChange={(event) => onChange(event.target.value)} required={required} value={value} />
    </label>
  );
}

function StageBadge({ compact = false, stage }) {
  const meta = stageMeta(stage);
  return (
    <span className={compact ? "stage-badge compact" : "stage-badge"}>
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

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function viewTitle(view) {
  return {
    dashboard: "销售驾驶舱",
    pipeline: "机会漏斗",
    customers: "客户资产",
    followups: "跟进记录",
    tasks: "待办提醒",
    settings: "设置与个人中心",
  }[view];
}

function viewSubtitle(view) {
  return {
    dashboard: "每天先看重点、风险和下一步。",
    pipeline: "按阶段管理机会，估算成交概率。",
    customers: "客户用小卡片快速浏览，点开看完整详情。",
    followups: "每次沟通都留下下一步，AI 帮你补动作。",
    tasks: "把销售动作变成可执行提醒。",
    settings: "账号、密码、提醒和数据偏好都在这里。",
  }[view];
}

function priorityRank(priority) {
  return { 高: 0, 中: 1, 低: 2 }[priority] ?? 3;
}

function riskRank(level) {
  return { risk: 0, watch: 1, good: 2 }[level] ?? 3;
}

function customerRisk(customer, activities, tasks) {
  const today = todayInputValue();
  const customerActivities = activities
    .filter((activity) => activity.customerId === customer.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestActivity = customerActivities[0];
  const openTasks = tasks.filter((task) => task.customerId === customer.id && !task.done);
  const overdueTask = openTasks.find((task) => task.dueDate && task.dueDate < today);

  if (overdueTask) return { level: "risk", label: "超期", reason: `待办已过期：${overdueTask.title}` };
  if (!latestActivity && customer.stage !== "新线索") {
    return { level: "risk", label: "缺跟进", reason: "客户已推进，但还没有跟进记录。" };
  }
  if (customer.priority === "A" && !openTasks.length && customer.stage !== "已成交") {
    return { level: "watch", label: "需动作", reason: "A 类客户没有下一步待办。" };
  }
  if (customer.closeDate && customer.closeDate < today && customer.stage !== "已成交") {
    return { level: "watch", label: "需复盘", reason: "预计成交日期已过，需要更新判断。" };
  }
  return { level: "good", label: "健康", reason: latestActivity ? `最近跟进：${latestActivity.date}` : "等待首次沟通。" };
}

function nextBestAction(customer, activities, tasks) {
  const risk = customerRisk(customer, activities, tasks);
  if (risk.level === "risk") return { title: "优先补下一步", body: "先处理超期或缺失跟进，避免机会在关键阶段断档。" };
  if (customer.stage === "新线索") return { title: "完成首次触达", body: "确认联系人、需求场景和是否有明确时间点。" };
  if (customer.stage === "需求确认") return { title: "锁定痛点与预算", body: "把痛点、预算、决策人和上线时间写进备注。" };
  if (customer.stage === "方案报价") return { title: "推动报价反馈", body: "约一次 15 分钟复盘，确认价格、方案范围和决策流程。" };
  if (customer.stage === "谈判中") return { title: "明确成交条件", body: "问清楚还差什么才能签，拆成可执行待办推进。" };
  return { title: "保持节奏", body: "继续沉淀跟进记录，确保每个客户都有明确下一步。" };
}

export default App;
