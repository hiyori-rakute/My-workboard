# My Workboard V7

V7 修复和新增：

- 修复 V6 Memo 页面空白 bug。
- Kanban 子任务增加删除按钮；删除父任务时会一起删除其下级。
- Kanban 列设置增加删除列：
  - 空列直接删除；
  - 有卡片时先选择把卡片移动到哪一列。
- Kanban 每张卡片可以单独设置背景颜色，不受整列默认颜色限制。
- DONE 卡片仍强制灰化。
- Routine 管理增加删除按钮。
- Project 本身继续保留删除；Project 分类也可以删除，分类内项目自动转到“未分类”。
- SOP 模板卡增加删除按钮。
- Memo 修复后支持正常新建/编辑/删除，Checkbox 也有删除按钮。
- Today 的 Kanban 改为按列分组：
  - 定期作业
  - TODO
  - DOING
  - WAITING
  - ...
  点击组名展开/收起对应卡片。
- 继续兼容 V1~V6 IndexedDB 数据。

更新前请先导出 JSON 备份，然后覆盖 GitHub 根目录 5 个文件并 Commit。
部署完成后 Ctrl+F5，左上角应显示 Personal Work OS · V7。
