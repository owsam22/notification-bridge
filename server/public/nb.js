// server/public/nb.js
(function() {
  'use strict';

  // ─── Extract config from script tag ───
  const currentScript = document.currentScript;
  const scriptUrl = new URL(currentScript.src);
  const APP_ID = scriptUrl.searchParams.get('app');
  const SERVER = scriptUrl.origin;

  if (!APP_ID) {
    console.warn('[NotifyBridge] No app ID provided. Use: nb.js?app=YOUR_APP_ID');
    return;
  }

  // ─── Storage helpers for frequency control ───
  const STORAGE_KEY = `nb_${APP_ID}`;

  function getDismissed() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { return {}; }
  }

  function setDismissed(id, frequency) {
    const dismissed = getDismissed();
    dismissed[id] = {
      timestamp: Date.now(),
      frequency
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
  }

  function shouldShow(notification) {
    const dismissed = getDismissed();
    const record = dismissed[notification.id];
    if (!record) return true;

    switch (notification.frequency) {
      case 'always':
        return true;
      case 'once':
        return false;
      case 'session':
        // Check if sessionStorage has it
        return !sessionStorage.getItem(`nb_session_${notification.id}`);
      case 'every-x-hours':
        const hours = notification.frequencyHours || 24;
        const elapsed = (Date.now() - record.timestamp) / (1000 * 60 * 60);
        return elapsed >= hours;
      default:
        return false;
    }
  }

  function markSession(id) {
    sessionStorage.setItem(`nb_session_${id}`, '1');
  }

  // ─── Inject styles ───
  function injectStyles() {
    if (document.getElementById('nb-styles')) return;

    const style = document.createElement('style');
    style.id = 'nb-styles';
    style.textContent = `
      .nb-overlay {
        position: fixed;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: nb-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        max-width: 380px;
        width: calc(100vw - 32px);
        pointer-events: auto;
      }

      /* Positions */
      .nb-overlay.nb-bottom-right { bottom: 20px; right: 20px; }
      .nb-overlay.nb-bottom-left { bottom: 20px; left: 20px; }
      .nb-overlay.nb-top-right { top: 20px; right: 20px; }
      .nb-overlay.nb-top-left { top: 20px; left: 20px; }
      .nb-overlay.nb-center {
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
      }
      .nb-overlay.nb-top-center { top: 20px; left: 50%; transform: translateX(-50%); }
      .nb-overlay.nb-bottom-center { bottom: 20px; left: 50%; transform: translateX(-50%); }

      /* Card */
      .nb-card {
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05);
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(20px);
      }

      /* Themes */
      .nb-card.nb-dark {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: #e0e0e0;
        border: 1px solid rgba(255,255,255,0.08);
      }
      .nb-card.nb-light {
        background: linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%);
        color: #1a1a2e;
        border: 1px solid rgba(0,0,0,0.08);
      }

      /* Type accent bar */
      .nb-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
      }
      .nb-card.nb-type-info::before { background: linear-gradient(90deg, #667eea, #764ba2); }
      .nb-card.nb-type-success::before { background: linear-gradient(90deg, #11998e, #38ef7d); }
      .nb-card.nb-type-warning::before { background: linear-gradient(90deg, #f093fb, #f5576c); }
      .nb-card.nb-type-promo::before { background: linear-gradient(90deg, #f7971e, #ffd200); }

      /* Close button */
      .nb-close {
        position: absolute;
        top: 10px; right: 12px;
        background: rgba(128,128,128,0.2);
        border: none;
        color: inherit;
        width: 28px; height: 28px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all 0.2s;
        line-height: 1;
        padding: 0;
      }
      .nb-close:hover {
        background: rgba(255,70,70,0.3);
        transform: scale(1.1);
      }

      /* Icon */
      .nb-icon {
        font-size: 28px;
        margin-bottom: 8px;
        display: block;
      }

      /* Title */
      .nb-title {
        font-size: 16px;
        font-weight: 700;
        margin: 0 0 6px 0;
        padding-right: 30px;
        line-height: 1.3;
      }

      /* Message */
      .nb-message {
        font-size: 13.5px;
        opacity: 0.85;
        margin: 0 0 14px 0;
        line-height: 1.5;
      }

      /* CTA Button */
      .nb-cta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 18px;
        border-radius: 10px;
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s;
        border: none;
        cursor: pointer;
      }
      .nb-type-info .nb-cta { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
      .nb-type-success .nb-cta { background: linear-gradient(135deg, #11998e, #38ef7d); color: white; }
      .nb-type-warning .nb-cta { background: linear-gradient(135deg, #f093fb, #f5576c); color: white; }
      .nb-type-promo .nb-cta { background: linear-gradient(135deg, #f7971e, #ffd200); color: #1a1a2e; }

      .nb-cta:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      }

      /* Powered by */
      .nb-powered {
        font-size: 10px;
        opacity: 0.35;
        margin-top: 10px;
        text-align: right;
      }

      /* Animations */
      @keyframes nb-slide-in {
        from {
          opacity: 0;
          transform: translateY(30px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .nb-overlay.nb-center {
        animation: nb-center-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes nb-center-in {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }

      .nb-fade-out {
        animation: nb-fade-out 0.3s ease forwards;
      }
      @keyframes nb-fade-out {
        to {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
      }
      .nb-overlay.nb-center.nb-fade-out {
        animation: nb-center-out 0.3s ease forwards;
      }
      @keyframes nb-center-out {
        to {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.9);
        }
      }

      /* Stacking - offset multiple notifications */
      .nb-overlay:nth-child(2) { margin-bottom: 10px; }
    `;
    document.head.appendChild(style);
  }

  // ─── Render a notification ───
  function renderNotification(n, offsetIndex) {
    const overlay = document.createElement('div');
    const posClass = 'nb-' + (n.position || 'bottom-right').replace(/\s/g, '-');
    overlay.className = `nb-overlay ${posClass}`;
    overlay.id = `nb-${n.id}`;

    // Offset stacking
    if (posClass.includes('bottom')) {
      overlay.style.marginBottom = (offsetIndex * 10) + 'px';
      const baseBottom = 20 + (offsetIndex * 100);
      overlay.style.bottom = baseBottom + 'px';
    } else if (posClass.includes('top') && !posClass.includes('center')) {
      const baseTop = 20 + (offsetIndex * 100);
      overlay.style.top = baseTop + 'px';
    }

    const theme = n.theme || 'dark';
    const type = n.type || 'info';

    // Custom colors override
    let customStyle = '';
    if (n.customColors) {
      const cc = n.customColors;
      if (cc.bg) customStyle += `background: ${cc.bg} !important;`;
      if (cc.text) customStyle += `color: ${cc.text} !important;`;
    }

    const iconEmojis = {
      info: '💡',
      success: '✅',
      warning: '⚠️',
      promo: '🎉'
    };

    const displayIcon = n.icon || iconEmojis[type] || '🔔';

    overlay.innerHTML = `
      <div class="nb-card nb-${theme} nb-type-${type}" style="${customStyle}">
        <button class="nb-close" title="Dismiss">✕</button>
        <span class="nb-icon">${displayIcon}</span>
        <p class="nb-title">${escapeHtml(n.title)}</p>
        <p class="nb-message">${escapeHtml(n.message)}</p>
        ${n.link ? `<a href="${escapeHtml(n.link)}" target="_blank" rel="noopener" class="nb-cta">${escapeHtml(n.linkText || 'Check it out')} →</a>` : ''}
        <div class="nb-powered">NotifyBridge</div>
      </div>
    `;

    // Close handler
    overlay.querySelector('.nb-close').addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss(overlay, n);
    });

    // CTA click also dismisses
    const cta = overlay.querySelector('.nb-cta');
    if (cta) {
      cta.addEventListener('click', () => {
        dismiss(overlay, n);
      });
    }

    document.body.appendChild(overlay);
  }

  function dismiss(overlay, notification) {
    overlay.classList.add('nb-fade-out');
    setDismissed(notification.id, notification.frequency);
    if (notification.frequency === 'session') {
      markSession(notification.id);
    }
    setTimeout(() => overlay.remove(), 300);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Fetch and display ───
  async function init() {
    try {
      const res = await fetch(`${SERVER}/api/notifications/${APP_ID}`);
      if (!res.ok) return;

      const notifications = await res.json();
      if (!notifications.length) return;

      injectStyles();

      let shownCount = 0;

      notifications.forEach((n, i) => {
        if (!shouldShow(n)) return;

        const delay = ((n.delay || 2) + shownCount * 1.5) * 1000;

        setTimeout(() => {
          renderNotification(n, shownCount);
        }, delay);

        shownCount++;
      });
    } catch (err) {
      // Silently fail - don't break the host app
      console.debug('[NotifyBridge] Could not load notifications:', err.message);
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();