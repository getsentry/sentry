/**
 * Posts, updates, or deletes a PR comment linking to the stories changed in a
 * PR on its Vercel preview deployment.
 *
 * Invoked from `.github/workflows/stories-preview.yml` via actions/github-script
 * on the `deployment_status` event. Owns the whole comment lifecycle through the
 * GitHub API so the workflow is a single step and the marker stays defined once.
 *
 * The slug/category helpers below are mirrored from
 * `static/app/stories/view/storyTree.tsx` so the generated links resolve to the
 * same semantic `/stories/<category>/<slug>/` route the app builds for a story.
 * Keep them in sync if that file's slug/category logic changes. The routing
 * category/slug is purely path-based for both `.stories.tsx` and `.mdx`;
 * frontmatter only affects the core sidebar subcategory, which does not change
 * the URL, so it is not needed here.
 */

type StoryCategory = 'principles' | 'patterns' | 'core' | 'product';

interface PullRequestFile {
  filename: string;
  status: string;
}

interface IssueComment {
  id: number;
  body?: string;
}

/**
 * The subset of the actions/github-script context we depend on. Typed locally
 * because @actions/github is not a repo dependency; the github-script runtime
 * supplies the full Octokit client and event context.
 */
interface SyncArgs {
  github: {
    rest: {
      repos: {
        listPullRequestsAssociatedWithCommit: (params: {
          owner: string;
          repo: string;
          commit_sha: string;
        }) => Promise<{
          data: Array<{number: number; state: string; head: {sha: string}}>;
        }>;
        getContent: (params: {
          owner: string;
          repo: string;
          path: string;
          ref: string;
        }) => Promise<{data: unknown}>;
      };
      pulls: {listFiles: unknown};
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
    payload: {
      deployment: {sha: string};
      deployment_status: {environment_url?: string; target_url?: string};
    };
  };
  core: {info: (message: string) => void};
}

// Invisible HTML marker that identifies our comment so we can find and update or
// delete it on subsequent deploys.
export const STORIES_COMMENT_MARKER = '<!-- STORIES_PREVIEW -->';

// The stories loader globs both *.stories.tsx and *.mdx under static/app
// (static/app/stories/view/useStoriesLoader.tsx).
const STORY_FILE_RE = /^static\/app\/.*(\.stories\.tsx|\.mdx)$/;

// A component source file (not a story, test, or spec) whose edit should also
// surface its colocated story, if one exists.
function isComponentFile(path: string): boolean {
  return (
    /^static\/app\/.*\.tsx$/.test(path) &&
    !/\.stories\.tsx$/.test(path) &&
    !/\.(spec|test)\.tsx$/.test(path)
  );
}

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

// Strip the story extension to get the base a story is named for, e.g.
// `button.stories.tsx` -> `button`, `disclosure.mdx` -> `disclosure`.
function storyBaseName(name: string): string {
  return name.replace(/(\.stories)?\.(tsx|mdx)$/, '');
}

// `deployment_status` can be forged by any actor with `deployments` scope, who
// could supply an arbitrary `environment_url` and have us post a link to it on a
// real PR. Only trust HTTPS preview URLs on our known deploy domains.
const ALLOWED_PREVIEW_HOST_SUFFIXES = ['.sentry.dev', '.vercel.app'];

function isTrustedPreviewUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') {
    return false;
  }
  return ALLOWED_PREVIEW_HOST_SUFFIXES.some(suffix => parsed.hostname.endsWith(suffix));
}

// Mirror of inferComponentName (storyTree.tsx).
function inferComponentName(path: string): string {
  const parts = path.split('/');
  let part = parts.pop();
  while (part?.startsWith('index.')) {
    part = parts.pop();
  }
  return (part ?? '').replace(/\.(stories\.tsx|mdx)$/, '');
}

// Mirror of formatName (storyTree.tsx).
function formatName(name: string): string {
  return name
    .split('-')
    .map(word =>
      word === 'and' || word === 'or'
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

// Mirror of normalizeFilename (storyTree.tsx).
function normalizeFilename(filename: string): string {
  if (filename.startsWith('use')) {
    return filename.replace('.stories.tsx', '');
  }
  return (
    filename.charAt(0).toUpperCase() +
    filename.slice(1).replace('.stories.tsx', '').replace('.mdx', '')
  );
}

// Mirror of inferFileCategory (storyTree.tsx).
function inferFileCategory(path: string): StoryCategory {
  if (
    path.includes('app/styles') ||
    path.includes('app/icons') ||
    path.includes('components/core/principles')
  ) {
    return 'principles';
  }
  if (path.includes('components/core/patterns')) {
    return 'patterns';
  }
  if (path.includes('components/core')) {
    return 'core';
  }
  return 'product';
}

/**
 * Maps a story's filesystem path (in `app/...` form, i.e. with `static/`
 * stripped) to its `<category>/<slug>` route, mirroring the StoryTreeNode
 * constructor (storyTree.tsx).
 */
export function storyRoute(filesystemPath: string): string {
  const label = normalizeFilename(formatName(inferComponentName(filesystemPath)));
  const labelSlug = label.replaceAll(' ', '-').toLowerCase();
  const category = inferFileCategory(filesystemPath);

  if (category !== 'product') {
    return `${category}/${labelSlug}`;
  }

  const segments = filesystemPath.split('/').slice(1, -1); // drop `app` and filename
  const pathPrefix =
    segments.length > 0
      ? `${segments.map(segment => segment.toLowerCase()).join('/')}/`
      : '';
  return `${category}/${pathPrefix}${labelSlug}`;
}

// encodeURIComponent leaves parens unescaped, but `)` closes a markdown link,
// so encode them explicitly.
function encodeRouteSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[()]/g, char =>
    char === '(' ? '%28' : '%29'
  );
}

function buildCommentBody(stories: string[], previewUrl: string): string {
  const links = stories
    .map(file => {
      // The stories loader keys files as `app/...` (static/ stripped).
      const filesystemPath = file.replace(/^static\//, '');
      // Percent-encode each route segment so a path can't inject markdown link
      // syntax (e.g. `)`) into the URL and forge an attacker-controlled link.
      const route = storyRoute(filesystemPath)
        .split('/')
        .map(encodeRouteSegment)
        .join('/');
      const url = `${previewUrl}/stories/${route}/`;
      // Escape backslashes and brackets so a path can't break out of the label.
      const label = filesystemPath.replace(/[\\[\]]/g, '\\$&');
      return `- [${label}](${url})`;
    })
    .join('\n');

  return [
    STORIES_COMMENT_MARKER,
    '## Story previews',
    '',
    'Preview the stories changed in this PR on the Vercel deployment:',
    '',
    links,
    '',
    `<sub>Preview deployment: ${previewUrl}</sub>`,
  ].join('\n');
}

async function listDirectory(
  github: SyncArgs['github'],
  owner: string,
  repo: string,
  ref: string,
  path: string
): Promise<Array<{name: string; path: string}>> {
  try {
    const {data} = await github.rest.repos.getContent({owner, repo, path, ref});
    return Array.isArray(data) ? (data as Array<{name: string; path: string}>) : [];
  } catch {
    // Directory missing at this ref (e.g. newly added elsewhere) — nothing to find.
    return [];
  }
}

// For each edited component file, find colocated story files (in the same
// directory at the deployed commit) whose base name matches the component's own
// base name or its directory name. This surfaces a component's story even when
// the PR only edited the component and not the story itself.
async function findAssociatedStories(
  github: SyncArgs['github'],
  owner: string,
  repo: string,
  ref: string,
  componentPaths: string[]
): Promise<string[]> {
  const uniqueDirs = [...new Set(componentPaths.map(dirOf))];
  const entriesByDir = new Map(
    await Promise.all(
      uniqueDirs.map(
        async dir => [dir, await listDirectory(github, owner, repo, ref, dir)] as const
      )
    )
  );

  const matches = componentPaths.flatMap(path => {
    const fileBase = baseName(path).replace(/\.tsx$/, '');
    const dirBase = baseName(dirOf(path));
    return (entriesByDir.get(dirOf(path)) ?? [])
      .filter(entry => STORY_FILE_RE.test(entry.path))
      .filter(entry => [fileBase, dirBase].includes(storyBaseName(entry.name)))
      .map(entry => entry.path);
  });

  return [...new Set(matches)];
}

export async function syncStoriesPreviewComment({
  github,
  context,
  core,
}: SyncArgs): Promise<void> {
  const {owner, repo} = context.repo;
  const sha = context.payload.deployment.sha;
  const previewUrl = (
    context.payload.deployment_status.environment_url ||
    context.payload.deployment_status.target_url ||
    ''
  ).replace(/\/$/, '');

  if (!previewUrl) {
    core.info('No preview URL in deployment_status payload, skipping.');
    return;
  }

  if (!isTrustedPreviewUrl(previewUrl)) {
    core.info(`Preview URL is not a trusted deploy host (${previewUrl}), skipping.`);
    return;
  }

  const {data: prs} = await github.rest.repos.listPullRequestsAssociatedWithCommit({
    owner,
    repo,
    commit_sha: sha,
  });

  // A commit can be associated with several open PRs (they share history), so
  // select the one whose head is exactly the deployed commit. That is the PR
  // this preview belongs to, and it also ignores delayed/out-of-order deploys
  // of an older commit.
  const pr = prs.find(
    candidate => candidate.state === 'open' && candidate.head.sha === sha
  );
  if (!pr) {
    core.info(`No open PR with head ${sha}, skipping.`);
    return;
  }

  const files = await github.paginate<PullRequestFile>(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pr.number,
    per_page: 100,
  });

  const changed = files
    .filter(file => file.status !== 'removed')
    .map(file => file.filename);

  const directStories = changed.filter(file => STORY_FILE_RE.test(file));
  const associatedStories = await findAssociatedStories(
    github,
    owner,
    repo,
    sha,
    changed.filter(isComponentFile)
  );
  const stories = [...new Set([...directStories, ...associatedStories])].sort();

  const comments = await github.paginate<IssueComment>(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pr.number,
  });
  const existing = comments.find(comment =>
    comment.body?.includes(STORIES_COMMENT_MARKER)
  );

  if (stories.length === 0) {
    if (existing) {
      // The PR previously changed stories but no longer does; drop the stale links.
      await github.rest.issues.deleteComment({owner, repo, comment_id: existing.id});
      core.info(`Deleted stale stories preview comment on #${pr.number}.`);
    } else {
      core.info('No changed or associated stories, skipping.');
    }
    return;
  }

  const body = buildCommentBody(stories, previewUrl);

  if (existing) {
    await github.rest.issues.updateComment({owner, repo, comment_id: existing.id, body});
    core.info(`Updated stories preview comment on #${pr.number}.`);
  } else {
    await github.rest.issues.createComment({owner, repo, issue_number: pr.number, body});
    core.info(`Posted stories preview comment on #${pr.number}.`);
  }
}
