import type * as React from 'react';
import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {getInteractionModality} from '@react-aria/interactions';
import type {Key, Node} from '@react-types/shared';
import {defaultRangeExtractor, type Range} from '@tanstack/react-virtual';

import type {FormSize} from '@sentry/scraps/theme';
import {useVirtualRows} from '@sentry/scraps/useVirtualRows';

import {
  estimateRowHeight,
  getMountedIndexes,
  getSectionIndexes,
} from './virtualCollectionLayout';

/**
 * Item count above which shared menu controls (CompactSelect, DropdownMenu)
 * virtualize their list.
 */
export const DEFAULT_VIRTUALIZE_THRESHOLD = 150;

/**
 * Lists a collection's nodes in the order `useVirtualCollection` expects: each
 * section is followed by its child nodes, so a long section is windowed like
 * any other run of rows instead of mounting all at once. Nodes in `hiddenKeys`
 * are left out, whether they are sections, their children or top-level items.
 */
export function flattenSections<T>(
  nodes: Iterable<Node<T>>,
  hiddenKeys?: ReadonlySet<Key>
): Array<Node<T>> {
  const isVisible = (node: Node<T>) => !hiddenKeys?.has(node.key);
  return [...nodes]
    .filter(isVisible)
    .flatMap(node =>
      node.type === 'section' ? [node, ...[...node.childNodes].filter(isVisible)] : [node]
    );
}

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
   * Collection nodes, in render order. Use `flattenSections` so each section
   * is followed by its child nodes. A section's row stays mounted while any of
   * its children are, so its heading and group element are there to wrap them;
   * `groupVirtualRows` puts them back together.
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
   * Vertical CSS padding (px) of the list, at each end. The first row starts
   * below it, and rows scrolled into view keep clear of it.
   */
  listPadding?: number;
  /**
   * Space (px) above each row in a section except the first, if the rows are
   * spaced that way. Mounted rows are measured with it, so adding it to the
   * estimates of unmounted rows keeps the scroll range from shrinking until
   * they mount.
   */
  sectionRowGap?: number;
  /**
   * A row to keep mounted wherever the list is scrolled, such as the one with
   * the longest label. A list that sizes its width to its content is then as
   * wide as that row from the start, instead of widening as wider rows scroll
   * into view.
   */
  widestKey?: Key | null;
}

/**
 * Windows a React Aria collection so only the rows near the viewport mount.
 *
 * It owns layout only, never selection or focus. Callers keep their React Aria
 * state and render the rows with `VirtualRows`, which puts each row in its
 * section and fills the space of the unmounted rows:
 *
 * ```tsx
 * const nodes = useMemo(() => flattenSections(state.collection), [state.collection]);
 * const virtual = useVirtualCollection({nodes, enabled, size, scrollRef, focusedKey});
 * <ul ref={scrollRef}>
 *   <VirtualRows
 *     virtual={virtual}
 *     renderRow={({node, props}) => <Option {...props} node={node} />}
 *     renderSection={({node, props}, rows) => (
 *       <Section rowProps={props} node={node}>{rows}</Section>
 *     )}
 *   />
 * </ul>
 * ```
 *
 * Spacers keep the list's own element and padding intact, so a virtualized
 * list has the same DOM structure and styling as a regular one.
 */
export interface VirtualCollection<T> {
  /** The rows to render, in order: every node, or the mounted ones when virtualized. */
  rows: Array<VirtualRow<T>>;
  /** Height of the unmounted rows after the last mounted one. */
  spaceAfter: number;
}

export function useVirtualCollection<T>({
  enabled,
  nodes,
  scrollRef,
  size,
  focusedKey,
  listPadding = 0,
  widestKey,
  sectionRowGap = 0,
}: UseVirtualCollectionOptions<T>): VirtualCollection<T> {
  const focusedIndex = useMemo(
    () =>
      enabled && focusedKey !== null && focusedKey !== undefined
        ? nodes.findIndex(node => node.key === focusedKey)
        : -1,
    [enabled, focusedKey, nodes]
  );
  const widestIndex = useMemo(
    () =>
      enabled && widestKey !== null && widestKey !== undefined
        ? nodes.findIndex(node => node.key === widestKey)
        : -1,
    [enabled, widestKey, nodes]
  );

  const sectionIndexes = useMemo(() => getSectionIndexes(nodes), [nodes]);

  // Keep the focused row mounted when it scrolls out of view. If it unmounted,
  // DOM focus would fall back to the body and keyboard navigation would stop.
  // Also keep the widest row and the section row of every mounted row, since
  // the section's element wraps its children.
  const rangeExtractor = useCallback(
    (range: Range) =>
      getMountedIndexes({
        windowIndexes: defaultRangeExtractor(range),
        focusedIndex,
        widestIndex,
        sectionIndexes,
      }),
    [focusedIndex, widestIndex, sectionIndexes]
  );

  const {virtualizer, virtualItems, totalSize} = useVirtualRows({
    count: nodes.length,
    enabled,
    getScrollElement: () => scrollRef.current,
    getItemKey: index => nodes[index]?.key ?? index,
    estimateSize: index => estimateRowHeight(nodes, index, size, sectionRowGap),
    estimateKey: `${size}-${sectionRowGap}`,
    paddingStart: listPadding,
    // The list's padding is the same at both ends, so a row scrolled into view
    // at the bottom clears it too.
    scrollPaddingStart: listPadding,
    scrollPaddingEnd: listPadding,
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

  // Before any row mounts, the spacer stands in for the whole list. A list
  // without padding of its own would otherwise be 0px tall, and the
  // virtualizer mounts no rows into a viewport of 0px, so it would stay empty.
  const last = virtualItems.at(-1);
  return {
    rows,
    spaceAfter: enabled ? Math.max(0, totalSize - (last?.end ?? listPadding)) : 0,
  };
}

interface VirtualRowGroup<T> {
  rows: Array<VirtualRow<T>>;
  /** The section's own row. Undefined for a row that is not in a section. */
  section?: VirtualRow<T>;
}

/**
 * Puts the rows of each section back under their section. `useVirtualCollection`
 * keeps a section's row mounted while any of its rows are, so they always
 * follow it.
 */
function groupVirtualRows<T>(
  rows: ReadonlyArray<VirtualRow<T>>
): Array<VirtualRowGroup<T>> {
  const groups: Array<VirtualRowGroup<T>> = [];
  for (const row of rows) {
    const group = groups.at(-1);
    if (row.node.type === 'section') {
      groups.push({section: row, rows: []});
    } else if (group?.section && group.section.node.key === row.node.parentKey) {
      group.rows.push(row);
    } else {
      groups.push({rows: [row]});
    }
  }
  return groups;
}

/**
 * Stands in for the rows outside the virtualized window. Renders nothing when
 * there is no space to fill.
 */
function VirtualSpacer({height}: {height: number}) {
  if (height <= 0) {
    return null;
  }
  return <li aria-hidden role="presentation" style={{height, flexShrink: 0}} />;
}

interface VirtualRowsProps<T> {
  /**
   * Renders an item row. Spread `props` onto the element that is the row's
   * height, so the virtualizer can measure it.
   */
  renderRow: (row: VirtualRow<T>) => React.ReactNode;
  /**
   * Renders a section around its rendered rows. Spread the section's `props`
   * onto the element above its rows, such as the one holding its header.
   */
  renderSection: (section: VirtualRow<T>, rows: React.ReactNode) => React.ReactNode;
  /** The result of `useVirtualCollection`. */
  virtual: VirtualCollection<T>;
}

/**
 * Renders the rows of `useVirtualCollection`, with each row inside its section
 * and spacers in place of the unmounted rows. Render it inside the scroll
 * element. Rows outside sections stay siblings, so they keep their elements
 * when the list reorders.
 */
export function VirtualRows<T>({virtual, renderRow, renderSection}: VirtualRowsProps<T>) {
  const renderWithSpacer = (row: VirtualRow<T>) => (
    <Fragment key={row.node.key}>
      <VirtualSpacer height={row.spaceBefore} />
      {renderRow(row)}
    </Fragment>
  );

  return (
    <Fragment>
      {groupVirtualRows(virtual.rows).flatMap(({section, rows}) =>
        section ? (
          <Fragment key={section.node.key}>
            <VirtualSpacer height={section.spaceBefore} />
            {renderSection(section, rows.map(renderWithSpacer))}
          </Fragment>
        ) : (
          rows.map(renderWithSpacer)
        )
      )}
      <VirtualSpacer height={virtual.spaceAfter} />
    </Fragment>
  );
}
