# AGENTS.md

Instructions for AI agents working in this repository.

## What this repository is

A single-file Tampermonkey userscript that adds a Show/Hide Sidebar button to
`learn.cantrill.io`, plus the machinery that packages and ships it:

| Path | Purpose |
| :--- | :--- |
| `cantrill-sidebar-toggle.user.js` | The userscript itself. |
| `tools/check-userscript.mjs` | Metadata + syntax gate, including the distribution-URL invariants. |
| `tools/release.mjs` | Version arithmetic, the PR bump gate, and the tag gate / release notes. |
| `.github/workflows/check.yml` | Runs the gates on pull requests and on `main`. |
| `.github/workflows/release.yml` | Publishes a GitHub Release when a `v*` tag is pushed. |
| `CHANGELOG.md` | One section per released version; the release notes come from here. |

Distribution follows `/releases/latest`, so the tag, `@version`, the CHANGELOG
entry and the release asset all have to agree. Most of the rules below exist to
keep them in agreement.

## Non-negotiables

1. **Never commit or push directly to `main`.** It is branch-protected with
   admins enforced; the push will be rejected. Work on a branch.
2. **Never merge without an explicit instruction to merge.** Approving a plan,
   finishing the work, or CI going green is not that instruction. Stop and hand
   over for review.
3. **Never delete branches** unless asked.
4. **Never force-push `main`.**
5. **Never disable or weaken branch protection** to get a change in.
6. **Always bump `@version` and add a matching CHANGELOG section in the PR.** CI
   fails without the bump, because an unreleased change never reaches users.

## The flow for a change

1. **Work out the version** the change will ship as:
   `node tools/release.mjs next`
2. **Branch off up-to-date `main`:**
   `git checkout main && git pull --ff-only && git checkout -b <type>/<slug>`
3. **Make the change**, then set `@version` in the userscript metadata to that
   version and add a `## [<version>]` section to `CHANGELOG.md`.
4. **Run the gates locally** — all three must pass:
   - `node --check cantrill-sidebar-toggle.user.js`
   - `node tools/check-userscript.mjs`
   - `node tools/release.mjs verify-bump`
5. **Commit and push the branch.**
6. **Open the PR, assigned to the maintainer:**
   `gh pr create --base main --assignee chrismutua --title … --body …`
   Confirm the account first with `gh api user --jq .login`.
7. **Wait for the `check` workflow to go green.**
8. **Stop and hand over for review.** Do not merge.
9. **Only when explicitly told to merge**, in this order:
   - `gh pr merge <n> --merge` — a merge commit. Never `--squash` or `--rebase`.
   - `git checkout main && git pull --ff-only`
   - `git tag -a v<version> -m "Release <version>"` — using the `@version` that
     was just merged, auto-incremented from the previous tag.
   - Push the tag (tags are not covered by branch protection):
     `git push origin v<version>`
   - `gh run watch` the Release workflow.
   - Verify the published link actually serves the new version:
     `curl -sSL https://github.com/chrismutua/cantrill-course-sidebar-toggle/releases/latest/download/cantrill-sidebar-toggle.user.js`
     and confirm it contains `@version <version>`.

## Version rules

- Tags are `v<version>`; `@version` in the userscript equals the tag without the
  leading `v`.
- The next version increments the **last** numeric component, preserving the
  precision already in use: `v1.8` → `1.9`, `v1.8.1` → `1.8.2`.
- Versions compare numerically, component by component — `1.10` is newer than
  `1.9`, which string comparison would get wrong.
- Only `v<number>[.<number>…]` tags count as releases; anything else is ignored
  so a pointer tag could never be mistaken for one.
- Every merge produces a release, including docs-only changes, because the
  `@version` bump is a PR requirement.

## Invariants CI enforces

- The README one-click install link, `@updateURL` and `@downloadURL` are all the
  same `https://github.com/<owner>/<repo>/releases/latest/download/cantrill-sidebar-toggle.user.js`.
- The release asset keeps the filename `cantrill-sidebar-toggle.user.js`; the
  download URL 404s otherwise.
- The job in `.github/workflows/check.yml` **must keep the name `check`** — it is
  the required status-check context for branch protection on `main`. Renaming it,
  or adding a job-level `name`, blocks every merge.
- No draft or prerelease releases: `/releases/latest` skips them, which would
  break the install link and every installed copy's update check.
- `@version` == tag (minus `v`) == the `## [<version>]` CHANGELOG section == the
  published release.

## Environment notes

- `gh` is at `/usr/bin/gh` and needs a token. Non-interactive shells do not
  source `~/.zshrc`, so `GITHUB_TOKEN` can be missing even when your interactive
  shell is authenticated: export it explicitly, or ask the maintainer where it is
  defined, then confirm with `gh auth status`.
- `git fetch` / `git push` fail on this machine with *"Bad owner or permissions on
  /etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf"*. Prefix those commands with
  `GIT_SSH_COMMAND='ssh -F ~/.ssh/config'`.
- Keep `origin` on SSH. The maintainer's GitHub token has `admin:org`, `project`
  and `repo` scopes but **no `workflow` scope**, so switching to HTTPS token auth
  would make pushes that touch `.github/workflows/` fail.
- Git identity is configured repo-locally as
  `chrismutua <147404799+chrismutua@users.noreply.github.com>`.
- `main` is protected: required status check `check`, admins enforced, force
  pushes and deletions blocked, merge commits allowed (`required_linear_history`
  must stay **false** or the merge-commit flow breaks). There is deliberately no
  emergency direct push — lifting protection is a maintainer decision, done with
  `gh api -X DELETE repos/chrismutua/cantrill-course-sidebar-toggle/branches/main/protection`.

## What CI cannot verify

Say so explicitly when a change needs eyes on a real browser, rather than
implying CI covered it:

- the toolbar button's appearance against the screenshots in the README;
- that clicking the one-click install link actually opens Tampermonkey (release
  assets are served as `application/octet-stream`, which some browser setups
  download instead).
