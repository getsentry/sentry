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
    const dirName = path.basename(path.dirname(file));
    let label = dirName;
    if (dirName.startsWith('pytest-results-monolith-dbs')) {
      label = 'monolith-dbs';
    } else if (dirName.startsWith('pytest-results-migration')) {
      label = 'migration';
    } else if (dirName.startsWith('pytest-results-backend')) {
      label = 'backend';
    }

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
      const message = call.crash?.message || call.message || 'No error message';
      const longrepr = call.longrepr || '';

      failures.push({label, nodeid, message, longrepr});
    }
  }

  return failures;
}

function buildCommentBody(failures) {
  const capped = failures.slice(0, MAX_FAILURES);
  const shardGroups = {};
  for (const f of capped) {
    (shardGroups[f.label] ||= []).push(f);
  }

  let body = `${COMMENT_MARKER}\n## Backend Test Failures\n\n`;
  body += `**${failures.length}** test${failures.length === 1 ? '' : 's'} failed`;
  if (failures.length > MAX_FAILURES) {
    body += ` (showing first ${MAX_FAILURES})`;
  }
  body += '.\n\n';

  for (const [label, tests] of Object.entries(shardGroups).sort()) {
    body += `### ${label}\n\n`;
    body += '| Test | Error |\n|------|-------|\n';
    for (const t of tests) {
      const shortName = t.nodeid.split('::').pop();
      const escapedMsg = t.message
        .replace(/\\/g, '\\\\')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ')
        .slice(0, 200);
      body += `| \`${shortName}\` | ${escapedMsg} |\n`;
    }
    body += '\n';

    for (const t of tests) {
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
    const prNumber = context.payload.pull_request.number;

    // Find existing comment
    const {data: comments} = await github.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
    });
    const existing = comments.find(c => c.body?.includes(COMMENT_MARKER));

    if (failures.length === 0) {
      core.info('No test failures found.');
      if (existing) {
        await github.rest.issues.deleteComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: existing.id,
        });
        core.info('Deleted previous failure comment.');
      }
      return;
    }

    const body = buildCommentBody(failures);

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
