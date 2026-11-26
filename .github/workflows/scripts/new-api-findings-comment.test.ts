import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, it} from 'node:test';

import {syncNewApiFindingsComment} from './new-api-findings-comment.ts';

interface CommentCall {
  body?: string;
  comment_id?: number;
  issue_number?: number;
}

const FINDING = {
  path: 'src/sentry/api/endpoints/example.py',
  line: 12,
  rule: 'S026',
  title: 'Params read straight off the request',
  fix: 'Read them through a serializer.',
  publish_status: 'public',
};

const marked = {id: 99, body: '<!-- NEW_API_FINDINGS -->\nold'};

function writeFindings(findings: unknown): string {
  const findingsPath = join(mkdtempSync(join(tmpdir(), 'api-findings-')), 'out.json');
  writeFileSync(findingsPath, JSON.stringify(findings));
  return findingsPath;
}

// fakes the github-script client and records the comment calls the script makes
async function run(
  findingsPath: string,
  comments: Array<{id: number; body: string}> = [],
  checkFailed = false
) {
  const calls = {
    create: [] as CommentCall[],
    update: [] as CommentCall[],
    delete: [] as CommentCall[],
  };
  const github = {
    rest: {
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
    paginate: async () => comments,
  };
  const context = {
    repo: {owner: 'getsentry', repo: 'sentry'},
    serverUrl: 'https://github.com',
    runId: 7,
    payload: {pull_request: {number: 42, head: {sha: 'deadbeef'}}},
  };
  const core = {info: () => {}};

  await syncNewApiFindingsComment({
    github,
    context,
    core,
    findingsPath,
    checkFailed,
  } as any);
  return calls;
}

describe('syncNewApiFindingsComment', () => {
  it('creates a comment linking each new finding', async () => {
    const calls = await run(writeFindings([FINDING]));

    assert.equal(calls.create.length, 1);
    assert.equal(calls.create[0]!.issue_number, 42);
    assert.ok(
      calls.create[0]!.body!.includes(
        '[example.py](https://github.com/getsentry/sentry/blob/deadbeef/src/sentry/api/endpoints/example.py) [L12](https://github.com/getsentry/sentry/blob/deadbeef/src/sentry/api/endpoints/example.py#L12)'
      )
    );
  });

  it('tags the lines of endpoints that are not public', async () => {
    const calls = await run(
      writeFindings([
        FINDING,
        {...FINDING, line: 15, publish_status: 'public_experimental'},
      ])
    );

    assert.ok(calls.create[0]!.body!.includes('#L12), [L15]('));
    assert.ok(calls.create[0]!.body!.includes('#L15) (public experimental)'));
  });

  it('groups the lines of each file under its rule', async () => {
    const calls = await run(
      writeFindings([
        FINDING,
        {...FINDING, line: 15},
        {
          ...FINDING,
          rule: 'S028',
          title: 'The whole query string or body passed into a call',
          line: 20,
        },
      ])
    );

    const body = calls.create[0]!.body!;
    assert.ok(body.includes('**Params read straight off the request** · `S026` · 2'));
    assert.ok(
      body.includes('**The whole query string or body passed into a call** · `S028` · 1')
    );
    assert.ok(body.includes('#L12), [L15]('));
  });

  it('updates the existing comment', async () => {
    const calls = await run(writeFindings([FINDING]), [marked]);

    assert.equal(calls.update.length, 1);
    assert.equal(calls.update[0]!.comment_id, 99);
    assert.deepEqual(calls.create, []);
  });

  it('deletes the comment once there are no new findings', async () => {
    const calls = await run(writeFindings([]), [marked]);

    assert.deepEqual(calls.delete, [
      {owner: 'getsentry', repo: 'sentry', comment_id: 99},
    ]);
  });

  it('deletes the comment when the check wrote no file', async () => {
    const calls = await run(join(tmpdir(), 'missing-api-findings.json'), [marked]);

    assert.deepEqual(calls.delete, [
      {owner: 'getsentry', repo: 'sentry', comment_id: 99},
    ]);
  });

  it('does nothing when there are no findings and no comment', async () => {
    const calls = await run(writeFindings([]));

    assert.deepEqual(calls, {create: [], update: [], delete: []});
  });

  it("says the check couldn't run when it failed", async () => {
    const calls = await run(writeFindings([FINDING]), [marked], true);

    assert.equal(calls.update[0]!.comment_id, 99);
    assert.ok(
      calls.update[0]!.body!.includes(
        "Couldn't run the API findings check, see [the run](https://github.com/getsentry/sentry/actions/runs/7)."
      )
    );
  });
});
