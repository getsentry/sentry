#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

import fg from 'fast-glob';

// Generic oxlint-as-detector. The caller supplies an oxlint config (which is
// where any repo-/plugin-specific setup lives) plus the rule id to report on.
// This script just resolves the file set, runs oxlint with that config, and
// emits the matching violations in the eslint JSON shape the scanner parses.
// It contains nothing specific to any one repo or plugin.
//
// Failure policy: never print an empty result for a run that did not actually
// complete. Every unexpected condition exits non-zero with an explanation on
// stderr and writes nothing to stdout, so the scanner reports "produced no
// output" instead of "Found 0 violations".
function die(message: string): never {
  console.error(`oxlint-json-runner: ${message}`);
  process.exit(1);
}

const repoPath = process.argv[2];
const rule = process.argv[3];
const configPath = process.argv[4];
const scanPaths = process.argv.slice(5);

if (!repoPath || !rule || !configPath || scanPaths.length === 0) {
  die('usage: oxlint-json-runner <repo-path> <rule-id> <config-path> <path...>');
}

// Config rule ids are `plugin/rule`; oxlint reports them as `plugin(rule)`.
const slash = rule.lastIndexOf('/');
const diagnosticCode =
  slash === -1 ? rule : `${rule.slice(0, slash)}(${rule.slice(slash + 1)})`;

const patterns = scanPaths.map(p => (p.includes('*') ? p : `${p}/**/*.{ts,tsx}`));

// Pass explicit file paths rather than a directory: oxlint applies .gitignore to
// directory arguments, which silently skips everything when the checkout itself
// sits under an ignored path (e.g. a worktree in .claude/worktrees).
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
// the oxlint call and report it, to make the remaining headroom observable.
const startedAt = Date.now();

// --disable-nested-config keeps detection independent of the repo's own oxlint
// setup. Inline disable directives are still honored, so findings match the
// repo's own lint.
const result = spawnSync(
  'pnpm',
  [
    'exec',
    'oxlint',
    '--config',
    configPath,
    '--disable-nested-config',
    '--format',
    'json',
    ...files,
  ],
  {
    cwd: repoPath,
    maxBuffer: 100 * 1024 * 1024,
    encoding: 'utf-8',
  }
);

const stderr = String(result.stderr ?? '').trim();
const failure = (reason: string) =>
  `${reason}\n` +
  `command: pnpm exec oxlint --config ${configPath} ... (${files.length} files)\n` +
  `stderr:\n${stderr || '(empty)'}`;

// oxlint exits 0 when clean and 1 when it reports problems; both are real runs
// whose JSON is on stdout. Anything else — a spawn error, an overflowing
// maxBuffer, a signal from an OOM kill — means we never got a trustworthy
// result.
if (result.error || (result.status !== 0 && result.status !== 1)) {
  die(
    failure(
      `oxlint did not run to completion (exit=${result.status ?? 'n/a'} signal=${
        result.signal ?? 'n/a'
      } error=${result.error?.message ?? 'n/a'}).`
    )
  );
}

// The type-aware backend (tsgolint) can panic while oxlint still exits 0 with
// whatever it gathered before the crash.
if (/panic:|Error running tsgolint/.test(stderr)) {
  die(failure('the type-aware backend (tsgolint) crashed, so the run is incomplete.'));
}

interface OxlintOutput {
  diagnostics: Array<{
    filename: string;
    labels: Array<{span: {line: number}}>;
    message: string;
    code?: string;
  }>;
  number_of_files: number;
}

let parsed: OxlintOutput;
try {
  parsed = JSON.parse(result.stdout);
} catch {
  die(
    failure(
      `oxlint output was not valid JSON. First 500 chars:\n${result.stdout.slice(0, 500)}`
    )
  );
}

// Any file oxlint skipped (ignore rules, unreadable) silently drops out of the
// result set, so treat a short count as an incomplete run.
if (parsed.number_of_files !== files.length) {
  die(failure(`oxlint linted ${parsed.number_of_files} of ${files.length} files.`));
}

// A diagnostic without a code is a parse error, so oxlint never evaluated the
// rule for that file. Report the run as failed rather than under-reporting.
const fatals = parsed.diagnostics.filter(d => !d.code);
if (fatals.length > 0) {
  die(
    `oxlint reported ${fatals.length} parse error(s), so the run is incomplete. First 5:\n` +
      fatals
        .slice(0, 5)
        .map(d => `  ${d.filename}: ${d.message}`)
        .join('\n')
  );
}

// The scanner reads each filePath and makes it repo-relative itself, so it
// expects absolute paths like eslint's output.
const byFile = new Map<string, Array<{line: number; message: string; ruleId: string}>>();
for (const d of parsed.diagnostics) {
  if (d.code !== diagnosticCode) {
    continue;
  }
  const filePath = resolve(repoPath, d.filename);
  const messages = byFile.get(filePath) ?? [];
  messages.push({ruleId: rule, message: d.message, line: d.labels[0]?.span.line ?? 1});
  byFile.set(filePath, messages);
}
const withViolations = [...byFile].map(([filePath, messages]) => ({filePath, messages}));

const violationCount = withViolations.reduce((sum, f) => sum + f.messages.length, 0);
console.error(
  `oxlint-json-runner: linted ${files.length} files in ${Math.round(
    (Date.now() - startedAt) / 1000
  )}s ` +
    `(scanner kills the detect command at 300s), ` +
    `${rule} matched ${violationCount} violations in ${withViolations.length} files`
);

console.log(JSON.stringify(withViolations));
