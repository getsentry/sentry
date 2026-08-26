import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {GlobalFilterFallback} from 'sentry/views/dashboards/types';

function filterFor(attribute: string, values: string[]): string {
  return new MutableSearch('').addFilterValueList(attribute, values).formatString();
}

/**
 * Rewrites `attribute:value` to `(attribute:value OR fallback:value)`.
 * Leaves unrelated, negated, and `has:` filters unchanged.
 */
export function expandGlobalFilterFallbacks(
  filterConditions: string,
  fallbacks: GlobalFilterFallback[] | undefined
): string {
  if (!filterConditions || !fallbacks?.length) {
    return filterConditions;
  }

  const remaining = new MutableSearch(filterConditions);
  const expanded: string[] = [];

  for (const {attribute, fallbackAttribute} of fallbacks) {
    // Skip negated filters: getFilterValues() drops the `!`, which would OR them in.
    if (filterConditions.includes(`!${attribute}:`)) {
      continue;
    }

    const values = remaining.getFilterValues(attribute);
    if (values.length === 0) {
      continue;
    }

    remaining.removeFilter(attribute);
    expanded.push(
      `(${filterFor(attribute, values)} OR ${filterFor(fallbackAttribute, values)})`
    );
  }

  if (expanded.length === 0) {
    return filterConditions;
  }

  return [remaining.formatString(), ...expanded].filter(Boolean).join(' ');
}
