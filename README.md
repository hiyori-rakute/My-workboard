# My Workboard V6

V6 基于 V5，重点优化日常使用体验：

- Kanban 卡片四个小按钮移到右上角。
- 子任务文字左对齐。
- DONE 卡片自动灰化，降低视觉存在感。
- 每一列可分别设置列背景色、卡片背景色。
- 定期重复新增“每年”，可设置月份 + 日期。
- Kanban 筛选不再每输入一个字符重绘页面，修复输入框失焦问题。
- DONE 卡片可归档；Kanban 顶部增加归档入口，可恢复或永久删除。
- Kanban 日历每天的格子加高，并带纵向滚动条；未完成任务排上面、完成任务排下面。
- Kanban 新增“预计开始”，设置为明天后，任务会显示在日历明天的日期里。
- 新增统一 Template Library 页面：
  - Kanban 模板
  - Routine 模板
  - SOP 模板
  - Project 模板
  - Memo 模板
- 模板库支持使用、编辑、删除。
- Routine / Project / Memo 增加“保存为模板”入口。
- 继续兼容 V1~V5 的 IndexedDB 数据。

## 更新

先导出 JSON 备份，再用本压缩包中的 5 个文件覆盖 GitHub 仓库根目录：

- index.html
- style.css
- db.js
- app.js
- README.md

Commit 后等待 GitHub Pages 部署完成，再按 Ctrl + F5。

左上角应显示：

Personal Work OS · V6
