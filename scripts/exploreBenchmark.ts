// Adapted from PR #126763 at 7931c1e3256; see PR #127144, comment 6151608770.
/**
 * User-facing benchmark of Explore → Traces with replayed API data, used to
 * compare styling approaches (Emotion, StyleX, Linaria, Yak) build against build.
 *
 *   node scripts/exploreBenchmark.ts serve <worktree> <port>
 *   node scripts/exploreBenchmark.ts record <port> <recording.json>
 *   node scripts/exploreBenchmark.ts run <recording.json> <outDir> <reps> <cpuThrottle> <label:port>...
 *   node scripts/exploreBenchmark.ts compare <labelA> <labelB> <results.json>...
 *   node scripts/exploreBenchmark.ts bytes <recording.json> <label:port>...
 *
 * `serve` builds and serves a checkout in production mode (no minification,
 * no React Compiler, source maps) through the dev-ui proxy. `record` loads the
 * page once against live data and saves every /api/ and /region/ response.
 * `run` replays those responses byte for byte to every build (third-party
 * requests are aborted), alternating the build order per repetition, and
 * measures per run:
 *   - load: app shell and spans table rows rendered, LCP, Total Blocking Time
 *     and long animation frames until the table is populated (warm reload)
 *   - interactions: Event Timing latency (what INP is built on) of six
 *     scripted interactions
 * `compare` pools the given results files and prints medians and a two-sided
 * Mann-Whitney U p-value per metric.
 * `bytes` reports JS/CSS bytes loaded and CSS rules present after load.
 *
 * Environment:
 *   BENCH_ORG    org slug used as the dev-ui subdomain (required)
 *   BENCH_STATE  Playwright storageState JSON of a session logged in through
 *                the dev-ui proxy (required by `record`; `run` and `bytes`
 *                replay every API response and work without one)
 *
 * Recordings contain the logged-in account's API responses: keep them out of
 * the repository and out of shared places.
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {type BrowserContext, chromium, type Page} from 'playwright';

const PAGE = '/explore/traces/?project=-1&statsPeriod=24h';

type Recording = Record<
  string,
  {body: string; headers: Record<string, string>; status: number}
>;

interface UxState {
  events: Array<[string, number, number, number]>;
  fcp: number | null;
  lastActivity: number;
  lcp: number | null;
  loafs: Array<[number, number, number]>;
  longTasks: Array<[number, number]>;
  marks: {rows?: number; shell?: number};
}

declare global {
  interface Window {
    __ux: UxState;
  }
}

interface LoadMetrics {
  fcpMs: number | null;
  lcpMs: number | null;
  loafBlockingMs: number;
  loafMs: number;
  longTaskMs: number;
  maxLoafMs: number;
  rowsMs: number | null;
  shellMs: number | null;
  tbtMs: number;
}

interface RunResult {
  error?: string;
  interactionErrors?: string[];
  interactions?: Record<string, number | null>;
  label?: string;
  load?: LoadMetrics;
  loadTimedOut?: boolean;
  misses?: string[];
  rep?: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name} (see the header of scripts/exploreBenchmark.ts)`);
  }
  return value;
}

function pageUrl(port: string) {
  return `https://${requireEnv('BENCH_ORG')}.dev.getsentry.net:${port}${PAGE}`;
}

function parseSides(sides: string[]) {
  return sides.map(side => {
    const [label = '', port = ''] = side.split(':');
    return {label, port};
  });
}

async function newContext(withState: boolean) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  });
  let storageState: Exclude<
    Parameters<typeof browser.newContext>[0],
    undefined
  >['storageState'];
  if (withState) {
    const state = JSON.parse(fs.readFileSync(requireEnv('BENCH_STATE'), 'utf8'));
    for (const cookie of state.cookies ?? []) {
      if (cookie.domain === 'sentry.io' || cookie.domain.endsWith('.sentry.io')) {
        cookie.domain = cookie.domain.replace(/sentry\.io$/, 'dev.getsentry.net');
      }
      const sameSite = String(cookie.sameSite ?? '').toLowerCase();
      cookie.sameSite =
        sameSite === 'strict' ? 'Strict' : sameSite === 'none' ? 'None' : 'Lax';
    }
    storageState = state;
  }
  const ctx = await browser.newContext({
    storageState,
    viewport: {width: 1440, height: 900},
    ignoreHTTPSErrors: true,
  });
  return {browser, ctx};
}

/**
 * Records (when `record` is set) or replays /api/ and /region/ responses.
 * Unrecorded requests get an empty 404 rather than live data, so every build
 * sees the same thing; they are reported as misses.
 */
async function routeApi(
  ctx: BrowserContext,
  recording: Recording,
  misses: Set<string>,
  record = false
) {
  await ctx.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!url.hostname.endsWith('dev.getsentry.net')) {
      // Third-party requests (avatars, analytics): identical for every build.
      return route.abort();
    }
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/region/')) {
      return route.continue();
    }
    const key = `${req.method()} ${url.pathname}${url.search}`;
    if (record) {
      const resp = await route.fetch();
      const body = await resp.body();
      const headers = Object.fromEntries(
        Object.entries(resp.headers()).filter(
          ([k]) =>
            ![
              'content-encoding',
              'content-length',
              'transfer-encoding',
              'set-cookie',
            ].includes(k)
        )
      );
      recording[key] ??= {status: resp.status(), headers, body: body.toString('base64')};
      return route.fulfill({status: resp.status(), headers, body});
    }
    const hit = recording[key];
    if (hit) {
      return route.fulfill({
        status: hit.status,
        headers: hit.headers,
        body: Buffer.from(hit.body, 'base64'),
      });
    }
    misses.add(key);
    return route.fulfill({status: 404, contentType: 'application/json', body: '{}'});
  });
}

/** Catch a lost build-time CSS transform before accepting timing samples. */
async function assertExtractedStyles(page: Page) {
  const valid = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.yk-display'));
    if (!elements.length) {
      return true;
    }
    const hasRules = Array.from(document.styleSheets).some(sheet => {
      try {
        return Array.from(sheet.cssRules).some(rule =>
          rule.cssText.includes('var(--yk-display)')
        );
      } catch {
        return false;
      }
    });
    return (
      hasRules &&
      elements.some(
        element =>
          getComputedStyle(element).display ===
          element.style.getPropertyValue('--yk-display').trim()
      )
    );
  });
  if (!valid) {
    throw new Error('Compiled Yak layout styles are missing from the page');
  }
}

// Runs in the page before any app code.
function installObservers() {
  const s: UxState = {
    fcp: null,
    lcp: null,
    longTasks: [],
    loafs: [],
    events: [],
    marks: {},
    lastActivity: 0,
  };
  window.__ux = s;
  const observe = (
    type: string,
    cb: (e: PerformanceEntry & Record<string, any>) => void,
    opts: Record<string, unknown> = {}
  ) => {
    try {
      new PerformanceObserver(list =>
        list.getEntries().forEach(e => cb(e as PerformanceEntry & Record<string, any>))
      ).observe({type, buffered: true, ...opts});
    } catch {
      // Unsupported entry type.
    }
  };
  observe('paint', e => {
    if (e.name === 'first-contentful-paint') {
      s.fcp = e.startTime;
    }
  });
  observe('largest-contentful-paint', e => {
    s.lcp = e.startTime;
  });
  observe('longtask', e => s.longTasks.push([e.startTime, e.duration]));
  observe('long-animation-frame', e =>
    s.loafs.push([e.startTime, e.duration, e.blockingDuration ?? 0])
  );
  observe(
    'event',
    e => {
      if (e.interactionId) {
        s.events.push([e.name, e.startTime, e.duration, e.interactionId]);
      }
    },
    {durationThreshold: 16}
  );
  new MutationObserver(() => {
    const now = performance.now();
    s.lastActivity = now;
    if (!s.marks.shell && document.querySelector('[aria-label="Secondary Navigation"]')) {
      s.marks.shell = now;
    }
    if (!s.marks.rows && document.querySelectorAll('tbody tr').length >= 6) {
      s.marks.rows = now;
    }
  }).observe(document, {subtree: true, childList: true});
}

/** Waits until no long task or DOM mutation happened for `quietMs`. */
async function waitQuiet(page: Page, {quietMs = 2500, minMs = 2000, maxMs = 60000} = {}) {
  const t0 = Date.now();
  for (;;) {
    await page.waitForTimeout(250);
    const since = await page
      .evaluate(() => {
        const s = window.__ux;
        const lt = s.longTasks.at(-1);
        const lastTask = lt ? lt[0] + lt[1] : 0;
        return performance.now() - Math.max(lastTask, s.lastActivity);
      })
      .catch(() => 0);
    const elapsed = Date.now() - t0;
    if (elapsed >= minMs && since >= quietMs) {
      return false;
    }
    if (elapsed >= maxMs) {
      return true;
    }
  }
}

const INTERACTIONS: Array<{
  name: string;
  run: (p: Page) => Promise<void>;
  after?: (p: Page) => Promise<void>;
}> = [
  {
    name: 'tab: Trace Samples',
    run: p => p.getByRole('tab', {name: 'Trace Samples'}).click(),
  },
  {name: 'tab: Aggregates', run: p => p.getByRole('tab', {name: 'Aggregates'}).click()},
  {
    name: 'tab: Span Samples',
    run: p => p.getByRole('tab', {name: 'Span Samples'}).click(),
  },
  {
    name: 'open: project filter',
    run: p => p.getByRole('button', {name: 'All Projects'}).first().click(),
    after: p => p.keyboard.press('Escape'),
  },
  {
    name: 'open: date filter',
    run: p => p.getByRole('button', {name: '24H'}).first().click(),
    after: p => p.keyboard.press('Escape'),
  },
  {
    name: 'open: Edit Table modal',
    run: p => p.getByRole('button', {name: 'Edit Table'}).click(),
    after: p => p.keyboard.press('Escape'),
  },
];

async function measureRun({
  port,
  recording,
  throttle,
  misses,
  record = false,
}: {
  misses: Set<string>;
  port: string;
  recording: Recording;
  throttle: number;
  record?: boolean;
}): Promise<RunResult> {
  const {browser, ctx} = await newContext(record || !!process.env.BENCH_STATE);
  await routeApi(ctx, recording, misses, record);
  await ctx.addInitScript(installObservers);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const r: RunResult = {};
  try {
    // Warm-up: HTTP cache and V8 code cache, as for a returning user.
    await page.goto(pageUrl(port), {waitUntil: 'domcontentloaded', timeout: 120000});
    await waitQuiet(page);
    await assertExtractedStyles(page);
    if (throttle > 1) {
      await cdp.send('Emulation.setCPUThrottlingRate', {rate: throttle});
    }
    await page.reload({waitUntil: 'domcontentloaded', timeout: 120000});
    r.loadTimedOut = await waitQuiet(page, {maxMs: 120000});
    r.load = await page.evaluate(() => {
      const s = window.__ux;
      const end = Math.max(s.marks.rows ?? 0, s.lcp ?? 0) + 1;
      const tasks = s.longTasks.filter(([t]) => t < end);
      const loafs = s.loafs.filter(([t]) => t < end);
      return {
        shellMs: s.marks.shell ?? null,
        rowsMs: s.marks.rows ?? null,
        fcpMs: s.fcp,
        lcpMs: s.lcp,
        // Until the table is populated.
        tbtMs: tasks.reduce((a, [, d]) => a + Math.max(0, d - 50), 0),
        longTaskMs: tasks.reduce((a, [, d]) => a + d, 0),
        loafMs: loafs.reduce((a, [, d]) => a + d, 0),
        loafBlockingMs: loafs.reduce((a, [, , b]) => a + b, 0),
        maxLoafMs: Math.max(0, ...loafs.map(([, d]) => d)),
      };
    });
    r.interactions = {};
    for (const it of INTERACTIONS) {
      const t0 = await page.evaluate(() => performance.now());
      try {
        await it.run(page);
        await waitQuiet(page, {quietMs: 1200, minMs: 800, maxMs: 30000});
        const t1 = await page.evaluate(() => performance.now());
        if (it.after) {
          await it.after(page);
          await waitQuiet(page, {quietMs: 800, minMs: 500, maxMs: 15000});
        }
        r.interactions[it.name] = await page.evaluate(
          ({from, to}) => {
            const evs = window.__ux.events.filter(([, t]) => t >= from && t < to);
            return evs.length ? Math.max(...evs.map(([, , d]) => d)) : 16;
          },
          {from: t0, to: t1}
        );
      } catch (e) {
        r.interactions[it.name] = null;
        r.interactionErrors = [
          ...(r.interactionErrors ?? []),
          `${it.name}: ${String(e).slice(0, 120)}`,
        ];
      }
    }
  } catch (e) {
    r.error = String(e).slice(0, 300);
  }
  await browser.close();
  return r;
}

function serve(worktree: string, port: string) {
  const root = path.resolve(worktree);
  const dir = path.join(root, '.artifacts/explore-benchmark');
  fs.mkdirSync(dir, {recursive: true});
  const configPath = path.join(dir, 'rsbuild.bench.mjs');
  // Production build like sentry.io, but unminified and without the React
  // Compiler (keeps function names; matches the other variants).
  fs.writeFileSync(
    configPath,
    `import rsbuildConfig, {configs} from ${JSON.stringify(path.join(root, 'rsbuild.config.ts'))};

const visit = rule => {
  if (!rule) return;
  for (const child of [...(rule.oneOf ?? []), ...(rule.rules ?? [])]) visit(child);
  for (const loader of [rule, ...(Array.isArray(rule.use) ? rule.use : [rule.use])]) {
    const transform = loader?.options?.jsc?.transform;
    if (transform && 'reactCompiler' in transform) transform.reactCompiler = false;
  }
};
for (const config of configs) {
  config.experiments = {...config.experiments, nativeWatcher: false};
  config.resolve.alias.sentry = ${JSON.stringify(path.join(root, 'static/app'))};
  for (const rule of config.module?.rules ?? []) visit(rule);
  config.plugins = (config.plugins ?? []).filter(p => p?.constructor?.name !== 'CompressionPlugin');
}
configs[0].optimization.minimize = false;
console.log('[explore-benchmark] mode=%s minimize=%s', configs[0].mode, configs[0].optimization.minimize);

export default rsbuildConfig;
`
  );
  const child = spawn(
    path.join(root, 'node_modules/.bin/rsbuild'),
    ['dev', '--config', configPath],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        SENTRY_UI_DEV_ONLY: '1',
        SENTRY_WEBPACK_PROXY_PORT: port,
      },
    }
  );
  child.on('exit', code => process.exit(code ?? 0));
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Two-sided Mann-Whitney U, normal approximation with tie correction. */
function mannWhitney(a: number[], b: number[]) {
  const combined = [...a.map(v => [v, 0] as const), ...b.map(v => [v, 1] as const)].sort(
    (x, y) => x[0] - y[0]
  );
  const ranks: number[] = Array.from({length: combined.length}, () => 0);
  let ties = 0;
  for (let i = 0; i < combined.length;) {
    let j = i;
    while (j + 1 < combined.length && combined[j + 1]![0] === combined[i]![0]) {
      j++;
    }
    for (let k = i; k <= j; k++) {
      ranks[k] = (i + j) / 2 + 1;
    }
    const t = j - i + 1;
    ties += t ** 3 - t;
    i = j + 1;
  }
  const n1 = a.length;
  const n2 = b.length;
  const n = n1 + n2;
  const r1 = combined.reduce((sum, [, g], i) => (g === 0 ? sum + ranks[i]! : sum), 0);
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const sigma = n > 1 ? Math.sqrt(((n1 * n2) / 12) * (n + 1 - ties / (n * (n - 1)))) : 0;
  if (sigma === 0) {
    return 1;
  }
  const z = Math.abs(u1 - (n1 * n2) / 2) / sigma;
  return erfc(z / Math.SQRT2);
}

// Abramowitz-Stegun 7.1.26 (error < 1.5e-7).
function erfc(x: number) {
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * Math.exp(-x * x);
}

function compare(la: string, lb: string, resultsFiles: string[]) {
  const results: RunResult[] = resultsFiles.flatMap(file =>
    JSON.parse(fs.readFileSync(file, 'utf8'))
  );
  const ok = results.filter(r => !r.error && r.load?.rowsMs);
  const A = ok.filter(r => r.label === la);
  const B = ok.filter(r => r.label === lb);
  const missing = new Set(results.flatMap(r => r.misses ?? []));
  console.log(
    `${la}: ${A.length} runs, ${lb}: ${B.length} runs; unrecorded API requests: ${missing.size}`
  );
  const metrics: Array<[string, (r: RunResult) => number | null | undefined]> = [
    ['load: app shell rendered (ms)', r => r.load?.shellMs],
    ['load: spans table rows rendered (ms)', r => r.load?.rowsMs],
    ['load: LCP (ms)', r => r.load?.lcpMs],
    ['load: Total Blocking Time (ms)', r => r.load?.tbtMs],
    ['load: long tasks total (ms)', r => r.load?.longTaskMs],
    ['load: long animation frames total (ms)', r => r.load?.loafMs],
    ['load: LoAF blocking (ms)', r => r.load?.loafBlockingMs],
    ['load: worst LoAF (ms)', r => r.load?.maxLoafMs],
  ];
  const names = [...new Set(ok.flatMap(r => Object.keys(r.interactions ?? {})))].sort();
  for (const name of names) {
    metrics.push([`interaction: ${name} (ms)`, r => r.interactions?.[name]]);
  }
  metrics.push([
    'interaction: worst of all (INP-like) (ms)',
    r => {
      const v = Object.values(r.interactions ?? {}).filter(
        (x): x is number => x !== null
      );
      return v.length ? Math.max(...v) : null;
    },
  ]);
  const pad = (s: string, n: number) => s.padStart(n);
  console.log(
    `\n${'metric'.padEnd(46)} ${pad(la, 9)} ${pad(lb, 9)} ${pad('delta', 8)} ${pad('%', 6)} ${pad('p', 6)}`
  );
  for (const [name, get] of metrics) {
    const va = A.map(get).filter((v): v is number => typeof v === 'number');
    const vb = B.map(get).filter((v): v is number => typeof v === 'number');
    if (!va.length || !vb.length) {
      continue;
    }
    const ma = median(va);
    const mb = median(vb);
    const p = mannWhitney(va, vb);
    const pct = ma ? ((mb - ma) / ma) * 100 : 0;
    console.log(
      `${name.padEnd(46)} ${pad(ma.toFixed(0), 9)} ${pad(mb.toFixed(0), 9)} ${pad(
        (mb - ma >= 0 ? '+' : '') + (mb - ma).toFixed(0),
        8
      )} ${pad(`${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`, 6)} ${pad(p.toFixed(3), 6)}${p < 0.05 ? ' *' : ''}`
    );
  }
}

async function bytes(recording: Recording, sides: string[]) {
  for (const {label, port} of parseSides(sides)) {
    const {browser, ctx} = await newContext(!!process.env.BENCH_STATE);
    await routeApi(ctx, recording, new Set());
    const page = await ctx.newPage();
    await page.goto(pageUrl(port), {waitUntil: 'domcontentloaded', timeout: 120000});
    await page.waitForFunction(
      () => document.querySelectorAll('tbody tr').length >= 6,
      null,
      {
        timeout: 120000,
      }
    );
    await page.waitForTimeout(5000);
    await assertExtractedStyles(page);
    const result = await page.evaluate(() => {
      const res = {
        js: {n: 0, decoded: 0, transfer: 0},
        css: {n: 0, decoded: 0, transfer: 0},
      };
      for (const e of performance.getEntriesByType(
        'resource'
      ) as PerformanceResourceTiming[]) {
        const u = new URL(e.name);
        const kind = u.pathname.endsWith('.js')
          ? 'js'
          : u.pathname.endsWith('.css')
            ? 'css'
            : null;
        if (u.origin !== location.origin || !kind) {
          continue;
        }
        res[kind].n++;
        res[kind].decoded += e.decodedBodySize;
        res[kind].transfer += e.transferSize;
      }
      const rules = {emotion: 0, emotionSheets: 0, static: 0, staticSheets: 0};
      for (const sheet of Array.from(document.styleSheets)) {
        let n = 0;
        try {
          n = sheet.cssRules.length;
        } catch {
          continue;
        }
        if ((sheet.ownerNode as Element | null)?.hasAttribute?.('data-emotion')) {
          rules.emotion += n;
          rules.emotionSheets++;
        } else {
          rules.static += n;
          rules.staticSheets++;
        }
      }
      return {...res, rules, elements: document.querySelectorAll('*').length};
    });
    console.log(label, JSON.stringify(result));
    await browser.close();
  }
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'serve') {
    const [worktree = '.', port = '7254'] = args;
    serve(worktree, port);
  } else if (mode === 'record') {
    const [port = '', out = ''] = args;
    const recording: Recording = {};
    const r = await measureRun({
      port,
      recording,
      throttle: 1,
      misses: new Set(),
      record: true,
    });
    fs.writeFileSync(out, JSON.stringify(recording));
    console.log(
      `recorded ${Object.keys(recording).length} responses`,
      JSON.stringify(r.load),
      JSON.stringify(r.interactions),
      r.error ?? r.interactionErrors ?? ''
    );
  } else if (mode === 'run') {
    const [recFile = '', outDir = '', repsArg = '10', throttleArg = '1', ...sides] = args;
    const recording: Recording = JSON.parse(fs.readFileSync(recFile, 'utf8'));
    fs.mkdirSync(outDir, {recursive: true});
    const parsed = parseSides(sides);
    const results: RunResult[] = [];
    for (let rep = 0; rep < Number(repsArg); rep++) {
      // Alternate the order so position effects cancel out.
      const order = rep % 2 === 0 ? parsed : [...parsed].reverse();
      for (const side of order) {
        const misses = new Set<string>();
        const r = await measureRun({
          port: side.port,
          recording,
          throttle: Number(throttleArg),
          misses,
        });
        r.label = side.label;
        r.rep = rep;
        r.misses = [...misses];
        results.push(r);
        fs.writeFileSync(
          path.join(outDir, 'results.json'),
          JSON.stringify(results, null, 1)
        );
        console.log(
          `${side.label} r${rep}: ${r.error ?? ''} rows=${r.load?.rowsMs?.toFixed(0)} tbt=${r.load?.tbtMs?.toFixed(0)} | ${Object.entries(
            r.interactions ?? {}
          )
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')} misses=${misses.size}${r.loadTimedOut ? ' [load timeout]' : ''}`
        );
      }
    }
  } else if (mode === 'compare') {
    const [la = '', lb = '', ...files] = args;
    compare(la, lb, files);
  } else if (mode === 'bytes') {
    const [recFile = '', ...sides] = args;
    await bytes(JSON.parse(fs.readFileSync(recFile, 'utf8')), sides);
  } else {
    console.log('Usage: see the header of scripts/exploreBenchmark.ts');
    process.exit(1);
  }
}

await main();
