import {SESSION_ID} from '@sentry/conventions/attributes';

import {t} from 'sentry/locale';
import type {GraphicsVariant} from 'sentry/utils/theme';

export type SessionDatasetKey = 'logs' | 'metrics' | 'traces' | 'errors' | 'feedback';

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
   * `TelemetryTypeIcon`, which is also why traces are neutral here: with four
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
  /**
   * Scoping filter that defines *what this dataset even means*, ANDed onto every
   * query — discovery, counts and rows alike — unlike `filter`, which narrows rows
   * only.
   *
   * `feedback` needs one: it rides on the shared `issuePlatform` dataset, which
   * also carries other issue types, so `occurrence_type_id:6001` is what makes it a
   * feedback dataset rather than an issue-platform one. It has to reach the count
   * and extent aggregates too, or a session's feedback count would include every
   * other issue-platform occurrence it has.
   */
  baseFilter?: string;
  /**
   * Extra filter narrowing the *rows* this kind renders, ANDed onto whatever else
   * the page is asking for. Only `traces` needs one — see below.
   *
   * Deliberately not applied to the count and extent aggregates. Those answer
   * "what does this session contain", which should stay the whole truth: a
   * `count_unique(trace)` over every span counts a trace the session touched even
   * when the segment span standing for it is missing, and the session's extent
   * likewise shouldn't shrink to the part we can draw. It also keeps search from
   * developing false negatives — a session whose *child* span matches the user's
   * filter still gets found.
   */
  filter?: string;
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
 * The four kinds of telemetry that can carry a `session.id`. Every one of them is
 * queried through `/organizations/{org}/events/` with a `dataset` param, grouped
 * by `session.id`. The aggregate names differ per dataset:
 *
 * - `timestamp` is a string-typed field in EAP, so `min`/`max` over it are
 *   rejected there. Each EAP dataset exposes a numeric precise-timestamp
 *   attribute instead, and the units differ (nanos for logs/metrics, seconds
 *   for spans).
 * - `tracemetrics` requires an argument to `count`.
 *
 * Note that a *kind* is not a dataset: `traces` is the spans dataset narrowed to
 * segment spans and counted by distinct trace. There is no traces dataset on this
 * endpoint, and a session's individual spans are not what anyone reads a session
 * for.
 *
 * `dataset` is a plain string rather than `DiscoverDatasets` because that enum
 * has no `'logs'` member — only `OURLOGS = 'ourlogs'`, which the backend still
 * accepts but logs a deprecation warning for on every request.
 *
 * Every kind loads the same 1000 rows, but not in the same number of requests:
 * the endpoint sets `max_per_page` to 9999 for logs and tracemetrics and leaves
 * everything else on the API-wide default of 100, so traces and errors have to be
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
    key: 'traces',
    label: t('Traces'),
    singularLabel: t('Trace'),
    graphicsVariant: 'neutral',
    dataset: 'spans',
    /**
     * Distinct traces rather than spans. The rows this pairs with are segment
     * spans (see `filter`), one of which stands in for its whole trace — so the
     * count answers "how many traces did this session touch" while the rows are
     * what there is to click.
     *
     * The two can disagree in both directions, and that is understood for now: a
     * trace may hold more than one segment span (a pageload and the server
     * transaction under it are both segments), and a trace the session touched
     * only through a child span has no segment row to show at all.
     */
    countField: 'count_unique(trace)',
    firstSeenField: 'min(precise.start_ts)',
    lastSeenField: 'max(precise.finish_ts)',
    /**
     * Segment spans only — `is_transaction` is the public alias for
     * `sentry.is_segment` on this dataset. A session's spans run into the
     * thousands and read as noise individually; the segment span is the one that
     * names the traced interaction and carries its wall-clock duration.
     */
    filter: 'is_transaction:true',
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
  {
    key: 'feedback',
    label: t('Feedback'),
    singularLabel: t('Feedback'),
    graphicsVariant: 'warning',
    // Feedback is not a dataset of its own — it is the issue-platform dataset
    // scoped to feedback occurrences (see `baseFilter`). `timestamp` is a
    // first-class ISO field here, the same as on `errors`.
    dataset: 'issuePlatform',
    // `occurrence_type_id` is the queryable column on this dataset;
    // `issue.category:feedback` only works on the issues stream, not `/events/`.
    // 6001 is `FeedbackGroup.type_id`.
    baseFilter: 'occurrence_type_id:6001',
    countField: 'count()',
    firstSeenField: 'min(timestamp)',
    lastSeenField: 'max(timestamp)',
    maxRows: 1000,
    pageSize: 100,
    toEpochMs: fromIsoString,
  },
];

/**
 * A dataset's own filter ANDed onto whatever the page is asking for.
 *
 * Callers are expected to have already parenthesized anything with a top-level
 * `OR` in it — this appends, it does not group.
 */
export function withDatasetFilter(config: SessionDataset, query: string): string {
  if (!config.filter) {
    return query;
  }
  return query ? `${query} ${config.filter}` : config.filter;
}

/**
 * A dataset's scoping `baseFilter` ANDed onto a query. Applied to every query for
 * the dataset — discovery, counts and rows — because it defines what the dataset
 * contains rather than narrowing a single view of it. See `baseFilter`.
 *
 * As with `withDatasetFilter`, callers parenthesize any top-level `OR` first; this
 * appends.
 */
export function withBaseFilter(config: SessionDataset, query: string): string {
  if (!config.baseFilter) {
    return query;
  }
  return query ? `${query} ${config.baseFilter}` : config.baseFilter;
}
