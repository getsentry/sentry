/**
 * Example usage of withStorage and withLocalStorage utilities
 *
 * This file demonstrates various ways to use withStorage and withLocalStorage
 * with Nuqs parsers to add storage fallback support to URL query parameters.
 */

import {parseAsInteger, parseAsString, useQueryState} from 'nuqs';

import type {Sort} from 'sentry/utils/discover/fields';
import {parseAsSort} from 'sentry/utils/queryString';

import {parseAsBooleanLiteral} from './parseAsBooleanLiteral';
import {withLocalStorage, withSessionStorage} from './withStorage';

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
 * Example 6: Using sessionStorage for temporary state
 *
 * Session storage clears when the browser tab closes, making it perfect for
 * temporary filters or draft state that shouldn't persist across sessions.
 */
export function TemporaryFilterExample() {
  const [draftMode, setDraftMode] = useQueryState(
    'draft',
    withSessionStorage('editor:draft', parseAsBooleanLiteral)
  );

  return (
    <label>
      <input
        type="checkbox"
        checked={draftMode || false}
        onChange={e => setDraftMode(e.target.checked ? true : null)}
      />
      Show drafts (cleared when tab closes)
    </label>
  );
}

/**
 * Example 7: Using sessionStorage for wizard state
 *
 * Multi-step wizards can use sessionStorage to maintain state within a tab
 * without persisting it across sessions.
 */
export function WizardExample() {
  const [step, setStep] = useQueryState(
    'step',
    withSessionStorage('wizard:step', parseAsInteger).withDefault(1)
  );

  return (
    <div>
      <div>Step {step} of 3</div>
      <button onClick={() => setStep(step - 1)} disabled={step <= 1}>
        Previous
      </button>
      <button onClick={() => setStep(step + 1)} disabled={step >= 3}>
        Next
      </button>
    </div>
  );
}

/**
 * Key behaviors to understand:
 *
 * 1. URL is the source of truth - if a URL has a parameter, it takes precedence
 * 2. Storage is a fallback - used only when URL parameter is missing
 * 3. On mount: If URL is empty but storage has a value, URL is updated
 * 4. On change: Both URL and storage are updated simultaneously
 * 5. Setting to null: Removes from URL, but storage persists (intentional)
 *
 * Storage types:
 * - localStorage: Persists across browser sessions (user preferences)
 * - sessionStorage: Clears when tab closes (temporary state)
 *
 * Best practices:
 *
 * - Use descriptive storage keys with namespace prefixes (e.g., 'search:query')
 * - Different features should use different key prefixes to avoid conflicts
 * - Consider using .withDefault() for better UX with non-nullable state
 * - Choose storage type based on desired persistence:
 *   - localStorage for user preferences that should persist
 *   - sessionStorage for temporary state within a tab
 */
