import type {Theme} from '@emotion/react';

import type {
  TreeLike,
  UseVirtualizedTreeProps,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import type {VirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTree';
import type {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';

import type {VirtualizedState} from './useVirtualizedTreeReducer';

export function updateGhostRow({
  element,
  selectedNodeIndex,
  rowHeight,
  scrollTop,
  interaction,
  theme,
}: {
  element: HTMLElement | null;
  interaction: 'hover' | 'clicked';
  rowHeight: number;
  scrollTop: number;
  selectedNodeIndex: number;
  theme: Theme;
}) {
  if (!element) {
    return;
  }
  element.style.left = '0';
  element.style.right = '0';
  element.style.height = `${rowHeight}px`;
  element.style.position = 'absolute';
  element.style.backgroundColor =
    interaction === 'clicked' ? theme.blue300 : theme.surface200;
  element.style.pointerEvents = 'none';
  element.style.willChange = 'transform, opacity';
  element.style.transform = `translateY(${rowHeight * selectedNodeIndex - scrollTop}px)`;
  element.style.opacity = '1';
}

export function markRowAsHovered(
  hoveredRowKey: VirtualizedTreeRenderedRow<any>['key'] | null,
  renderedItems: VirtualizedTreeRenderedRow<any>[],
  {
    rowHeight,
    scrollTop,
    theme,
    ghostRowRef,
  }: {
    ghostRowRef: HTMLDivElement | null;
    rowHeight: number;
    scrollTop: number;
    theme: Theme;
  }
) {
  for (const row of renderedItems) {
    if (row.ref && row.ref.dataset.hovered === 'true') {
      delete row.ref.dataset.hovered;
    }
  }
  if (hoveredRowKey === null && ghostRowRef) {
    ghostRowRef.style.opacity = '0';
    return;
  }

  const hoveredRow = renderedItems.find(row => row.key === hoveredRowKey);
  if (hoveredRow?.ref) {
    hoveredRow.ref.dataset.hovered = 'true';
    updateGhostRow({
      element: ghostRowRef,
      interaction: 'hover',
      rowHeight,
      scrollTop,
      selectedNodeIndex: hoveredRow.key,
      theme,
    });
  }
}

export function markRowAsClicked(
  clickedRowKey: VirtualizedTreeRenderedRow<any>['key'] | null,
  renderedItems: VirtualizedTreeRenderedRow<any>[],
  {
    rowHeight,
    scrollTop,
    theme,
    ghostRowRef,
  }: {
    ghostRowRef: HTMLDivElement | null;
    rowHeight: number;
    scrollTop: number;
    theme: Theme;
  }
) {
  if (clickedRowKey === null && ghostRowRef) {
    ghostRowRef.style.opacity = '0';
    return;
  }
  if (clickedRowKey !== null) {
    const clickedRow = renderedItems.find(row => row.key === clickedRowKey);
    if (clickedRow) {
      updateGhostRow({
        element: ghostRowRef,
        interaction: 'clicked',
        rowHeight,
        scrollTop,
        selectedNodeIndex: clickedRow.key,
        theme,
      });
    }
  }
}

/**
 * Recursively calls requestAnimationFrame until a specified delay has been met or exceeded.
 * When the delay time has been reached the function you're timing out will be called.
 * This was copied from react-virtualized, with credits to the original author.
 *
 * Credit: Joe Lambert (https://gist.github.com/joelambert/1002116#file-requesttimeout-js)
 */
type AnimationTimeoutId = {
  id: number;
};

export function requestAnimationTimeout(
  callback: Function,
  delay: number
): AnimationTimeoutId {
  let start: any;
  // wait for end of processing current event handler, because event handler may be long
  Promise.resolve().then(() => {
    start = Date.now();
  });

  const timeout = () => {
    if (start === undefined) {
      frame.id = window.requestAnimationFrame(timeout);
      return;
    }
    if (Date.now() - start >= delay) {
      callback();
    } else {
      frame.id = window.requestAnimationFrame(timeout);
    }
  };

  const frame: AnimationTimeoutId = {
    id: window.requestAnimationFrame(timeout),
  };

  return frame;
}

export function cancelAnimationTimeout(frame: AnimationTimeoutId) {
  window.cancelAnimationFrame(frame.id);
}

export function findOptimisticStartIndex<T extends TreeLike>({
  items,
  overscroll,
  rowHeight,
  scrollTop,
  viewport,
}: {
  items: VirtualizedTreeNode<T>[];
  overscroll: number;
  rowHeight: number;
  scrollTop: number;
  viewport: {bottom: number; top: number};
}): number {
  if (!items.length || viewport.top === 0) {
    return 0;
  }
  return Math.max(Math.floor(scrollTop / rowHeight) - overscroll, 0);
}

export interface VirtualizedTreeRenderedRow<T> {
  item: VirtualizedTreeNode<T>;
  key: number;
  ref: HTMLElement | null;
  styles: React.CSSProperties;
}

export function findRenderedItems<T extends TreeLike>({
  items,
  overscroll,
  rowHeight,
  scrollHeight,
  scrollTop,
}: {
  items: VirtualizedTreeNode<T>[];
  overscroll: NonNullable<UseVirtualizedTreeProps<T>['overscroll']>;
  rowHeight: UseVirtualizedTreeProps<T>['rowHeight'];
  scrollHeight: VirtualizedState<T>['scrollHeight'];
  scrollTop: number;
}) {
  // This is overscroll height for single direction, when computing the total,
  // we need to multiply this by 2 because we overscroll in both directions.
  const OVERSCROLL_HEIGHT = overscroll * rowHeight;
  const renderedRows: VirtualizedTreeRenderedRow<T>[] = [];

  // Clamp viewport to scrollHeight bounds [0, length * rowHeight] because some browsers may fire
  // scrollTop with negative values when the user scrolls up past the top of the list (overscroll behavior)
  const viewport = {
    top: Math.max(scrollTop - OVERSCROLL_HEIGHT, 0),
    bottom: Math.min(
      scrollTop + scrollHeight + OVERSCROLL_HEIGHT,
      items.length * rowHeight
    ),
  };

  // Points to the position inside the visible array
  let visibleItemIndex = 0;
  // Points to the currently iterated item
  let indexPointer = findOptimisticStartIndex({
    items,
    viewport,
    scrollTop,
    rowHeight,
    overscroll,
  });

  // Max number of visible items in our list
  const MAX_VISIBLE_ITEMS = Math.ceil((scrollHeight + OVERSCROLL_HEIGHT * 2) / rowHeight);
  const ALL_ITEMS = items.length;

  // While number of visible items is less than max visible items, and we haven't reached the end of the list
  while (visibleItemIndex < MAX_VISIBLE_ITEMS && indexPointer < ALL_ITEMS) {
    const elementTop = indexPointer * rowHeight;
    const elementBottom = elementTop + rowHeight;

    // An element is inside a viewport if the top of the element is below the top of the viewport
    // and the bottom of the element is above the bottom of the viewport
    if (elementTop >= viewport.top && elementBottom <= viewport.bottom) {
      renderedRows[visibleItemIndex] = {
        key: indexPointer,
        ref: null,
        styles: {position: 'absolute', top: elementTop},
        item: items[indexPointer]!,
      };

      visibleItemIndex++;
    }
    indexPointer++;
  }

  return renderedRows;
}

// Finds index of the previously selected node in the tree
export function findCarryOverIndex<T extends TreeLike>(
  previousNode: VirtualizedTreeNode<T> | null | undefined,
  newTree: VirtualizedTree<T>
): number | null {
  if (!newTree.flattened.length || !previousNode) {
    return null;
  }

  const newIndex = newTree.flattened.findIndex(n => n.node === previousNode.node);
  if (newIndex === -1) {
    return null;
  }
  return newIndex;
}

export function computeVirtualizedTreeNodeScrollTop(
  {
    index,
    rowHeight,
    scrollHeight,
    currentScrollTop,
    maxScrollableHeight,
  }: {
    currentScrollTop: number;
    index: number;
    maxScrollableHeight: number;
    rowHeight: number;
    scrollHeight: number;
  },
  block: 'start' | 'center' | 'end' | 'nearest' = 'nearest'
) {
  const newPosition = index * rowHeight;

  if (block === 'start') {
    return newPosition;
  }

  if (block === 'center') {
    // The return value is bounded between 0 and the maximum scroll
    // distance from the top (calculated by subtracting the max scroll
    // height from the total height of the scrollable area). This is
    // to ensure that the scroll position is never negative or greater
    // than allowed.
    return Math.max(
      Math.min(
        newPosition - scrollHeight / 2 + rowHeight,
        maxScrollableHeight - scrollHeight
      ),
      0
    );
  }

  if (block === 'end') {
    return newPosition - scrollHeight + rowHeight;
  }

  const top = newPosition;
  const bottom = newPosition + scrollHeight;

  return Math.min(top - currentScrollTop, bottom - currentScrollTop);
}
