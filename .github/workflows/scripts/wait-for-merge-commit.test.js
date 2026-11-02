import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {waitForMergeCommit} from './wait-for-merge-commit.js';

function mockCore() {
  const outputs = {};
  const failures = [];
  return {
    info: () => {},
    startGroup: () => {},
    endGroup: () => {},
    setOutput: (key, value) => {
      outputs[key] = value;
    },
    setFailed: msg => failures.push(msg),
    outputs,
    failures,
  };
}

function mockContext({headSha = 'approved'} = {}) {
  return {
    repo: {owner: 'getsentry', repo: 'sentry'},
    payload: {pull_request: {number: 123, head: {sha: headSha}}},
  };
}

function makeGithub({
  headSha = 'approved',
  mergeable = true,
  mergeCommitSha = 'merge',
} = {}) {
  return {
    rest: {
      pulls: {
        get: async () => ({
          status: 200,
          data: {mergeable, merge_commit_sha: mergeCommitSha, head: {sha: headSha}},
        }),
      },
    },
  };
}

describe('waitForMergeCommit', () => {
  it('outputs the merge commit when the head matches the triggering event', async () => {
    const core = mockCore();
    await waitForMergeCommit({github: makeGithub(), context: mockContext(), core});

    assert.equal(core.outputs.mergeCommitSha, 'merge');
    assert.deepEqual(core.failures, []);
  });

  it('fails without a merge commit when the head moved after the triggering event', async () => {
    const core = mockCore();
    await waitForMergeCommit({
      github: makeGithub({headSha: 'pushed-after-approval'}),
      context: mockContext(),
      core,
    });

    assert.equal(core.outputs.mergeCommitSha, null);
    assert.equal(core.failures.length, 1);
    assert.match(core.failures[0], /head moved from approved to pushed-after-approval/);
  });

  it('does not report a head change when the merge commit is not computed yet', async () => {
    const core = mockCore();
    await waitForMergeCommit({
      github: makeGithub({mergeCommitSha: null}),
      context: mockContext(),
      core,
    });

    assert.equal(core.outputs.mergeCommitSha, null);
    assert.deepEqual(core.failures, []);
  });

  it('fails when the PR is not mergeable', async () => {
    const core = mockCore();
    await waitForMergeCommit({
      github: makeGithub({mergeable: false}),
      context: mockContext(),
      core,
    });

    assert.equal(core.outputs.mergeCommitSha, null);
    assert.deepEqual(core.failures, ['PR #123 is not mergeable']);
  });
});
