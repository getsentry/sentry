import {Fragment, useEffect, useMemo} from 'react';
import {getInteractionModality} from '@react-aria/interactions';
import type {useSeparator} from '@react-aria/separator';
import type {TreeState} from '@react-stately/tree';
import type {Key, Node} from '@react-types/shared';

import {Container} from '@sentry/scraps/layout';

import {useVirtualRows} from 'sentry/components/tables/useVirtualRows';

import type {MenuItemProps} from './item';
import {DropdownMenuItem} from './item';
import {DropdownMenuSection, DropdownMenuSeparator} from './section';

/**
 * Virtualized rendering for `DropdownMenuList`. Only the rows inside the
 * scroll viewport render, which keeps menus with hundreds of items fast to
 * open and hover.
 *
 * Limitations:
 * - Items cannot open nested sub-menus. `canVirtualizeMenu` falls back to the
 *   regular collection when they do.
 * - Hidden rows cannot size the menu, so callers should set `maxWidth` and
 *   `maxHeight`.
 */

type VirtualRow =
  | {section: Node<MenuItemProps>; type: 'heading'}
  | {
      hasGapAfter: boolean;
      node: Node<MenuItemProps>;
      type: 'item';
      section?: Node<MenuItemProps>;
    }
  | {type: 'separator'};

const VIRTUAL_ROW_HEIGHT_ESTIMATES = {
  heading: 36,
  item: 32,
  separator: 8,
} satisfies Record<VirtualRow['type'], number>;

function countMenuItems(items: MenuItemProps[]): number {
  return items.reduce(
    (count, item) => count + (item.children && !item.submenu ? item.children.length : 1),
    0
  );
}

/**
 * Whether any item, at the top level or inside a section, opens a sub-menu.
 */
export function hasSubmenuItems(items: MenuItemProps[]): boolean {
  return items.some(item =>
    item.submenu ? true : (item.children?.some(child => child.submenu) ?? false)
  );
}

/**
 * Whether a menu should render only its visible rows. Menus with nested
 * sub-menus never virtualize, because a sub-menu trigger must stay mounted to
 * keep its sub-menu open.
 */
export function canVirtualizeMenu(
  items: MenuItemProps[],
  virtualizeThreshold: number | undefined
): boolean {
  return (
    virtualizeThreshold !== undefined &&
    countMenuItems(items) > virtualizeThreshold &&
    !hasSubmenuItems(items)
  );
}

/**
 * Flattens the collection into the rows that `DropdownMenuCollection` renders,
 * so the virtualizer can measure and position each one.
 */
function getVirtualRows(collection: Array<Node<MenuItemProps>>): VirtualRow[] {
  return collection.flatMap((node, i): VirtualRow[] => {
    const rows: VirtualRow[] = [];
    if (node.type === 'section') {
      if (node.rendered) {
        rows.push({type: 'heading', section: node});
      }
      const children = [...node.childNodes];
      children.forEach((child, childIndex) =>
        rows.push({
          type: 'item',
          node: child,
          section: node,
          hasGapAfter: childIndex < children.length - 1,
        })
      );
    } else {
      rows.push({type: 'item', node, hasGapAfter: false});
    }

    const next = collection[i + 1];
    if (next && (node.type === 'section' || next.type === 'section')) {
      rows.push({type: 'separator'});
    }
    return rows;
  });
}

function isMenuItemWithKey(element: EventTarget | null, key: Key | undefined) {
  return (
    key !== undefined &&
    element instanceof HTMLElement &&
    element.dataset.key === `${key}`
  );
}

interface UseVirtualMenuOptions {
  collection: Array<Node<MenuItemProps>>;
  enabled: boolean;
  menuRef: React.RefObject<HTMLUListElement | null>;
  state: TreeState<MenuItemProps>;
}

/**
 * Virtualizes a menu's rows and replaces the keyboard helpers that rely on
 * every item being rendered.
 */
export function useVirtualMenu({
  collection,
  enabled,
  menuRef,
  state,
}: UseVirtualMenuOptions) {
  const rows = useMemo(
    () => (enabled ? getVirtualRows(collection) : []),
    [enabled, collection]
  );
  const {virtualizer, virtualItems, paddingTop, paddingBottom} = useVirtualRows({
    count: rows.length,
    enabled,
    getScrollElement: () => menuRef.current,
    estimateSize: index => VIRTUAL_ROW_HEIGHT_ESTIMATES[rows[index]?.type ?? 'item'],
  });
  const enabledKeys = useMemo(
    () =>
      rows.flatMap(row =>
        row.type === 'item' && !state.disabledKeys.has(row.node.key) ? [row.node.key] : []
      ),
    [rows, state.disabledKeys]
  );

  // React Aria cannot scroll to rows that are not rendered, so follow keyboard
  // focus here. Pointer focus only reaches rendered rows.
  const {focusedKey, isFocused} = state.selectionManager;
  useEffect(() => {
    if (
      !enabled ||
      !isFocused ||
      focusedKey === null ||
      getInteractionModality() !== 'keyboard'
    ) {
      return;
    }
    const index = rows.findIndex(
      row => row.type === 'item' && row.node.key === focusedKey
    );
    if (index !== -1) {
      virtualizer.scrollToIndex(index, {align: 'auto'});
    }
  }, [enabled, isFocused, focusedKey, rows, virtualizer]);

  return {
    collectionProps: {
      rows,
      virtualItems,
      paddingTop,
      paddingBottom,
      measureElement: virtualizer.measureElement,
    },
    // Not every item is rendered, so compare keys instead of elements. Read the
    // key from the element, because React Aria moves the focused key before the
    // menu's key handler runs.
    isFirstEnabledItem: (element: EventTarget | null) =>
      isMenuItemWithKey(element, enabledKeys[0]),
    isLastEnabledItem: (element: EventTarget | null) =>
      isMenuItemWithKey(element, enabledKeys.at(-1)),
    focusFirstEnabledItem: () => {
      const firstKey = enabledKeys[0];
      if (firstKey === undefined || !menuRef.current) {
        return;
      }
      // The first item renders once the list scrolls back to the top, then
      // focuses itself because it is the focused key.
      menuRef.current.scrollTop = 0;
      state.selectionManager.setFocused(true);
      state.selectionManager.setFocusedKey(firstKey);
    },
  };
}

type VirtualCollectionProps = ReturnType<typeof useVirtualMenu>['collectionProps'] & {
  closeOnSelect: boolean;
  onClose: (() => void) | undefined;
  separatorProps: ReturnType<typeof useSeparator>['separatorProps'];
  state: TreeState<MenuItemProps>;
};

type IndexedVirtualRow = {index: number; row: VirtualRow};

/**
 * Renders the visible rows, wrapping rows that belong to a section in that
 * section's group so it keeps its menu semantics.
 */
export function DropdownMenuVirtualCollection({
  rows,
  virtualItems,
  paddingTop,
  paddingBottom,
  measureElement,
  separatorProps,
  closeOnSelect,
  onClose,
  state,
}: VirtualCollectionProps) {
  // Visible rows are contiguous, so each section appears in at most one segment.
  const segments: Array<{rows: IndexedVirtualRow[]; section?: Node<MenuItemProps>}> = [];
  for (const {index} of virtualItems) {
    const row = rows[index];
    if (!row) {
      continue;
    }
    const section = row.type === 'separator' ? undefined : row.section;
    const segment = segments.at(-1);
    if (section && segment?.section === section) {
      segment.rows.push({index, row});
    } else {
      segments.push({section, rows: [{index, row}]});
    }
  }

  const renderRow = ({index, row}: IndexedVirtualRow) => {
    if (row.type === 'heading') {
      // Rendered by its section.
      return null;
    }
    if (row.type === 'separator') {
      return (
        <DropdownMenuSeparator
          key={`separator-${index}`}
          ref={measureElement}
          data-index={index}
          separatorProps={separatorProps}
        />
      );
    }
    return (
      <Container
        key={row.node.key}
        ref={measureElement}
        data-index={index}
        as="li"
        role="presentation"
        paddingBottom={row.hasGapAfter ? '2xs' : undefined}
      >
        <DropdownMenuItem
          renderAs="div"
          node={row.node}
          state={state}
          onClose={onClose}
          closeOnSelect={closeOnSelect}
        />
      </Container>
    );
  };

  return (
    <Fragment>
      {paddingTop > 0 && (
        <Container as="li" role="presentation" height={`${paddingTop}px`} />
      )}
      {segments.map(segment => {
        if (!segment.section) {
          return segment.rows.map(renderRow);
        }
        const heading = segment.rows.find(({row}) => row.type === 'heading');
        return (
          <DropdownMenuSection
            key={segment.section.key}
            node={segment.section}
            virtualHeadingProps={
              heading ? {ref: measureElement, 'data-index': heading.index} : null
            }
          >
            {segment.rows.map(renderRow)}
          </DropdownMenuSection>
        );
      })}
      {paddingBottom > 0 && (
        <Container as="li" role="presentation" height={`${paddingBottom}px`} />
      )}
    </Fragment>
  );
}
