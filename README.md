# My Workboard V5

V5 基于 V4 增强：

- Kanban 子任务支持继续添加下级子任务（可多级嵌套）。
- Kanban 卡片主页面按钮缩成图标：Start / Memo / 模板 / 定期重复。
- Kanban 可设置每天、每周、每月自动生成任务；例如每月 1 日生成到“定期作业”列。
- Kanban 列可以左右移动，自定义显示顺序。
- Kanban 新增月历，可查看过去任务/完成记录。
- Today 的 Kanban 区右侧加入小月历。
- Routine 新增共享标签。
- Today 新增统一标签检索，可跨 Routine / Projects / Kanban / Memo 查找。
- Today 顶部 3 个 KPI 卡片可直接跳转对应页面。
- Today 的长期任务改为显示最近项目（包括刚完成项目），修复“Projects 有项目但 Today 看不到”的体验问题。
- Project 子任务同样支持多级嵌套，并在主页面快速 Start / 完成。
- SOP 每个步骤改成完整富文本，可插图片、Link、高亮、Checkbox；执行记录中的每一步也使用富文本。
- index.html / db.js 明确升级到 V5，并使用 ?v=5.0.0 避免浏览器缓存旧资源。

更新前请先导出 JSON 备份。覆盖 GitHub 仓库根目录 5 个文件后 Commit，等待 Pages 部署，再 Ctrl+F5。
