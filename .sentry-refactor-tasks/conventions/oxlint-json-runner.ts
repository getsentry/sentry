#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {basename, dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

import fg from 'fast-glob';
import type {OxlintConfig} from 'oxlint';
import {z} from 'zod';

const baselineSchema = z.record(
  z.string(),
  z.record(z.string(), z.object({count: z.number().int().positive()}))
);
const outputSchema = z.object({
  number_of_files: z.number().int().nonnegative(),
  diagnostics: z.array(
    z.object({
      filename: z.string(),
      labels: z.array(z.object({span: z.object({line: z.number().int().positive()})})),
      message: z.string(),
      code: z.string().optional(),
    })
  ),
});

export function baselineFiles(data: unknown, rule: string, repoPath: string) {
  return Object.entries(baselineSchema.parse(data))
    .filter(([, rules]) => rules[rule])
    .map(([file]) => {
      const path = relative(repoPath, resolve(repoPath, file));
      assert(
        !file.includes('\\') &&
          !file.includes('\0') &&
          file.split('/').every(part => part !== '' && part !== '.' && part !== '..') &&
          !isAbsolute(file) &&
          path !== '..' &&
          !path.startsWith('../') &&
          path !== '',
        `baseline path is outside the repository: ${file}`
      );
      return file;
    });
}

export function singleRuleConfig(config: OxlintConfig, rule: string): OxlintConfig {
  const select = (rules: OxlintConfig['rules']) =>
    Object.fromEntries(Object.entries(rules ?? {}).filter(([name]) => name === rule));
  return {
    ...config,
    categories: Object.fromEntries(
      [
        'correctness',
        'suspicious',
        'pedantic',
        'perf',
        'style',
        'restriction',
        'nursery',
      ].map(category => [category, 'off'])
    ),
    options: {...config.options, reportUnusedDisableDirectives: 'off'},
    rules: {[rule]: 'error', ...select(config.rules)},
    overrides: config.overrides?.map(override => ({
      ...override,
      rules: select(override.rules),
    })),
  };
}

export function formatOutput(
  data: unknown,
  rule: string,
  repoPath: string,
  count: number
) {
  const parsed = outputSchema.parse(data);
  assert.equal(parsed.number_of_files, count, 'oxlint did not lint every selected file');
  const fatals = parsed.diagnostics.filter(d => !d.code);
  assert.equal(
    fatals.length,
    0,
    `oxlint reported parse errors: ${fatals
      .slice(0, 5)
      .map(d => `${d.filename}: ${d.message}`)
      .join('\n')}`
  );
  const slash = rule.lastIndexOf('/');
  const code =
    slash === -1
      ? `eslint(${rule})`
      : `${rule.slice(0, slash)}(${rule.slice(slash + 1)})`;
  const byFile = new Map<
    string,
    Array<{line: number; message: string; ruleId: string}>
  >();
  for (const diagnostic of parsed.diagnostics) {
    if (
      diagnostic.code !== code ||
      (rule === 'typescript/no-deprecated' &&
        !/is deprecated\.\s*\S/.test(diagnostic.message))
    ) {
      continue;
    }
    const filePath = resolve(repoPath, diagnostic.filename);
    const messages = byFile.get(filePath) ?? [];
    messages.push({
      ruleId: rule,
      message: diagnostic.message,
      line: diagnostic.labels[0]?.span.line ?? 1,
    });
    byFile.set(filePath, messages);
  }
  return [...byFile].map(([filePath, messages]) => ({filePath, messages}));
}

async function main() {
  const [repo, rule, ...scanPaths] = process.argv.slice(2);
  assert(
    repo && rule,
    'usage: oxlint-json-runner <repo-path> <rule-id> [--baseline | path...]'
  );
  const repoPath = resolve(repo);
  const baseline = scanPaths.includes('--baseline');
  assert(!baseline || scanPaths.length === 1, '--baseline cannot be combined with paths');
  const patterns = (scanPaths.length ? scanPaths : ['static']).map(p =>
    p.includes('*') || statSync(resolve(repoPath, p), {throwIfNoEntry: false})?.isFile()
      ? p
      : `${p}/**/*.{ts,tsx}`
  );
  const {default: config} = await import(
    pathToFileURL(join(repoPath, 'oxlint.config.ts')).href
  );
  const files = baseline
    ? baselineFiles(
        JSON.parse(readFileSync(join(repoPath, 'oxlint-suppressions.json'), 'utf8')),
        rule,
        repoPath
      )
    : fg.sync(patterns, {
        cwd: repoPath,
        ignore: [
          ...(config.ignorePatterns ?? []),
          '**/__fixtures__/**',
          '**/__mocks__/**',
          '**/*.spec.*',
          '**/*.test.*',
        ],
      });
  if (baseline && files.length === 0) {
    console.error(`oxlint-json-runner: ${rule} has no baseline files`);
    console.log('[]');
    return;
  }
  assert(
    files.length > 0,
    `no files matched ${JSON.stringify(patterns)} under ${repoPath}`
  );
  const require = createRequire(join(repoPath, 'package.json'));
  const cli = join(dirname(require.resolve('oxlint')), 'cli.js');
  const cwd = mkdtempSync(join(tmpdir(), 'refactor-oxlint-'));
  const configPath = join(repoPath, `${basename(cwd)}.json`);
  try {
    writeFileSync(configPath, JSON.stringify(singleRuleConfig(config, rule)), {
      flag: 'wx',
    });
    const startedAt = Date.now();
    // Native suppressions are discovered from cwd. Keep the committed baseline intact.
    const result = spawnSync(
      process.execPath,
      [
        cli,
        '--config',
        configPath,
        '--disable-nested-config',
        '--format',
        'json',
        ...files.map(file => resolve(repoPath, file)),
      ],
      {cwd, timeout: 240_000, maxBuffer: 100 * 1024 * 1024, encoding: 'utf8'}
    );
    const stderr = String(result.stderr ?? '').trim();
    assert(
      !result.error && (result.status === 0 || result.status === 1),
      `oxlint did not run to completion (exit=${result.status} signal=${result.signal} error=${result.error?.message})\n${stderr}`
    );
    assert(!/panic:|Error running tsgolint/.test(stderr), `tsgolint crashed\n${stderr}`);
    let data: unknown;
    try {
      data = JSON.parse(result.stdout);
    } catch {
      throw new Error(
        `oxlint output was not valid JSON: ${result.stdout.slice(0, 500)}\n${stderr}`
      );
    }
    const findings = formatOutput(data, rule, repoPath, files.length);
    const violations = findings.reduce((sum, file) => sum + file.messages.length, 0);
    console.error(
      `oxlint-json-runner: linted ${files.length} files in ${Math.round((Date.now() - startedAt) / 1000)}s (scanner limit 300s), ${rule} matched ${violations} violations in ${findings.length} files`
    );
    console.log(JSON.stringify(findings));
  } finally {
    rmSync(configPath, {force: true});
    rmSync(cwd, {recursive: true, force: true});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`oxlint-json-runner: ${error.message}`);
    process.exitCode = 1;
  });
}
