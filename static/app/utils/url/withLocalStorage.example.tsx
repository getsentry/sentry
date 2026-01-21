/**
 * Example usage of withLocalStorage utility
 *
 * This file demonstrates various ways to use withLocalStorage with Nuqs parsers
 * to add localStorage fallback support to URL query parameters.
 */

import {parseAsInteger, parseAsString, useQueryState} from 'nuqs';

import type {Sort} from 'sentry/utils/discover/fields';
import {parseAsSort} from 'sentry/utils/queryString';

import {parseAsBooleanLiteral} from './parseAsBooleanLiteral';
import {withLocalStorage} from './withLocalStorage';

/**
 * Example 1: Simple string with localStorage fallback
 *
 * The search query persists in localStorage, so if a user returns to the page
 * without the 'query' param in the URL, their last search is restored.
 */
export function SearchExample() {
  const [query, setQuery] = useQueryState(
    'query',
    withLocalStorage('search:query', parseAsString).withDefault('')
  );

  return (
    <input
      type="text"
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}

/**
 * Example 2: Sort with localStorage persistence
 *
 * Table sort preferences are saved to localStorage and restored on next visit.
 */
export function TableSortExample() {
  const [sort, setSort] = useQueryState<Sort>(
    'sort',
    withLocalStorage('table:sort', parseAsSort).withDefault({
      kind: 'desc',
      field: 'created',
    })
  );

  return (
    <div>
      Sorting by: {sort.field} ({sort.kind})
      <button
        onClick={() =>
          setSort({
            kind: sort.kind === 'asc' ? 'desc' : 'asc',
            field: sort.field,
          })
        }
      >
        Toggle direction
      </button>
    </div>
  );
}

/**
 * Example 3: Boolean flag with localStorage
 *
 * Filter preferences persist across sessions.
 */
export function FilterExample() {
  const [hideSmall, setHideSmall] = useQueryState(
    'hideSmall',
    withLocalStorage('filters:hideSmall', parseAsBooleanLiteral)
  );

  return (
    <label>
      <input
        type="checkbox"
        checked={hideSmall || false}
        onChange={e => setHideSmall(e.target.checked ? true : null)}
      />
      Hide small items
    </label>
  );
}

/**
 * Example 4: Pagination with localStorage
 *
 * Current page persists, so users don't lose their place when navigating away.
 */
export function PaginationExample() {
  const [page, setPage] = useQueryState(
    'page',
    withLocalStorage('pagination:page', parseAsInteger).withDefault(1)
  );

  return (
    <div>
      Page: {page}
      <button onClick={() => setPage(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <button onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}

/**
 * Example 5: Multiple related query states
 *
 * All filter preferences persist together.
 */
export function MultipleFiltersExample() {
  const [status, setStatus] = useQueryState(
    'status',
    withLocalStorage('filters:status', parseAsString)
  );

  const [priority, setPriority] = useQueryState(
    'priority',
    withLocalStorage('filters:priority', parseAsString)
  );

  const [assignee, setAssignee] = useQueryState(
    'assignee',
    withLocalStorage('filters:assignee', parseAsString)
  );

  return (
    <div>
      <select value={status || ''} onChange={e => setStatus(e.target.value || null)}>
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>

      <select value={priority || ''} onChange={e => setPriority(e.target.value || null)}>
        <option value="">All priorities</option>
        <option value="high">High</option>
        <option value="low">Low</option>
      </select>

      <input
        type="text"
        value={assignee || ''}
        onChange={e => setAssignee(e.target.value || null)}
        placeholder="Assignee..."
      />

      <button
        onClick={() => {
          setStatus(null);
          setPriority(null);
          setAssignee(null);
        }}
      >
        Clear all filters
      </button>
    </div>
  );
}

/**
 * Key behaviors to understand:
 *
 * 1. URL is the source of truth - if a URL has a parameter, it takes precedence
 * 2. localStorage is a fallback - used only when URL parameter is missing
 * 3. On mount: If URL is empty but localStorage has a value, URL is updated
 * 4. On change: Both URL and localStorage are updated simultaneously
 * 5. Setting to null: Removes from URL, but localStorage persists (intentional)
 * 6. localStorage persists across sessions, acting as user preferences
 *
 * Best practices:
 *
 * - Use descriptive localStorage keys with namespace prefixes (e.g., 'search:query')
 * - Different features should use different key prefixes to avoid conflicts
 * - Consider using .withDefault() for better UX with non-nullable state
 * - Remember that localStorage persists even when URL is cleared
 */
