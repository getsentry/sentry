import * as qs from 'query-string';

/**
 * Replaces the current browser URL without going through the router.
 *
 * Updating the URL via `navigate()` notifies the router, which re-renders
 * every `useLocation` subscriber (and their subtrees) even when the change is
 * only meant to persist state in the URL. This helper writes the URL with
 * `history.replaceState` so the address bar, refreshes, and copied links stay
 * accurate without triggering any React re-renders.
 *
 * Trade-off: the router's in-memory location is NOT updated, so
 * `useLocation().query` will not reflect params written this way. Only use
 * this for params that are exclusively read back via component state (e.g. a
 * store hydrated from the URL on mount), never for params other components
 * read from the router location.
 */
export function replaceUrlWithoutNavigation(to: {
  pathname: string;
  query: Record<string, any>;
}) {
  const search = qs.stringify(to.query);
  const url = search ? `${to.pathname}?${search}` : to.pathname;

  // Preserve the existing history state so the router's back/forward
  // bookkeeping (e.g. react-router's `idx`) stays intact.
  window.history.replaceState(window.history.state, '', url);
}
