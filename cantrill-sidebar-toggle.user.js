// ==UserScript==
// @name         Sidebar Toggle in Lecture Bar - Cantrill
// @namespace    https://github.com/chrismutua/cantrill-course-sidebar-toggle
// @version      1.10
// @description  Toggle the course sidebar from a labelled button in the lecture toolbar
// @author       Chris Mutua
// @match        https://learn.cantrill.io/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @homepageURL  https://github.com/chrismutua/cantrill-course-sidebar-toggle
// @supportURL   https://github.com/chrismutua/cantrill-course-sidebar-toggle/issues
// @updateURL    https://github.com/chrismutua/cantrill-course-sidebar-toggle/releases/latest/download/cantrill-sidebar-toggle.user.js
// @downloadURL  https://github.com/chrismutua/cantrill-course-sidebar-toggle/releases/latest/download/cantrill-sidebar-toggle.user.js
// @license      MIT
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const HIDDEN = 'hidden';
    const SHOWN  = 'shown';

    // Anything other than an explicit "hidden" falls back to shown, so a
    // corrupted or legacy stored value can never strand the user.
    const stored = GM_getValue('sidebarState', SHOWN);
    let state = (stored === HIDDEN) ? HIDDEN : SHOWN;

    // ---- Global CSS: button styling + sidebar hider ----
    GM_addStyle(`
        .tm-sidebar-toggle {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            margin: 0 0 0 8px;
            cursor: pointer;
            color: #fff;
            background: transparent;
            border: 1px solid currentColor;
            border-radius: 4px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 600;
            line-height: 1;
            text-align: center;
            vertical-align: middle;
            appearance: none;
            -webkit-appearance: none;
            transition: background 0.15s, color 0.15s, border-color 0.15s;
            white-space: nowrap;
        }
        .tm-sidebar-toggle:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .tm-sidebar-toggle[data-state="hidden"] {
            color: #ff9900;
            border-color: #ff9900;
        }
        .tm-sidebar-toggle[data-state="hidden"]:hover {
            background: rgba(255,153,0,0.15);
            color: #ff9900;
        }
        .tm-sidebar-toggle:focus-visible {
            outline: 2px solid #ff9900;
            outline-offset: 2px;
        }
        .tm-sidebar-toggle svg {
            width: 16px;
            height: 16px;
            display: block;
            flex: 0 0 auto;
        }

        /* The sidebar hider. This rule is always present but inert until
           <html> carries the class, so toggling is a plain class flip. It
           deliberately does not use style.disabled: setting that before the
           element is connected is silently ignored, which caused the sidebar
           to be force-hidden while the button claimed it was shown. */
        html.tm-sidebar-hidden #courseSidebar,
        html.tm-sidebar-hidden .course-sidebar {
            display: none !important;
            visibility: hidden !important;
        }
    `);

    // ---- Sidebar state ----
    // The class on <html> is the single source of truth for hiding, so the
    // visible state can never drift from what the button reports. At
    // document-start documentElement does not exist yet, so this call is a
    // no-op there; install() and the observer run it again once it does.
    function syncHider() {
        if (!document.documentElement) return;
        document.documentElement.classList.toggle('tm-sidebar-hidden', state === HIDDEN);
    }
    syncHider();

    // ---- Button ----
    function labelFor(s) {
        return s === HIDDEN ? 'Show Sidebar' : 'Hide Sidebar';
    }

    // Single place that renders state into the button, shared by creation and
    // every later update so the two can never drift apart.
    function applyButtonState(btn) {
        btn.dataset.state = state;
        btn.setAttribute('aria-label', labelFor(state));
        // Disclosure semantics: this button controls the sidebar's visibility.
        // aria-expanded rather than aria-pressed, because the accessible name
        // already describes the action and changes with the state.
        btn.setAttribute('aria-expanded', String(state === SHOWN));
        btn.setAttribute('title', labelFor(state) + ' (Alt+S)');
        const span = btn.querySelector('.tm-sidebar-toggle-label');
        if (span) span.textContent = labelFor(state);
    }

    function makeButton() {
        if (document.querySelector('.lecture-left .tm-sidebar-toggle')) return;

        const left = document.querySelector('.lecture-left');
        if (!left) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tm-sidebar-toggle';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 aria-hidden="true">
                <line x1="3" y1="6"  x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <span class="tm-sidebar-toggle-label"></span>
        `;
        applyButtonState(btn);
        btn.addEventListener('click', toggle);

        // Insert right after the home/back icon
        const back = left.querySelector('a.nav-icon-back');
        if (back && back.nextSibling) {
            left.insertBefore(btn, back.nextSibling);
        } else {
            left.insertBefore(btn, left.firstChild);
        }
    }

    function updateButtonState() {
        const btn = document.querySelector('.lecture-left .tm-sidebar-toggle');
        if (btn) applyButtonState(btn);
    }

    function toggle() {
        state = (state === HIDDEN) ? SHOWN : HIDDEN;
        GM_setValue('sidebarState', state);
        syncHider();
        updateButtonState();
    }

    // ---- Boot ----
    function install() {
        syncHider();
        makeButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }

    // ---- Debounced observer ----
    let pending = false;
    const obs = new MutationObserver(() => {
        if (pending) return;
        pending = true;
        // setTimeout rather than requestAnimationFrame: rAF is paused in
        // background tabs, which would defer the reconcile until the tab is
        // visible again.
        setTimeout(() => {
            pending = false;
            syncHider();
            if (!document.querySelector('.lecture-left .tm-sidebar-toggle')) makeButton();
        }, 50);
    });
    const startObserving = () => obs.observe(document.body, { childList: true, subtree: true });
    if (document.body) startObserving();
    else document.addEventListener('DOMContentLoaded', startObserving, { once: true });

    // Alt+S hotkey
    window.addEventListener('keydown', (e) => {
        // AltGr reports as Ctrl+Alt on Windows, so ignore it: otherwise typing
        // characters such as "ś" would toggle the sidebar.
        if (!e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key !== 's' && e.key !== 'S' && e.code !== 'KeyS') return;
        // Never hijack the shortcut while the user is typing.
        const el = e.target;
        if (el instanceof Element &&
            (el.isContentEditable || el.closest('input, textarea, select'))) {
            return;
        }
        e.preventDefault();
        toggle();
    }, true);
})();
