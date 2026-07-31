#!/usr/bin/env node

import {execFileSync} from 'node:child_process';

import fg from 'fast-glob';

// Generic eslint-as-detector. The caller supplies an eslint flat config (which
// is where any repo-/plugin-specific setup lives) plus the rule id to report
// on. This script just resolves the file set, runs eslint with that config,
// and emits the matching violations as JSON. It contains nothing specific to
// any one repo or plugin.
const repoPath = process.argv[2];
const rule = process.argv[3];
const configPath = process.argv[4];
const scanPaths = process.argv.slice(5);

if (!repoPath || !rule || !configPath || scanPaths.length === 0) {
  console.error(
    'Usage: eslint-json-runner <repo-path> <rule-id> <config-path> <path...>'
  );
  process.exit(1);
}

const patterns = scanPaths.map(p => (p.includes('*') ? p : `${p}/**/*.{ts,tsx}`));

const files = fg.sync(patterns, {
  cwd: repoPath,
  ignore: ['**/__fixtures__/**', '**/__mocks__/**', '**/*.spec.*', '**/*.test.*'],
  absolute: false,
});

if (files.length === 0) {
  console.log('[]');
  process.exit(0);
}

// Use only the supplied config (--no-config-lookup) so detection is independent
// of the target repo's own eslint setup. Inline eslint-disable directives are
// still honored (no --no-inline-config), so findings match the repo's own lint.
let rawOutput: string;
try {
  rawOutput = execFileSync(
    'npx',
    [
      'eslint',
      '--config',
      configPath,
      '--no-config-lookup',
      '--format',
      'json',
      '--no-warn-ignored',
      ...files,
    ],
    {
      cwd: repoPath,
      maxBuffer: 100 * 1024 * 1024,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
} catch (err: any) {
  rawOutput = err.stdout ?? '';
}

if (!rawOutput) {
  console.log('[]');
  process.exit(0);
}

interface EslintResult {
  filePath: string;
  messages: Array<{
    column: number;
    line: number;
    message: string;
    ruleId: string;
    endColumn?: number;
    endLine?: number;
  }>;
}

const parsed: EslintResult[] = JSON.parse(rawOutput);
const withViolations = parsed
  .map(f => ({
    filePath: f.filePath,
    messages: f.messages
      .filter(m => m.ruleId === rule)
      .map(m => ({
        ruleId: m.ruleId,
        message: m.message,
        line: m.line,
        endLine: m.endLine,
      })),
  }))
  .filter(f => f.messages.length > 0);

console.log(JSON.stringify(withViolations));
