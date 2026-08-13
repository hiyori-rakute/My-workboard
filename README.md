# My Workboard V2

V2 在 V1 基础上增加：

- Kanban 默认 TODO / DOING / WAITING / DONE
- 可自定义新增 Kanban 列
- Kanban 卡片使用右侧抽屉打开
- Kanban 卡片支持富文本、粗体、下划线、字体颜色、列表、缩进/回缩、链接
- Kanban 卡片支持 checkbox/子任务、截图、标签
- Memo 支持富文本、checkbox/子任务、图片、标签
- Routine 支持子任务分别打卡并记录完成时间
- 新增 Projects 长期任务管理
- Projects 支持一级分类
- 主任务开始/结束日期时间
- 子任务开始/结束日期时间
- 交接/对接人员、汇报记录、被提出的问题、需要调查的地方
- Projects 支持截图、富文本、标签
- Projects 详情从右侧打开，不覆盖整个页面
- 旧 V1 数据会自动迁移并保留

## 更新 GitHub Pages

1. 建议先在旧版本右上角导出一次备份。
2. 打开 GitHub 的 `My-workboard` Repository。
3. 进入 Code 页面。
4. 用本 ZIP 中的以下文件覆盖原文件：
   - index.html
   - style.css
   - db.js
   - app.js
5. Commit changes。
6. 等待 GitHub Pages 自动重新部署。
7. 刷新原来的 Workboard 网址即可。

如果浏览器缓存了旧版，可按 Ctrl + F5 强制刷新。
