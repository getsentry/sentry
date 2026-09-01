import {deriveFilterState} from 'sentry/views/dashboards/globalFilter/utils';
import type {
  DashboardFilters,
  GlobalFilter,
  WidgetQuery,
} from 'sentry/views/dashboards/types';

function expandFilterValue(
  globalFilter: GlobalFilter,
  fallbackAttribute: string
): string {
  const {filterToken, noValueToken} = deriveFilterState(globalFilter);

  // Only a plain positive clause can be widened. ORing in the fallback for a negated
  // clause, or one paired with "(no value)", would change what the filter matches.
  if (!filterToken || filterToken.negated || noValueToken) {
    return globalFilter.value;
  }

  // Swapping only the leading key keeps operators, wildcards, and quoting intact.
  const fallbackClause =
    fallbackAttribute + filterToken.text.slice(filterToken.key.text.length);

  return `(${filterToken.text} OR ${fallbackClause})`;
}

/**
 * Rewrites `attribute:value` to `(attribute:value OR fallbackAttribute:value)` for
 * the global filters a widget query opted into via `globalFilterFallback`, so the
 * widget still matches rows that only carry the fallback attribute.
 */
export function withGlobalFilterFallback(
  dashboardFilters: DashboardFilters | undefined,
  fallback: WidgetQuery['globalFilterFallback']
): DashboardFilters | undefined {
  if (!fallback || !dashboardFilters?.globalFilter) {
    return dashboardFilters;
  }

  return {
    ...dashboardFilters,
    globalFilter: dashboardFilters.globalFilter.map(globalFilter =>
      globalFilter.tag.key === fallback.attribute
        ? {
            ...globalFilter,
            value: expandFilterValue(globalFilter, fallback.fallbackAttribute),
          }
        : globalFilter
    ),
  };
}
