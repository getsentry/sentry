import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {
  BACKEND_LABEL,
  COMMENT_MARKER,
  deriveScopeState,
  FRONTEND_LABEL,
  reconcilePrScope,
} from './reconcile-pr-scope.js';

function pathFilterOutputs(overrides = {}) {
  return {
    frontend_all_count: '0',
    backend_src_count: '0',
    api_url_codegen_count: '0',
    embed_widget_codegen_count: '0',
    integration_test_utils_count: '0',
    ...overrides,
  };
}

function setup({labels = [], comments = []} = {}) {
  const calls = [];
  const logs = [];
  const github = {
    paginate: async () => comments,
    rest: {
      issues: {
        get: async () => ({data: {labels: labels.map(name => ({name}))}}),
        addLabels: async params => calls.push({method: 'addLabels', params}),
        removeLabel: async params => calls.push({method: 'removeLabel', params}),
        listComments: () => {},
        createComment: async params => calls.push({method: 'createComment', params}),
        deleteComment: async params => calls.push({method: 'deleteComment', params}),
      },
    },
  };
  const context = {
    repo: {owner: 'getsentry', repo: 'sentry'},
    payload: {pull_request: {number: 123}},
  };
  const core = {info: message => logs.push(message)};

  return {github, context, core, calls, logs};
}

describe('reconcilePrScope', () => {
  it('derives semantic scope state from path-filter outputs', () => {
    assert.deepEqual(
      deriveScopeState(
        pathFilterOutputs({
          frontend_all_count: '2',
          backend_src_count: '2',
          api_url_codegen_count: '2',
          embed_widget_codegen_count: '1',
        })
      ),
      {frontend: true, backend: true, shouldWarn: false}
    );
  });

  it('rejects missing path-filter outputs', () => {
    assert.throws(
      () => deriveScopeState({}),
      /Expected frontend_all_count to be a non-negative integer/
    );
  });

  it('removes stale backend metadata from a frontend-only pull request', async () => {
    const warning = {
      id: 456,
      user: {login: 'github-actions[bot]'},
      body: COMMENT_MARKER,
    };
    const {github, context, core, calls, logs} = setup({
      labels: [FRONTEND_LABEL, BACKEND_LABEL],
      comments: [warning],
    });

    await reconcilePrScope({
      github,
      context,
      core,
      pathFilterOutputs: pathFilterOutputs({frontend_all_count: '1'}),
    });

    assert.deepEqual(
      calls.map(call => call.method),
      ['removeLabel', 'deleteComment']
    );
    assert.equal(calls[0].params.name, BACKEND_LABEL);
    assert.equal(calls[1].params.comment_id, warning.id);
    assert.deepEqual(logs, [
      'Removed stale Scope: Backend from #123.',
      'Deleted stale frontend/backend warning on #123.',
    ]);
  });

  it('replaces stale frontend metadata when a pull request becomes backend-only', async () => {
    const {github, context, core, calls, logs} = setup({labels: [FRONTEND_LABEL]});

    await reconcilePrScope({
      github,
      context,
      core,
      pathFilterOutputs: pathFilterOutputs({backend_src_count: '1'}),
    });

    assert.deepEqual(
      calls.map(call => call.method),
      ['removeLabel', 'addLabels']
    );
    assert.equal(calls[0].params.name, FRONTEND_LABEL);
    assert.deepEqual(calls[1].params.labels, [BACKEND_LABEL]);
    assert.deepEqual(logs, [
      'Removed stale Scope: Frontend from #123.',
      'Added Scope: Backend to #123.',
      'Frontend/backend warning on #123 is already correct.',
    ]);
  });

  it('adds both labels and the warning for a mixed pull request', async () => {
    const {github, context, core, calls} = setup();

    await reconcilePrScope({
      github,
      context,
      core,
      pathFilterOutputs: pathFilterOutputs({
        frontend_all_count: '1',
        backend_src_count: '1',
      }),
    });

    assert.deepEqual(
      calls.map(call => call.method),
      ['addLabels', 'addLabels', 'createComment']
    );
    assert.deepEqual(
      calls.slice(0, 2).map(call => call.params.labels[0]),
      [FRONTEND_LABEL, BACKEND_LABEL]
    );
    assert.match(calls[2].params.body, /Frontend and Backend changes/);
  });

  it('does not warn when all matching files are warning exemptions', async () => {
    const warning = {
      id: 456,
      user: {login: 'github-actions[bot]'},
      body: COMMENT_MARKER,
    };
    const {github, context, core, calls} = setup({comments: [warning]});

    await reconcilePrScope({
      github,
      context,
      core,
      pathFilterOutputs: pathFilterOutputs({
        frontend_all_count: '1',
        backend_src_count: '2',
        api_url_codegen_count: '1',
        embed_widget_codegen_count: '1',
        integration_test_utils_count: '1',
      }),
    });

    assert.deepEqual(
      calls.map(call => call.method),
      ['addLabels', 'addLabels', 'deleteComment']
    );
  });

  it('leaves already-correct metadata unchanged', async () => {
    const {github, context, core, calls, logs} = setup({labels: [BACKEND_LABEL]});

    await reconcilePrScope({
      github,
      context,
      core,
      pathFilterOutputs: pathFilterOutputs({backend_src_count: '2'}),
    });

    assert.deepEqual(calls, []);
    assert.deepEqual(logs, ['Frontend/backend warning on #123 is already correct.']);
  });
});
