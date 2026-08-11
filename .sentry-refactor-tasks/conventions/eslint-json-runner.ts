#!/usr/bin/env node

import {execFileSync} from 'node:child_process';

import fg from 'fast-glob';

// Generic eslint-as-detector. The caller supplies an eslint flat config (which
// is where any repo-/plugin-specific setup lives) plus the rule id to report
// on. This script just resolves the file set, runs eslint with that config,
// and emits the matching violations as JSON. It contains nothing specific to
// any one repo or plugin.
//
// Failure policy: never print an empty result for a run that did not actually
// complete. Every unexpected condition exits non-zero with an explanation on
// stderr and writes nothing to stdout, so the scanner reports "produced no
// output" instead of "Found 0 violations". The earlier version degraded to `[]`
// whenever eslint failed to start, which made a completely non-functional rule
// look like a clean codebase for weeks.
function die(message: string): never {
  console.error(`eslint-json-runner: ${message}`);
  process.exit(1);
}

const repoPath = process.argv[2];
const rule = process.argv[3];
const configPath = process.argv[4];
const scanPaths = process.argv.slice(5);

if (!repoPath || !rule || !configPath || scanPaths.length === 0) {
  die('usage: eslint-json-runner <repo-path> <rule-id> <config-path> <path...>');
}

const patterns = scanPaths.map(p => (p.includes('*') ? p : `${p}/**/*.{ts,tsx}`));

const files = fg.sync(patterns, {
  cwd: repoPath,
  ignore: ['**/__fixtures__/**', '**/__mocks__/**', '**/*.spec.*', '**/*.test.*'],
  absolute: false,
});

// Matching nothing means the glob or the checkout is wrong, not that the repo
// is clean — every convention here targets paths that are known to exist.
if (files.length === 0) {
  die(`no files matched ${JSON.stringify(patterns)} under ${repoPath}`);
}

// The scanner kills a detect command after 300s and keeps whatever it captured,
// so a run that creeps past that budget silently becomes an empty result. Time
// the eslint call and report it, to make the remaining headroom observable.
const startedAt = Date.now();

// Use only the supplied config (--no-config-lookup) so detection is independent
// of the target repo's own eslint setup. Inline eslint-disable directives are
// still honored (no --no-inline-config), so findings match the repo's own lint.
let rawOutput = '';
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
  // eslint exits 0 when clean and 1 when it reports problems; both are real
  // runs whose JSON is on stdout. Anything else — 2 for a fatal config/CLI
  // error, ENOENT when npx is missing, ENOBUFS when output overflows maxBuffer,
  // a signal from an OOM kill — means we never got a trustworthy result.
  if (err.status !== 1) {
    const stderr = String(err.stderr ?? '').trim();
    die(
      `eslint did not run to completion ` +
        `(exit=${err.status ?? 'n/a'} signal=${err.signal ?? 'n/a'} code=${
          err.code ?? 'n/a'
        }).\n` +
        `command: npx eslint --config ${configPath} ... (${files.length} files)\n` +
        `stderr:\n${stderr || '(empty)'}`
    );
  }
  rawOutput = String(err.stdout ?? '');
}

if (!rawOutput.trim()) {
  die(
    `eslint exited without writing anything to stdout, so a clean run cannot be ` +
      `distinguished from a crash (${files.length} files were passed)`
  );
}

interface EslintResult {
  filePath: string;
  messages: Array<{
    column: number;
    line: number;
    message: string;
    ruleId: string | null;
    endColumn?: number;
    endLine?: number;
    fatal?: boolean;
  }>;
}

let parsed: EslintResult[];
try {
  parsed = JSON.parse(rawOutput);
} catch {
  die(`eslint output was not valid JSON. First 500 chars:\n${rawOutput.slice(0, 500)}`);
}

// A fatal message means eslint never evaluated the rule for that file — a parse
// error, or for type-aware rules a file the TypeScript project service could
// not resolve. Those files silently drop out of the result set, so report the
// run as failed rather than under-reporting violations.
const fatals = parsed.flatMap(f =>
  f.messages.filter(m => m.fatal).map(m => `${f.filePath}: ${m.message}`)
);
if (fatals.length > 0) {
  die(
    `eslint reported ${fatals.length} fatal error(s), so the run is incomplete. First 5:\n` +
      fatals
        .slice(0, 5)
        .map(line => `  ${line}`)
        .join('\n')
  );
}

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

const violationCount = withViolations.reduce((sum, f) => sum + f.messages.length, 0);
console.error(
  `eslint-json-runner: linted ${files.length} files in ${Math.round(
    (Date.now() - startedAt) / 1000
  )}s ` +
    `(scanner kills the detect command at 300s), eslint returned ${parsed.length} results, ` +
    `${rule} matched ${violationCount} violations in ${withViolations.length} files`
);

console.log(JSON.stringify(withViolations));
