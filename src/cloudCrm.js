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

function message(error, fallback) {
  if (!error) return fallback;
  if (error.message?.includes("Invalid login credentials")) return "账号或密码不正确。";
  if (error.message?.includes("Email not confirmed")) return "邮箱还没有确认，请先完成邮箱确认。";
  return error.message || fallback;
}

function publicUser(authUser, row) {
  return {
    id: authUser.id,
    email: authUser.email,
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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(message(error, "登录失败。"));

  const workspace = await ensureWorkspace(data.user, defaultData);
  return {
    ...workspace,
    token: data.session.access_token,
  };
}

export async function cloudRegister(authForm, defaultData) {
  const { data, error } = await supabase.auth.signUp({
    email: authForm.email,
    password: authForm.password,
    options: {
      data: { name: authForm.name || "tob廖俊嘉" },
    },
  });

  if (error) throw new Error(message(error, "创建账号失败。"));
  if (!data.session?.user) {
    throw new Error("账号已创建，请先完成邮箱确认后再登录。");
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
