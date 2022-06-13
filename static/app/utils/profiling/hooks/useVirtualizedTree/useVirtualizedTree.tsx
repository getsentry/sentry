import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';

import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';

import {VirtualizedTree} from './VirtualizedTree';
import {VirtualizedTreeNode} from './VirtualizedTreeNode';

type AnimationTimeoutId = {
  id: number;
};

const cancelAnimationTimeout = (frame: AnimationTimeoutId) =>
  window.cancelAnimationFrame(frame.id);

/**
 * Recursively calls requestAnimationFrame until a specified delay has been met or exceeded.
 * When the delay time has been reached the function you're timing out will be called.
 * This was copied from react-virtualized, with credits to the original author.
 *
 * Credit: Joe Lambert (https://gist.github.com/joelambert/1002116#file-requesttimeout-js)
 */
const requestAnimationTimeout = (
  callback: Function,
  delay: number
): AnimationTimeoutId => {
  let start;
  // wait for end of processing current event handler, because event handler may be long
  Promise.resolve().then(() => {
    start = Date.now();
  });

  const timeout = () => {
    if (start === undefined) {
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
};

export interface TreeLike {
  children: TreeLike[];
}

interface VirtualizedState<T> {
  overscroll: number;
  roots: T[];
  scrollHeight: number;
  scrollTop: number;
}

interface SetScrollTop {
  payload: number;
  type: 'set scroll top';
}

interface SetContainerHeight {
  payload: number;
  type: 'set scroll height';
}

type VirtualizedStateAction = SetScrollTop | SetContainerHeight;

export function VirtualizedTreeStateReducer<T>(
  state: VirtualizedState<T>,
  action: VirtualizedStateAction
): VirtualizedState<T> {
  switch (action.type) {
    case 'set scroll top': {
      return {...state, scrollTop: action.payload};
    }
    case 'set scroll height': {
      return {...state, scrollHeight: action.payload};
    }
    default: {
      return state;
    }
  }
}

interface VisibleItem<T> {
  item: VirtualizedTreeNode<T>;
  key: number;
  ref: HTMLElement | null;
  styles: React.CSSProperties;
}

export interface UseVirtualizedListProps<T extends TreeLike> {
  renderRow: (
    item: VisibleItem<T>,
    itemHandlers: {
      handleExpandTreeNode: (
        node: VirtualizedTreeNode<T>,
        opts?: {expandChildren: boolean}
      ) => void;
      handleRowClick: (evt: React.MouseEvent<HTMLElement>) => void;
      handleRowKeyDown: (event: React.KeyboardEvent) => void;
      tabIndexKey: number | null;
    }
  ) => React.ReactNode;
  roots: T[];
  rowHeight: number;
  scrollContainer: HTMLElement | null;
  overscroll?: number;
  skipFunction?: (node: VirtualizedTreeNode<T>) => boolean;
  sortFunction?: (a: VirtualizedTreeNode<T>, b: VirtualizedTreeNode<T>) => number;
}

const DEFAULT_OVERSCROLL_ITEMS = 5;

export function useVirtualizedTree<T extends TreeLike>(
  props: UseVirtualizedListProps<T>
) {
  const [tabIndexKey, setTabIndexKey] = useState<number | null>(null);
  const [tree, setTree] = useState(() => {
    const initialTree = VirtualizedTree.fromRoots(props.roots, props.skipFunction);

    if (props.sortFunction) {
      initialTree.sort(props.sortFunction);
    }

    return initialTree;
  });

  const expandedHistory = useRef<Set<T>>(new Set());
  useEffectAfterFirstRender(() => {
    const expandedNodes = tree.getAllExpandedNodes(expandedHistory.current);
    const newTree = VirtualizedTree.fromRoots(
      props.roots,
      props.skipFunction,
      expandedNodes
    );

    expandedHistory.current = expandedNodes;

    if (props.sortFunction) {
      newTree.sort(props.sortFunction);
    }

    setTree(newTree);
  }, [props.roots, props.skipFunction]);

  const [state, dispatch] = useReducer(VirtualizedTreeStateReducer, {
    scrollTop: 0,
    roots: props.roots,
    overscroll: props.overscroll ?? DEFAULT_OVERSCROLL_ITEMS,
    scrollHeight: props.scrollContainer?.getBoundingClientRect()?.height ?? 0,
  });

  const {rowHeight, renderRow} = props;
  const items = useMemo(() => {
    // This is overscroll height for single direction, when computing the total,
    // we need to multiply this by 2 because we overscroll in both directions.
    const OVERSCROLL_HEIGHT = state.overscroll * rowHeight;

    const visibleItems: VisibleItem<T>[] = [];

    // Clamp viewport to scrollHeight bounds [0, length * rowHeight] because some browsers may fire
    // scrollTop with negative values when the user scrolls up past the top of the list (overscroll behavior)
    const viewport = {
      top: Math.max(state.scrollTop - OVERSCROLL_HEIGHT, 0),
      bottom: Math.min(
        state.scrollTop + state.scrollHeight + OVERSCROLL_HEIGHT,
        tree.flattened.length * rowHeight
      ),
    };

    // Points to the position inside the visible array
    let visibleItemIndex = 0;
    // Points to the currently iterated item
    let indexPointer = 0;

    // Max number of visible items in our list
    const MAX_VISIBLE_ITEMS = Math.ceil(
      (state.scrollHeight + OVERSCROLL_HEIGHT * 2) / rowHeight
    );
    const ALL_ITEMS = tree.flattened.length;

    // While number of visible items is less than max visible items, and we haven't reached the end of the list
    while (visibleItemIndex < MAX_VISIBLE_ITEMS && indexPointer < ALL_ITEMS) {
      const elementTop = indexPointer * rowHeight;
      const elementBottom = elementTop + rowHeight;

      // An element is inside a viewport if the top of the element is below the top of the viewport
      // and the bottom of the element is above the bottom of the viewport
      if (elementTop >= viewport.top && elementBottom <= viewport.bottom) {
        visibleItems[visibleItemIndex] = {
          key: indexPointer,
          ref: null,
          styles: {position: 'absolute', top: elementTop},
          item: tree.flattened[indexPointer],
        };

        visibleItemIndex++;
      }
      indexPointer++;
    }

    return visibleItems;
  }, [tree, state.overscroll, state.scrollHeight, state.scrollTop, rowHeight]);

  // On scroll, we update scrollTop position.
  // Keep a rafId reference in the unlikely event where component unmounts before raf is executed.
  const scrollEndTimeoutId = useRef<AnimationTimeoutId | undefined>(undefined);
  useEffect(() => {
    const scrollContainer = props.scrollContainer;

    if (!scrollContainer) {
      return undefined;
    }

    const handleScroll = evt => {
      evt.target.firstChild.style.pointerEvents = 'none';

      if (scrollEndTimeoutId.current !== undefined) {
        cancelAnimationTimeout(scrollEndTimeoutId.current);
      }

      scrollEndTimeoutId.current = requestAnimationTimeout(() => {
        evt.target.firstChild.style.pointerEvents = 'auto';
      }, 150);

      dispatch({
        type: 'set scroll top',
        payload: Math.max(evt.target.scrollTop, 0),
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, {
      passive: true,
    });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [props.scrollContainer]);

  // When a node is expanded, the underlying tree is recomputed (the flattened tree is updated)
  // We copy the properties of the old tree by creating a new instance of VirtualizedTree
  // and passing in the roots and its flattened representation so that no extra work is done.
  const handleExpandTreeNode = useCallback(
    (node: VirtualizedTreeNode<T>, opts?: {expandChildren: boolean}) => {
      tree.expandNode(node, !node.expanded, opts);
      const newTree = new VirtualizedTree(tree.roots, tree.flattened);
      expandedHistory.current = newTree.getAllExpandedNodes(new Set());

      setTree(newTree);
    },
    [tree]
  );

  // When a tree is sorted, we sort all of the nodes in the tree and not just the visible ones
  // We could probably optimize this to lazily sort as we scroll, but since we want the least amount
  // of work during scrolling, we just sort the entire tree every time.
  const handleSortingChange = useCallback(
    (sortFn: (a: VirtualizedTreeNode<T>, b: VirtualizedTreeNode<T>) => number) => {
      tree.sort(sortFn);
      setTree(new VirtualizedTree(tree.roots, tree.flattened));
    },
    [tree]
  );

  // When a row is clicked, we update the selected node
  const handleRowClick = useCallback((key: number) => {
    return (_evt: React.MouseEvent<HTMLElement>) => {
      setTabIndexKey(key);
    };
  }, []);

  // Keyboard navigation for row
  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (tabIndexKey === null) {
        return;
      }

      if (event.key === 'Enter') {
        handleExpandTreeNode(tree.flattened[tabIndexKey], {expandChildren: true});
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const indexInVisibleItems = items.findIndex(i => i.key === tabIndexKey);

        if (indexInVisibleItems !== -1) {
          const nextIndex = indexInVisibleItems + 1;

          // Bound check if we are at end of list
          if (nextIndex > tree.flattened.length - 1) {
            return;
          }

          setTabIndexKey(items[nextIndex].key);
          items[nextIndex].ref?.focus({preventScroll: true});
          items[nextIndex].ref?.scrollIntoView({block: 'nearest'});
        }
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const indexInVisibleItems = items.findIndex(i => i.key === tabIndexKey);

        if (indexInVisibleItems !== -1) {
          const nextIndex = indexInVisibleItems - 1;

          // Bound check if we are at start of list
          if (nextIndex < 0) {
            return;
          }

          setTabIndexKey(items[nextIndex].key);
          items[nextIndex].ref?.focus({preventScroll: true});
          items[nextIndex].ref?.scrollIntoView({block: 'nearest'});
        }
      }
    },
    [handleExpandTreeNode, items, tree.flattened, tabIndexKey]
  );

  // Register a resize observer for when the scroll container is resized.
  // When the container is resized, update the scroll height in our state.
  // Similarly to handleScroll, we use requestAnimationFrame to avoid overupdating the UI
  useEffect(() => {
    if (!props.scrollContainer) {
      return undefined;
    }
    let rafId: number | undefined;
    const resizeObserver = new window.ResizeObserver(elements => {
      rafId = window.requestAnimationFrame(() => {
        dispatch({
          type: 'set scroll height',
          payload: elements[0]?.contentRect?.height ?? 0,
        });
      });
    });

    resizeObserver.observe(props.scrollContainer);

    return () => {
      if (typeof rafId === 'number') {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
    };
  }, [props.scrollContainer]);

  // Basic required styles for the scroll container
  const scrollContainerStyles: React.CSSProperties = useMemo(() => {
    return {
      height: '100%',
      overflow: 'auto',
      position: 'relative',
      willChange: 'transform',
    };
  }, []);

  // Basic styles for the element container. We fake the height so that the
  // scrollbar is sized according to the number of items in the list.
  const containerStyles: React.CSSProperties = useMemo(() => {
    const height = tree.flattened.length * props.rowHeight;
    return {height, maxHeight: height, overflow: 'hidden'};
  }, [tree.flattened.length, props.rowHeight]);

  // It is important that this is not executed from a map function because
  // we are assigning the refs to each individual item. If we do that,
  // we lose access to the refs and cannot call focus or scrollIntoView on them

  const renderedItems: React.ReactNode[] = useMemo(() => {
    const renderered: React.ReactNode[] = [];

    for (const item of items) {
      renderered.push(
        renderRow(item, {
          handleRowClick: handleRowClick(item.key),
          handleExpandTreeNode,
          handleRowKeyDown,
          tabIndexKey,
        })
      );
    }

    return renderered;
  }, [
    items,
    handleRowClick,
    handleRowKeyDown,
    tabIndexKey,
    handleExpandTreeNode,
    renderRow,
  ]);

  return {
    tree,
    items,
    renderedItems,
    dispatch,
    tabIndexKey,
    handleRowClick,
    handleRowKeyDown,
    handleExpandTreeNode,
    handleSortingChange,
    scrollContainerStyles,
    containerStyles,
  };
}
