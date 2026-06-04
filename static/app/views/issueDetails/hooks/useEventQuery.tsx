import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {ISSUE_PROPERTY_FIELDS} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

export const ALL_EVENTS_EXCLUDED_TAGS = [
  'environment',
  'performance.issue_ids',
  'transaction.op',
  'transaction.status',
  ...ISSUE_PROPERTY_FIELDS,
];

/**
 * Converts an issues level search query into an event level search query
 * Removes all free text and issue level filters.
 */
export function getEventSearchFromIssueQuery(query: string): string {
  const search = new MutableSearch(query);

  // Drop all free text parts
  search.setFreeText([]);

  // Remove disallowed normal filters
  for (const key of search.getFilterKeys()) {
    if (key === 'has' || key === '!has') {
      continue; // handled below
    }
    if (ALL_EVENTS_EXCLUDED_TAGS.includes(key)) {
      search.removeFilter(key);
    }
  }

  // Validate has/!has filters by referenced field values
  for (const existsKey of ['has', '!has'] as const) {
    const values = search.getFilterValues(existsKey);
    if (values.length === 0) {
      continue;
    }
    for (const field of values) {
      if (ALL_EVENTS_EXCLUDED_TAGS.includes(field)) {
        search.removeFilterValue(existsKey, field);
      }
    }
  }

  return search.toString();
}

export function useEventQuery(): string {
  const location = useLocation();
  const locationQuery = decodeScalar(location.query.query) ?? '';
  return getEventSearchFromIssueQuery(locationQuery);
}
