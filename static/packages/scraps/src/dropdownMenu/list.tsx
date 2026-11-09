import type * as React from 'react';
import {useCallback, useContext, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTheme, css} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import type {AriaMenuOptions} from '@react-aria/menu';
import {useMenu, useMenuTrigger} from '@react-aria/menu';
import {useSeparator} from '@react-aria/separator';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {TreeProps, TreeState} from '@react-stately/tree';
import {useTreeState} from '@react-stately/tree';
import type {Key, Node} from '@react-types/shared';

import {Container, Stack} from '@sentry/scraps/layout';
import {useResolveLinkHref} from '@sentry/scraps/link/linkBehaviorContext';
import {
  calculateMenuMinHeight,
  Header,
  ReserveLeadingSlot,
  Search,
  SECTION_ITEM_SPACE,
  SectionGroup,
  SectionList,
  SectionSeparator,
  Title,
} from '@sentry/scraps/menu';
import {Overlay, PositionWrapper} from '@sentry/scraps/overlay';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';
import {useOverlay} from '@sentry/scraps/useOverlay';
import {
  DEFAULT_VIRTUALIZE_THRESHOLD,
  flattenSections,
  useVirtualCollection,
  VirtualRows,
  type VirtualRowProps,
} from '@sentry/scraps/useVirtualCollection';

import type {OverlayState} from './context';
import {DropdownMenuContext} from './context';
import type {
  DropdownMenuContentSizeOptions,
  DropdownMenuSearchOptions,
  MenuItemProps,
} from './item';
import {DropdownMenuItem} from './item';
import {DropdownMenuSection} from './section';
import {useSafetyTriangle} from './useSafetyTriangle';

export interface DropdownMenuListProps
  extends
    Omit<
      AriaMenuOptions<MenuItemProps>,
      | 'selectionMode'
      | 'selectedKeys'
      | 'defaultSelectedKeys'
      | 'onSelectionChange'
      | 'disallowEmptySelection'
    >,
    TreeProps<MenuItemProps>,
    DropdownMenuContentSizeOptions {
  overlayPositionProps: React.HTMLAttributes<HTMLDivElement>;
  /**
   * The open state of the current overlay that contains this menu
   */
  overlayState: OverlayState;
  /**
   * Whether the menu should close when an item has been clicked/selected
   */
  closeOnSelect?: boolean;
  /**
   * Prevent users from highlighting text inside the menu.
   */
  disableTextSelection?: boolean;
  emptyMessage?: React.ReactNode;
  /**
   * To be displayed below the menu items
   */
  menuFooter?: React.ReactNode;
  /**
   * Title to display on top of the menu
   */
  menuTitle?: React.ReactNode;
  /** Controlled input state supplied by DropdownMenuContent. */
  searchState?: DropdownMenuSearchOptions & {
    onChange: (value: string) => void;
    value: string;
  };
  size?: MenuItemProps['size'];
  /**
   * Number of items, counting the items inside sections, above which only the
   * items near the viewport are rendered. Submenus inherit the threshold of
   * their parent menu. Pass `Infinity` to never virtualize.
   * @default 150
   */
  virtualizeThreshold?: number;
  /**
   * Style overrides applied to the position wrapper. Useful for overriding
   * the default z-index (e.g. when the menu is inside a high z-index container
   * like a sidebar).
   */
  zIndex?: number;
}

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
  /**
   * Measurement props for the item's row when the menu is virtualized, passed
   * as separate values rather than a `VirtualRowProps` object. The virtualizer
   * builds a new object on every scroll, which would re-render every mounted
   * row. With stable values, a row that did not change is not re-rendered.
   */
  rowIndex?: number;
  rowRef?: VirtualRowProps['ref'];
}

function DropdownMenuCollectionItem({
  node,
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
      rowProps={rowProps}
      state={state}
      onClose={onClose}
      closeOnSelect={closeOnSelect}
    />
  );
}

function DropdownMenuSeparator({
  separatorProps,
}: {
  separatorProps: DropdownMenuCollectionProps['separatorProps'];
}) {
  return (
    <Stack
      justify="center"
      height="8px"
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
function DropdownMenuRows({
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
  // The virtualizer re-renders the component that calls it on every scroll.
  // Calling it here, rather than in `DropdownMenuList`, keeps those re-renders
  // to the rows: the list's state and handlers keep their identity, so a row
  // that did not change is not re-rendered.
  const virtual = useVirtualCollection({
    collection,
    enabled: virtualized,
    size: itemProps.size ?? 'md',
    scrollRef: menuRef,
    focusedKey: itemProps.state.selectionManager.focusedKey,
    widestKey,
    // The space items in a section get from `spaceAbove`.
    sectionRowSpace: parseFloat(theme.space[SECTION_ITEM_SPACE]),
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

  const itemsAfterSections = useMemo(
    () =>
      new Set(
        collection
          .filter((_, index) => collection[index - 1]?.type === 'section')
          .map(node => node.key)
      ),
    [collection]
  );

  return (
    <VirtualRows
      virtual={virtual}
      renderRow={({node, props}) =>
        itemsAfterSections.has(node.key) ? (
          <SectionGroup role="presentation" {...props}>
            <DropdownMenuSeparator separatorProps={separatorProps} />
            <SectionList>
              <DropdownMenuCollectionItem node={node} {...itemProps} />
            </SectionList>
          </SectionGroup>
        ) : (
          <DropdownMenuCollectionItem
            node={node}
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

function DropdownMenuList({
  closeOnSelect = true,
  onClose,
  size,
  menuTitle,
  emptyMessage,
  maxHeight,
  maxWidth,
  menuFooter,
  searchState,
  disableTextSelection,
  overlayState,
  overlayPositionProps,
  zIndex,
  virtualizeThreshold,
  ...props
}: DropdownMenuListProps) {
  const {t} = useTranslation();
  const theme = useTheme();
  const {rootOverlayState, parentMenuState} = useContext(DropdownMenuContext);
  const safetyTriangle = useSafetyTriangle();
  const state = useTreeState<MenuItemProps>({...props, selectionMode: 'single'});
  const stateCollection = useMemo(() => [...state.collection], [state.collection]);
  const flatNodes = useMemo(() => flattenSections(stateCollection), [stateCollection]);
  const items = useMemo(
    () => flatNodes.filter(node => node.type !== 'section'),
    [flatNodes]
  );
  // The keys keyboard focus can reach, in order. Disabled items are skipped, so
  // the first and last keys are the first and last focusable items. Matches the
  // rule CompactSelect uses for its ArrowUp/Down region handoff.
  const focusableKeys = useMemo(
    () =>
      items
        .filter(node => node.type === 'item' && !state.disabledKeys.has(node.key))
        .map(node => String(node.key)),
    [items, state.disabledKeys]
  );
  const hasLeadingItems = items.some(
    node => node.value?.leadingItems || node.value?.isSelected !== undefined
  );
  const virtualized =
    items.length > (virtualizeThreshold ?? DEFAULT_VIRTUALIZE_THRESHOLD);

  // Implement focus states, keyboard navigation, aria-label,...
  const menuRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const {menuProps} = useMenu({...props, selectionMode: 'single'}, state, menuRef);
  const {separatorProps} = useSeparator({elementType: 'li'});

  // The menu sizes its width to its rows. Keep the item with the longest label
  // mounted, so a virtualized menu does not widen while scrolling.
  const widestKey = useMemo(
    () =>
      virtualized
        ? items.reduce<Node<MenuItemProps> | undefined>(
            (widest, node) =>
              !widest || node.textValue.length > widest.textValue.length ? node : widest,
            undefined
          )?.key
        : undefined,
    [items, virtualized]
  );
  // The width a virtualized menu keeps until it closes, see `DropdownMenuRows`.
  const [lockedWidth, setLockedWidth] = useState<number>();

  /**
   * Moves focus to an item by key. Items outside a virtualized window are not
   * mounted, so focus goes through the selection manager: the list scrolls the
   * item into view and React Aria focuses it once it mounts.
   */
  const focusItem = (key: Key | undefined) => {
    if (key === undefined) {
      return;
    }
    const element = menuRef.current?.querySelector<HTMLElement>(
      `[data-key="${CSS.escape(String(key))}"]`
    );
    if (element) {
      element.focus();
      return;
    }
    state.selectionManager.setFocused(true);
    state.selectionManager.setFocusedKey(key);
  };

  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
      // Read from the collection rather than the DOM, since a virtualized menu
      // only mounts some of its items. The key comes from the event target:
      // React Aria has already moved focusedKey to the next item by now.
      const targetKey = getMenuItemKey(e.target);
      // When keyboard navigation wraps past the last item, show the top of the
      // list again so the search field and first item are visible.
      if (
        e.key === 'ArrowDown' &&
        searchRef.current &&
        menuRef.current &&
        targetKey !== undefined &&
        targetKey === focusableKeys.at(-1)
      ) {
        menuRef.current.scrollTop = 0;
      }
      // Move from the first enabled item back to search before leaving the submenu.
      if (
        e.key === 'ArrowUp' &&
        searchRef.current &&
        menuRef.current &&
        targetKey !== undefined &&
        targetKey === focusableKeys[0]
      ) {
        e.preventDefault();
        menuRef.current.scrollTop = 0;
        searchRef.current.focus();
        return;
      }
      // ArrowLeft closes a submenu, but leaves the root menu open.
      if (e.key === 'ArrowLeft' && parentMenuState) {
        parentMenuState.selectionManager.clearSelection();
        return;
      }
      e.continuePropagation();
    },
  });

  /**
   * Whether this menu/submenu is the current focused one, which in a nested,
   * tree-like menu system should be the leaf submenu. This information is
   * used for controlling keyboard events. See ``modifiedMenuProps` below.
   */
  const hasFocus = useMemo(() => {
    // A submenu is a leaf when it does not contain any expanded submenu. This
    // logically follows from the tree-like structure and single-selection
    // nature of menus.
    const isLeafSubmenu = !stateCollection.some(node => {
      const isSection = node.hasChildNodes && !node.value?.submenu;
      // A submenu with key [key] is expanded if
      // state.selectionManager.isSelected([key]) = true
      return isSection
        ? [...node.childNodes].some(child =>
            state.selectionManager.isSelected(`${child.key}`)
          )
        : state.selectionManager.isSelected(`${node.key}`);
    });

    return isLeafSubmenu;
  }, [stateCollection, state.selectionManager]);

  // Menu props from useMenu, modified to disable keyboard events if the
  // current menu does not have focus.
  const modifiedMenuProps = useMemo(
    () => ({
      ...menuProps,
      ...(!hasFocus && {
        onKeyUp: () => null,
        onKeyDown: () => null,
      }),
    }),
    [menuProps, hasFocus]
  );

  const contextValue = useMemo(
    () => ({
      rootOverlayState: rootOverlayState ?? overlayState,
      parentMenuState: state,
      safetyTriangle,
      virtualizeThreshold,
    }),
    [rootOverlayState, overlayState, state, safetyTriangle, virtualizeThreshold]
  );
  const searchInput = searchState && (
    <Search
      ref={searchRef}
      padding={menuTitle ? '0' : undefined}
      aria-label={searchState.placeholder ?? 'Search'}
      placeholder={searchState.placeholder ?? 'Search…'}
      value={searchState.value}
      onChange={event => searchState.onChange(event.target.value)}
      onKeyDown={event => {
        // ArrowDown moves from the search field into the filtered menu items.
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusItem(focusableKeys[0]);
        }
      }}
    />
  );
  const showEmptyMessage = Boolean(
    searchState?.value.trim() && stateCollection.length === 0
  );
  return (
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper
        zIndex={zIndex === undefined ? theme.zIndex.dropdown : Number(zIndex)}
        {...overlayPositionProps}
      >
        <DropdownMenuContext value={contextValue}>
          <Stack>
            {stackProps => (
              <Overlay
                {...stackProps}
                onKeyDownCapture={event => {
                  // Handle Escape before React Aria closes the entire menu tree.
                  if (event.key === 'Escape' && parentMenuState && hasFocus) {
                    event.stopPropagation();
                    // Let the IME cancel composition without dismissing the submenu.
                    if (event.nativeEvent.isComposing) {
                      return;
                    }
                    event.preventDefault();
                    parentMenuState.selectionManager.clearSelection();
                  }
                }}
                style={{
                  // Cap the requested height by the space available to the overlay.
                  // That space is only known once the overlay is positioned. Until
                  // then, cap a virtualized menu by the viewport: unbounded, its
                  // list would be as tall as all of its rows, and the virtualizer
                  // would mount every one of them.
                  maxHeight: calculateMenuMinHeight(
                    maxHeight,
                    overlayPositionProps.style?.maxHeight ??
                      (virtualized ? '100vh' : undefined)
                  ),
                  maxWidth:
                    maxWidth === undefined
                      ? '100%'
                      : `min(${typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth}, 100%)`,
                }}
              >
                {menuTitle && (
                  <Header padding={searchState ? 'xs' : 'sm lg'}>
                    <Title padding={searchState ? 'sm lg' : undefined}>{menuTitle}</Title>
                    {searchInput}
                  </Header>
                )}
                {!menuTitle && searchInput}
                <DropdownMenuListWrap
                  as="ul"
                  ref={menuRef}
                  disableTextSelection={disableTextSelection}
                  flexGrow={showEmptyMessage ? 1 : undefined}
                  width={lockedWidth === undefined ? undefined : `${lockedWidth}px`}
                  // The overlay's `maxWidth` still applies to the locked width.
                  maxWidth={lockedWidth === undefined ? undefined : '100%'}
                  {...mergeProps(modifiedMenuProps, keyboardProps)}
                >
                  <ReserveLeadingSlot reserve={hasLeadingItems}>
                    <DropdownMenuRows
                      collection={stateCollection}
                      isWidthLocked={lockedWidth !== undefined}
                      menuRef={menuRef}
                      onLockWidth={setLockedWidth}
                      virtualized={virtualized}
                      widestKey={widestKey}
                      closeOnSelect={closeOnSelect}
                      disableTextSelection={disableTextSelection}
                      onClose={onClose}
                      separatorProps={separatorProps}
                      size={size}
                      state={state}
                    />
                  </ReserveLeadingSlot>
                  {showEmptyMessage && (
                    <Stack
                      as="li"
                      role="presentation"
                      align="center"
                      justify="center"
                      flexGrow={1}
                      padding="md lg"
                    >
                      <Text variant="muted">{emptyMessage ?? t('No results found')}</Text>
                    </Stack>
                  )}
                </DropdownMenuListWrap>
                {menuFooter}
              </Overlay>
            )}
          </Stack>
        </DropdownMenuContext>
      </PositionWrapper>
    </FocusScope>
  );
}

// react-aria uses the href prop on item state to determine if the item is a link
// and will navigate there when selected

/**
 * Recursively removes hidden items, including those nested in submenus
 * Apply href to items that have a to or externalHref prop
 */
function removeHiddenItemsAndSetHref(
  source: MenuItemProps[],
  resolveHref: ReturnType<typeof useResolveLinkHref>
): MenuItemProps[] {
  return source
    .filter(item => !item.hidden)
    .map(item => {
      const href = item.to ? resolveHref(item.to) : item.externalHref;

      return {
        ...item,
        ...(href === undefined ? {} : {href}),
        ...(item.children
          ? {children: removeHiddenItemsAndSetHref(item.children, resolveHref)}
          : {}),
      };
    });
}

function isMenuItemHidden(search: string, label: React.ReactNode, textValue?: string) {
  const text = textValue ?? (typeof label === 'string' ? label : '');
  return Boolean(
    search && !text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
}

/** Items with children render as a section, unless they open a submenu. */
function isMenuSection(item: MenuItemProps): boolean {
  return Boolean(item.children && item.children.length > 0 && !item.submenu);
}

function filterMenuItems(items: MenuItemProps[], search: string): MenuItemProps[] {
  const query = search.trim().toLocaleLowerCase();
  if (!query) {
    return items;
  }

  return items.flatMap(item => {
    if (item.children && !item.submenu) {
      const children = filterMenuItems(item.children, query);
      return children.length > 0 ? [{...item, children}] : [];
    }

    return isMenuItemHidden(query, item.label, item.textValue) ? [] : [item];
  });
}

/** The key of the menu item an event fired on, if it fired on one. */
function getMenuItemKey(target: EventTarget | null): string | undefined {
  if (
    !(target instanceof HTMLElement) ||
    !target.getAttribute('role')?.startsWith('menuitem')
  ) {
    return undefined;
  }
  return target.dataset.key;
}

/**
 * Recursively finds and returns disabled items
 */
function getDisabledKeys(source: MenuItemProps[]): Array<MenuItemProps['key']> {
  return source.reduce<Array<MenuItemProps['key']>>((acc, cur) => {
    if (cur.disabled) {
      // If an item is disabled, then its children will be inaccessible, so we
      // can skip them and just return the parent item
      acc.push(cur.key);
      return acc;
    }

    if (cur.children) {
      return acc.concat(getDisabledKeys(cur.children));
    }

    return acc;
  }, []);
}

export type DropdownMenuContentProps = Omit<DropdownMenuListProps, 'searchState'> & {
  items: MenuItemProps[];
  search?: DropdownMenuSearchOptions;
};

export function DropdownMenuContent({
  items,
  disabledKeys,
  size,
  search,
  virtualizeThreshold,
  ...props
}: DropdownMenuContentProps) {
  const [searchValue, setSearchValue] = useState('');
  // A submenu renders inside its parent menu's context, so it inherits the
  // parent's threshold unless it sets its own.
  const {virtualizeThreshold: inheritedVirtualizeThreshold} =
    useContext(DropdownMenuContext);
  const resolveHref = useResolveLinkHref();
  const activeItems = useMemo(
    () => removeHiddenItemsAndSetHref(items, resolveHref),
    [items, resolveHref]
  );
  const visibleItems = useMemo(
    () =>
      search && searchValue ? filterMenuItems(activeItems, searchValue) : activeItems,
    [activeItems, search, searchValue]
  );
  const defaultDisabledKeys = useMemo(
    () => getDisabledKeys(visibleItems),
    [visibleItems]
  );
  return (
    <DropdownMenuList
      {...props}
      size={size}
      disabledKeys={disabledKeys ?? defaultDisabledKeys}
      items={visibleItems}
      virtualizeThreshold={virtualizeThreshold ?? inheritedVirtualizeThreshold}
      searchState={
        search ? {...search, value: searchValue, onChange: setSearchValue} : undefined
      }
    >
      {(item: MenuItemProps) => {
        const {onAction: _onAction, ...itemProps} = item;

        if (isMenuSection(item)) {
          return (
            <Section key={item.key} title={item.label} items={item.children}>
              {sectionItem => {
                const {onAction: _sectionOnAction, ...sectionItemProps} = sectionItem;

                return (
                  <Item size={size} {...sectionItemProps} key={sectionItem.key}>
                    {sectionItem.label}
                  </Item>
                );
              }}
            </Section>
          );
        }
        return (
          <Item size={size} {...itemProps} key={item.key}>
            {item.label}
          </Item>
        );
      }}
    </DropdownMenuList>
  );
}

interface DropdownSubmenuProps extends Pick<
  DropdownMenuListProps,
  'closeOnSelect' | 'disableTextSelection' | 'onClose' | 'size'
> {
  items: MenuItemProps[];
  node: Node<MenuItemProps>;
  state: TreeState<MenuItemProps>;
  rowProps?: VirtualRowProps;
}

function DropdownSubmenu({
  items,
  node,
  rowProps,
  state,
  closeOnSelect,
  disableTextSelection,
  onClose,
  size,
}: DropdownSubmenuProps) {
  const {rootOverlayState} = useContext(DropdownMenuContext);
  const submenu = node.value?.submenu;
  const options = typeof submenu === 'object' ? submenu : {};
  const isDisabled = state.disabledKeys.has(node.key) || items.length === 0;
  const {
    isOpen,
    state: overlayState,
    triggerRef,
    triggerProps: {ref: setTriggerElement},
    overlayProps,
    overlayRef,
  } = useOverlay({
    isOpen: state.selectionManager.isSelected(node.key),
    onClose: rootOverlayState?.close,
    disableTrigger: isDisabled,
    position: options.position ?? 'right-start',
    offset: -4,
    preventOverflowOptions: {
      boundary: document.body,
      crossAxis: true,
    },
  });
  const {menuTriggerProps, menuProps} = useMenuTrigger(
    {type: 'menu', isDisabled},
    {...overlayState, focusStrategy: 'first'},
    triggerRef
  );
  const isFocused = state.selectionManager.focusedKey === node.key;
  return (
    <Container as="li" display="contents" role="presentation">
      <DropdownMenuItem
        menuItemRef={useCallback(
          element => {
            setTriggerElement(element);
            if (element && !isOpen && isFocused && rootOverlayState?.isOpen) {
              element.focus();
            }
          },
          [isOpen, isFocused, rootOverlayState, setTriggerElement]
        )}
        id={menuTriggerProps.id}
        aria-haspopup={menuTriggerProps['aria-haspopup']}
        aria-expanded={isOpen}
        aria-controls={menuTriggerProps['aria-controls']}
        submenuRef={isOpen ? overlayRef : undefined}
        renderAs="div"
        node={node}
        rowProps={rowProps}
        state={state}
        closeOnSelect={false}
      />
      {isOpen && (
        <DropdownMenuContent
          onClose={onClose}
          closeOnSelect={closeOnSelect}
          disableTextSelection={disableTextSelection}
          menuTitle={options.title}
          emptyMessage={options.emptyMessage}
          maxHeight={options.maxHeight}
          maxWidth={options.maxWidth}
          search={options.search}
          size={size}
          {...menuProps}
          items={items}
          autoFocus={false}
          overlayState={overlayState}
          overlayPositionProps={overlayProps}
        />
      )}
    </Container>
  );
}

const DropdownMenuListWrap = styled(Stack)<{
  disableTextSelection?: boolean;
}>`
  /* Keep both insets visible while the menu items scroll. */
  margin: ${p => p.theme.space.xs} 0;
  padding: 0;
  font-size: ${p => p.theme.font.size.md};
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 0;

  ${p =>
    p.disableTextSelection &&
    css`
      &,
      * {
        -webkit-user-select: none;
        user-select: none;
      }
    `}

  &:focus {
    outline: none;
  }
`;
