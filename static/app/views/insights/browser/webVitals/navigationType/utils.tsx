import {defined} from 'sentry/utils/defined';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DashboardFilterKeys,
  WidgetType,
  type DashboardFilters,
  type GlobalFilter,
} from 'sentry/views/dashboards/types';
import {getDashboardFiltersFromURL} from 'sentry/views/dashboards/utils';
import type {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  bucketsSupportThresholds,
  getBucketsFromGlobalFilters,
  isNavigationTypeGlobalFilter,
  isWebVitalsPrebuiltDashboard,
  WEB_VITALS_NAVIGATION_TYPE_FEATURE,
  type NavigationTypeBucket,
} from 'sentry/views/insights/browser/webVitals/navigationType/settings';

/** Joins the spans-dataset global filters into a single query fragment. */
export function spanFilterQueryFromGlobalFilters(filters: GlobalFilter[]): string {
  return filters
    .filter(filter => filter.dataset === WidgetType.SPANS && filter.value)
    .map(filter => filter.value)
    .join(' ');
}

type NavigationTypeExperiment = {
  /** Currently selected populations. Defaults to page loads only. */
  buckets: NavigationTypeBucket[];
  isEnabled: boolean;
  /** The other active spans filters, for keeping side queries in sync. */
  otherSpanFilterQuery: string;
  supportsThresholds: boolean;
};

/**
 * Reads the navigation type experiment state off the URL. Returns
 * `isEnabled: false` on any dashboard the experiment doesn't apply to, in which
 * case the rest of the fields should be ignored.
 */
export function useNavigationTypeExperiment(
  prebuiltId?: PrebuiltDashboardId
): NavigationTypeExperiment {
  const organization = useOrganization();
  const location = useLocation();

  const isEnabled =
    defined(prebuiltId) &&
    isWebVitalsPrebuiltDashboard(prebuiltId) &&
    organization.features.includes(WEB_VITALS_NAVIGATION_TYPE_FEATURE);

  const globalFilters =
    getDashboardFiltersFromURL(location)?.[DashboardFilterKeys.GLOBAL_FILTER] ?? [];
  const buckets = getBucketsFromGlobalFilters(globalFilters);

  return {
    isEnabled,
    buckets,
    supportsThresholds: bucketsSupportThresholds(buckets),
    otherSpanFilterQuery: spanFilterQueryFromGlobalFilters(
      globalFilters.filter(filter => !isNavigationTypeGlobalFilter(filter))
    ),
  };
}

/**
 * Whether the web vital thresholds should be hidden for the current selection.
 * The good/needs improvement/poor boundaries come from page load data, so a
 * bfcache restore scored against them reads "good" every time and a mixed
 * selection is a blend of populations rather than one measurement.
 *
 * Returns false when there is no navigation type filter, which keeps every
 * other dashboard untouched.
 */
export function navigationTypeSuppressesThresholds(
  dashboardFilters: DashboardFilters | undefined
): boolean {
  const globalFilters = dashboardFilters?.[DashboardFilterKeys.GLOBAL_FILTER];

  // The default selection is "All", so a missing filter can't be read as a
  // selection here or every dashboard would lose its thresholds.
  if (!globalFilters?.some(isNavigationTypeGlobalFilter)) {
    return false;
  }

  return !bucketsSupportThresholds(getBucketsFromGlobalFilters(globalFilters));
}
