/**
 * Publishes the scan job's exceptions.json as a bot PR when its entries changed.
 *
 * Invoked from `.github/workflows/refresh-api-baseline.yml` via
 * actions/github-script with the internal bot's token. The commit is made with
 * the Git Data API rather than `git push`, so there is no local git identity to
 * set up and GitHub signs the commit as the bot.
 */
import {readFileSync} from 'node:fs';

export const BASELINE_PATH = 'api_exceptions/exceptions.json';
export const BRANCH = 'bot/update-api-baseline';
export const BASE_BRANCH = 'master';
export const TITLE = 'chore(apidocs): Update the API exceptions baseline';

const BODY = `Daily refresh of \`api_exceptions/exceptions.json\`, from \`make api-baseline ARGS="--update"\` on master. Reviewed \`status\` and \`reason\` values are kept.

How to read the diff:

- **Removed entry:** the violation was fixed
- **New entry:** a violation added since the last refresh. If a file was renamed, its entries show up as new - the scan job's log prints a "Possibly moved" warning for those
- **Changed \`count\`:** more or fewer findings with the same rule, path, scope, and key
- **Changed \`owner\`:** the endpoint moved to another team
- **\`generated\` and \`commit\`** change on every run, ignore them

New entries get the reason "new since the baseline". They're tracked for now, and new violations will be blocked at the PR later, so merging this doesn't mean they're accepted for good.

Merging this updates the report card`;

interface Baseline {
  entries: unknown[];
  version: number;
}

interface Repo {
  owner: string;
  repo: string;
}

/**
 * The subset of the actions/github-script arguments we depend on. Typed locally
 * because @actions/github is not a repo dependency.
 */
export interface PublishArgs {
  context: {repo: Repo; sha: string};
  core: {info: (message: string) => void};
  github: {
    rest: {
      git: {
        createCommit: (
          params: Repo & {message: string; parents: string[]; tree: string}
        ) => Promise<{data: {sha: string}}>;
        createRef: (params: Repo & {ref: string; sha: string}) => Promise<unknown>;
        createTree: (
          params: Repo & {
            base_tree: string;
            tree: Array<{content: string; mode: '100644'; path: string; type: 'blob'}>;
          }
        ) => Promise<{data: {sha: string}}>;
        getCommit: (
          params: Repo & {commit_sha: string}
        ) => Promise<{data: {tree: {sha: string}}}>;
        updateRef: (
          params: Repo & {force: boolean; ref: string; sha: string}
        ) => Promise<unknown>;
      };
      pulls: {
        create: (
          params: Repo & {base: string; body: string; head: string; title: string}
        ) => Promise<{data: {number: number}}>;
        list: (
          params: Repo & {base: string; head: string; state: 'open'}
        ) => Promise<{data: Array<{number: number}>}>;
      };
    };
  };
  newBaselinePath: string;
  currentBaselinePath?: string;
}

export function parseBaseline(text: string, source: string): Baseline {
  const data: unknown = JSON.parse(text);
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as Baseline).version !== 'number' ||
    !Array.isArray((data as Baseline).entries)
  ) {
    throw new Error(
      `${source} is not an exceptions file (needs a number version and an entries array)`
    );
  }
  return data as Baseline;
}

/** JSON with object keys sorted, so key order alone doesn't count as a change. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map(
        key =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

// `generated` and `commit` change on every run, so only the entries decide
// whether there is anything to publish.
function entriesChanged(current: Baseline, next: Baseline): boolean {
  return canonicalJson(current.entries) !== canonicalJson(next.entries);
}

async function forceUpdateBranch(
  github: PublishArgs['github'],
  repo: Repo,
  sha: string
): Promise<void> {
  try {
    await github.rest.git.updateRef({...repo, ref: `heads/${BRANCH}`, sha, force: true});
  } catch (error) {
    // 422 is what GitHub returns when the ref doesn't exist yet
    if ((error as {status?: number}).status !== 422) {
      throw error;
    }
    await github.rest.git.createRef({...repo, ref: `refs/heads/${BRANCH}`, sha});
  }
}

export async function publishApiBaseline({
  github,
  context,
  core,
  newBaselinePath,
  currentBaselinePath = BASELINE_PATH,
}: PublishArgs): Promise<void> {
  const newText = readFileSync(newBaselinePath, 'utf8');
  const next = parseBaseline(newText, newBaselinePath);
  const current = parseBaseline(
    readFileSync(currentBaselinePath, 'utf8'),
    currentBaselinePath
  );
  if (!entriesChanged(current, next)) {
    core.info('entries unchanged, nothing to publish');
    return;
  }

  const repo = context.repo;
  const {data: parent} = await github.rest.git.getCommit({
    ...repo,
    commit_sha: context.sha,
  });
  const {data: tree} = await github.rest.git.createTree({
    ...repo,
    base_tree: parent.tree.sha,
    tree: [{path: BASELINE_PATH, mode: '100644', type: 'blob', content: newText}],
  });
  const {data: commit} = await github.rest.git.createCommit({
    ...repo,
    message: TITLE,
    tree: tree.sha,
    parents: [context.sha],
  });
  await forceUpdateBranch(github, repo, commit.sha);
  core.info(`pushed ${commit.sha} to ${BRANCH}`);

  // the force-update above already updated an open PR, so only open one when there isn't
  const {data: open} = await github.rest.pulls.list({
    ...repo,
    state: 'open',
    base: BASE_BRANCH,
    head: `${repo.owner}:${BRANCH}`,
  });
  if (open.length > 0) {
    core.info(`updated #${open[0]!.number}`);
    return;
  }
  const {data: pr} = await github.rest.pulls.create({
    ...repo,
    base: BASE_BRANCH,
    head: BRANCH,
    title: TITLE,
    body: BODY,
  });
  core.info(`opened #${pr.number}`);
}
