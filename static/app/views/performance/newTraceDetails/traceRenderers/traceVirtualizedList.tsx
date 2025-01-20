import {useLayoutEffect, useRef, useState} from 'react';

import {requestAnimationTimeout} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';

import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import type {TraceScheduler} from '../traceRenderers/traceScheduler';
import {
  VirtualizedList,
  type VirtualizedViewManager,
} from '../traceRenderers/virtualizedViewManager';

export interface VirtualizedRow {
  index: number;
  item: TraceTreeNode<TraceTree.NodeValue>;
  key: number;
  style: React.CSSProperties;
}
interface UseVirtualizedListProps {
  container: HTMLElement | null;
  items: ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>>;
  manager: VirtualizedViewManager;
  render: (item: VirtualizedRow) => React.ReactNode;
  scheduler: TraceScheduler;
}

interface UseVirtualizedListResult {
  list: VirtualizedList;
  rendered: React.ReactNode[];
  virtualized: VirtualizedRow[];
}

export const useVirtualizedList = (
  props: UseVirtualizedListProps
): UseVirtualizedListResult => {
  const list = useRef<VirtualizedList | null>();

  const scrollTopRef = useRef<number>(0);
  const scrollHeightRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const renderCache = useRef<Map<number, React.ReactNode>>();
  const styleCache = useRef<Map<number, React.CSSProperties>>();
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  if (!styleCache.current) {
    styleCache.current = new Map();
  }
  if (!renderCache.current) {
    renderCache.current = new Map();
  }

  const [items, setItems] = useState<{
    rendered: React.ReactNode[];
    virtualized: VirtualizedRow[];
  }>({rendered: [], virtualized: []});

  if (!list.current) {
    list.current = new VirtualizedList();
    props.manager.registerList(list.current);
  }

  const renderRef = useRef<(item: VirtualizedRow) => React.ReactNode>(props.render);
  renderRef.current = props.render;
  const itemsRef = useRef<ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>>>(props.items);
  itemsRef.current = props.items;
  const managerRef = useRef<VirtualizedViewManager>(props.manager);
  managerRef.current = props.manager;

  useLayoutEffect(() => {
    if (!props.container) {
      return;
    }
    const scrollContainer = props.container.children[0] as HTMLElement | null;
    if (!scrollContainer) {
      throw new Error(
        'Virtualized list container has to render a scroll container as its first child.'
      );
    }
  }, [props.container, props.items.length]);

  useLayoutEffect(() => {
    if (!props.container || !list.current) {
      return;
    }

    list.current.container = props.container;

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    const resizeObserver = new ResizeObserver(elements => {
      // We only care about changes to the height of the scroll container,
      // if it has not changed then do not update the scroll height.
      styleCache.current?.clear();
      renderCache.current?.clear();

      scrollHeightRef.current = elements[0]!.contentRect.height;
      if (list.current) {
        list.current.scrollHeight = scrollHeightRef.current;
      }

      maybeToggleScrollbar(
        elements[0]!.target as HTMLElement,
        scrollHeightRef.current,
        itemsRef.current.length * 24,
        managerRef.current
      );

      const recomputedItems = findRenderedItems({
        scrollTop: scrollTopRef.current,
        items: itemsRef.current,
        overscroll: 5,
        rowHeight: 24,
        scrollHeight: scrollHeightRef.current,
        styleCache: styleCache.current!,
        renderCache: renderCache.current!,
        render: renderRef.current,
        manager: managerRef.current,
      });
      setItems(recomputedItems);
    });

    resizeObserver.observe(props.container);
    resizeObserverRef.current = resizeObserver;
  }, [props.container]);

  const rafId = useRef<number | null>(null);
  const pointerEventsRaf = useRef<{id: number} | null>(null);

  useLayoutEffect(() => {
    if (!list.current || !props.container) {
      return undefined;
    }

    if (props.container && !scrollContainerRef.current) {
      scrollContainerRef.current = props.container.children[0] as HTMLElement | null;
    }

    props.container.style.height = '100%';
    props.container.style.overflow = 'auto';
    props.container.style.position = 'relative';
    props.container.style.willChange = 'transform';
    props.container.style.overscrollBehavior = 'none';

    scrollContainerRef.current!.style.overflow = 'hidden';
    scrollContainerRef.current!.style.position = 'relative';
    scrollContainerRef.current!.style.willChange = 'transform';
    scrollContainerRef.current!.style.height = `${props.items.length * 24}px`;

    props.scheduler.dispatch('initialize virtualized list');

    maybeToggleScrollbar(
      props.container,
      scrollHeightRef.current,
      props.items.length * 24,
      props.manager
    );

    const onScroll = (event: any) => {
      if (!list.current) {
        return;
      }

      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
      }

      managerRef.current.scrolling_source = 'list';
      managerRef.current.enqueueOnScrollEndOutOfBoundsCheck();

      rafId.current = window.requestAnimationFrame(() => {
        scrollTopRef.current = Math.max(0, event.target?.scrollTop ?? 0);

        const recomputedItems = findRenderedItems({
          scrollTop: scrollTopRef.current,
          items: props.items,
          overscroll: 5,
          rowHeight: 24,
          scrollHeight: scrollHeightRef.current,
          styleCache: styleCache.current!,
          renderCache: renderCache.current!,
          render: renderRef.current,
          manager: managerRef.current,
        });
        setItems(recomputedItems);
      });

      if (!pointerEventsRaf.current && scrollContainerRef.current) {
        scrollContainerRef.current.style.pointerEvents = 'none';
      }

      if (pointerEventsRaf.current) {
        window.cancelAnimationFrame(pointerEventsRaf.current.id);
      }

      pointerEventsRaf.current = requestAnimationTimeout(() => {
        styleCache.current?.clear();
        renderCache.current?.clear();

        managerRef.current.scrolling_source = null;

        const recomputedItems = findRenderedItems({
          scrollTop: scrollTopRef.current,
          items: props.items,
          overscroll: 5,
          rowHeight: 24,
          scrollHeight: scrollHeightRef.current,
          styleCache: styleCache.current!,
          renderCache: renderCache.current!,
          render: renderRef.current,
          manager: managerRef.current,
        });
        setItems(recomputedItems);

        if (list.current && scrollContainerRef.current) {
          scrollContainerRef.current.style.pointerEvents = 'auto';
          pointerEventsRaf.current = null;
        }
      }, 150);
    };

    props.container.addEventListener('scroll', onScroll, {passive: true});

    return () => {
      props.container?.removeEventListener('scroll', onScroll);
    };
  }, [props.container, props.items, props.items.length, props.manager, props.scheduler]);

  useLayoutEffect(() => {
    if (!list.current || !styleCache.current || !renderCache.current) {
      return;
    }

    styleCache.current.clear();
    renderCache.current.clear();

    const recomputedItems = findRenderedItems({
      scrollTop: scrollTopRef.current,
      items: props.items,
      overscroll: 5,
      rowHeight: 24,
      scrollHeight: scrollHeightRef.current,
      styleCache: styleCache.current!,
      renderCache: renderCache.current,
      render: renderRef.current,
      manager: managerRef.current,
    });

    setItems(recomputedItems);
  }, [props.items, props.items.length, props.render]);

  return {
    virtualized: items.virtualized,
    rendered: items.rendered,
    list: list.current!,
  };
};

function findRenderedItems({
  items,
  overscroll,
  rowHeight,
  scrollHeight,
  scrollTop,
  styleCache,
  renderCache,
  render,
  manager,
}: {
  items: ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>>;
  manager: VirtualizedViewManager;
  overscroll: number;
  render: (arg: VirtualizedRow) => React.ReactNode;
  renderCache: Map<number, React.ReactNode>;
  rowHeight: number;
  scrollHeight: number;
  scrollTop: number;
  styleCache: Map<number, React.CSSProperties>;
}): {rendered: React.ReactNode[]; virtualized: VirtualizedRow[]} {
  // This is overscroll height for single direction, when computing the total,
  // we need to multiply this by 2 because we overscroll in both directions.
  const OVERSCROLL_HEIGHT = overscroll * rowHeight;
  const virtualized: VirtualizedRow[] = [];
  const rendered: React.ReactNode[] = [];

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

  manager.start_virtualized_index = indexPointer;

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
      let style = styleCache.get(indexPointer);
      if (!style) {
        style = {position: 'absolute', transform: `translate(0px, ${elementTop}px)`};
        styleCache.set(indexPointer, style);
      }

      const virtualizedRow: VirtualizedRow = {
        key: indexPointer,
        style,
        index: indexPointer,
        item: items[indexPointer]!,
      };

      virtualized[visibleItemIndex] = virtualizedRow;

      const renderedRow = renderCache.get(indexPointer) || render(virtualizedRow);
      rendered[visibleItemIndex] = renderedRow;
      renderCache.set(indexPointer, renderedRow);
      visibleItemIndex++;
    }
    indexPointer++;
  }

  return {rendered, virtualized};
}

export function findOptimisticStartIndex({
  items,
  overscroll,
  rowHeight,
  scrollTop,
  viewport,
}: {
  items: ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>>;
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

function maybeToggleScrollbar(
  container: HTMLElement,
  containerHeight: number,
  scrollHeight: number,
  manager: VirtualizedViewManager
) {
  if (scrollHeight > containerHeight) {
    container.style.overflowY = 'scroll';
    container.style.scrollbarGutter = 'stable';
    manager.onScrollbarWidthChange(container.offsetWidth - container.clientWidth);
  } else {
    container.style.overflowY = 'auto';
    container.style.scrollbarGutter = 'auto';
    manager.onScrollbarWidthChange(0);
  }
}
