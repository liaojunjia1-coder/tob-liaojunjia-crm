# tob廖俊嘉 CRM

这是一个给 ToB 销售面试和日常跟进使用的轻量 CRM。当前功能包括客户管理、销售漏斗、跟进记录、待办提醒、个人中心、设置页和 AI 销售参谋。

## 两种运行方式

### 本机演示版

```bash
npm.cmd install
npm.cmd run dev
```

本机演示版会启动页面和本地数据服务，适合开发、调试和面试前快速预览。

### 永久在线版

永久版使用：

- Vercel：放 CRM 页面，生成长期 HTTPS 网址。
- Supabase：做账号登录和云数据库。

需要先在 Supabase 建表，然后在 Vercel 配置两个环境变量：

```bash
VITE_SUPABASE_URL=你的 Supabase 项目地址
VITE_SUPABASE_ANON_KEY=你的 Supabase 匿名公钥
```

Supabase 建表 SQL 在 `supabase/schema.sql`。

## 账号和数据

本机演示版默认账号：

- 账号：`liaojunjia@crm.local`
- 密码：`12345678`

永久版上线后，可以用手机号、微信号或自定义账号创建账号，不要求邮箱。密码至少 6 位。客户、跟进、待办、设置和个人资料都会保存到云数据库，同一个账号在手机和电脑上登录后会看到同一份数据。

## 手机安装

永久网址上线后：

1. 用 iPhone Safari 打开 CRM 网址。
2. 点分享按钮。
3. 选择“添加到主屏幕”。

以后从桌面图标打开，看起来就像一个手机 App。

## 以后更改内容

日后要改字段、改页面、改样式、加功能时，继续改这个项目即可。改完后重新发布到 Vercel，手机和电脑打开的永久网址会自动更新。
