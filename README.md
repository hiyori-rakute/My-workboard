# My Workboard V10

V10 修复 / 优化：

- 修复富文本次级子任务 ✕ 删除按钮点击无反应：
  使用全局 capture 事件处理，避免 contenteditable 吃掉按钮点击。
- Routine 每个任务可以自定义图标：
  - Mail Check 可用 ✉
  - JP1 Check 可用 ★
  - IDMC Check 可用 ♥
- Today / Routine 日历不再使用大小黑点。
- Routine 日历直接在日期数字旁显示每个 Routine 自己的图标：
  - 绿色图标 = 未完成
  - 灰色图标 = 完成 / 休假 / N/A
- Today 页面布局调整：
  - 长期任务 + 标签检索并排
  - 左侧：今日 Routine 在上、Kanban 在下
  - 右侧：Routine + Kanban 共用日历，纵向跨越两个模块
- Routine 的 完成 / 休假 / N/A / 未完成 改为紧凑图标按钮。
- Today 标签检索修复输入框失焦问题，不再每输入一个字就重绘页面。
- Routine 页面也加入右侧日历，纵向跨 Daily Routine + Routine 管理。
- Routine 页面去掉原来右侧那块单独的格式化日期显示。
- 保留 V9 的：菜单拖拽、SOP 二级菜单、Project 预计开始、富文本子任务排序等。

更新前先导出 JSON 备份，再覆盖 GitHub 5 个文件。
部署后 Ctrl+F5，左上角应显示 Personal Work OS · V10。
