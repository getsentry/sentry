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

  // Only a bare `attribute:value` clause can be widened. Negating it, or pairing it
  // with a "(no value)" clause, would make the added OR match more than it should.
  if (!filterToken || filterToken.negated || noValueToken) {
    return globalFilter.value;
  }

  // Reuse the clause verbatim and swap only the leading key, so operators,
  // wildcards, and quoting carry over to the fallback.
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
