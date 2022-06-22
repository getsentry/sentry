import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import theme from 'sentry/utils/theme';
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
};

export interface TreeLike {
  children: TreeLike[];
}

interface VirtualizedState<T> {
  overscroll: number;
  roots: T[];
  scrollHeight: number;
  scrollTop: number;
  tabIndexKey: number | null;
}

interface SetScrollTop {
  payload: number;
  type: 'set scroll top';
}

interface SetTabIndexKey {
  payload: number | null;
  type: 'set tab index key';
}
interface SetContainerHeight {
  payload: number;
  type: 'set scroll height';
}

type VirtualizedStateAction = SetScrollTop | SetContainerHeight | SetTabIndexKey;

export function VirtualizedTreeStateReducer<T>(
  state: VirtualizedState<T>,
  action: VirtualizedStateAction
): VirtualizedState<T> {
  switch (action.type) {
    case 'set tab index key': {
      return {...state, tabIndexKey: action.payload};
    }
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

function hideGhostRow({ref}: {ref: MutableRefObject<HTMLElement | null>}) {
  if (ref.current) {
    ref.current.style.opacity = '0';
  }
}

function updateGhostRow({
  ref,
  tabIndexKey,
  rowHeight,
  scrollTop,
  interaction,
}: {
  interaction: 'hover' | 'active';
  ref: MutableRefObject<HTMLElement | null>;
  rowHeight: number;
  scrollTop: number;
  tabIndexKey: number;
}) {
  if (!ref.current) {
    return;
  }
  ref.current.style.left = '0';
  ref.current.style.right = '0';
  ref.current.style.height = `${rowHeight}px`;
  ref.current.style.position = 'absolute';
  ref.current.style.backgroundColor =
    interaction === 'active' ? theme.blue300 : theme.blue100;
  ref.current.style.pointerEvents = 'none';
  ref.current.style.willChange = 'transform, opacity';
  ref.current.style.transform = `translateY(${rowHeight * tabIndexKey - scrollTop}px)`;
  ref.current.style.opacity = '1';
}
function findOptimisticStartIndex<T extends TreeLike>({
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

function findVisibleItems<T extends TreeLike>({
  items,
  overscroll,
  rowHeight,
  scrollHeight,
  scrollTop,
}: {
  items: VirtualizedTreeNode<T>[];
  overscroll: NonNullable<UseVirtualizedListProps<T>['overscroll']>;
  rowHeight: UseVirtualizedListProps<T>['rowHeight'];
  scrollHeight: VirtualizedState<T>['scrollHeight'];
  scrollTop: VirtualizedState<T>['scrollTop'];
}) {
  // This is overscroll height for single direction, when computing the total,
  // we need to multiply this by 2 because we overscroll in both directions.
  const OVERSCROLL_HEIGHT = overscroll * rowHeight;
  const visibleItems: VisibleItem<T>[] = [];

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
      visibleItems[visibleItemIndex] = {
        key: indexPointer,
        ref: null,
        styles: {position: 'absolute', top: elementTop},
        item: items[indexPointer],
      };

      visibleItemIndex++;
    }
    indexPointer++;
  }

  return visibleItems;
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
      handleRowMouseEnter: (event: React.MouseEvent<HTMLElement>) => void;
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

function findCarryOverIndex<T extends TreeLike>(
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

export function useVirtualizedTree<T extends TreeLike>(
  props: UseVirtualizedListProps<T>
) {
  const clickedGhostRowRef = useRef<HTMLDivElement | null>(null);
  const hoveredGhostRowRef = useRef<HTMLDivElement | null>(null);

  const previousHoveredRow = useRef<number | null>(null);

  const [state, dispatch] = useReducer(VirtualizedTreeStateReducer, {
    scrollTop: 0,
    roots: props.roots,
    tabIndexKey: null,
    overscroll: props.overscroll ?? DEFAULT_OVERSCROLL_ITEMS,
    scrollHeight: props.scrollContainer?.getBoundingClientRect()?.height ?? 0,
  });

  // Keep a ref to latest state to avoid re-rendering
  const latestStateRef = useRef<typeof state>(state);
  latestStateRef.current = state;
  const [tree, setTree] = useState(() => {
    const initialTree = VirtualizedTree.fromRoots(props.roots, props.skipFunction);

    if (props.sortFunction) {
      initialTree.sort(props.sortFunction);
    }

    return initialTree;
  });

  const cleanupAllHoveredRows = useCallback(() => {
    previousHoveredRow.current = null;
    for (const row of latestItemsRef.current) {
      if (row.ref && row.ref.dataset.hovered) {
        delete row.ref.dataset.hovered;
      }
    }
  }, []);

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

    const tabIndex = findCarryOverIndex(
      latestStateRef.current.tabIndexKey
        ? tree.flattened[latestStateRef.current.tabIndexKey]
        : null,
      newTree
    );

    if (tabIndex) {
      updateGhostRow({
        ref: clickedGhostRowRef,
        tabIndexKey: tabIndex,
        rowHeight: props.rowHeight,
        scrollTop: latestStateRef.current.scrollTop,
        interaction: 'active',
      });
    } else {
      hideGhostRow({ref: clickedGhostRowRef});
    }

    cleanupAllHoveredRows();
    hideGhostRow({ref: hoveredGhostRowRef});

    dispatch({type: 'set tab index key', payload: tabIndex});
    setTree(newTree);
  }, [props.roots, props.skipFunction, cleanupAllHoveredRows]);

  const items = useMemo(() => {
    return findVisibleItems<T>({
      items: tree.flattened,
      scrollHeight: state.scrollHeight,
      scrollTop: state.scrollTop,
      overscroll: state.overscroll,
      rowHeight: props.rowHeight,
    });
  }, [tree, state.overscroll, state.scrollHeight, state.scrollTop, props.rowHeight]);

  const latestItemsRef = useRef(items);
  latestItemsRef.current = items;

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

      // On scroll, we need to update the selected ghost row and clear the hovered ghost row
      if (latestStateRef.current.tabIndexKey !== null) {
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: latestStateRef.current.tabIndexKey,
          scrollTop: Math.max(evt.target.scrollTop, 0),
          interaction: 'active',
          rowHeight: props.rowHeight,
        });
      }

      cleanupAllHoveredRows();
      hideGhostRow({
        ref: hoveredGhostRowRef,
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, {
      passive: true,
    });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [props.scrollContainer, props.rowHeight, cleanupAllHoveredRows]);

  useEffect(() => {
    const scrollContainer = props.scrollContainer;

    if (!scrollContainer) {
      return undefined;
    }

    // Because nodes dont span the full width, it's possible for users to
    // click or hover on a node at the far right end which is outside of the row width.
    // In that case, we check if the cursor position overlaps with a row and select that row.
    const handleClick = (evt: MouseEvent) => {
      if (evt.target !== scrollContainer) {
        // user clicked on an element inside the container, defer to onClick
        return;
      }

      const rect = (evt.target as HTMLDivElement).getBoundingClientRect();
      const index = Math.floor(
        (latestStateRef.current.scrollTop + evt.clientY - rect.top) / props.rowHeight
      );

      // If a node exists at the index, select it
      if (tree.flattened[index]) {
        dispatch({type: 'set tab index key', payload: index});
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: index,
          scrollTop: latestStateRef.current.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'active',
        });
      }
    };

    // Because nodes dont span the full width, it's possible for users to
    // click on a node at the far right end which is outside of the row width.
    // In that case, check if the top position where the user clicked overlaps
    // with a row and select that row.
    const handleMouseMove = (evt: MouseEvent) => {
      if (evt.target !== scrollContainer) {
        // user clicked on an element inside the container, defer to onClick
        return;
      }

      const rect = (evt.target as HTMLDivElement).getBoundingClientRect();
      const index = Math.floor(
        (latestStateRef.current.scrollTop + evt.clientY - rect.top) / props.rowHeight
      );

      cleanupAllHoveredRows();
      const element = latestItemsRef.current.find(item => item.key === index);
      if (element?.ref) {
        element.ref.dataset.hovered = 'true';
      }

      // If a node exists at the index, select it, else clear whatever is selected
      if (tree.flattened[index] && index !== latestStateRef.current.tabIndexKey) {
        updateGhostRow({
          ref: hoveredGhostRowRef,
          tabIndexKey: index,
          scrollTop: latestStateRef.current.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'hover',
        });
      } else {
        hideGhostRow({
          ref: hoveredGhostRowRef,
        });
      }
    };

    scrollContainer.addEventListener('click', handleClick);
    scrollContainer.addEventListener('mousemove', handleMouseMove);

    return () => {
      scrollContainer.removeEventListener('click', handleClick);
      scrollContainer.removeEventListener('mousemove', handleMouseMove);
    };
  }, [props.rowHeight, props.scrollContainer, tree.flattened, cleanupAllHoveredRows]);

  // When mouseleave is triggered on the container,
  // we need to hide the ghost row to avoid an orphaned row
  useEffect(() => {
    const container = props.scrollContainer;
    if (!container) {
      return undefined;
    }

    function onMouseLeave() {
      cleanupAllHoveredRows();
      hideGhostRow({
        ref: hoveredGhostRowRef,
      });
    }
    container.addEventListener('mouseleave', onMouseLeave, {
      passive: true,
    });

    return () => {
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [cleanupAllHoveredRows, props.scrollContainer]);

  // When a node is expanded, the underlying tree is recomputed (the flattened tree is updated)
  // We copy the properties of the old tree by creating a new instance of VirtualizedTree
  // and passing in the roots and its flattened representation so that no extra work is done.
  const handleExpandTreeNode = useCallback(
    (node: VirtualizedTreeNode<T>, opts?: {expandChildren: boolean}) => {
      // When we expand nodes, tree.expand will mutate the underlying tree which then
      // gets copied to the new tree instance. To get the right index, we need to read
      // it before any mutations are made
      const previousNode = latestStateRef.current.tabIndexKey
        ? tree.flattened[latestStateRef.current.tabIndexKey] ?? null
        : null;

      tree.expandNode(node, !node.expanded, opts);
      const newTree = new VirtualizedTree(tree.roots, tree.flattened);
      expandedHistory.current = newTree.getAllExpandedNodes(new Set());

      // Hide or update the ghost if necessary
      const tabIndex = findCarryOverIndex(previousNode, newTree);
      if (tabIndex === null) {
        hideGhostRow({ref: clickedGhostRowRef});
      } else {
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: tabIndex,
          scrollTop: Math.max(latestStateRef.current.scrollTop, 0),
          interaction: 'active',
          rowHeight: props.rowHeight,
        });
      }

      dispatch({type: 'set tab index key', payload: tabIndex});
      setTree(newTree);
    },
    [tree, props.rowHeight]
  );

  // When a tree is sorted, we sort all of the nodes in the tree and not just the visible ones
  // We could probably optimize this to lazily sort as we scroll, but since we want the least amount
  // of work during scrolling, we just sort the entire tree every time.
  const handleSortingChange = useCallback(
    (sortFn: (a: VirtualizedTreeNode<T>, b: VirtualizedTreeNode<T>) => number) => {
      // When we sort nodes, tree.sort will mutate the underlying tree which then
      // gets copied to the new tree instance. To get the right index, we need to read
      // it before any mutations are made
      const previousNode = latestStateRef.current.tabIndexKey
        ? tree.flattened[latestStateRef.current.tabIndexKey] ?? null
        : null;

      tree.sort(sortFn);
      const newTree = new VirtualizedTree(tree.roots, tree.flattened);

      // Hide or update the ghost if necessary
      const tabIndex = findCarryOverIndex(previousNode, newTree);
      if (tabIndex === null) {
        hideGhostRow({ref: clickedGhostRowRef});
      } else {
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: tabIndex,
          scrollTop: Math.max(latestStateRef.current.scrollTop, 0),
          interaction: 'active',
          rowHeight: props.rowHeight,
        });
      }

      dispatch({type: 'set tab index key', payload: tabIndex});
      setTree(newTree);
    },
    [tree, props.rowHeight]
  );

  // When a row is clicked, we update the selected node
  const handleRowClick = useCallback(
    (tabIndexKey: number) => {
      return (_evt: React.MouseEvent<HTMLElement>) => {
        dispatch({type: 'set tab index key', payload: tabIndexKey});
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey,
          scrollTop: state.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'active',
        });
      };
    },
    [state.scrollTop, props.rowHeight]
  );

  // Keyboard navigation for row
  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (latestStateRef.current.tabIndexKey === null) {
        return;
      }

      if (event.key === 'Enter') {
        handleExpandTreeNode(tree.flattened[latestStateRef.current.tabIndexKey], {
          expandChildren: true,
        });
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const indexInVisibleItems = items.findIndex(
          i => i.key === latestStateRef.current.tabIndexKey
        );

        if (indexInVisibleItems !== -1) {
          const nextIndex = indexInVisibleItems + 1;

          // Bounds check if we are at end of list
          if (nextIndex > tree.flattened.length - 1) {
            return;
          }

          dispatch({type: 'set tab index key', payload: items[nextIndex].key});
          updateGhostRow({
            ref: clickedGhostRowRef,
            tabIndexKey: items[nextIndex].key,
            scrollTop: latestStateRef.current.scrollTop,
            rowHeight: props.rowHeight,
            interaction: 'active',
          });
          items[nextIndex].ref?.focus({preventScroll: true});
          items[nextIndex].ref?.scrollIntoView({block: 'nearest'});
        }
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const indexInVisibleItems = items.findIndex(
          i => i.key === latestStateRef.current.tabIndexKey
        );

        if (indexInVisibleItems !== -1) {
          const nextIndex = indexInVisibleItems - 1;

          // Bound check if we are at start of list
          if (nextIndex < 0) {
            return;
          }

          dispatch({type: 'set tab index key', payload: items[nextIndex].key});
          updateGhostRow({
            ref: clickedGhostRowRef,
            tabIndexKey: items[nextIndex].key,
            scrollTop: latestStateRef.current.scrollTop,
            rowHeight: props.rowHeight,
            interaction: 'active',
          });
          items[nextIndex].ref?.focus({preventScroll: true});
          items[nextIndex].ref?.scrollIntoView({block: 'nearest'});
        }
      }
    },
    [handleExpandTreeNode, items, tree.flattened, props.rowHeight]
  );

  // When a row is hovered, we update the ghost row
  const handleRowMouseEnter = useCallback(
    (key: number) => {
      return (_evt: React.MouseEvent<HTMLElement>) => {
        if (previousHoveredRow.current !== key) {
          cleanupAllHoveredRows();

          (_evt.currentTarget as HTMLElement).dataset.hovered = 'true';
          previousHoveredRow.current = key;
        }
        updateGhostRow({
          ref: hoveredGhostRowRef,
          tabIndexKey: key,
          scrollTop: state.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'hover',
        });
      };
    },
    [state.scrollTop, props.rowHeight, cleanupAllHoveredRows]
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
        cleanupAllHoveredRows();
        hideGhostRow({
          ref: hoveredGhostRowRef,
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
  }, [props.scrollContainer, cleanupAllHoveredRows]);

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
    return {height, maxHeight: height};
  }, [tree.flattened.length, props.rowHeight]);

  const renderRow = props.renderRow;
  const renderedItems: React.ReactNode[] = useMemo(() => {
    const renderered: React.ReactNode[] = [];

    // It is important that we do not create a copy of item
    // because refs will assign the dom node to the item.
    // If we map, we get a new object that our internals will not be able to access.
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      renderered.push(
        renderRow(item, {
          handleRowClick: handleRowClick(item.key),
          handleExpandTreeNode,
          handleRowKeyDown,
          handleRowMouseEnter: handleRowMouseEnter(item.key),
          tabIndexKey: state.tabIndexKey,
        })
      );
    }

    return renderered;
  }, [
    items,
    handleRowClick,
    handleRowKeyDown,
    state.tabIndexKey,
    handleRowMouseEnter,
    handleExpandTreeNode,
    renderRow,
  ]);

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

  return {
    tree,
    items,
    renderedItems,
    tabIndexKey: state.tabIndexKey,
    dispatch,
    handleRowClick,
    handleRowKeyDown,
    handleRowMouseEnter,
    handleExpandTreeNode,
    handleSortingChange,
    scrollContainerStyles,
    containerStyles,
    clickedGhostRowRef,
    hoveredGhostRowRef,
  };
}
