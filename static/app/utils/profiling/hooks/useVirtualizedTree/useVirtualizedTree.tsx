import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';

import {VirtualizedTreeReducer} from './useVirtualizedTreeReducer';
import {VirtualizedTree} from './VirtualizedTree';
import {VirtualizedTreeNode} from './VirtualizedTreeNode';
import {
  cancelAnimationTimeout,
  computeVirtualizedTreeNodeScrollTop,
  findCarryOverIndex,
  findRenderedItems,
  markRowAsClicked,
  markRowAsHovered,
  requestAnimationTimeout,
  VirtualizedTreeRenderedRow,
} from './virtualizedTreeUtils';

export interface TreeLike {
  children?: TreeLike[];
}

const DEFAULT_OVERSCROLL_ITEMS = 5;

export interface UseVirtualizedTreeProps<T extends TreeLike> {
  renderRow: (
    item: VirtualizedTreeRenderedRow<T>,
    itemHandlers: {
      handleExpandTreeNode: (
        node: VirtualizedTreeNode<T>,
        opts?: {expandChildren: boolean}
      ) => void;
      handleRowClick: (evt: React.MouseEvent<HTMLElement>) => void;
      handleRowKeyDown: (event: React.KeyboardEvent) => void;
      handleRowMouseEnter: (event: React.MouseEvent<HTMLElement>) => void;
      selectedNodeIndex: number | null;
    }
  ) => React.ReactNode;
  rowHeight: number;
  scrollContainer: HTMLElement | null;
  tree: T[];
  expanded?: boolean;
  initialSelectedNodeIndex?: number;
  onScrollToNode?: (
    node: VirtualizedTreeRenderedRow<T>,
    scrollContainer: HTMLElement | null,
    coordinates?: {depth: number; top: number}
  ) => void;
  overscroll?: number;
  skipFunction?: (node: VirtualizedTreeNode<T>) => boolean;
  sortFunction?: (a: VirtualizedTreeNode<T>, b: VirtualizedTreeNode<T>) => number;
}

export function useVirtualizedTree<T extends TreeLike>(
  props: UseVirtualizedTreeProps<T>
) {
  const {onScrollToNode} = props;

  const theme = useTheme();
  const clickedGhostRowRef = useRef<HTMLDivElement | null>(null);
  const hoveredGhostRowRef = useRef<HTMLDivElement | null>(null);

  const [state, dispatch] = useReducer(VirtualizedTreeReducer, {
    roots: props.tree,
    selectedNodeIndex: props.initialSelectedNodeIndex ?? null,
    scrollTop: 0,
    overscroll: props.overscroll ?? DEFAULT_OVERSCROLL_ITEMS,
    scrollHeight: props.scrollContainer?.getBoundingClientRect()?.height ?? 0,
  });

  const [tree, setTree] = useState(() => {
    const initialTree = VirtualizedTree.fromRoots(
      props.tree,
      props.expanded,
      props.skipFunction
    );

    if (props.sortFunction) {
      initialTree.sort(props.sortFunction);
    }

    return initialTree;
  });

  const items = useMemo(
    () =>
      findRenderedItems<T>({
        items: tree.flattened,
        scrollHeight: state.scrollHeight,
        scrollTop: state.scrollTop,
        overscroll: state.overscroll,
        rowHeight: props.rowHeight,
      }),
    [state.scrollHeight, state.scrollTop, state.overscroll, tree, props.rowHeight]
  );

  const flattenedHistory = useRef<ReadonlyArray<VirtualizedTreeNode<T>>>(tree.flattened);
  const expandedHistory = useRef<Set<T>>(new Set());

  // Keep a ref to latest state to avoid re-rendering
  const latestStateRef = useRef<typeof state>(state);
  latestStateRef.current = state;
  const latestTreeRef = useRef<typeof tree>(tree);
  latestTreeRef.current = tree;
  const latestItemsRef = useRef<typeof items>(items);
  latestItemsRef.current = items;

  // On scroll, we update scrollTop position.
  // Keep a rafId reference in the unlikely event where component unmounts before raf is executed.
  const scrollEndTimeoutId = useRef<
    ReturnType<typeof requestAnimationTimeout> | undefined
  >(undefined);

  useEffectAfterFirstRender(() => {
    const newTree = VirtualizedTree.fromRoots(
      props.tree,
      props.expanded,
      props.skipFunction,
      expandedHistory.current
    );

    if (props.sortFunction) {
      newTree.sort(props.sortFunction);
    }

    const selectedNodeIndex = findCarryOverIndex(
      typeof latestStateRef.current.selectedNodeIndex === 'number'
        ? flattenedHistory.current[latestStateRef.current.selectedNodeIndex]
        : null,
      newTree
    );

    const scroll = props.scrollContainer?.scrollTop ?? 0;

    if (props.scrollContainer) {
      props.scrollContainer.scrollTo({top: scroll});
    }

    dispatch({type: 'set selected node index', payload: selectedNodeIndex});
    setTree(newTree);

    markRowAsClicked(selectedNodeIndex, latestItemsRef.current, {
      ghostRowRef: clickedGhostRowRef.current,
      rowHeight: props.rowHeight,
      scrollTop: scroll,
      theme,
    });

    markRowAsHovered(null, latestItemsRef.current, {
      ghostRowRef: hoveredGhostRowRef.current,
      rowHeight: props.rowHeight,
      scrollTop: scroll,
      theme,
    });

    expandedHistory.current = newTree.getAllExpandedNodes(expandedHistory.current);
    flattenedHistory.current = newTree.flattened;
  }, [
    props.tree,
    props.expanded,
    props.skipFunction,
    props.sortFunction,
    props.rowHeight,
    props.scrollContainer,
    theme,
  ]);

  useEffect(() => {
    const scrollContainer = props.scrollContainer;

    if (!scrollContainer) {
      return undefined;
    }

    function handleScroll(evt) {
      const scrollTop = Math.max(0, evt.target.scrollTop);
      dispatch({type: 'set scroll top', payload: scrollTop});

      if (scrollEndTimeoutId.current !== undefined) {
        cancelAnimationTimeout(scrollEndTimeoutId.current);
      }

      evt.target.firstChild.style.pointerEvents = 'none';
      scrollEndTimeoutId.current = requestAnimationTimeout(() => {
        evt.target.firstChild.style.pointerEvents = 'auto';
      }, 150);

      if (latestStateRef.current.selectedNodeIndex !== null) {
        markRowAsClicked(
          latestStateRef.current.selectedNodeIndex,
          latestItemsRef.current,
          {
            ghostRowRef: clickedGhostRowRef.current,
            rowHeight: props.rowHeight,
            scrollTop: latestStateRef.current.scrollTop,
            theme,
          }
        );
      }

      markRowAsHovered(null, latestItemsRef.current, {
        ghostRowRef: hoveredGhostRowRef.current,
        rowHeight: props.rowHeight,
        scrollTop: latestStateRef.current.scrollTop,
        theme,
      });
    }

    const scrollListenerOptions: AddEventListenerOptions & EventListenerOptions = {
      passive: true,
    };
    scrollContainer.addEventListener('scroll', handleScroll, scrollListenerOptions);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll, scrollListenerOptions);
    };
  }, [props.scrollContainer, props.rowHeight, theme]);

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
      if (latestTreeRef.current.flattened[index]) {
        dispatch({type: 'set selected node index', payload: index});
        markRowAsClicked(index, latestItemsRef.current, {
          ghostRowRef: clickedGhostRowRef.current,
          rowHeight: props.rowHeight,
          scrollTop: latestStateRef.current.scrollTop,
          theme,
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

      const element = latestItemsRef.current.find(item => item.key === index);
      if (element?.ref) {
        element.ref.dataset.hovered = 'true';
        markRowAsHovered(index, latestItemsRef.current, {
          ghostRowRef: hoveredGhostRowRef.current,
          rowHeight: props.rowHeight,
          scrollTop: latestStateRef.current.scrollTop,
          theme,
        });
      }
    };

    scrollContainer.addEventListener('click', handleClick);
    scrollContainer.addEventListener('mousemove', handleMouseMove);

    return () => {
      scrollContainer.removeEventListener('click', handleClick);
      scrollContainer.removeEventListener('mousemove', handleMouseMove);
    };
  }, [props.rowHeight, props.scrollContainer, theme]);

  // When mouseleave is triggered on the contianer,
  // we need to hide the ghost row to avoid an orphaned row
  useEffect(() => {
    const container = props.scrollContainer;
    if (!container) {
      return undefined;
    }

    function onMouseLeave() {
      markRowAsHovered(null, latestItemsRef.current, {
        ghostRowRef: hoveredGhostRowRef.current,
        rowHeight: props.rowHeight,
        scrollTop: latestStateRef.current.scrollTop,
        theme,
      });
    }

    container.addEventListener('mouseleave', onMouseLeave, {
      passive: true,
    });

    return () => {
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [props.scrollContainer, theme, props.rowHeight]);

  // When a row is hovered, we update the ghost row
  const handleRowMouseEnter = useCallback(
    (key: number) => {
      return (_evt: React.MouseEvent<HTMLElement>) => {
        markRowAsHovered(key, latestItemsRef.current, {
          ghostRowRef: hoveredGhostRowRef.current,
          rowHeight: props.rowHeight,
          scrollTop: latestStateRef.current.scrollTop,
          theme,
        });
      };
    },
    [theme, props.rowHeight]
  );

  // When a row is clicked, we update the selected node
  const handleRowClick = useCallback(
    (selectedNodeIndex: number) => {
      return (_evt: React.MouseEvent<HTMLElement>) => {
        dispatch({type: 'set selected node index', payload: selectedNodeIndex});
        markRowAsClicked(selectedNodeIndex, latestItemsRef.current, {
          ghostRowRef: clickedGhostRowRef.current,
          rowHeight: props.rowHeight,
          scrollTop: latestStateRef.current.scrollTop,
          theme,
        });
      };
    },
    [props.rowHeight, theme]
  );

  // When a node is expanded, the underlying tree is recomputed (the flattened tree is updated)
  // We copy the properties of the old tree by creating a new instance of VirtualizedTree
  // and passing in the roots and its flattened representation so that no extra work is done.
  const handleExpandTreeNode = useCallback(
    (node: VirtualizedTreeNode<T>, opts?: {expandChildren: boolean}) => {
      // When we expand nodes, tree.expand will mutate the underlying tree which then
      // gets copied to the new tree instance. To get the right index, we need to read
      // it before any mutations are made
      const previousNode = latestStateRef.current.selectedNodeIndex
        ? latestTreeRef.current.flattened[latestStateRef.current.selectedNodeIndex] ??
          null
        : null;

      latestTreeRef.current.expandNode(node, !node.expanded, opts);
      const newTree = new VirtualizedTree(
        latestTreeRef.current.roots,
        latestTreeRef.current.flattened
      );
      expandedHistory.current = newTree.getAllExpandedNodes(new Set());

      // Hide or update the ghost if necessary
      const selectedNodeIndex = findCarryOverIndex(previousNode, newTree);

      dispatch({type: 'set selected node index', payload: selectedNodeIndex});
      setTree(newTree);

      markRowAsClicked(selectedNodeIndex, latestItemsRef.current, {
        ghostRowRef: clickedGhostRowRef.current,
        rowHeight: props.rowHeight,
        scrollTop: latestStateRef.current.scrollTop,
        theme,
      });
    },
    [props.rowHeight, theme]
  );

  // When a tree is sorted, we sort all of the nodes in the tree and not just the visible ones
  // We could probably optimize this to lazily sort as we scroll, but since we want the least amount
  // of work during scrolling, we just sort the entire tree every time.
  const handleSortingChange = useCallback(
    (sortFn: (a: VirtualizedTreeNode<T>, b: VirtualizedTreeNode<T>) => number) => {
      // When we sort nodes, tree.sort will mutate the underlying tree which then
      // gets copied to the new tree instance. To get the right index, we need to read
      // it before any mutations are made
      const previousNode = latestStateRef.current.selectedNodeIndex
        ? latestTreeRef.current.flattened[latestStateRef.current.selectedNodeIndex] ??
          null
        : null;

      latestTreeRef.current.sort(sortFn);
      const newTree = new VirtualizedTree(
        latestTreeRef.current.roots,
        latestTreeRef.current.flattened
      );

      // Hide or update the ghost if necessary
      const selectedNodeIndex = findCarryOverIndex(previousNode, newTree);

      dispatch({type: 'set selected node index', payload: selectedNodeIndex});
      setTree(newTree);
    },
    []
  );

  // Keyboard navigation for row
  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (latestStateRef.current.selectedNodeIndex === null) {
        return;
      }

      // Cant move anywhere if there are no nodes
      if (!latestTreeRef.current.flattened.length) {
        return;
      }

      if (event.key === 'Enter') {
        handleExpandTreeNode(
          latestTreeRef.current.flattened[latestStateRef.current.selectedNodeIndex],
          {
            expandChildren: true,
          }
        );
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();

        if (event.metaKey || event.ctrlKey) {
          const index = latestTreeRef.current.flattened.length - 1;

          dispatch({type: 'set selected node index', payload: index});
          markRowAsClicked(index, latestItemsRef.current, {
            ghostRowRef: clickedGhostRowRef.current,
            rowHeight: props.rowHeight,
            scrollTop: latestStateRef.current.scrollTop,
            theme,
          });
          return;
        }

        // This is fine because we are only searching visible items
        // and not the entire tree of nodes
        const indexInVisibleItems = latestItemsRef.current.findIndex(
          i => i.key === latestStateRef.current.selectedNodeIndex
        );

        if (indexInVisibleItems !== -1) {
          const nextIndex = indexInVisibleItems + 1;

          // Bounds check if we are at end of list
          if (
            latestStateRef.current.selectedNodeIndex ===
            latestTreeRef.current.flattened.length - 1
          ) {
            return;
          }

          dispatch({
            type: 'set selected node index',
            payload: latestItemsRef.current[nextIndex].key,
          });

          const node = latestItemsRef.current[nextIndex];
          if (!node) {
            throw new RangeError('Tree nextIndex is out of range of rendered items');
          }
          node.ref?.focus({preventScroll: true});
          if (onScrollToNode) {
            onScrollToNode(node, props.scrollContainer);
          } else {
            node.ref?.scrollIntoView({block: 'nearest'});
          }

          markRowAsClicked(
            latestItemsRef.current[nextIndex].key,
            latestItemsRef.current,
            {
              ghostRowRef: clickedGhostRowRef.current,
              rowHeight: props.rowHeight,
              scrollTop: latestStateRef.current.scrollTop,
              theme,
            }
          );
        }
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();

        if (event.metaKey || event.ctrlKey) {
          dispatch({type: 'set selected node index', payload: 0});
          markRowAsClicked(0, latestItemsRef.current, {
            ghostRowRef: clickedGhostRowRef.current,
            rowHeight: props.rowHeight,
            scrollTop: latestStateRef.current.scrollTop,
            theme,
          });
          return;
        }

        // This is fine because we are only searching visible items
        // and not the entire tree of nodes
        const indexInVisibleItems = latestItemsRef.current.findIndex(
          i => i.key === latestStateRef.current.selectedNodeIndex
        );

        if (indexInVisibleItems !== -1) {
          const nextIndex = indexInVisibleItems - 1;

          // Bound check if we are at start of list
          if (nextIndex < 0) {
            return;
          }

          dispatch({
            type: 'set selected node index',
            payload: latestItemsRef.current[nextIndex].key,
          });
          markRowAsClicked(
            latestItemsRef.current[nextIndex].key,
            latestItemsRef.current,
            {
              ghostRowRef: clickedGhostRowRef.current,
              rowHeight: props.rowHeight,
              scrollTop: latestStateRef.current.scrollTop,
              theme,
            }
          );
          const node = latestItemsRef.current[nextIndex];
          if (!node) {
            throw new RangeError('Tree nextIndex is out of range of rendered items');
          }
          node.ref?.focus({preventScroll: true});
          if (onScrollToNode) {
            onScrollToNode(node, props.scrollContainer);
          } else {
            node.ref?.scrollIntoView({block: 'nearest'});
          }
        }
      }
    },
    [handleExpandTreeNode, props.rowHeight, props.scrollContainer, onScrollToNode, theme]
  );

  const handleScrollTo = useCallback(
    (matcher: (item: T) => boolean) => {
      const node = latestTreeRef.current.findNode(matcher);
      // If we cant find, noop
      if (!node) {
        return;
      }

      // It is a bit unfortunate, but expandNode assumes a parent->child relationship
      // meaning a child node cannot expand its parent. This means that after we find our leaf node,
      // we need to call expand nodes in reverse path to our node, so we need to find the path
      // to our leaf node first, then expand each node in reverse order. This is a bit inefficient, but
      // it enables us to make constant space updates to the tree and avoid doing an O(n) lookup
      // for all node children when they are expanded. Since stack size is capped, this should never
      // exceed a couple hundred iterations and **should** be a reasonable tradeoff in performance.
      const edges: VirtualizedTreeNode<T>[] = [];
      let path: VirtualizedTreeNode<T> | null = node.parent;

      while (path && !path.expanded) {
        edges.push(path);
        path = path.parent;
      }

      while (edges.length) {
        const next = edges.pop();
        if (next) {
          latestTreeRef.current.expandNode(next, true);
        }
      }

      const newTree = new VirtualizedTree(
        latestTreeRef.current.roots,
        latestTreeRef.current.flattened
      );
      expandedHistory.current = newTree.getAllExpandedNodes(expandedHistory.current);
      const newlyVisibleIndex = newTree.flattened.findIndex(n => matcher(n.node));

      if (newlyVisibleIndex === -1) {
        return;
      }
      const newScrollTop = computeVirtualizedTreeNodeScrollTop(
        {
          index: newlyVisibleIndex,
          rowHeight: props.rowHeight,
          scrollHeight: latestStateRef.current.scrollHeight,
          currentScrollTop: latestStateRef.current.scrollTop,
          maxScrollableHeight: newTree.flattened.length * props.rowHeight,
        },
        'center'
      );

      setTree(newTree);
      dispatch({
        type: 'scroll to index',
        payload: {selectedNodeIndex: newlyVisibleIndex, scrollTop: newScrollTop},
      });

      markRowAsClicked(newlyVisibleIndex, latestItemsRef.current, {
        ghostRowRef: clickedGhostRowRef.current,
        rowHeight: props.rowHeight,
        scrollTop: latestStateRef.current.scrollTop,
        theme,
      });

      const newMaxHeight = newTree.flattened.length * props.rowHeight;

      // When a new view is larger than the previous view, we need to update the scroll height
      // synchronously so that the view can be scrolled to its new position. If we don't do this,
      // then the scrollTo(newScrollTop) will be clamped to the previous scroll height.
      if (props.scrollContainer?.childNodes[0]) {
        // Not exactly sure why we need the cast here, maybe we should limit HTMLElement to HTMLDivElement.
        // https://stackoverflow.com/questions/58773652/ts2339-property-style-does-not-exist-on-type-element
        const firstChild = props.scrollContainer?.childNodes?.[0] as
          | HTMLElement
          | undefined;

        if (!firstChild) {
          return;
        }
        firstChild.style.height = `${newMaxHeight}px`;
        firstChild.style.maxHeight = `${newMaxHeight}px`;
      }
      if (props.scrollContainer) {
        props.scrollContainer.scrollTo({
          top: newScrollTop,
        });

        if (onScrollToNode) {
          onScrollToNode(
            latestItemsRef.current[newlyVisibleIndex],
            props.scrollContainer,
            {top: newScrollTop, depth: node.depth}
          );
        }
      }
    },

    [props.rowHeight, onScrollToNode, props.scrollContainer, theme]
  );

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
    for (let i = 0; i < latestItemsRef.current.length; i++) {
      renderered.push(
        renderRow(latestItemsRef.current[i], {
          handleRowClick: handleRowClick(latestItemsRef.current[i].key),
          handleExpandTreeNode,
          handleRowKeyDown,
          handleRowMouseEnter: handleRowMouseEnter(latestItemsRef.current[i].key),
          selectedNodeIndex: state.selectedNodeIndex,
        })
      );
    }

    return renderered;
  }, [
    handleRowClick,
    handleRowKeyDown,
    state.selectedNodeIndex,
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
        // We only care about changes to the height of the scroll container,
        // if it has not changed then do not update the scroll height.
        if (elements[0]?.contentRect?.height !== latestStateRef.current.scrollHeight) {
          dispatch({
            type: 'set scroll height',
            payload: elements[0]?.contentRect?.height ?? 0,
          });
        }
      });
    });

    resizeObserver.observe(props.scrollContainer);

    return () => {
      if (typeof rafId === 'number') {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
    };
  }, [props.scrollContainer, props.rowHeight]);

  return {
    tree,
    items,
    renderedItems,
    selectedNodeIndex: state.selectedNodeIndex,
    dispatch,
    handleScrollTo,
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
