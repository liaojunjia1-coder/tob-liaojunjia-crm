# tob廖俊嘉 CRM

这是一个给 ToB 销售面试和日常跟进使用的轻量 CRM。当前功能包括客户管理、销售漏斗、跟进记录、待办提醒、个人中心、设置页和 AI 销售参谋。

## 长期免费上线方式

当前长期免费发布方式是 GitHub Pages：

```text
https://liaojunjia1-coder.github.io/tob-liaojunjia-crm/
```

仓库里的 `.github/workflows/pages.yml` 会在 `main` 分支更新后自动构建和发布。以后改 GitHub 里的代码，GitHub Pages 会跟着重新部署，公网网址保持不变。

GitHub Pages 配置：

```bash
构建命令：npm run build:edgeone
输出目录：dist
```

这个版本不依赖国外数据库，数据会保存在当前手机或电脑浏览器里。面试演示时，用同一台设备打开就能看到已经录入的数据。

## EdgeOne 预览

EdgeOne Pages 已通过“导入 Git 仓库”验证可以自动部署，配置如下：

```bash
构建命令：npm run build:edgeone
输出目录：dist
```

但 EdgeOne 默认域名只提供 3 小时限时预览。除非以后添加自定义域名，否则不适合作为长期展示链接。

## 本机预览

```bash
npm install
npm run dev
```

本机预览会启动页面和本地数据服务，适合开发、调试和面试前快速预览。

## 账号和数据

静态版可以用手机号、微信号或自定义账号进入，密码至少 6 位。这个账号用于本机快速进入，数据保存在当前浏览器。

默认本机演示账号：

- 账号：`liaojunjia@crm.local`
- 密码：`12345678`

## 手机安装

永久网址上线后：

1. 用 iPhone Safari 打开 CRM 网址。
2. 点分享按钮。
3. 选择“添加到主屏幕”。

以后从桌面图标打开，看起来就像一个手机 App。

## 后续云同步

如果要实现手机和电脑同一账号同步，需要再接国内云数据库。推荐下一步使用腾讯云 CloudBase 或其他国内云，而不是把正式演示依赖放在 Supabase 上。

旧版 Supabase 代码仍保留在 `src/cloudCrm.js`，`supabase/schema.sql` 也保留，方便以后迁移或对比。

## 以后更改内容

日后要改字段、改页面、改样式、加功能时，继续改这个项目即可。改完并推送到 GitHub 后，GitHub Pages 永久网址会自动更新。
