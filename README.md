# My Workboard V10.2

核心修复：
- 修复 Kanban 新建卡片保存后显示 0/0 子任务的问题。
- 原因是新版富文本子任务 DOM 已变化，但旧读取器仍在读取 `.inline-task-head > .inline-task-text`。
- V10.2 同时兼容新旧结构，并正确递归读取次级子任务。
- 卡片主页面直接显示所有子任务与次级子任务。
- 对 V10/V10.1 已保存、checks 为空但 Memo HTML 中仍有子任务的卡片，会从 HTML 自动恢复显示，不需要重新创建。
