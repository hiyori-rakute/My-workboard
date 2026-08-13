# My Workboard V10.8

本版只针对图片重复插入做根修复：

- 找到 V10.7 仍然重复的真实原因：
  app.js 中 V10.6 的 document paste listener 仍然存在，并且比 V10.7 listener 更早执行。
- V10.8 直接从代码中删除 V10.6 旧 listener，不再靠后续 listener 阻止它。
- 同时禁用最早期 wireImageDrop() 的 ed.onpaste 绑定。
- 最终只保留一条图片粘贴路径。
- Kanban / Memo / Project / SOP / Templates 均共用同一套。
- Ctrl+V 一张截图应只插入一张。
- Memo 不会重新 render，也不会清空未保存内容。
- 拖拽图片也统一走单一插入逻辑。

缓存版本：10.8.0
