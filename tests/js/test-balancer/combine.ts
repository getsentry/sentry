import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

// actions/download-artifact places each artifact in its own subdirectory:
//
//   artifacts/
//     jest-balance-0/
//       jest-balance-0.json
//     jest-balance-1/
//       jest-balance-1.json
//     ...
//
// This script merges them into a single jest-balance.json at the repo root.

const artifactsDir = process.argv[2];
if (!artifactsDir) {
  console.error('Usage: node combine.ts <artifacts-dir>');
  process.exit(1);
}

const combined: Record<string, number> = {};

for (const folder of readdirSync(artifactsDir)) {
  const dir = join(artifactsDir, folder);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const data: Record<string, number> = JSON.parse(
      readFileSync(join(dir, file), 'utf8')
    );
    Object.assign(combined, data);
  }
}

const sorted = Object.fromEntries(
  Object.entries(combined).sort(([a], [b]) => a.localeCompare(b))
);

const outputPath = resolve('jest-balance.json');
writeFileSync(outputPath, JSON.stringify(sorted, null, '\t'));
console.log(`Combined ${Object.keys(sorted).length} test entries into ${outputPath}`);
