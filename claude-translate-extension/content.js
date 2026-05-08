// Claude.ai 中文界面 - 核心翻译逻辑
(function () {
  'use strict';

  // ===== 跳过翻译的区域（聊天内容、代码块等）=====
  // 这些选择器匹配 Claude 回复正文和用户输入，绝对不翻译
  const SKIP_SELECTORS = [
    '.prose',
    '[data-testid="user-message"]',
    'code',
    'pre',
    '.artifact-content',
    '[class*="message-content"]',
    '[class*="human-turn"]',
    '[class*="assistant-turn"]',
    '.cm-content',           // CodeMirror 编辑器
    '.cm-line',
    '[class*="code-block"]',
    'canvas',
    'svg',
    'iframe',
  ];

  // ===== 已翻译节点缓存（避免重复处理）=====
  const translated = new WeakSet();

  // ===== 翻译单个文本节点 =====
  function translateTextNode(node) {
    if (translated.has(node)) return;
    const raw = node.textContent;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2) return;

    if (TRANSLATIONS[trimmed]) {
      node.textContent = raw.replace(trimmed, TRANSLATIONS[trimmed]);
      translated.add(node);
    }
  }

  // ===== 翻译元素的属性 =====
  function translateAttributes(el) {
    // placeholder
    const ph = el.getAttribute('placeholder');
    if (ph && PLACEHOLDER_TRANSLATIONS[ph.trim()]) {
      el.setAttribute('placeholder', PLACEHOLDER_TRANSLATIONS[ph.trim()]);
    }
    // aria-label
    const aria = el.getAttribute('aria-label');
    if (aria && ARIA_TRANSLATIONS[aria.trim()]) {
      el.setAttribute('aria-label', ARIA_TRANSLATIONS[aria.trim()]);
    }
    // title
    const title = el.getAttribute('title');
    if (title && TRANSLATIONS[title.trim()]) {
      el.setAttribute('title', TRANSLATIONS[title.trim()]);
    }
    // value (仅 button/submit)
    if ((el.tagName === 'INPUT') && (el.type === 'button' || el.type === 'submit')) {
      const val = el.value;
      if (val && TRANSLATIONS[val.trim()]) {
        el.value = TRANSLATIONS[val.trim()];
      }
    }
  }

  // ===== 判断节点是否在跳过区域内 =====
  function shouldSkip(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el) {
      if (el.matches && el.matches(SKIP_SELECTORS.join(','))) return true;
      el = el.parentElement;
    }
    return false;
  }

  // ===== 遍历并翻译一个 DOM 子树 =====
  function walkAndTranslate(root) {
    if (!root || !root.nodeType) return;

    // 如果根节点本身需要跳过
    if (root.nodeType === 1 && shouldSkip(root)) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (node.nodeType === 1) {
            // 跳过区域整棵子树
            if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
            // 元素节点处理属性，不作为叶节点访问
            return NodeFilter.FILTER_SKIP;
          }
          // 跳过空文本
          if (!node.textContent.trim()) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    // 先处理根元素属性
    if (root.nodeType === 1) translateAttributes(root);

    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) {
        translateTextNode(node);
      } else if (node.nodeType === 1) {
        translateAttributes(node);
      }
    }
  }

  // ===== 首次全量翻译 =====
  function translateAll() {
    walkAndTranslate(document.body);
  }

  // ===== MutationObserver 监听动态变化 =====
  let timer = null;
  const pendingNodes = new Set();

  function scheduleBatch() {
    if (timer) return;
    timer = requestAnimationFrame(() => {
      timer = null;
      for (const node of pendingNodes) {
        walkAndTranslate(node);
      }
      pendingNodes.clear();
    });
  }

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      // 新增节点
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 || node.nodeType === 3) {
          pendingNodes.add(node.nodeType === 3 ? node.parentElement || node : node);
        }
      }
      // 文本变化
      if (m.type === 'characterData') {
        pendingNodes.add(m.target.parentElement || m.target);
      }
      // 属性变化
      if (m.type === 'attributes' && m.target.nodeType === 1) {
        translateAttributes(m.target);
      }
    }
    if (pendingNodes.size > 0) scheduleBatch();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'aria-label', 'title', 'value'],
  });

  // ===== 启动 =====
  translateAll();
  // 延迟再翻译一次，捕获懒加载内容
  setTimeout(translateAll, 800);
  setTimeout(translateAll, 2000);

  console.log('[Claude 中文界面] 已启动，翻译词条数：', Object.keys(TRANSLATIONS).length);
})();


// ===== 接收 Popup 消息 =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TOGGLE') {
    if (msg.enabled) {
      translateAll();
      observer.observe(document.body, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'value'],
      });
    } else {
      observer.disconnect();
    }
  }
  if (msg.type === 'REFRESH') {
    translateAll();
  }
  if (msg.type === 'GET_STATS') {
    sendResponse({ count: Object.keys(TRANSLATIONS).length });
  }
  return true;
});
