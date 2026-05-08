// popup.js
const enableToggle = document.getElementById('enableToggle');
const statusBadge = document.getElementById('statusBadge');
const refreshBtn = document.getElementById('refreshBtn');
const dictCount = document.getElementById('dictCount');

// 读取当前状态
chrome.storage.local.get(['enabled'], (result) => {
  const enabled = result.enabled !== false; // 默认开启
  enableToggle.checked = enabled;
  updateStatus(enabled);
});

// 切换开关
enableToggle.addEventListener('change', () => {
  const enabled = enableToggle.checked;
  chrome.storage.local.set({ enabled });
  updateStatus(enabled);

  // 通知当前 tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE', enabled }).catch(() => {});
    }
  });
});

// 刷新按钮
refreshBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'REFRESH' }).catch(() => {});
      refreshBtn.textContent = '✅ 已刷新';
      setTimeout(() => { refreshBtn.textContent = '🔄 刷新翻译'; }, 1500);
    }
  });
});

// 获取词条数
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATS' }, (resp) => {
      if (resp && resp.count) {
        dictCount.textContent = resp.count.toLocaleString();
      }
    });
  }
});

function updateStatus(enabled) {
  if (enabled) {
    statusBadge.className = 'status on';
    statusBadge.innerHTML = '<span class="dot"></span>翻译中';
  } else {
    statusBadge.className = 'status off';
    statusBadge.innerHTML = '<span class="dot"></span>已暂停';
  }
}
