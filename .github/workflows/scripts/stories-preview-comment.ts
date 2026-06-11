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

  const segments = filesystemPath.split('/');
  segments.shift(); // drop the leading `app`
  segments.pop(); // drop the filename
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

  const stories = files
    .filter(file => file.status !== 'removed')
    .filter(file => STORY_FILE_RE.test(file.filename))
    .map(file => file.filename)
    .sort();

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
      core.info('No changed stories (*.stories.tsx / *.mdx) files, skipping.');
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
