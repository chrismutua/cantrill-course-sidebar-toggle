#!/usr/bin/env node
// Functional regression test for the userscript, in a real browser.
//
// Why this exists: 1.9 shipped with the sidebar force-hidden while the button
// claimed it was shown, and clicking did nothing. The cause was `style.disabled`
// being set before the style element was connected - silently ignored, so the
// stylesheet came up enabled. No static check can see that, and it only
// reproduces when the script runs at document-start, the way a userscript
// manager runs it. So this test drives headless Chromium over the DevTools
// protocol and injects the script with
// Page.addScriptToEvaluateOnNewDocument, which is the same execution point.
//
// Usage:  node tools/test-userscript.mjs [path/to/userscript.js]
//
// Needs Node >= 22 (for the global WebSocket) and a Chromium/Chrome binary.
// Set CHROME_PATH to point at one explicitly.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = resolve(process.argv[2] ?? join(repoRoot, 'cantrill-sidebar-toggle.user.js'));
const source = readFileSync(scriptPath, 'utf8');

// A stand-in for the lecture page: the toolbar the button is injected into,
// plus both sidebar selectors the hider must cover.
const PAGE = `<!doctype html><html><head><title>test</title></head><body>
<div class="lecture-left"><a class="nav-icon-back" href="#">home</a></div>
<div id="courseSidebar" style="display:block">sidebar by id</div>
<div class="course-sidebar" style="display:block">sidebar by class</div>
</body></html>`;

const failures = [];
let checks = 0;
function check(label, actual, expected) {
    checks++;
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        console.log(`  ok   ${label}`);
    } else {
        failures.push(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        console.log(`  FAIL ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

// Resolve every plausible Chromium/Chrome binary, in preference order, so a
// broken one can be skipped instead of failing the whole run.
function browserCandidates() {
    const names = [process.env.CHROME_PATH, 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].filter(Boolean);
    const found = [];
    for (const name of names) {
        const resolved = name.includes('/')
            ? name
            : (process.env.PATH ?? '').split(':').filter(Boolean).map((dir) => join(dir, name)).find((path) => existsSync(path));
        if (resolved && existsSync(resolved) && !found.includes(resolved)) found.push(resolved);
    }
    return found;
}

// Removing Chrome's profile can lose a race with its own writes. A leftover temp
// directory is harmless, so cleanup must never fail the test.
function removeProfile(dir) {
    try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
        /* leave it to the OS */
    }
}

// Installs GM_* stubs (with a preselected stored value) and then the userscript
// itself, before the page is parsed.
function bootstrap(stored) {
    return `
        window.__stored = ${JSON.stringify(stored)};
        window.GM_getValue = (key, fallback) => (key in window.__stored) ? window.__stored[key] : fallback;
        window.GM_setValue = (key, value) => { window.__stored[key] = value; };
        window.GM_addStyle = (css) => {
            const el = document.createElement('style');
            el.textContent = css;
            const attach = () => (document.head || document.documentElement || document.body).appendChild(el);
            if (document.head || document.documentElement) attach();
            else addEventListener('DOMContentLoaded', attach, { once: true });
            return el;
        };
        try {
            ${source}
        } catch (error) {
            window.__startupError = String(error);
        }`;
}

const PROBE = `(() => {
    const byId = document.getElementById('courseSidebar');
    const byClass = document.querySelector('.course-sidebar');
    const button = document.querySelector('.tm-sidebar-toggle');
    return {
        displayById: byId ? getComputedStyle(byId).display : 'MISSING',
        displayByClass: byClass ? getComputedStyle(byClass).display : 'MISSING',
        visibilityById: byId ? getComputedStyle(byId).visibility : 'MISSING',
        label: button ? button.textContent.trim() : 'NO BUTTON',
        htmlClass: document.documentElement.className,
        buttons: document.querySelectorAll('.tm-sidebar-toggle').length,
        startupError: window.__startupError ?? null,
    };
})()`;

// Start a browser and wait for its DevTools endpoint, trying each candidate in
// turn. Chrome's stderr is captured so a failure here reports what the browser
// actually said, instead of a bare timeout.
async function launchBrowser() {
    const candidates = browserCandidates();
    if (candidates.length === 0) {
        console.error('FAIL test-userscript.mjs — no Chromium/Chrome found. Set CHROME_PATH to one.');
        process.exit(1);
    }
    const problems = [];
    for (const browserPath of candidates) {
        const userDataDir = mkdtempSync(join(tmpdir(), 'sidebar-test-'));
        const proc = spawn(browserPath, [
            '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
            '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`, 'about:blank',
        ], { stdio: ['ignore', 'ignore', 'pipe'] });

        let stderr = '';
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', (chunk) => { stderr += chunk; });

        const portFile = join(userDataDir, 'DevToolsActivePort');
        const deadline = Date.now() + 30000;
        let wsUrl = null;
        while (Date.now() < deadline) {
            const announced = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
            if (announced) {
                wsUrl = announced[1];
                break;
            }
            if (existsSync(portFile)) {
                try {
                    const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
                    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
                    wsUrl = version.webSocketDebuggerUrl;
                    break;
                } catch {
                    // The port file can appear just before the endpoint answers.
                }
            }
            if (proc.exitCode !== null) break;
            await new Promise((r) => setTimeout(r, 100));
        }

        if (!wsUrl) {
            proc.kill('SIGKILL');
            removeProfile(userDataDir);
            const tail = stderr.trim().split('\n').slice(-5).join('\n      ');
            const why = proc.exitCode !== null
                ? `exited with code ${proc.exitCode}`
                : 'did not expose a DevTools endpoint within 30s';
            problems.push(`${browserPath} ${why}${tail ? `\n      ${tail}` : ''}`);
            continue;
        }

        const ws = new WebSocket(wsUrl);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });
        return { browserPath, proc, userDataDir, ws };
    }

    console.error('FAIL test-userscript.mjs — no usable browser:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
}

async function launch() {
    const { proc, userDataDir, ws } = await launchBrowser();

    let nextId = 0;
    const pending = new Map();
    ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        const resolvePending = pending.get(message.id);
        if (resolvePending) {
            pending.delete(message.id);
            resolvePending(message);
        }
    });
    const send = (method, params = {}, sessionId) => new Promise((res) => {
        const id = ++nextId;
        pending.set(id, res);
        ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

    return {
        async openPage(stored) {
            const target = await send('Target.createTarget', { url: 'about:blank' });
            const attached = await send('Target.attachToTarget', { targetId: target.result.targetId, flatten: true });
            const sessionId = attached.result.sessionId;
            await send('Page.enable', {}, sessionId);
            await send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap(stored) }, sessionId);
            await send('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(PAGE)}` }, sessionId);
            await new Promise((r) => setTimeout(r, 600));

            const evaluate = async (expression) => {
                const reply = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
                const exception = reply.result?.exceptionDetails;
                if (exception) throw new Error(`page threw: ${exception.text ?? 'unknown'}`);
                return reply.result.result.value;
            };
            return {
                probe: async () => {
                    const value = await evaluate(PROBE);
                    return typeof value === 'string' ? JSON.parse(value) : value;
                },
                click: async () => {
                    await evaluate(`document.querySelector('.tm-sidebar-toggle').click()`);
                    await new Promise((r) => setTimeout(r, 150));
                },
                evaluate,
            };
        },
        async close() {
            ws.close();
            proc.kill('SIGKILL');
            // Wait for Chrome to actually exit before touching its profile:
            // removing the directory while it is still flushing races with the
            // writes and throws ENOTEMPTY.
            await new Promise((resolve) => {
                if (proc.exitCode !== null || proc.signalCode !== null) return resolve();
                const timer = setTimeout(resolve, 2000);
                proc.once('exit', () => { clearTimeout(timer); resolve(); });
            });
            removeProfile(userDataDir);
        },
    };
}

if (typeof WebSocket !== 'function') {
    console.error(`FAIL test-userscript.mjs — this test needs Node >= 22 for the global WebSocket (running ${process.version}).`);
    process.exit(1);
}

console.log(`Testing ${scriptPath}`);

const watchdog = setTimeout(() => {
    console.error('FAIL test-userscript.mjs — timed out.');
    process.exit(1);
}, 240000);
watchdog.unref?.();

const browser = await launch();
try {
    console.log('\nfresh install (no stored preference)');
    const fresh = await browser.openPage({});
    let view = await fresh.probe();
    check('sidebar visible on load', view.displayById, 'block');
    check('class-based sidebar also visible', view.displayByClass, 'block');
    check('label reads Hide Sidebar', view.label, 'Hide Sidebar');
    check('html carries no hiding class', view.htmlClass, '');
    check('exactly one button', view.buttons, 1);
    check('no error during startup', view.startupError, null);

    await fresh.click();
    view = await fresh.probe();
    check('after click: sidebar hidden', view.displayById, 'none');
    check('after click: sidebar hidden (class selector)', view.displayByClass, 'none');
    check('after click: label reads Show Sidebar', view.label, 'Show Sidebar');
    check('after click: html carries the hiding class', view.htmlClass, 'tm-sidebar-hidden');

    await fresh.click();
    view = await fresh.probe();
    check('after second click: sidebar visible again', view.displayById, 'block');
    check('after second click: label reads Hide Sidebar', view.label, 'Hide Sidebar');
    check('after second click: hiding class removed', view.htmlClass, '');

    console.log('\nreturning user who had hidden it');
    const hidden = await browser.openPage({ sidebarState: 'hidden' });
    view = await hidden.probe();
    check('hidden on load', view.displayById, 'none');
    check('label reads Show Sidebar', view.label, 'Show Sidebar');
    check('hiding class applied on load', view.htmlClass, 'tm-sidebar-hidden');
    await hidden.click();
    view = await hidden.probe();
    check('after click: sidebar visible', view.displayById, 'block');
    check('after click: label reads Hide Sidebar', view.label, 'Hide Sidebar');

    console.log('\nreturning user who had shown it');
    const shown = await browser.openPage({ sidebarState: 'shown' });
    view = await shown.probe();
    check('visible on load', view.displayById, 'block');
    check('label reads Hide Sidebar', view.label, 'Hide Sidebar');

    console.log('\nafter an SPA re-render (toolbar replaced)');
    const render = await browser.openPage({});
    await render.click();
    await render.evaluate(`(() => {
        const left = document.querySelector('.lecture-left');
        left.remove();
        document.body.insertBefore(left, document.body.firstChild);
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    view = await render.probe();
    check('exactly one button after re-render', view.buttons, 1);
    check('hidden state survives the re-render', view.displayById, 'none');
    check('label still reads Show Sidebar', view.label, 'Show Sidebar');
    await render.click();
    view = await render.probe();
    check('re-injected button still toggles', view.displayById, 'block');
} finally {
    await browser.close();
}

console.log('');
if (failures.length > 0) {
    console.error(`FAIL test-userscript.mjs — ${failures.length} of ${checks} checks failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}
console.log(`OK test-userscript.mjs — all ${checks} checks passed`);
