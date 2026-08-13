# My Workboard V8

V8 专门修复富文本与多级子任务：

- Memo 富文本里的 ↳＋ 可以正常添加下级子任务。
- Kanban 已存在的旧次级子任务打开后会自动补上 ✕ 删除按钮。
- 所有层级子任务都可删除；删除父任务时下级一起删除。
- Template Library 的 Kanban / Project / Memo 富文本 ☑ 按钮可正常插入子任务。
- 富文本工具栏统一改为紧凑图标：
  B / U / 红色 A / 🖍 / • / → / ← / 🔗 / ☑ / 🖼
- 字体颜色不再显示成小圆点，改为红色 A。
- Kanban / Project / SOP / Memo / Templates 中凡是使用富文本的地方共用同一套工具栏。
- 兼容 V1~V7 IndexedDB 数据。

更新前请导出备份，覆盖 GitHub 的 index.html / style.css / db.js / app.js / README.md。
部署后 Ctrl+F5，左上角应显示 Personal Work OS · V8。
