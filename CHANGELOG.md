# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions before 1.8 are not recorded here; that history lives in the commit log.

## [1.8]

### Changed

- **The sidebar is now shown by default.** Previously a fresh install hid it
  immediately, before you had a chance to click anything. Existing installs keep
  the preference already stored under `sidebarState`.
- **The toggle is a real `<button>` instead of a bare anchor**, so it can be
  reached with `Tab` and activated with `Enter` or `Space`. The styling is
  unchanged.
- `Alt + S` is no longer captured while you are typing in an input, textarea or
  other editable field, and no longer reacts to `AltGr` combinations such as
  `Ctrl + Alt + S` on Windows.

### Added

- A visible focus ring for keyboard users, and `aria-expanded` reporting whether
  the sidebar is currently shown.
- Auto-update metadata (`@updateURL` / `@downloadURL`), plus `@homepageURL`,
  `@supportURL` and an `@noframes` guard.
- An [MIT license](./LICENSE) and this changelog.

### Fixed

- The hider stylesheet is attached at document-start rather than on
  `DOMContentLoaded`, so a hidden sidebar can no longer paint before it is
  hidden.
- The SPA observer is debounced with `setTimeout` instead of
  `requestAnimationFrame`, which is paused in background tabs and deferred the
  reconcile until the tab became visible again.
- The hider is correctly re-attached if the page replaces the element it was
  attached to.
- A stored value other than an explicit `hidden` now falls back to `shown`
  instead of silently changing behavior.
- Removed a dead no-op CSS rule left over from an earlier iteration.

### Documentation

- Corrected the claim that the button requires a URL containing `/lectures/`; it
  keys off the lecture toolbar (`.lecture-left`) instead.
- Documented that hiding is CSS-based and site-wide, how the preference behaves
  across tabs, and the supported userscript managers.
- Replaced the "zero overhead" performance claims with a description of what the
  observer actually does.
