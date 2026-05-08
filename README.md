# Claude.ai 中文界面 🌏

将 [Claude.ai](https://claude.ai) 的界面翻译为**简体中文**的 Chrome 扩展。

覆盖 1300+ 条 UI 文本，支持动态内容实时翻译，不影响对话内容本身。

---

## 截图

> 安装前（英文）→ 安装后（中文）

| 区域 | 说明 |
|------|------|
| 侧边栏导航 | New chat → 新建对话，Projects → 项目… |
| 设置页面 | 全面汉化，含描述文字 |
| 用量页面 | 动态百分比、倒计时实时翻译 |
| 模型选择 | 模型描述文字本地化 |

---

## 功能特性

- ✅ **1300+ 词条** —— 覆盖主界面、设置、账单、隐私、Claude Code 等所有页面
- ✅ **动态文本正则** —— `64% used` → `已用 64%`，`Resets in 3 hr 48 min` → `3 小时 48 分钟后重置`
- ✅ **三级匹配引擎** —— 精确匹配 → 模糊匹配（忽略末尾标点）→ 前缀匹配（处理嵌套链接截断）
- ✅ **React SPA 适配** —— MutationObserver 实时监听动态渲染
- ✅ **安全隔离** —— 跳过对话内容、代码块、Artifacts，只翻译 UI
- ✅ **弹窗控制面板** —— 一键开关 + 手动刷新

---

## 安装方法

### 方法一：直接加载（推荐开发者）

1. 下载本仓库（点击 **Code → Download ZIP** 或 `git clone`）
2. 解压后打开 Chrome，进入 `chrome://extensions/`
3. 开启右上角 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择解压后的文件夹
5. 访问 [claude.ai](https://claude.ai)，界面即刻变为中文 ✅

### 方法二：克隆仓库

```bash
git clone https://github.com/你的用户名/-.git
```

然后按方法一第 2 步操作。

---

## 文件结构

```
claude-translate-extension/
├── manifest.json        # Chrome 扩展配置（Manifest V3）
├── translations.js      # 翻译词典（1300+ 条静态词条 + 占位符 + aria-label）
├── content.js           # 核心翻译引擎（注入页面，三级匹配 + 动态正则）
├── popup.html           # 点击扩展图标的控制面板 UI
├── popup.js             # 控制面板逻辑（开关、刷新、词条统计）
├── icon16.png           # 扩展图标
├── icon48.png
└── icon128.png
```

---

## 工作原理

### 翻译引擎（content.js）

扩展注入页面后，通过 `MutationObserver` 监听 DOM 变化，对每个新增文本节点按以下顺序匹配：

```
1. 精确匹配      TRANSLATIONS["Send message"] → "发送消息"
       ↓ 未命中
2. 模糊匹配      去掉末尾标点后再查词典
       ↓ 未命中
3. 动态正则      /^(\d+)%\s+used$/ → "已用 N%"
       ↓ 未命中
4. 前缀匹配      处理被 <a> 链接截断的长句
```

**跳过区域**（绝对不翻译）：`.prose`、`code`、`pre`、`[data-testid="user-message"]` 等，确保对话内容和代码块不受影响。

### 词典生成方式

词典通过以下流程生成：

1. 录制 Claude.ai 的 HAR 文件（包含所有 JS bundle）
2. 用 Python 脚本从 JS bundle 中提取字符串字面量
3. 多轮过滤去除 CSS class、代码标识符、URL 等噪音
4. 运行时收集器补漏（页面注入脚本收集未命中的英文 UI 文本）
5. 人工校对 + 翻译

---

## 贡献翻译

### 发现漏翻的文字？

在 Claude.ai 页面打开 Chrome 控制台（F12），运行以下代码，收集当前页面未翻译的文本：

```javascript
const found = new Set();
document.querySelectorAll('button,a,label,span,p,h1,h2,h3,li,td,th').forEach(el => {
  el.childNodes.forEach(n => {
    if (n.nodeType === 3) {
      const t = n.textContent.trim();
      if (t && /^[A-Z]/.test(t) && t.length > 1 && t.length < 100 && /[a-z]/.test(t)) {
        found.add(t);
      }
    }
  });
});
document.querySelectorAll('[placeholder],[aria-label]').forEach(el => {
  const ph = el.getAttribute('placeholder');
  const aria = el.getAttribute('aria-label');
  if (ph && /^[A-Z]/.test(ph)) found.add(ph);
  if (aria && /^[A-Z]/.test(aria)) found.add(aria);
});
copy([...found].sort().join('\n'));
console.log(`已复制 ${found.size} 条，粘贴到 Issue 中即可`);
```

将输出结果粘贴到 [Issue](../../issues/new) 中，我们会尽快补充翻译。

### 提交 PR

1. Fork 本仓库
2. 在 `translations.js` 的 `TRANSLATIONS` 对象中添加词条：
   ```javascript
   "Your English text": "你的中文翻译",
   ```
3. 提交 Pull Request，标题格式：`feat: 补充 [页面名称] 词条`

**翻译规范：**
- 参考 VS Code、Notion 中文版的 UI 用词风格
- 专有名词保留英文：`Claude`、`Anthropic`、`Artifacts`、`MCP`、`Pro`、`Max`
- 占位符 `{variable}` 保持不变
- 键盘按键（`Cmd`、`Ctrl`、`Shift`）保留英文

---

## 已知限制

| 问题 | 原因 | 状态 |
|------|------|------|
| Claude.ai 更新后部分词条失效 | 前端代码更新可能改变文本 | 定期维护更新 |
| 极少数动态拼接文本无法翻译 | JS 运行时拼接，HAR 提取不到 | 运行时收集器补漏 |
| 不支持 Firefox | Manifest V3 差异 | 暂无计划 |

---

## 更新日志

### v1.0.0
- 初始发布
- 1300+ 条静态翻译词典
- 18 条动态正则规则（百分比、倒计时、星期、用户名等）
- 三级匹配引擎
- 弹窗控制面板

---

## 免责声明

本项目为非官方社区项目，与 Anthropic 无关。仅翻译界面文字，不收集任何用户数据，不影响 Claude.ai 的正常功能。

---

## License

[MIT](LICENSE)
