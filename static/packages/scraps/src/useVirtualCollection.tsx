import type * as React from 'react';
import {useEffect, useMemo} from 'react';
import {getInteractionModality} from '@react-aria/interactions';
import type {Key, Node} from '@react-types/shared';

import type {FormSize} from '@sentry/scraps/theme';
import {useVirtualRows} from '@sentry/scraps/useVirtualRows';

/**
 * Item count above which shared menu controls (CompactSelect, DropdownMenu)
 * virtualize their list.
 */
export const DEFAULT_VIRTUALIZE_THRESHOLD = 150;

/**
 * Whether a flat list of items is long enough to virtualize. Lists with
 * sections are never virtualized: a section renders as one tall row, so
 * windowing over sections would not limit how many items mount.
 */
export function shouldVirtualize<T>(
  items: readonly T[],
  {
    isSection,
    threshold = DEFAULT_VIRTUALIZE_THRESHOLD,
  }: {isSection: (item: T) => boolean; threshold?: number}
): boolean {
  return items.length > threshold && !items.some(isSection);
}

const ROW_HEIGHT_ESTIMATES = {
  xs: {regular: 25, withDetails: 42},
  sm: {regular: 32, withDetails: 49},
  md: {regular: 36, withDetails: 53},
} as const satisfies Record<FormSize, {regular: number; withDetails: number}>;

/** Props for the element that renders a row. Spread them onto the row's root element. */
export interface VirtualRowProps {
  'data-index': number;
  ref: (element: Element | null) => void;
}

export interface VirtualRow<T> {
  node: Node<T>;
  /** Undefined when virtualization is disabled. */
  props: VirtualRowProps | undefined;
}

interface UseVirtualCollectionOptions<T> {
  /** Whether to virtualize. When false, every node is returned as a row. */
  enabled: boolean;
  /** Top-level collection nodes, in render order. */
  nodes: ReadonlyArray<Node<T>>;
  /**
   * The element that scrolls. Rows and spacers must render inside it.
   */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** Item size. Used to estimate the height of rows that have not been measured. */
  size: FormSize;
  /**
   * The collection's focused key. When it changes through the keyboard, the
   * row is scrolled into view so it mounts and React Aria can focus it.
   */
  focusedKey?: Key | null;
  /**
   * CSS padding (px) between the top of the scroll element and the first row.
   */
  listPadding?: number;
}

/**
 * Windows a React Aria collection so only the rows near the viewport mount.
 *
 * It owns layout only, never selection or focus. Callers keep their React Aria
 * state and render rows as usual, with a spacer before and after them:
 *
 * ```tsx
 * const virtual = useVirtualCollection({nodes, enabled, size, scrollRef, focusedKey});
 * <ul ref={scrollRef}>
 *   <VirtualSpacer height={virtual.spaceBefore} />
 *   {virtual.rows.map(({node, props}) => <Option key={node.key} {...props} node={node} />)}
 *   <VirtualSpacer height={virtual.spaceAfter} />
 * </ul>
 * ```
 *
 * Spacers keep the list's own element and padding intact, so a virtualized
 * list has the same DOM structure and styling as a regular one.
 */
export function useVirtualCollection<T>({
  enabled,
  nodes,
  scrollRef,
  size,
  focusedKey,
  listPadding = 0,
}: UseVirtualCollectionOptions<T>) {
  const heights = ROW_HEIGHT_ESTIMATES[size];

  const {virtualizer, virtualItems, totalSize} = useVirtualRows({
    count: nodes.length,
    enabled,
    getScrollElement: () => scrollRef.current,
    getItemKey: index => nodes[index]?.key ?? index,
    estimateSize: index =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      nodes[index]?.props?.details ? heights.withDetails : heights.regular,
    estimateKey: size,
    paddingStart: listPadding,
    scrollPaddingStart: listPadding,
    overscan: 1,
  });

  // Keyboard navigation can move focus to a row that is not mounted. Scroll it
  // into view so it mounts; React Aria then focuses it. Pointer focus follows
  // the hovered row, which is already visible, so scrolling would only fight it.
  useEffect(() => {
    if (!enabled || focusedKey === null || focusedKey === undefined) {
      return;
    }
    if (getInteractionModality() === 'pointer') {
      return;
    }
    const index = nodes.findIndex(node => node.key === focusedKey);
    if (index !== -1) {
      virtualizer.scrollToIndex(index, {align: 'auto'});
    }
  }, [enabled, focusedKey, nodes, virtualizer]);

  const rows = useMemo<Array<VirtualRow<T>>>(() => {
    if (!enabled) {
      return nodes.map(node => ({node, props: undefined}));
    }
    return virtualItems.flatMap(item => {
      const node = nodes[item.index];
      return node
        ? [{node, props: {'data-index': item.index, ref: virtualizer.measureElement}}]
        : [];
    });
  }, [enabled, nodes, virtualItems, virtualizer]);

  if (!enabled) {
    return {rows, spaceBefore: 0, spaceAfter: 0};
  }

  const first = virtualItems[0];
  const last = virtualItems.at(-1);
  return {
    rows,
    spaceBefore: first ? Math.max(0, first.start - listPadding) : 0,
    spaceAfter: last ? Math.max(0, totalSize - last.end) : 0,
  };
}

/**
 * Stands in for the rows outside the virtualized window. Renders nothing when
 * there is no space to fill.
 */
export function VirtualSpacer({height}: {height: number}) {
  if (height <= 0) {
    return null;
  }
  return <li aria-hidden role="presentation" style={{height, flexShrink: 0}} />;
}
