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
      repos: {listPullRequestsAssociatedWithCommit: async () => ({data: prs})},
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

  it('escapes markdown brackets in story file labels', async () => {
    const calls = await run({
      files: [
        {filename: 'static/app/components/foo]/bar.stories.tsx', status: 'modified'},
      ],
    });
    assert.equal(calls.create.length, 1);
    assert.match(calls.create[0].body!, /components\/foo\\\]\//);
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
