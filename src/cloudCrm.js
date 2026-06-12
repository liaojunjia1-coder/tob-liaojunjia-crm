import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const CLOUD_MODE = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = CLOUD_MODE
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;

const AUTH_EMAIL_DOMAIN = "users.tobcrm.app";

function normalizeAccount(account) {
  return String(account || "").trim().replace(/\s+/g, " ");
}

function accountToAuthEmail(account) {
  const cleanAccount = normalizeAccount(account);
  if (cleanAccount.includes("@")) return cleanAccount.toLowerCase();

  const bytes = new TextEncoder().encode(cleanAccount.toLowerCase());
  const encoded = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `u-${encoded}@${AUTH_EMAIL_DOMAIN}`;
}

function displayAccount(authUser) {
  const account = normalizeAccount(authUser.user_metadata?.account);
  if (account) return account;

  const email = authUser.email || "";
  if (email.endsWith(`@${AUTH_EMAIL_DOMAIN}`)) return "未命名账号";
  return email;
}

function message(error, fallback) {
  if (!error) return fallback;
  const text = String(error.message || error).toLowerCase();
  if (text.includes("invalid login credentials")) return "账号或密码不正确，请检查后再试。";
  if (text.includes("email not confirmed")) return "账号已创建，但云端还要求邮箱确认。请先关闭邮箱确认后再登录。";
  if (text.includes("unable to validate email address")) return "账号格式暂时不支持，请换一个手机号、微信号或简单账号。";
  if (text.includes("already registered") || text.includes("already exists") || text.includes("user already")) {
    return "这个账号已经注册过，请直接登录。";
  }
  if (text.includes("password") && (text.includes("six") || text.includes("6") || text.includes("minimum") || text.includes("least"))) {
    return "密码至少需要 6 位。";
  }
  if (text.includes("rate limit") || text.includes("too many")) return "尝试太频繁了，请稍等一会儿再试。";
  if (text.includes("failed to fetch") || text.includes("network")) return "网络连接失败，请检查网络后重试。";
  if (text.includes("database")) return fallback || "云数据库暂时没有成功保存，请稍后再试。";
  return fallback || "操作失败，请稍后再试。";
}

function publicUser(authUser, row) {
  const account = displayAccount(authUser);
  return {
    id: authUser.id,
    email: account,
    account,
    name: row?.name || authUser.user_metadata?.name || "tob廖俊嘉",
    title: row?.title || "ToB 销售",
    phone: row?.phone || "",
  };
}

async function ensureWorkspace(authUser, defaultData) {
  const { data: existing, error: selectError } = await supabase
    .from("crm_workspaces")
    .select("name,title,phone,data")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (selectError) throw new Error(message(selectError, "读取云数据库失败。"));

  if (existing) {
    return {
      user: publicUser(authUser, existing),
      data: existing.data || defaultData,
    };
  }

  const nextRow = {
    user_id: authUser.id,
    name: authUser.user_metadata?.name || "tob廖俊嘉",
    title: "ToB 销售",
    phone: "",
    data: defaultData,
  };

  const { data: created, error: insertError } = await supabase
    .from("crm_workspaces")
    .insert(nextRow)
    .select("name,title,phone,data")
    .single();

  if (insertError) throw new Error(message(insertError, "创建云数据库失败。"));

  return {
    user: publicUser(authUser, created),
    data: created.data || defaultData,
  };
}

export async function restoreCloudSession(defaultData) {
  if (!CLOUD_MODE) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(message(error, "恢复登录失败。"));
  if (!data.session?.user) return null;

  const workspace = await ensureWorkspace(data.session.user, defaultData);
  return {
    ...workspace,
    token: data.session.access_token,
  };
}

export async function cloudLogin(email, password, defaultData) {
  const account = normalizeAccount(email);
  if (!account) throw new Error("请先填写账号。");
  if (!password) throw new Error("请先填写密码。");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: accountToAuthEmail(account),
    password,
  });
  if (error) throw new Error(message(error, "登录失败，请稍后再试。"));

  const workspace = await ensureWorkspace(data.user, defaultData);
  return {
    ...workspace,
    token: data.session.access_token,
  };
}

export async function cloudRegister(authForm, defaultData) {
  const account = normalizeAccount(authForm.email);
  if (!account) throw new Error("请先填写账号。");
  if (!authForm.password || authForm.password.length < 6) throw new Error("密码至少需要 6 位。");

  const { data, error } = await supabase.auth.signUp({
    email: accountToAuthEmail(account),
    password: authForm.password,
    options: {
      data: {
        account,
        name: authForm.name || "tob廖俊嘉",
      },
    },
  });

  if (error) throw new Error(message(error, "创建账号失败，请稍后再试。"));
  if (!data.session?.user) {
    throw new Error("账号已创建，但云端还要求邮箱确认。请先关闭邮箱确认后再登录。");
  }

  const workspace = await ensureWorkspace(data.session.user, defaultData);
  return {
    ...workspace,
    token: data.session.access_token,
  };
}

export async function saveCloudData(nextData) {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error("请先登录。");

  const { error } = await supabase
    .from("crm_workspaces")
    .update({ data: nextData, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) throw new Error(message(error, "同步云数据库失败。"));
}

export async function saveCloudProfile(profileForm) {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error("请先登录。");

  const nextProfile = {
    name: profileForm.name || "tob廖俊嘉",
    title: profileForm.title || "ToB 销售",
    phone: profileForm.phone || "",
    updated_at: new Date().toISOString(),
  };

  const { data: row, error } = await supabase
    .from("crm_workspaces")
    .update(nextProfile)
    .eq("user_id", user.id)
    .select("name,title,phone,data")
    .single();

  if (error) throw new Error(message(error, "保存个人资料失败。"));
  return publicUser(user, row);
}

export async function changeCloudPassword(nextPassword) {
  const { error } = await supabase.auth.updateUser({ password: nextPassword });
  if (error) throw new Error(message(error, "修改密码失败。"));
}

export async function cloudLogout() {
  if (!CLOUD_MODE) return;
  await supabase.auth.signOut();
}
