# My Workboard V9

V9 主要更新：

- Kanban / Project / SOP / Memo / Templates 富文本中的所有层级子任务支持 ↑ / ↓ 调整顺序。
- Routine 普通子任务也支持 ↑ / ↓ 调整顺序。
- Project 增加“预计开始”，适合先记录、以后再正式启动的工作。
- Project 搜索框修复：输入时不再整页重绘，不会每输入一个字符就失焦。
- 左侧主菜单支持拖拽调整顺序，并保存在 IndexedDB。
- Execution History 收进 SOP 二级菜单；点 SOP 左侧三角展开/收起。
- Today 页面重新布局：
  1. 长期任务放在 Routine 上方。
  2. 增加 Routine + Kanban 共用日历。
  3. Routine 在当天日期旁显示状态圆点：
     - 绿色：当天仍有 Routine 未完成
     - 灰色：当天 Routine 已全部完成 / 休假 / N/A
  4. Kanban 任务继续显示在日期格内。
- 兼容 V1~V8 IndexedDB 数据。

更新前先导出备份，然后覆盖 GitHub 根目录的 5 个文件。
部署后 Ctrl+F5，左上角应显示 Personal Work OS · V9。
