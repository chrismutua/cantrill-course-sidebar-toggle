# Cantrill Sidebar Toggle

A lightweight Tampermonkey userscript that adds a native-looking **Show / Hide Sidebar** button to [learn.cantrill.io](https://learn.cantrill.io).

If you prefer a distraction-free lecture view, or often work on a small screen with your browser snapped side-by-side with another window (like notes, a terminal, documentation or another browser window), this is for you.

---

## ✨ Features

- 🎛️ **One-click toggle** — show or hide the course sidebar from the lecture toolbar.
- 👀 **Shown by default** — installs quietly: the sidebar stays visible until you decide to hide it.
- 💻 **Perfect for small screens** — reclaims horizontal space, making it ideal for split-screen or side-by-side workflows.
- 🎨 **Native look** — matches the existing `learn.cantrill.io` UI, so it doesn't feel bolted on.
- 💾 **Remembers your choice** — if you hide the sidebar, it stays hidden across page loads and lectures.
- ⌨️ **Keyboard shortcut** — `Alt + S` toggles the sidebar without touching the mouse.
- ♿ **Keyboard accessible** — the button is reachable with `Tab` and activates with `Enter` or `Space`.
- 🚀 **Fast and lightweight** — hides the sidebar with CSS (not JS); the observer only re-checks that the button is still present when the DOM changes.
- 🧩 **No external dependencies** — pure vanilla JavaScript, no frameworks, no tracking.

---

## 📸 Preview

<img width="400" height="400" alt="Lecture toolbar showing the Hide Sidebar button next to the home icon" src="https://github.com/user-attachments/assets/a9b7c0ac-4920-46cb-a918-ac1eb0989b24" />

<img width="400" height="400" alt="Course sidebar hidden, with the button turned orange and reading Show Sidebar" src="https://github.com/user-attachments/assets/467b5209-76ab-4a73-8b7c-65895ed4634d" />


---

## 🚀 Installation

### 1. Install Tampermonkey

If you don't already have it, install the Tampermonkey extension for your browser:

- [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- [Safari](https://apps.apple.com/us/app/tampermonkey/id1482490089)

### 2. Install the script

**Option A — One-click install (recommended):**

👉 [**Click here to install**](https://raw.githubusercontent.com/chrismutua/cantrill-course-sidebar-toggle/main/cantrill-sidebar-toggle.user.js)

Tampermonkey will open an install dialog. Click **Install**.

**Option B — Manual install:**

1. Open the Tampermonkey dashboard.
2. Click the **+** (Create a new script) tab.
3. Delete the boilerplate.
4. Paste the contents of [`cantrill-sidebar-toggle.user.js`](./cantrill-sidebar-toggle.user.js).
5. Press **Ctrl + S** (or **Cmd + S** on macOS) to save.

### 3. Use it

1. Go to [learn.cantrill.io](https://learn.cantrill.io) and open any course lecture.
2. Look for the **Show Sidebar / Hide Sidebar** button in the lecture toolbar (next to the home icon).
3. Click it — or press **Alt + S** — to toggle the sidebar.

---

## 🎮 Usage

| Action | Result |
| :--- | :--- |
| Click **Hide Sidebar** | The course sidebar is hidden. Button turns orange and reads **Show Sidebar**. |
| Click **Show Sidebar** | The course sidebar reappears. Button returns to normal. |
| Press **Alt + S** | Same as clicking the button. Works anywhere on the page, except while you are typing in a text field. |
| Reload the page | Your last choice is remembered automatically. |

The sidebar is **shown by default** on a fresh install. Your preference is stored in Tampermonkey's `GM_setValue` storage and read once when the page loads, so a change made in one tab is picked up by other tabs the next time they load or refresh.

---

## ♿ Keyboard & accessibility

- `Tab` to the button, then press `Enter` or `Space` to toggle.
- `Alt + S` works anywhere except while you are typing in an input, textarea or other editable field, so it never interferes with typing notes.
- The button reports whether the sidebar is visible via `aria-expanded`, and has a visible focus ring.

---

## 🔧 How It Works

The script does three things:

1. **Injects a style tag** that matches `#courseSidebar` and `.course-sidebar` with `display: none !important`. Toggling the sidebar is as simple as flipping `styleTag.disabled`.
2. **Injects a button** into the existing `.lecture-left` toolbar on the lecture page, styled to match the site's other nav icons.
3. **Watches for SPA re-renders** with a debounced `MutationObserver`, so the button and hider stay applied when Teachable swaps page content without a full reload.

The observer never writes styles. When the page changes it only re-checks that the button and hider are still present, so the work is limited to a lookup after a DOM change.

---

## ⚙️ Supported managers

- **Tampermonkey** — recommended, and what the install links above target.
- **Violentmonkey** — works; it supports the same `GM_*` APIs used here.
- **Greasemonkey 4+** — **not supported.** It replaced the synchronous `GM_getValue` / `GM_setValue` / `GM_addStyle` APIs with a promise-based `GM.*` namespace, so this script cannot run there without a rewrite.

---

## 🔄 Updates

Installed copies update themselves from `main` using the script's `@updateURL`. For an update to be picked up, `@version` in the metadata block must be bumped.

---

## 🐛 Troubleshooting

### The button doesn't appear
- Make sure you're on an actual **lecture page**. The button is added to the lecture toolbar (`.lecture-left`), which only exists there — not on the dashboard or course listing. The script does not check the URL; it keys off that toolbar, so if Teachable renames or removes it, the button stops appearing.
- Refresh the page once after installing the script.
- Check that Tampermonkey is enabled and the script is toggled on in the extension popup.

### The sidebar pops back in
- This usually means Teachable changed their DOM. Check that `#courseSidebar` and `.course-sidebar` are still the correct selectors (F12 → Console → `document.querySelector('#courseSidebar')`).
- If they've changed, open an issue with the new class/id.

### Alt + S isn't working
- It is deliberately ignored while the cursor is in a text field, so typing is unaffected. Click elsewhere on the page first.
- Some browsers or other extensions may claim `Alt + S` first. Try clicking the button instead, or edit the `keydown` handler in the script to use a different key.

---

## 🧭 Known limitations

- Hiding is done in CSS and applies anywhere on `learn.cantrill.io` where `#courseSidebar` or `.course-sidebar` exists — not only on lecture pages. If the sidebar is hidden on a page with no button, press **Alt + S** to bring it back.
- The script depends on Teachable's current markup. If the sidebar or toolbar elements are renamed, hiding or the button will stop working until the selectors in the script are updated.
- The setting is read once per page load, so changing it in one tab does not update tabs that are already open until they reload.

---

## 📄 License

[MIT](./LICENSE) © Chris Mutua

---

## ⚠️ Disclaimer

This is an unofficial userscript. It is **not affiliated with, endorsed by, or supported by** Adrian Cantrill, learn.cantrill.io, or Teachable. Use at your own risk.

---

## 💛 Acknowledgments

- Built for students working through [Adrian Cantrill's AWS courses](https://learn.cantrill.io) — some of the best AWS training out there.
