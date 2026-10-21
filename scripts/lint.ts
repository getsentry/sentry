import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';

const [language, ...args] = process.argv.slice(2);
assert(language === 'js' || language === 'css', 'Expected js or css');
assert(
  language !== 'js' ||
    !args.some(arg =>
      ['--check', '--ci', '--enroll', '--prune', '--backlog', '--snapshot'].includes(arg)
    ),
  'Use pnpm run lint:suppressions for suppression maintenance.'
);
const inspect = args.some(arg =>
  ['--help', '-h', '--version', '-V', '-v', '--print-config', '--rules'].includes(arg)
);

function run(options: string[], cwd = process.cwd()) {
  const result = spawnSync('pnpm', options, {stdio: 'inherit', cwd});
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

// `pnpm run` joins arguments into one shell string, which overflows on large file lists.
function scriptCommand(directory: string, name: string) {
  const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const script: unknown = manifest?.scripts?.[name];
  assert(
    typeof script === 'string' && /^[\w@./:=-]+( [\w@./:=-]+)*$/.test(script),
    `Expected ${name} in ${directory} to be a plain command`
  );
  return ['exec', ...script.split(' ')];
}

const {positionals, tokens} = parseArgs({
  args: inspect ? [] : args,
  strict: false,
  allowPositionals: true,
  tokens: true,
  options: {
    format: {type: 'string', short: 'f'},
    formatter: {type: 'string', short: 'f'},
    threads: {type: 'string'},
    tsconfig: {type: 'string'},
    allow: {type: 'string', short: 'A'},
    warn: {type: 'string', short: 'W'},
    deny: {type: 'string', short: 'D'},
    debug: {type: 'string'},
    'max-warnings': {type: 'string'},
    'report-unused-disable-directives-severity': {type: 'string'},
    config: {type: 'string', short: 'c'},
    'config-basedir': {type: 'string'},
    'custom-syntax': {type: 'string'},
    'ignore-path': {type: 'string', short: 'i'},
    'ignore-pattern': {type: 'string'},
    'cache-location': {type: 'string'},
    'cache-strategy': {type: 'string'},
    'custom-formatter': {type: 'string'},
    'output-file': {type: 'string', short: 'o'},
    'globby-options': {type: 'string'},
    'stdin-filename': {type: 'string'},
    'suppress-location': {type: 'string'},
    ip: {type: 'string'},
    mw: {type: 'string'},
    go: {type: 'string'},
  },
});
const packageArgs = tokens.flatMap(token => {
  if (token.kind !== 'option') {
    return [];
  }
  return args.slice(token.index, token.index + (token.inlineValue === false ? 2 : 1));
});

function lintArgs(files: string[]) {
  const options = [...packageArgs];
  if (language === 'js' && !options.includes('--no-error-on-unmatched-pattern')) {
    options.unshift('--no-error-on-unmatched-pattern');
  }
  return [
    ...options,
    ...(language === 'css' && files.length === 0 ? ['**/*.[jt]sx'] : files),
  ];
}

if (inspect) {
  process.exitCode = run(['run', `lint:${language}:root`, ...args]);
} else if (positionals.length === 0) {
  const rootStatus = run(['run', `lint:${language}:root`, ...lintArgs([])]);
  process.exitCode =
    rootStatus ||
    run([
      '--recursive',
      '--parallel',
      '--no-bail',
      '--no-include-workspace-root',
      '--if-present',
      'run',
      `lint:${language}`,
      ...packageArgs,
    ]);
} else {
  const listed = spawnSync('pnpm', ['list', '--recursive', '--json', '--depth', '-1'], {
    encoding: 'utf8',
  });
  if (listed.error) {
    throw listed.error;
  }
  assert.equal(listed.status, 0, listed.stderr);
  const workspaces: unknown = JSON.parse(listed.stdout);
  assert(Array.isArray(workspaces), 'Invalid pnpm workspace list');
  const projects: string[] = [];
  for (const workspace of workspaces) {
    assert(
      workspace &&
        typeof workspace === 'object' &&
        'path' in workspace &&
        typeof workspace.path === 'string'
    );
    if (workspace.path === process.cwd()) {
      continue;
    }
    const manifest: unknown = JSON.parse(
      readFileSync(path.join(workspace.path, 'package.json'), 'utf8')
    );
    assert(manifest && typeof manifest === 'object');
    if (
      'scripts' in manifest &&
      manifest.scripts &&
      typeof manifest.scripts === 'object' &&
      `lint:${language}` in manifest.scripts
    ) {
      projects.push(workspace.path);
    }
  }
  projects.sort((a, b) => b.length - a.length);
  const selected = new Map<string, string[]>();
  for (const file of positionals) {
    const absolute = path.resolve(file);
    const project =
      projects.find(
        directory => absolute === directory || absolute.startsWith(directory + path.sep)
      ) ?? process.cwd();
    const files = selected.get(project) ?? [];
    files.push(path.relative(project, absolute) || '.');
    selected.set(project, files);
  }
  let status = 0;
  const rootFiles = selected.get(process.cwd());
  if (rootFiles) {
    status = run([
      ...scriptCommand(process.cwd(), `lint:${language}:root`),
      ...lintArgs(rootFiles),
    ]);
    selected.delete(process.cwd());
  }
  if (status === 0) {
    for (const [project, files] of selected) {
      // A package's Stylelint task has a full-scan glob. Use explicit paths here
      // so file-scoped fixes cannot also change unselected files.
      const command =
        language === 'css'
          ? ['exec', 'stylelint', '--allow-empty-input']
          : scriptCommand(project, 'lint:js');
      const result = run([...command, ...lintArgs(files)], project);
      status ||= result;
    }
  }
  process.exitCode = status;
}
