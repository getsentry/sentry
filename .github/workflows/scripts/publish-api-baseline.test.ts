import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, it} from 'node:test';

import {
  BASE_BRANCH,
  BASELINE_PATH,
  BRANCH,
  canonicalJson,
  parseBaseline,
  publishApiBaseline,
  TITLE,
  type PublishArgs,
} from './publish-api-baseline.ts';

const ENTRY = {
  rule: 'S026',
  path: 'src/sentry/api/endpoints/example.py',
  scope: 'ExampleEndpoint.get',
  key: 'query:id',
  count: 1,
  owner: 'owners-api',
  status: 'debt-breaking',
  reason: 'legacy: predates S026',
  first_seen: '2026-11-19',
};

function baseline(entries: unknown[], generated = '2026-11-19'): string {
  return `${JSON.stringify({version: 1, generated, commit: generated, entries}, null, 2)}\n`;
}

function writeBaselines(current: string, next: string) {
  const dir = mkdtempSync(join(tmpdir(), 'api-baseline-'));
  const currentBaselinePath = join(dir, 'current.json');
  const newBaselinePath = join(dir, 'new.json');
  writeFileSync(currentBaselinePath, current);
  writeFileSync(newBaselinePath, next);
  return {currentBaselinePath, newBaselinePath};
}

function makeGithub({branchExists = true, openPrs = [] as number[]} = {}) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const record =
    <T>(name: string, result: () => T) =>
    async (params: Record<string, unknown>) => {
      calls.push([name, params]);
      return result();
    };
  const github = {
    rest: {
      git: {
        getCommit: record('getCommit', () => ({data: {tree: {sha: 'base-tree'}}})),
        createTree: record('createTree', () => ({data: {sha: 'new-tree'}})),
        createCommit: record('createCommit', () => ({data: {sha: 'new-commit'}})),
        updateRef: record('updateRef', () => {
          if (!branchExists) {
            throw Object.assign(new Error('Reference does not exist'), {status: 422});
          }
          return {};
        }),
        createRef: record('createRef', () => ({})),
      },
      pulls: {
        list: record('list', () => ({data: openPrs.map(number => ({number}))})),
        create: record('create', () => ({data: {number: 999}})),
      },
    },
  } as unknown as PublishArgs['github'];
  return {github, calls, names: () => calls.map(([name]) => name)};
}

const context = {repo: {owner: 'getsentry', repo: 'sentry'}, sha: 'master-sha'};
const core = {info: () => {}};

describe('parseBaseline', () => {
  it('rejects a file without a number version and an entries array', () => {
    assert.throws(
      () => parseBaseline('{"version": "1", "entries": []}', 'x'),
      /x is not/
    );
    assert.throws(() => parseBaseline('{"version": 1, "entries": {}}', 'x'), /x is not/);
    assert.throws(() => parseBaseline('[]', 'x'), /x is not/);
  });
});

describe('canonicalJson', () => {
  it('ignores object key order but not array order', () => {
    assert.equal(
      canonicalJson({b: 1, a: [{d: 2, c: 3}]}),
      canonicalJson({a: [{c: 3, d: 2}], b: 1})
    );
    assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
  });
});

describe('publishApiBaseline', () => {
  it('does nothing when only generated and commit changed', async () => {
    const paths = writeBaselines(baseline([ENTRY]), baseline([ENTRY], '2026-11-20'));
    const {github, calls} = makeGithub();
    await publishApiBaseline({github, context, core, ...paths});
    assert.deepEqual(calls, []);
  });

  it('fails before any API call when the new file is not an exceptions file', async () => {
    const paths = writeBaselines(baseline([ENTRY]), '{"entries": []}');
    const {github, calls} = makeGithub();
    await assert.rejects(publishApiBaseline({github, context, core, ...paths}));
    assert.deepEqual(calls, []);
  });

  it('commits the new file on master and opens a PR', async () => {
    const next = baseline([ENTRY, {...ENTRY, key: 'query:other'}], '2026-11-20');
    const paths = writeBaselines(baseline([ENTRY]), next);
    const {github, calls, names} = makeGithub();
    await publishApiBaseline({github, context, core, ...paths});

    assert.deepEqual(names(), [
      'getCommit',
      'createTree',
      'createCommit',
      'updateRef',
      'list',
      'create',
    ]);
    const params = Object.fromEntries(calls);
    assert.equal(params.getCommit!.commit_sha, 'master-sha');
    assert.deepEqual(params.createTree!.tree, [
      {path: BASELINE_PATH, mode: '100644', type: 'blob', content: next},
    ]);
    assert.equal(params.createTree!.base_tree, 'base-tree');
    assert.deepEqual(params.createCommit!.parents, ['master-sha']);
    assert.equal(params.createCommit!.message, TITLE);
    assert.deepEqual(
      {
        ref: params.updateRef!.ref,
        sha: params.updateRef!.sha,
        force: params.updateRef!.force,
      },
      {ref: `heads/${BRANCH}`, sha: 'new-commit', force: true}
    );
    assert.equal(params.list!.head, `getsentry:${BRANCH}`);
    assert.equal(params.create!.base, BASE_BRANCH);
    assert.equal(params.create!.head, BRANCH);
  });

  it('creates the branch when it does not exist yet', async () => {
    const paths = writeBaselines(baseline([ENTRY]), baseline([]));
    const {github, calls, names} = makeGithub({branchExists: false});
    await publishApiBaseline({github, context, core, ...paths});

    assert.deepEqual(names().slice(3, 5), ['updateRef', 'createRef']);
    assert.equal(Object.fromEntries(calls).createRef!.ref, `refs/heads/${BRANCH}`);
  });

  it('does not open a second PR when one is already open', async () => {
    const paths = writeBaselines(baseline([ENTRY]), baseline([]));
    const {github, names} = makeGithub({openPrs: [123]});
    await publishApiBaseline({github, context, core, ...paths});

    assert.ok(!names().includes('create'));
  });
});
