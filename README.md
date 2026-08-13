# My Workboard

一个纯浏览器运行的个人工作台，适合公司电脑不能安装软件的场景。

## 功能

- Today：今日 Routine、进行中的 SOP、未完成工作
- Routine：每天 / 工作日 / 指定星期重复
- Routine 状态：完成、休假、不适用、未完成
- Routine 自动记录完成时间
- Routine 历史月历
- SOP 模板与执行记录分离
- SOP 每一步支持 Start / Complete / Reset
- 自动记录每一步开始时间、完成时间和耗时
- 执行日期、环境、备注可自定义
- SOP 历史执行记录
- Kanban：TODO / DOING / DONE，支持拖拽
- Memo：文字、Checkbox、URL、截图 Ctrl+V / 拖拽
- IndexedDB 自动保存
- JSON 导出 / 导入备份

## GitHub Pages 部署

1. 登录 GitHub。
2. 新建一个 Repository，例如 `my-workboard`。
3. 把本文件夹中的 4 个文件上传到 Repository 根目录：
   - `index.html`
   - `style.css`
   - `db.js`
   - `app.js`
4. 打开 Repository → Settings → Pages。
5. 在 Build and deployment 中选择：
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/ (root)`
6. 点击 Save。
7. GitHub 会生成一个网址，格式通常类似：
   `https://你的用户名.github.io/my-workboard/`

## 数据保存

数据保存在当前浏览器的 IndexedDB。

关闭网页、关闭浏览器、关机后，数据通常仍然存在。

但以下情况可能导致当前设备上的数据不可见或丢失：

- 清除浏览器网站数据
- 浏览器 Profile 被重置
- 换电脑
- 换浏览器
- 公司 IT 策略自动清理

建议定期使用 Settings → 导出 JSON 备份。

## 公司使用注意

程序代码可以公开托管，但请不要把公司内部信息直接写死在 GitHub 源代码里。

实际填写的 SOP、Memo、截图等默认只保存在浏览器 IndexedDB 中。
是否允许在公司电脑上使用该网页及保存相关信息，请遵守公司的 IT / 信息安全规则。
