import type * as React from 'react';
import {Fragment, useEffect} from 'react';
import {getInteractionModality} from '@react-aria/interactions';
import type {Key, Node} from '@react-types/shared';
import {
  defaultRangeExtractor,
  observeElementRect,
  type Range,
  type VirtualizerOptions,
} from '@tanstack/react-virtual';

import {Container} from '@sentry/scraps/layout';
import type {FormSize} from '@sentry/scraps/theme';
import {useVirtualRows} from '@sentry/scraps/useVirtualRows';

import {
  estimateRowHeight,
  getMountedIndexes,
  getSectionIndexes,
} from './virtualCollectionLayout';

export {estimateRowHeight, isAfterFirstInSection} from './virtualCollectionLayout';

/**
 * Item count above which shared menu controls (CompactSelect, DropdownMenu)
 * virtualize their list.
 */
export const DEFAULT_VIRTUALIZE_THRESHOLD = 150;

/**
 * Lists a collection's nodes in the order `useVirtualCollection` renders them:
 * each section is followed by its child nodes, so a long section is windowed
 * like any other run of rows instead of mounting all at once. Nodes in
 * `hiddenKeys` are left out, whether they are sections, their children or
 * top-level items.
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

/**
 * Reports the scroll element's size like the default, but never taller than the
 * window. A menu's list is capped by the space its overlay is positioned in,
 * which is only known after its first render. Until then the list can be as
 * tall as all of its rows, and the virtualizer would mount every one of them.
 * The visible part of a list cannot be taller than the window, so this never
 * mounts fewer rows than can be seen.
 */
const observeViewportCappedRect: VirtualizerOptions<
  HTMLElement,
  Element
>['observeElementRect'] = (instance, cb) =>
  observeElementRect(instance, rect =>
    cb({
      width: rect.width,
      height: Math.min(rect.height, instance.targetWindow?.innerHeight ?? rect.height),
    })
  );

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

export interface UseVirtualCollectionOptions<T> {
  /**
   * The collection's top-level nodes, such as a React Aria `state.collection`.
   * Each section's child nodes are windowed as rows of their own, see
   * `flattenSections`.
   */
  collection: Iterable<Node<T>>;
  /** Whether to virtualize. When false, every node is returned as a row. */
  enabled: boolean;
  /**
   * The element that scrolls. Rows and spacers must render inside it.
   */
  scrollRef: React.RefObject<HTMLElement | null>;
  /**
   * Height to assume for a row that has not been measured yet. Read on every
   * render, so it does not need to be stable. Defaults to the height of a menu
   * `ListItem` of `size`, plus `sectionRowSpace`.
   */
  estimateSize?: (node: Node<T>, index: number) => number;
  /**
   * The collection's focused key. When it changes through the keyboard, the
   * row is scrolled into view so it mounts and React Aria can focus it. The
   * focused row also stays mounted while it is scrolled out of view, so it
   * keeps DOM focus and the keyboard keeps working.
   */
  focusedKey?: Key | null;
  /** Keys of nodes to leave out, whether they are sections, their children or top-level items. */
  hiddenKeys?: ReadonlySet<Key>;
  /**
   * Vertical CSS padding (px) of the list, at each end. The first row starts
   * below it, and rows scrolled into view keep clear of it.
   */
  listPadding?: number;
  /**
   * Space (px) above each row in a section except the first, if the rows are
   * spaced that way. The virtualizer measures a row's border box, so the space
   * must be padding on the row's own element for mounted rows to keep it. A
   * margin, or a gap on the list, is not part of a measured row: the rows would
   * lose it once they mount and the scroll range would shrink. Added to the
   * estimates of unmounted rows so the range does not shrink until they mount.
   */
  sectionRowSpace?: number;
  /**
   * Item size of the default `estimateSize`. Defaults to `md`. Changing it, or
   * `sectionRowSpace`, discards the measured row heights, since every row
   * changes height. Pass it with a custom `estimateSize` too.
   */
  size?: FormSize;
  /**
   * A row to keep mounted wherever the list is scrolled, such as the one with
   * the longest label. A list that sizes its width to its content is then as
   * wide as that row from the start, instead of widening as wider rows scroll
   * into view.
   */
  widestKey?: Key | null;
}

/** The result of `useVirtualCollection`. Render it with `VirtualRows`. */
export interface VirtualCollection<T> {
  /** The rows to render, in order: every node, or the mounted ones when virtualized. */
  rows: Array<VirtualRow<T>>;
  /** Height of the unmounted rows after the last mounted one. */
  spaceAfter: number;
}

/**
 * Windows a React Aria collection so only the rows near the viewport mount.
 *
 * It owns layout only, never selection or focus. Callers keep their React Aria
 * state and render the rows with `VirtualRows`, which puts each row in its
 * section and fills the space of the unmounted rows:
 *
 * ```tsx
 * const virtual = useVirtualCollection({
 *   collection: state.collection,
 *   enabled,
 *   size,
 *   scrollRef,
 *   focusedKey: state.selectionManager.focusedKey,
 * });
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
export function useVirtualCollection<T>({
  collection,
  enabled,
  scrollRef,
  estimateSize,
  focusedKey,
  hiddenKeys,
  listPadding = 0,
  sectionRowSpace = 0,
  size = 'md',
  widestKey,
}: UseVirtualCollectionOptions<T>): VirtualCollection<T> {
  const nodes = flattenSections(collection, hiddenKeys);
  const focusedIndex =
    enabled && focusedKey !== null && focusedKey !== undefined
      ? nodes.findIndex(node => node.key === focusedKey)
      : -1;
  const widestIndex =
    enabled && widestKey !== null && widestKey !== undefined
      ? nodes.findIndex(node => node.key === widestKey)
      : -1;
  const sectionIndexes = getSectionIndexes(nodes);

  // Keep the focused row mounted when it scrolls out of view. If it unmounted,
  // DOM focus would fall back to the body and keyboard navigation would stop.
  // Also keep the widest row and the section row of every mounted row, since
  // the section's element wraps its children.
  const rangeExtractor = (range: Range) =>
    getMountedIndexes({
      windowIndexes: defaultRangeExtractor(range),
      focusedIndex,
      widestIndex,
      sectionIndexes,
    });

  const {virtualizer, virtualItems, totalSize} = useVirtualRows({
    count: nodes.length,
    enabled,
    getScrollElement: () => scrollRef.current,
    getItemKey: index => nodes[index]?.key ?? index,
    estimateSize: index => {
      const node = nodes[index];
      return estimateSize && node
        ? estimateSize(node, index)
        : estimateRowHeight(
            node,
            nodes[sectionIndexes[index] ?? -1],
            size,
            sectionRowSpace
          );
    },
    // Measured heights stay valid while the collection is rebuilt with the same
    // rows, such as when one item changes. Discarding them would move every
    // row back to its estimate and shift the rows in view. The estimates of
    // unmeasured rows are still current: `getItemKey` is a new function on
    // every render, so the virtualizer rebuilds its offsets.
    estimateKey: `${size}-${sectionRowSpace}`,
    paddingStart: listPadding,
    // The list's padding is the same at both ends, so a row scrolled into view
    // at the bottom clears it too.
    scrollPaddingStart: listPadding,
    scrollPaddingEnd: listPadding,
    overscan: 1,
    rangeExtractor,
    observeElementRect: observeViewportCappedRect,
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

  const rows: Array<VirtualRow<T>> = enabled
    ? virtualItems.flatMap((item, position) => {
        const node = nodes[item.index];
        if (!node) {
          return [];
        }
        const previousEnd = virtualItems[position - 1]?.end ?? listPadding;
        return [
          {
            node,
            props: {'data-index': item.index, ref: virtualizer.measureElement},
            spaceBefore: Math.max(0, item.start - previousEnd),
          },
        ];
      })
    : nodes.map(node => ({node, props: undefined, spaceBefore: 0}));

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
  return (
    <Container
      as="li"
      aria-hidden
      role="presentation"
      height={`${height}px`}
      flexShrink={0}
    />
  );
}

interface VirtualRowsProps<T> {
  /**
   * Renders an item row. Spread `props` onto the element that is the row's
   * height, so the virtualizer can measure it.
   *
   * The list re-renders on every scroll, and `props` is a new object each time.
   * To let a row that did not change skip rendering, pass the row component
   * `props['data-index']` and `props.ref` as separate props, which keep their
   * identity, and rebuild the object inside it.
   */
  renderRow: (row: VirtualRow<T>) => React.ReactNode;
  /** The result of `useVirtualCollection`. */
  virtual: VirtualCollection<T>;
  /**
   * Renders a section around its rendered rows. Spread the section's `props`
   * onto the element above its rows, such as the one holding its header.
   * Required when the collection has sections; by default only the rows render.
   */
  renderSection?: (section: VirtualRow<T>, rows: React.ReactNode) => React.ReactNode;
}

function renderSectionRows(_section: VirtualRow<unknown>, rows: React.ReactNode) {
  return rows;
}

/**
 * Renders the rows of `useVirtualCollection`, with each row inside its section
 * and spacers in place of the unmounted rows. Render it inside the scroll
 * element. Rows outside sections stay siblings, so they keep their elements
 * when the list reorders.
 */
export function VirtualRows<T>({
  virtual,
  renderRow,
  renderSection = renderSectionRows,
}: VirtualRowsProps<T>) {
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
