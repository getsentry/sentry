import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {DashboardFilters, WidgetQuery} from 'sentry/views/dashboards/types';

function filterFor(attribute: string, values: string[]): string {
  return new MutableSearch('').addFilterValueList(attribute, values).formatString();
}

/**
 * Rewrites `attribute:value` to `(attribute:value OR fallback:value)`.
 * Leaves unrelated, negated, and `has:` filters unchanged.
 */
export function expandGlobalFilterFallback(
  filterConditions: string,
  fallback: WidgetQuery['globalFilterFallback']
): string {
  if (!filterConditions || !fallback) {
    return filterConditions;
  }

  const {attribute, fallbackAttribute} = fallback;
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

/**
 * Applies `expandGlobalFilterFallback` to each global-filter value.
 * No-op when `fallback` is missing.
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
    globalFilter: dashboardFilters.globalFilter.map(filter => ({
      ...filter,
      value: expandGlobalFilterFallback(filter.value, fallback),
    })),
  };
}
