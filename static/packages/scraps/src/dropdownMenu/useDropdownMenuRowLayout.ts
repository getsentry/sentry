import type * as React from 'react';
import {useCallback, useLayoutEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {Key, Node} from '@react-types/shared';

import {SECTION_ITEM_SPACE} from '@sentry/scraps/menu';
import {
  estimateRowHeight,
  useVirtualCollection,
} from '@sentry/scraps/useVirtualCollection';

import type {MenuItemProps} from './item';
import {SEPARATOR_HEIGHT} from './separator';

interface UseDropdownMenuRowLayoutOptions {
  /** Top-level nodes of the menu, in order. */
  collection: Array<Node<MenuItemProps>>;
  /** The focused item, kept mounted by the virtualizer. */
  focusedKey: Key | null;
  /** Whether the menu's width has been locked, see `onLockWidth`. */
  isWidthLocked: boolean;
  /** The menu's scroll element. */
  menuRef: React.RefObject<HTMLUListElement | null>;
  /** Called once with the width to keep for a virtualized menu. */
  onLockWidth: (width: number) => void;
  size: NonNullable<MenuItemProps['size']>;
  virtualized: boolean;
  /** A row to keep mounted, so the menu's width fits it. */
  widestKey: Key | undefined;
}

/**
 * Lays out the rows of `DropdownMenuRows`: estimates each row's height,
 * virtualizes the rows when the menu is long, and locks the width of a
 * virtualized menu so it does not change while scrolling.
 */
export function useDropdownMenuRowLayout({
  collection,
  focusedKey,
  isWidthLocked,
  menuRef,
  onLockWidth,
  size,
  virtualized,
  widestKey,
}: UseDropdownMenuRowLayoutOptions) {
  const theme = useTheme();
  // The space above each item of a section but the first, see `DropdownMenuSection`.
  const sectionRowSpace = parseFloat(theme.space[SECTION_ITEM_SPACE]);

  // Top-level items right after a section. Their row starts with a separator.
  const itemsAfterSections = useMemo(
    () =>
      new Set(
        collection
          .filter((_, index) => collection[index - 1]?.type === 'section')
          .map(node => node.key)
      ),
    [collection]
  );

  const sectionsByKey = useMemo(
    () =>
      new Map(
        collection.filter(node => node.type === 'section').map(node => [node.key, node])
      ),
    [collection]
  );

  // Estimates rows the way `DropdownMenuRows` renders them: a separator is part of every
  // section's row except the first one's, and of the row of an item right after
  // a section. A section's row also holds its heading, if it has one.
  const estimateSize = useCallback(
    (node: Node<MenuItemProps>) => {
      if (node.type === 'section') {
        const separator = node.key === collection[0]?.key ? 0 : SEPARATOR_HEIGHT;
        const heading = node.rendered
          ? estimateRowHeight(node, undefined, size, sectionRowSpace)
          : 0;
        return separator + heading;
      }
      const section =
        node.parentKey === null || node.parentKey === undefined
          ? undefined
          : sectionsByKey.get(node.parentKey);
      const height = estimateRowHeight(node, section, size, sectionRowSpace);
      return itemsAfterSections.has(node.key) ? height + SEPARATOR_HEIGHT : height;
    },
    [collection, itemsAfterSections, sectionsByKey, size, sectionRowSpace]
  );

  const virtual = useVirtualCollection({
    collection,
    enabled: virtualized,
    estimateSize,
    scrollRef: menuRef,
    focusedKey,
    sectionRowSpace,
    size,
    widestKey,
  });

  // A virtualized menu only mounts some of its rows, so its natural width would
  // change as rows scroll in and out. Measure it once, when the `widestKey` row
  // has mounted, and keep that width until the menu closes, including while a
  // search filters the items. A label that does not fit is truncated.
  //
  // The virtualizer mounts no rows on its first render, so measuring earlier
  // would lock the width of an empty list. Measure the rows' own width
  // (`max-content`) rather than the menu's current one, which its container
  // may still be squeezing before the overlay is positioned.
  const isWidestRowMounted = virtual.rows.some(row => row.node.key === widestKey);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!virtualized || !isWidestRowMounted || isWidthLocked || !menu) {
      return;
    }
    const {width} = menu.style;
    menu.style.width = 'max-content';
    // Round up, so a fractional width does not cut off the widest label.
    onLockWidth(Math.ceil(menu.getBoundingClientRect().width));
    menu.style.width = width;
  }, [virtualized, isWidestRowMounted, isWidthLocked, menuRef, onLockWidth]);

  return {itemsAfterSections, virtual};
}
