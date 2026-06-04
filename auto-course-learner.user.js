// ==UserScript==
// @name         网校自动刷课助手
// @namespace    https://wsyu.wnssedu.com
// @version      1.4
// @description  一键刷课、自动跳过弹窗、自动下一节
// @author       Claude
// @match        https://wsyu.wnssedu.com/student/prese/studytasklist.htm*
// @match        https://wsyu.wnssedu.com/course/newcourse/info/intro.htm*
// @match        https://wsyu.wnssedu.com/course/newcourse/watch.htm*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function () {
  'use strict';

  const MONITOR_INTERVAL = 3000;
  const url = new URL(location.href);
  const path = url.pathname;

  // 开关持久化
  function loadToggles() {
    const defaults = { autoPlay: true, autoSkip: true, autoBack: true, autoLeak: false };
    try {
      const saved = JSON.parse(GM_getValue('toggles', '{}'));
      return Object.assign({}, defaults, saved);
    } catch (_) { return defaults; }
  }

  function saveToggles(t) {
    GM_setValue('toggles', JSON.stringify(t));
  }

  let toggles = loadToggles();

  // ═══════════════════════════════════════════════════
  //  悬浮面板
  // ═══════════════════════════════════════════════════

  function createFloatingPanel() {
    if (document.getElementById('autoStudyPanel')) return;

    const courseUrls = GM_getValue('courseUrls', '');
    const isTaskList = path.includes('studytasklist.htm');
    const isWatch = path.includes('watch.htm');

    const panel = document.createElement('div');
    panel.id = 'autoStudyPanel';
    panel.innerHTML = `
      <div class="as-header" id="asHeader">
        <span class="as-title">刷课助手</span>
        <span class="as-toggle" id="asToggle">−</span>
      </div>
      <div class="as-body" id="asBody">
        <label class="as-label">课程链接（一行一个）</label>
        <textarea id="asCourseUrls" class="as-textarea"
                  placeholder="https://wsyu.wnssedu.com/course/newcourse/info/intro.htm?courseId=...">${escapeHtml(courseUrls)}</textarea>
        <div class="as-btn-row">
          ${isTaskList ? '<button id="asAutoBtn" class="as-btn as-btn-orange">一键刷课</button>' : '<button id="asOpenAllBtn" class="as-btn as-btn-green">全部打开</button>'}
        </div>
        <div class="as-toggles" id="asToggles">
          <label class="as-switch"><span>自动下一节</span><input type="checkbox" id="tgBack"${toggles.autoBack?' checked':''}><i></i></label>
          <label class="as-switch"><span>自动播放</span><input type="checkbox" id="tgPlay"${toggles.autoPlay?' checked':''}><i></i></label>
          <label class="as-switch"><span>自动跳过弹窗</span><input type="checkbox" id="tgSkip"${toggles.autoSkip?' checked':''}><i></i></label>
          <label class="as-switch"><span>查漏模式</span><input type="checkbox" id="tgLeak"${toggles.autoLeak?' checked':''}><i></i></label>
        </div>
        <div id="asStatus" class="as-status"></div>
      </div>
    `;
    document.body.appendChild(panel);

    GM_addStyle(`
      #autoStudyPanel {
        position: fixed; top: 120px; right: 20px; z-index: 2147483640;
        width: 320px; background: #1e1e2e; border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.4); font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, 'Microsoft YaHei', sans-serif;
        color: #cdd6f4; overflow: hidden;
      }
      .as-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 14px; background: #313244; cursor: move;
        user-select: none; font-weight: 600;
      }
      .as-title { color: #89b4fa; }
      .as-toggle { cursor: pointer; font-size: 18px; color: #a6adc8; }
      .as-toggle:hover { color: #cdd6f4; }
      .as-body { padding: 14px; }
      .as-body.collapsed { display: none; }
      .as-label { display: block; margin: 8px 0 4px; font-size: 11px; color: #a6adc8; }
      .as-textarea {
        width: 100%; box-sizing: border-box; padding: 7px 10px;
        background: #313244; border: 1px solid #45475a; border-radius: 6px;
        color: #cdd6f4; font-size: 11px; outline: none; resize: vertical;
        min-height: 80px; font-family: monospace; line-height: 1.5;
      }
      .as-textarea:focus { border-color: #89b4fa; }
      .as-btn {
        display: block; width: 100%; margin-top: 12px; padding: 8px;
        color: #1e1e2e; border: none; border-radius: 6px;
        cursor: pointer; font-size: 13px; font-weight: 600;
      }
      .as-btn-row { display: flex; gap: 8px; margin-top: 8px; }
      .as-btn-row .as-btn { flex: 1; margin-top: 0; }
      .as-btn-orange { background: #fe640b; }
      .as-btn-orange:hover { background: #ff7b2e; }
      .as-btn-green { background: #40a02b; }
      .as-btn-green:hover { background: #54c23b; }
      .as-toggles { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
      .as-switch {
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 10px; background: #313244; border-radius: 6px;
        cursor: pointer; font-size: 12px; user-select: none;
      }
      .as-switch span { color: #cdd6f4; }
      .as-switch input { display: none; }
      .as-switch i {
        display: block; width: 36px; height: 20px; border-radius: 10px;
        background: #45475a; position: relative; transition: background .2s;
      }
      .as-switch i::after {
        content: ''; display: block; width: 16px; height: 16px; border-radius: 50%;
        background: #a6adc8; position: absolute; top: 2px; left: 2px;
        transition: transform .2s;
      }
      .as-switch input:checked + i { background: #40a02b; }
      .as-switch input:checked + i::after { transform: translateX(16px); background: #fff; }
      .as-status { margin-top: 10px; font-size: 12px; min-height: 18px; color: #a6adc8; }
      .as-status.ok { color: #a6e3a1; }
      .as-status.warn { color: #f9e2af; }
      .as-status.err { color: #f38ba8; }
    `);

    // 拖拽
    const header = document.getElementById('asHeader');
    let dX, dY, sX, sY;
    header.addEventListener('mousedown', e => {
      if (e.target.id === 'asToggle') return;
      sX = e.clientX; sY = e.clientY;
      dX = panel.offsetLeft; dY = panel.offsetTop;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
    });
    function onDrag(e) {
      panel.style.left = (dX + e.clientX - sX) + 'px';
      panel.style.top  = (dY + e.clientY - sY) + 'px';
      panel.style.right = 'auto';
    }
    function onDragEnd() {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
    }

    // 折叠
    document.getElementById('asToggle').addEventListener('click', () => {
      const body = document.getElementById('asBody');
      const tog  = document.getElementById('asToggle');
      body.classList.toggle('collapsed');
      tog.textContent = body.classList.contains('collapsed') ? '+' : '−';
    });

    // 开关事件
    function bindToggle(id, key) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        toggles[key] = el.checked;
        saveToggles(toggles);
        setStatus((el.checked ? '✓ ' : '✗ ') + el.parentElement.querySelector('span').textContent, el.checked ? 'ok' : '');
        setTimeout(() => { if (document.getElementById('asStatus')) setStatus('', ''); }, 1500);
      });
    }
    bindToggle('tgBack', 'autoBack');
    bindToggle('tgPlay', 'autoPlay');
    bindToggle('tgSkip', 'autoSkip');
    bindToggle('tgLeak', 'autoLeak');

    // 打开课程
    function openCourses(lines) {
      if (!lines.length) {
        setStatus('没有有效的课程链接', 'err');
        return;
      }
      setStatus('正在打开 ' + lines.length + ' 门课程...', 'warn');
      lines.forEach((line, i) => {
        setTimeout(() => { window.open(line.trim(), '_blank'); }, i * 300);
      });
      setTimeout(() => {
        setStatus('已打开 ' + lines.length + ' 门课程', 'ok');
      }, lines.length * 300 + 500);
    }

    // 一键刷课（任务列表页：收集 + 打开）
    const autoBtn = document.getElementById('asAutoBtn');
    if (autoBtn) {
      autoBtn.addEventListener('click', () => {
        const ids = [];
        document.querySelectorAll('#courseList tr').forEach(row => {
          const span = row.querySelector('td:nth-child(2) span');
          if (!span) return;
          const m = span.innerText.match(/^(\d+(?:\.\d+)?)%/);
          if (m && parseFloat(m[1]) >= 100) return;
          const nameSpan = row.querySelector('td:first-child span');
          if (!nameSpan) return;
          const oc = nameSpan.getAttribute('onclick') || '';
          const im = oc.match(/"lId":"(\d+)"/);
          if (im) ids.push(im[1]);
        });
        if (!ids.length) { setStatus('没有未完成课程', 'ok'); return; }
        const base = location.origin;
        const lines = ids.map(id => base + '/course/newcourse/info/intro.htm?courseId=' + id);
        const textarea = document.getElementById('asCourseUrls');
        textarea.value = lines.join('\n');
        GM_setValue('courseUrls', textarea.value);
        openCourses(lines);
      });
    }

    // 全部打开（非任务列表页：从文本框读取）
    const openAllBtn = document.getElementById('asOpenAllBtn');
    if (openAllBtn) {
      openAllBtn.addEventListener('click', () => {
        const textarea = document.getElementById('asCourseUrls');
        const raw = textarea.value.trim();
        GM_setValue('courseUrls', raw);
        if (!raw) { setStatus('请先填入课程链接', 'err'); return; }
        const lines = raw.split(/[\n\r]+/).filter(line => line.trim());
        openCourses(lines);
      });
    }
  }

  function setStatus(msg, cls) {
    const el = document.getElementById('asStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'as-status ' + (cls || '');
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ═══════════════════════════════════════════════════
  //  播放页 — 弹窗与状态检测
  // ═══════════════════════════════════════════════════

  function getModalInfo() {
    const modal = document.querySelector('.pv-ask-modal-wrap');
    if (!modal || !modal.offsetParent) return null;
    return { visible: true };
  }

  function skipModal() {
    const btn = document.querySelector('button.pv-ask-skip');
    if (btn?.offsetParent) btn.click();
  }

  function resumePlay() {
    const btn = document.querySelector('button.pv-playpause');
    if (btn?.offsetParent) btn.click();
    const v = document.querySelector('video');
    if (v && v.paused) { try { v.play(); } catch(_) {} }
  }

  function cdpClickSelf() {
    const myUrl = location.href;
    GM_xmlhttpRequest({
      method: 'GET',
      url: 'http://localhost:3456/targets',
      timeout: 5000,
      onload: res => {
        try {
          const tabs = JSON.parse(res.responseText);
          const me = tabs.find(t => t.url === myUrl);
          if (me) {
            GM_xmlhttpRequest({
              method: 'POST',
              url: 'http://localhost:3456/clickAt?target=' + me.targetId,
              data: 'button.pv-playpause',
              timeout: 5000,
            });
          }
        } catch(_) {}
      },
    });
  }

  function goBack() {
    const back = document.querySelector('.course_back_section');
    if (back?.offsetParent) { back.click(); return true; }
    return false;
  }

  function getVideoState() {
    const v = document.querySelector('video');
    if (!v) return 'no-video';
    if (v.ended) return 'ended';
    if (v.paused) return 'paused';
    return 'playing';
  }

  let busy = false;

  function processModal(callback) {
    if (busy || !toggles.autoSkip) return;
    if (!getModalInfo()) return;
    busy = true;
    setStatus('跳过弹窗', 'warn');
    skipModal();
    setTimeout(() => { if (toggles.autoPlay) resumePlay(); busy = false; if (callback) callback(); }, 800);
  }

  // ═══════════════════════════════════════════════════
  //  播放页 — 监控主循环
  // ═══════════════════════════════════════════════════

  let watchTimer = null;
  let videoEnded = false;

  function startWatchMonitor() {
    createFloatingPanel();

    if (watchTimer) clearInterval(watchTimer);

    let stuckSince = 0;

    const check = () => {
      if (busy) return;

      if (toggles.autoSkip) {
        const modal = getModalInfo();
        if (modal) { processModal(check); return; }
      }

      const v = document.querySelector('video');
      if (v && v.readyState === 0 && v.currentTime === 0) {
        if (!stuckSince) stuckSince = Date.now();
        if (Date.now() - stuckSince > 8000) {
          setStatus('尝试 CDP 唤醒...', 'warn');
          cdpClickSelf();
          stuckSince = 0;
        } else {
          setStatus('等待视频加载...', 'warn');
        }
        return;
      }
      stuckSince = 0;

      const state = getVideoState();
      if (state === 'ended') {
        if (!videoEnded) {
          videoEnded = true;
          if (toggles.autoBack) {
            setStatus('已播完，返回目录', 'warn');
            goBack();
          } else {
            setStatus('已播完', 'ok');
          }
        }
      } else if (state === 'paused') {
        videoEnded = false;
        if (toggles.autoPlay) resumePlay();
      } else if (state === 'playing') {
        videoEnded = false;
        setStatus('播放中', 'ok');
      }
    };

    setTimeout(check, 2000);
    watchTimer = setInterval(check, MONITOR_INTERVAL);
    setStatus('监控运行中', 'ok');
  }

  // ═══════════════════════════════════════════════════
  //  课程目录页 — 找到第一个未完成视频并点击
  // ═══════════════════════════════════════════════════

  function findFirstIncomplete() {
    const items = document.querySelectorAll('.showVideo');
    for (const div of items) {
      const allPs = div.querySelectorAll('p');
      let progress = '';
      allPs.forEach(p => {
        const t = p.textContent.trim();
        if (/^\d+%$/.test(t)) progress = t;
      });
      if (!progress) continue;
      const pct = parseInt(progress, 10);
      if (pct >= 100) continue;
      const clickable = div.querySelector('p[onclick*="showVideo"]');
      if (!clickable) continue;
      const oc = clickable.getAttribute('onclick') || '';
      const m = oc.match(/showVideo\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) {
        const [, courseId, cwId, vId, nSec, type] = m;
        return { courseId, cwId, vId, nSec, type, text: clickable.textContent.trim(), el: clickable };
      }
    }
    return null;
  }

  function startIntroPage() {
    createFloatingPanel();

    if (!toggles.autoBack) { setStatus('自动下一节已关闭', ''); return; }

    const tryJump = () => {
      const item = findFirstIncomplete();
      if (!item) return false;
      const nSec = toggles.autoLeak ? 0 : item.nSec;
      const url = `/course/newcourse/watch.htm?courseId=${item.courseId}&lCoursewareId=${item.cwId}&lVideoId=${item.vId}&nViewSecond=${nSec}&type=${item.type}`;
      setStatus('跳转: ' + item.text, 'warn');
      location.href = url;
      return true;
    };

    if (!tryJump()) {
      // 目录可能还没加载，重试
      let retries = 0;
      const retry = setInterval(() => {
        retries++;
        if (tryJump() || retries > 20) clearInterval(retry);
      }, 500);
      setTimeout(() => clearInterval(retry), 12000);
    }
  }

  // ═══════════════════════════════════════════════════
  //  路由
  // ═══════════════════════════════════════════════════

  if (path.includes('watch.htm')) {
    startWatchMonitor();
  } else if (path.includes('intro.htm')) {
    startIntroPage();
  } else if (path.includes('studytasklist.htm')) {
    createFloatingPanel();
  }

})();
