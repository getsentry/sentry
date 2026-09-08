import {useCallback, useEffect, useRef} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {SessionEvent} from './useSessionDetail';

const ITEM_PARAM = 'item';

export interface SessionSelection {
  clearSelection: () => void;
  /** The page the selection belongs to, so a stale write can't navigate back to it. */
  pathname: string;
  selectItem: (key: string) => void;
  /** The selected item, when the key resolves to one. */
  selectedEvent: SessionEvent | undefined;
  selectedKey: string | null;
  /** Selects an item, or deselects it if it is already the open one. */
  toggleItem: (key: string) => void;
}

/**
 * The open item, held in the URL beside the timeline's other state so a single
 * trace or log in a session is linkable and survives a reload. Written with
 * `replace` like the sort and the filters — clicking down a rail should not fill
 * the back stack with twenty entries.
 *
 * Resolved against every fetched item rather than against the rows currently on
 * screen: a link into a session whose lane happens to be toggled off should still
 * open its panel. The rail simply has no row to highlight in that case.
 */
export function useSelectedItem({
  eventsByKey,
}: {
  eventsByKey: Map<string, SessionEvent>;
}): SessionSelection {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = decodeScalar(location.query[ITEM_PARAM]) ?? null;

  // The writers below are called from event handlers, long after render, and they
  // have to act on wherever the app is *now* rather than on the location they were
  // built with. Reading through a ref is what keeps them stable as well as current:
  // they end up in the dependencies of the effect that opens the details drawer,
  // and a new identity on every navigation would have that effect re-opening the
  // drawer as the timeline writes its filters to the URL.
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const setKey = useCallback(
    (key?: string) => {
      const current = locationRef.current;
      navigate(
        {...current, query: {...current.query, [ITEM_PARAM]: key}},
        {replace: true}
      );
    },
    [navigate]
  );

  const selectItem = useCallback((key: string) => setKey(key), [setKey]);
  const clearSelection = useCallback(() => setKey(), [setKey]);

  const toggleItem = useCallback(
    (key: string) => setKey(key === selectedKey ? undefined : key),
    [setKey, selectedKey]
  );

  const selectedEvent = selectedKey === null ? undefined : eventsByKey.get(selectedKey);

  return {
    selectedKey,
    selectedEvent,
    selectItem,
    toggleItem,
    clearSelection,
    pathname: location.pathname,
  };
}
