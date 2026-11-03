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
  getNavigationTypeCountsDataset,
  getNavigationTypeDatasets,
  isNavigationTypeGlobalFilter,
  isSwitcherQuery,
  isWebVitalsPrebuiltDashboard,
  WEB_VITALS_NAVIGATION_TYPE_FEATURE,
  type NavigationTypeBucket,
  type NavigationTypeDataset,
} from 'sentry/views/insights/browser/webVitals/navigationType/settings';

/** The active filters on one dataset as a query, so side queries match the widgets. */
export function filterQueryFromGlobalFilters(
  filters: GlobalFilter[],
  dataset: WidgetType
): string {
  return filters
    .filter(filter => filter.dataset === dataset && filter.value)
    .map(filter => filter.value)
    .join(' ');
}

type NavigationTypeExperiment = {
  buckets: NavigationTypeBucket[];
  /** The dataset the switcher counts, metrics on a metrics backed dashboard. */
  countsDataset: NavigationTypeDataset;
  isEnabled: boolean;
  /** The other active filters on the counts dataset, for keeping side queries in sync. */
  otherFilterQuery: string;
  supportsThresholds: boolean;
};

/** `isEnabled` is false outside the web vitals dashboards or without the flag. */
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
  const countsDataset = getNavigationTypeCountsDataset(
    getNavigationTypeDatasets(globalFilters)
  );

  return {
    isEnabled,
    buckets,
    countsDataset,
    supportsThresholds: bucketsKeepThresholds(buckets),
    otherFilterQuery: filterQueryFromGlobalFilters(
      globalFilters.filter(filter => !isNavigationTypeGlobalFilter(filter)),
      countsDataset
    ),
  };
}

// Only the switcher's own filter counts, so a hand-added chip filters data
// without touching thresholds.
export function navigationTypeSuppressesThresholds(
  dashboardFilters: DashboardFilters | undefined,
  organization: Organization | null
): boolean {
  const switcherFilter = getSwitcherFilter(
    dashboardFilters?.[DashboardFilterKeys.GLOBAL_FILTER],
    organization
  );
  if (!switcherFilter) {
    return false;
  }

  return !bucketsKeepThresholds(getBucketsFromGlobalFilters([switcherFilter]));
}

// Nothing else writes a temporary navigation type filter, and only a narrowed
// selection is temporary, so this also answers "is a narrowed selection active".
export function getSwitcherFilter(
  globalFilters: GlobalFilter[] | undefined,
  organization: Organization | null
): GlobalFilter | undefined {
  if (!organization?.features.includes(WEB_VITALS_NAVIGATION_TYPE_FEATURE)) {
    return undefined;
  }

  return globalFilters?.find(
    filter => isNavigationTypeGlobalFilter(filter) && filter.isTemporary
  );
}

// A dashboard duplicated from web vitals carries the filter in its default
// state, which is how the copy gets the switcher too.
export function showsNavigationTypeSwitcher(
  globalFilters: GlobalFilter[],
  organization: Organization,
  isWebVitalsDashboard: boolean
): boolean {
  if (!organization.features.includes(WEB_VITALS_NAVIGATION_TYPE_FEATURE)) {
    return false;
  }

  if (isWebVitalsDashboard) {
    return true;
  }

  const filter = globalFilters.find(isNavigationTypeGlobalFilter);
  return Boolean(filter && isSwitcherQuery(filter.value));
}

/**
 * The prebuilt config can't be flag gated, so without the flag its empty
 * default stays hidden. A chip that actually filters always shows, or it would
 * be an active filter nobody can see.
 */
export function hidesNavigationTypeChip(
  filter: GlobalFilter,
  organization: Organization,
  isSwitcherShown: boolean
): boolean {
  if (!isNavigationTypeGlobalFilter(filter)) {
    return false;
  }

  if (isSwitcherShown) {
    return true;
  }

  return (
    !organization.features.includes(WEB_VITALS_NAVIGATION_TYPE_FEATURE) &&
    filter.value === ''
  );
}
