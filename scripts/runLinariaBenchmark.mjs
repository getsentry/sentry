// @ts-nocheck
/* eslint-disable import/no-nodejs-modules, no-console, boundaries/dependencies */
/**
 * Controlled component benchmark, separate from the Explore Traces replay.
 * Setup: npm install --prefix /tmp/linaria-stylex-tools --no-package-lock --ignore-scripts
 *   @stylexjs/stylex@0.19.1 @stylexjs/babel-plugin@0.19.1 @babel/core@7.29.7
 * Run: BENCHMARK_RUNS=15 node scripts/runLinariaBenchmark.mjs
 * Results and bundles: .artifacts/linaria-benchmark/
 * Uses production React, no minification or React Compiler, Chromium at 1x CPU,
 * 1440x900. Mount/update timings include a forced layout, exclude navigation,
 * and rotate variant order. The same dependency installation serves all builds.
 */
import {Buffer} from 'node:buffer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {gzipSync} from 'node:zlib';

import {build} from 'esbuild';
import {chromium} from 'playwright';

// The benchmark uses the same compiler as the app.
import {
  collectLinariaCss,
  needsLinariaTransform,
  transformLinaria,
} from '../build-utils/linaria.ts';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.artifacts/linaria-benchmark');
const stylexTools = process.env.STYLEX_BENCHMARK_TOOLS ?? '/tmp/linaria-stylex-tools';
const requireTools = createRequire(path.join(stylexTools, 'package.json'));
const {transformAsync} = requireTools('@babel/core');
const stylexPlugin = requireTools('@stylexjs/babel-plugin');
const variants = [
  {name: 'emotion', ref: '46966dfedca484ab452215c4f457229f22653902'},
  {name: 'stylex', ref: '7511229be32c194b2a97cc953d435baaf8a558dd'},
  {name: 'linaria', ref: null},
];

const entry = await fs.readFile(path.join(root, 'scripts/linariaBenchmark.tsx'), 'utf8');
const sizes = {};
for (const variant of variants) {
  const sourceRoot = variant.ref
    ? path.join(os.tmpdir(), 'linaria-benchmark-sources', variant.name)
    : root;
  if (variant.ref) {
    await fs.mkdir(sourceRoot, {recursive: true});
    const archive = execFileSync(
      'git',
      ['archive', variant.ref, 'static', 'tsconfig.json', 'package.json'],
      {cwd: root, maxBuffer: 128 * 1024 * 1024}
    );
    execFileSync('tar', ['-x', '-C', sourceRoot], {input: archive});
  }
  const css = [];
  const stylexRules = [];
  const started = performance.now();
  const bundle = await build({
    stdin: {
      contents: entry,
      resolveDir: sourceRoot,
      sourcefile: 'linariaBenchmark.tsx',
      loader: 'tsx',
    },
    tsconfig: path.join(sourceRoot, 'tsconfig.json'),
    outfile: path.join(output, `${variant.name}.js`),
    bundle: true,
    write: false,
    minify: false,
    jsx: 'automatic',
    jsxImportSource: '@emotion/react',
    platform: 'browser',
    metafile: true,
    nodePaths: [path.join(root, 'node_modules')],
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.IS_ACCEPTANCE_TEST': 'false',
      'process.env.DEPLOY_PREVIEW_CONFIG': 'false',
      'process.env.EXPERIMENTAL_SPA': 'false',
      'process.env.USE_TANSTACK_DEVTOOL': 'false',
    },
    plugins: [
      {
        name: 'spike-styles',
        setup(bundler) {
          bundler.onResolve({filter: /^linaria-benchmark-theme$/}, () => ({
            path: 'theme',
            namespace: 'benchmark-theme',
          }));
          bundler.onLoad({filter: /.*/, namespace: 'benchmark-theme'}, () => ({
            resolveDir: sourceRoot,
            contents:
              variant.name === 'emotion'
                ? "export const darkThemeClassName = '';"
                : variant.name === 'stylex'
                  ? "import * as stylex from '@stylexjs/stylex'; import {stylexDarkTheme} from '@sentry/scraps/theme/darkTheme'; export const darkThemeClassName = stylex.props(stylexDarkTheme).className;"
                  : "export {linariaDarkTheme as darkThemeClassName} from '@sentry/scraps/theme/darkTheme';",
            loader: 'js',
          }));
          bundler.onResolve({filter: /^react-router(?:\/dom)?$/}, args => {
            if (
              args.importer.includes('/node_modules/') ||
              args.importer.includes('/reactRouterV6/')
            ) {
              return null;
            }
            return {
              path: path.join(
                sourceRoot,
                'static/app/utils/reactRouterV6',
                args.path.endsWith('/dom') ? 'dom.ts' : 'index.ts'
              ),
            };
          });
          bundler.onResolve({filter: /^@stylexjs\/stylex$/}, () => ({
            path: requireTools.resolve('@stylexjs/stylex'),
          }));
          bundler.onLoad({filter: /\.(tsx?|jsx?)$/}, async ({path: filename}) => {
            if (filename.includes('/node_modules/')) {
              return null;
            }
            const source = await fs.readFile(filename, 'utf8');
            if (variant.name === 'stylex' && source.includes('@stylexjs/stylex')) {
              const result = await transformAsync(source, {
                filename,
                babelrc: false,
                configFile: false,
                parserOpts: {plugins: ['typescript', 'jsx']},
                plugins: [
                  [
                    stylexPlugin,
                    {
                      dev: false,
                      test: false,
                      runtimeInjection: false,
                      treeshakeCompensation: true,
                      propertyValidationMode: 'throw',
                      aliases: {
                        '@sentry/scraps/*': [
                          path.join(sourceRoot, 'static/packages/scraps/src/*'),
                          path.join(sourceRoot, 'static/app/components/core/*'),
                        ],
                      },
                      unstable_moduleResolution: {type: 'commonJS', rootDir: sourceRoot},
                    },
                  ],
                ],
              });
              stylexRules.push(...(result.metadata.stylex ?? []));
              return {
                contents: result.code,
                loader: filename.endsWith('tsx') ? 'tsx' : 'ts',
              };
            }
            if (variant.name === 'linaria' && needsLinariaTransform(source)) {
              const result = await transformLinaria(source, filename);
              return {
                contents: result.code,
                loader: filename.endsWith('tsx') ? 'tsx' : 'ts',
              };
            }
            return null;
          });
          bundler.onLoad({filter: /\.svg$/}, () => ({
            contents: 'export default ""',
            loader: 'js',
          }));
          bundler.onLoad({filter: /\.css$/}, () => ({contents: '', loader: 'css'}));
        },
      },
    ],
  });
  if (variant.name === 'linaria') {
    css.push(await collectLinariaCss());
  }
  if (variant.name === 'stylex') {
    css.push(
      stylexPlugin.processStylexRules(stylexRules, {
        useLayers: false,
        legacyDisableLayers: true,
      })
    );
  }
  const compiledCss = css.join('\n');
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).contents;
  await fs.writeFile(path.join(output, `${variant.name}.js`), js);
  await fs.writeFile(path.join(output, `${variant.name}.css`), compiledCss);
  await fs.writeFile(
    path.join(output, `${variant.name}.meta.json`),
    JSON.stringify(bundle.metafile)
  );
  sizes[variant.name] = {
    jsBytes: js.length,
    jsGzipBytes: gzipSync(js).length,
    cssBytes: Buffer.byteLength(compiledCss),
    cssGzipBytes: gzipSync(compiledCss).length,
    buildMs: performance.now() - started,
  };
  console.log(variant.name, sizes[variant.name]);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const requestedVariant = url.searchParams.get('variant');
  const variant =
    requestedVariant === 'emotion'
      ? 'emotion'
      : requestedVariant === 'stylex'
        ? 'stylex'
        : 'linaria';
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    response.setHeader(
      'Content-Type',
      url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css'
    );
    response.end(await fs.readFile(path.join(output, path.basename(url.pathname))));
    return;
  }
  response.end(
    `<!doctype html><html><head><link rel="stylesheet" href="/${variant}.css"><style>*{box-sizing:border-box}body{margin:0;font-family:sans-serif;font-size:14px}h1,h2,p,figure,blockquote{margin:0}a{color:inherit}.loader,[role=progressbar] *{animation:none!important}</style></head><body><div id="root"></div><script src="/${variant}.js"></script></body></html>`
  );
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({headless: true});
const runs = [];
const checks = [];
try {
  for (const variant of variants) {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    await page.goto(`http://127.0.0.1:${port}/?variant=${variant.name}`);
    await page.waitForFunction(() => typeof window.benchmarkCheck === 'function');
    for (const width of [600, 1440]) {
      await page.setViewportSize({width, height: 900});
      for (const dark of [false, true]) {
        const styles = await page.evaluate(
          selectedDark => window.benchmarkCheck(selectedDark),
          dark
        );
        checks.push({variant: variant.name, width, dark, styles});
      }
    }
    await page.close();
  }
  for (const check of checks) {
    const baseline = checks.find(
      other =>
        other.variant === 'emotion' &&
        other.width === check.width &&
        other.dark === check.dark
    );
    if (JSON.stringify(check.styles) !== JSON.stringify(baseline.styles)) {
      throw new Error(`Visual parity failed: ${JSON.stringify({check, baseline})}`);
    }
  }
  const repetitions = Number(process.env.BENCHMARK_RUNS ?? 15);
  for (const workload of [
    {name: 'layout', count: 750, mixed: false},
    {name: 'mixed', count: 250, mixed: true},
  ]) {
    for (let run = 0; run < repetitions; run++) {
      // Rotate first, middle and last positions to reduce run-order bias.
      const ordered = variants.slice(run % 3).concat(variants.slice(0, run % 3));
      for (const variant of ordered) {
        const page = await browser.newPage({viewport: {width: 1440, height: 900}});
        page.on('pageerror', error => console.error(variant.name, error));
        await page.goto(`http://127.0.0.1:${port}/?variant=${variant.name}`);
        await page.waitForFunction(() => typeof window.benchmarkRender === 'function');
        await page.evaluate(() => {
          window.cssInsertions = {count: 0, ms: 0};
          const insert = CSSStyleSheet.prototype.insertRule;
          CSSStyleSheet.prototype.insertRule = function (...args) {
            const start = performance.now();
            const result = insert.apply(this, args);
            window.cssInsertions.count++;
            window.cssInsertions.ms += performance.now() - start;
            return result;
          };
        });
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        for (const [step, phase] of [0, 1, 0].entries()) {
          const before = Object.fromEntries(
            (await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value])
          );
          const timing = await page.evaluate(
            ({workload: fixture, phase: nextPhase}) => {
              const start = performance.now();
              const height = window.benchmarkRender(
                fixture.count,
                nextPhase,
                fixture.mixed
              );
              return {
                ms: performance.now() - start,
                height,
                insertions: {...window.cssInsertions},
                nodes: document.querySelectorAll('#root *').length,
              };
            },
            {workload, phase}
          );
          const after = Object.fromEntries(
            (await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value])
          );
          const metrics = Object.fromEntries(
            [
              'TaskDuration',
              'ScriptDuration',
              'RecalcStyleDuration',
              'LayoutDuration',
              'RecalcStyleCount',
              'LayoutCount',
            ].map(key => [key, after[key] - before[key]])
          );
          runs.push({
            variant: variant.name,
            workload: workload.name,
            run,
            operation: ['mount', 'update', 'cachedUpdate'][step],
            ...timing,
            metrics,
          });
          await page.evaluate(
            () =>
              new Promise(resolve =>
                requestAnimationFrame(() => requestAnimationFrame(resolve))
              )
          );
        }
        await page.close();
      }
    }
    console.log(`Completed ${workload.name} workload`);
  }
  const median = values =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summary = [];
  for (const workload of ['layout', 'mixed']) {
    for (const operation of ['mount', 'update', 'cachedUpdate']) {
      for (const variant of variants) {
        const samples = runs.filter(
          run =>
            run.variant === variant.name &&
            run.workload === workload &&
            run.operation === operation
        );
        summary.push({
          workload,
          operation,
          variant: variant.name,
          samples: samples.length,
          medianMs: median(samples.map(s => s.ms)),
          medianRecalcStyleMs: median(
            samples.map(s => s.metrics.RecalcStyleDuration * 1000)
          ),
          medianLayoutMs: median(samples.map(s => s.metrics.LayoutDuration * 1000)),
          nodes: samples[0].nodes,
          height: samples[0].height,
          cssInsertions: samples[0].insertions.count,
        });
      }
    }
  }
  const results = {
    date: new Date().toISOString(),
    browser: browser.version(),
    viewport: {width: 1440, height: 900},
    cpuThrottling: 1,
    reactCompiler: false,
    minify: false,
    variants,
    sizes,
    checks,
    summary,
    runs,
  };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.table(summary);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
