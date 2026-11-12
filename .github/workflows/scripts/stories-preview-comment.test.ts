import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {storyRoute, syncStoriesPreviewComment} from './stories-preview-comment.ts';

// These expectations pin storyRoute to the slug/category logic it mirrors in
// static/app/stories/view/storyTree.tsx. If that file's routing logic changes,
// these will fail and the mirror must be re-synced (otherwise preview links
// 404). Note camelCase names are only lowercased, not hyphenated, because
// formatName only splits on existing hyphens.
describe('storyRoute', () => {
  const cases: Array<[string, string]> = [
    // principles: app/styles, app/icons, components/core/principles
    ['app/styles/colors.mdx', 'principles/colors'],
    ['app/icons/iconAdd.stories.tsx', 'principles/iconadd'],
    ['app/components/core/principles/spacing.mdx', 'principles/spacing'],
    // patterns: components/core/patterns (hyphenated name stays hyphenated)
    ['app/components/core/patterns/render-to-html.mdx', 'patterns/render-to-html'],
    // core: components/core (no nesting in the slug)
    ['app/components/core/button/button.stories.tsx', 'core/button'],
    // core: Scraps package docs keep the same flat core slug
    ['packages/scraps/src/button/button.mdx', 'core/button'],
    ['packages/scraps/src/button/linkButton.mdx', 'core/linkbutton'],
    ['packages/scraps/src/slideOverPanel.mdx', 'core/slideoverpanel'],
    // product: nested dir segments are lowercased into the slug
    [
      'app/views/dashboards/widgetCard.stories.tsx',
      'product/views/dashboards/widgetcard',
    ],
    [
      'app/components/connectRepository/pathMapping.stories.tsx',
      'product/components/connectrepository/pathmapping',
    ],
    // index.* files resolve to their containing directory's name
    [
      'app/components/connectRepository/index.stories.tsx',
      'product/components/connectrepository/connectrepository',
    ],
    // use* hooks are lowercased like any other name
    ['app/utils/useFoo.stories.tsx', 'product/utils/usefoo'],
    // gsApp stories nest like product stories under their own category
    [
      'gsApp/components/upsellModal/upsellModal.stories.tsx',
      'gsApp/components/upsellmodal/upsellmodal',
    ],
    // gsApp's components/core is not the design system
    ['gsApp/components/core/foo.stories.tsx', 'gsApp/components/core/foo'],
  ];

  for (const [filesystemPath, expected] of cases) {
    it(`maps ${filesystemPath} -> ${expected}`, () => {
      assert.equal(storyRoute(filesystemPath), expected);
    });
  }
});

interface CommentCall {
  body?: string;
  comment_id?: number;
  issue_number?: number;
}

interface Scenario {
  prs?: Array<{number: number; state: string; head?: {sha: string}}>;
  files?: Array<{filename: string; status: string}>;
  comments?: Array<{id: number; body: string}>;
  dirContents?: Record<string, Array<{name: string; path: string}>>;
  url?: string;
}

// The default open PR's head matches the deploy sha set in `run`, so the
// out-of-order-deploy guard passes unless a scenario overrides it.
const DEPLOY_SHA = 'deadbeef';

// Fakes the one external boundary (the github-script client) so we can assert
// the comment lifecycle effects: create, update, delete, or nothing at all.
function run({
  prs = [{number: 42, state: 'open', head: {sha: DEPLOY_SHA}}],
  files = [],
  comments = [],
  dirContents = {},
  url = 'https://sentry-abc.sentry.dev',
}: Scenario) {
  const calls = {
    create: [] as CommentCall[],
    update: [] as CommentCall[],
    delete: [] as CommentCall[],
  };
  const core = {info: () => {}};
  const github = {
    rest: {
      repos: {
        listPullRequestsAssociatedWithCommit: async () => ({data: prs}),
        getContent: async ({path}: {path: string}) => {
          const entries = dirContents[path];
          if (!entries) {
            throw new Error('Not Found');
          }
          return {data: entries};
        },
      },
      pulls: {listFiles: 'listFiles'},
      issues: {
        listComments: 'listComments',
        createComment: async (params: CommentCall) => {
          calls.create.push(params);
        },
        updateComment: async (params: CommentCall) => {
          calls.update.push(params);
        },
        deleteComment: async (params: CommentCall) => {
          calls.delete.push(params);
        },
      },
    },
    paginate: async (route: unknown) => (route === 'listComments' ? comments : files),
  };
  const context = {
    repo: {owner: 'getsentry', repo: 'sentry'},
    payload: {deployment: {sha: DEPLOY_SHA}, deployment_status: {environment_url: url}},
  };

  return syncStoriesPreviewComment({github, context, core} as any).then(() => calls);
}

const storyFile = {
  filename: 'static/app/components/foo/foo.stories.tsx',
  status: 'modified',
};
const marked = {id: 99, body: '<!-- STORIES_PREVIEW -->\nold'};

describe('syncStoriesPreviewComment', () => {
  it('creates a comment when stories changed and none exists', async () => {
    const calls = await run({files: [storyFile]});
    assert.equal(calls.create.length, 1);
    assert.match(calls.create[0].body!, /<!-- STORIES_PREVIEW -->/);
    assert.match(calls.create[0].body!, /stories\/product\/components\/foo\/foo\//);
    assert.equal(calls.update.length, 0);
    assert.equal(calls.delete.length, 0);
  });

  it('updates the existing comment when stories changed', async () => {
    const calls = await run({files: [storyFile], comments: [marked]});
    assert.equal(calls.update.length, 1);
    assert.equal(calls.update[0].comment_id, 99);
    assert.equal(calls.create.length, 0);
    assert.equal(calls.delete.length, 0);
  });

  it('deletes a stale comment when an open PR no longer changes stories', async () => {
    const calls = await run({files: [], comments: [marked]});
    assert.equal(calls.delete.length, 1);
    assert.equal(calls.delete[0].comment_id, 99);
    assert.equal(calls.create.length, 0);
    assert.equal(calls.update.length, 0);
  });

  it('does nothing when there are no stories and no existing comment', async () => {
    const calls = await run({files: []});
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('does nothing when the preview URL is not a trusted host', async () => {
    const calls = await run({files: [storyFile], url: 'https://evil.example.com'});
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('does nothing when there is no open PR', async () => {
    const calls = await run({files: [storyFile], prs: [{number: 42, state: 'closed'}]});
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('does nothing when no open PR has the deployed commit as its head', async () => {
    const calls = await run({
      files: [storyFile],
      comments: [marked],
      prs: [{number: 42, state: 'open', head: {sha: 'stale-older-sha'}}],
    });
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('selects the associated open PR whose head is the deployed commit', async () => {
    const calls = await run({
      files: [storyFile],
      prs: [
        {number: 1, state: 'open', head: {sha: 'another-shared-commit'}},
        {number: 42, state: 'open', head: {sha: DEPLOY_SHA}},
      ],
    });
    assert.equal(calls.create.length, 1);
    assert.equal(calls.create[0].issue_number, 42);
  });

  it('links a changed gsApp story', async () => {
    const calls = await run({
      files: [
        {
          filename: 'static/gsApp/components/upsellModal/upsellModal.stories.tsx',
          status: 'modified',
        },
      ],
    });
    assert.equal(calls.create.length, 1);
    assert.match(
      calls.create[0].body!,
      /stories\/gsApp\/components\/upsellmodal\/upsellmodal\//
    );
  });

  it('does not link gsAdmin stories', async () => {
    const calls = await run({
      files: [
        {filename: 'static/gsAdmin/components/foo.stories.tsx', status: 'modified'},
      ],
    });
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('escapes markdown brackets in story file labels', async () => {
    const calls = await run({
      files: [
        {filename: 'static/app/components/foo]/bar.stories.tsx', status: 'modified'},
      ],
    });
    assert.equal(calls.create.length, 1);
    assert.match(calls.create[0].body!, /components\/foo\\\]\//);
  });

  it('links a colocated story when only the component changed', async () => {
    const calls = await run({
      files: [{filename: 'static/app/components/foo/foo.tsx', status: 'modified'}],
      dirContents: {
        'static/app/components/foo': [
          {name: 'foo.tsx', path: 'static/app/components/foo/foo.tsx'},
          {name: 'foo.stories.tsx', path: 'static/app/components/foo/foo.stories.tsx'},
        ],
      },
    });
    assert.equal(calls.create.length, 1);
    assert.match(calls.create[0].body!, /foo\.stories\.tsx/);
    assert.match(calls.create[0].body!, /stories\/product\/components\/foo\/foo\//);
  });

  it('does not link a colocated story when only snapshot or test files changed', async () => {
    const files = [
      'static/packages/scraps/src/button/button.snapshots.tsx',
      'static/packages/scraps/src/button/button.snapshot.tsx',
      'static/packages/scraps/src/button/button.spec.tsx',
      'static/packages/scraps/src/button/button.test.tsx',
    ].map(filename => ({filename, status: 'modified'}));
    const calls = await run({
      files,
      dirContents: {
        'static/packages/scraps/src/button': [
          {
            name: 'button.mdx',
            path: 'static/packages/scraps/src/button/button.mdx',
          },
        ],
      },
    });
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('links a directory-named story when index.tsx changed', async () => {
    const calls = await run({
      files: [
        {
          filename: 'static/packages/scraps/src/disclosure/index.tsx',
          status: 'modified',
        },
      ],
      dirContents: {
        'static/packages/scraps/src/disclosure': [
          {name: 'index.tsx', path: 'static/packages/scraps/src/disclosure/index.tsx'},
          {
            name: 'disclosure.mdx',
            path: 'static/packages/scraps/src/disclosure/disclosure.mdx',
          },
        ],
      },
    });
    assert.equal(calls.create.length, 1);
    assert.match(calls.create[0].body!, /stories\/core\/disclosure\//);
  });

  it('links a Scraps story when only its package component changed', async () => {
    const calls = await run({
      files: [
        {
          filename: 'static/packages/scraps/src/button/linkButton.tsx',
          status: 'modified',
        },
      ],
      dirContents: {
        'static/packages/scraps/src/button': [
          {name: 'button.mdx', path: 'static/packages/scraps/src/button/button.mdx'},
          {
            name: 'linkButton.tsx',
            path: 'static/packages/scraps/src/button/linkButton.tsx',
          },
          {
            name: 'linkButton.mdx',
            path: 'static/packages/scraps/src/button/linkButton.mdx',
          },
        ],
      },
    });
    assert.equal(calls.create.length, 1);
    assert.match(
      calls.create[0].body!,
      /\[packages\/scraps\/src\/button\/linkButton\.mdx\]/
    );
    assert.match(calls.create[0].body!, /stories\/core\/linkbutton\//);
  });

  it('links a Scraps story for a top-level package component', async () => {
    const calls = await run({
      files: [
        {filename: 'static/packages/scraps/src/slideOverPanel.tsx', status: 'modified'},
      ],
      dirContents: {
        'static/packages/scraps/src': [
          {
            name: 'slideOverPanel.tsx',
            path: 'static/packages/scraps/src/slideOverPanel.tsx',
          },
          {
            name: 'slideOverPanel.mdx',
            path: 'static/packages/scraps/src/slideOverPanel.mdx',
          },
        ],
      },
    });
    assert.equal(calls.create.length, 1);
    assert.match(calls.create[0].body!, /stories\/core\/slideoverpanel\//);
  });

  it('surfaces the app Badge story when a Scraps badge component changed', async () => {
    const calls = await run({
      files: [
        {filename: 'static/packages/scraps/src/badge/badge.tsx', status: 'modified'},
      ],
    });
    assert.equal(calls.create.length, 1);
    assert.match(calls.create[0].body!, /app\/components\/core\/badge\/badge\.mdx/);
    assert.match(calls.create[0].body!, /stories\/core\/badge\//);
  });

  it('does not link stories from other packages', async () => {
    const calls = await run({
      files: [
        {filename: 'static/packages/icons/src/foo/foo.mdx', status: 'modified'},
        {filename: 'static/packages/scraps/test/foo.tsx', status: 'modified'},
      ],
    });
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('ignores an unrelated story in the changed component directory', async () => {
    const calls = await run({
      files: [{filename: 'static/app/components/foo/foo.tsx', status: 'modified'}],
      dirContents: {
        'static/app/components/foo': [
          {name: 'foo.tsx', path: 'static/app/components/foo/foo.tsx'},
          {name: 'bar.stories.tsx', path: 'static/app/components/foo/bar.stories.tsx'},
        ],
      },
    });
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('surfaces the SeerMarkdown story when an embed schema changed', async () => {
    const calls = await run({
      files: [
        {
          filename: 'static/app/components/seer/markdown/embeds/schemas.ts',
          status: 'modified',
        },
      ],
    });
    assert.equal(calls.create.length, 1);
    assert.match(calls.create[0].body!, /seerMarkdown\.mdx/);
    assert.match(
      calls.create[0].body!,
      /stories\/product\/components\/seer\/markdown\/seermarkdown\//
    );
  });

  it('does not surface a dependency story when only its test changed', async () => {
    const calls = await run({
      files: [
        {
          filename: 'static/app/components/seer/markdown/embeds/schemas.test.ts',
          status: 'modified',
        },
      ],
    });
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('surfaces the SeerMarkdown story when an embed component changed', async () => {
    const calls = await run({
      files: [
        {
          filename: 'static/app/components/seer/markdown/embeds/components/docs.tsx',
          status: 'modified',
        },
      ],
    });
    assert.equal(calls.create.length, 1);
    assert.match(calls.create[0].body!, /seerMarkdown\.mdx/);
  });

  it('does not duplicate the SeerMarkdown story when both it and an embed changed', async () => {
    const calls = await run({
      files: [
        {
          filename: 'static/app/components/seer/markdown/embeds/schemas.ts',
          status: 'modified',
        },
        {
          filename: 'static/app/components/seer/markdown/seerMarkdown.mdx',
          status: 'modified',
        },
      ],
    });
    assert.equal(calls.create.length, 1);
    const links = calls.create[0].body!.match(/seerMarkdown\.mdx/g) ?? [];
    assert.equal(links.length, 1);
  });

  it('does not surface the SeerMarkdown story for an unrelated sibling directory', async () => {
    const calls = await run({
      files: [
        {
          filename: 'static/app/components/seer/markdown/embeds-legacy/schemas.ts',
          status: 'modified',
        },
      ],
    });
    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it('neutralizes markdown-injecting paths in both the label and the URL', async () => {
    const calls = await run({
      files: [
        {
          filename:
            'static/app/components/foo) [login](https://evil.example)/bar.stories.tsx',
          status: 'modified',
        },
      ],
    });
    const body = calls.create[0].body!;
    // URL segments are percent-encoded, so the raw `)` can't close the link.
    assert.match(body, /foo%29/);
    assert.doesNotMatch(body, /\)\/bar\//);
    // Brackets in the label are escaped.
    assert.match(body, /\\\[login\\\]/);
  });
});
