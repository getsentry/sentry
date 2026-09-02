#!/usr/bin/env node

/* eslint-disable import/no-nodejs-modules -- This skill helper is a Node.js CLI. */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {parseArgs} from 'node:util';

const requireFromRepo = createRequire(path.join(process.cwd(), 'package.json'));
const ARTIFACT_ROOT = path.resolve('.artifacts/ui-capture');
const PROFILE_DIRECTORY = path.join(os.homedir(), '.sentry-ui-capture-github');
const MARKER_START = '<!-- frontend-ui-screenshots:start -->';
const MARKER_END = '<!-- frontend-ui-screenshots:end -->';
const ASSET_URL_PATTERN = /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+/g;

function runJson(command, args, options = {}) {
  return JSON.parse(execFileSync(command, args, {encoding: 'utf8', ...options}));
}

function resolveCurrentPullRequest() {
  const pullRequest = runJson('gh', [
    'pr',
    'view',
    '--json',
    'number,url,body,headRefName,headRefOid',
  ]);
  const repository = runJson('gh', ['repo', 'view', '--json', 'nameWithOwner']);
  return {...pullRequest, repository: repository.nameWithOwner};
}

function readManifest(manifestArgument) {
  if (!manifestArgument) {
    throw new Error('Usage: publish.mjs --manifest <path> or publish.mjs --login');
  }
  const manifestPath = path.resolve(manifestArgument);
  const captureDirectory = path.dirname(manifestPath);
  if (
    path.basename(manifestPath) !== 'manifest.json' ||
    path.dirname(captureDirectory) !== ARTIFACT_ROOT
  ) {
    throw new Error('Manifest must be a direct child of .artifacts/ui-capture/<name>');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    throw new Error('Manifest contains no screenshot pairs');
  }
  const pairs = manifest.artifacts.map(artifact => {
    const before = validateImagePath(artifact.before, captureDirectory);
    const after = validateImagePath(artifact.after, captureDirectory);
    return {
      after,
      before,
      label: `${artifact.viewport} · ${artifact.theme}`
        .replace(/[|<>\r\n]+/g, ' ')
        .trim(),
    };
  });
  return {captureDirectory, pairs};
}

function validateImagePath(value, captureDirectory) {
  const imagePath = path.resolve(value);
  if (
    path.dirname(imagePath) !== captureDirectory ||
    path.extname(imagePath).toLowerCase() !== '.png' ||
    !fs.statSync(imagePath).isFile()
  ) {
    throw new Error(`Screenshot must be a PNG inside ${captureDirectory}: ${value}`);
  }
  return imagePath;
}

async function launchGitHub(profileDirectory, headless) {
  fs.mkdirSync(profileDirectory, {recursive: true, mode: 0o700});
  fs.chmodSync(profileDirectory, 0o700);
  const {chromium} = requireFromRepo('playwright');
  return chromium.launchPersistentContext(profileDirectory, {
    channel: 'chrome',
    headless,
    viewport: headless ? {width: 1280, height: 900} : null,
  });
}

async function openPullRequest(context, pullRequest) {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(pullRequest.url, {waitUntil: 'domcontentloaded'});
  return page;
}

function uploadControl(page) {
  return page.locator('input[type="file"]').last();
}

async function login(pullRequest) {
  const context = await launchGitHub(PROFILE_DIRECTORY, false);
  try {
    const page = await openPullRequest(context, pullRequest);
    await page.bringToFront();
    process.stdout.write('Complete GitHub login in the opened Chrome window.\n');
    await uploadControl(page).waitFor({
      state: 'attached',
      timeout: 15 * 60 * 1000,
    });
    process.stdout.write('GitHub attachment session is ready.\n');
  } finally {
    await context.close();
  }
}

async function editorValue(editor) {
  return editor.evaluate(element =>
    element instanceof HTMLTextAreaElement ? element.value : (element.textContent ?? '')
  );
}

async function clearEditor(editor) {
  await editor.fill('');
}

async function uploadImages(pullRequest, pairs) {
  const context = await launchGitHub(PROFILE_DIRECTORY, true);
  try {
    const page = await openPullRequest(context, pullRequest);
    if (new URL(page.url()).pathname.startsWith('/login')) {
      throw new Error('GitHub session expired; rerun publish.mjs --login');
    }
    await page
      .getByText('Add a comment', {exact: false})
      .last()
      .click({timeout: 3000})
      .catch(() => {});
    const editor = page.locator('textarea, [contenteditable="true"]').last();
    await editor.waitFor({state: 'attached', timeout: 20000});
    const input = uploadControl(page);
    await input.waitFor({state: 'attached', timeout: 20000});
    await clearEditor(editor);

    const uploaded = [];
    for (const pair of pairs) {
      const urls = [];
      for (const imagePath of [pair.before, pair.after]) {
        const previous = new Set(
          (await editorValue(editor)).match(ASSET_URL_PATTERN) ?? []
        );
        await input.setInputFiles(imagePath);
        const assetUrl = await waitForAssetUrl(editor, previous);
        urls.push(assetUrl);
      }
      uploaded.push({after: urls[1], before: urls[0], label: pair.label});
    }
    await clearEditor(editor);
    return uploaded;
  } finally {
    await context.close();
  }
}

async function waitForAssetUrl(editor, previous) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const value = await editorValue(editor);
    const current = value.match(ASSET_URL_PATTERN) ?? [];
    const assetUrl = current.find(url => !previous.has(url));
    if (assetUrl && !value.includes('Uploading')) {
      return assetUrl;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for GitHub to upload a screenshot');
}

function renderTable(uploads) {
  const rows = uploads.map(
    upload =>
      `| **${upload.label}**<br>![Before — ${upload.label}](${upload.before}) | **${upload.label}**<br>![After — ${upload.label}](${upload.after}) |`
  );
  return [
    MARKER_START,
    '## UI screenshots',
    '',
    '| Before | After |',
    '| --- | --- |',
    ...rows,
    MARKER_END,
  ].join('\n');
}

function updatePullRequest(pullRequest, uploads) {
  const markerPattern = new RegExp(`\\n?${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, 'g');
  const body = `${(pullRequest.body ?? '')
    .replace(markerPattern, '')
    .trimEnd()}\n\n${renderTable(uploads)}\n`;
  const updated = runJson(
    'gh',
    [
      'api',
      '--method',
      'PATCH',
      `repos/${pullRequest.repository}/pulls/${pullRequest.number}`,
      '--input',
      '-',
    ],
    {input: JSON.stringify({body})}
  );
  const missing = uploads
    .flatMap(upload => [upload.before, upload.after])
    .filter(url => !updated.body?.includes(url));
  if (missing.length) {
    throw new Error('GitHub did not return the complete screenshot table');
  }
  return updated.html_url;
}

function updateFileComment(pullRequest, uploads, commentPath) {
  const comments = runJson('gh', [
    'api',
    `repos/${pullRequest.repository}/pulls/${pullRequest.number}/comments?per_page=100`,
  ]);
  const body = renderTable(uploads);
  const existing = comments.find(
    comment => comment.path === commentPath && comment.body?.includes(MARKER_START)
  );
  const updated = existing
    ? runJson(
        'gh',
        [
          'api',
          '--method',
          'PATCH',
          `repos/${pullRequest.repository}/pulls/comments/${existing.id}`,
          '--input',
          '-',
        ],
        {input: JSON.stringify({body})}
      )
    : runJson(
        'gh',
        [
          'api',
          '--method',
          'POST',
          `repos/${pullRequest.repository}/pulls/${pullRequest.number}/comments`,
          '--input',
          '-',
        ],
        {
          input: JSON.stringify({
            body,
            commit_id: pullRequest.headRefOid,
            path: commentPath,
            subject_type: 'file',
          }),
        }
      );
  const missing = uploads
    .flatMap(upload => [upload.before, upload.after])
    .filter(url => !updated.body?.includes(url));
  if (missing.length) {
    throw new Error('GitHub did not return the complete file screenshot comment');
  }
  return updated.html_url;
}

const {values: options} = parseArgs({
  options: {
    'comment-path': {type: 'string'},
    'dry-run': {type: 'boolean'},
    login: {type: 'boolean'},
    manifest: {type: 'string'},
  },
});
const pullRequest = resolveCurrentPullRequest();
if (options.login) {
  await login(pullRequest);
} else {
  const {captureDirectory, pairs} = readManifest(options.manifest);
  if (options['dry-run']) {
    process.stdout.write(
      `${JSON.stringify(
        {
          commentPath: options['comment-path'],
          pairs,
          pullRequest: pullRequest.url,
        },
        null,
        2
      )}\n`
    );
    process.exit(0);
  }
  const uploads = await uploadImages(pullRequest, pairs);
  const pullRequestUrl = options['comment-path']
    ? updateFileComment(pullRequest, uploads, options['comment-path'])
    : updatePullRequest(pullRequest, uploads);
  process.stdout.write(`Updated ${pullRequestUrl}\nRetained ${captureDirectory}\n`);
}
