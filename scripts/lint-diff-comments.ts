#!/usr/bin/env node
'use strict';

/**
 * Reads ESLint JSON output from stdin, filters violations to lines that appear
 * in the current git diff, then posts them as GitHub PR review comments.
 *
 * Usage:
 *   pnpm eslint --no-config-lookup --config scripts/lint-diff.eslint.config.mjs \
 *     --format json . 2>/dev/null | \
 *     node --experimental-transform-types scripts/lint-diff-comments.ts
 *
 * Environment variables (all provided automatically by GitHub Actions):
 *   GITHUB_TOKEN       - token used to post PR review comments
 *   GITHUB_REPOSITORY  - owner/repo (e.g. "getsentry/sentry")
 *   GITHUB_REF         - ref of the PR (e.g. "refs/pull/123/merge")
 *   GITHUB_SHA         - head commit SHA
 *   GITHUB_BASE_REF    - base branch name (e.g. "master")
 */
import {execSync} from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChangedLines = Map<string, Set<number>>;

interface ESLintMessage {
  column: number;
  line: number;
  message: string;
  ruleId: string | null;
  severity: number;
}

interface ESLintResult {
  filePath: string;
  messages: ESLintMessage[];
}

interface GitHubComment {
  body: string;
  line: number;
  path: string;
  side: 'RIGHT';
}

// ---------------------------------------------------------------------------
// Git diff
// ---------------------------------------------------------------------------

function getChangedLines(base: string): ChangedLines {
  const diff = execSync(`git diff ${base}...HEAD --unified=0 --diff-filter=ACM`, {
    encoding: 'utf-8',
  });

  const changedLines: ChangedLines = new Map();
  let currentFile: string | null = null;

  for (const line of diff.split('\n')) {
    // +++ b/static/app/components/foo.tsx
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      if (!changedLines.has(currentFile)) {
        changedLines.set(currentFile, new Set());
      }
      continue;
    }

    // @@ -old_start,old_count +new_start,new_count @@
    if (line.startsWith('@@') && currentFile !== null) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        const start = parseInt(match[1]!, 10);
        // count omitted means 1 line; count=0 means deletion-only hunk
        const count = match[2] === undefined ? 1 : parseInt(match[2]!, 10);
        const lines = changedLines.get(currentFile)!;
        for (let i = start; i < start + count; i++) {
          lines.add(i);
        }
      }
    }
  }

  return changedLines;
}

// ---------------------------------------------------------------------------
// ESLint output parsing
// ---------------------------------------------------------------------------

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function filterResults(
  results: ESLintResult[],
  changedLines: ChangedLines,
  repoRoot: string
): ESLintMessage[] & Array<{filePath: string}> {
  const comments: Array<ESLintMessage & {filePath: string}> = [];

  for (const result of results) {
    if (result.messages.length === 0) {
      continue;
    }

    // ESLint gives absolute paths; convert to repo-relative
    const relPath = result.filePath.startsWith(repoRoot + '/')
      ? result.filePath.slice(repoRoot.length + 1)
      : result.filePath;

    const lines = changedLines.get(relPath);
    if (!lines) {
      continue;
    }

    for (const msg of result.messages) {
      if (lines.has(msg.line)) {
        comments.push({...msg, filePath: relPath});
      }
    }
  }

  return comments;
}

// ---------------------------------------------------------------------------
// GitHub PR review
// ---------------------------------------------------------------------------

function getPRNumber(): number | null {
  // GITHUB_REF = refs/pull/123/merge
  const ref = process.env.GITHUB_REF ?? '';
  const match = ref.match(/refs\/pull\/(\d+)\/merge/);
  return match ? parseInt(match[1]!, 10) : null;
}

async function postReview(
  comments: Array<ESLintMessage & {filePath: string}>
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  const prNumber = getPRNumber();

  if (!token || !repo || !sha || !prNumber) {
    console.log(
      'Not in a GitHub Actions PR context — printing filtered results instead.\n'
    );
    for (const c of comments) {
      const severity = c.severity === 2 ? 'error' : 'warning';
      console.log(
        `${c.filePath}:${c.line}:${c.column}  ${severity}  ${c.message}  [${c.ruleId}]`
      );
    }
    return;
  }

  const reviewComments: GitHubComment[] = comments.map(c => ({
    path: c.filePath,
    line: c.line,
    side: 'RIGHT',
    body: `**${c.ruleId}**: ${c.message}`,
  }));

  const response = await fetch(
    `https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        commit_id: sha,
        event: 'COMMENT',
        comments: reviewComments,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  console.log(`Posted ${reviewComments.length} review comment(s) on PR #${prNumber}.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const base = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : 'origin/master';

  const repoRoot = execSync('git rev-parse --show-toplevel', {encoding: 'utf-8'}).trim();
  const changedLines = getChangedLines(base);

  const raw = await readStdin();

  let results: ESLintResult[];
  try {
    results = JSON.parse(raw);
  } catch {
    console.error('Failed to parse ESLint JSON output. Is --format json set?');
    process.exit(1);
  }

  const comments = filterResults(results, changedLines, repoRoot);

  if (comments.length === 0) {
    console.log('No lint issues found on changed lines.');
    return;
  }

  await postReview(comments);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
