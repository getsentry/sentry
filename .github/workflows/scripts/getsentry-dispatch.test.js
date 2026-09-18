import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {dispatch} from './getsentry-dispatch.js';

function mockCore() {
  const logs = {info: [], warning: []};
  return {
    info: msg => logs.info.push(msg),
    warning: msg => logs.warning.push(msg),
    startGroup: () => {},
    endGroup: () => {},
    logs,
  };
}

function mockContext({prNumber = 123, headSha = 'abc123'} = {}) {
  return {
    payload: {
      pull_request: {
        number: prNumber,
        head: {sha: headSha},
      },
    },
  };
}

function makeGithub({failUntilAttempt = 0} = {}) {
  const calls = [];
  let callCount = 0;
  return {
    calls,
    rest: {
      actions: {
        createWorkflowDispatch: async params => {
          callCount++;
          calls.push(params);
          if (callCount <= failUntilAttempt) {
            throw new Error('GitHub API error');
          }
        },
      },
    },
  };
}

const REAL_SET_TIMEOUT = globalThis.setTimeout;

function withFastRetries(fn) {
  globalThis.setTimeout = (cb, _delay) => REAL_SET_TIMEOUT(cb, 0);
  return fn().finally(() => {
    globalThis.setTimeout = REAL_SET_TIMEOUT;
  });
}

describe('dispatch', () => {
  it('dispatches backend.yml and acceptance.yml', async () => {
    const github = makeGithub();
    const core = mockCore();
    await dispatch({
      github,
      context: mockContext(),
      core,
      mergeCommitSha: 'deadbeef',
      fileChanges: {backend_all: 'true', gsapp: 'true'},
    });

    assert.equal(github.calls.length, 2);
    const workflows = github.calls.map(c => c.workflow_id);
    assert.ok(workflows.includes('backend.yml'));
    assert.ok(workflows.includes('acceptance.yml'));
    for (const call of github.calls) {
      assert.deepEqual(call.inputs, {
        pull_request_number: '123',
        skip: 'false',
        'sentry-sha': 'deadbeef',
        'sentry-pr-sha': 'abc123',
      });
    }
  });

  it('keeps dispatch inputs bounded for large changesets', async () => {
    const github = makeGithub();
    const context = mockContext();
    context.payload.pull_request.changed_files = 10000;
    await dispatch({
      github,
      context,
      core: mockCore(),
      mergeCommitSha: 'a'.repeat(40),
      fileChanges: {
        backend_all: 'true',
        gsapp: 'true',
        backend_all_files: JSON.stringify(
          Array.from({length: 10000}, (_value, index) => `src/sentry/file-${index}.py`)
        ),
      },
    });

    for (const call of github.calls) {
      assert.equal(Object.keys(call.inputs).length, 4);
      assert.ok(Buffer.byteLength(JSON.stringify(call.inputs)) < 1024);
    }
  });

  it('sets skip=true when pathFilter does not match', async () => {
    const github = makeGithub();
    await dispatch({
      github,
      context: mockContext(),
      core: mockCore(),
      mergeCommitSha: 'deadbeef',
      fileChanges: {backend_all: 'false', gsapp: 'false'},
    });

    for (const call of github.calls) {
      assert.equal(call.inputs.skip, 'true');
    }
  });

  it('sets skip=false when pathFilter matches', async () => {
    const github = makeGithub();
    await dispatch({
      github,
      context: mockContext(),
      core: mockCore(),
      mergeCommitSha: 'deadbeef',
      fileChanges: {backend_all: 'true', gsapp: 'true'},
    });

    for (const call of github.calls) {
      assert.equal(call.inputs.skip, 'false');
    }
  });

  it('passes mergeCommitSha as sentry-sha and headSha as sentry-pr-sha', async () => {
    const github = makeGithub();
    await dispatch({
      github,
      context: mockContext({headSha: 'head999'}),
      core: mockCore(),
      mergeCommitSha: 'merge111',
      fileChanges: {backend_all: 'true', gsapp: 'true'},
    });

    for (const call of github.calls) {
      assert.equal(call.inputs['sentry-sha'], 'merge111');
      assert.equal(call.inputs['sentry-pr-sha'], 'head999');
    }
  });

  it('dispatches only targetWorkflow when specified', async () => {
    const github = makeGithub();
    await dispatch({
      github,
      context: mockContext(),
      core: mockCore(),
      mergeCommitSha: 'deadbeef',
      fileChanges: {backend_all: 'true', gsapp: 'true'},
      targetWorkflow: 'backend.yml',
    });

    assert.equal(github.calls.length, 1);
    assert.equal(github.calls[0].workflow_id, 'backend.yml');
  });

  it('retries on transient failure and eventually succeeds', async () => {
    const github = makeGithub({failUntilAttempt: 1});
    const core = mockCore();
    await withFastRetries(() =>
      dispatch({
        github,
        context: mockContext(),
        core,
        mergeCommitSha: 'deadbeef',
        fileChanges: {backend_all: 'true', gsapp: 'false'},
        targetWorkflow: 'backend.yml',
      })
    );

    // 1 failure + 1 success = 2 total calls for this workflow
    assert.equal(github.calls.length, 2);
    assert.ok(core.logs.warning.some(m => m.includes('Retrying')));
  });

  it('throws after exhausting all retries', async () => {
    const github = makeGithub({failUntilAttempt: Infinity});
    const core = mockCore();
    await assert.rejects(
      () =>
        withFastRetries(() =>
          dispatch({
            github,
            context: mockContext(),
            core,
            mergeCommitSha: 'deadbeef',
            fileChanges: {backend_all: 'true', gsapp: 'false'},
            targetWorkflow: 'backend.yml',
          })
        ),
      /GitHub API error/
    );

    // 5 attempts total (1 initial + 4 retries)
    assert.equal(github.calls.length, 5);
  });
});
