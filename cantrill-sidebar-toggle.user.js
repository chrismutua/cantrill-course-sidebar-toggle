// ==UserScript==
// @name         Sidebar Toggle in Lecture Bar - Cantrill
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Toggle the course sidebar from a labelled button in the lecture toolbar
// @author       You
// @match        https://learn.cantrill.io/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    const HIDDEN = 'hidden';
    const SHOWN  = 'shown';

    // Anything other than an explicit "hidden" falls back to shown, so a
    // corrupted or legacy stored value can never strand the user.
    const stored = GM_getValue('sidebarState', SHOWN);
    let state = (stored === HIDDEN) ? HIDDEN : SHOWN;

    // ---- Global CSS: hider + button styling ----
    GM_addStyle(`
        a.tm-sidebar-toggle {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            margin-left: 8px;
            cursor: pointer;
            text-decoration: none;
            color: #fff;
            background: transparent;
            border: 1px solid currentColor;
            border-radius: 4px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 600;
            line-height: 1;
            vertical-align: middle;
            transition: background 0.15s, color 0.15s, border-color 0.15s;
            white-space: nowrap;
        }
        a.tm-sidebar-toggle:hover {
            background: rgba(255,255,255,0.1);
            text-decoration: none;
            color: #fff;
        }
        a.tm-sidebar-toggle[data-state="hidden"] {
            color: #ff9900;
            border-color: #ff9900;
        }
        a.tm-sidebar-toggle[data-state="hidden"]:hover {
            background: rgba(255,153,0,0.15);
            color: #ff9900;
        }
        a.tm-sidebar-toggle svg {
            width: 16px;
            height: 16px;
            display: block;
            flex: 0 0 auto;
        }
    `);

    // ---- Hider style tag ----
    const hiderStyle = document.createElement('style');
    hiderStyle.id = 'tm-sidebar-hider-style';
    hiderStyle.textContent = `
        #courseSidebar,
        .course-sidebar {
            display: none !important;
            visibility: hidden !important;
        }
    `;
    hiderStyle.disabled = (state !== HIDDEN);

    // Attach the hider as early as possible so a hidden sidebar never paints.
    // document.head may not exist yet at document-start; a <style> element
    // applies wherever it sits in the document.
    function ensureHiderStyle() {
        if (hiderStyle.isConnected) return;
        const target = document.head || document.documentElement;
        if (target) target.appendChild(hiderStyle);
    }
    ensureHiderStyle();

    // ---- Button ----
    function labelFor(s) {
        return s === HIDDEN ? 'Show Sidebar' : 'Hide Sidebar';
    }

    function makeButton() {
        if (document.querySelector('.lecture-left a.tm-sidebar-toggle')) return;

        const left = document.querySelector('.lecture-left');
        if (!left) return;

        const a = document.createElement('a');
        a.className = 'tm-sidebar-toggle';
        a.setAttribute('role', 'button');
        a.setAttribute('aria-label', labelFor(state));
        a.setAttribute('title', labelFor(state) + ' (Alt+S)');
        a.dataset.state = state;
        a.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 aria-hidden="true">
                <line x1="3" y1="6"  x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <span class="tm-sidebar-toggle-label">${labelFor(state)}</span>
        `;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        });

        // Insert right after the home/back icon
        const back = left.querySelector('a.nav-icon-back');
        if (back && back.nextSibling) {
            left.insertBefore(a, back.nextSibling);
        } else {
            left.insertBefore(a, left.firstChild);
        }
    }

    function updateButtonState() {
        const a = document.querySelector('.lecture-left a.tm-sidebar-toggle');
        if (!a) return;
        a.dataset.state = state;
        a.setAttribute('aria-label', labelFor(state));
        a.setAttribute('title', labelFor(state) + ' (Alt+S)');
        const span = a.querySelector('.tm-sidebar-toggle-label');
        if (span) span.textContent = labelFor(state);
    }

    function toggle() {
        state = (state === HIDDEN) ? SHOWN : HIDDEN;
        GM_setValue('sidebarState', state);
        hiderStyle.disabled = (state !== HIDDEN);
        updateButtonState();
    }

    // ---- Boot ----
    function install() {
        ensureHiderStyle();
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
            ensureHiderStyle();
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
