# Cantrill Sidebar Toggle

A lightweight Tampermonkey userscript that adds a native-looking **Show / Hide Sidebar** button to [learn.cantrill.io](https://learn.cantrill.io).

If you prefer a distraction-free lecture view, or often work on a small screen with your browser snapped side-by-side with another window (like notes, a terminal, documentation or another browser window), this is for you.

---

## ✨ Features

- 🎛️ **One-click toggle** — show or hide the course sidebar from the lecture toolbar.
- 💻 **Perfect for small screens** — reclaims horizontal space, making it ideal for split-screen or side-by-side workflows.
- 🎨 **Native look** — matches the existing `learn.cantrill.io` UI, so it doesn't feel bolted on.
- 💾 **Remembers your choice** — if you hide the sidebar, it stays hidden across page loads and lectures.
- ⌨️ **Keyboard shortcut** — `Alt + S` toggles the sidebar without touching the mouse.
- 🚀 **Fast and lightweight** — hides the sidebar with CSS (not JS), so there's zero performance overhead while browsing.
- 🧩 **No external dependencies** — pure vanilla JavaScript, no frameworks, no tracking.

---

## 📸 Preview

<img width="400" height="400" alt="image" src="https://github.com/user-attachments/assets/a9b7c0ac-4920-46cb-a918-ac1eb0989b24" />

<img width="400" height="400" alt="image" src="https://github.com/user-attachments/assets/467b5209-76ab-4a73-8b7c-65895ed4634d" />


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
| Press **Alt + S** | Same as clicking the button. Works anywhere on the page. |
| Reload the page | Your last choice is remembered automatically. |

Your preference is stored in Tampermonkey's `GM_setValue` storage, so it persists across page loads, tabs, and lectures.

---

## 🔧 How It Works

The script does three things:

1. **Injects a style tag** that matches `#courseSidebar` and `.course-sidebar` with `display: none !important`. Toggling the sidebar is as simple as flipping `styleTag.disabled`.
2. **Injects a button** into the existing `.lecture-left` toolbar on the lecture page, styled to match the site's other nav icons.
3. **Watches for SPA re-renders** with a debounced `MutationObserver`, so the button and hider stay applied when Teachable swaps page content without a full reload.

No element styles are touched on every mutation, so CPU cost is effectively zero.

---

## 🐛 Troubleshooting

### The button doesn't appear
- Make sure you're on an actual **lecture page** (the URL contains `/lectures/`). The button only shows on lecture pages, not the dashboard or course listing.
- Refresh the page once after installing the script.
- Check that Tampermonkey is enabled and the script is toggled on in the extension popup.

### The sidebar pops back in
- This usually means Teachable changed their DOM. Check that `#courseSidebar` and `.course-sidebar` are still the correct selectors (F12 → Console → `document.querySelector('#courseSidebar')`).
- If they've changed, open an issue with the new class/id.

### Alt + S isn't working
- Some browsers or other extensions may claim `Alt + S` first. Try clicking the button instead, or edit the `keydown` handler in the script to use a different key.

---


## ⚠️ Disclaimer

This is an unofficial userscript. It is **not affiliated with, endorsed by, or supported by** Adrian Cantrill, learn.cantrill.io, or Teachable. Use at your own risk.

---

## 💛 Acknowledgments

- Built for students working through [Adrian Cantrill's AWS courses](https://learn.cantrill.io) — some of the best AWS training out there.
