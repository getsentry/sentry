import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

/**
 * Pins a repository's `@sentry/api` to its newest npm release, for
 * `bump-sentry-api-consumer.yml`. Run it from the consumer's checkout.
 *
 * `BUMP_PIN` says where the consumer pins the package:
 * - `dependency`: an exact version in `package.json`.
 * - `catalog`: the `pnpm-workspace.yaml` catalog, plus a matching
 *   `minimumReleaseAgeExclude` entry so a fresh release installs.
 *
 * `BUMP_MODE` says what to do with the bump:
 * - `merge`: open a PR for it and merge it with `--admin`.
 * - `rolling-pr`: keep one PR on the newest release and never merge it. Each
 *   new release rebuilds the PR's branch from the default branch. When someone
 *   has pushed their own commit to it, the branch is left alone with a warning,
 *   so the commit is not lost.
 */

const PACKAGE = '@sentry/api';
const WORKSPACE = 'pnpm-workspace.yaml';
const PACKAGE_JSON = 'package.json';
const LOCKFILE = 'pnpm-lock.yaml';
const ROLLING_BRANCH = 'bot/bump-sentry-api';
// The default commit author. BUMP_AUTHOR_NAME and BUMP_AUTHOR_EMAIL override it.
const BOT_NAME = 'github-actions[bot]';
const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';

const CATALOG_ENTRY = /^(\s+"@sentry\/api":\s*)(\S+)\s*$/m;
const RELEASE_AGE_ENTRY = /^(\s+-\s*"@sentry\/api@)([^"]+)("\s*)$/m;

/**
 * Return pnpm-workspace.yaml with `@sentry/api` pinned to `version`, in the
 * catalog and in `minimumReleaseAgeExclude`, which lets a fresh release
 * install. Throws when either entry is missing.
 */
export function pinSentryApi(workspace, version) {
  for (const [pattern, name] of [
    [CATALOG_ENTRY, 'catalog'],
    [RELEASE_AGE_ENTRY, 'minimumReleaseAgeExclude'],
  ]) {
    const count = workspace.match(new RegExp(pattern.source, 'gm'))?.length;
    if (count !== 1) {
      throw new Error(
        `${WORKSPACE} needs one ${name} entry for ${PACKAGE}, found ${count ?? 0}`
      );
    }
  }
  const catalog = CATALOG_ENTRY.exec(workspace);
  return {
    current: catalog[2],
    workspace: workspace
      .replace(CATALOG_ENTRY, (_, key) => `${key}${version}`)
      .replace(RELEASE_AGE_ENTRY, (_, start, _old, end) => `${start}${version}${end}`),
  };
}

/** The exact `@sentry/api` version a package.json depends on. */
export function dependencyVersion(packageJson) {
  const {dependencies = {}, devDependencies = {}} = JSON.parse(packageJson);
  const version = dependencies[PACKAGE] ?? devDependencies[PACKAGE];
  if (!isRelease(version ?? '')) {
    throw new Error(
      `${PACKAGE_JSON} needs an exact ${PACKAGE} version, found ${version ?? 'none'}`
    );
  }
  return version;
}

/** Whether `version` is a stable release, such as 2.5.1. */
export function isRelease(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

/**
 * What to do about the rolling bump PR. `main` and `branch` are the versions
 * pinned on the default branch and on the open bump PR's branch (undefined
 * without an open PR); `foreignCommits` counts the branch's commits not made by
 * this script.
 */
export function planBump({latest, main, branch, foreignCommits = 0}) {
  if (main === latest) return 'none';
  if (branch === undefined) return 'open';
  if (branch === latest) return 'none';
  return foreignCommits > 0 ? 'keep' : 'update';
}

/** How each `BUMP_PIN` reads, writes and commits the pin. */
const PINS = {
  dependency: {
    file: PACKAGE_JSON,
    version: dependencyVersion,
    write: version =>
      run('pnpm', ['add', '--save-exact', '--lockfile-only', `${PACKAGE}@${version}`], {
        stdio: ['ignore', 'inherit', 'inherit'],
      }),
  },
  catalog: {
    file: WORKSPACE,
    version: source => pinSentryApi(source, '0.0.0').current,
    write: version => {
      writeFileSync(
        WORKSPACE,
        pinSentryApi(readFileSync(WORKSPACE, 'utf8'), version).workspace
      );
      run('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
        stdio: ['ignore', 'inherit', 'inherit'],
      });
    },
  },
};

const MODES = ['merge', 'rolling-pr'];

/** The validated `BUMP_PIN` and `BUMP_MODE` settings, and the commit author. */
export function readConfig(env) {
  if (!Object.hasOwn(PINS, env.BUMP_PIN ?? '')) {
    throw new Error(
      `BUMP_PIN must be one of ${Object.keys(PINS).join(', ')}, got: ${env.BUMP_PIN}`
    );
  }
  if (!MODES.includes(env.BUMP_MODE)) {
    throw new Error(
      `BUMP_MODE must be one of ${MODES.join(', ')}, got: ${env.BUMP_MODE}`
    );
  }
  return {
    pin: PINS[env.BUMP_PIN],
    mode: env.BUMP_MODE,
    author: {
      name: env.BUMP_AUTHOR_NAME || BOT_NAME,
      email: env.BUMP_AUTHOR_EMAIL || BOT_EMAIL,
    },
  };
}

function run(command, args, options = {}) {
  return (
    execFileSync(command, args, {
      encoding: 'utf8',
      timeout: 600_000,
      stdio: ['ignore', 'pipe', 'inherit'],
      ...options,
    })
      // execFileSync returns null when stdout is inherited.
      ?.trim()
  );
}

/** Commit the pin on `branch`, starting from the current checkout. */
function commitPin(pin, author, branch, title) {
  run('git', ['checkout', '-B', branch]);
  run('git', ['add', pin.file, LOCKFILE]);
  run('git', ['commit', '-m', title], {
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_COMMITTER_NAME: author.name,
      GIT_COMMITTER_EMAIL: author.email,
    },
  });
}

/** The number of the open PR from `branch`, or empty. */
function openPr(branch) {
  return run('gh', [
    'pr',
    'list',
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'number',
    '--jq',
    '.[0].number // empty',
  ]);
}

/** Open a PR for the pin and merge it. */
function bumpAndMerge(pin, author, latest, title) {
  // A run that stopped before the merge leaves this branch, and maybe its PR,
  // behind. Overwrite the branch and reuse an open PR so the next run finishes.
  const branch = `bot/bump-sentry-api-to-${latest}`;
  commitPin(pin, author, branch, title);
  run('git', ['push', '--force', 'origin', `HEAD:refs/heads/${branch}`]);
  if (!openPr(branch)) {
    run('gh', ['pr', 'create', '--fill', '--head', branch]);
  }
  run('gh', ['pr', 'merge', branch, '--squash', '--admin', '--delete-branch']);
}

/** Keep one unmerged PR on the newest release. */
function bumpRollingPr(pin, author, latest, current, title, body) {
  const pr = openPr(ROLLING_BRANCH);
  // The remote branch's commit, or empty when it does not exist. Pushing with
  // it as the lease fails if the branch moves while this runs.
  const remote = run('git', [
    'ls-remote',
    'origin',
    `refs/heads/${ROLLING_BRANCH}`,
  ]).split(/\s/)[0];
  let branch;
  let foreignCommits = 0;
  if (pr && remote) {
    const base = run('git', ['rev-parse', 'HEAD']);
    run('git', ['fetch', '--quiet', 'origin', ROLLING_BRANCH]);
    branch = pin.version(run('git', ['show', `${remote}:${pin.file}`]));
    // Merging the default branch into the PR, such as with GitHub's "Update
    // branch", adds nothing the rebuild would lose, so merges don't count.
    foreignCommits = run('git', [
      'log',
      '--no-merges',
      '--format=%ae',
      `${base}..${remote}`,
    ])
      .split('\n')
      .filter(email => email && email !== author.email).length;
  }

  const plan = planBump({latest, main: current, branch, foreignCommits});
  if (plan === 'none') {
    console.log(`${PACKAGE} ${latest} is already pinned${branch ? ` in #${pr}` : ''}.`);
    return;
  }
  if (plan === 'keep') {
    console.log(
      `::warning::#${pr} has commits not made by this script, so it stays on ${PACKAGE} ${branch}. Rebase it onto ${latest} by hand, or close it to let the next run open a new one.`
    );
    return;
  }

  console.log(`Pinning ${PACKAGE} ${latest} (the default branch has ${current}).`);
  pin.write(latest);
  commitPin(pin, author, ROLLING_BRANCH, title);
  // A leftover branch from a closed PR is overwritten too.
  run('git', [
    'push',
    `--force-with-lease=refs/heads/${ROLLING_BRANCH}:${remote}`,
    'origin',
    `HEAD:refs/heads/${ROLLING_BRANCH}`,
  ]);
  if (plan === 'update') {
    run('gh', ['pr', 'edit', pr, '--title', title, '--body', body]);
  } else {
    run('gh', [
      'pr',
      'create',
      '--head',
      ROLLING_BRANCH,
      '--title',
      title,
      '--body',
      body,
    ]);
  }
}

function main() {
  const {pin, mode, author} = readConfig(process.env);
  const latest = run('npm', ['view', PACKAGE, 'version']);
  if (!isRelease(latest)) {
    throw new Error(`Expected a release version of ${PACKAGE}, got: ${latest}`);
  }
  const current = pin.version(readFileSync(pin.file, 'utf8'));

  const release = `[${latest}](https://github.com/getsentry/sentry/releases/tag/api@${latest})`;
  if (mode === 'merge') {
    if (current === latest) {
      console.log(`${PACKAGE} is already ${latest}, skipping.`);
      return;
    }
    console.log(`Bumping ${PACKAGE} from ${current} to ${latest}.`);
    pin.write(latest);
    bumpAndMerge(pin, author, latest, `Bump ${PACKAGE} to ${latest}`);
    return;
  }
  bumpRollingPr(
    pin,
    author,
    latest,
    current,
    `chore(deps): Bump ${PACKAGE} to ${latest}`,
    `Pins ${PACKAGE} to ${release}, so CI checks this repository against the release. getsentry/sentry's \`bump-sentry-api-consumer.yml\` updates this PR when a newer release ships and never merges it.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
