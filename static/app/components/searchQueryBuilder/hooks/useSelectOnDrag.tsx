import {useCallback, useEffect, useRef} from 'react';
import type {ListState} from '@react-stately/list';
import type {Key} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {type ParseResultToken, Token} from 'sentry/components/searchSyntax/parser';

type DraggingState = {
  startPos: {
    x: number;
    y: number;
  };
};

type TokenCoordinate = {
  key: string;
  rect: DOMRect;
};

type TokenCoordinateCache = Record<Key, TokenCoordinate>;

// While dragging, we disable pointer events on all non-text tokens to avoid
// hover effects and other unwanted interactions.
function setTokenPointerEvents(
  wrapperRef: React.RefObject<HTMLDivElement>,
  enabled: boolean
) {
  wrapperRef.current?.querySelectorAll<HTMLElement>('[role="row"]').forEach(row => {
    const rowKey = row.getAttribute('data-key');

    if (!enabled && !rowKey?.startsWith(Token.FREE_TEXT)) {
      row.style.pointerEvents = 'none';
    } else {
      row.style.pointerEvents = '';
    }
  });
}

/**
 * Measures the bounding client rect of each token in the search bar.
 * To avoid layout thrashing, this function caches its results will
 * makes the mesurements only once.
 */
function measureTokens(
  wrapperRef: React.RefObject<HTMLDivElement>,
  cachedTokenCoordinates: React.MutableRefObject<TokenCoordinateCache | null>
) {
  if (cachedTokenCoordinates.current) {
    return cachedTokenCoordinates.current;
  }

  if (!wrapperRef.current) {
    return {};
  }

  const cache: TokenCoordinateCache = {};

  const tokenElements = wrapperRef.current.querySelectorAll<HTMLElement>('[role="row"]');
  tokenElements.forEach(tokenElement => {
    const key = tokenElement.getAttribute('data-key');

    if (key) {
      const rect = tokenElement.getBoundingClientRect();

      cache[key] = {
        key,
        rect,
      };
    }
  });

  cachedTokenCoordinates.current = cache;

  setTokenPointerEvents(wrapperRef, false);

  return cachedTokenCoordinates.current;
}

/**
 * Given x and y coordinates, find the index of the item at that position.
 * If the position is in between two items, returns a half index (e.g. 2.5).
 */
function getItemIndexAtPosition(
  keys: Key[],
  coordinates: TokenCoordinateCache,
  x: number,
  y: number
) {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const coords = coordinates[key]!;

    // If we are above this item, we must be in between this and the
    // previous item on the row above it.
    if (y < coords.rect.top) {
      return Math.max(i - 0.5, 0);
    }

    // Return the index of this item if we intersect with it.
    // No need to check other coordinates because we iterate from top
    // left to bottom right.
    if (x < coords.rect.right && y <= coords.rect.bottom) {
      return i;
    }
  }

  return keys.length - 1;
}

/**
 * Sets up click and drag selection behavior for the search query builder.
 *
 * When the user triggers a mousedown event inside the component, we start
 * listening for mousemove and mouseup events to determine the selection.
 * The selection is determined by the start and end positions of the mouse
 * and should behave similarly to selection within a textarea.
 */
export function useSelectOnDrag(state: ListState<ParseResultToken>) {
  const {wrapperRef} = useSearchQueryBuilder();
  const dragState = useRef<DraggingState | null>(null);
  const cachedTokenCoordinates = useRef<TokenCoordinateCache | null>(null);
  // Mouse move events fire more than once per frame, so we use this ref to
  // check if the previous requestAnimationFrame is still running before
  // queuing another.
  const updatePending = useRef(false);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.current || updatePending.current) {
        return;
      }

      const {startPos} = dragState.current;
      const newXPos = e.clientX;
      const newYPos = e.clientY;
      const deltaX = newXPos - startPos.x;
      const deltaY = newYPos - startPos.y;

      // If the mouse hasn't moved enough, we don't want to trigger a selection
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        state.selectionManager.clearSelection();
        return;
      }

      updatePending.current = true;

      requestAnimationFrame(() => {
        const coordinates = measureTokens(wrapperRef, cachedTokenCoordinates);
        const keys = [...state.collection.getKeys()];

        const startIndex = getItemIndexAtPosition(
          keys,
          coordinates,
          startPos.x,
          startPos.y
        );
        const endIndex = getItemIndexAtPosition(keys, coordinates, newXPos, newYPos);

        if (Math.ceil(startIndex) === Math.ceil(endIndex)) {
          state.selectionManager.clearSelection();
        } else {
          const keysToSelect =
            startIndex < endIndex
              ? keys.slice(startIndex, Math.floor(endIndex) + 1)
              : keys.slice(endIndex, Math.floor(startIndex) + 1);

          state.selectionManager.setSelectedKeys(keysToSelect);
        }

        updatePending.current = false;
      });
    },
    [state, wrapperRef]
  );

  const onMouseUp = useCallback(() => {
    if (!dragState.current) {
      return;
    }

    dragState.current = null;
    cachedTokenCoordinates.current = null;
    updatePending.current = false;

    if (wrapperRef.current) {
      wrapperRef.current.removeEventListener('mousemove', onMouseMove);
    }

    setTokenPointerEvents(wrapperRef, true);
  }, [onMouseMove, wrapperRef]);

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      const element = e.target as HTMLElement;

      const itemKeyClicked = element.closest('[role="row"]')?.getAttribute('data-key');
      const itemClicked = itemKeyClicked
        ? state.collection.getItem(itemKeyClicked)
        : null;

      // Selection behavior should be skipped if we begin on a filter token
      if (itemClicked?.value?.type === Token.FILTER) {
        return;
      }

      dragState.current = {
        startPos: {
          x: e.clientX,
          y: e.clientY,
        },
      };
    },
    [state]
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    wrapper?.addEventListener('mousedown', onMouseDown);
    wrapper?.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      wrapper?.removeEventListener('mousedown', onMouseDown);
      wrapper?.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseUp);
    };
  }, [onMouseDown, onMouseMove, onMouseUp, wrapperRef]);

  // On unmount, make sure we've re-enabled pointer events
  useEffect(() => {
    return () => {
      setTokenPointerEvents(wrapperRef, true);
    };
  }, [wrapperRef]);
}
