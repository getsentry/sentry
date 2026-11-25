/**
 * Posts, updates, or deletes one PR comment listing the new API findings that
 * `tools.api_guidelines.check_new` wrote to its findings file, or saying the
 * check couldn't run.
 *
 * Run with `node` from the lint job in `.github/workflows/pre-commit.yml`,
 * after the step that writes the file.
 */
import {readFileSync} from 'node:fs';

import {context as actionsContext, getOctokit} from '@actions/github';

interface Finding {
  path: string;
  line: number;
  rule: string;
  summary: string;
}

interface SyncArgs {
  github: ReturnType<typeof getOctokit>;
  context: typeof actionsContext;
  findingsPath: string;
  checkFailed: boolean;
}

const NEW_API_FINDINGS_MARKER = '<!-- NEW_API_FINDINGS -->';

// keeps the comment well under githubs character limit since a renamed file's
// findings all show as new
const MAX_LISTED = 50;

/**
 * The findings the check wrote. The check doesn't write the file when it had
 * nothing to scan, which means there's nothing to report.
 */
function readFindings(findingsPath: string): Finding[] {
  let raw: string;
  try {
    raw = readFileSync(findingsPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  return JSON.parse(raw) as Finding[];
}

function findingsBody(
  findings: Finding[],
  owner: string,
  repo: string,
  sha: string,
  runUrl: string
): string {
  const lines = findings
    .slice(0, MAX_LISTED)
    .map(
      finding =>
        `- [${finding.path}:${finding.line}](https://github.com/${owner}/${repo}/blob/${sha}/${finding.path}#L${finding.line}) ${finding.rule} ${finding.summary}`
    );
  const count =
    findings.length === 1
      ? "1 API finding in this PR's changed files isn't"
      : `${findings.length} API findings in this PR's changed files aren't`;
  if (findings.length > MAX_LISTED) {
    lines.push(`- and ${findings.length - MAX_LISTED} more, see [the run](${runUrl})`);
  }
  return [
    NEW_API_FINDINGS_MARKER,
    '## New API findings',
    '',
    `${count} in \`api_exceptions/exceptions.json\`. This check is report-only, so it doesn't block merging.`,
    '',
    ...lines,
    '',
    "If one is intentional, mark it with `# api-exception: <rule> <status> - <reason>` (this doesn't silence it yet).",
  ].join('\n');
}

function failedBody(runUrl: string): string {
  return [
    NEW_API_FINDINGS_MARKER,
    '## New API findings',
    '',
    `Couldn't run the API findings check, see [the run](${runUrl}).`,
  ].join('\n');
}

export async function syncNewApiFindingsComment({
  github,
  context,
  findingsPath,
  checkFailed,
}: SyncArgs): Promise<void> {
  const {owner, repo} = context.repo;
  const pr = context.payload.pull_request!;

  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;

  let body: string | null = null;
  if (checkFailed) {
    body = failedBody(runUrl);
  } else {
    const findings = readFindings(findingsPath);
    if (findings.length > 0) {
      body = findingsBody(findings, owner, repo, pr.head.sha, runUrl);
    }
  }

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pr.number,
  });
  const existing = comments.find(comment =>
    comment.body?.includes(NEW_API_FINDINGS_MARKER)
  );

  if (body === null) {
    if (existing) {
      await github.rest.issues.deleteComment({owner, repo, comment_id: existing.id});
      console.log(`Deleted the new API findings comment on #${pr.number}.`);
    } else {
      console.log('No new API findings.');
    }
    return;
  }

  if (existing) {
    await github.rest.issues.updateComment({owner, repo, comment_id: existing.id, body});
    console.log(`Updated the new API findings comment on #${pr.number}.`);
  } else {
    await github.rest.issues.createComment({owner, repo, issue_number: pr.number, body});
    console.log(`Posted the new API findings comment on #${pr.number}.`);
  }
}

// only when run with `node`, so the tests can import the function without posting anything
if (import.meta.main) {
  await syncNewApiFindingsComment({
    github: getOctokit(process.env.GITHUB_TOKEN!),
    context: actionsContext,
    findingsPath: process.env.NEW_API_FINDINGS_PATH!,
    checkFailed: process.env.CHECK_OUTCOME === 'failure',
  });
}
