import {readFileSync} from 'node:fs';
import {basename, dirname} from 'node:path';

const MAX_FAILURES = 30;
const MAX_TRACEBACK_LINES = 50;
const MAX_BODY_LENGTH = 65_000;
export const COMMENT_MARKER = '<!-- BACKEND_TEST_FAILURES -->';

export const commitMarker = sha => `<!-- BACKEND_TEST_FAILURES_COMMIT:${sha} -->`;

export function parseFailures(files, core) {
  return files.flatMap(file => {
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      core.warning(`Skipping ${file}: ${e.message}`);
      return [];
    }
    if (!Array.isArray(data.tests)) return [];

    const artifactDir = basename(dirname(file));
    return data.tests
      .filter(t => t.outcome === 'failed')
      .map(t => ({
        nodeid: t.nodeid ?? 'unknown',
        longrepr: (t.call ?? t.setup ?? t.teardown ?? {}).longrepr ?? '',
        artifactDir,
      }));
  });
}

// Maps artifact directory names to GitHub Actions job log URLs.
const JOB_MATCHERS = [
  {
    // pytest-results-backend-{runId}-{N} → "backend test (N)"
    dir: /^pytest-results-backend-\d+-(?<shard>\d+)$/,
    job: (jobs, {shard}) =>
      jobs.find(j => j.name.match(/^backend test \((\d+)\)$/)?.[1] === shard),
  },
  {
    // pytest-results-migration-{runId} → "backend migration tests"
    dir: /^pytest-results-migration-\d+$/,
    job: jobs => jobs.find(j => j.name.includes('backend migration tests')),
  },
  {
    // pytest-results-monolith-dbs-{runId} → "monolith-dbs test"
    dir: /^pytest-results-monolith-dbs-\d+$/,
    job: jobs => jobs.find(j => j.name.includes('monolith-dbs test')),
  },
];

async function getJobUrls(failures, github, context) {
  const uniqueDirs = [...new Set(failures.map(f => f.artifactDir))];
  if (uniqueDirs.length === 0) return {};

  const {owner, repo} = context.repo;
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
    owner,
    repo,
    run_id: context.runId,
  });

  const findJobUrl = dir => {
    for (const {dir: pattern, job: findJob} of JOB_MATCHERS) {
      const m = dir.match(pattern);
      if (m) return findJob(jobs, m.groups ?? {})?.html_url;
    }
    return undefined;
  };

  return Object.fromEntries(
    uniqueDirs.map(dir => [dir, findJobUrl(dir)]).filter(([, url]) => url)
  );
}

// Returns the set of test nodeids already present in a comment body.
export function extractNodeids(body) {
  if (!body) return new Set();
  // Iterator.prototype.map() — available since Node 22.
  return new Set(body.matchAll(/<code>([^<]+)<\/code>/g).map(m => m[1]));
}

function truncateBody(body) {
  if (body.length <= MAX_BODY_LENGTH) return body;
  return (
    body.slice(0, MAX_BODY_LENGTH - 100) +
    '\n\n... (truncated due to GitHub comment size limit)\n'
  );
}

// Renders <details> blocks for each failure (no header).
export function buildFailureBlocks(failures) {
  return failures
    .map(({nodeid, longrepr, jobUrl}) => {
      let tb = longrepr;
      if (tb) {
        const lines = tb.split('\n');
        if (lines.length > MAX_TRACEBACK_LINES) {
          tb =
            lines.slice(0, MAX_TRACEBACK_LINES).join('\n') +
            `\n... (${lines.length - MAX_TRACEBACK_LINES} more lines)`;
        }
      }
      const logLink = jobUrl ? ` — <a href="${jobUrl}">log</a>` : '';
      return (
        `<details><summary><code>${nodeid}</code>${logLink}</summary>\n\n` +
        `\`\`\`\n${tb || 'No traceback available'}\n\`\`\`\n\n</details>\n\n`
      );
    })
    .join('');
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

  return truncateBody(body);
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

  const {owner, repo} = context.repo;
  const prNumber = context.payload.pull_request.number;
  const {sha} = context;
  const marker = commitMarker(sha);

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
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

  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: truncateBody(existing.body + buildFailureBlocks(newFailures)),
    });
    core.info(`Appended ${newFailures.length} failure(s) to comment.`);
  } else {
    const repoUrl = `https://github.com/${owner}/${repo}`;
    const runUrl = `${repoUrl}/actions/runs/${context.runId}`;
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: buildCommentBody(failures, {runUrl, sha, repoUrl}),
    });
    core.info(
      `Created failure comment with ${Math.min(failures.length, MAX_FAILURES)} failure(s).`
    );
  }
}
