import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {setMergeBase} from './merge-base.ts';

describe('setMergeBase', () => {
  it("sets the sha output to the merge base of the PR's base and head", async () => {
    const compared: unknown[] = [];
    const outputs: Record<string, string> = {};
    const github = {
      rest: {
        repos: {
          compareCommits: async (params: unknown) => {
            compared.push(params);
            return {data: {merge_base_commit: {sha: 'forkpoint'}}};
          },
        },
      },
    };
    const context = {
      repo: {owner: 'getsentry', repo: 'sentry'},
      payload: {pull_request: {base: {sha: 'basetip'}, head: {sha: 'headtip'}}},
    };
    const core = {
      info: () => {},
      setOutput: (name: string, value: string) => {
        outputs[name] = value;
      },
    };

    await setMergeBase({github, context, core});

    assert.deepEqual(compared, [
      {owner: 'getsentry', repo: 'sentry', base: 'basetip', head: 'headtip'},
    ]);
    assert.deepEqual(outputs, {sha: 'forkpoint'});
  });
});
