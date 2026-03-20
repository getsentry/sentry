#!/usr/bin/env node
'use strict';

// snapshot-crawler.ts — Crawl Sentry routes and capture screenshots.
//
// Usage:
//   node scripts/snapshot-crawler.ts [OPTIONS]
//   node scripts/routes.ts --defaults | fzf --multi | node scripts/snapshot-crawler.ts
//
// Options:
//   --concurrency <n>   Number of parallel browser workers (default: 4)
//   --out <dir>         Output directory (default: /tmp/sentry-snapshots)
//   --origin <url>      Passed through to routes.ts (default: http://dev.getsentry.net:7999)
//   --orgId <slug>      Org slug to resolve :orgId params (default: sentry)
//   --chrome-profile    Path to Chrome user data dir
//                       (default: ~/Library/Application Support/Google/Chrome)
//   --help              Show this help
//
// The script reads the URL list from `scripts/routes.ts --defaults` and visits
// each page with a persistent Chromium context backed by your local Chrome
// profile, so existing session cookies are available.
//
// Screenshots are saved as PNG files. The filename is derived from the URL path:
//   /organizations/sentry/issues/  →  organizations__sentry__issues.png

import {execFileSync, spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseArgs} from 'node:util';

import {chromium} from 'playwright';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const {values: opts} = parseArgs({
  args: process.argv.slice(2),
  options: {
    concurrency: {type: 'string', default: '4'},
    out: {type: 'string'},
    origin: {type: 'string', default: 'http://dev.getsentry.net:7999'},
    orgId: {type: 'string', default: 'sentry'},
    'chrome-profile': {type: 'string'},
    help: {type: 'boolean', default: false},
  },
  strict: true,
});

if (opts.help) {
  console.log(`Usage: node scripts/snapshot-crawler.ts [OPTIONS]

Options:
  --concurrency <n>    Parallel browser workers (default: 4)
  --out <dir>          Output directory (default: /tmp/sentry-snapshots-<timestamp>)
  --origin <url>       Base URL for routes (default: http://dev.getsentry.net:7999)
  --orgId <slug>       Org slug (default: sentry)
  --chrome-profile     Path to Chrome user data dir
  --help               Show this help`);
  process.exit(0);
}

const CONCURRENCY = Math.max(1, parseInt(opts.concurrency ?? '4', 10));
const ORIGIN = opts.origin ?? 'http://dev.getsentry.net:7999';
const ORG_ID = opts.orgId ?? 'sentry';
const CHROME_PROFILE =
  opts['chrome-profile'] ??
  path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
const OUT_DIR = opts.out ?? path.join(os.tmpdir(), `sentry-snapshots-${Date.now()}`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a URL pathname to a safe filename key. */
function routeKey(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  // Strip leading/trailing slashes, replace internal slashes with __
  const key = pathname.replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'root';
  return key;
}

/** Parse URL lines from a block of text, filtering fragments and unresolved templates. */
function parseUrlLines(text: string): string[] {
  const urls: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('http')) continue;
    if (trimmed.includes('# unresolved template')) continue;
    urls.push(trimmed.split(/\s/)[0]!);
  }
  return urls;
}

/** Read URLs from stdin (used when the crawler is part of a pipeline). */
async function readFromStdin(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return parseUrlLines(Buffer.concat(chunks).toString('utf8'));
}

/** Collect URLs by running routes.ts directly (fallback when stdin is a TTY). */
function collectRoutes(): string[] {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const routesScript = path.join(scriptDir, 'routes.ts');

  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [routesScript, '--defaults', '--origin', ORIGIN, '--orgId', ORG_ID],
      {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}
    );
  } catch (err: any) {
    output = (err.stdout as string) ?? '';
  }

  return parseUrlLines(output);
}

// ─── Chrome profile helpers ───────────────────────────────────────────────────

/**
 * Check whether a Chrome instance is already running with the given profile.
 * We do this by looking for Chrome's SingletonLock file.
 */
function chromeProfileIsLocked(profileDir: string): boolean {
  return fs.existsSync(path.join(profileDir, 'Default', 'SingletonLock'));
}

/**
 * Copy the Chrome profile to a temporary directory so we can launch an
 * independent browser instance even while Chrome is already open.
 *
 * We copy the Default sub-directory file-by-file, silently skipping any files
 * that Chrome has locked (e.g. the WAL journal for Cookies).  The result still
 * gives Playwright valid session cookies in most cases.
 */
function cloneProfileToTemp(srcProfileDir: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-chrome-profile-'));
  const srcDefault = path.join(srcProfileDir, 'Default');
  const destDefault = path.join(tempDir, 'Default');
  fs.mkdirSync(destDefault, {recursive: true});

  if (!fs.existsSync(srcDefault)) {
    return tempDir; // profile dir doesn't have a Default sub-dir; return empty clone
  }

  // Files most relevant to session authentication
  const targets = [
    'Cookies',
    'Cookies-journal',
    'Login Data',
    'Login Data For Account',
    'Local State',
  ];

  for (const name of targets) {
    const src = path.join(srcDefault, name);
    if (!fs.existsSync(src)) continue;
    try {
      fs.copyFileSync(src, path.join(destDefault, name));
    } catch {
      // File may be locked by the running Chrome process — skip it.
    }
  }

  return tempDir;
}

// ─── Worker pool ─────────────────────────────────────────────────────────────

async function runWorker(
  workerId: number,
  queue: string[],
  results: Map<string, 'ok' | 'error'>,
  outDir: string
): Promise<void> {
  // When Chrome is already running with the same profile, launching with the
  // same --user-data-dir hands off to the existing window and exits, breaking
  // Playwright's connection.  Detect this and clone the profile to a temp dir
  // so we get an isolated, controllable browser instance.
  let profileDir = CHROME_PROFILE;
  let tempProfileDir: string | null = null;
  if (chromeProfileIsLocked(CHROME_PROFILE)) {
    if (workerId === 1) {
      process.stderr.write(
        '[snapshot-crawler] Chrome is already running with this profile.\n' +
          '  Cloning the profile to a temp directory so all workers can run in parallel.\n' +
          '  Session cookies will be available, but changes made during the crawl\n' +
          '  will not be written back to your real Chrome profile.\n\n'
      );
    }
    tempProfileDir = cloneProfileToTemp(CHROME_PROFILE);
    profileDir = tempProfileDir;
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: false,
    args: ['--profile-directory=Default'],
    viewport: {width: 1440, height: 900},
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = await context.newPage();

  while (queue.length > 0) {
    const url = queue.shift()!;
    const key = routeKey(url);
    const outPath = path.join(outDir, `${key}.png`);

    process.stdout.write(`[worker ${workerId}] ${url}\n`);

    try {
      await page.goto(url, {waitUntil: 'load', timeout: 30_000});
      // Extra settle time for SPA lazy-loaded content
      await page.waitForTimeout(5_000);
      await page.screenshot({path: outPath, fullPage: false});
      results.set(key, 'ok');
    } catch (err: any) {
      process.stderr.write(`[worker ${workerId}] ERROR ${url}: ${err?.message}\n`);
      results.set(key, 'error');
    }
  }

  await context.close();

  if (tempProfileDir) {
    fs.rmSync(tempProfileDir, {recursive: true, force: true});
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let urls: string[];
  if (process.stdin.isTTY) {
    console.log('Collecting routes from scripts/routes.ts …');
    urls = collectRoutes();
  } else {
    console.log('Reading URLs from stdin …');
    urls = await readFromStdin();
  }
  console.log(`Found ${urls.length} routes.`);

  if (urls.length === 0) {
    console.error('No routes found. Check that routes.ts runs correctly.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, {recursive: true});
  console.log(`Output directory: ${OUT_DIR}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Chrome profile: ${CHROME_PROFILE}`);
  console.log('');

  // Shared mutable queue — workers race to consume it.
  const queue = [...urls];
  const results = new Map<string, 'ok' | 'error'>();

  const workers = Array.from({length: Math.min(CONCURRENCY, urls.length)}, (_, i) =>
    runWorker(i + 1, queue, results, OUT_DIR)
  );

  await Promise.all(workers);

  // ─── Summary ────────────────────────────────────────────────────────────────
  const ok = [...results.values()].filter(v => v === 'ok').length;
  const errors = [...results.values()].filter(v => v === 'error').length;

  console.log('');
  console.log('─'.repeat(72));
  console.log(`Done. ${ok} screenshots saved, ${errors} errors.`);
  console.log(`Output: ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
