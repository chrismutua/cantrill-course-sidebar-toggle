#!/usr/bin/env node
// Release helpers for this repo: version arithmetic, the PR/tag gates, and
// release-note extraction.
//
// Distribution follows the newest tag, so the tag, the `@version` in the
// userscript, and the CHANGELOG section all have to agree. These subcommands
// are what keep them in lockstep:
//
//   next                     print the next version, derived from the highest tag
//   verify-bump              fail unless @version is newer than the highest tag
//   verify-tag [--tag <t>]   fail unless @version matches the tag and the
//                            CHANGELOG has a section for it
//                            [--notes-file <path>] also writes that section out
//
// Run locally with: node tools/release.mjs <subcommand>

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(root, 'cantrill-sidebar-toggle.user.js');
const changelogPath = join(root, 'CHANGELOG.md');

// Version tags only. Anything else (a future `latest` pointer, for example) is
// deliberately ignored so it can never be mistaken for a release.
const TAG_RE = /^v(\d+(?:\.\d+)*)$/;

const fail = (message) => {
    console.error(`FAIL ${basename(fileURLToPath(import.meta.url))} — ${message}`);
    process.exit(1);
};

const split = (version) => version.split('.').map(Number);

// Numeric, component-wise comparison — never string comparison, so 1.10 is
// correctly newer than 1.9.
function compare(a, b) {
    const left = split(a);
    const right = split(b);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const diff = (left[i] ?? 0) - (right[i] ?? 0);
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
}

function tags() {
    const out = execFileSync('git', ['tag', '--list'], { cwd: root, encoding: 'utf8' });
    return out
        .split('\n')
        .map((line) => line.trim().match(TAG_RE))
        .filter(Boolean)
        .map((match) => ({ tag: match[0], version: match[1] }));
}

function highestTag() {
    return tags().reduce((best, current) => (!best || compare(current.version, best.version) > 0 ? current : best), null);
}

// Increment the last component, preserving precision: v1.8 -> 1.9, v1.8.1 -> 1.8.2.
function nextVersion() {
    const highest = highestTag();
    if (!highest) return '1.0';
    const parts = split(highest.version);
    parts[parts.length - 1] += 1;
    return parts.join('.');
}

function userScriptVersion() {
    const match = readFileSync(scriptPath, 'utf8').match(/^\/\/\s*@version\s+(\S+)\s*$/m);
    if (!match) fail(`no // @version found in ${basename(scriptPath)}`);
    return match[1];
}

function changelogSection(version) {
    const lines = readFileSync(changelogPath, 'utf8').split('\n');
    const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
    if (start === -1) return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^##\s/.test(lines[i])) {
            end = i;
            break;
        }
    }
    return lines.slice(start + 1, end).join('\n').trim();
}

const [command, ...rest] = process.argv.slice(2);
const option = (name) => {
    const index = rest.indexOf(name);
    return index === -1 ? undefined : rest[index + 1];
};

switch (command) {
    case 'next':
        console.log(nextVersion());
        break;

    case 'verify-bump': {
        const version = userScriptVersion();
        const highest = highestTag();
        if (!highest) {
            console.log(`OK no version tags yet; @version ${version} will be the first release`);
            break;
        }
        if (compare(version, highest.version) <= 0) {
            fail(`@version is ${version} but the highest tag is ${highest.tag} — this change would never reach users; set @version to ${nextVersion()}`);
        }
        console.log(`OK @version ${version} is newer than ${highest.tag}`);
        break;
    }

    case 'verify-tag': {
        const tag = option('--tag') ?? process.env.GITHUB_REF_NAME;
        if (!tag) fail('no tag given — pass --tag <vX.Y> or set GITHUB_REF_NAME');
        const match = tag.match(TAG_RE);
        if (!match) fail(`tag "${tag}" is not of the form v<number>[.<number>...]`);
        const expected = match[1];
        const version = userScriptVersion();

        const problems = [];
        if (version !== expected) problems.push(`@version is ${version} but tag ${tag} implies ${expected}`);
        const section = changelogSection(expected);
        if (!section) problems.push(`CHANGELOG.md has no "## [${expected}]" section`);
        if (problems.length > 0) fail(problems.join('; '));

        const notesFile = option('--notes-file');
        if (notesFile) writeFileSync(notesFile, `${section}\n`);
        console.log(`OK ${tag} matches @version ${version}${notesFile ? ` and notes were written to ${notesFile}` : ''}`);
        break;
    }

    default:
        console.error('usage: node tools/release.mjs <next|verify-bump|verify-tag> [--tag <t>] [--notes-file <path>]');
        process.exit(1);
}
