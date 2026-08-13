# My Workboard V10.7

图片处理修复：

- 修复 Ctrl+V 一次却插入两张相同图片。
  原因：旧 wireImageDrop paste handler + V10.6 全局 paste handler 同时执行。
- 现在所有富文本只保留一套图片粘贴逻辑。
- Kanban / Project / SOP / Memo / Templates：
  Ctrl+V 图片只插入一次，并插在当前富文本光标位置。
- 拖拽图片到编辑器或下方 Drop Zone，也只插入富文本，不另存第二份。
- 修复 Memo：
  粘贴图片不再触发 renderMemo，不会清空尚未保存的文字/子任务。
  图片直接留在“内容”富文本框中的当前位置。
- 旧版本已经存在于 m.images 的独立图片不会丢失，暂时折叠显示为“旧版本独立图片”。
