import type * as React from 'react';
import {Fragment, useEffect, useLayoutEffect, useState} from 'react';
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
 * like any other run of rows instead of mounting all at once. Items in
 * `hiddenKeys` are left out, and so is a section when all of its items are.
 * Section keys are not looked up in `hiddenKeys`, since they can equal an
 * item's key.
 */
export function flattenSections<T>(
  nodes: Iterable<Node<T>>,
  hiddenKeys?: ReadonlySet<Key>
): Array<Node<T>> {
  const isVisible = (node: Node<T>) => !hiddenKeys?.has(node.key);
  return [...nodes].flatMap(node => {
    if (node.type !== 'section') {
      return isVisible(node) ? [node] : [];
    }
    const children = [...node.childNodes];
    const visibleChildren = children.filter(isVisible);
    return children.length > 0 && visibleChildren.length === 0
      ? []
      : [node, ...visibleChildren];
  });
}

/**
 * Key of the item with the longest label, to pin with `pinnedKeys`. Sections are
 * skipped.
 */
export function getWidestKey<T>(nodes: ReadonlyArray<Node<T>>): Key | undefined {
  return nodes.reduce<Node<T> | undefined>(
    (widest, node) =>
      node.type !== 'section' &&
      (!widest || node.textValue.length > widest.textValue.length)
        ? node
        : widest,
    undefined
  )?.key;
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

/**
 * Offset of `listRef`'s element from the top of the scroll element's content,
 * which is where the virtualizer's first row starts. Re-measured when an
 * element in the scroll element resizes, mounts or unmounts: content above the
 * list, such as another list sharing the scroll element, can change without
 * this list rendering.
 */
function useListOffset({
  enabled,
  listRef,
  scrollRef,
}: {
  enabled: boolean;
  scrollRef: React.RefObject<HTMLElement | null>;
  listRef?: React.RefObject<HTMLElement | null>;
}) {
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    const list = listRef?.current;
    if (!enabled || !scrollElement || !list) {
      return () => {};
    }
    const measure = () => setOffset(getOffsetInScrollContent(list, scrollElement));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return () => {};
    }
    const resizeObserver = new ResizeObserver(measure);
    const observeChildren = () => {
      resizeObserver.disconnect();
      for (const child of scrollElement.children) {
        resizeObserver.observe(child);
      }
    };
    observeChildren();
    const mutationObserver = new MutationObserver(() => {
      observeChildren();
      measure();
    });
    mutationObserver.observe(scrollElement, {childList: true});
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [enabled, scrollRef, listRef]);

  return offset;
}

function getOffsetInScrollContent(element: Element, scrollElement: Element) {
  return (
    element.getBoundingClientRect().top -
    scrollElement.getBoundingClientRect().top -
    scrollElement.clientTop +
    scrollElement.scrollTop
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
  /** Keys of items to leave out. A section is left out when all of its items are. */
  hiddenKeys?: ReadonlySet<Key>;
  /**
   * The element the rows and spacers render directly inside. Its offset in the
   * scroll element's content is measured, so content that scrolls above the
   * rows, such as padding or other lists sharing the scroll element, keeps the
   * rows where the virtualizer places them. Defaults to the scroll element.
   */
  listRef?: React.RefObject<HTMLElement | null>;
  /**
   * Rows to keep mounted wherever the list is scrolled. Pin the row with the
   * longest label, so a list that sizes its width to its content is as wide as
   * that row from the start instead of widening as wider rows scroll into
   * view. Pin rows that code finds in the DOM, such as the first option, so
   * it finds them while they are scrolled out of view.
   */
  pinnedKeys?: ReadonlyArray<Key | null | undefined>;
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
 * Spacers keep the list's own element intact, so a virtualized
 * list has the same DOM structure and styling as a regular one.
 */
export function useVirtualCollection<T>({
  collection,
  enabled,
  scrollRef,
  estimateSize,
  focusedKey,
  hiddenKeys,
  listRef,
  sectionRowSpace = 0,
  size = 'md',
  pinnedKeys = [],
}: UseVirtualCollectionOptions<T>): VirtualCollection<T> {
  const nodes = flattenSections(collection, hiddenKeys);
  const focusedIndex =
    enabled && focusedKey !== null && focusedKey !== undefined
      ? nodes.findIndex(node => node.key === focusedKey)
      : -1;
  const pinnedKeySet = new Set(enabled ? pinnedKeys : []);
  const pinnedIndexes = nodes.flatMap((node, index) =>
    pinnedKeySet.has(node.key) ? [index] : []
  );
  const sectionIndexes = getSectionIndexes(nodes);
  const scrollMargin = useListOffset({enabled, listRef, scrollRef});

  // Keep the focused row mounted when it scrolls out of view. If it unmounted,
  // DOM focus would fall back to the body and keyboard navigation would stop.
  // Also keep the pinned rows and the section row of every mounted row, since
  // the section's element wraps its children.
  const rangeExtractor = (range: Range) =>
    getMountedIndexes({
      windowIndexes: defaultRangeExtractor(range),
      focusedIndex,
      pinnedIndexes,
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
    scrollMargin,
    overscan: 1,
    rangeExtractor,
    observeElementRect: observeViewportCappedRect,
  });

  // Keyboard navigation can move focus to a row far out of view. Scroll to it,
  // and React Aria then scrolls the mounted row fully into view. Pointer focus
  // follows the hovered row, which is already visible, so scrolling would only
  // fight it.
  //
  // This scrolls to an offset rather than with `scrollToIndex`, which assumes
  // the list fills its scroll element: it scrolls to the scroll element's end
  // for the last row, past any list below this one, and keeps scrolling back to
  // that end for seconds afterwards whenever the content height changes.
  useEffect(() => {
    if (focusedIndex === -1 || getInteractionModality() === 'pointer') {
      return;
    }
    const item = virtualizer.measurementsCache[focusedIndex];
    if (!item) {
      return;
    }
    const viewportStart = virtualizer.scrollOffset ?? 0;
    const viewportEnd = viewportStart + (virtualizer.scrollRect?.height ?? 0);
    if (item.start < viewportStart) {
      virtualizer.scrollToOffset(item.start, {align: 'start'});
    } else if (item.end > viewportEnd) {
      virtualizer.scrollToOffset(item.end, {align: 'end'});
    }
  }, [focusedIndex, virtualizer]);

  const rows: Array<VirtualRow<T>> = enabled
    ? virtualItems.flatMap((item, position) => {
        const node = nodes[item.index];
        if (!node) {
          return [];
        }
        const previousEnd = virtualItems[position - 1]?.end ?? scrollMargin;
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
    spaceAfter: enabled
      ? Math.max(0, totalSize - ((last?.end ?? scrollMargin) - scrollMargin))
      : 0,
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
