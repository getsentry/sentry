#!/usr/bin/env node

/* eslint-disable import/no-nodejs-modules -- This skill helper is a Node.js CLI. */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {parseArgs} from 'node:util';

const ARTIFACT_ROOT = path.resolve('.artifacts/ui-capture');
const MARKER_START = '<!-- frontend-ui-screenshots:start -->';
const MARKER_END = '<!-- frontend-ui-screenshots:end -->';

function run(command, args, options = {}) {
  return execFileSync(command, args, {encoding: 'utf8', ...options}).trim();
}

function runJson(command, args, options = {}) {
  return JSON.parse(run(command, args, options));
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
    throw new Error('Usage: publish.mjs --manifest <path>');
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

function renderTable(pairs) {
  const rows = pairs.map(
    pair =>
      `| **${pair.label}**<br>![Before — ${pair.label}](${pair.before}) | **${pair.label}**<br>![After — ${pair.label}](${pair.after}) |`
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

function attachArgs(pairs) {
  return pairs.flatMap(pair => [
    '--attach',
    `${pair.before}#Before — ${pair.label}`,
    '--attach',
    `${pair.after}#After — ${pair.label}`,
  ]);
}

// gh pr edit --attach rewrites local path refs in the body to asset URLs
function updatePullRequestBody(pullRequest, pairs) {
  const table = renderTable(pairs);
  const markerPattern = new RegExp(`\\n?${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, 'g');
  const body = `${(pullRequest.body ?? '')
    .replace(markerPattern, '')
    .trimEnd()}\n\n${table}\n`;
  const bodyFile = path.join(os.tmpdir(), `ui-screenshots-body-${process.pid}.md`);
  fs.writeFileSync(bodyFile, body);
  try {
    run('gh', [
      'pr',
      'edit',
      String(pullRequest.number),
      '--body-file',
      bodyFile,
      ...attachArgs(pairs),
    ]);
  } finally {
    fs.unlinkSync(bodyFile);
  }
  const updated = runJson('gh', ['pr', 'view', '--json', 'body,url']);
  const missing = pairs
    .flatMap(pair => [`Before — ${pair.label}`, `After — ${pair.label}`])
    .filter(alt => !updated.body?.includes(alt));
  if (missing.length) {
    throw new Error(
      `GitHub did not return all screenshot references: ${missing.join(', ')}`
    );
  }
  return updated.url;
}

// file-level review comments need a temp PR comment to upload, then API post
function updateFileComment(pullRequest, pairs, commentPath) {
  const table = renderTable(pairs);
  const bodyFile = path.join(os.tmpdir(), `ui-screenshots-upload-${process.pid}.md`);
  fs.writeFileSync(bodyFile, table);
  try {
    run('gh', [
      'pr',
      'comment',
      String(pullRequest.number),
      '--body-file',
      bodyFile,
      ...attachArgs(pairs),
    ]);
  } finally {
    fs.unlinkSync(bodyFile);
  }
  const comments = runJson('gh', [
    'api',
    `repos/${pullRequest.repository}/issues/${pullRequest.number}/comments?sort=created&direction=desc&per_page=1`,
  ]);
  const uploaded = comments[0];
  if (!uploaded?.body?.includes(MARKER_START)) {
    throw new Error('Could not find the upload comment');
  }
  run('gh', [
    'api',
    '--method',
    'DELETE',
    `repos/${pullRequest.repository}/issues/comments/${uploaded.id}`,
  ]);
  const reviewComments = runJson('gh', [
    'api',
    `repos/${pullRequest.repository}/pulls/${pullRequest.number}/comments?per_page=100`,
  ]);
  const existing = reviewComments.find(
    comment => comment.path === commentPath && comment.body?.includes(MARKER_START)
  );
  const result = existing
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
        {input: JSON.stringify({body: uploaded.body})}
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
            body: uploaded.body,
            commit_id: pullRequest.headRefOid,
            path: commentPath,
            subject_type: 'file',
          }),
        }
      );
  return result.html_url;
}

const {values: options} = parseArgs({
  options: {
    'comment-path': {type: 'string'},
    'dry-run': {type: 'boolean'},
    manifest: {type: 'string'},
  },
});
const pullRequest = resolveCurrentPullRequest();
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
const pullRequestUrl = options['comment-path']
  ? updateFileComment(pullRequest, pairs, options['comment-path'])
  : updatePullRequestBody(pullRequest, pairs);
process.stdout.write(`Updated ${pullRequestUrl}\nRetained ${captureDirectory}\n`);
