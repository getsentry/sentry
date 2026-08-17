import {SESSION_ID} from '@sentry/conventions/attributes';

import {t} from 'sentry/locale';
import type {TagVariant} from 'sentry/utils/theme';

export type SessionDatasetKey = 'logs' | 'metrics' | 'spans' | 'errors';

interface SessionDataset {
  /** Aggregate that counts events in the group. */
  countField: string;
  /** `dataset` query param for `/organizations/{org}/events/`. */
  dataset: string;
  /** Aggregate returning the earliest event in the group. */
  firstSeenField: string;
  key: SessionDatasetKey;
  /** Plural, for count columns and stat tiles. */
  label: string;
  /** Aggregate returning the latest event in the group. */
  lastSeenField: string;
  /** Singular, for labelling one item in the session timeline. */
  singularLabel: string;
  /**
   * Tag color for this type in the timeline. One hue per telemetry type so a
   * long timeline can be scanned by color instead of read row by row.
   */
  tagVariant: TagVariant;
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
 */
export const SESSION_DATASETS: SessionDataset[] = [
  {
    key: 'logs',
    label: t('Logs'),
    singularLabel: t('Log'),
    tagVariant: 'info',
    dataset: 'logs',
    countField: 'count()',
    firstSeenField: 'min(timestamp_precise)',
    lastSeenField: 'max(timestamp_precise)',
    toEpochMs: fromEpochNanos,
  },
  {
    key: 'metrics',
    label: t('Metrics'),
    singularLabel: t('Metric'),
    tagVariant: 'success',
    dataset: 'tracemetrics',
    countField: `count(${SESSION_ID})`,
    firstSeenField: 'min(timestamp_precise)',
    lastSeenField: 'max(timestamp_precise)',
    toEpochMs: fromEpochNanos,
  },
  {
    key: 'spans',
    label: t('Spans'),
    singularLabel: t('Span'),
    tagVariant: 'promotion',
    dataset: 'spans',
    countField: 'count()',
    firstSeenField: 'min(precise.start_ts)',
    lastSeenField: 'max(precise.finish_ts)',
    toEpochMs: fromEpochSeconds,
  },
  {
    key: 'errors',
    label: t('Errors'),
    singularLabel: t('Error'),
    tagVariant: 'danger',
    dataset: 'errors',
    countField: 'count()',
    firstSeenField: 'min(timestamp)',
    lastSeenField: 'max(timestamp)',
    toEpochMs: fromIsoString,
  },
];
