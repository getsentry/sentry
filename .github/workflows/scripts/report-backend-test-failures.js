const fs = require('fs');
const path = require('path');

const MAX_FAILURES = 30;
const MAX_TRACEBACK_LINES = 50;
const COMMENT_MARKER = '<!-- BACKEND_TEST_FAILURES -->';

function findJsonFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, {withFileTypes: true});
  } catch {
    return [];
  }
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

function parseFailures(jsonFiles, core) {
  const failures = [];

  for (const file of jsonFiles) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
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

function buildCommentBody(failures, runUrl) {
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

module.exports = {
  // Exported for testing
  findJsonFiles,
  parseFailures,
  buildCommentBody,
  COMMENT_MARKER,
  report: async ({github, context, core}) => {
    const workspace = process.env.GITHUB_WORKSPACE || '.';
    const jsonFiles = findJsonFiles(workspace);

    if (jsonFiles.length === 0) {
      core.info('No pytest result files found — skipping comment.');
      return;
    }

    const failures = parseFailures(jsonFiles, core);

    if (failures.length === 0) {
      core.info('No test failures found.');
      return;
    }

    const prNumber = context.payload.pull_request.number;
    const runUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
    const body = buildCommentBody(failures, runUrl);

    // Find existing comment to update instead of creating a duplicate
    const {data: comments} = await github.rest.issues.listComments({
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
  },
};
