// @ts-nocheck
/* eslint-disable import/no-nodejs-modules, no-console */

/** Same workloads and measurement loop as PR #127144, on one shared base. */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import {gzipSync} from 'node:zlib';

import {createRsbuild} from '@rsbuild/core';
import {pluginYak} from '@yak/react/rsbuild';
import {chromium} from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.artifacts/yak-benchmark');
await fs.mkdir(output, {recursive: true});
const base = '587e422c88aaf34ea81fb81ea2fec2662c3f5102';
const emotionSourceRoot = path.join(output, 'source-emotion');
await fs.mkdir(emotionSourceRoot, {recursive: true});
execFileSync('tar', ['-x', '-C', emotionSourceRoot], {
  input: execFileSync(
    'git',
    ['archive', base, 'static', 'tsconfig.json', 'tsconfig.base.json'],
    {cwd: root, maxBuffer: 128 * 1024 * 1024}
  ),
});
await fs
  .symlink(
    path.join(root, 'node_modules'),
    path.join(emotionSourceRoot, 'node_modules'),
    'dir'
  )
  .catch(error => {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  });
const variants = [
  {name: 'emotion', ref: base, sourceRoot: emotionSourceRoot},
  {name: 'yak', ref: null, sourceRoot: root},
];
const sizes = {};
const entry = await fs.readFile(path.join(root, 'scripts/yakBenchmark.tsx'), 'utf8');
for (const variant of variants) {
  const entryFile = path.join(variant.sourceRoot, '.artifacts/yak-benchmark-entry.tsx');
  await fs.mkdir(path.dirname(entryFile), {recursive: true});
  await fs.writeFile(entryFile, entry);
  const started = performance.now();
  const builder = await createRsbuild({
    cwd: root,
    rsbuildConfig: {
      mode: 'production',
      source: {
        entry: {index: entryFile},
        tsconfigPath: path.join(variant.sourceRoot, 'tsconfig.json'),
      },
      output: {
        distPath: {root: path.join(output, variant.name)},
        assetPrefix: `/${variant.name}/`,
        minify: false,
        sourceMap: false,
      },
      performance: {chunkSplit: {strategy: 'all-in-one'}},
      html: {
        tags: [
          {
            tag: 'style',
            children:
              '*{box-sizing:border-box}body{margin:0;font-family:sans-serif;font-size:14px}h1,h2,p,figure,blockquote{margin:0}a{color:inherit}.loader,[role=progressbar] *{animation:none!important}',
          },
        ],
      },
      plugins: variant.name === 'yak' ? [pluginYak({strictCssProp: false})] : [],
      tools: {
        swc: {
          jsc: {
            transform: {react: {runtime: 'automatic', importSource: '@emotion/react'}},
          },
        },
      },
    },
  });
  await builder.build();
  const assets = [];
  const walk = async dir => {
    for (const file of await fs.readdir(dir, {withFileTypes: true})) {
      const filename = path.join(dir, file.name);
      if (file.isDirectory()) {
        await walk(filename);
      } else if (/\.(css|js)$/.test(file.name)) {
        assets.push(filename);
      }
    }
  };
  await walk(path.join(output, variant.name));
  const size = {
    jsBytes: 0,
    jsGzipBytes: 0,
    cssBytes: 0,
    cssGzipBytes: 0,
    buildMs: performance.now() - started,
  };
  for (const filename of assets) {
    const bytes = await fs.readFile(filename);
    const kind = filename.endsWith('.css') ? 'css' : 'js';
    size[`${kind}Bytes`] += bytes.length;
    size[`${kind}GzipBytes`] += gzipSync(bytes).length;
  }
  sizes[variant.name] = size;
}
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const filename = path.resolve(
    output,
    '.' + pathname,
    pathname.endsWith('/') ? 'index.html' : ''
  );
  if (!filename.startsWith(output + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader(
      'Content-Type',
      filename.endsWith('.js')
        ? 'application/javascript'
        : filename.endsWith('.css')
          ? 'text/css'
          : 'text/html'
    );
    response.end(await fs.readFile(filename));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({headless: true});
const runs = [];
const checks = [];
try {
  for (const variant of variants) {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    await page.goto(`http://127.0.0.1:${port}/${variant.name}/`);
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
      const ordered = variants
        .slice(run % variants.length)
        .concat(variants.slice(0, run % variants.length));
      for (const variant of ordered) {
        const page = await browser.newPage({viewport: {width: 1440, height: 900}});
        page.on('pageerror', error => console.error(variant.name, error));
        await page.goto(`http://127.0.0.1:${port}/${variant.name}/`);
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
