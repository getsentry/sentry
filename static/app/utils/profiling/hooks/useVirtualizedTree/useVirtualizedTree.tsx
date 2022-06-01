import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';

import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';

import {VirtualizedTree} from './VirtualizedTree';
import {VirtualizedTreeNode} from './VirtualizedTreeNode';

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

interface UseVirtualizedListProps<T extends TreeLike> {
  roots: T[];
  rowHeight: number;
  scrollContainerRef: React.MutableRefObject<HTMLElement | null>;
  overscroll?: number;
  sortFunction?: (a: VirtualizedTreeNode<T>, b: VirtualizedTreeNode<T>) => number;
}

const DEFAULT_OVERSCROLL_ITEMS = 5;

export function useVirtualizedTree<T extends TreeLike>(
  props: UseVirtualizedListProps<T>
) {
  const [tree, setTree] = useState(() => {
    const initialTree = VirtualizedTree.fromRoots(props.roots);

    if (props.sortFunction) {
      initialTree.sort(props.sortFunction);
    }

    return initialTree;
  });

  useEffectAfterFirstRender(() => {
    const newTree = VirtualizedTree.fromRoots(props.roots);

    if (props.sortFunction) {
      newTree.sort(props.sortFunction);
    }

    setTree(newTree);
  }, [props.roots]);

  const [state, dispatch] = useReducer(VirtualizedTreeStateReducer, {
    roots: props.roots,
    overscroll: props.overscroll ?? DEFAULT_OVERSCROLL_ITEMS,
    scrollTop: 0,
    scrollHeight: props.scrollContainerRef.current?.getBoundingClientRect()?.height ?? 0,
  });

  const items = useMemo(() => {
    // This is overscroll height for single direction, when computing the total,
    // we need to multiply this by 2 because we overscroll in both directions.
    const OVERSCROLL_HEIGHT = state.overscroll * props.rowHeight;

    const visibleItems: {
      item: VirtualizedTreeNode<T>;
      key: number;
      ref: HTMLElement | null;
      styles: React.CSSProperties;
    }[] = [];

    // Clamp viewport to scrollHeight bounds [0, length * rowHeight] because some browsers may fire
    // scrollTop with negative values when the user scrolls up past the top of the list (overscroll behavior)
    const viewport = {
      top: Math.max(state.scrollTop - OVERSCROLL_HEIGHT, 0),
      bottom: Math.min(
        state.scrollTop + state.scrollHeight + OVERSCROLL_HEIGHT,
        tree.flattened.length * props.rowHeight
      ),
    };

    // Points to the position inside the visible array
    let visibleItemIndex = 0;
    // Points to the currently iterated item
    let indexPointer = 0;

    const MAX_VISIBLE_ITEMS = Math.ceil(
      (state.scrollHeight + OVERSCROLL_HEIGHT * 2) / props.rowHeight
    );
    const ALL_ITEMS = tree.flattened.length;

    // While number of visible items is less than max visible items, and we haven't reached the end of the list
    while (visibleItemIndex < MAX_VISIBLE_ITEMS && indexPointer < ALL_ITEMS) {
      const elementTop = indexPointer * props.rowHeight;
      const elementBottom = elementTop + props.rowHeight;

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
  }, [tree, state.overscroll, state.scrollHeight, state.scrollTop, props.rowHeight]);

  // On scroll, we update scrollTop position.
  // Keep a rafId reference in the unlikely event where component unmounts before raf is executed.
  const scrollRafId = useRef<number | undefined>(undefined);
  const handleScroll = useCallback(element => {
    // use requestAnimationFrame to avoidoverupdating the UI.
    scrollRafId.current = window.requestAnimationFrame(() => {
      dispatch({type: 'set scroll top', payload: Math.max(element.target.scrollTop, 0)});
      scrollRafId.current = undefined;
    });
  }, []);

  // Cleanup rafId on unmount.
  useEffect(() => {
    return () => {
      if (scrollRafId.current !== undefined) {
        window.cancelAnimationFrame(scrollRafId.current);
      }
    };
  }, []);

  // When a node is expanded, the underlying tree is recomputed (the flattened tree is updated)
  // We copy the properties of the old tree by creating a new instance of VirtualizedTree
  // and passing in the roots and its flattened representation so that no extra work is done.
  const handleExpandTreeNode = useCallback(
    (node: VirtualizedTreeNode<T>, opts?: {expandChildren: boolean}) => {
      tree.expandNode(node, !node.expanded, opts);
      setTree(new VirtualizedTree(tree.roots, tree.flattened));
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

  // Register a resize observer for when the scroll container is resized.
  // When the container is resized, update the scroll height in our state.
  // Similarly to handleScroll, we use requestAnimationFrame to avoid overupdating the UI
  useEffect(() => {
    if (!props.scrollContainerRef.current) {
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

    resizeObserver.observe(props.scrollContainerRef.current);

    return () => {
      if (typeof rafId === 'number') {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
    };
  }, [props.scrollContainerRef]);

  // Basic required styles for the scroll container
  const scrollContainerStyles: React.CSSProperties = useMemo(() => {
    return {
      height: '100%',
      overflow: 'auto',
      position: 'relative',
      willChange: 'transform',
      overscrollBehavior: 'contain',
    };
  }, []);

  // Basic styles for the element container. We fake the height so that the
  // scrollbar is sized according to the number of items in the list.
  const containerStyles: React.CSSProperties = useMemo(() => {
    return {height: tree.flattened.length * props.rowHeight};
  }, [tree.flattened.length, props.rowHeight]);

  const [tabIndexKey, setTabIndexKey] = useState<number | null>(null);
  const handleRowClick = useCallback((key: number) => {
    setTabIndexKey(key);
  }, []);

  const handleRowKeyDown = useCallback(
    (key: number, event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleExpandTreeNode(tree.flattened[key], {expandChildren: true});
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const indexInVisibleItems = items.findIndex(i => i.key === key);

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
        const indexInVisibleItems = items.findIndex(i => i.key === key);

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
    [handleExpandTreeNode, items, tree.flattened]
  );

  return {
    tree,
    items,
    tabIndexKey,
    handleScroll,
    handleRowClick,
    handleRowKeyDown,
    handleExpandTreeNode,
    handleSortingChange,
    scrollContainerStyles,
    containerStyles,
  };
}
