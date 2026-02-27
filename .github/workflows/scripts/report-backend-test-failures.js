import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const MAX_FAILURES = 30;
const MAX_TRACEBACK_LINES = 50;
export const COMMENT_MARKER = '<!-- BACKEND_TEST_FAILURES -->';

export function parseFailures(files, core) {
  const failures = [];

  for (const file of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      core.warning(`Skipping ${file}: ${e.message}`);
      continue;
    }

    if (!Array.isArray(data.tests)) {
      continue;
    }

    for (const test of data.tests) {
      if (test.outcome !== 'failed') {
        continue;
      }

      const nodeid = test.nodeid || 'unknown';
      const call = test.call || test.setup || test.teardown || {};
      const longrepr = call.longrepr || '';

      failures.push({nodeid, longrepr});
    }
  }

  return failures;
}

export function buildCommentBody(failures, runUrl) {
  const capped = failures.slice(0, MAX_FAILURES);

  let body = `${COMMENT_MARKER}\n## Backend Test Failures\n\nThe following tests failed in [this run](${runUrl}):\n\n`;

  for (const t of capped) {
    let tb = t.longrepr;
    if (tb) {
      const lines = tb.split('\n');
      if (lines.length > MAX_TRACEBACK_LINES) {
        tb =
          lines.slice(0, MAX_TRACEBACK_LINES).join('\n') +
          `\n... (${lines.length - MAX_TRACEBACK_LINES} more lines)`;
      }
    }
    body += `<details><summary><code>${t.nodeid}</code></summary>\n\n`;
    body += `\`\`\`\n${tb || 'No traceback available'}\n\`\`\`\n\n</details>\n\n`;
  }

  if (failures.length > MAX_FAILURES) {
    body += `... and ${failures.length - MAX_FAILURES} more failures.\n`;
  }

  // Enforce GitHub comment size limit
  if (body.length > 65000) {
    body =
      body.slice(0, 64900) + '\n\n... (truncated due to GitHub comment size limit)\n';
  }

  return body;
}

export async function report({github, context, core}) {
  const workspace = process.env.GITHUB_WORKSPACE || '.';

  const files = readdirSync(workspace, {recursive: true})
    .filter(f => /^pytest-results-/.test(f) && f.endsWith('.json'))
    .map(f => join(workspace, f));

  if (files.length === 0) {
    core.info('No pytest result files found — skipping comment.');
    return;
  }

  const failures = parseFailures(files, core);

  if (failures.length === 0) {
    core.info('No test failures found.');
    return;
  }

  const prNumber = context.payload.pull_request.number;
  const runUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const body = buildCommentBody(failures, runUrl);

  // Find existing comment to update instead of creating a duplicate.
  // Use paginate to search all comments, not just the first page.
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
  });
  const existing = comments.find(c => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    });
    core.info('Updated existing failure comment.');
  } else {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body,
    });
    core.info('Created failure comment.');
  }
}
