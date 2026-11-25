/**
 * Posts, updates, or deletes one PR comment listing the new API findings that
 * `tools.api_guidelines.check_new` wrote to its findings file, or saying the
 * check couldn't run.
 *
 * Invoked from the lint job in `.github/workflows/pre-commit.yml` via
 * actions/github-script, after the step that writes the file.
 */
import {readFileSync} from 'node:fs';

interface Finding {
  path: string;
  line: number;
  rule: string;
  summary: string;
}

interface IssueComment {
  id: number;
  body?: string;
}

/**
 * The subset of the actions/github-script context we use, typed locally
 * because @actions/github isn't a repo dependency.
 */
interface SyncArgs {
  github: {
    rest: {
      issues: {
        listComments: unknown;
        createComment: (params: {
          owner: string;
          repo: string;
          issue_number: number;
          body: string;
        }) => Promise<unknown>;
        updateComment: (params: {
          owner: string;
          repo: string;
          comment_id: number;
          body: string;
        }) => Promise<unknown>;
        deleteComment: (params: {
          owner: string;
          repo: string;
          comment_id: number;
        }) => Promise<unknown>;
      };
    };
    paginate: <T>(route: unknown, params: Record<string, unknown>) => Promise<T[]>;
  };
  context: {
    repo: {owner: string; repo: string};
    serverUrl: string;
    runId: number;
    payload: {pull_request: {number: number; head: {sha: string}}};
  };
  core: {info: (message: string) => void};
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
  core,
  findingsPath,
  checkFailed,
}: SyncArgs): Promise<void> {
  const {owner, repo} = context.repo;
  const pr = context.payload.pull_request;

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

  const comments = await github.paginate<IssueComment>(github.rest.issues.listComments, {
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
      core.info(`Deleted the new API findings comment on #${pr.number}.`);
    } else {
      core.info('No new API findings.');
    }
    return;
  }

  if (existing) {
    await github.rest.issues.updateComment({owner, repo, comment_id: existing.id, body});
    core.info(`Updated the new API findings comment on #${pr.number}.`);
  } else {
    await github.rest.issues.createComment({owner, repo, issue_number: pr.number, body});
    core.info(`Posted the new API findings comment on #${pr.number}.`);
  }
}
