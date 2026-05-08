// Claude.ai 中文界面 - 核心翻译逻辑 v3（支持动态文本正则）
(function () {
  'use strict';

  const SKIP_SELECTORS = [
    '.prose',
    '[data-testid="user-message"]',
    'code', 'pre',
    '[class*="message-content"]',
    '[class*="human-turn"]',
    '[class*="assistant-turn"]',
    '.cm-content', '.cm-line',
    '[class*="code-block"]',
    'canvas', 'svg', 'iframe',
  ];

  // ===== 动态文本正则规则 =====
  // [正则, 替换函数或字符串]
  const DYNAMIC_RULES = [
    // "64% used" → "已用 64%"
    [/^(\d+)%\s+used$/, (_, n) => `已用 ${n}%`],

    // "Resets in X hr Y min" → "X 小时 Y 分钟后重置"
    [/^Resets in (\d+) hr (\d+) min$/, (_, h, m) => `${h} 小时 ${m} 分钟后重置`],
    [/^Resets in (\d+) hr$/, (_, h) => `${h} 小时后重置`],
    [/^Resets in (\d+) min$/, (_, m) => `${m} 分钟后重置`],
    [/^Resets in (\d+) hr (\d+) min (\d+) sec$/, (_, h, m, s) => `${h} 小时 ${m} 分 ${s} 秒后重置`],

    // "Resets Mon 11:00 AM" → "周一 11:00 重置"
    [/^Resets (Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d+:\d+) (AM|PM)$/, (_, day, time, ampm) => {
      const days = { Mon:'周一', Tue:'周二', Wed:'周三', Thu:'周四', Fri:'周五', Sat:'周六', Sun:'周日' };
      let [h, m] = time.split(':').map(Number);
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return `${days[day]} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} 重置`;
    }],

    // "Last updated: X minutes ago" → "X 分钟前更新"
    [/^Last updated: (\d+) minutes? ago$/, (_, n) => `${n} 分钟前更新`],
    [/^Last updated: (\d+) hours? ago$/, (_, n) => `${n} 小时前更新`],
    [/^Last updated: less than a minute ago$/, () => '刚刚更新'],
    [/^Last updated: just now$/, () => '刚刚更新'],
    [/^Last updated: (\d+) minute ago$/, (_, n) => `${n} 分钟前更新`],

    // "Connected X days ago"
    [/^Connected (\d+) days? ago$/, (_, n) => `${n} 天前连接`],
    [/^Connected (\d+) hours? ago$/, (_, n) => `${n} 小时前连接`],

    // "X / Y" 用量进度（纯数字不翻译，保持原样）

    // "Happy [Day], [Name]" → 保留名字
    [/^Happy (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (.+)$/, (_, day, name) => {
      const days = { Monday:'周一', Tuesday:'周二', Wednesday:'周三', Thursday:'周四', Friday:'周五', Saturday:'周六', Sunday:'周日' };
      return `${days[day]}好，${name}`;
    }],
    [/^Good (morning|afternoon|evening), (.+)$/, (_, period, name) => {
      const p = { morning:'早上好', afternoon:'下午好', evening:'晚上好' };
      return `${p[period]}，${name}`;
    }],

    // "More options for [项目名]"（含中文项目名，跳过）
    [/^More options for (.+)$/, (_, name) => `${name} 的更多选项`],

    // "Project, [名称]"
    [/^Project, (.+)$/, (_, name) => `项目：${name}`],

    // "Model: [model name]"
    [/^Model: (.+)$/, (_, model) => `模型：${model}`],
  ];

  const translated = new WeakSet();
  const TRANSLATION_KEYS = Object.keys(TRANSLATIONS);

  function exactMatch(text) {
    return TRANSLATIONS[text] || null;
  }

  function fuzzyMatch(text) {
    const stripped = text.replace(/[.。\s]+$/, '').trim();
    return TRANSLATIONS[stripped] || null;
  }

  function dynamicMatch(text) {
    for (const [re, fn] of DYNAMIC_RULES) {
      const m = text.match(re);
      if (m) return typeof fn === 'function' ? fn(...m) : fn;
    }
    return null;
  }

  function prefixMatch(text) {
    const t = text.trim();
    if (t.length < 10) return null;
    for (const key of TRANSLATION_KEYS) {
      if (key.startsWith(t) && key.length > t.length) {
        const ratio = t.length / key.length;
        const translation = TRANSLATIONS[key];
        let idx = Math.floor(translation.length * ratio);
        while (idx < translation.length && !/[\s，。！？、]/.test(translation[idx])) idx++;
        return translation.slice(0, idx);
      }
    }
    return null;
  }

  function translateTextNode(node) {
    if (translated.has(node)) return;
    const raw = node.textContent;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2) return;

    const result = exactMatch(trimmed)
      || fuzzyMatch(trimmed)
      || dynamicMatch(trimmed)
      || prefixMatch(trimmed);

    if (result) {
      node.textContent = raw.replace(trimmed, result);
      translated.add(node);
    }
  }

  function translateAttributes(el) {
    const ph = el.getAttribute('placeholder');
    if (ph) {
      const t = PLACEHOLDER_TRANSLATIONS[ph.trim()];
      if (t) el.setAttribute('placeholder', t);
    }
    const aria = el.getAttribute('aria-label');
    if (aria) {
      const t = ARIA_TRANSLATIONS[aria.trim()]
        || exactMatch(aria.trim())
        || dynamicMatch(aria.trim());
      if (t) el.setAttribute('aria-label', t);
    }
    const title = el.getAttribute('title');
    if (title) {
      const t = exactMatch(title.trim()) || fuzzyMatch(title.trim());
      if (t) el.setAttribute('title', t);
    }
  }

  function shouldSkip(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el) {
      if (el.matches && el.matches(SKIP_SELECTORS.join(','))) return true;
      el = el.parentElement;
    }
    return false;
  }

  function walkAndTranslate(root) {
    if (!root || !root.nodeType) return;
    if (root.nodeType === 1 && shouldSkip(root)) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (node.nodeType === 1) {
            if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_SKIP;
          }
          if (!node.textContent.trim()) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    if (root.nodeType === 1) translateAttributes(root);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateTextNode(node);
      else if (node.nodeType === 1) translateAttributes(node);
    }
  }

  function translateAll() { walkAndTranslate(document.body); }

  let timer = null;
  const pendingNodes = new Set();
  function scheduleBatch() {
    if (timer) return;
    timer = requestAnimationFrame(() => {
      timer = null;
      for (const node of pendingNodes) walkAndTranslate(node);
      pendingNodes.clear();
    });
  }

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 || node.nodeType === 3)
          pendingNodes.add(node.nodeType === 3 ? (node.parentElement || node) : node);
      }
      if (m.type === 'characterData') pendingNodes.add(m.target.parentElement || m.target);
      if (m.type === 'attributes' && m.target.nodeType === 1) translateAttributes(m.target);
    }
    if (pendingNodes.size > 0) scheduleBatch();
  });

  observer.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'aria-label', 'title', 'value'],
  });

  translateAll();
  setTimeout(translateAll, 800);
  setTimeout(translateAll, 2500);

  console.log('[Claude 中文界面] v3 已启动，词条：', Object.keys(TRANSLATIONS).length, '条 + 动态规则');

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
    if (msg.type === 'REFRESH') translateAll();
    if (msg.type === 'GET_STATS') sendResponse({ count: Object.keys(TRANSLATIONS).length });
    return true;
  });
})();
