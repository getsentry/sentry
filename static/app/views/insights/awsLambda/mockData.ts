/**
 * Mock data for the AWS Lambda prototype. Nothing here comes from the API.
 *
 * All values are a deterministic function of absolute time, so zooming into a chart or changing
 * the date range shows the same underlying data at a different resolution. A few incidents are
 * planted relative to "now" (ANCHOR) so there is something to find.
 *
 * Where each value would come from in the real product:
 * - Extension metrics: Lambda Telemetry API via the Sentry Lambda extension (unsampled).
 * - Spans: the SDK's `function.aws` segments and their children (sampled).
 * - Logs: function stdout via the Telemetry API, plus SDK logging records.
 * - AWS integration: CloudWatch metrics the extension can't see (throttles, iterator age, DLQ).
 */
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import type {Release, TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {getMockState} from 'sentry/views/insights/awsLambda/mockStore';

export type DataSource = 'extension' | 'spans' | 'logs' | 'integration' | 'aws';

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  extension: 'Extension metrics',
  spans: 'Spans',
  logs: 'Logs',
  integration: 'AWS integration',
  aws: 'Function config',
};

// Time

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
const GRAIN = 5 * MINUTE;

/** "Now" for the planted incidents. Fixed when the page loads. */
export const ANCHOR = Math.floor(Date.now() / GRAIN) * GRAIN;

export interface TimeWindow {
  buckets: number;
  end: number;
  interval: number;
  start: number;
}

const INTERVALS = [1, 5, 10, 15, 30, 60, 180, 360, 720, 1440].map(m => m * MINUTE);

export function makeWindow(start: number, end: number): TimeWindow {
  const span = Math.max(MINUTE * 10, end - start);
  const interval = INTERVALS.find(i => span / i <= 96) ?? DAY;
  const alignedStart = Math.floor((end - span) / interval) * interval;
  const buckets = Math.max(1, Math.ceil((end - alignedStart) / interval));
  return {start: alignedStart, end: alignedStart + buckets * interval, interval, buckets};
}

export function previousWindow(window: TimeWindow): TimeWindow {
  const span = window.end - window.start;
  return {...window, start: window.start - span, end: window.end - span};
}

export function bucketStarts(window: TimeWindow) {
  return Array.from(
    {length: window.buckets},
    (_, i) => window.start + i * window.interval
  );
}

/** Stable pseudo-random number in [0, 1) for the given parts. */
export function hash(...parts: Array<string | number>): number {
  const input = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function grainOf(t: number) {
  return Math.floor(t / GRAIN);
}

/** Smooth noise in [-1, 1]: random knots `period` apart, cosine-interpolated. */
function smoothNoise(seed: string, t: number, period: number) {
  const x = t / period;
  const i = Math.floor(x);
  const f = (1 - Math.cos((x - i) * Math.PI)) / 2;
  const a = 2 * hash(seed, i) - 1;
  return a + (2 * hash(seed, i + 1) - 1 - a) * f;
}

/** Inverse standard normal CDF (Tukey lambda approximation, within 0.5% up to p99.9). */
function normalQuantile(p: number) {
  const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
  return 4.91 * (q ** 0.14 - (1 - q) ** 0.14);
}

/** Poisson-distributed count with mean `lambda`, for the draw `u`. */
function poisson(lambda: number, u: number) {
  if (lambda <= 0) {
    return 0;
  }
  if (lambda > 30) {
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normalQuantile(u)));
  }
  let p = Math.exp(-lambda);
  let cdf = p;
  let k = 0;
  while (u > cdf && k < 100) {
    k++;
    p *= lambda / k;
    cdf += p;
  }
  return k;
}

const memoCache = new Map<string, number>();

/** Model values are evaluated many times per render; memoize them at 15s resolution. */
function memo(key: string, t: number, compute: () => number) {
  const fullKey = `${key}|${Math.floor(t / 15_000)}`;
  const cached = memoCache.get(fullKey);
  if (cached !== undefined) {
    return cached;
  }
  const value = compute();
  if (memoCache.size > 400_000) {
    memoCache.clear();
  }
  memoCache.set(fullKey, value);
  return value;
}

// Traffic shape

type TrafficProfile = 'shop' | 'business' | 'schedule';

function bump(hour: number, center: number, width: number) {
  const d = Math.min(Math.abs(hour - center), 24 - Math.abs(hour - center));
  return Math.exp(-(d * d) / (2 * width * width));
}

/** Consumer traffic by weekday, Sunday first: busiest on Sunday evening, quietest on Friday. */
const SHOP_WEEKDAY = [1.15, 1, 0.96, 0.97, 1, 0.88, 0.94];

/** Traffic relative to the daily peak, by local time. */
function dailyShape(profile: TrafficProfile, t: number) {
  const date = new Date(t);
  const hour = date.getHours() + date.getMinutes() / 60;
  const day = date.getDay();
  if (profile === 'schedule') {
    return 1;
  }
  if (profile === 'business') {
    // Supplier stock updates during office hours, little at weekends.
    return (day === 0 || day === 6 ? 0.2 : 1) * (0.1 + 0.9 * bump(hour, 13, 3.2));
  }
  // Shop: morning commute, lunch and a large evening peak; quiet between 3 and 6am.
  return (
    SHOP_WEEKDAY[day]! *
    (0.06 +
      0.3 * bump(hour, 8.5, 1.4) +
      0.5 * bump(hour, 12.5, 1.5) +
      0.9 * bump(hour, 20.5, 2.1))
  );
}

function weekMean(profile: TrafficProfile) {
  const monday = new Date(2026, 0, 5).getTime();
  const steps = 7 * 24 * 6;
  let total = 0;
  for (let i = 0; i < steps; i++) {
    total += dailyShape(profile, monday + i * 10 * MINUTE);
  }
  return total / steps;
}

const SHAPE_MEAN: Record<TrafficProfile, number> = {
  shop: weekMean('shop'),
  business: weekMean('business'),
  schedule: 1,
};

// Functions

type TriggerKind =
  | 'api-gateway'
  | 'function-url'
  | 'sqs'
  | 'sns'
  | 's3'
  | 'dynamodb'
  | 'schedule'
  | 'durable';

export interface Trigger {
  /** `faas.trigger` from the conventions. */
  faasTrigger: 'http' | 'pubsub' | 'datasource' | 'timer' | 'other';
  kind: TriggerKind;
  label: string;
  source: string;
}

export type InstrumentationStatus =
  | 'rule'
  | 'manual'
  | 'drift'
  | 'excluded'
  | 'not-instrumented'
  | 'unsupported';

export interface LambdaFunction {
  account: string;
  arch: 'arm64' | 'x86_64';
  /** Cold starts per invocation in steady traffic, before scale-out and deploys. */
  baseColdStartRate: number;
  baseErrorRate: number;
  /** Invocations per day at average traffic. */
  baseInvocations: number;
  /** Share of the duration that scales with CPU (memory). */
  cpuShare: number;
  env: string;
  extensionLayer: string | null;
  handler: string;
  initP50Ms: number;
  initP95Ms: number;
  instrumentation: InstrumentationStatus;
  memoryMb: number;
  memoryUsedMb: number;
  name: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  /** Which daily traffic shape the function follows. */
  profile: TrafficProfile;
  region: string;
  runtime: string;
  sdkLayer: string | null;
  team: string;
  timeoutS: number;
  triggers: Trigger[];
  durable?: boolean;
  provisionedConcurrency?: number;
  reservedConcurrency?: number;
}

const ACCOUNT = '123456789012';
const REGION = 'eu-north-1';
const SDK_LAYER = 'SentryPythonServerlessSDK:312';
const EXTENSION_LAYER = 'SentryLambdaExtension-arm64:4';
export const ACCOUNT_CONCURRENCY_LIMIT = 1000;

export const FUNCTIONS: LambdaFunction[] = [
  {
    name: 'checkout-api',
    runtime: 'python3.13',
    arch: 'arm64',
    memoryMb: 1024,
    timeoutS: 29,
    profile: 'shop',
    region: REGION,
    account: ACCOUNT,
    env: 'production',
    handler: 'app.handler',
    team: 'checkout',
    triggers: [
      {
        kind: 'api-gateway',
        faasTrigger: 'http',
        label: 'API Gateway',
        source: 'shop-api / prod (HTTP API)',
      },
    ],
    baseInvocations: 1_240_000,
    baseErrorRate: 0.0012,
    baseColdStartRate: 0.004,
    p50Ms: 118,
    p95Ms: 412,
    p99Ms: 1_870,
    initP50Ms: 1_240,
    initP95Ms: 1_910,
    memoryUsedMb: 560,
    cpuShare: 0.35,
    provisionedConcurrency: 10,
    instrumentation: 'rule',
    sdkLayer: SDK_LAYER,
    extensionLayer: EXTENSION_LAYER,
  },
  {
    name: 'orders-worker',
    runtime: 'python3.13',
    arch: 'arm64',
    memoryMb: 512,
    timeoutS: 30,
    profile: 'shop',
    region: REGION,
    account: ACCOUNT,
    env: 'production',
    handler: 'worker.handler',
    team: 'checkout',
    triggers: [
      {kind: 'sqs', faasTrigger: 'pubsub', label: 'SQS', source: 'orders-queue'},
    ],
    baseInvocations: 96_000,
    baseErrorRate: 0.004,
    baseColdStartRate: 0.006,
    p50Ms: 2_140,
    p95Ms: 12_900,
    p99Ms: 19_300,
    initP50Ms: 980,
    initP95Ms: 1_420,
    memoryUsedMb: 360,
    cpuShare: 0.15,
    instrumentation: 'rule',
    sdkLayer: SDK_LAYER,
    extensionLayer: EXTENSION_LAYER,
  },
  {
    name: 'image-resize',
    runtime: 'python3.12',
    arch: 'x86_64',
    memoryMb: 3008,
    timeoutS: 60,
    profile: 'shop',
    region: REGION,
    account: ACCOUNT,
    env: 'production',
    handler: 'resize.handler',
    team: 'media',
    triggers: [
      {kind: 's3', faasTrigger: 'datasource', label: 'S3', source: 'shop-uploads'},
    ],
    baseInvocations: 41_000,
    baseErrorRate: 0.002,
    baseColdStartRate: 0.035,
    p50Ms: 640,
    p95Ms: 1_480,
    p99Ms: 2_210,
    initP50Ms: 1_560,
    initP95Ms: 2_340,
    memoryUsedMb: 610,
    cpuShare: 0.7,
    instrumentation: 'rule',
    sdkLayer: SDK_LAYER,
    extensionLayer: 'SentryLambdaExtension-x86_64:4',
  },
  {
    name: 'report-generator',
    runtime: 'python3.11',
    arch: 'arm64',
    memoryMb: 1024,
    timeoutS: 300,
    profile: 'schedule',
    region: REGION,
    account: ACCOUNT,
    env: 'production',
    handler: 'reports.generate',
    team: 'finance',
    triggers: [
      {
        kind: 'schedule',
        faasTrigger: 'timer',
        label: 'EventBridge schedule',
        source: 'rate(15 minutes)',
      },
    ],
    baseInvocations: 96,
    baseErrorRate: 0,
    baseColdStartRate: 0.6,
    p50Ms: 48_200,
    p95Ms: 121_400,
    p99Ms: 168_000,
    initP50Ms: 2_110,
    initP95Ms: 2_840,
    memoryUsedMb: 840,
    cpuShare: 0.6,
    instrumentation: 'rule',
    sdkLayer: SDK_LAYER,
    extensionLayer: EXTENSION_LAYER,
  },
  {
    name: 'payments-webhook',
    runtime: 'python3.13',
    arch: 'arm64',
    memoryMb: 256,
    timeoutS: 10,
    profile: 'shop',
    region: REGION,
    account: ACCOUNT,
    env: 'production',
    handler: 'webhook.handler',
    team: 'payments',
    triggers: [
      {
        kind: 'function-url',
        faasTrigger: 'http',
        label: 'Function URL',
        source: 'https://x7k2….lambda-url.eu-north-1.on.aws',
      },
    ],
    baseInvocations: 18_300,
    baseErrorRate: 0.0006,
    baseColdStartRate: 0.012,
    p50Ms: 84,
    p95Ms: 230,
    p99Ms: 410,
    initP50Ms: 410,
    initP95Ms: 620,
    memoryUsedMb: 128,
    cpuShare: 0.3,
    instrumentation: 'manual',
    sdkLayer: 'SentryPythonServerlessSDK:298',
    extensionLayer: null,
  },
  {
    name: 'inventory-sync',
    runtime: 'python3.9',
    arch: 'x86_64',
    memoryMb: 512,
    timeoutS: 60,
    profile: 'business',
    region: REGION,
    account: ACCOUNT,
    env: 'production',
    handler: 'sync.handler',
    team: 'catalog',
    triggers: [
      {
        kind: 'dynamodb',
        faasTrigger: 'datasource',
        label: 'DynamoDB Streams',
        source: 'inventory',
      },
    ],
    baseInvocations: 212_000,
    baseErrorRate: 0.004,
    baseColdStartRate: 0.004,
    p50Ms: 210,
    p95Ms: 690,
    p99Ms: 1_120,
    initP50Ms: 1_030,
    initP95Ms: 1_310,
    memoryUsedMb: 190,
    cpuShare: 0.4,
    instrumentation: 'drift',
    sdkLayer: null,
    extensionLayer: null,
  },
  {
    name: 'notify-users',
    runtime: 'python3.12',
    arch: 'arm64',
    memoryMb: 512,
    timeoutS: 15,
    profile: 'shop',
    region: REGION,
    account: ACCOUNT,
    env: 'production',
    handler: 'notify.handler',
    team: 'growth',
    triggers: [
      {kind: 'sns', faasTrigger: 'pubsub', label: 'SNS', source: 'order-events'},
    ],
    baseInvocations: 150_000,
    baseErrorRate: 0.0018,
    baseColdStartRate: 0.008,
    p50Ms: 96,
    p95Ms: 340,
    p99Ms: 820,
    initP50Ms: 560,
    initP95Ms: 780,
    memoryUsedMb: 160,
    cpuShare: 0.25,
    reservedConcurrency: 50,
    instrumentation: 'rule',
    sdkLayer: SDK_LAYER,
    extensionLayer: EXTENSION_LAYER,
  },
  {
    name: 'order-fulfillment',
    runtime: 'python3.13',
    arch: 'arm64',
    memoryMb: 1024,
    timeoutS: 900,
    profile: 'shop',
    region: REGION,
    account: ACCOUNT,
    env: 'production',
    handler: 'fulfillment.handler',
    team: 'checkout',
    triggers: [
      {
        kind: 'durable',
        faasTrigger: 'other',
        label: 'Durable execution',
        source: 'order-fulfillment (durable function)',
      },
    ],
    durable: true,
    baseInvocations: 7_900,
    baseErrorRate: 0.005,
    baseColdStartRate: 0.03,
    p50Ms: 420,
    p95Ms: 2_900,
    p99Ms: 6_400,
    initP50Ms: 1_180,
    initP95Ms: 1_560,
    memoryUsedMb: 270,
    cpuShare: 0.3,
    instrumentation: 'rule',
    sdkLayer: SDK_LAYER,
    extensionLayer: EXTENSION_LAYER,
  },
];

/** Memory configured at time `t`, following changes made in the mock. */
export function memoryLimitAt(fn: LambdaFunction, t: number) {
  const changes = getMockState().memoryChanges[fn.name] ?? [];
  const applied = changes.filter(change => change.at <= t);
  if (applied.length) {
    return applied[applied.length - 1]!.memoryMb;
  }
  return (
    changes[0]?.previousMb ??
    FUNCTIONS.find(f => f.name === fn.name)?.memoryMb ??
    fn.memoryMb
  );
}

/** The function as it is now, including changes made through the mock's actions. */
export function withOverrides(fn: LambdaFunction): LambdaFunction {
  const state = getMockState();
  const instrumentation = state.instrumentation[fn.name] ?? fn.instrumentation;
  const reinstrumented = instrumentation === 'rule' && fn.instrumentation !== 'rule';
  return {
    ...fn,
    memoryMb: memoryLimitAt(fn, Date.now()),
    instrumentation,
    sdkLayer: reinstrumented ? 'SentryPythonServerlessSDK:312' : fn.sdkLayer,
    extensionLayer: reinstrumented
      ? `SentryLambdaExtension-${fn.arch === 'arm64' ? 'arm64' : 'x86_64'}:4`
      : fn.extensionLayer,
  };
}

export function allFunctions(): LambdaFunction[] {
  return FUNCTIONS.map(withOverrides);
}

export function getFunction(name: string | undefined): LambdaFunction | undefined {
  const fn = FUNCTIONS.find(f => f.name === name);
  return fn ? withOverrides(fn) : undefined;
}

export const DEPRECATED_RUNTIMES = new Set(['python3.9', 'python3.8']);

// Releases and planted incidents

export interface FunctionRelease {
  commit: string;
  deployedAt: number;
  release: string;
  version: number;
  message?: string;
}

const RELEASES: Record<string, FunctionRelease[]> = {
  'checkout-api': [
    {
      release: 'shop@2.14.1',
      version: 42,
      commit: 'a91c3e2',
      deployedAt: ANCHOR - 10 * HOUR,
    },
    {
      release: 'shop@2.14.0',
      version: 41,
      commit: '5be07d1',
      deployedAt: ANCHOR - 3 * DAY - 4 * HOUR,
    },
    {
      release: 'shop@2.13.4',
      version: 40,
      commit: '0d44f9b',
      deployedAt: ANCHOR - 11 * DAY,
    },
  ],
  'orders-worker': [
    {
      release: 'shop@2.14.1',
      version: 87,
      commit: 'a91c3e2',
      deployedAt: ANCHOR - 10 * HOUR,
      message: 'Call carrier API synchronously',
    },
    {
      release: 'shop@2.14.0',
      version: 86,
      commit: '5be07d1',
      deployedAt: ANCHOR - 3 * DAY - 4 * HOUR,
    },
    {
      release: 'shop@2.13.4',
      version: 85,
      commit: '0d44f9b',
      deployedAt: ANCHOR - 11 * DAY,
    },
  ],
  'image-resize': [
    {
      release: 'media@1.8.0',
      version: 12,
      commit: 'c1f0aa9',
      deployedAt: ANCHOR - 4 * DAY,
    },
    {
      release: 'media@1.7.2',
      version: 11,
      commit: '77de013',
      deployedAt: ANCHOR - 19 * DAY,
    },
  ],
  'report-generator': [
    {
      release: 'reports@0.9.3',
      version: 19,
      commit: '9e2b6c4',
      deployedAt: ANCHOR - 6 * DAY,
    },
    {
      release: 'reports@0.9.2',
      version: 18,
      commit: '3a5f1d0',
      deployedAt: ANCHOR - 20 * DAY,
    },
  ],
  'payments-webhook': [
    {
      release: 'payments@3.2.0',
      version: 8,
      commit: 'f20c8b1',
      deployedAt: ANCHOR - 2 * DAY - 3 * HOUR + 14 * MINUTE,
      message: 'Update STRIPE_WEBHOOK_SECRET',
    },
    {
      release: 'payments@3.2.0',
      version: 7,
      commit: 'f20c8b1',
      deployedAt: ANCHOR - 8 * DAY,
    },
  ],
  'inventory-sync': [
    {
      release: 'inventory@5.0.3',
      version: 34,
      commit: '4d0e9a7',
      deployedAt: ANCHOR - 7 * HOUR + 38 * MINUTE,
      message: 'Skip records without a SKU',
    },
    {
      release: 'inventory@5.0.2',
      version: 33,
      commit: 'be81d72',
      deployedAt: ANCHOR - 2 * DAY,
    },
    {
      release: 'inventory@5.0.1',
      version: 32,
      commit: '1c9a404',
      deployedAt: ANCHOR - 9 * DAY,
    },
  ],
  'notify-users': [
    {
      release: 'notifications@1.4.0',
      version: 24,
      commit: 'e4e2a19',
      deployedAt: ANCHOR - 5 * DAY,
    },
  ],
  'order-fulfillment': [
    {
      release: 'shop@2.14.1',
      version: 5,
      commit: 'a91c3e2',
      deployedAt: ANCHOR - 10 * HOUR,
    },
    {
      release: 'shop@2.14.0',
      version: 4,
      commit: '5be07d1',
      deployedAt: ANCHOR - 3 * DAY - 4 * HOUR,
    },
  ],
};

export function releasesOf(fn: LambdaFunction): FunctionRelease[] {
  const base = RELEASES[fn.name] ?? [];
  const changes = getMockState().memoryChanges[fn.name] ?? [];
  if (!changes.length) {
    return base;
  }
  // Each configuration change publishes a new Lambda version of the same code.
  const out = [...base];
  for (const change of changes) {
    const code = out.find(r => r.deployedAt <= change.at) ?? out[out.length - 1]!;
    out.push({
      ...code,
      version: Math.max(...out.map(r => r.version)) + 1,
      deployedAt: change.at,
      message: `Memory ${change.previousMb} → ${change.memoryMb} MB`,
    });
  }
  return out.sort((a, b) => b.deployedAt - a.deployedAt);
}

export function releaseAt(fn: LambdaFunction, t: number): FunctionRelease {
  const releases = releasesOf(fn);
  return (
    releases.find(release => release.deployedAt <= t) ?? releases[releases.length - 1]!
  );
}

/** Release markers for charts. */
export function chartReleases(fns: LambdaFunction[], window: TimeWindow): Release[] {
  const seen = new Set<string>();
  const out: Release[] = [];
  for (const fn of fns) {
    for (const release of releasesOf(fn)) {
      const key = `${release.release}-${release.deployedAt}`;
      if (
        release.deployedAt >= window.start &&
        release.deployedAt <= window.end &&
        !seen.has(key)
      ) {
        seen.add(key);
        out.push({
          version: release.release,
          timestamp: new Date(release.deployedAt).toISOString(),
        });
      }
    }
  }
  return out;
}

// Incidents. Each follows a failure pattern seen in real Lambda workloads.

interface TimeRange {
  end: number;
  start: number;
}

function after(start: number, minutes: number): TimeRange {
  return {start, end: start + minutes * MINUTE};
}

function inRange(t: number, range: TimeRange) {
  return t >= range.start && t < range.end;
}

/** shop@2.14.1 made the carrier call synchronous, so DHL's slow API now runs inside orders-worker. */
const ORDERS_DEPLOY = ANCHOR - 10 * HOUR;
/** A stream record with SKU 'NULL' fails on every retry and blocks its shard until inventory@5.0.3 skips it. */
const INVENTORY_POISON = after(ANCHOR - 7 * HOUR, 40);
/** Autumn sale campaign: 150k emails and pushes published to SNS in 30 minutes. */
const CAMPAIGN = after(ANCHOR - 3 * HOUR, 30);
const REPORT_OOM_FROM = ANCHOR - 90 * MINUTE;
const FULFILLMENT_TIMEOUT = ANCHOR - 5 * HOUR - 15 * MINUTE;
/** api.stripe.com slow and returning 5xx. Stripe delivers the held webhooks once it recovers. */
const STRIPE_DEGRADED = after(ANCHOR - 30 * HOUR, 38);
/** The webhook signing secret was rotated in Stripe before the function's environment variable. */
const WEBHOOK_SECRET_ROTATION = after(ANCHOR - 2 * DAY - 3 * HOUR, 14);
/** Regional DynamoDB errors and latency, like the us-east-1 event of October 2025. */
const DYNAMODB_EVENT = after(ANCHOR - 3 * DAY - 6 * HOUR, 52);

/** The DynamoDB call each function makes first, for error messages. */
const DYNAMODB_OPERATION: Record<string, string> = {
  'checkout-api': 'Query',
  'orders-worker': 'UpdateItem',
  'payments-webhook': 'TransactWriteItems',
  'inventory-sync': 'BatchWriteItem',
  'notify-users': 'GetItem',
  'order-fulfillment': 'GetItem',
};

export interface AwsHealthEvent extends TimeRange {
  /** Functions that call the affected service. */
  functions: string[];
  service: string;
  title: string;
}

/** Events the AWS integration reads from AWS Health. */
export const AWS_HEALTH_EVENTS: AwsHealthEvent[] = [
  {
    ...DYNAMODB_EVENT,
    service: 'DynamoDB',
    title: `Increased error rates and latencies for DynamoDB in ${REGION}`,
    functions: Object.keys(DYNAMODB_OPERATION),
  },
];

/** 0 to 1 over an incident: quick onset, a plateau, and a partial recovery before it ends. */
function intensity(t: number, range: TimeRange) {
  if (!inRange(t, range)) {
    return 0;
  }
  return Math.min(
    1,
    (t - range.start) / (4 * MINUTE),
    0.2 + (range.end - t) / (12 * MINUTE)
  );
}

/** Retries and held-back work arriving after `end`, decaying with the given time constant. */
function catchUp(t: number, end: number, minutes: number) {
  return t >= end && t < end + 4 * minutes * MINUTE
    ? Math.exp(-(t - end) / (minutes * MINUTE))
    : 0;
}

/** Age of work that piles up while processing is blocked and drains afterwards, in ms. */
function backlogAge(t: number, range: TimeRange, drainMinutes: number, growth = 1) {
  if (t < range.start) {
    return 0;
  }
  const peak = (Math.min(t, range.end) - range.start) * growth;
  const drained = (t - range.end) / (drainMinutes * MINUTE);
  return t < range.end ? peak : drained < 1 ? peak * (1 - drained) : 0;
}

/** Extra shop traffic from customers clicking through the campaign. */
function campaignLift(t: number) {
  if (t < CAMPAIGN.start) {
    return 0;
  }
  const since = t - CAMPAIGN.start;
  return (
    Math.min(1, since / (20 * MINUTE)) *
    Math.exp(-Math.max(0, since - 20 * MINUTE) / (70 * MINUTE))
  );
}

/** The nightly supplier import at 02:00 writes ~6x the usual changes to the stream. */
function nightlyImport(t: number): TimeRange {
  const date = new Date(t);
  date.setHours(2, 0, 0, 0);
  return after(date.getTime(), 30);
}

/** Short transient failures (a downstream blip, a bad host), about one a day per function. Returns the error multiplier. */
function blipAt(fn: LambdaFunction, t: number) {
  const hour = Math.floor(t / HOUR);
  if (fn.profile === 'schedule' || hash(fn.name, 'blip', hour) > 0.045) {
    return 0;
  }
  const start = hour * HOUR + hash(fn.name, 'blip-start', hour) * 45 * MINUTE;
  const length = (4 + 8 * hash(fn.name, 'blip-length', hour)) * MINUTE;
  return t >= start && t < start + length ? 4 + 14 * hash(fn.name, 'blip-size', hour) : 0;
}

// SNS invokes notify-users asynchronously. Reserved concurrency caps it at 50 environments, so
// Lambda throttles the burst, holds the rest in its async queue, and drops events older than the
// function's maximum event age.
// https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-error-handling.html
const CAMPAIGN_RATE = 5_000;
/** 50 environments at ~0.88s per message while SendGrid rate limits. */
const CAMPAIGN_CAPACITY = 3_400;
export const MAX_EVENT_AGE_MINUTES = 15;

interface CampaignMinute {
  dropped: number;
  processed: number;
  throttles: number;
}

const CAMPAIGN_MINUTES = (() => {
  const out: CampaignMinute[] = [];
  const queue: Array<{arrived: number; count: number}> = [];
  const arrivalMinutes = (CAMPAIGN.end - CAMPAIGN.start) / MINUTE;
  for (let minute = 0; minute < arrivalMinutes || queue.length; minute++) {
    if (minute < arrivalMinutes) {
      queue.push({arrived: minute, count: CAMPAIGN_RATE});
    }
    let dropped = 0;
    while (queue.length && minute - queue[0]!.arrived >= MAX_EVENT_AGE_MINUTES) {
      dropped += queue.shift()!.count;
    }
    let processed = 0;
    while (processed < CAMPAIGN_CAPACITY && queue.length) {
      const take = Math.min(CAMPAIGN_CAPACITY - processed, queue[0]!.count);
      queue[0]!.count -= take;
      processed += take;
      if (!queue[0]!.count) {
        queue.shift();
      }
    }
    const waiting = queue.reduce((sum, cohort) => sum + cohort.count, 0);
    // New events over capacity are throttled; queued ones are retried with backoff (minutes apart) and throttled again.
    out.push({
      processed,
      dropped,
      throttles:
        (minute < arrivalMinutes ? Math.max(0, CAMPAIGN_RATE - processed) : 0) +
        waiting * 0.04,
    });
  }
  return out;
})();

/** Incidents are shorter than a bucket on long ranges, so buckets overlapping them are sampled every minute. */
const INCIDENT_RANGES: TimeRange[] = [
  {start: CAMPAIGN.start, end: CAMPAIGN.start + (CAMPAIGN_MINUTES.length + 1) * MINUTE},
  {start: STRIPE_DEGRADED.start, end: STRIPE_DEGRADED.end + 48 * MINUTE},
  {start: WEBHOOK_SECRET_ROTATION.start, end: WEBHOOK_SECRET_ROTATION.end + 160 * MINUTE},
  {start: DYNAMODB_EVENT.start, end: DYNAMODB_EVENT.end + 60 * MINUTE},
  {start: INVENTORY_POISON.start, end: INVENTORY_POISON.end + 24 * MINUTE},
];

function campaignAt(t: number): CampaignMinute | undefined {
  return t >= CAMPAIGN.start
    ? CAMPAIGN_MINUTES[Math.floor((t - CAMPAIGN.start) / MINUTE)]
    : undefined;
}

// Point-in-time model (values per minute, or levels)

function noise(fn: LambdaFunction, t: number, key: string, amplitude: number) {
  return 1 + amplitude * smoothNoise(`${fn.name}|${key}`, t, 30 * MINUTE);
}

function invocationsPerMinute(fn: LambdaFunction, t: number): number {
  return memo(`${fn.name}|inv`, t, () => {
    if (fn.profile === 'schedule') {
      return 1 / 15;
    }
    // Shop functions share most of their noise: they serve the same customers.
    const shared =
      fn.profile === 'shop'
        ? 0.1 * smoothNoise('shop', t, 2 * HOUR) +
          0.05 * smoothNoise('shop', t, 17 * MINUTE)
        : 0;
    const own =
      0.06 * smoothNoise(`${fn.name}|inv`, t, 40 * MINUTE) +
      0.04 * smoothNoise(`${fn.name}|inv`, t, 6 * MINUTE);
    let rate =
      (fn.baseInvocations / 1440 / SHAPE_MEAN[fn.profile]) *
      dailyShape(fn.profile, t) *
      Math.exp(shared + own);
    const stripe = intensity(t, STRIPE_DEGRADED);
    switch (fn.name) {
      case 'checkout-api':
        rate *= 1 + 0.4 * campaignLift(t);
        break;
      case 'orders-worker':
      case 'order-fulfillment':
        // Orders follow successful checkouts. SQS redelivers messages that failed during the DynamoDB event.
        rate *=
          (1 + 0.4 * campaignLift(t)) *
          (1 - 0.5 * stripe) *
          (1 + 0.6 * catchUp(t, DYNAMODB_EVENT.end, 10));
        if (fn.name === 'orders-worker' && t >= ORDERS_DEPLOY) {
          rate *= 1.03;
        }
        break;
      case 'payments-webhook':
        // Stripe holds webhooks while it is degraded or deliveries fail, then retries them.
        rate *=
          (1 + 0.4 * campaignLift(t)) *
          (1 - 0.8 * stripe) *
          (1 + 3 * catchUp(t, STRIPE_DEGRADED.end, 12)) *
          (1 + 1.2 * catchUp(t, WEBHOOK_SECRET_ROTATION.end, 40));
        break;
      case 'notify-users':
        rate =
          rate * (1 + 0.5 * catchUp(t, DYNAMODB_EVENT.end, 15)) +
          (campaignAt(t)?.processed ?? 0);
        break;
      case 'inventory-sync':
        // Batches pile up while the shard or the stream poller is blocked, then drain in large batches.
        rate *= inRange(t, nightlyImport(t)) ? 6 : 1;
        rate *= inRange(t, INVENTORY_POISON)
          ? 1.3
          : 1 + 1.5 * catchUp(t, INVENTORY_POISON.end, 6);
        rate *=
          (1 - 0.7 * intensity(t, DYNAMODB_EVENT)) *
          (1 + 1.2 * catchUp(t, DYNAMODB_EVENT.end, 10));
        break;
      case 'image-resize': {
        // Sellers bulk-uploading catalog photos.
        const block = Math.floor(t / (2 * HOUR));
        const start = block * 2 * HOUR + hash(fn.name, 'bulk-start', block) * 90 * MINUTE;
        if (hash(fn.name, 'bulk', block) < 0.2 && t >= start && t < start + 15 * MINUTE) {
          rate *= 5;
        }
        break;
      }
      default:
        break;
    }
    return rate;
  });
}

function durationAt(fn: LambdaFunction, t: number, percentile: 'p50' | 'p95' | 'p99') {
  return memo(`${fn.name}|${percentile}`, t, () => {
    const tail = percentile !== 'p50';
    let value =
      fn[`${percentile}Ms`] *
      Math.exp(
        0.08 * smoothNoise(`${fn.name}|dur`, t, 45 * MINUTE) +
          0.05 * smoothNoise(`${fn.name}|dur-${percentile}`, t, 8 * MINUTE)
      ) *
      // Downstreams are busier at the daily peak.
      (1 + (tail ? 0.2 : 0.06) * (dailyShape(fn.profile, t) - SHAPE_MEAN[fn.profile]));
    if (fn.name === 'orders-worker' && t >= ORDERS_DEPLOY) {
      // DHL's API is slowest at the evening peak.
      value *= tail ? 1.3 + 0.3 * dailyShape('shop', t) : 1.05;
    }
    if (fn.name === 'checkout-api') {
      // Cold starts land in the tail when traffic ramps up.
      value *= tail
        ? 1 + 2 * Math.max(0, dailyShape('shop', t + HOUR) - dailyShape('shop', t))
        : 1;
      value *=
        1 +
        intensity(t, STRIPE_DEGRADED) *
          (percentile === 'p50' ? 0.4 : percentile === 'p95' ? 14 : 30);
    }
    if (fn.name in DYNAMODB_OPERATION) {
      // botocore retries with backoff before giving up.
      value *=
        1 +
        intensity(t, DYNAMODB_EVENT) *
          (percentile === 'p50' ? 0.8 : percentile === 'p95' ? 3 : 5);
    }
    if (fn.name === 'notify-users' && campaignAt(t)?.processed) {
      // SendGrid rate limits the burst and the client backs off inside the invocation.
      value *= percentile === 'p50' ? 8 : percentile === 'p95' ? 5 : 3.5;
    }
    if (blipAt(fn, t)) {
      value *= tail ? 1.8 : 1.1;
    }
    return Math.min(value, fn.timeoutS * 1000);
  });
}

/** Duration at standard-normal quantile `z`, on the same two-piece log-normal the samples use. */
function durationQuantileAt(fn: LambdaFunction, t: number, z: number) {
  const p50 = durationAt(fn, t, 'p50');
  const p95 = durationAt(fn, t, 'p95');
  if (z < 1.645) {
    return p50 * Math.exp((z * Math.log(p95 / p50)) / 1.645);
  }
  const p99 = durationAt(fn, t, 'p99');
  const slope = Math.log(p99 / p95) / (2.326 - 1.645);
  // Past p99 the tail flattens: half the p95→p99 slope.
  const value =
    z <= 2.326
      ? p95 * Math.exp((z - 1.645) * slope)
      : p99 * Math.exp((z - 2.326) * slope * 0.5);
  return Math.min(fn.timeoutS * 1000, value);
}

/** Mean of a log-normal through p50 and p95. */
function meanDurationAt(fn: LambdaFunction, t: number) {
  const p50 = durationAt(fn, t, 'p50');
  const sigma = Math.log(durationAt(fn, t, 'p95') / p50) / 1.645;
  return p50 * Math.exp(Math.min(1.2, (sigma * sigma) / 2));
}

/** Environments needed (Little's law), with headroom for the peak within the minute. */
function concurrencyDemand(fn: LambdaFunction, t: number) {
  return memo(
    `${fn.name}|conc`,
    t,
    () => (invocationsPerMinute(fn, t) / MINUTE) * meanDurationAt(fn, t) * 1.5
  );
}

function concurrencyAt(fn: LambdaFunction, t: number) {
  return Math.min(fn.reservedConcurrency ?? Infinity, concurrencyDemand(fn, t));
}

function throttlesPerMinute(fn: LambdaFunction, t: number) {
  return fn.name === 'notify-users' ? (campaignAt(t)?.throttles ?? 0) : 0;
}

function errorRateAt(fn: LambdaFunction, t: number) {
  let rate = fn.baseErrorRate * (1 + blipAt(fn, t));
  if (fn.name === 'orders-worker' && t >= ORDERS_DEPLOY) {
    rate *= 2.2;
  }
  if (fn.name === 'inventory-sync' && inRange(t, INVENTORY_POISON)) {
    // One of four shards retries the same failing batch.
    rate = Math.max(rate, 0.25);
  }
  if (fn.name === 'checkout-api') {
    rate += 0.16 * intensity(t, STRIPE_DEGRADED);
  }
  if (fn.name === 'payments-webhook' && inRange(t, WEBHOOK_SECRET_ROTATION)) {
    rate = 1;
  }
  if (fn.name === 'notify-users' && campaignAt(t)?.processed) {
    rate += 0.03;
  }
  if (fn.name in DYNAMODB_OPERATION) {
    rate += 0.14 * intensity(t, DYNAMODB_EVENT);
  }
  return Math.min(1, rate);
}

function errorsPerMinute(fn: LambdaFunction, t: number) {
  return invocationsPerMinute(fn, t) * errorRateAt(fn, t);
}

/** Share of invocations that run into the timeout. One-off timeouts are in `discreteTimeouts`. */
function timeoutRateAt(fn: LambdaFunction, t: number) {
  switch (fn.name) {
    case 'orders-worker':
      return (
        (t >= ORDERS_DEPLOY ? 0.3 * (0.001 + 0.006 * dailyShape('shop', t)) : 0) +
        0.01 * intensity(t, DYNAMODB_EVENT)
      );
    case 'checkout-api':
      // Only the 30% of requests that call Stripe can hang on it.
      return (
        0.3 * 0.06 * intensity(t, STRIPE_DEGRADED) + 0.003 * intensity(t, DYNAMODB_EVENT)
      );
    default:
      return 0;
  }
}

function timeoutsPerMinute(fn: LambdaFunction, t: number) {
  return invocationsPerMinute(fn, t) * timeoutRateAt(fn, t);
}

/** Rare one-off timeouts. Exact rather than sampled, so they show at any zoom level. */
function discreteTimeouts(fn: LambdaFunction, start: number, end: number): number[] {
  const out: number[] = [];
  const now = Date.now();
  if (
    fn.name === 'order-fulfillment' &&
    FULFILLMENT_TIMEOUT >= start &&
    FULFILLMENT_TIMEOUT < end
  ) {
    out.push(FULFILLMENT_TIMEOUT);
  }
  if (fn.name === 'checkout-api') {
    for (let hour = Math.floor(start / HOUR); hour * HOUR < end; hour++) {
      const at = hour * HOUR + Math.floor(hash(fn.name, 'timeout-at', hour) * HOUR);
      if (
        hash(fn.name, 'timeout', hour) < 0.025 &&
        at >= start &&
        at < end &&
        at <= now
      ) {
        out.push(at);
      }
    }
  }
  return out;
}

/** Memory the function would use without a limit. */
function memoryNeedAt(fn: LambdaFunction, t: number) {
  if (fn.name === 'report-generator') {
    // The report grows with the number of invoices this month.
    const growth = (t - (REPORT_OOM_FROM - 30 * HOUR)) / (30 * HOUR);
    return Math.round(
      fn.memoryUsedMb * (0.85 + 0.15 * Math.max(0, growth)) + (growth >= 1 ? 200 : 0)
    );
  }
  return Math.round(fn.memoryUsedMb * noise(fn, t, 'mem', 0.06));
}

function memoryAt(fn: LambdaFunction, t: number) {
  return Math.min(memoryLimitAt(fn, t), memoryNeedAt(fn, t));
}

function oomPerMinute(fn: LambdaFunction, t: number) {
  return t >= REPORT_OOM_FROM && memoryNeedAt(fn, t) >= memoryLimitAt(fn, t)
    ? invocationsPerMinute(fn, t)
    : 0;
}

function coldStartsPerMinute(fn: LambdaFunction, t: number) {
  // Memory changes publish versions, which cause cold starts too.
  return memo(`${getMockState().version}|${fn.name}|cold`, t, () => {
    const count = invocationsPerMinute(fn, t);
    if (fn.profile === 'schedule') {
      return count * fn.baseColdStartRate;
    }
    const provisioned = fn.provisionedConcurrency ?? 0;
    // Recycled and reclaimed environments, more of them when traffic ramps up.
    const ramp =
      Math.max(0, dailyShape(fn.profile, t + 30 * MINUTE) - dailyShape(fn.profile, t)) *
      8;
    let rate =
      count *
      fn.baseColdStartRate *
      (1 + ramp) *
      noise(fn, t, 'cold', 0.3) *
      (concurrencyDemand(fn, t) <= provisioned ? 0.15 : 1);
    // Scaling out: every new environment beyond the provisioned ones starts cold.
    rate +=
      Math.max(
        0,
        concurrencyAt(fn, t) - Math.max(concurrencyAt(fn, t - 10 * MINUTE), provisioned)
      ) / 10;
    // A deploy replaces every warm environment. Provisioned ones are initialized before traffic shifts.
    if (
      !provisioned &&
      releasesOf(fn).some(
        release => t >= release.deployedAt && t < release.deployedAt + 10 * MINUTE
      )
    ) {
      rate += concurrencyAt(fn, t) / 4 + 0.3;
    }
    return Math.min(rate, count);
  });
}

function iteratorAgeAt(fn: LambdaFunction, t: number) {
  if (fn.triggers[0]!.kind !== 'dynamodb') {
    return null;
  }
  return Math.max(
    250 + 700 * (0.5 + 0.5 * smoothNoise(`${fn.name}|iter`, t, 10 * MINUTE)),
    backlogAge(t, nightlyImport(t), 12, 0.12),
    backlogAge(t, INVENTORY_POISON, 15),
    // The stream poller was impaired too, as Lambda's event source mappings were in October 2025.
    backlogAge(t, DYNAMODB_EVENT, 25, 0.8)
  );
}

// https://aws.amazon.com/lambda/pricing/ (first pricing tier)
const GB_SECOND_PRICE = {arm64: 0.0000133334, x86_64: 0.0000166667};
const REQUEST_PRICE = 0.2 / 1_000_000;

export function costFor(
  fn: LambdaFunction,
  invocationCount: number,
  billedMs: number,
  memoryMb = fn.memoryMb
) {
  return (
    invocationCount * (billedMs / 1000) * (memoryMb / 1024) * GB_SECOND_PRICE[fn.arch] +
    invocationCount * REQUEST_PRICE
  );
}

function billedMsAt(fn: LambdaFunction, t: number) {
  // Mean duration, plus init on cold starts (billed since August 2025) and the extension's after-response upload.
  const coldShare =
    coldStartsPerMinute(fn, t) / Math.max(1e-9, invocationsPerMinute(fn, t));
  return meanDurationAt(fn, t) + coldShare * fn.initP50Ms + (fn.extensionLayer ? 24 : 0);
}

// Metrics

export type MetricKey =
  | 'invocations'
  | 'errors'
  | 'throttles'
  | 'timeouts'
  | 'oom'
  | 'p50'
  | 'p95'
  | 'p99'
  | 'p75'
  | 'p90'
  | 'maxDuration'
  | 'coldStarts'
  | 'initP95'
  | 'concurrency'
  | 'memory'
  | 'cost'
  | 'postRuntime'
  | 'iteratorAge'
  | 'asyncDropped'
  | 'batchFailures'
  | 'pcUtilization';

type Aggregation = 'sum' | 'mean' | 'max';

interface MetricDef {
  aggregation: Aggregation;
  label: string;
  meta: Omit<TimeSeries['meta'], 'interval'>;
  source: DataSource;
  /** Value per minute (sum metrics) or level (mean/max metrics). `null` means not applicable. */
  value: (fn: LambdaFunction, t: number) => number | null;
}

const COUNT: MetricDef['meta'] = {valueType: 'integer', valueUnit: null};
const DURATION: MetricDef['meta'] = {
  valueType: 'duration',
  valueUnit: DurationUnit.MILLISECOND,
};

export const METRICS: Record<MetricKey, MetricDef> = {
  invocations: {
    label: 'Invocations',
    aggregation: 'sum',
    meta: COUNT,
    source: 'extension',
    value: invocationsPerMinute,
  },
  errors: {
    label: 'Errors',
    aggregation: 'sum',
    meta: COUNT,
    source: 'extension',
    value: errorsPerMinute,
  },
  throttles: {
    label: 'Throttles',
    aggregation: 'sum',
    meta: COUNT,
    source: 'integration',
    value: throttlesPerMinute,
  },
  timeouts: {
    label: 'Timeouts',
    aggregation: 'sum',
    meta: COUNT,
    source: 'extension',
    value: timeoutsPerMinute,
  },
  oom: {
    label: 'Out of memory',
    aggregation: 'sum',
    meta: COUNT,
    source: 'extension',
    value: oomPerMinute,
  },
  p50: {
    label: 'Duration p50',
    aggregation: 'mean',
    meta: DURATION,
    source: 'spans',
    value: (fn, t) => durationAt(fn, t, 'p50'),
  },
  p95: {
    label: 'Duration p95',
    aggregation: 'mean',
    meta: DURATION,
    source: 'spans',
    value: (fn, t) => durationAt(fn, t, 'p95'),
  },
  p99: {
    label: 'Duration p99',
    aggregation: 'mean',
    meta: DURATION,
    source: 'spans',
    value: (fn, t) => durationAt(fn, t, 'p99'),
  },
  p75: {
    label: 'Duration p75',
    aggregation: 'mean',
    meta: DURATION,
    source: 'spans',
    value: (fn, t) => durationQuantileAt(fn, t, 0.674),
  },
  p90: {
    label: 'Duration p90',
    aggregation: 'mean',
    meta: DURATION,
    source: 'spans',
    value: (fn, t) => durationQuantileAt(fn, t, 1.282),
  },
  // Slowest invocation: the timeout when one timed out, otherwise about p99.9.
  maxDuration: {
    label: 'Duration max',
    aggregation: 'max',
    meta: DURATION,
    source: 'extension',
    value: (fn, t) =>
      timeoutsPerMinute(fn, t) >= 0.3
        ? fn.timeoutS * 1000
        : durationQuantileAt(fn, t, 3.09),
  },
  coldStarts: {
    label: 'Cold starts',
    aggregation: 'sum',
    meta: COUNT,
    source: 'extension',
    value: coldStartsPerMinute,
  },
  initP95: {
    label: 'Init duration p95',
    aggregation: 'mean',
    meta: DURATION,
    source: 'extension',
    value: (fn, t) => fn.initP95Ms * noise(fn, t, 'init', 0.15),
  },
  concurrency: {
    label: 'Concurrent executions',
    aggregation: 'max',
    meta: COUNT,
    source: 'integration',
    value: concurrencyAt,
  },
  memory: {
    label: 'Max memory used',
    aggregation: 'max',
    meta: {valueType: 'size', valueUnit: SizeUnit.MEBIBYTE},
    source: 'extension',
    value: memoryAt,
  },
  cost: {
    label: 'Estimated cost',
    aggregation: 'sum',
    meta: {valueType: 'currency', valueUnit: null},
    source: 'extension',
    value: (fn, t) =>
      costFor(fn, invocationsPerMinute(fn, t), billedMsAt(fn, t), memoryLimitAt(fn, t)),
  },
  postRuntime: {
    label: 'After-response time',
    aggregation: 'mean',
    meta: DURATION,
    source: 'extension',
    value: (fn, t) =>
      fn.extensionLayer ? 24 + 8 * smoothNoise(`${fn.name}|post`, t, 20 * MINUTE) : null,
  },
  iteratorAge: {
    label: 'Iterator age',
    aggregation: 'max',
    meta: DURATION,
    source: 'integration',
    value: iteratorAgeAt,
  },
  asyncDropped: {
    label: 'Async events dropped',
    aggregation: 'sum',
    meta: COUNT,
    source: 'integration',
    value: (fn, t) =>
      fn.triggers[0]!.kind === 'sns' ? (campaignAt(t)?.dropped ?? 0) : null,
  },
  batchFailures: {
    label: 'Partial batch failures',
    aggregation: 'sum',
    meta: COUNT,
    source: 'spans',
    value: (fn, t) =>
      fn.triggers[0]!.kind === 'sqs'
        ? errorsPerMinute(fn, t) * 1.7 + timeoutsPerMinute(fn, t) * 5.5
        : null,
  },
  pcUtilization: {
    label: 'Provisioned concurrency used',
    aggregation: 'max',
    meta: {valueType: 'percentage', valueUnit: null},
    source: 'integration',
    value: (fn, t) =>
      fn.provisionedConcurrency
        ? Math.min(1, concurrencyDemand(fn, t) / fn.provisionedConcurrency)
        : null,
  },
};

/** Count metrics come out as whole numbers with Poisson noise, so sparse failures look sparse. */
const COUNT_METRICS = new Set<MetricKey>([
  'invocations',
  'errors',
  'throttles',
  'timeouts',
  'oom',
  'coldStarts',
  'asyncDropped',
  'batchFailures',
]);
const bucketCache = new Map<string, number | null>();

/** One function's value for one bucket. Complete buckets are cached. */
function bucketValue(
  fn: LambdaFunction,
  metric: MetricKey,
  start: number,
  interval: number
): number | null {
  const now = Date.now();
  if (start > now) {
    return null;
  }
  const key = `${getMockState().version}|${fn.name}|${metric}|${start}|${interval}`;
  const complete = start + interval <= now;
  if (complete && bucketCache.has(key)) {
    return bucketCache.get(key)!;
  }
  const value = computeBucket(fn, metric, start, interval);
  if (complete) {
    if (bucketCache.size > 200_000) {
      bucketCache.clear();
    }
    bucketCache.set(key, value);
  }
  return value;
}

function computeBucket(
  fn: LambdaFunction,
  metric: MetricKey,
  start: number,
  interval: number
): number | null {
  const def = METRICS[metric];
  const discrete =
    metric === 'timeouts' ? discreteTimeouts(fn, start, start + interval).length : 0;
  if (fn.triggers[0]!.kind === 'schedule' && def.aggregation === 'sum') {
    // Scheduled functions run exactly every 15 minutes.
    let total = discrete;
    let any = false;
    for (
      let t = Math.ceil(start / (15 * MINUTE)) * 15 * MINUTE;
      t < start + interval && t <= Date.now();
      t += 15 * MINUTE
    ) {
      const value = def.value(fn, t);
      if (value !== null) {
        any = true;
        total += value * 15;
      }
    }
    return any || def.value(fn, start) !== null ? total : null;
  }
  // One sample per 5 minutes (up to 24 per bucket), or per minute around incidents.
  // The bucket still in progress only covers the time elapsed so far.
  const elapsed = Math.max(1000, Math.min(interval, Date.now() - start));
  const end = start + elapsed;
  const dense = INCIDENT_RANGES.some(range => range.start < end && range.end > start);
  const samples = dense
    ? Math.min(720, Math.ceil(elapsed / MINUTE))
    : Math.min(24, Math.max(4, Math.round(elapsed / GRAIN)));
  const values: number[] = [];
  for (let i = 0; i < samples; i++) {
    const value = def.value(fn, start + ((i + 0.5) * elapsed) / samples);
    if (value !== null) {
      values.push(value);
    }
  }
  if (!values.length) {
    return null;
  }
  if (def.aggregation === 'sum') {
    const expected =
      (values.reduce((a, b) => a + b, 0) / values.length) * (elapsed / MINUTE);
    return COUNT_METRICS.has(metric)
      ? poisson(expected, hash(fn.name, metric, start, interval)) + discrete
      : expected;
  }
  if (def.aggregation === 'max') {
    return Math.max(...values);
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Combine several functions' bucket values. Durations are weighted by invocations. */
function combine(
  fns: LambdaFunction[],
  metric: MetricKey,
  start: number,
  interval: number
): number | null {
  const def = METRICS[metric];
  const values = fns
    .map(fn => ({fn, value: bucketValue(fn, metric, start, interval)}))
    .filter((v): v is {fn: LambdaFunction; value: number} => v.value !== null);
  if (!values.length) {
    return null;
  }
  if (def.aggregation === 'sum') {
    return values.reduce((sum, v) => sum + v.value, 0);
  }
  if (def.aggregation === 'max') {
    return metric === 'concurrency'
      ? values.reduce((sum, v) => sum + v.value, 0)
      : Math.max(...values.map(v => v.value));
  }
  let weighted = 0;
  let weights = 0;
  for (const v of values) {
    const weight = bucketValue(v.fn, 'invocations', start, interval) ?? 0;
    weighted += v.value * weight;
    weights += weight;
  }
  return weights ? weighted / weights : null;
}

export function metricSeries(
  fns: LambdaFunction[],
  metric: MetricKey,
  window: TimeWindow,
  yAxis?: string
): TimeSeries {
  const def = METRICS[metric];
  return {
    yAxis: yAxis ?? def.label,
    meta: {...def.meta, interval: window.interval},
    values: bucketStarts(window).map(t => ({
      timestamp: t,
      value: combine(fns, metric, t, window.interval),
      incomplete: t <= Date.now() && t + window.interval > Date.now(),
    })),
  };
}

export function constantSeries(
  window: TimeWindow,
  value: number,
  yAxis: string,
  metric: MetricKey
): TimeSeries {
  return {
    yAxis,
    meta: {...METRICS[metric].meta, interval: window.interval},
    values: bucketStarts(window).map(t => ({
      timestamp: t,
      value: t > Date.now() ? null : value,
    })),
  };
}

/** Configured memory per bucket, so changes show up as a step. */
export function memoryLimitSeries(
  fn: LambdaFunction,
  window: TimeWindow,
  yAxis: string
): TimeSeries {
  return {
    yAxis,
    meta: {...METRICS.memory.meta, interval: window.interval},
    values: bucketStarts(window).map(t => ({
      timestamp: t,
      value: t > Date.now() ? null : memoryLimitAt(fn, t + window.interval),
    })),
  };
}

export type GroupBy = 'none' | 'function' | 'team' | 'trigger' | 'runtime';

export function groupKey(fn: LambdaFunction, groupBy: GroupBy) {
  switch (groupBy) {
    case 'function':
      return fn.name;
    case 'team':
      return `team:${fn.team}`;
    case 'trigger':
      return fn.triggers[0]!.label;
    case 'runtime':
      return fn.runtime;
    default:
      return 'all';
  }
}

/** One series per group, largest first; past `limit` groups the tail folds into "Other". */
export function groupedSeries(
  fns: LambdaFunction[],
  metric: MetricKey,
  window: TimeWindow,
  groupBy: GroupBy,
  limit = 5
): TimeSeries[] {
  if (groupBy === 'none') {
    return [metricSeries(fns, metric, window)];
  }
  const groups = new Map<string, LambdaFunction[]>();
  for (const fn of fns) {
    const key = groupKey(fn, groupBy);
    groups.set(key, [...(groups.get(key) ?? []), fn]);
  }
  const ranked = [...groups.entries()]
    .map(([key, members]) => ({
      members,
      series: metricSeries(members, metric, window, key),
    }))
    .filter(group => group.series.values.some(v => v.value !== null))
    .sort((a, b) => seriesPeak(b.series) - seriesPeak(a.series));
  if (ranked.length <= limit || METRICS[metric].aggregation !== 'sum') {
    return ranked.slice(0, limit).map(group => group.series);
  }
  const rest = ranked.slice(limit - 1).flatMap(group => group.members);
  return [
    ...ranked.slice(0, limit - 1).map(group => group.series),
    metricSeries(rest, metric, window, 'Other'),
  ];
}

export function coldStartRateSeries(fn: LambdaFunction, window: TimeWindow): TimeSeries {
  const invocationValues = metricSeries([fn], 'invocations', window).values;
  return {
    yAxis: 'cold start rate',
    meta: {valueType: 'percentage', valueUnit: null, interval: window.interval},
    values: metricSeries([fn], 'coldStarts', window).values.map((v, i) => ({
      ...v,
      value:
        v.value === null || !invocationValues[i]?.value
          ? null
          : v.value / invocationValues[i].value,
    })),
  };
}

/** p95 as a share of the configured timeout: comparable across functions of any speed. */
export function timeoutShareSeries(fn: LambdaFunction, window: TimeWindow): TimeSeries {
  return {
    yAxis: fn.name,
    meta: {valueType: 'percentage', valueUnit: null, interval: window.interval},
    values: metricSeries([fn], 'p95', window).values.map(v => ({
      ...v,
      value: v.value === null ? null : v.value / (fn.timeoutS * 1000),
    })),
  };
}

function seriesPeak(series: TimeSeries) {
  return series.values.reduce((sum, v) => sum + (v.value ?? 0), 0);
}

export interface Totals {
  asyncDropped: number;
  batchFailures: number;
  coldStarts: number;
  concurrency: number;
  cost: number;
  errors: number;
  initP95: number;
  invocations: number;
  iteratorAge: number | null;
  memory: number;
  oom: number;
  p50: number;
  p95: number;
  p99: number;
  pcUtilization: number | null;
  postRuntime: number;
  throttles: number;
  timeouts: number;
}

const totalsCache = new Map<string, Totals>();

/** Totals for a window. Cached because tables, tiles and insights ask for the same values. */
export function totals(fns: LambdaFunction[], window: TimeWindow): Totals {
  const key = `${getMockState().version}|${fns.map(fn => fn.name).join(',')}|${window.start}|${window.end}|${window.interval}`;
  const cached = totalsCache.get(key);
  if (cached) {
    return cached;
  }
  const values = (metric: MetricKey) =>
    metricSeries(fns, metric, window).values.map(v => v.value);
  const sum = (metric: MetricKey) =>
    values(metric).reduce((a: number, b) => a + (b ?? 0), 0);
  const maxOrNull = (metric: MetricKey) => {
    const present = values(metric).filter((v): v is number => v !== null);
    return present.length ? Math.max(...present) : null;
  };
  const invocationValues = values('invocations');
  const weightedMean = (metric: MetricKey) => {
    let weighted = 0;
    let weights = 0;
    values(metric).forEach((value, i) => {
      if (value !== null) {
        weighted += value * (invocationValues[i] ?? 0);
        weights += invocationValues[i] ?? 0;
      }
    });
    return weights ? weighted / weights : 0;
  };
  const result: Totals = {
    invocations: sum('invocations'),
    errors: sum('errors'),
    throttles: sum('throttles'),
    timeouts: sum('timeouts'),
    oom: sum('oom'),
    coldStarts: sum('coldStarts'),
    cost: sum('cost'),
    asyncDropped: sum('asyncDropped'),
    batchFailures: sum('batchFailures'),
    p50: weightedMean('p50'),
    p95: weightedMean('p95'),
    p99: weightedMean('p99'),
    initP95: weightedMean('initP95'),
    postRuntime: weightedMean('postRuntime'),
    memory: maxOrNull('memory') ?? 0,
    concurrency: maxOrNull('concurrency') ?? 0,
    iteratorAge: maxOrNull('iteratorAge'),
    pcUtilization: maxOrNull('pcUtilization'),
  };
  if (totalsCache.size > 800) {
    totalsCache.clear();
  }
  totalsCache.set(key, result);
  return result;
}

export function failureRate(t: Totals) {
  return t.invocations ? (t.errors + t.timeouts + t.oom) / t.invocations : 0;
}

export function coldStartRate(t: Totals) {
  return t.invocations ? t.coldStarts / t.invocations : 0;
}

// Health and insights (thresholds follow Datadog's Serverless Warnings)

export type Health = 'critical' | 'warning' | 'healthy';

export function health(fn: LambdaFunction, t: Totals): Health {
  const fixedOom =
    t.oom > 0 &&
    memoryNeedAt(fn, Date.now()) < memoryLimitAt(fn, Date.now()) &&
    (getMockState().memoryChanges[fn.name] ?? []).length > 0;
  // Kills from before a memory fix are history: keep a warning, not a critical.
  const rate = fixedOom ? failureRate({...t, oom: 0}) : failureRate(t);
  if (t.timeouts > 0 || (t.oom > 0 && !fixedOom) || rate > 0.1) {
    return 'critical';
  }
  if (
    fixedOom ||
    t.throttles > 0 ||
    rate > 0.01 ||
    t.memory / fn.memoryMb > 0.95 ||
    t.p99 / (fn.timeoutS * 1000) > 0.95 ||
    (t.iteratorAge ?? 0) > 5 * MINUTE ||
    DEPRECATED_RUNTIMES.has(fn.runtime) ||
    fn.instrumentation === 'drift'
  ) {
    return 'warning';
  }
  return 'healthy';
}

export interface Insight {
  detail: string;
  fix: string;
  functionName: string;
  id: string;
  investigate: {tab: string; query?: Record<string, string>};
  severity: 'danger' | 'warning' | 'info';
  source: DataSource;
  title: string;
}

function fmtMs(ms: number) {
  return ms >= 60_000
    ? `${(ms / 60_000).toFixed(1)}min`
    : ms >= 1000
      ? `${(ms / 1000).toFixed(1)}s`
      : `${Math.round(ms)}ms`;
}

export const MEMORY_OPTIONS = [128, 256, 512, 768, 1024, 1536, 1769, 2048, 3008];

function fmtClock(t: number) {
  const sameDay = new Date(t).toDateString() === new Date().toDateString();
  return new Date(t).toLocaleString(
    [],
    sameDay
      ? {hour: '2-digit', minute: '2-digit'}
      : {weekday: 'short', hour: '2-digit', minute: '2-digit'}
  );
}

interface KnownIncident extends TimeRange {
  cause: string;
  fix?: string;
}

/** The planted incidents that affected a function, as a root-cause analysis would describe them. */
function incidentsOf(fn: LambdaFunction): KnownIncident[] {
  const out: KnownIncident[] = [];
  if (fn.name in DYNAMODB_OPERATION) {
    const others = Object.keys(DYNAMODB_OPERATION).length - 1;
    out.push({
      ...DYNAMODB_EVENT,
      end: DYNAMODB_EVENT.end + 25 * MINUTE,
      cause: `AWS Health reported increased DynamoDB error rates in ${REGION}, and ${others} other functions that call DynamoDB failed at the same time.`,
      fix: 'Nothing to roll back. Check that the failed messages and events were retried and that none are left in a dead-letter queue.',
    });
  }
  switch (fn.name) {
    case 'checkout-api':
      out.push({
        ...STRIPE_DEGRADED,
        cause:
          'Calls to api.stripe.com slowed down and returned 5xx; in the timed-out traces the Stripe span was still running at the 29s deadline.',
        fix: 'Give the Stripe client a timeout well below 29s and return a retryable 503, so a slow Stripe can’t use up concurrency.',
      });
      break;
    case 'payments-webhook':
      out.push({
        ...WEBHOOK_SECRET_ROTATION,
        cause:
          'Every signature check failed after the signing secret was rotated in Stripe. Version 8 updated STRIPE_WEBHOOK_SECRET 14 minutes later, and Stripe retried the failed deliveries.',
        fix: 'During a rotation, verify against both the old and the new secret.',
      });
      break;
    case 'inventory-sync':
      out.push({
        ...INVENTORY_POISON,
        end: INVENTORY_POISON.end + 15 * MINUTE,
        cause:
          "A record with SKU 'NULL' failed on every retry and blocked its shard until inventory@5.0.3 skipped it.",
      });
      break;
    case 'notify-users':
      out.push({
        start: CAMPAIGN.start,
        end: CAMPAIGN.start + CAMPAIGN_MINUTES.length * MINUTE,
        cause:
          'The Autumn sale campaign published 150k notifications to order-events in 30 minutes.',
      });
      break;
    default:
      break;
  }
  return out;
}

/** The incident behind most of a metric's total (or its peak) in the window, if one stands out. */
function explain(
  fn: LambdaFunction,
  window: TimeWindow,
  metric: MetricKey
): {incident: KnownIncident; share: number} | null {
  const series = metricSeries([fn], metric, window).values;
  const total = series.reduce((sum, v) => sum + (v.value ?? 0), 0);
  const peak = series.reduce(
    (best, v) => ((v.value ?? 0) > (best.value ?? 0) ? v : best),
    series[0]!
  );
  let best: {incident: KnownIncident; share: number} | null = null;
  for (const incident of incidentsOf(fn)) {
    const inside = (timestamp: number) =>
      timestamp + window.interval > incident.start && timestamp < incident.end;
    const share =
      METRICS[metric].aggregation === 'sum'
        ? total
          ? series
              .filter(v => inside(v.timestamp))
              .reduce((sum, v) => sum + (v.value ?? 0), 0) / total
          : 0
        : inside(peak.timestamp)
          ? 1
          : 0;
    if (share > 0.3 && (!best || share > best.share)) {
      best = {incident, share};
    }
  }
  return best;
}

function explanation(fn: LambdaFunction, window: TimeWindow, metric: MetricKey) {
  const found = explain(fn, window, metric);
  if (!found) {
    return null;
  }
  const when = `between ${fmtClock(found.incident.start)} and ${fmtClock(found.incident.end)}`;
  const prefix =
    found.share > 0.97
      ? `All of them came ${when}.`
      : `${Math.round(found.share * 100)}% of them came ${when}.`;
  return {
    detail: `${METRICS[metric].aggregation === 'sum' ? `${prefix} ` : ''}${found.incident.cause}`,
    fix: found.incident.fix,
  };
}

export function insightsFor(fn: LambdaFunction, window: TimeWindow): Insight[] {
  const t = totals([fn], window);
  const out: Insight[] = [];
  const spanHours = (window.end - window.start) / HOUR;
  if (t.timeouts > 0) {
    const deploy =
      fn.name === 'orders-worker'
        ? releasesOf(fn).find(
            r => r.deployedAt === ORDERS_DEPLOY && r.deployedAt < window.end
          )
        : undefined;
    const cause = explanation(fn, window, 'timeouts');
    out.push({
      id: `${fn.name}-timeouts`,
      functionName: fn.name,
      severity: 'danger',
      title: `${Math.round(t.timeouts)} timeout${Math.round(t.timeouts) === 1 ? '' : 's'}: p99 is ${fmtMs(t.p99)} against a ${fn.timeoutS}s timeout`,
      detail: deploy
        ? `Started after ${deploy.release} (version ${deploy.version}, commit ${deploy.commit}${deploy.message ? `: "${deploy.message}"` : ''}), and peaks with evening traffic.`
        : (cause?.detail ??
          'The runtime was killed at the deadline. The extension reported each one and closed its trace.'),
      fix: deploy
        ? 'Compare slow invocations with the rest: carrier=dhl stands out. Lower the batch size or raise the timeout while the carrier call is fixed.'
        : (cause?.fix ??
          'Open the timed-out invocations to see which span was still running at the deadline.'),
      source: 'extension',
      investigate: {tab: 'invocations', query: {status: 'timeout'}},
    });
  }
  const memoryChange = (getMockState().memoryChanges[fn.name] ?? []).slice(-1)[0];
  if (
    t.oom > 0 &&
    memoryChange &&
    memoryChange.at > REPORT_OOM_FROM &&
    memoryNeedAt(fn, Date.now()) < memoryChange.memoryMb
  ) {
    const when = new Date(memoryChange.at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    out.push({
      id: `${fn.name}-oom-fixed`,
      functionName: fn.name,
      severity: 'info',
      title: `Out-of-memory kills stopped after memory was raised to ${memoryChange.memoryMb} MB`,
      detail: `${Math.round(t.oom)} kills in this period, all before the change at ${when}. Memory now peaks at ${Math.round(memoryNeedAt(fn, Date.now()))} MB.`,
      fix: `Update MemorySize to ${memoryChange.memoryMb} in the function's template so the next deploy keeps it.`,
      source: 'extension',
      investigate: {tab: 'cost'},
    });
  } else if (t.oom > 0) {
    out.push({
      id: `${fn.name}-oom`,
      functionName: fn.name,
      severity: 'danger',
      title: `${Math.round(t.oom)} out-of-memory kill${Math.round(t.oom) === 1 ? '' : 's'}: memory reached ${Math.round(t.memory)} of ${fn.memoryMb} MB`,
      detail:
        'Memory has grown with the report size for 30 hours. Every run since the limit was reached was killed.',
      fix: 'Increase memory to 1536 MB. More memory also adds CPU, so the cost per run barely changes (see Memory & cost).',
      source: 'extension',
      investigate: {tab: 'cost'},
    });
  }
  if (t.throttles > 0) {
    out.push({
      id: `${fn.name}-throttles`,
      functionName: fn.name,
      severity: 'warning',
      title: `${Math.round(t.throttles).toLocaleString()} throttles at the reserved concurrency limit of ${fn.reservedConcurrency}`,
      detail: `${explanation(fn, window, 'throttles')?.detail ?? `Traffic on ${fn.triggers[0]!.source} exceeded what ${fn.reservedConcurrency} environments can handle.`} Lambda kept the excess in its async queue; ${Math.round(t.asyncDropped).toLocaleString()} events waited longer than the ${MAX_EVENT_AGE_MINUTES}-minute maximum event age and were dropped.`,
      fix: `Raise reserved concurrency to ${Math.round((fn.reservedConcurrency ?? 0) * 2.5)}, or put an SQS queue with maximum concurrency between SNS and the function so bursts wait instead of being dropped.`,
      source: 'integration',
      investigate: {tab: 'overview'},
    });
  }
  if ((t.iteratorAge ?? 0) > 5 * MINUTE) {
    out.push({
      id: `${fn.name}-iterator`,
      functionName: fn.name,
      severity: 'warning',
      title: `Stream fell ${fmtMs(t.iteratorAge ?? 0)} behind (iterator age)`,
      detail:
        explanation(fn, window, 'iteratorAge')?.detail ??
        'Processing fell behind the writes to the stream.',
      fix:
        explanation(fn, window, 'iteratorAge')?.fix ??
        'Set MaximumRetryAttempts and BisectBatchOnFunctionError on the event source mapping, and send failed records to an on-failure destination.',
      source: 'integration',
      investigate: {tab: 'invocations', query: {status: 'error'}},
    });
  }
  const errorCause = t.errors >= 20 ? explanation(fn, window, 'errors') : null;
  if ((failureRate(t) > 0.01 || errorCause) && t.timeouts === 0 && t.oom === 0) {
    out.push({
      id: `${fn.name}-errors`,
      functionName: fn.name,
      severity: failureRate(t) > 0.1 ? 'danger' : 'warning',
      title:
        failureRate(t) > 0.01
          ? `Error rate ${(failureRate(t) * 100).toFixed(1)}%`
          : `Error spike: ${Math.round(t.errors).toLocaleString()} failed invocations`,
      detail:
        errorCause?.detail ??
        `${Math.round(t.errors).toLocaleString()} failed invocations${t.batchFailures ? ` and ${Math.round(t.batchFailures).toLocaleString()} failed batch records` : ''}.`,
      fix:
        errorCause?.fix ?? 'Group the failures by error type and release in Invocations.',
      source: 'extension',
      investigate: {tab: 'invocations', query: {status: 'error'}},
    });
  }
  if (spanHours >= 12 && t.memory / fn.memoryMb < 0.25 && fn.memoryMb > 512) {
    const target = MEMORY_OPTIONS.find(m => m >= t.memory * 1.6) ?? fn.memoryMb;
    out.push({
      id: `${fn.name}-overprovisioned`,
      functionName: fn.name,
      severity: 'info',
      title: `Over-provisioned: max memory used is ${Math.round((t.memory / fn.memoryMb) * 100)}% of ${fn.memoryMb} MB`,
      detail: `No invocation in this period used more than ${Math.round(t.memory)} MB.`,
      fix: `Try ${target} MB. Compare cost and duration per memory size in Memory & cost first, because CPU scales with memory.`,
      source: 'extension',
      investigate: {tab: 'cost'},
    });
  }
  if (t.pcUtilization !== null && t.pcUtilization < 0.6) {
    out.push({
      id: `${fn.name}-pc`,
      functionName: fn.name,
      severity: 'info',
      title: `Provisioned concurrency peaked at ${Math.round(t.pcUtilization * 100)}% of ${fn.provisionedConcurrency}`,
      detail: 'You pay for provisioned environments whether they serve requests or not.',
      fix: 'Lower provisioned concurrency or schedule it for peak hours only.',
      source: 'integration',
      investigate: {tab: 'cold-starts'},
    });
  }
  if (coldStartRate(t) > 0.02 && t.initP95 > 1000) {
    out.push({
      id: `${fn.name}-cold`,
      functionName: fn.name,
      severity: 'info',
      title: `Cold starts add ${fmtMs(t.initP95)} (p95) to ${(coldStartRate(t) * 100).toFixed(1)}% of invocations`,
      detail:
        fn.profile === 'schedule'
          ? 'The function runs every 15 minutes, and Lambda reclaims idle environments in between, so most runs start cold.'
          : fn.triggers[0]!.kind === 's3'
            ? 'Bulk uploads scale out to new environments, and each of them starts cold.'
            : fn.durable
              ? 'Executions resume after waits in whichever environment is free; at this traffic most have been reclaimed by then.'
              : 'Most cold starts happen when traffic ramps up in the morning, and after deploys.',
      fix: 'See which imports dominate init in Cold starts. Lazy-import heavy modules, or add provisioned concurrency for the ramp.',
      source: 'extension',
      investigate: {tab: 'cold-starts'},
    });
  }
  if (DEPRECATED_RUNTIMES.has(fn.runtime)) {
    out.push({
      id: `${fn.name}-runtime`,
      functionName: fn.name,
      severity: 'warning',
      title: `Deprecated runtime: ${fn.runtime}`,
      detail: 'AWS no longer applies security patches to this runtime.',
      fix: 'Upgrade to python3.13.',
      source: 'aws',
      investigate: {tab: 'configuration'},
    });
  }
  if (fn.instrumentation === 'drift') {
    out.push({
      id: `${fn.name}-drift`,
      functionName: fn.name,
      severity: 'warning',
      title: 'Sentry instrumentation was removed by a deploy',
      detail: `The CloudFormation deploy of ${releasesOf(fn)[0]?.release ?? 'the function'} at ${fmtClock(releasesOf(fn)[0]?.deployedAt ?? Date.now())} replaced the layers. Platform metrics still arrive through the AWS integration, but traces and errors don’t.`,
      fix: 'Remote instrumentation restores it on the next sync, or re-instrument now.',
      source: 'integration',
      investigate: {tab: 'configuration'},
    });
  }
  return out;
}

const SEVERITY_ORDER = {danger: 0, warning: 1, info: 2};

export function allInsights(fns: LambdaFunction[], window: TimeWindow) {
  return fns
    .flatMap(fn => insightsFor(fn, window))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// Sampled invocations (function.aws spans)

export type InvocationStatus = 'ok' | 'error' | 'timeout' | 'oom' | 'throttled';

export interface Invocation {
  attributes: Record<string, string>;
  billedMs: number;
  coldStart: boolean;
  durationMs: number;
  id: string;
  memoryMb: number;
  release: string;
  requestId: string;
  status: InvocationStatus;
  timestamp: number;
  traceId: string;
  trigger: string;
  version: number;
  errorType?: string;
  initMs?: number;
}

function hex(seed: string, length: number) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += Math.floor(hash(seed, i) * 16).toString(16);
  }
  return out;
}

function pick<T>(seed: number, options: Array<[T, number]>): T {
  let acc = 0;
  for (const [value, weight] of options) {
    acc += weight;
    if (seed < acc) {
      return value;
    }
  }
  return options[options.length - 1]![0];
}

/** Two-piece log-normal through p50, p95 and p99, with a short left tail because latency has a floor. */
function sampleDuration(fn: LambdaFunction, t: number, u: number, withoutStripe = false) {
  // The aggregate percentiles include the Stripe slowdown; route-level samples add it back where it applies.
  const stripe = withoutStripe ? intensity(t, STRIPE_DEGRADED) : 0;
  const p50 = durationAt(fn, t, 'p50') / (1 + 0.4 * stripe);
  const p95 = durationAt(fn, t, 'p95') / (1 + 14 * stripe);
  const p99 = durationAt(fn, t, 'p99') / (1 + 30 * stripe);
  const z = normalQuantile(u);
  const sigma = Math.log(p95 / p50) / 1.645;
  if (z < 1.645) {
    return p50 * Math.exp(z * sigma * (z < 0 ? 0.6 : 1));
  }
  return p95 * Math.exp(((z - 1.645) * Math.log(p99 / p95)) / (2.326 - 1.645));
}

/** The error most invocations failed with during an incident, if one is under way. */
function incidentErrorType(fn: LambdaFunction, t: number): string | undefined {
  if (fn.name in DYNAMODB_OPERATION && intensity(t, DYNAMODB_EVENT) > 0) {
    return `ClientError: An error occurred (InternalServerError) when calling the ${DYNAMODB_OPERATION[fn.name]} operation (reached max retries: 2): Internal server error`;
  }
  if (fn.name === 'checkout-api' && intensity(t, STRIPE_DEGRADED) > 0) {
    return 'APIConnectionError: Request to Stripe timed out';
  }
  if (fn.name === 'payments-webhook' && inRange(t, WEBHOOK_SECRET_ROTATION)) {
    return 'SignatureVerificationError: No signatures found matching the expected signature for payload';
  }
  if (fn.name === 'inventory-sync' && inRange(t, INVENTORY_POISON)) {
    return "ValueError: invalid literal for int() with base 10: 'NULL'";
  }
  if (fn.name === 'notify-users' && campaignAt(t)?.processed) {
    return 'TooManyRequestsError: HTTP Error 429: Too Many Requests';
  }
  return undefined;
}

/** `durationQuantile` replaces the random draw, for evenly spread (stratified) samples. */
/** `failureBoost` is how much error sampling over-represents failures; live tail sees every invocation, so 1. */
function invocationAt(
  fn: LambdaFunction,
  grain: number,
  index: number,
  scheduled?: number,
  durationQuantile?: number,
  failureBoost = 6
): Invocation {
  const seed = `${fn.name}-${grain}-${index}`;
  // The first sample in a grain is the one-off timeout, if the grain has one.
  const discreteTimeout =
    scheduled === undefined && index === 0
      ? discreteTimeouts(fn, grain * GRAIN, (grain + 1) * GRAIN)[0]
      : undefined;
  const t =
    scheduled ?? discreteTimeout ?? grain * GRAIN + Math.floor(hash(seed, 't') * GRAIN);
  const release = releaseAt(fn, t);
  const attributes: Record<string, string> = {};
  let durationMs = sampleDuration(fn, t, durationQuantile ?? hash(seed, 'dur'));
  let status: InvocationStatus = 'ok';
  let errorType: string | undefined;
  let trigger = fn.triggers[0]!.label;

  // Errors are kept by error sampling, so they're overrepresented compared to traffic.
  const errorChance = Math.min(0.9, errorRateAt(fn, t) * failureBoost);
  if (hash(seed, 'err') < errorChance) {
    status = 'error';
  }

  switch (fn.triggers[0]!.kind) {
    case 'api-gateway': {
      const route = pick(hash(seed, 'route'), [
        ['GET /orders/{id}', 0.45],
        ['GET /cart', 0.25],
        ['POST /checkout', 0.2],
        ['POST /orders/{id}/pay', 0.1],
      ]);
      const tier = pick(hash(seed, 'tier'), [
        ['free', 0.6],
        ['pro', 0.3],
        ['enterprise', 0.1],
      ]);
      if (route === 'POST /checkout' && tier === 'enterprise') {
        durationMs *= 4.2;
      }
      // Only the POST routes call Stripe, so only they hang while it is degraded.
      const stripe = intensity(t, STRIPE_DEGRADED);
      if (stripe > 0) {
        durationMs =
          sampleDuration(fn, t, durationQuantile ?? hash(seed, 'dur'), true) *
          (route.startsWith('POST') ? 1 + 25 * stripe : 1);
        if (status === 'error' && !route.startsWith('POST')) {
          status = hash(seed, 'get-error') < 0.1 ? 'error' : 'ok';
        }
      }
      attributes['http.route'] = route;
      attributes['http.request.method'] = route.split(' ')[0]!;
      attributes['user.tier'] = tier;
      attributes['http.response.status_code'] =
        status === 'error'
          ? stripe > 0
            ? '502'
            : pick(hash(seed, 'code'), [
                ['500', 0.8],
                ['503', 0.2],
              ])
          : route.startsWith('POST')
            ? '201'
            : '200';
      if (status === 'error') {
        errorType = pick(hash(seed, 'error'), [
          [
            'ClientError: An error occurred (ConditionalCheckFailedException) when calling the UpdateItem operation: The conditional request failed',
            0.5,
          ],
          ['TimeoutError: Timeout reading from socket', 0.3],
          ["KeyError: 'cart_id'", 0.2],
        ]);
      }
      trigger = route;
      break;
    }
    case 'sqs': {
      const carrier = pick(hash(seed, 'carrier'), [
        ['postnl', 0.35],
        ['dhl', 0.3],
        ['ups', 0.2],
        ['dpd', 0.15],
      ]);
      const batch = 1 + Math.floor(hash(seed, 'batch') * 10);
      // The release made the carrier call synchronous; DHL's API is the slow one.
      if (t >= ORDERS_DEPLOY) {
        durationMs =
          carrier === 'dhl'
            ? Math.max(
                durationMs * 3.2,
                durationAt(fn, t, 'p95') * (0.7 + 0.4 * hash(seed, 'dhl'))
              )
            : durationMs * 0.75;
      }
      durationMs *= 0.6 + batch / 12;
      attributes.carrier = carrier;
      attributes['messaging.batch.message_count'] = String(batch);
      attributes['messaging.destination.name'] = 'orders-queue';
      if (status === 'error') {
        errorType =
          carrier === 'dhl'
            ? pick(hash(seed, 'error'), [
                [
                  "ReadTimeout: HTTPSConnectionPool(host='api-eu.dhl.com', port=443): Read timed out. (read timeout=25)",
                  0.6,
                ],
                ['CarrierAPIError: 503 Service Unavailable', 0.4],
              ])
            : "KeyError: 'shipping_address'";
      }
      trigger = `SQS · ${batch} message${batch === 1 ? '' : 's'}`;
      break;
    }
    case 's3': {
      const type = pick(hash(seed, 'type'), [
        ['image/jpeg', 0.6],
        ['image/png', 0.3],
        ['image/heic', 0.1],
      ]);
      if (type === 'image/heic') {
        durationMs *= 2.4;
      }
      attributes['content.type'] = type;
      attributes['faas.document.collection'] = 'shop-uploads';
      attributes['faas.document.operation'] = 'insert';
      if (status === 'error') {
        errorType = pick(hash(seed, 'error'), [
          [
            'UnidentifiedImageError: cannot identify image file <_io.BytesIO object at 0x7f3a2c1e5d50>',
            0.75,
          ],
          [
            'DecompressionBombError: Image size (231211008 pixels) exceeds limit of 178956970 pixels, could be decompression bomb DOS attack.',
            0.25,
          ],
        ]);
      }
      trigger = `S3 · ObjectCreated · ${type.split('/')[1]}`;
      break;
    }
    case 'schedule': {
      attributes['report.invoices'] = String(
        Math.max(9_000, Math.round(12_000 + (t - (ANCHOR - 2 * DAY)) / MINUTE))
      );
      trigger = 'Scheduled event';
      break;
    }
    case 'function-url': {
      const event = pick(hash(seed, 'event'), [
        ['payment_intent.succeeded', 0.6],
        ['charge.refunded', 0.2],
        ['invoice.paid', 0.2],
      ]);
      attributes['stripe.event'] = event;
      attributes['http.route'] = 'POST /webhooks/stripe';
      if (status === 'error') {
        errorType =
          'ClientError: An error occurred (TransactionConflictException) when calling the TransactWriteItems operation: Transaction is ongoing for the item';
      }
      trigger = event;
      break;
    }
    case 'dynamodb': {
      const name = pick(hash(seed, 'event'), [
        ['MODIFY', 0.7],
        ['INSERT', 0.2],
        ['REMOVE', 0.1],
      ]);
      const records = 1 + Math.floor(hash(seed, 'records') * 50);
      attributes['faas.document.collection'] = 'inventory';
      attributes['faas.document.operation'] =
        name === 'MODIFY' ? 'edit' : name === 'INSERT' ? 'insert' : 'delete';
      attributes['messaging.batch.message_count'] = String(records);
      if (status === 'error') {
        errorType =
          "ConnectionTimeout: ConnectionTimeout caused by - ReadTimeoutError(HTTPSConnectionPool(host='search.internal', port=443): Read timed out. (read timeout=10))";
      }
      trigger = `DynamoDB · ${records} ${name.toLowerCase()} records`;
      break;
    }
    case 'sns': {
      const channel = pick(hash(seed, 'channel'), [
        ['email', 0.6],
        ['push', 0.3],
        ['sms', 0.1],
      ]);
      if (channel === 'sms') {
        durationMs *= 3;
      }
      attributes.channel = channel;
      attributes['messaging.destination.name'] = 'order-events';
      if (status === 'error') {
        errorType =
          channel === 'sms'
            ? 'TwilioRestException: HTTP 429 error: Unable to create record: Too Many Requests'
            : channel === 'push'
              ? 'UnavailableError: The service is currently unavailable.'
              : 'TooManyRequestsError: HTTP Error 429: Too Many Requests';
      }
      trigger = `SNS · ${channel}`;
      break;
    }
    case 'durable': {
      const step = pick(hash(seed, 'step'), [
        ['charge', 0.3],
        ['reserve-stock', 0.3],
        ['ship', 0.25],
        ['wait-for-carrier', 0.15],
      ]);
      attributes['aws.durable.step'] = step;
      attributes['aws.durable.replayed'] = hash(seed, 'replay') < 0.6 ? 'true' : 'false';
      if (status === 'error') {
        errorType = 'StepFailedError: ship';
      }
      trigger = `Durable · ${step}`;
      break;
    }
    default:
      break;
  }

  const incidentError = incidentErrorType(fn, t);
  if (status === 'error' && incidentError && hash(seed, 'incident') < 0.85) {
    errorType = incidentError;
  }

  const coldChance = Math.min(
    0.9,
    (coldStartsPerMinute(fn, t) / Math.max(1e-9, invocationsPerMinute(fn, t))) * 1.5
  );
  const coldStart = hash(seed, 'cold') < coldChance;
  attributes['faas.coldstart'] = String(coldStart);
  attributes.release = release.release;

  if (
    discreteTimeout !== undefined ||
    hash(seed, 'timeout') < Math.min(0.5, timeoutRateAt(fn, t) * failureBoost)
  ) {
    status = 'timeout';
    durationMs = fn.timeoutS * 1000;
    errorType = `TimeoutError: Task timed out after ${fn.timeoutS.toFixed(2)} seconds`;
    if (fn.triggers[0]!.kind === 'sqs') {
      attributes.carrier = 'dhl';
    }
  }
  if (oomPerMinute(fn, t) > 0) {
    status = 'oom';
    durationMs *= 0.7;
    errorType = 'Runtime.OutOfMemory: The function ran out of memory';
  }
  if (status === 'ok' && throttlesPerMinute(fn, t) > 0 && hash(seed, 'throttle') < 0.3) {
    status = 'throttled';
    durationMs = 0;
  }
  if (status === 'error' && !errorType) {
    errorType = 'Exception';
  }
  attributes.status = status;

  durationMs = Math.min(Math.round(durationMs), fn.timeoutS * 1000);
  const initMs = coldStart
    ? Math.round(fn.initP50Ms * (0.75 + 0.6 * hash(seed, 'init')))
    : undefined;
  return {
    id: seed,
    requestId: `${hex(seed + 'r1', 8)}-${hex(seed + 'r2', 4)}-4${hex(seed + 'r3', 3)}-a${hex(seed + 'r4', 3)}-${hex(seed + 'r5', 12)}`,
    traceId: hex(seed + 'trace', 32),
    timestamp: t,
    trigger,
    status,
    errorType,
    durationMs,
    billedMs:
      status === 'throttled'
        ? 0
        : durationMs + (initMs ?? 0) + (fn.extensionLayer ? 24 : 0),
    memoryMb:
      status === 'oom'
        ? memoryLimitAt(fn, t)
        : status === 'throttled'
          ? 0
          : Math.round(memoryAt(fn, t) * (0.7 + 0.3 * hash(seed, 'mem'))),
    coldStart,
    initMs,
    release: release.release,
    version: release.version,
    attributes,
  };
}

const invocationCache = new Map<string, Invocation[]>();
const MAX_GRAINS = 2016;

/** Sampled invocations in the window, newest first. Identity is stable across zoom levels. */
export function invocations(fn: LambdaFunction, window: TimeWindow): Invocation[] {
  const key = `${getMockState().version}|${fn.name}|${window.start}|${window.end}|${Math.floor(Date.now() / 5000)}`;
  const cached = invocationCache.get(key);
  if (cached) {
    return cached;
  }
  const out: Invocation[] = [];
  const now = Date.now();
  if (fn.triggers[0]!.kind === 'schedule') {
    for (
      let t = Math.ceil(window.start / (15 * MINUTE)) * 15 * MINUTE;
      t < window.end && t <= now;
      t += 15 * MINUTE
    ) {
      out.push(invocationAt(fn, grainOf(t), 0, t));
    }
  } else {
    const first = grainOf(window.start);
    const last = Math.min(grainOf(window.end), grainOf(now));
    const stride = Math.max(1, Math.ceil((last - first) / MAX_GRAINS));
    // Short windows keep more samples per grain (up to one per 20s), so live mode shows new rows.
    const cap = Math.max(3, Math.min(15, Math.round(300 / Math.max(1, last - first))));
    for (let grain = Math.ceil(first / stride) * stride; grain <= last; grain += stride) {
      const perGrain = invocationsPerMinute(fn, grain * GRAIN) * 5;
      const count = Math.max(
        1,
        Math.min(cap, Math.round((Math.log10(perGrain + 1) * cap) / 3))
      );
      for (let i = 0; i < count; i++) {
        const invocation = invocationAt(fn, grain, i);
        if (
          invocation.timestamp >= window.start &&
          invocation.timestamp < window.end &&
          invocation.timestamp <= now
        ) {
          out.push(invocation);
        }
      }
    }
  }
  out.sort((a, b) => b.timestamp - a.timestamp);
  if (invocationCache.size > 50) {
    invocationCache.clear();
  }
  invocationCache.set(key, out);
  return out;
}

/** Live tail shows at most this many invocations per second, sampled above it (like Lumigo's cap). */
export const LIVE_TAIL_MAX_PER_SECOND = 4;

/**
 * Invocations as they arrive, second by second in (from, to], newest first, plus the true rate.
 * Deterministic per second, so polling the same range twice returns the same rows.
 */
export function liveTail(
  fn: LambdaFunction,
  from: number,
  to: number
): {invocations: Invocation[]; perSecond: number} {
  const out: Invocation[] = [];
  const first = Math.floor(from / 1000) + 1;
  const last = Math.floor(Math.min(to, Date.now()) / 1000);
  for (let second = Math.max(first, last - 900); second <= last; second++) {
    const t = second * 1000;
    const rate = invocationsPerMinute(fn, t) / 60 + throttlesPerMinute(fn, t) / 60;
    const shown = poisson(
      Math.min(rate, LIVE_TAIL_MAX_PER_SECOND),
      hash(fn.name, 'tail', second)
    );
    for (let i = 0; i < shown; i++) {
      const at = t + Math.floor(hash(fn.name, 'tail-ms', second, i) * 1000);
      out.push(
        invocationAt(fn, grainOf(at), 100_000 + (second % 300) * 10 + i, at, undefined, 1)
      );
    }
  }
  out.sort((a, b) => b.timestamp - a.timestamp);
  const now = Math.min(to, Date.now());
  return {
    invocations: out,
    perSecond: (invocationsPerMinute(fn, now) + throttlesPerMinute(fn, now)) / 60,
  };
}

export interface DurationHeatmapData {
  /** Count per [column][row]; rows go from short to long durations. */
  counts: number[][];
  /** Row boundaries in ms, log-spaced; `edges.length === rows + 1`. */
  edges: number[];
  interval: number;
  starts: number[];
}

const HEATMAP_ROWS_PER_DECADE = 12;
const HEATMAP_SAMPLES_PER_COLUMN = 180;
const heatmapCache = new Map<string, DurationHeatmapData>();

/**
 * Duration distribution of every invocation (the extension reports all of them), bucketed on the
 * chart's own time intervals so columns line up with the other charts.
 */
export function durationHeatmap(
  fn: LambdaFunction,
  window: TimeWindow
): DurationHeatmapData {
  const key = `${getMockState().version}|${fn.name}|${window.start}|${window.end}|${Math.floor(Date.now() / 5000)}`;
  const cached = heatmapCache.get(key);
  if (cached) {
    return cached;
  }
  const now = Date.now();
  const starts = bucketStarts(window);
  const timeoutMs = fn.timeoutS * 1000;
  const samples: Array<{column: number; durationMs: number; weight: number}> = [];

  starts.forEach((start, column) => {
    if (start > now) {
      return;
    }
    if (fn.triggers[0]!.kind === 'schedule') {
      for (
        let t = Math.ceil(start / (15 * MINUTE)) * 15 * MINUTE;
        t < start + window.interval && t <= now;
        t += 15 * MINUTE
      ) {
        samples.push({
          column,
          durationMs: invocationAt(fn, grainOf(t), 0, t).durationMs,
          weight: 1,
        });
      }
      return;
    }
    const grains: number[] = [];
    for (
      let grain = grainOf(start);
      grain * GRAIN < start + window.interval && grain * GRAIN <= now;
      grain++
    ) {
      grains.push(grain);
    }
    const perGrain = Math.max(
      2,
      Math.ceil(HEATMAP_SAMPLES_PER_COLUMN / Math.max(1, grains.length))
    );
    const timeouts = bucketValue(fn, 'timeouts', start, window.interval) ?? 0;
    if (timeouts > 0) {
      samples.push({column, durationMs: timeoutMs, weight: timeouts});
    }
    for (const grain of grains) {
      const count = invocationsPerMinute(fn, grain * GRAIN) * (GRAIN / MINUTE);
      for (let i = 0; i < perGrain; i++) {
        const invocation = invocationAt(
          fn,
          grain,
          1000 + i,
          undefined,
          (i + 0.5) / perGrain
        );
        if (invocation.status !== 'throttled' && invocation.status !== 'timeout') {
          samples.push({
            column,
            durationMs: Math.max(1, invocation.durationMs),
            weight: count / perGrain,
          });
        }
      }
    }
  });

  // Rows from a 1-2-5 step below the fastest invocations to just above the slowest (or the timeout).
  const sorted = samples.map(sample => sample.durationMs).sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.001)] ?? 10;
  const high = Math.max(sorted[sorted.length - 1] ?? 1000, low * 10);
  const logMin = Math.floor(Math.log10(low) * 2) / 2;
  const logMax = Math.log10(Math.min(timeoutMs * 1.08, high * 1.25));
  const rows = Math.max(8, Math.ceil((logMax - logMin) * HEATMAP_ROWS_PER_DECADE));
  const edges = Array.from(
    {length: rows + 1},
    (_, i) => 10 ** (logMin + (i / rows) * (logMax - logMin))
  );
  const counts = starts.map(() => Array.from({length: rows}, () => 0));
  for (const sample of samples) {
    const row = Math.min(
      rows - 1,
      Math.max(
        0,
        Math.floor(((Math.log10(sample.durationMs) - logMin) / (logMax - logMin)) * rows)
      )
    );
    counts[sample.column]![row]! += sample.weight;
  }

  const data = {starts, interval: window.interval, edges, counts};
  if (heatmapCache.size > 20) {
    heatmapCache.clear();
  }
  heatmapCache.set(key, data);
  return data;
}

/** Event and response payloads for one invocation, with secrets masked like the SDK would. */
export function payloadFor(fn: LambdaFunction, invocation: Invocation) {
  const masked = '[Filtered]';
  const a = invocation.attributes;
  let event: Record<string, unknown>;
  switch (fn.triggers[0]!.kind) {
    case 'api-gateway':
      event = {
        version: '2.0',
        routeKey: a['http.route'],
        rawPath: (a['http.route'] ?? '').split(' ')[1]?.replace('{id}', '81723'),
        headers: {
          'user-agent': 'shop-web/5.2',
          authorization: masked,
          cookie: masked,
          'sentry-trace': `${invocation.traceId}-9a1b2c3d4e5f6a7b-1`,
        },
        requestContext: {
          http: {method: a['http.request.method'], sourceIp: masked},
          requestId: invocation.requestId.slice(0, 13),
        },
        body:
          a['http.request.method'] === 'POST'
            ? '{"items":[{"sku":"TSHIRT-M","qty":2}],"coupon":null}'
            : null,
      };
      break;
    case 'sqs':
      event = {
        Records: Array.from(
          {length: Math.min(3, Number(a['messaging.batch.message_count'] ?? 1))},
          (_, i) => ({
            messageId: hex(`${invocation.id}-m${i}`, 8),
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:eu-north-1:123456789012:orders-queue',
            // Messages from timed-out or failed batches come back after the visibility timeout.
            attributes: {
              ApproximateReceiveCount:
                hash(invocation.id, 'receive', i) <
                (invocation.timestamp >= ORDERS_DEPLOY ? 0.06 : 0.01)
                  ? '2'
                  : '1',
              AWSTraceHeader: 'Root=1-…',
            },
            messageAttributes: {
              'sentry-trace': {
                stringValue: `${invocation.traceId}-…`,
                dataType: 'String',
              },
            },
            body: `{"order_id":${81_700 + i},"carrier":"${a.carrier}"}`,
          })
        ),
      };
      break;
    case 's3':
      event = {
        Records: [
          {
            eventSource: 'aws:s3',
            eventName: 'ObjectCreated:Put',
            s3: {
              bucket: {name: 'shop-uploads'},
              object: {
                key: `uploads/${hex(invocation.id, 6)}.${(a['content.type'] ?? 'image/jpeg').split('/')[1]}`,
                size: 2_481_223,
              },
            },
          },
        ],
      };
      break;
    case 'schedule':
      event = {
        version: '0',
        source: 'aws.events',
        'detail-type': 'Scheduled Event',
        resources: ['arn:aws:events:eu-north-1:123456789012:rule/report-every-15m'],
        detail: {},
      };
      break;
    case 'function-url':
      event = {
        version: '2.0',
        rawPath: '/webhooks/stripe',
        headers: {'stripe-signature': masked},
        body: `{"type":"${a['stripe.event']}","data":{"object":{"customer":"${masked}"}}}`,
      };
      break;
    case 'dynamodb':
      event = {
        Records: [
          {
            eventName: 'MODIFY',
            eventSource: 'aws:dynamodb',
            dynamodb: {Keys: masked, NewImage: masked, SizeBytes: 412},
          },
        ],
        note: 'DynamoDB images are database content and are never collected',
      };
      break;
    case 'sns':
      event = {
        Records: [
          {
            EventSource: 'aws:sns',
            Sns: {
              TopicArn: 'arn:aws:sns:eu-north-1:123456789012:order-events',
              MessageAttributes: {
                'sentry-trace': {Type: 'String', Value: `${invocation.traceId}-…`},
              },
              Message: masked,
            },
          },
        ],
      };
      break;
    default:
      event = {
        DurableExecutionArn:
          'arn:aws:lambda:eu-north-1:123456789012:function:order-fulfillment:5/durable-execution/order-81723/3f9c',
        InitialExecutionState: {Operations: '[3 operations]'},
      };
  }
  const response =
    invocation.status === 'ok'
      ? fn.triggers[0]!.kind === 'sqs'
        ? {batchItemFailures: []}
        : fn.triggers[0]!.faasTrigger === 'http'
          ? {statusCode: Number(a['http.response.status_code'] ?? 200), body: '…'}
          : null
      : invocation.status === 'error'
        ? {
            errorType: invocation.errorType?.split(':')[0],
            errorMessage: invocation.errorType,
          }
        : null;
  return {event, response};
}

// Trace for one invocation

export interface MockSpan {
  depth: number;
  description: string;
  durationMs: number;
  op: string;
  startMs: number;
  note?: string;
  status?: 'ok' | 'error' | 'deadline_exceeded' | 'unfinished';
}

export function traceSpans(fn: LambdaFunction, invocation: Invocation): MockSpan[] {
  const spans: MockSpan[] = [];
  const init = invocation.initMs ?? 0;
  if (invocation.coldStart) {
    spans.push(
      {
        op: 'function.aws.init',
        description: `${fn.name} init`,
        startMs: 0,
        durationMs: init,
        depth: 1,
        note: 'Lambda init reported by the extension (platform.initReport)',
      },
      {
        op: 'function.aws.import',
        description: 'sentry_sdk',
        startMs: init * 0.02,
        durationMs: init * 0.05,
        depth: 2,
      },
      {
        op: 'function.aws.import',
        description: 'boto3',
        startMs: init * 0.08,
        durationMs: init * 0.31,
        depth: 2,
      },
      {
        op: 'function.aws.import',
        description: fn.name === 'checkout-api' ? 'pandas' : 'requests',
        startMs: init * 0.4,
        durationMs: init * (fn.name === 'checkout-api' ? 0.3 : 0.08),
        depth: 2,
      },
      {
        op: 'function.aws.import',
        description: fn.handler.split('.')[0]!,
        startMs: init * 0.72,
        durationMs: init * 0.24,
        depth: 2,
      }
    );
  }
  const start = init;
  const total = Math.max(1, invocation.durationMs);
  const isTimeout = invocation.status === 'timeout';
  const isOom = invocation.status === 'oom';
  const failed = invocation.status === 'error';
  spans.unshift({
    op: 'function.aws',
    description: fn.name,
    startMs: start,
    durationMs: total,
    depth: 0,
    status: isTimeout ? 'deadline_exceeded' : isOom || failed ? 'error' : 'ok',
    note: isTimeout
      ? 'Closed by the Sentry extension at the deadline: the runtime was killed'
      : isOom
        ? 'Closed by the Sentry extension after Runtime.OutOfMemory'
        : `faas.trigger=${fn.triggers[0]!.faasTrigger}${invocation.coldStart ? ', faas.coldstart=true' : ''}`,
  });

  const kind = fn.triggers[0]!.kind;
  if (kind === 'sqs') {
    spans.push(
      {
        op: 'queue.process',
        description: 'process orders-queue',
        startMs: start + 4,
        durationMs: total - 10,
        depth: 1,
        note: `messaging.batch.message_count=${invocation.attributes['messaging.batch.message_count']}, linked to producer spans`,
      },
      {
        op: 'db',
        description: 'GetItem orders',
        startMs: start + 12,
        durationMs: total * 0.04,
        depth: 2,
      },
      {
        op: 'http.client',
        description: `POST https://${invocation.attributes.carrier}.carrier-api.example.com/shipments`,
        startMs: start + total * 0.08,
        durationMs: isTimeout ? total * 0.92 : total * 0.71,
        depth: 2,
        status: isTimeout ? 'unfinished' : failed ? 'error' : 'ok',
      },
      ...(isTimeout
        ? []
        : [
            {
              op: 'db',
              description: 'UpdateItem orders',
              startMs: start + total * 0.82,
              durationMs: total * 0.05,
              depth: 2,
            },
          ])
    );
  } else if (kind === 'api-gateway' || kind === 'function-url') {
    spans.push(
      {
        op: 'db',
        description: 'Query orders',
        startMs: start + 6,
        durationMs: total * 0.22,
        depth: 1,
      },
      {
        op: 'cache.get',
        description: 'cart:{user_id}',
        startMs: start + total * 0.25,
        durationMs: total * 0.03,
        depth: 1,
      },
      {
        op: 'http.client',
        description: 'POST https://api.stripe.com/v1/payment_intents',
        startMs: start + total * 0.3,
        durationMs: total * 0.55,
        depth: 1,
        status: isTimeout ? 'unfinished' : 'ok',
      },
      {
        op: 'queue.publish',
        description: 'send orders-queue',
        startMs: start + total * 0.88,
        durationMs: total * 0.06,
        depth: 1,
      }
    );
  } else if (kind === 's3') {
    spans.push(
      {
        op: 'object.get',
        description: 'GetObject shop-uploads',
        startMs: start + 4,
        durationMs: total * 0.21,
        depth: 1,
      },
      {
        op: 'function',
        description: 'resize_variants',
        startMs: start + total * 0.23,
        durationMs: total * 0.55,
        depth: 1,
      },
      {
        op: 'object.put',
        description: 'PutObject shop-thumbnails',
        startMs: start + total * 0.8,
        durationMs: total * 0.17,
        depth: 1,
      }
    );
  } else if (kind === 'schedule') {
    spans.push(
      {
        op: 'db',
        description: 'Query invoices',
        startMs: start + 10,
        durationMs: total * 0.3,
        depth: 1,
      },
      {
        op: 'function',
        description: 'render_pdf',
        startMs: start + total * 0.32,
        durationMs: isOom ? total * 0.68 : total * 0.5,
        depth: 1,
        status: isOom ? 'unfinished' : 'ok',
      },
      {
        op: 'object.put',
        description: 'PutObject finance-reports',
        startMs: start + total * 0.85,
        durationMs: total * 0.1,
        depth: 1,
      }
    );
  } else if (kind === 'durable') {
    spans.push(
      {
        op: 'function.aws.durable',
        description: 'order-fulfillment execute',
        startMs: start + 2,
        durationMs: total - 4,
        depth: 1,
        note: 'aws.durable.execution_id=3f9c…, invocation 3 of 5',
      },
      {
        op: 'function.aws.durable.step',
        description: 'charge',
        startMs: start + 4,
        durationMs: 1,
        depth: 2,
        note: 'replayed: result came from the checkpoint log',
      },
      {
        op: 'function.aws.durable.step',
        description: 'reserve-stock',
        startMs: start + 6,
        durationMs: 1,
        depth: 2,
        note: 'replayed',
      },
      {
        op: 'function.aws.durable.step',
        description: 'ship',
        startMs: start + 10,
        durationMs: total * 0.8,
        depth: 2,
      },
      {
        op: 'function.aws.durable.wait',
        description: 'wait-for-carrier',
        startMs: start + total * 0.85,
        durationMs: total * 0.1,
        depth: 2,
        note: 'suspends the execution; continues in the next invocation',
      }
    );
  } else if (kind === 'sns') {
    spans.push(
      {
        op: 'db',
        description: 'GetItem users',
        startMs: start + 4,
        durationMs: total * 0.15,
        depth: 1,
      },
      {
        op: 'http.client',
        description: `POST https://api.${invocation.attributes.channel === 'sms' ? 'twilio' : 'sendgrid'}.com/send`,
        startMs: start + total * 0.2,
        durationMs: total * 0.7,
        depth: 1,
        status: failed ? 'error' : 'ok',
      }
    );
  } else {
    spans.push(
      {
        op: 'db',
        description: 'BatchWriteItem inventory_snapshots',
        startMs: start + 6,
        durationMs: total * 0.5,
        depth: 1,
      },
      {
        op: 'http.client',
        description: 'POST https://search.internal/reindex',
        startMs: start + total * 0.6,
        durationMs: total * 0.35,
        depth: 1,
        status: failed ? 'error' : 'ok',
      }
    );
  }
  return spans;
}

// Logs

export interface MockLog {
  id: string;
  invocationId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  requestId: string;
  source: 'stdout' | 'platform' | 'logging';
  timestamp: number;
}

export interface StackFrame {
  context: string;
  file: string;
  function: string;
  inApp: boolean;
  line: number;
}

// Library frames that raise each error, innermost last.
const LIBRARY_FRAMES: Array<[RegExp, StackFrame[]]> = [
  [
    /^ClientError|InternalServerError|ProvisionedThroughput/,
    [
      {
        file: 'botocore/client.py',
        function: '_api_call',
        line: 602,
        context: 'return self._make_api_call(operation_name, kwargs)',
        inApp: false,
      },
      {
        file: 'botocore/client.py',
        function: '_make_api_call',
        line: 1078,
        context: 'raise error_class(parsed_response, operation_name)',
        inApp: false,
      },
    ],
  ],
  [
    /^TimeoutError: Timeout reading/,
    [
      {
        file: 'redis/commands/core.py',
        function: 'get',
        line: 1829,
        context: 'return self.execute_command("GET", name, keys=[name])',
        inApp: false,
      },
      {
        file: 'redis/connection.py',
        function: 'read_response',
        line: 512,
        context: 'raise TimeoutError(f"Timeout reading from {host_error}")',
        inApp: false,
      },
    ],
  ],
  [
    /^ReadTimeout/,
    [
      {
        file: 'requests/api.py',
        function: 'post',
        line: 115,
        context: 'return request("post", url, data=data, json=json, **kwargs)',
        inApp: false,
      },
      {
        file: 'requests/adapters.py',
        function: 'send',
        line: 713,
        context: 'raise ReadTimeout(e, request=request)',
        inApp: false,
      },
    ],
  ],
  [
    /^APIConnectionError/,
    [
      {
        file: 'stripe/_payment_intent.py',
        function: 'create',
        line: 2671,
        context: 'cls._static_request("post", cls.class_url(), params=params)',
        inApp: false,
      },
      {
        file: 'stripe/_http_client.py',
        function: '_handle_request_error',
        line: 980,
        context: 'raise error.APIConnectionError(msg, should_retry=should_retry)',
        inApp: false,
      },
    ],
  ],
  [
    /^SignatureVerificationError/,
    [
      {
        file: 'stripe/_webhook.py',
        function: 'construct_event',
        line: 30,
        context: 'WebhookSignature.verify_header(payload, sig_header, secret, tolerance)',
        inApp: false,
      },
      {
        file: 'stripe/_webhook.py',
        function: 'verify_header',
        line: 107,
        context:
          'raise error.SignatureVerificationError("No signatures found matching the expected signature for payload", header, payload)',
        inApp: false,
      },
    ],
  ],
  [
    /^(UnidentifiedImageError|DecompressionBombError)/,
    [
      {
        file: 'PIL/Image.py',
        function: 'open',
        line: 3498,
        context: 'im = _open_core(fp, filename, prefix, formats)',
        inApp: false,
      },
      {
        file: 'PIL/Image.py',
        function: '_decompression_bomb_check',
        line: 3277,
        context: 'raise DecompressionBombError(msg)',
        inApp: false,
      },
    ],
  ],
  [
    /^ConnectionTimeout/,
    [
      {
        file: 'opensearchpy/client/__init__.py',
        function: 'bulk',
        line: 2195,
        context:
          'return self.transport.perform_request("POST", path, params=params, headers=headers, body=body)',
        inApp: false,
      },
      {
        file: 'opensearchpy/connection/http_urllib3.py',
        function: 'perform_request',
        line: 276,
        context: 'raise ConnectionTimeout("TIMEOUT", str(e), e)',
        inApp: false,
      },
    ],
  ],
  [
    /^TwilioRestException/,
    [
      {
        file: 'twilio/rest/api/v2010/account/message/__init__.py',
        function: 'create',
        line: 813,
        context:
          'payload = self._version.create(method="POST", uri=self._uri, data=data)',
        inApp: false,
      },
      {
        file: 'twilio/base/version.py',
        function: 'create',
        line: 461,
        context: 'raise self.exception(method, uri, response, "Unable to create record")',
        inApp: false,
      },
    ],
  ],
  [
    /^TooManyRequestsError/,
    [
      {
        file: 'sendgrid/base_interface.py',
        function: 'send',
        line: 62,
        context: 'return self.client.mail.send.post(request_body=message)',
        inApp: false,
      },
      {
        file: 'python_http_client/client.py',
        function: '_make_request',
        line: 175,
        context: 'raise exc',
        inApp: false,
      },
    ],
  ],
  [
    /^UnavailableError/,
    [
      {
        file: 'firebase_admin/messaging.py',
        function: 'send',
        line: 95,
        context: 'return _get_messaging_service(app).send(message, dry_run)',
        inApp: false,
      },
      {
        file: 'firebase_admin/_utils.py',
        function: 'handle_requests_error',
        line: 238,
        context: 'return exc_type(message, cause=error, http_response=error.response)',
        inApp: false,
      },
    ],
  ],
];

/** Where a timed-out invocation was stuck: Sentry's timeout warning captures the main thread's stack. */
const TIMEOUT_FRAMES: Record<string, StackFrame[]> = {
  'orders-worker': [
    {
      file: 'urllib3/connectionpool.py',
      function: '_make_request',
      line: 537,
      context: 'response = conn.getresponse()',
      inApp: false,
    },
    {
      file: 'ssl.py',
      function: 'recv_into',
      line: 1251,
      context: 'return self.read(nbytes, buffer)',
      inApp: false,
    },
  ],
  'checkout-api': [
    {
      file: 'stripe/_http_client.py',
      function: 'request_with_retries',
      line: 344,
      context: 'self._sleep_time_seconds(num_retries, response)',
      inApp: false,
    },
    {file: 'time.py', function: 'sleep', line: 0, context: '', inApp: false},
  ],
};

/** A Python traceback for a failed invocation, outermost frame first. */
export function stackFor(fn: LambdaFunction, invocation: Invocation): StackFrame[] {
  const [module, handler] = fn.handler.split('.');
  const seed = invocation.id;
  const appFile = `/var/task/${module}.py`;
  const frames: StackFrame[] = [
    {
      file: 'sentry_sdk/integrations/aws_lambda.py',
      function: 'sentry_handler',
      line: 165,
      context: 'return handler(aws_event, aws_context, *args, **kwargs)',
      inApp: false,
    },
    {
      file: appFile,
      function: handler ?? 'handler',
      line: 20 + Math.floor(hash(seed, 'l1') * 30),
      context: 'return process(event)',
      inApp: true,
    },
  ];
  const error = invocation.errorType ?? '';
  if (invocation.status === 'timeout') {
    return [
      ...frames,
      {
        file: appFile,
        function: 'process',
        line: 88,
        context: 'response = client.send(payload)',
        inApp: true,
      },
      ...(TIMEOUT_FRAMES[fn.name] ?? [
        {
          file: 'socket.py',
          function: 'readinto',
          line: 708,
          context: 'return self._sock.recv_into(b)',
          inApp: false,
        },
      ]),
    ];
  }
  if (error.startsWith('KeyError')) {
    const key = error.match(/'(.+)'/)?.[1] ?? 'id';
    return [
      ...frames,
      {
        file: appFile,
        function: 'process',
        line: 61,
        context: `value = record["${key}"]`,
        inApp: true,
      },
    ];
  }
  if (error.startsWith('CarrierAPIError')) {
    return [
      ...frames,
      {
        file: '/var/task/carriers/dhl.py',
        function: 'create_shipment',
        line: 74,
        context: 'raise CarrierAPIError(f"{response.status_code} {response.reason}")',
        inApp: true,
      },
    ];
  }
  const library = LIBRARY_FRAMES.find(([pattern]) => pattern.test(error))?.[1];
  return [
    ...frames,
    {
      file: appFile,
      function: 'process',
      line: 40 + Math.floor(hash(seed, 'l2') * 60),
      context: 'result = client.call(**params)',
      inApp: true,
    },
    ...(library ?? []),
  ];
}

export function logsFor(fn: LambdaFunction, invocation: Invocation): MockLog[] {
  const t0 = invocation.timestamp;
  const base = {invocationId: invocation.id, requestId: invocation.requestId};
  if (invocation.status === 'throttled') {
    return [
      {
        ...base,
        id: `${invocation.id}-throttle`,
        timestamp: t0,
        level: 'warn',
        source: 'platform',
        message: `Rate exceeded: reserved concurrency ${fn.reservedConcurrency} reached (TooManyRequestsException)`,
      },
    ];
  }
  const out: MockLog[] = [
    {
      ...base,
      id: `${invocation.id}-start`,
      timestamp: t0,
      level: 'info',
      source: 'platform',
      message: `START RequestId: ${invocation.requestId} Version: ${invocation.version}`,
    },
    {
      ...base,
      id: `${invocation.id}-handle`,
      timestamp: t0 + 4,
      level: 'info',
      source: 'logging',
      message: `Handling ${invocation.trigger}`,
    },
  ];
  if (fn.triggers[0]!.kind === 'sqs') {
    out.push({
      ...base,
      id: `${invocation.id}-print`,
      timestamp: t0 + 40,
      level: 'info',
      source: 'stdout',
      message: `shipment payload built for ${invocation.attributes['messaging.batch.message_count']} orders (carrier=${invocation.attributes.carrier})`,
    });
  }
  if (invocation.durationMs > fn.p95Ms) {
    out.push({
      ...base,
      id: `${invocation.id}-slow`,
      timestamp: t0 + invocation.durationMs * 0.6,
      level: 'warn',
      source: 'logging',
      message: `slow downstream call took ${Math.round(invocation.durationMs * 0.5)}ms`,
    });
  }
  if (invocation.status === 'timeout') {
    out.push({
      ...base,
      id: `${invocation.id}-timeout`,
      timestamp: t0 + invocation.durationMs,
      level: 'error',
      source: 'platform',
      message: `${new Date(t0).toISOString()} ${invocation.requestId} Task timed out after ${fn.timeoutS.toFixed(2)} seconds`,
    });
  } else if (invocation.status === 'oom') {
    out.push({
      ...base,
      id: `${invocation.id}-oom`,
      timestamp: t0 + invocation.durationMs,
      level: 'error',
      source: 'platform',
      message: 'Error: Runtime exited with error: signal: killed (Runtime.OutOfMemory)',
    });
  } else if (invocation.status === 'error') {
    out.push({
      ...base,
      id: `${invocation.id}-error`,
      timestamp: t0 + invocation.durationMs - 3,
      level: 'error',
      source: 'logging',
      message: `Unhandled exception: ${invocation.errorType}`,
    });
  }
  out.push({
    ...base,
    id: `${invocation.id}-report`,
    timestamp: t0 + invocation.durationMs + 20,
    level: 'info',
    source: 'platform',
    message: `REPORT RequestId: ${invocation.requestId} Duration: ${invocation.durationMs.toFixed(2)} ms Billed Duration: ${invocation.billedMs} ms Memory Size: ${fn.memoryMb} MB Max Memory Used: ${invocation.memoryMb} MB${invocation.initMs ? ` Init Duration: ${invocation.initMs.toFixed(2)} ms` : ''}`,
  });
  return out;
}

// Issues

export interface MockIssue {
  count: number;
  culprit: string;
  firstSeen: string;
  reportedBy: 'SDK' | 'Extension';
  shortId: string;
  title: string;
}

export function issuesFor(fn: LambdaFunction, window: TimeWindow): MockIssue[] {
  const t = totals([fn], window);
  const prefix = fn.team.toUpperCase().slice(0, 4);
  const list: MockIssue[] = [];
  if (t.timeouts > 0) {
    const firstSeen =
      fn.name === 'orders-worker'
        ? `in ${releaseAt(fn, ORDERS_DEPLOY).release}`
        : fn.name === 'checkout-api'
          ? '9 weeks ago'
          : `${Math.max(1, Math.round((Date.now() - FULFILLMENT_TIMEOUT) / HOUR))} hours ago`;
    list.push({
      shortId: `${prefix}-4F2`,
      title: `TimeoutError: Task timed out after ${fn.timeoutS.toFixed(2)} seconds`,
      culprit: fn.name,
      count: Math.round(t.timeouts),
      firstSeen,
      reportedBy: 'Extension',
    });
  }
  if (t.oom > 0) {
    list.push({
      shortId: `${prefix}-1C`,
      title: 'Runtime.OutOfMemory: The function ran out of memory',
      culprit: fn.name,
      count: Math.round(t.oom),
      firstSeen: '90 minutes ago',
      reportedBy: 'Extension',
    });
  }
  const errorTypes = new Map<string, number>();
  const firstSampled = new Map<string, number>();
  for (const invocation of invocations(fn, window)) {
    if (invocation.status === 'error' && invocation.errorType) {
      errorTypes.set(
        invocation.errorType,
        (errorTypes.get(invocation.errorType) ?? 0) + 1
      );
      firstSampled.set(
        invocation.errorType,
        Math.min(firstSampled.get(invocation.errorType) ?? Infinity, invocation.timestamp)
      );
    }
  }
  const sampled = [...errorTypes.values()].reduce((a, b) => a + b, 0) || 1;
  [...errorTypes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .forEach(([title, count], i) => {
      // Errors that only happen during an incident are new issues; the rest have been around.
      const first = firstSampled.get(title)!;
      const isNew = incidentErrorType(fn, first) === title;
      const hoursAgo = Math.round((Date.now() - first) / HOUR);
      list.push({
        shortId: `${prefix}-${(0x2a9 + i * 7).toString(16).toUpperCase()}`,
        title,
        culprit: `${fn.handler.split('.')[0]}.${fn.handler.split('.')[1]}`,
        count: Math.max(1, Math.round((t.errors * count) / sampled)),
        firstSeen: isNew
          ? hoursAgo < 48
            ? `${hoursAgo} hours ago`
            : `${Math.round(hoursAgo / 24)} days ago`
          : `${3 + i * 4} weeks ago`,
        reportedBy: 'SDK',
      });
    });
  return list;
}

// Imports, dependencies, right-sizing

export function imports(fn: LambdaFunction) {
  const base = fn.initP50Ms;
  const heavy = fn.name === 'checkout-api';
  return [
    {module: 'boto3', p50Ms: Math.round(base * 0.31), share: 0.31, from: 'layer'},
    {
      module: heavy ? 'pandas' : 'requests',
      p50Ms: Math.round(base * (heavy ? 0.3 : 0.08)),
      share: heavy ? 0.3 : 0.08,
      from: 'app',
    },
    {
      module: fn.handler.split('.')[0]!,
      p50Ms: Math.round(base * 0.14),
      share: 0.14,
      from: 'app',
    },
    {
      module: 'runtime bootstrap',
      p50Ms: Math.round(base * 0.12),
      share: 0.12,
      from: 'runtime',
    },
    {module: 'pydantic', p50Ms: Math.round(base * 0.06), share: 0.06, from: 'app'},
    {module: 'sentry_sdk', p50Ms: Math.round(base * 0.05), share: 0.05, from: 'layer'},
  ];
}

export interface Dependency {
  callsPerInvocation: number;
  errorRate: number;
  kind: 'trigger' | 'downstream';
  label: string;
  op: string;
  p95Ms: number;
  shareOfDuration: number;
}

export function dependencies(fn: LambdaFunction): Dependency[] {
  const trigger = fn.triggers[0]!;
  const upstream: Dependency = {
    kind: 'trigger',
    op: trigger.label,
    label: trigger.source,
    callsPerInvocation: 1,
    p95Ms: 0,
    errorRate: 0,
    shareOfDuration: 0,
  };
  const d = (
    op: string,
    label: string,
    calls: number,
    p95: number,
    err: number,
    share: number
  ): Dependency => ({
    kind: 'downstream',
    op,
    label,
    callsPerInvocation: calls,
    p95Ms: p95,
    errorRate: err,
    shareOfDuration: share,
  });
  switch (trigger.kind) {
    case 'api-gateway':
      return [
        upstream,
        d('db', 'DynamoDB orders', 2.1, 38, 0.001, 0.22),
        d('cache.get', 'ElastiCache cart', 1, 3, 0, 0.03),
        d('http.client', 'api.stripe.com', 0.3, 640, 0.004, 0.55),
        d('queue.publish', 'SQS orders-queue', 0.2, 22, 0, 0.06),
      ];
    case 'sqs':
      return [
        upstream,
        d('db', 'DynamoDB orders', 2, 41, 0.001, 0.09),
        d('http.client', 'carrier-api.example.com', 1, 14_800, 0.031, 0.78),
        d('queue.settle', 'SQS orders-queue', 1, 18, 0, 0.02),
      ];
    case 's3':
      return [
        upstream,
        d('object.get', 'S3 shop-uploads', 1, 310, 0, 0.21),
        d('object.put', 'S3 shop-thumbnails', 3, 140, 0.001, 0.17),
      ];
    case 'schedule':
      return [
        upstream,
        d('db', 'RDS invoices', 4, 9_200, 0, 0.3),
        d('object.put', 'S3 finance-reports', 1, 2_100, 0, 0.1),
      ];
    case 'function-url':
      return [
        upstream,
        d('db', 'DynamoDB payments', 1, 21, 0, 0.3),
        d('queue.publish', 'SNS order-events', 1, 25, 0, 0.12),
      ];
    case 'dynamodb':
      return [
        upstream,
        d('db', 'DynamoDB inventory_snapshots', 1, 120, 0.002, 0.5),
        d('http.client', 'search.internal', 1, 260, 0.01, 0.35),
      ];
    case 'sns':
      return [
        upstream,
        d('db', 'DynamoDB users', 1, 18, 0, 0.15),
        d('http.client', 'api.sendgrid.com', 0.9, 210, 0.002, 0.6),
        d('http.client', 'api.twilio.com', 0.1, 900, 0.03, 0.1),
      ];
    case 'durable':
      return [
        upstream,
        d('rpc', 'Lambda payments-webhook', 0.3, 300, 0, 0.1),
        d('db', 'DynamoDB orders', 2, 40, 0, 0.2),
        d('http.client', 'carrier-api.example.com', 0.4, 2_100, 0.01, 0.5),
      ];
    default:
      return [upstream];
  }
}

export interface RightSizingOption {
  cost: number;
  current: boolean;
  memoryMb: number;
  oomRisk: boolean;
  p50: number;
  p95: number;
  timeoutRisk: boolean;
}

/** Duration and cost at other memory sizes. CPU scales with memory up to 1769 MB (one vCPU). */
export function rightSizing(fn: LambdaFunction, t: Totals): RightSizingOption[] {
  const cpuNow = Math.min(fn.memoryMb, 1769);
  return MEMORY_OPTIONS.map(memoryMb => {
    const factor = 1 - fn.cpuShare + fn.cpuShare * (cpuNow / Math.min(memoryMb, 1769));
    const p50 = t.p50 * factor;
    const p95 = t.p95 * factor;
    const cost = costFor(
      fn,
      t.invocations,
      p50 * 1.3 + (fn.extensionLayer ? 24 : 0),
      memoryMb
    );
    return {
      memoryMb,
      p50,
      p95,
      cost,
      oomRisk: t.memory > memoryMb * 0.95,
      timeoutRisk: p95 > fn.timeoutS * 1000 * 0.9,
      current: memoryMb === fn.memoryMb,
    };
  });
}

// Remote instrumentation

export interface MockAccount {
  account: string;
  alias: string;
  discovered: number;
  instrumented: number;
  lastSync: string;
  region: string;
  stack: string;
}

export const ACCOUNTS: MockAccount[] = [
  {
    account: ACCOUNT,
    alias: 'shop-production',
    region: 'eu-north-1',
    stack: 'CREATE_COMPLETE',
    discovered: 11,
    instrumented: 6,
    lastSync: '2 minutes ago',
  },
  {
    account: ACCOUNT,
    alias: 'shop-production',
    region: 'us-east-1',
    stack: 'UPDATE_COMPLETE',
    discovered: 3,
    instrumented: 1,
    lastSync: '2 minutes ago',
  },
  {
    account: '731942110385',
    alias: 'shop-staging',
    region: 'eu-north-1',
    stack: 'CREATE_IN_PROGRESS',
    discovered: 0,
    instrumented: 0,
    lastSync: 'never',
  },
];

export const DEFAULT_RULES = [
  'env:production AND runtime:python*',
  'team:payments',
  '!name:legacy-*',
];

export interface CoverageRow {
  env: string;
  extensionLayer: string | null;
  instrumentation: InstrumentationStatus;
  known: boolean;
  name: string;
  region: string;
  runtime: string;
  sdkLayer: string | null;
  team: string;
}

export const COVERAGE: CoverageRow[] = [
  ...FUNCTIONS.map(fn => ({
    name: fn.name,
    runtime: fn.runtime,
    region: fn.region,
    env: fn.env,
    team: fn.team,
    instrumentation: fn.instrumentation,
    sdkLayer: fn.sdkLayer,
    extensionLayer: fn.extensionLayer,
    known: true,
  })),
  {
    name: 'legacy-export',
    runtime: 'python3.8',
    region: 'eu-north-1',
    env: 'production',
    team: 'finance',
    instrumentation: 'excluded',
    sdkLayer: null,
    extensionLayer: null,
    known: false,
  },
  {
    name: 'edge-auth',
    runtime: 'nodejs22.x',
    region: 'us-east-1',
    env: 'production',
    team: 'platform',
    instrumentation: 'unsupported',
    sdkLayer: null,
    extensionLayer: null,
    known: false,
  },
  {
    name: 'pdf-thumbnailer',
    runtime: 'provided.al2023',
    region: 'eu-north-1',
    env: 'staging',
    team: 'media',
    instrumentation: 'not-instrumented',
    sdkLayer: null,
    extensionLayer: null,
    known: false,
  },
];

function escapeRegExp(value: string) {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/** Evaluates rules like `env:production AND runtime:python*`, `name:(a OR b)` and `!name:legacy-*`. */
export function ruleMatches(rule: string, row: CoverageRow): boolean {
  const fields: Record<string, string> = {
    name: row.name,
    function_name: row.name,
    runtime: row.runtime,
    region: row.region,
    env: row.env,
    team: row.team,
  };
  const terms = rule
    .split(/\s+AND\s+/i)
    .map(term => term.trim())
    .filter(Boolean);
  if (!terms.length) {
    return false;
  }
  return terms.every(term => {
    const negate = term.startsWith('!');
    const [key, rawValue] = (negate ? term.slice(1) : term).split(':', 2);
    if (!key || rawValue === undefined) {
      return false;
    }
    const values = rawValue
      .replace(/^\(|\)$/g, '')
      .split(/\s+OR\s+/i)
      .map(v => v.trim());
    const field = fields[key.toLowerCase()];
    const hit =
      field !== undefined &&
      values.some(value =>
        new RegExp(`^${escapeRegExp(value).replace(/\*/g, '.*')}$`, 'i').test(field)
      );
    return negate ? !hit : hit;
  });
}

export const STATUS_LABELS: Record<
  InstrumentationStatus,
  {label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'muted'}
> = {
  rule: {label: 'Instrumented by rule', variant: 'success'},
  manual: {label: 'Manual', variant: 'info'},
  drift: {label: 'Drift detected', variant: 'danger'},
  excluded: {label: 'Excluded', variant: 'muted'},
  'not-instrumented': {label: 'Not instrumented', variant: 'warning'},
  unsupported: {label: 'Unsupported', variant: 'muted'},
};

export const ALERT_TEMPLATES = [
  {
    title: 'Any timeout or out-of-memory kill',
    query: 'sum(aws.lambda.timeouts) + sum(aws.lambda.out_of_memory) > 0',
    source: 'extension' as const,
  },
  {
    title: 'Error rate above 1%',
    query: 'failure_rate(span.op:function.aws) > 0.01',
    source: 'spans' as const,
  },
  {
    title: 'Duration above 95% of the timeout',
    query: 'p99(span.duration) / faas.timeout > 0.95',
    source: 'spans' as const,
  },
  {
    title: 'Memory above 95% of the limit',
    query: 'max(aws.lambda.memory.used) / faas.max_memory > 0.95',
    source: 'extension' as const,
  },
  {
    title: 'Throttles or dropped async events',
    query: 'sum(aws.lambda.throttles) + sum(aws.lambda.async_events_dropped) > 0',
    source: 'integration' as const,
  },
  {
    title: 'Iterator age above 5 minutes',
    query: 'max(aws.lambda.iterator_age) > 5m',
    source: 'integration' as const,
  },
];
