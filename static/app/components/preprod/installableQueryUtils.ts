import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';

const INSTALLABLE_KEY = 'installable';
const INSTALLABLE_VALUE = 'true';

/**
 * Adds `installable:true` to a search query string if not already present.
 */
export function addInstallableFilter(query: string): string {
  const search = new MutableSearch(query);
  const existing = search.getFilterValues(INSTALLABLE_KEY);
  if (existing.includes(INSTALLABLE_VALUE)) {
    return query;
  }
  search.setFilterValues(INSTALLABLE_KEY, [INSTALLABLE_VALUE]);
  return search.formatString();
}

/**
 * Removes the `installable` filter from a search query string.
 */
export function removeInstallableFilter(query: string): string {
  const search = new MutableSearch(query);
  search.removeFilter(INSTALLABLE_KEY);
  return search.formatString();
}

/**
 * Returns the updated query string for a display change.
 * Distribution display adds `installable:true`; other displays strip it.
 */
export function getUpdatedQueryForDisplay(
  currentQuery: string | null,
  display: PreprodBuildsDisplay
): string | undefined {
  const trimmed = (currentQuery ?? '').trim();
  const updated =
    display === PreprodBuildsDisplay.DISTRIBUTION
      ? addInstallableFilter(trimmed)
      : removeInstallableFilter(trimmed);
  return updated || undefined;
}
