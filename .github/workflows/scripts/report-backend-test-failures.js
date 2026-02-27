import {readFileSync} from 'node:fs';
import {basename, dirname} from 'node:path';

const MAX_FAILURES = 30;
const MAX_TRACEBACK_LINES = 50;
export const COMMENT_MARKER = '<!-- BACKEND_TEST_FAILURES -->';

export function commitMarker(sha) {
  return `<!-- BACKEND_TEST_FAILURES_COMMIT:${sha} -->`;
}

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

    const artifactDir = basename(dirname(file));

    for (const test of data.tests) {
      if (test.outcome !== 'failed') {
        continue;
      }

      const nodeid = test.nodeid || 'unknown';
      const call = test.call || test.setup || test.teardown || {};
      const longrepr = call.longrepr || '';

      failures.push({nodeid, longrepr, artifactDir});
    }
  }

  return failures;
}

async function getJobUrls(failures, github, context) {
  const dirToUrl = {};
  const uniqueDirs = [...new Set(failures.map(f => f.artifactDir))];
  if (uniqueDirs.length === 0) return dirToUrl;

  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId,
  });

  for (const dir of uniqueDirs) {
    // pytest-results-backend-{runId}-{N} → "backend-test (N)"
    const backendMatch = dir.match(/^pytest-results-backend-\d+-(\d+)$/);
    if (backendMatch) {
      const shard = parseInt(backendMatch[1], 10);
      const job = jobs.find(j => {
        const m = j.name.match(/^backend test \((\d+)\)$/);
        return m && parseInt(m[1], 10) === shard;
      });
      if (job) dirToUrl[dir] = job.html_url;
      continue;
    }
    // pytest-results-migration-{runId} → "backend-migration-tests"
    if (/^pytest-results-migration-\d+$/.test(dir)) {
      const job = jobs.find(j => j.name.includes('backend migration tests'));
      if (job) dirToUrl[dir] = job.html_url;
      continue;
    }
    // pytest-results-monolith-dbs-{runId} → "monolith-dbs"
    if (/^pytest-results-monolith-dbs-\d+$/.test(dir)) {
      const job = jobs.find(j => j.name.includes('monolith-dbs test'));
      if (job) dirToUrl[dir] = job.html_url;
    }
  }
  return dirToUrl;
}

// Returns the set of test nodeids already present in a comment body.
export function extractNodeids(body) {
  if (!body) return new Set();
  return new Set([...body.matchAll(/<code>([^<]+)<\/code>/g)].map(m => m[1]));
}

// Renders <details> blocks for each failure (no header).
export function buildFailureBlocks(failures) {
  let blocks = '';
  for (const t of failures) {
    let tb = t.longrepr;
    if (tb) {
      const lines = tb.split('\n');
      if (lines.length > MAX_TRACEBACK_LINES) {
        tb =
          lines.slice(0, MAX_TRACEBACK_LINES).join('\n') +
          `\n... (${lines.length - MAX_TRACEBACK_LINES} more lines)`;
      }
    }
    const logLink = t.jobUrl ? ` — <a href="${t.jobUrl}">log</a>` : '';
    blocks += `<details><summary><code>${t.nodeid}</code>${logLink}</summary>\n\n`;
    blocks += `\`\`\`\n${tb || 'No traceback available'}\n\`\`\`\n\n</details>\n\n`;
  }
  return blocks;
}

// Builds a full comment body (header + blocks). Used when creating a new comment.
export function buildCommentBody(failures, {runUrl, sha, repoUrl}) {
  const capped = failures.slice(0, MAX_FAILURES);
  const shortSha = sha.slice(0, 7);
  const commitUrl = `${repoUrl}/commit/${sha}`;

  let body = `${COMMENT_MARKER}\n${commitMarker(sha)}\n## Backend Test Failures\n\nFailures on [\`${shortSha}\`](${commitUrl}) in [this run](${runUrl}):\n\n`;
  body += buildFailureBlocks(capped);

  if (failures.length > MAX_FAILURES) {
    body += `... and ${failures.length - MAX_FAILURES} more failures.\n`;
  }

  if (body.length > 65000) {
    body =
      body.slice(0, 64900) + '\n\n... (truncated due to GitHub comment size limit)\n';
  }

  return body;
}

// Called from within each test shard. Reads the shard's own pytest.json from the
// filesystem, appends any new failures to the PR comment, creating it if needed.
export async function reportShard({github, context, core}) {
  const jsonPath = process.env.PYTEST_JSON_PATH;
  const artifactDir = process.env.PYTEST_ARTIFACT_DIR;

  if (!jsonPath) {
    core.warning('PYTEST_JSON_PATH not set — skipping.');
    return;
  }

  const rawFailures = parseFailures([jsonPath], core);
  if (rawFailures.length === 0) {
    core.info('No failures in this shard — skipping.');
    return;
  }

  // Use the artifact dir name (passed via env) so getJobUrls can match this shard's job.
  const shardFailures = artifactDir
    ? rawFailures.map(f => ({...f, artifactDir}))
    : rawFailures;

  let jobUrls = {};
  try {
    jobUrls = await getJobUrls(shardFailures, github, context);
  } catch (e) {
    core.warning(`Could not fetch job URLs: ${e.message}`);
  }
  const failures = shardFailures.map(f => ({...f, jobUrl: jobUrls[f.artifactDir]}));

  const prNumber = context.payload.pull_request.number;
  const sha = context.sha;
  const marker = commitMarker(sha);

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
  });
  // Only match comments for the same commit — a new push gets a fresh comment.
  const existing = comments.find(c => c.body?.includes(marker));

  // Append-only: skip failures whose nodeid is already in the comment.
  const seen = extractNodeids(existing?.body);
  const newFailures = failures.filter(f => !seen.has(f.nodeid)).slice(0, MAX_FAILURES);

  if (newFailures.length === 0) {
    core.info('All failures already reported — skipping.');
    return;
  }

  const newBlocks = buildFailureBlocks(newFailures);

  if (existing) {
    let body = existing.body + newBlocks;
    if (body.length > 65000) {
      body =
        body.slice(0, 64900) + '\n\n... (truncated due to GitHub comment size limit)\n';
    }
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    });
    core.info(`Appended ${newFailures.length} failure(s) to comment.`);
  } else {
    const repoUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}`;
    const runUrl = `${repoUrl}/actions/runs/${context.runId}`;
    const body = buildCommentBody(failures, {runUrl, sha, repoUrl});
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body,
    });
    core.info(
      `Created failure comment with ${Math.min(failures.length, MAX_FAILURES)} failure(s).`
    );
  }
}
