import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const directory = process.argv[2];
assert(directory, 'Pass the downloaded suppression artifact directory');
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--', 'oxlint-suppressions.json', '**/oxlint-suppressions.json'],
  {encoding: 'utf8'}
)
  .split('\0')
  .filter(file => path.basename(file) === 'oxlint-suppressions.json');
const source = path.join(directory, 'suppressions.json');
assert(lstatSync(source).isFile(), 'Invalid suppression artifact');
const uploaded = JSON.parse(readFileSync(source, 'utf8'));
const isObject = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
assert(isObject(uploaded), 'Artifact must be an object');
assert.deepEqual(
  Object.keys(uploaded).sort(),
  files.toSorted(),
  'Artifact must contain every committed suppression file'
);
const replacements = files.map(asset => {
  const original = JSON.parse(readFileSync(asset, 'utf8'));
  const pruned = uploaded[asset];
  assert(isObject(pruned), 'Suppressions must be an object');
  for (const [file, rules] of Object.entries(pruned)) {
    assert(Object.hasOwn(original, file), `Unexpected file: ${asset} ${file}`);
    assert(
      isObject(rules) && Object.keys(rules).length > 0,
      `Invalid rules: ${asset} ${file}`
    );
    for (const [rule, budget] of Object.entries(rules)) {
      assert(
        Object.hasOwn(original[file], rule),
        `Unexpected rule: ${asset} ${file} ${rule}`
      );
      assert(
        isObject(budget) &&
          Object.keys(budget).length === 1 &&
          Object.hasOwn(budget, 'count'),
        `Invalid budget: ${asset} ${file} ${rule}`
      );
      assert(
        Number.isSafeInteger(budget.count) &&
          budget.count > 0 &&
          budget.count <= original[file][rule].count,
        `Invalid count: ${asset} ${file} ${rule}`
      );
    }
  }
  return [
    asset,
    Object.keys(pruned).length > 0 ? JSON.stringify(pruned, null, 2) + '\n' : null,
  ];
});
for (const [asset, bytes] of replacements) {
  if (bytes === null) rmSync(asset);
  else writeFileSync(asset, bytes);
}
