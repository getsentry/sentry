import {SESSION_ID} from '@sentry/conventions/attributes';

import {t} from 'sentry/locale';
import type {GraphicsVariant} from 'sentry/utils/theme';

export type SessionDatasetKey = 'logs' | 'metrics' | 'spans' | 'errors';

export interface SessionDataset {
  /** Aggregate that counts events in the group. */
  countField: string;
  /** `dataset` query param for `/organizations/{org}/events/`. */
  dataset: string;
  /** Aggregate returning the earliest event in the group. */
  firstSeenField: string;
  /**
   * Lane color for this type in the scrubber: its label icon and its density
   * bars. `graphics` has no `info`, so logs take `accent` — the same blue.
   *
   * Only the scrubber sorts by type, so only the scrubber colors by it. The rail
   * below colors a row by severity instead and says the type with
   * `TelemetryTypeIcon`, which is also why spans are neutral here: with four
   * lanes stacked, the pink they used to carry sat one lane from the red for
   * errors, and at marker size the two were the same color.
   */
  graphicsVariant: GraphicsVariant;
  key: SessionDatasetKey;
  /** Plural, for count columns and the scrubber's lane labels. */
  label: string;
  /** Aggregate returning the latest event in the group. */
  lastSeenField: string;
  /** How many timeline rows to load in total, across as many pages as it takes. */
  maxRows: number;
  /**
   * Rows per request, which mirrors this dataset's `per_page` cap on the events
   * endpoint. The endpoint *rejects* — rather than clamps — anything over the
   * cap, so this can't be raised past it; a dataset whose cap falls short of
   * `maxRows` is paged up to it instead.
   */
  pageSize: number;
  /** Singular, for labelling one item in the session timeline. */
  singularLabel: string;
  /** Converts this dataset's raw timestamp representation into epoch ms. */
  toEpochMs: (value: unknown) => number | undefined;
}

function fromEpochNanos(value: unknown): number | undefined {
  return typeof value === 'number' ? value / 1e6 : undefined;
}

function fromEpochSeconds(value: unknown): number | undefined {
  return typeof value === 'number' ? value * 1e3 : undefined;
}

function fromIsoString(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * The four datasets that can carry a `session.id`. Every one of them is queried
 * through `/organizations/{org}/events/` with a `dataset` param, grouped by
 * `session.id`. The aggregate names differ per dataset:
 *
 * - `timestamp` is a string-typed field in EAP, so `min`/`max` over it are
 *   rejected there. Each EAP dataset exposes a numeric precise-timestamp
 *   attribute instead, and the units differ (nanos for logs/metrics, seconds
 *   for spans).
 * - `tracemetrics` requires an argument to `count`.
 *
 * `dataset` is a plain string rather than `DiscoverDatasets` because that enum
 * has no `'logs'` member — only `OURLOGS = 'ourlogs'`, which the backend still
 * accepts but logs a deprecation warning for on every request.
 *
 * Every dataset loads the same 1000 rows, but not in the same number of requests:
 * the endpoint sets `max_per_page` to 9999 for logs and tracemetrics and leaves
 * everything else on the API-wide default of 100, so spans and errors have to be
 * paged to get there. 1000 rather than the full 9999 because the rail renders
 * every row it is handed — the ceiling is what the page can draw, not what the
 * endpoint will serve.
 */
export const SESSION_DATASETS: SessionDataset[] = [
  {
    key: 'logs',
    label: t('Logs'),
    singularLabel: t('Log'),
    graphicsVariant: 'accent',
    dataset: 'logs',
    countField: 'count()',
    firstSeenField: 'min(timestamp_precise)',
    lastSeenField: 'max(timestamp_precise)',
    maxRows: 1000,
    pageSize: 1000,
    toEpochMs: fromEpochNanos,
  },
  {
    key: 'metrics',
    label: t('Metrics'),
    singularLabel: t('Metric'),
    graphicsVariant: 'success',
    dataset: 'tracemetrics',
    countField: `count(${SESSION_ID})`,
    firstSeenField: 'min(timestamp_precise)',
    lastSeenField: 'max(timestamp_precise)',
    maxRows: 1000,
    pageSize: 1000,
    toEpochMs: fromEpochNanos,
  },
  {
    key: 'spans',
    label: t('Spans'),
    singularLabel: t('Span'),
    graphicsVariant: 'neutral',
    dataset: 'spans',
    countField: 'count()',
    firstSeenField: 'min(precise.start_ts)',
    lastSeenField: 'max(precise.finish_ts)',
    maxRows: 1000,
    pageSize: 100,
    toEpochMs: fromEpochSeconds,
  },
  {
    key: 'errors',
    label: t('Errors'),
    singularLabel: t('Error'),
    graphicsVariant: 'danger',
    dataset: 'errors',
    countField: 'count()',
    firstSeenField: 'min(timestamp)',
    lastSeenField: 'max(timestamp)',
    maxRows: 1000,
    pageSize: 100,
    toEpochMs: fromIsoString,
  },
];
