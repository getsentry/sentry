import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {APP_START_SCREEN_FILTER_FALLBACK} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/constants';

export const COLD_OPERATIONS_TABLE_WIDGET_ID = 'cold-operations-table';
export const WARM_OPERATIONS_TABLE_WIDGET_ID = 'warm-operations-table';

const APP_START_OPERATIONS_WIDGET_IDS = new Set([
  COLD_OPERATIONS_TABLE_WIDGET_ID,
  WARM_OPERATIONS_TABLE_WIDGET_ID,
]);

function filterFor(attribute: string, values: string[]): string {
  return new MutableSearch('').addFilterValueList(attribute, values).formatString();
}

/**
 * Rewrites `attribute:value` to `(attribute:value OR fallback:value)`.
 * Leaves unrelated, negated, and `has:` filters unchanged.
 */
export function expandAppStartScreenFilter(filterConditions: string): string {
  if (!filterConditions) {
    return filterConditions;
  }

  const {attribute, fallbackAttribute} = APP_START_SCREEN_FILTER_FALLBACK;
  // Skip negated filters: getFilterValues() drops the `!`, which would OR them in.
  // Skip has:/!has: too, including value + "(no value)" like `(attr:X OR !has:attr)`.
  if (
    filterConditions.includes(`!${attribute}:`) ||
    filterConditions.includes(`has:${attribute}`)
  ) {
    return filterConditions;
  }

  const remaining = new MutableSearch(filterConditions);
  const values = remaining.getFilterValues(attribute);
  if (values.length === 0) {
    return filterConditions;
  }

  remaining.removeFilter(attribute);
  const widened = `(${filterFor(attribute, values)} OR ${filterFor(fallbackAttribute, values)})`;
  return [remaining.formatString(), widened].filter(Boolean).join(' ');
}

export function isAppStartOperationsWidget(widget: Pick<Widget, 'id'>): boolean {
  return Boolean(widget.id && APP_START_OPERATIONS_WIDGET_IDS.has(widget.id));
}

/**
 * App Starts operations tables only. Other widgets get `filterConditions` back unchanged.
 */
export function widenAppStartScreenFilter(
  widget: Pick<Widget, 'id'>,
  filterConditions: string
): string {
  if (!isAppStartOperationsWidget(widget)) {
    return filterConditions;
  }
  return expandAppStartScreenFilter(filterConditions);
}

/**
 * Same widening, applied to dashboard global-filter values before shared
 * `applyDashboardFilters`. No-op for every widget except the two operations tables.
 */
export function withAppStartScreenFilterFallback(
  widget: Pick<Widget, 'id'>,
  dashboardFilters: DashboardFilters | undefined
): DashboardFilters | undefined {
  if (!isAppStartOperationsWidget(widget) || !dashboardFilters?.globalFilter) {
    return dashboardFilters;
  }

  return {
    ...dashboardFilters,
    globalFilter: dashboardFilters.globalFilter.map(filter => ({
      ...filter,
      value: expandAppStartScreenFilter(filter.value),
    })),
  };
}
