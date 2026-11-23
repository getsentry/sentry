// Writes every tracked oxlint-suppressions.json file to SUPPRESSION_BUNDLE as
// one JSON object keyed by path. A tracked file that was deleted is bundled
// as {}. validate-pruned-suppressions.js reads the bundle.
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--', 'oxlint-suppressions.json', '**/oxlint-suppressions.json'],
  {encoding: 'utf8'}
)
  .split('\0')
  .filter(Boolean);
const budgets = Object.fromEntries(
  files.map(file => [
    file,
    existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {},
  ])
);
writeFileSync(process.env.SUPPRESSION_BUNDLE, JSON.stringify(budgets));
