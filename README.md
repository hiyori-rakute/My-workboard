# My Workboard V4

这版修正 V3 的核心问题：

- Kanban 不再保留独立的“结构化子任务”编辑区。
- 子任务直接通过 Memo 富文本工具栏的“☑ Checkbox”插入到文字任意位置。
- 每个内嵌子任务自带 Start、预计完成时间、完成勾选，并记录实际开始/完成时间。
- 图片继续直接插入富文本光标位置，可和文字、链接、子任务混排。
- 主 Kanban 页面直接读取这些内嵌子任务，可 Start / 完成。
- 全部子任务完成后，主任务自动记录完成时间并移动到 DONE。
- 旧 V2/V3 的独立子任务打开卡片时会自动合并进 Memo，不丢数据。
- Project 的子任务也改为直接插入项目 Memo 中，并可在左侧 Project 页面快速 Start / 完成。
- Project 的交接、汇报、问题、调查记录继续使用同一套富文本编辑器，可插图片、链接、高亮、Checkbox。
- Today 保留 Kanban 模块。
- index.html / db.js 本次明确升级；资源 URL 加 ?v=4.0.0，避免 GitHub Pages/浏览器缓存旧 JS/CSS。

更新：覆盖仓库根目录全部 5 个文件后 Commit，然后等待 Pages 部署完成，按 Ctrl+F5。
