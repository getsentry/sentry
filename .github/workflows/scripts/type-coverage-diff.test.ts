import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {
  compareItems,
  parseGitDiffText,
  type CoverageItem,
} from '../../../scripts/type-coverage-diff.ts';

const file = 'static/app/example.tsx';

function assertion(overrides: Partial<CoverageItem> = {}): CoverageItem {
  return {
    file,
    line: 1,
    column: 1,
    kind: 'type(as)',
    code: 'fieldApi.state.value as boolean',
    targetType: 'boolean',
    ...overrides,
  };
}

function diff(hunks: string, oldFile = file, newFile = oldFile) {
  return parseGitDiffText(
    `diff --git a/${oldFile} b/${newFile}\n--- a/${oldFile}\n+++ b/${newFile}\n${hunks}`
  );
}

const replacement = diff(
  '@@ -1 +1 @@\n-checked={fieldApi.state.value as boolean}\n+checked={fieldApi.value as boolean}'
);

test('an operand edit preserves the existing type assertion', () => {
  const old = assertion();
  const current = assertion({code: 'fieldApi.value as boolean'});
  assert.deepEqual(compareItems([current], [old], replacement), {
    added: [],
    removed: [],
  });
});

test('the reported form refactor preserves its assertion after line shifts', () => {
  const changes = diff(
    '@@ -338 +335 @@\n-checked={fieldApi.state.value as boolean}\n+checked={fieldApi.value as boolean}'
  );
  assert.deepEqual(
    compareItems(
      [assertion({line: 335, code: 'fieldApi.value as boolean'})],
      [assertion({line: 338})],
      changes
    ),
    {added: [], removed: []}
  );
});

test('a different target type is reported even if the code preview is identical', () => {
  const old = assertion({code: 'a very long expression…'});
  const current = assertion({code: old.code, targetType: 'string'});
  assert.deepEqual(compareItems([current], [old], replacement), {
    added: [current],
    removed: [old],
  });
});

test('different assertion kinds are not matched', () => {
  const old = assertion();
  const current = assertion({kind: 'type(angle)'});
  assert.deepEqual(compareItems([current], [old], replacement), {
    added: [current],
    removed: [old],
  });
});

test('an operand edit preserves an existing non-null assertion', () => {
  const old = assertion({kind: 'nonnull(expr)', code: 'field.state.value!'});
  const current = {...old, code: 'field.value!'};
  assert.deepEqual(compareItems([current], [old], replacement), {
    added: [],
    removed: [],
  });
});

test('as-any assertions support operand edits and exact moves across files', () => {
  const old: CoverageItem = {
    file,
    line: 1,
    column: 1,
    kind: 'as-any',
    name: 'fieldApi.state.value as any',
  };
  const current = {...old, name: 'fieldApi.value as any'};
  assert.deepEqual(compareItems([current], [old], replacement), {
    added: [],
    removed: [],
  });
  const newFile = 'static/app/moved.tsx';
  const changes = new Map([
    ...diff('@@ -1 +0,0 @@\n-old assertion'),
    ...diff('@@ -0,0 +1 @@\n+moved assertion', newFile),
  ]);
  assert.deepEqual(compareItems([{...old, file: newFile}], [old], changes), {
    added: [],
    removed: [],
  });
});

test('an added duplicate is reported at its new location', () => {
  const unchanged = assertion({line: 2});
  const added = assertion();
  const changes = diff('@@ -1 +1,2 @@\n+new assertion\n unchanged assertion');
  // Deliberately list the added occurrence first.
  assert.deepEqual(compareItems([added, unchanged], [assertion()], changes), {
    added: [added],
    removed: [],
  });
});

test('a removed duplicate is reported at its old location', () => {
  const removed = assertion();
  const unchanged = assertion({line: 2});
  const changes = diff('@@ -1,2 +1 @@\n-removed assertion\n unchanged assertion');
  assert.deepEqual(compareItems([assertion()], [removed, unchanged], changes), {
    added: [],
    removed: [removed],
  });
});

test('replacement matching consumes each old assertion once', () => {
  const current = assertion({code: 'fieldApi.value as boolean'});
  const extra = {...current, column: 50};
  assert.deepEqual(compareItems([current, extra], [assertion()], replacement), {
    added: [extra],
    removed: [],
  });
});

test('any symbols also preserve duplicate counts', () => {
  const old: CoverageItem = {file, line: 1, column: 1, kind: 'var', name: 'value'};
  const current = {...old, line: 2};
  const added = {...old};
  assert.deepEqual(
    compareItems(
      [added, current],
      [old],
      diff('@@ -1 +1,2 @@\n+new variable\n unchanged variable')
    ),
    {added: [added], removed: []}
  );
});

test('unchanged lines separate replacement blocks within a hunk', () => {
  const old = assertion();
  const current = assertion({line: 3, code: 'other as boolean'});
  const changes = diff(
    '@@ -1,3 +1,3 @@\n-old as boolean\n+typed value\n context\n-typed value\n+other as boolean'
  );
  assert.deepEqual(compareItems([current], [old], changes), {
    added: [current],
    removed: [old],
  });
});

test('different hunks do not cancel edited assertions with the same target', () => {
  const old = assertion();
  const current = assertion({line: 20, code: 'other as boolean'});
  const changes = diff(
    '@@ -1 +1 @@\n-old assertion\n+typed value\n@@ -20 +20 @@\n-typed value\n+new assertion'
  );
  assert.deepEqual(compareItems([current], [old], changes), {
    added: [current],
    removed: [old],
  });
});

test('exact assertions can move between hunks', () => {
  const old = assertion();
  const current = assertion({line: 20, column: 9});
  const changes = diff('@@ -1 +0,0 @@\n-assertion\n@@ -20,0 +20 @@\n+assertion');
  assert.deepEqual(compareItems([current], [old], changes), {
    added: [],
    removed: [],
  });
});

test('exact assertions can move out of a deleted file into a new file', () => {
  const old = assertion();
  const current = assertion({file: 'static/app/moved.tsx'});
  const changes = parseGitDiffText(
    `diff --git a/${file} b/${file}\n--- a/${file}\n+++ /dev/null\n@@ -1 +0,0 @@\n-assertion\n` +
      `diff --git a/${current.file} b/${current.file}\n--- /dev/null\n+++ b/${current.file}\n@@ -0,0 +1 @@\n+assertion`
  );
  assert.deepEqual(compareItems([current], [old], changes), {
    added: [],
    removed: [],
  });
  assert.deepEqual(compareItems([], [old], changes), {added: [], removed: [old]});
  assert.deepEqual(compareItems([current], [], changes), {added: [current], removed: []});
});

test('renames support operand edits and preserve any symbols', () => {
  const newFile = 'static/app/renamed.tsx';
  const changes = diff('@@ -1 +1 @@\n-old value\n+new value', file, newFile);
  assert.deepEqual(
    compareItems(
      [assertion({file: newFile, code: 'fieldApi.value as boolean'})],
      [assertion()],
      changes
    ),
    {added: [], removed: []}
  );
  const old: CoverageItem = {file, line: 1, column: 1, kind: 'var', name: 'value'};
  assert.deepEqual(compareItems([{...old, file: newFile}], [old], changes), {
    added: [],
    removed: [],
  });
});

test('unrelated any symbols in different files do not cancel each other', () => {
  const newFile = 'static/app/other.tsx';
  const old: CoverageItem = {file, line: 1, column: 1, kind: 'var', name: 'value'};
  const current = {...old, file: newFile};
  const changes = new Map([
    ...diff('@@ -1 +0,0 @@\n-old variable'),
    ...diff('@@ -0,0 +1 @@\n+new variable', newFile),
  ]);
  assert.deepEqual(compareItems([current], [old], changes), {
    added: [current],
    removed: [old],
  });
});

test('issues outside added or removed lines are not reported', () => {
  assert.deepEqual(compareItems([assertion()], [], new Map()), {
    added: [],
    removed: [],
  });
});

test('deleted and binary files do not leak into adjacent file hunks', () => {
  const changes = parseGitDiffText(
    `diff --git a/${file} b/${file}\n--- a/${file}\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n` +
      'diff --git a/image.png b/image.png\nBinary files differ\n'
  );
  assert.deepEqual([...changes.keys()], [file]);
  assert.deepEqual([...changes.get(file)!.removedLines], [1]);
});

test('source lines that resemble diff headers are still counted', () => {
  const changes = diff('@@ -1 +1 @@\n---old\n+++new');
  assert.deepEqual([...changes.get(file)!.removedLines], [1]);
  assert.deepEqual([...changes.get(file)!.addedLines], [1]);
});

test('PR comments omit preserved assertions and include actual additions', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'type-coverage-comment-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const reportPath = path.join(directory, 'report.json');
  const current = assertion({code: 'fieldApi.value as boolean'});
  const summary = {coverage: 100, filesScanned: 1, total: 1, typed: 1};
  for (const old of [[assertion()], []]) {
    writeFileSync(
      reportPath,
      JSON.stringify({
        changes: {typeAssertions: compareItems([current], old, replacement)},
        summaryComparison: {
          old: summary,
          current: summary,
          diff: {coverage: 0, filesScanned: 0, total: 0, typed: 0},
        },
      })
    );
    const result = spawnSync(
      process.execPath,
      [new URL('./format-type-coverage-comment.ts', import.meta.url).pathname],
      {
        encoding: 'utf8',
        env: {...process.env, REPORT_PATH: reportPath, GITHUB_OUTPUT: ''},
      }
    );
    assert.equal(result.status, 0, result.stderr);
    if (old.length) {
      assert.equal(result.stdout, '');
    } else {
      assert.match(result.stdout, /1 new type safety issue introduced/);
      assert.match(result.stdout, /fieldApi.value as boolean/);
    }
  }
});
