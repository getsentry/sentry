import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields, type BrowserNavigationType} from 'sentry/views/insights/types';

/**
 * Experiment flag for the web vitals navigation type switcher. Frontend-only
 * check; enable it locally through the command palette ("Add Org Feature Flag")
 * until the flag is registered in `sentry.features.temporary`.
 */
export const WEB_VITALS_NAVIGATION_TYPE_FEATURE =
  'insights-web-vitals-navigation-type-switcher';

/**
 * Dashboards the switcher is offered on. Evaluated lazily so this module never
 * reads the enum while the dashboards config modules are still initializing.
 */
export function isWebVitalsPrebuiltDashboard(id: PrebuiltDashboardId): boolean {
  return (
    id === PrebuiltDashboardId.WEB_VITALS || id === PrebuiltDashboardId.WEB_VITALS_SUMMARY
  );
}

/**
 * The populations a web vital can be measured on. `navigate`/`reload` measure a
 * full document load and are the only ones the web vital thresholds were
 * calibrated against, so they are kept together and everything else is split
 * out. `prerender` gets its own bucket rather than being folded into page loads
 * because prerendered paint timings are offset by `activationStart`.
 */
export enum NavigationTypeBucket {
  PAGE_LOAD = 'pageload',
  SOFT_NAVIGATION = 'soft-navigation',
  BFCACHE = 'bfcache',
  PRERENDER = 'prerender',
}

export const NAVIGATION_TYPE_BUCKET_ORDER: NavigationTypeBucket[] = [
  NavigationTypeBucket.PAGE_LOAD,
  NavigationTypeBucket.SOFT_NAVIGATION,
  NavigationTypeBucket.BFCACHE,
  NavigationTypeBucket.PRERENDER,
];

/**
 * Everything selected, which filters nothing and so matches what the dashboard
 * queried before this control existed.
 */
const DEFAULT_NAVIGATION_TYPE_BUCKETS = NAVIGATION_TYPE_BUCKET_ORDER;

/**
 * "All" applies no filter at all, the same way the other global filter chips
 * express an empty selection. It also means a value the SDK adds later is
 * included rather than silently dropped.
 */
const ALL_NAVIGATION_TYPES_VALUE = '';

const NAVIGATION_TYPE_TAG: Tag = {
  key: SpanFields.BROWSER_NAVIGATION_TYPE,
  name: SpanFields.BROWSER_NAVIGATION_TYPE,
  kind: FieldKind.TAG,
};

type NavigationTypeBucketConfig = {
  /**
   * Raw `browser.navigation.type` values in this bucket. Page loads additionally
   * cover spans that carry no value at all, see `navigationTypeQuery`.
   */
  attributeValues: BrowserNavigationType[];
  /** Why this bucket is likely to be empty, shown when it has no data. */
  emptyReason: () => string;
  label: () => string;
  description?: () => string;
  /**
   * Values older SDKs sent for this bucket, matched alongside the current ones
   * so data from before the rename still lands somewhere. Kept off
   * `attributeValues` so that stays a description of what the SDK sends today.
   * Safe to delete once no SDK in the wild reports them.
   */
  legacyAttributeValues?: string[];
};

const KEY = SpanFields.BROWSER_NAVIGATION_TYPE;

export const NAVIGATION_TYPE_BUCKETS: Record<
  NavigationTypeBucket,
  NavigationTypeBucketConfig
> = {
  [NavigationTypeBucket.PAGE_LOAD]: {
    label: () => t('Page loads'),
    description: () =>
      t(
        'Full document loads, including back/forward navigations that missed the bfcache. Also includes spans sent before the SDK started tagging navigation type.'
      ),
    attributeValues: ['navigate', 'reload', 'back-forward', 'restore'],
    emptyReason: () =>
      t('No page load web vitals were recorded for the current filters.'),
  },
  [NavigationTypeBucket.SOFT_NAVIGATION]: {
    label: () => t('Soft navigations'),
    description: () => t('Client-side route changes. No document load.'),
    attributeValues: ['soft-navigation'],
    emptyReason: () =>
      t(
        'Soft navigation vitals require Chromium 151 or newer, so most traffic will not report them yet.'
      ),
  },
  [NavigationTypeBucket.BFCACHE]: {
    label: () => t('bfcache restores'),
    description: () =>
      t('Restores from the back/forward cache. Near-instant by construction.'),
    attributeValues: ['back-forward-cache'],
    // SDKs before the web-vitals rename reported this bucket as `bfcache`.
    legacyAttributeValues: ['bfcache'],
    emptyReason: () =>
      t(
        'No back/forward cache restores were recorded. Restores only happen on pages that are eligible for the bfcache, and older SDK versions do not tag the navigation type.'
      ),
  },
  [NavigationTypeBucket.PRERENDER]: {
    label: () => t('Prerenders'),
    description: () =>
      t('Prerendered pages. Paint timings are offset by activationStart.'),
    attributeValues: ['prerender'],
    emptyReason: () =>
      t('No prerendered page loads were recorded for the current filters.'),
  },
};

/** Every value that puts a span in this bucket, current and legacy. */
export function bucketAttributeValues(bucket: NavigationTypeBucket): string[] {
  const {attributeValues, legacyAttributeValues = []} = NAVIGATION_TYPE_BUCKETS[bucket];
  return [...attributeValues, ...legacyAttributeValues];
}

/** Selection in canonical order, deduped. */
export function normalizeBuckets(
  buckets: NavigationTypeBucket[]
): NavigationTypeBucket[] {
  return NAVIGATION_TYPE_BUCKET_ORDER.filter(bucket => buckets.includes(bucket));
}

/**
 * Deselecting everything reads as "All" too, matching the other filter chips.
 * Both select the whole population, so both filter nothing.
 */
export function isAllBucketsSelected(buckets: NavigationTypeBucket[]): boolean {
  const selected = normalizeBuckets(buckets);
  return selected.length === 0 || selected.length === NAVIGATION_TYPE_BUCKET_ORDER.length;
}

/**
 * Whether the dashboard keeps its good/needs improvement/poor thresholds.
 *
 * Those boundaries were derived from page load data, so they only mean
 * something when page loads are the whole selection: a bfcache restore scored
 * against them reads "good" every time, and a narrowed mixed selection is a
 * blend of populations rather than one measurement.
 *
 * "All" keeps them because it filters nothing. It is the same blend, scored the
 * same way, that the dashboard showed before this control existed.
 */
export function bucketsKeepThresholds(buckets: NavigationTypeBucket[]): boolean {
  return (
    isAllBucketsSelected(buckets) ||
    (buckets.length === 1 && buckets[0] === NavigationTypeBucket.PAGE_LOAD)
  );
}

/**
 * Query fragment appended to every spans widget for a selection. An empty
 * string means "everything", which is what the dashboard queried before this
 * control existed.
 */
function navigationTypeQuery(buckets: NavigationTypeBucket[]): string {
  const selected = normalizeBuckets(buckets);

  // Deselecting everything reads as "All", matching the other filter chips.
  if (selected.length === 0 || selected.length === NAVIGATION_TYPE_BUCKET_ORDER.length) {
    return ALL_NAVIGATION_TYPES_VALUE;
  }

  const values = selected.flatMap(bucket => bucketAttributeValues(bucket));
  const valueClause = `${KEY}:[${values.join(',')}]`;

  // Spans predating the attribute were all full document loads, so they ride
  // along with page loads. Dropping them would zero out every existing chart.
  return selected.includes(NavigationTypeBucket.PAGE_LOAD)
    ? `(${valueClause} OR !has:${KEY})`
    : valueClause;
}

/**
 * Every query string this module can produce, mapped back to the selection that
 * produced it. Enumerating the 16 subsets keeps the round trip exact instead of
 * parsing the query back out with a regex.
 */
const QUERY_TO_BUCKETS: Map<string, NavigationTypeBucket[]> = new Map(
  Array.from({length: 1 << NAVIGATION_TYPE_BUCKET_ORDER.length}, (_, mask) => {
    const subset = NAVIGATION_TYPE_BUCKET_ORDER.filter(
      (_bucket, index) => mask & (1 << index)
    );
    return [navigationTypeQuery(subset), subset] as const;
  })
).set(ALL_NAVIGATION_TYPES_VALUE, NAVIGATION_TYPE_BUCKET_ORDER);

/**
 * Whether the switcher can represent this filter value as a bucket selection.
 * A value picked by hand from the raw attribute values (say, just `navigate`)
 * usually isn't one, and has to stay a plain filter chip.
 */
export function isSwitcherQuery(value: string): boolean {
  return QUERY_TO_BUCKETS.has(value);
}

export function buildNavigationTypeGlobalFilter(
  buckets: NavigationTypeBucket[]
): GlobalFilter {
  const filter: GlobalFilter = {
    dataset: WidgetType.SPANS,
    tag: NAVIGATION_TYPE_TAG,
    value: navigationTypeQuery(buckets),
  };

  // "All" is the default entry in the web vitals prebuilt configs, so it goes
  // back in exactly as saved: that is what lets the dashboard offer saving
  // again, and what lets duplicates carry the filter. A narrowed selection is
  // temporary so it can never be saved for everyone.
  return isAllBucketsSelected(buckets) ? filter : {...filter, isTemporary: true};
}

export function isNavigationTypeGlobalFilter(filter: GlobalFilter): boolean {
  return (
    filter.dataset === WidgetType.SPANS &&
    filter.tag.key === SpanFields.BROWSER_NAVIGATION_TYPE
  );
}

export function getBucketsFromGlobalFilters(
  filters: GlobalFilter[] | undefined
): NavigationTypeBucket[] {
  const filter = filters?.find(isNavigationTypeGlobalFilter);

  // No filter at all means the switcher hasn't written its default out yet.
  if (!filter) {
    return DEFAULT_NAVIGATION_TYPE_BUCKETS;
  }

  return QUERY_TO_BUCKETS.get(filter.value) ?? DEFAULT_NAVIGATION_TYPE_BUCKETS;
}
