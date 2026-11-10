import type * as React from 'react';
import {memo, useCallback, useLayoutEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {useSeparator} from '@react-aria/separator';
import type {TreeState} from '@react-stately/tree';
import type {Key, Node} from '@react-types/shared';

import {Stack} from '@sentry/scraps/layout';
import {
  SECTION_ITEM_SPACE,
  SectionGroup,
  SectionList,
  SectionSeparator,
} from '@sentry/scraps/menu';
import {
  estimateRowHeight,
  useVirtualCollection,
  VirtualRows,
  type VirtualRowProps,
} from '@sentry/scraps/useVirtualCollection';

import type {MenuItemProps} from './item';
import {DropdownMenuItem} from './item';
import type {DropdownMenuListProps} from './list';
import {DropdownMenuSection} from './section';
import {DropdownSubmenu} from './submenu';

type DropdownMenuCollectionProps = {
  closeOnSelect: boolean;
  /** Top-level nodes of the menu, in order. */
  collection: Array<Node<MenuItemProps>>;
  onClose: DropdownMenuListProps['onClose'];
  separatorProps: ReturnType<typeof useSeparator>['separatorProps'];
  state: TreeState<MenuItemProps>;
  disableTextSelection?: boolean;
  size?: MenuItemProps['size'];
};

interface DropdownMenuCollectionItemProps extends Omit<
  DropdownMenuCollectionProps,
  'collection' | 'separatorProps'
> {
  node: Node<MenuItemProps>;
  /** Whether the menu is virtualized, see `DropdownMenuItem`. */
  isVirtualized?: boolean;
  /**
   * Measurement props for the item's row when the menu is virtualized, passed
   * as separate values rather than a `VirtualRowProps` object. The virtualizer
   * builds a new object on every scroll, which would re-render every mounted
   * row. With stable values, a row that did not change is not re-rendered.
   */
  rowIndex?: number;
  rowRef?: VirtualRowProps['ref'];
}

/**
 * Memoized, so a row whose props did not change is skipped when the
 * virtualizer re-renders `DropdownMenuRows` on scroll.
 */
const DropdownMenuCollectionItem = memo(function DropdownMenuCollectionItem({
  node,
  isVirtualized,
  rowIndex,
  rowRef,
  closeOnSelect,
  disableTextSelection,
  onClose,
  size,
  state,
}: DropdownMenuCollectionItemProps): React.ReactNode {
  const rowProps: VirtualRowProps | undefined =
    rowIndex === undefined || rowRef === undefined
      ? undefined
      : {'data-index': rowIndex, ref: rowRef};

  if (node.value?.submenu) {
    if (!node.value.children) {
      return null;
    }

    return (
      <DropdownSubmenu
        items={node.value.children}
        node={node}
        isVirtualized={isVirtualized}
        rowProps={rowProps}
        state={state}
        onClose={onClose}
        closeOnSelect={closeOnSelect}
        disableTextSelection={disableTextSelection}
        size={size}
      />
    );
  }

  return (
    <DropdownMenuItem
      node={node}
      isVirtualized={isVirtualized}
      rowProps={rowProps}
      state={state}
      onClose={onClose}
      closeOnSelect={closeOnSelect}
    />
  );
});

/** Height (px) of `DropdownMenuSeparator`, also used to estimate unmounted rows. */
const SEPARATOR_HEIGHT = 8;

function DropdownMenuSeparator({
  separatorProps,
}: {
  separatorProps: DropdownMenuCollectionProps['separatorProps'];
}) {
  return (
    <Stack
      justify="center"
      height={`${SEPARATOR_HEIGHT}px`}
      padding="0 lg 0 xl"
      {...separatorProps}
      role="presentation"
    >
      <SectionSeparator />
    </Stack>
  );
}

interface DropdownMenuRowsProps extends DropdownMenuCollectionProps {
  /** Whether the menu's width has been locked, see `onLockWidth`. */
  isWidthLocked: boolean;
  /** The menu's scroll element. */
  menuRef: React.RefObject<HTMLUListElement | null>;
  /** Called once with the width to keep for a virtualized menu. */
  onLockWidth: (width: number) => void;
  virtualized: boolean;
  /** A row to keep mounted, so the menu's width fits it. */
  widestKey: Key | undefined;
}

/**
 * Renders a menu's rows, with each item in its section. A regular menu passes
 * every node as a row, a virtualized one only the mounted rows, so both render
 * the same tree and nothing remounts when a menu crosses its threshold.
 *
 * A separator goes between a section and whatever is next to it. It renders
 * inside a measured row, either the section's own row or the row of the item
 * after a section, so it is part of the virtualized scroll offsets.
 */
export function DropdownMenuRows({
  collection,
  separatorProps,
  isWidthLocked,
  menuRef,
  onLockWidth,
  virtualized,
  widestKey,
  ...itemProps
}: DropdownMenuRowsProps) {
  const theme = useTheme();
  const size = itemProps.size ?? 'md';
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

  // Estimates rows the way they render below: a separator is part of every
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

  // The virtualizer re-renders the component that calls it on every scroll.
  // Calling it here, rather than in `DropdownMenuList`, keeps those re-renders
  // to the rows: the list's state and handlers keep their identity, so a row
  // that did not change is not re-rendered.
  const virtual = useVirtualCollection({
    collection,
    enabled: virtualized,
    estimateSize,
    scrollRef: menuRef,
    focusedKey: itemProps.state.selectionManager.focusedKey,
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

  return (
    <VirtualRows
      virtual={virtual}
      renderRow={({node, props}) =>
        itemsAfterSections.has(node.key) ? (
          <SectionGroup role="presentation" {...props}>
            <DropdownMenuSeparator separatorProps={separatorProps} />
            <SectionList>
              <DropdownMenuCollectionItem
                node={node}
                isVirtualized={virtualized}
                {...itemProps}
              />
            </SectionList>
          </SectionGroup>
        ) : (
          <DropdownMenuCollectionItem
            node={node}
            isVirtualized={virtualized}
            rowIndex={props?.['data-index']}
            rowRef={props?.ref}
            {...itemProps}
          />
        )
      }
      renderSection={(section, rows) => (
        <DropdownMenuSection
          node={section.node}
          rowProps={section.props}
          separator={
            section.node.key !== collection[0]?.key && (
              <DropdownMenuSeparator separatorProps={separatorProps} />
            )
          }
        >
          {rows}
        </DropdownMenuSection>
      )}
    />
  );
}
