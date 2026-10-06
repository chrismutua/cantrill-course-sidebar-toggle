#!/usr/bin/env node
// Dependency-free gate for the userscript's metadata block.
//
// These checks exist because the review found metadata that had silently
// drifted: a placeholder author, the default tampermonkey.net namespace, and
// no update URLs at all, which meant the README's one-click install produced a
// script that never updated itself.
//
// Run locally with: node tools/check-userscript.mjs

import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = 'chrismutua/cantrill-course-sidebar-toggle';
const MATCH = 'https://learn.cantrill.io/*';
const REQUIRED_GRANTS = ['GM_addStyle', 'GM_getValue', 'GM_setValue'];

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(repoRoot, 'cantrill-sidebar-toggle.user.js');
const readmePath = join(repoRoot, 'README.md');
const source = readFileSync(scriptPath, 'utf8');
const scriptName = basename(scriptPath);

// Distribution follows the newest release rather than a branch. GitHub's
// /releases/latest skips drafts and prereleases, so this always serves the
// newest published tag and never needs editing per release.
const RELEASE_URL = `https://github.com/${REPO}/releases/latest/download/${scriptName}`;

const failures = [];
const check = (label, ok, detail) => {
    if (!ok) failures.push(detail ? `${label} — ${detail}` : label);
};

// --- Syntax -------------------------------------------------------------
try {
    new vm.Script(source, { filename: scriptPath });
} catch (err) {
    failures.push(`syntax error — ${err.message}`);
}

// --- Metadata block -----------------------------------------------------
const block = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
check('metadata block', Boolean(block), 'no // ==UserScript== … // ==/UserScript== header found');

if (block) {
    const meta = new Map();
    for (const line of block[1].split('\n')) {
        const m = line.match(/^\/\/\s*@(\S+)\s+(.*?)\s*$/);
        if (!m) continue;
        const key = m[1];
        if (!meta.has(key)) meta.set(key, []);
        meta.get(key).push(m[2]);
    }
    const first = (key) => meta.get(key)?.[0];

    for (const key of ['name', 'namespace', 'version', 'description', 'author', 'match', 'run-at', 'grant', 'homepageURL', 'supportURL', 'updateURL', 'downloadURL', 'license']) {
        check(`@${key}`, meta.has(key), 'missing');
    }

    // This project versions as MAJOR.MINOR (1.7, 1.8), optionally with a patch.
    // Managers compare versions themselves, so only require that an update is
    // detectable and comparable.
    check('@version', /^\d+(\.\d+){1,3}$/.test(first('version') ?? ''), `"${first('version')}" is not a numeric dot-separated version such as 1.8 or 1.8.1`);
    check('@match', first('match') === MATCH, `expected ${MATCH}, got ${first('match')}`);
    check('@namespace', first('namespace') === `https://github.com/${REPO}`, `expected the repo URL, got ${first('namespace')}`);
    check('@author', first('author') !== 'You', 'still the placeholder');

    for (const key of ['updateURL', 'downloadURL']) {
        check(`@${key}`, first(key) === RELEASE_URL, `expected ${RELEASE_URL}, got ${first(key)}`);
        check(`@${key} appears once`, meta.get(key)?.length === 1, 'must appear exactly once');
    }
    check('@updateURL matches @downloadURL', first('updateURL') === first('downloadURL'), 'the two must point at the same file');
    check('@updateURL asset name', (first('updateURL') ?? '').endsWith(`/${scriptName}`), `the release asset must be named ${scriptName} or the download URL will 404`);
    check('@updateURL is not a branch URL', !(first('updateURL') ?? '').includes('raw.githubusercontent.com'), 'distribution must follow the latest release, not a branch');

    const grants = meta.get('grant') ?? [];
    check('@grant set', REQUIRED_GRANTS.every((g) => grants.includes(g)), `expected ${REQUIRED_GRANTS.join(', ')}`);
}

// --- README install link -------------------------------------------------
// The whole point of the release pointer is that the README never needs editing
// per release, so it must carry exactly that URL. This is what makes "the install
// section always picks up the latest tag" enforced rather than aspirational.
const readme = readFileSync(readmePath, 'utf8');
check('README install link', readme.includes(RELEASE_URL), `README.md must contain ${RELEASE_URL}`);

// --- Report -------------------------------------------------------------
const name = basename(scriptPath);
if (failures.length > 0) {
    console.error(`FAIL ${name} — ${failures.length} problem(s):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}
console.log(`OK ${name} — metadata and syntax look good`);
