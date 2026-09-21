import type {Organization} from 'sentry/types/organization';
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
  bucketsKeepThresholds,
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
    supportsThresholds: bucketsKeepThresholds(buckets),
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
 * Only the switcher's own filter counts. It is the only thing that writes a
 * temporary navigation type filter, so a chip someone added by hand (on a
 * duplicated dashboard, say) filters data but never touches thresholds, and
 * neither does anything in an org without the flag.
 */
export function navigationTypeSuppressesThresholds(
  dashboardFilters: DashboardFilters | undefined,
  organization: Organization | null
): boolean {
  if (!organization?.features.includes(WEB_VITALS_NAVIGATION_TYPE_FEATURE)) {
    return false;
  }

  const switcherFilter = dashboardFilters?.[DashboardFilterKeys.GLOBAL_FILTER]?.find(
    filter => isNavigationTypeGlobalFilter(filter) && filter.isTemporary
  );
  if (!switcherFilter) {
    return false;
  }

  return !bucketsKeepThresholds(getBucketsFromGlobalFilters([switcherFilter]));
}

/**
 * Whether the filter bar should leave out this filter's generic chip.
 *
 * On the web vitals dashboards the switcher replaces it. Without the flag, the
 * empty default the prebuilt config seeds stays hidden too, since a static
 * config can't be flag gated and would otherwise put the chip on every org's
 * web vitals dashboard. A chip that actually filters is always shown: hiding it
 * would leave an active filter nobody can see.
 */
export function hidesNavigationTypeChip(
  filter: GlobalFilter,
  organization: Organization,
  isExperimentEnabled: boolean
): boolean {
  if (!isNavigationTypeGlobalFilter(filter)) {
    return false;
  }

  if (isExperimentEnabled) {
    return true;
  }

  return (
    !organization.features.includes(WEB_VITALS_NAVIGATION_TYPE_FEATURE) &&
    filter.value === ''
  );
}
