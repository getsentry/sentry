import type * as React from 'react';
import {useCallback, useEffect, useMemo} from 'react';
import {getInteractionModality} from '@react-aria/interactions';
import type {Key, Node} from '@react-types/shared';
import {defaultRangeExtractor, type Range} from '@tanstack/react-virtual';

import type {FormSize} from '@sentry/scraps/theme';
import {useVirtualRows} from '@sentry/scraps/useVirtualRows';

/**
 * Item count above which shared menu controls (CompactSelect, DropdownMenu)
 * virtualize their list.
 */
export const DEFAULT_VIRTUALIZE_THRESHOLD = 150;

/**
 * Whether a flat list of items is long enough to virtualize. Lists with
 * sections are never virtualized: a section that renders as one tall row would
 * not limit how many items mount. To window a list with sections, pass each
 * section's items to `useVirtualCollection` as rows, like DropdownMenu does.
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
  /**
   * Height of the unmounted rows between this row and the previous one. Render
   * a `VirtualSpacer` of this height before the row. Usually only the first
   * row has space before it, but the focused row stays mounted when it scrolls
   * out of view, so there can be a gap on either side of it.
   */
  spaceBefore: number;
}

interface UseVirtualCollectionOptions<T> {
  /** Whether to virtualize. When false, every node is returned as a row. */
  enabled: boolean;
  /**
   * Collection nodes, in render order. A section can be windowed too: pass the
   * section node followed by its child nodes, and the section's row stays
   * mounted while any of its children are, so the section's heading and group
   * element are always there to wrap them.
   */
  nodes: ReadonlyArray<Node<T>>;
  /**
   * The element that scrolls. Rows and spacers must render inside it.
   */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** Item size. Used to estimate the height of rows that have not been measured. */
  size: FormSize;
  /**
   * The collection's focused key. When it changes through the keyboard, the
   * row is scrolled into view so it mounts and React Aria can focus it. The
   * focused row also stays mounted while it is scrolled out of view, so it
   * keeps DOM focus and the keyboard keeps working.
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
 * state and render rows as usual, with a spacer before each row and after the
 * last one:
 *
 * ```tsx
 * const virtual = useVirtualCollection({nodes, enabled, size, scrollRef, focusedKey});
 * <ul ref={scrollRef}>
 *   {virtual.rows.map(({node, props, spaceBefore}) => (
 *     <Fragment key={node.key}>
 *       <VirtualSpacer height={spaceBefore} />
 *       <Option {...props} node={node} />
 *     </Fragment>
 *   ))}
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

  const focusedIndex = useMemo(
    () =>
      enabled && focusedKey !== null && focusedKey !== undefined
        ? nodes.findIndex(node => node.key === focusedKey)
        : -1,
    [enabled, focusedKey, nodes]
  );

  // Index of the section row each row belongs to, if that section is in `nodes`.
  const sectionIndexes = useMemo(() => {
    const indexByKey = new Map<Key, number>();
    nodes.forEach((node, index) => {
      if (node.type === 'section') {
        indexByKey.set(node.key, index);
      }
    });
    return nodes.map(node =>
      node.parentKey === null || node.parentKey === undefined
        ? undefined
        : indexByKey.get(node.parentKey)
    );
  }, [nodes]);

  // Keep the focused row mounted when it scrolls out of view. If it unmounted,
  // DOM focus would fall back to the body and keyboard navigation would stop.
  // Also keep the section row of every mounted row, since the section's
  // element wraps its children.
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = new Set(defaultRangeExtractor(range));
      if (focusedIndex !== -1) {
        indexes.add(focusedIndex);
      }
      for (const index of [...indexes]) {
        const sectionIndex = sectionIndexes[index];
        if (sectionIndex !== undefined) {
          indexes.add(sectionIndex);
        }
      }
      return [...indexes].sort((a, b) => a - b);
    },
    [focusedIndex, sectionIndexes]
  );

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
    rangeExtractor,
  });

  // Keyboard navigation can move focus to a row that is not mounted. Scroll it
  // into view so it mounts; React Aria then focuses it. Pointer focus follows
  // the hovered row, which is already visible, so scrolling would only fight it.
  useEffect(() => {
    if (focusedIndex === -1 || getInteractionModality() === 'pointer') {
      return;
    }
    virtualizer.scrollToIndex(focusedIndex, {align: 'auto'});
  }, [focusedIndex, virtualizer]);

  const rows = useMemo<Array<VirtualRow<T>>>(() => {
    if (!enabled) {
      return nodes.map(node => ({node, props: undefined, spaceBefore: 0}));
    }
    let previousEnd = listPadding;
    return virtualItems.flatMap(item => {
      const node = nodes[item.index];
      if (!node) {
        return [];
      }
      const spaceBefore = Math.max(0, item.start - previousEnd);
      previousEnd = item.end;
      return [
        {
          node,
          props: {'data-index': item.index, ref: virtualizer.measureElement},
          spaceBefore,
        },
      ];
    });
  }, [enabled, listPadding, nodes, virtualItems, virtualizer]);

  const last = virtualItems.at(-1);
  return {
    rows,
    spaceAfter: enabled && last ? Math.max(0, totalSize - last.end) : 0,
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
