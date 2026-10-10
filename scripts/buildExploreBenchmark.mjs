// @ts-nocheck
/* eslint-disable import/no-nodejs-modules, no-console */
/**
 * Build the full app for the Explore page comparison, using the revisions in
 * PR #126763's measurements. All variants use the current dependency install.
 * Run: node scripts/buildExploreBenchmark.mjs
 * Outputs and source snapshots are local; no Git checkout is changed.
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.artifacts/explore-benchmark');
const variants = [
  {name: 'emotion', ref: '46966dfedca484ab452215c4f457229f22653902'},
  {name: 'stylex', ref: '7511229be32c194b2a97cc953d435baaf8a558dd'},
  {name: 'linaria', ref: null},
];

if (process.argv[2] === '--compile') {
  const [, , , name, sourceRoot, dist] = process.argv;
  const require = createRequire(path.join(root, 'package.json'));
  const {createJiti} = createRequire(require.resolve('@rsbuild/core'))('jiti');
  const jiti = createJiti(import.meta.url, {moduleCache: false, fsCache: false});
  const {configs} = await jiti.import(path.join(sourceRoot, 'rsbuild.config.ts'));
  const rspack = require('@rspack/core');
  const config = configs[0];
  config.optimization = {...config.optimization, minimize: false};
  config.output = {...config.output, path: dist, clean: true};
  config.cache = false;
  config.lazyCompilation = false;
  // Explicitly disable the React Compiler in every SWC rule.
  const visit = rule => {
    for (const child of [...(rule.oneOf ?? []), ...(rule.rules ?? [])]) {
      visit(child);
    }
    for (const loader of [rule, ...(Array.isArray(rule.use) ? rule.use : [rule.use])]) {
      if (loader?.options?.jsc?.transform) {
        loader.options.jsc.transform.reactCompiler = false;
      }
    }
  };
  for (const rule of config.module.rules) {
    visit(rule);
  }
  const compiler = rspack.rspack(config);
  const buildStats = await new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error || closeError || stats?.hasErrors()) {
          reject(
            error ?? closeError ?? new Error(stats.toString({all: false, errors: true}))
          );
        } else {
          console.log(
            `${name}: ${stats.toString({all: false, timings: true, warnings: true})}`
          );
          resolve(stats);
        }
      });
    });
  });
  const entrypoints = {};
  for (const [entryName, entry] of buildStats.compilation.entrypoints) {
    entrypoints[entryName] = entry.getFiles().filter(file => /\.(js|css)$/.test(file));
  }
  await fs.writeFile(
    path.join(dist, 'benchmark-build.json'),
    JSON.stringify({name, entrypoints})
  );
} else {
  const metadata = [];
  for (const variant of variants) {
    const sourceRoot = variant.ref
      ? path.join(os.tmpdir(), 'explore-benchmark-sources', variant.name)
      : root;
    const dist = path.join(output, 'builds', variant.name);
    await fs.mkdir(sourceRoot, {recursive: true});
    await fs.mkdir(dist, {recursive: true});
    if (variant.ref) {
      const archive = execFileSync(
        'git',
        [
          'archive',
          variant.ref,
          'static',
          'build-utils',
          'config',
          'src/sentry/static',
          'src/sentry/locale',
          'rsbuild.config.ts',
          'package.json',
          'tsconfig.json',
        ],
        {cwd: root, maxBuffer: 256 * 1024 * 1024}
      );
      execFileSync('tar', ['-x', '-C', sourceRoot], {input: archive});
      await fs.copyFile(
        path.join(root, 'src/sentry/locale/catalogs.json'),
        path.join(sourceRoot, 'src/sentry/locale/catalogs.json')
      );
      const modules = path.join(sourceRoot, 'node_modules');
      await fs.mkdir(modules, {recursive: true});
      for (const entry of await fs.readdir(path.join(root, 'node_modules'))) {
        if (entry !== '@stylexjs') {
          try {
            await fs.symlink(
              path.join(root, 'node_modules', entry),
              path.join(modules, entry)
            );
          } catch (error) {
            if (error.code !== 'EEXIST') {
              throw error;
            }
          }
        }
      }
      if (variant.name === 'stylex') {
        const tools = process.env.STYLEX_BENCHMARK_TOOLS ?? '/tmp/linaria-stylex-tools';
        try {
          await fs.symlink(
            path.join(tools, 'node_modules/@stylexjs'),
            path.join(modules, '@stylexjs')
          );
        } catch (error) {
          if (error.code !== 'EEXIST') {
            throw error;
          }
        }
      }
    }
    console.log(`Building ${variant.name}...`);
    execFileSync(
      process.execPath,
      [import.meta.filename, '--compile', variant.name, sourceRoot, dist],
      {
        cwd: sourceRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          NODE_OPTIONS: '--max-old-space-size=4096',
          SENTRY_EXPERIMENTAL_SPA: '1',
          SENTRY_UI_DEV_ONLY: '',
          NOW_GITHUB_DEPLOYMENT: '',
          IS_ACCEPTANCE_TEST: '',
          WEBPACK_CACHE_PATH: '',
        },
      }
    );
    metadata.push({...variant, sourceRoot, dist});
  }
  await fs.writeFile(path.join(output, 'builds.json'), JSON.stringify(metadata, null, 2));
  console.log('All production app builds are ready.');
}
