import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

import type {OxlintConfig} from 'oxlint';

// Native suppression counts deliberately allow replacements within one file/rule.
type Suppressions = Record<string, Record<string, {count: number}>>;
type Lease = {pid: number; token: string; original?: string | null; policy?: string};
type Finding = {
  column: number;
  file: string;
  line: number;
  message: string;
  rule: string;
};
const root = process.cwd();
const asset = path.join(root, 'oxlint-suppressions.json');
const stateDirectory = path.join(root, '.artifacts/lint-incubator/transactions');
const lock = path.join(stateDirectory, 'owner.json');
const require = createRequire(path.join(root, 'package.json'));
const nativeCLI = path.join(path.dirname(require.resolve('oxlint')), 'cli.js');

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalRule(rule: string) {
  return rule.replace(/^eslint\//, '');
}

function validPath(file: string) {
  return (
    file.length > 0 &&
    !file.includes('\\') &&
    !file.includes('\0') &&
    !path.isAbsolute(file) &&
    file.split('/').every(part => part !== '' && part !== '.' && part !== '..')
  );
}

function parseSuppressions(bytes: string, allowed?: Set<string>): Suppressions {
  const value: unknown = JSON.parse(bytes);
  assert(record(value), 'Suppressions must be a path -> rule -> {count} object');
  for (const [file, rules] of Object.entries(value)) {
    assert(validPath(file) && record(rules), `Invalid suppression path ${file}`);
    assert(Object.keys(rules).length > 0, `Empty suppression entry ${file}`);
    for (const [rule, budget] of Object.entries(rules)) {
      assert(
        rule.length > 0 &&
          canonicalRule(rule) === rule &&
          (!allowed || allowed.has(rule)),
        `Suppression rule ${rule} is not enrolled. Use the canonical native rule key.`
      );
      assert(
        record(budget) &&
          Object.keys(budget).length === 1 &&
          Number.isSafeInteger(budget.count) &&
          Number(budget.count) > 0,
        `Invalid suppression count for ${file} ${rule}`
      );
    }
  }
  return value as Suppressions;
}

function serialize(value: Suppressions) {
  return `${JSON.stringify(
    Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([file, rules]) => [
          file,
          Object.fromEntries(
            Object.entries(rules).sort(([a], [b]) => a.localeCompare(b))
          ),
        ])
    ),
    null,
    2
  )}\n`;
}

function atomicWrite(file: string, bytes: string | Uint8Array) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, bytes, {flag: 'wx'});
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, {force: true});
  }
}

function alive(pid: number) {
  assert(Number.isSafeInteger(pid) && pid > 0, 'Invalid transaction owner');
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function readLease(file: string): Lease {
  const lease = JSON.parse(readFileSync(file, 'utf8')) as Lease;
  assert(typeof lease.token === 'string' && /^[\da-f-]+$/.test(lease.token));
  assert(
    lease.original === undefined ||
      lease.original === null ||
      typeof lease.original === 'string'
  );
  assert(
    lease.policy === undefined ||
      /^\.oxlint-incubator-[\da-f-]+\.json$/.test(lease.policy)
  );
  assert(
    typeof lease.original !== 'string' ||
      Buffer.from(lease.original, 'base64').toString('base64') === lease.original,
    `Corrupt lint transaction backup ${file}. Repair it before retrying.`
  );
  alive(lease.pid);
  return lease;
}

function claim(file: string, lease: Lease) {
  const candidate = path.join(stateDirectory, `${lease.token}.tmp`);
  writeFileSync(candidate, JSON.stringify(lease), {flag: 'wx'});
  try {
    linkSync(candidate, file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
    return false;
  } finally {
    rmSync(candidate, {force: true});
  }
}

function restore(original: string | null | undefined) {
  if (original === null) {
    rmSync(asset, {force: true});
  } else if (original !== undefined) {
    atomicWrite(asset, Buffer.from(original, 'base64'));
  }
}

async function acquire() {
  mkdirSync(stateDirectory, {recursive: true});
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const lease: Lease = {pid: process.pid, token: randomUUID()};
    if (claim(lock, lease)) {
      return lease;
    }
    try {
      const abandoned = readLease(lock);
      if (!alive(abandoned.pid)) {
        let previous = abandoned;
        while (!alive(previous.pid)) {
          const recovery = path.join(stateDirectory, `${previous.token}.recovery.json`);
          if (claim(recovery, lease)) {
            const latest = readLease(lock);
            if (latest.token !== abandoned.token) {
              break;
            }
            restore(latest.original);
            if (latest.policy) {
              rmSync(path.join(root, latest.policy), {force: true});
            }
            rmSync(lock);
            break;
          }
          previous = readLease(recovery);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    await delay(25);
  }
  throw new Error('Another lint transaction is still running. Retry after it finishes.');
}

async function transaction<T>(operation: (original: string | null) => Promise<T>) {
  const lease = await acquire();
  try {
    lease.original = existsSync(asset) ? readFileSync(asset).toString('base64') : null;
    atomicWrite(lock, JSON.stringify(lease));
    return await operation(lease.original);
  } finally {
    const latest = readLease(lock);
    restore(latest.original);
    if (latest.policy) {
      rmSync(path.join(root, latest.policy), {force: true});
    }
    rmSync(lock);
  }
}

function git(directory: string, args: string[]) {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function revision(ref: string) {
  assert(ref.length > 0, 'The base revision cannot be empty');
  return git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
}

async function rawScan(directory: string, allowed: Set<string>, policy: string) {
  const result = await new Promise<{
    status: number | null;
    stderr: string;
    stdout: string;
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        nativeCLI,
        '-c',
        policy,
        '--disable-nested-config',
        '--format',
        'json',
        '--no-error-on-unmatched-pattern',
        '.',
      ],
      {
        cwd: directory,
        env: {...process.env, SENTRY_OXLINT_TYPEAWARE: 'true'},
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', status => resolve({status, stdout, stderr}));
  });
  assert(result.status === 0 || result.status === 1, `Oxlint failed: ${result.stderr}`);
  assert(
    result.stderr.trim() === '',
    `Oxlint could not complete the scan: ${result.stderr}`
  );
  const output: unknown = JSON.parse(result.stdout);
  assert(
    record(output) && Array.isArray(output.diagnostics),
    'Invalid oxlint JSON diagnostics'
  );
  const counts: Suppressions = Object.create(null);
  const findings: Finding[] = [];
  for (const diagnostic of output.diagnostics) {
    assert(record(diagnostic), 'Invalid oxlint diagnostic');
    const match =
      typeof diagnostic.code === 'string' && /^(.+)\(([^()]+)\)$/.exec(diagnostic.code);
    assert(
      match && diagnostic.severity === 'error',
      `Unclassified oxlint diagnostic: ${JSON.stringify(diagnostic)}`
    );
    const rule = canonicalRule(`${match[1]}/${match[2]}`);
    assert(allowed.has(rule), `Unexpected oxlint rule ${rule}`);
    assert(
      typeof diagnostic.filename === 'string' && typeof diagnostic.message === 'string'
    );
    const file = path.isAbsolute(diagnostic.filename)
      ? path.relative(directory, diagnostic.filename)
      : diagnostic.filename;
    assert(validPath(file), `Invalid diagnostic path ${file}`);
    assert(Array.isArray(diagnostic.labels) && diagnostic.labels.length > 0);
    const span = diagnostic.labels[0]?.span;
    assert(
      record(span) &&
        Number.isSafeInteger(span.line) &&
        Number(span.line) > 0 &&
        Number.isSafeInteger(span.column) &&
        Number(span.column) > 0,
      'Missing diagnostic location'
    );
    const rules = (counts[file] ??= Object.create(null));
    (rules[rule] ??= {count: 0}).count++;
    findings.push({
      file,
      rule,
      line: Number(span.line),
      column: Number(span.column),
      message: diagnostic.message,
    });
  }
  assert(
    result.status === 0 || findings.length > 0,
    'Oxlint failed without classified diagnostics'
  );
  return {counts, findings};
}

function fits(current: Suppressions, baseline: Suppressions) {
  const increases: string[] = [];
  for (const [file, rules] of Object.entries(current)) {
    for (const [rule, {count}] of Object.entries(rules)) {
      const budget = baseline[file]?.[rule]?.count ?? 0;
      if (count > budget) {
        increases.push(`${file} ${rule}: ${count} violations, budget ${budget}`);
      }
    }
  }
  if (increases.length > 0) {
    process.exitCode = 1;
    throw new Error(`New incubator violations:\n${increases.join('\n')}`);
  }
}

async function baseScan(base: string, allowed: Set<string>, policy: string) {
  const directory = realpathSync(
    mkdtempSync(path.join(tmpdir(), 'lint-incubator-base-'))
  );
  try {
    const archive = path.join(directory, 'source.tar');
    git(root, ['archive', '--format=tar', '-o', archive, base]);
    execFileSync('tar', ['-xf', archive, '-C', directory]);
    rmSync(archive);
    rmSync(path.join(directory, 'node_modules'), {recursive: true, force: true});
    symlinkSync(
      path.join(root, 'node_modules'),
      path.join(directory, 'node_modules'),
      'dir'
    );
    const tracked = (ref?: string) =>
      git(
        root,
        ref
          ? ['ls-tree', '-r', '--name-only', '-z', ref]
          : ['ls-files', '--cached', '--others', '--exclude-standard', '-z']
      )
        .split('\0')
        .filter(Boolean);
    const isIgnore = (file: string) => /(^|\/)\.(?:git|eslint|oxlint)ignore$/.test(file);
    for (const file of tracked(base).filter(isIgnore)) {
      rmSync(path.join(directory, file), {force: true});
    }
    for (const file of tracked().filter(isIgnore)) {
      if (existsSync(path.join(root, file))) {
        mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});
        cpSync(path.join(root, file), path.join(directory, file), {
          recursive: true,
          dereference: true,
        });
      }
    }
    rmSync(path.join(directory, 'oxlint-suppressions.json'), {force: true});
    const basePolicy = path.join(directory, '.oxlint-incubator-policy.json');
    cpSync(policy, basePolicy);
    const {counts} = await rawScan(directory, allowed, basePolicy);
    const changes = git(root, [
      'diff',
      '--name-status',
      '-z',
      '--find-renames=100%',
      base,
      '--',
    ]).split('\0');
    for (let index = 0; index < changes.length;) {
      const status = changes[index++]!;
      const oldFile = changes[index++]!;
      if (status.startsWith('R') || status.startsWith('C')) {
        const newFile = changes[index++]!;
        if (
          status === 'R100' &&
          !existsSync(path.join(root, oldFile)) &&
          counts[oldFile] &&
          !counts[newFile]
        ) {
          counts[newFile] = counts[oldFile];
          delete counts[oldFile];
        }
      }
    }
    return counts;
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const maintenance = ['check', 'ci', 'enroll', 'prune', 'backlog', 'snapshot'] as const;
  const command = maintenance.find(action => args[0] === `--${action}`);
  const {values, positionals} = parseArgs({
    args: command ? args.slice(1) : [],
    options: {
      base: {type: 'string'},
      rule: {type: 'string'},
      file: {type: 'string'},
      json: {type: 'boolean'},
      help: {type: 'boolean', short: 'h'},
    },
    allowPositionals: true,
  });
  if (args[0] === '--help' || args[0] === '-h' || values.help) {
    console.log(`Usage: pnpm run lint:js [native options] [paths...]
       pnpm run lint:js --<maintenance> [options]

Ordinary lint forwards native options below and uses the committed policy.
Configuration, rule, and suppression overrides are rejected.
Successful --fix runs reduce suppression budgets for checked files.
Put a maintenance flag first. Maintenance always scans all files.

  --check [--base REF]     Compare debt with trusted source at REF.
                          Defaults to the merge base of HEAD and origin/master.
  --ci [--base REF]        Verify committed budgets match live debt and fit REF.
  --enroll --base REF      Enroll rules using trusted source at REF.
  --prune                 Reduce remaining budgets with a full type-aware scan.
  --backlog [--rule RULE] [--file PATH] [--json]
                          Show unsuppressed findings with optional filters.
  --snapshot              Print live counts in the native suppression format.
  -h, --help              Show wrapper and native oxlint help.

Native oxlint options:
`);
    process.argv = [process.execPath, nativeCLI, '--help'];
    await import(pathToFileURL(nativeCLI).href);
    return;
  }
  if (command) {
    assert(positionals.length === 0, 'Unexpected positional arguments');
    assert(
      values.base === undefined || ['check', 'ci', 'enroll'].includes(command),
      '--base is only supported by --check, --ci, and --enroll'
    );
    assert(
      values.base === undefined || values.base.length > 0,
      'The base revision cannot be empty'
    );
    assert(
      command !== 'enroll' || values.base !== undefined,
      'Enrollment requires an explicit --base REF'
    );
    assert(
      (values.rule === undefined && values.file === undefined) || command === 'backlog',
      'Filters are only supported by --backlog'
    );
    if (values.file) {
      assert(validPath(values.file), 'Use a repository-relative file path');
    }
    process.env.SENTRY_OXLINT_TYPEAWARE = 'true';
  } else {
    const forbidden =
      /^(?:--(?:suppress-all|prune-suppressions|config|init|lsp|allow|warn|deny|disable-.*|ignore-path|ignore-pattern|tsconfig)(?:=|$)|-[cAWD])/;
    assert(
      !args.some(arg => forbidden.test(arg)),
      'Use the committed lint policy. Use --enroll or --prune for suppression changes.'
    );
  }
  const {default: config, incubator}: {default: OxlintConfig; incubator: OxlintConfig} =
    await import(pathToFileURL(path.join(root, 'oxlint.config.ts')).href);
  assert(
    record(incubator) && record(incubator.rules),
    'Export the incubator rules registry from oxlint.config.ts'
  );
  const allowed = new Set<string>();
  for (const [rule, options] of Object.entries(incubator.rules)) {
    const severity = Array.isArray(options) ? options[0] : options;
    assert(
      severity === 'error' || severity === 2,
      `Incubator rule ${rule} must be an error`
    );
    assert(
      JSON.stringify(config.rules?.[rule]) === JSON.stringify(options),
      `Enable ${rule} in the main lint configuration`
    );
    allowed.add(canonicalRule(rule));
  }
  if (!command) {
    await transaction(async original => {
      assert(
        original !== null,
        'Missing oxlint-suppressions.json. Run pnpm run lint:js --enroll --base REF with trusted source.'
      );
      const committed = parseSuppressions(
        Buffer.from(original, 'base64').toString('utf8'),
        allowed
      );
      // The pinned CLI uses this process, so a killed transaction has no orphan writer.
      process.argv = [process.execPath, nativeCLI, '--prune-suppressions', ...args];
      await import(pathToFileURL(nativeCLI).href);
      const options = args.slice(0, args.includes('--') ? args.indexOf('--') : undefined);
      if ((process.exitCode ?? 0) !== 0 || !options.includes('--fix')) {
        return;
      }
      const candidate = parseSuppressions(readFileSync(asset, 'utf8'), allowed);
      fits(candidate, committed);
      // Oxlint 1.85 puts every type-aware rule in this namespace, so fast fixes retain it.
      if (config.options?.typeAware !== true) {
        for (const [file, rules] of Object.entries(committed)) {
          for (const [rule, budget] of Object.entries(rules)) {
            if (rule.startsWith('typescript/')) {
              (candidate[file] ??= Object.create(null))[rule] = budget;
            }
          }
        }
      }
      const bytes = serialize(candidate);
      if (bytes !== serialize(committed)) {
        const lease = readLease(lock);
        lease.original = Buffer.from(bytes).toString('base64');
        atomicWrite(lock, JSON.stringify(lease));
      }
    });
    return;
  }
  if (values.rule) {
    assert(
      allowed.has(canonicalRule(values.rule)),
      `Rule ${values.rule} is not enrolled`
    );
  }
  let replacement: Suppressions | undefined;
  await transaction(async original => {
    const committed =
      original === null
        ? undefined
        : parseSuppressions(
            Buffer.from(original, 'base64').toString('utf8'),
            ['prune', 'enroll'].includes(command) ? undefined : allowed
          );
    rmSync(asset, {force: true});
    const policy = path.join(root, `.oxlint-incubator-${randomUUID()}.json`);
    const owner = readLease(lock);
    owner.policy = path.basename(policy);
    atomicWrite(lock, JSON.stringify(owner));
    const absolutePlugin = (specifier: string) => require.resolve(specifier);
    atomicWrite(
      policy,
      JSON.stringify({
        ...config,
        options: {typeAware: true, reportUnusedDisableDirectives: 'off'},
        categories: {
          correctness: 'off',
          suspicious: 'off',
          pedantic: 'off',
          perf: 'off',
          style: 'off',
          restriction: 'off',
          nursery: 'off',
        },
        rules: incubator.rules,
        overrides: config.overrides?.map(({rules, ...context}) => ({
          ...context,
          rules: Object.fromEntries(
            Object.entries(rules ?? {}).filter(([rule]) =>
              allowed.has(canonicalRule(rule))
            )
          ),
        })),
        jsPlugins: config.jsPlugins?.map(plugin =>
          typeof plugin === 'string'
            ? absolutePlugin(plugin)
            : {...plugin, specifier: absolutePlugin(plugin.specifier)}
        ),
      })
    );
    try {
      const current = await rawScan(root, allowed, policy);
      if (command === 'backlog') {
        const findings = current.findings.filter(
          item =>
            (!values.rule || item.rule === canonicalRule(values.rule)) &&
            (!values.file || item.file === values.file)
        );
        console.log(
          values.json
            ? JSON.stringify({findings}, null, 2)
            : findings
                .map(
                  item =>
                    `${item.file}:${item.line}:${item.column} ${item.rule} ${item.message}`
                )
                .join('\n')
        );
      } else if (command === 'snapshot') {
        console.log(serialize(current.counts).trimEnd());
      } else if (command === 'prune') {
        assert(
          committed,
          'Missing suppression asset. Run pnpm run lint:js --enroll --base REF with trusted source.'
        );
        const reduced: Suppressions = Object.create(null);
        for (const [file, rules] of Object.entries(current.counts)) {
          for (const [rule, {count}] of Object.entries(rules)) {
            const budget = Math.min(count, committed[file]?.[rule]?.count ?? 0);
            if (budget > 0) {
              (reduced[file] ??= Object.create(null))[rule] = {count: budget};
            }
          }
        }
        fits(current.counts, reduced);
        replacement = reduced;
      } else {
        if (command !== 'ci' || values.base) {
          let ref = values.base;
          if (!ref) {
            ref = git(root, ['merge-base', 'HEAD', revision('origin/master')]);
          }
          fits(current.counts, await baseScan(revision(ref), allowed, policy));
        }
        if (command === 'enroll') {
          replacement = current.counts;
        } else if (command === 'ci') {
          assert(committed, 'The suppression asset must be committed');
          if (serialize(committed) !== serialize(current.counts)) {
            process.exitCode = 1;
            throw new Error(
              'Suppression budgets do not match live debt. Run pnpm run fix:oxlint after cleanup, or pnpm run lint:js --prune for remaining budgets. Use pnpm run lint:js --enroll --base REF for changed policy using trusted source.'
            );
          }
        }
        console.log('Incubator ratchet passed.');
      }
      if (replacement) {
        // Updating the durable original makes a completed maintenance write recoverable too.
        const lease = readLease(lock);
        lease.original = Buffer.from(serialize(replacement)).toString('base64');
        atomicWrite(lock, JSON.stringify(lease));
      }
    } finally {
      rmSync(policy, {force: true});
    }
  });
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode ??= 2;
}
