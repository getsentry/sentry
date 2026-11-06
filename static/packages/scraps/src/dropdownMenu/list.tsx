import type * as React from 'react';
import {
  Fragment,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  SectionSeparator,
  Title,
} from '@sentry/scraps/menu';
import {Overlay, PositionWrapper} from '@sentry/scraps/overlay';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';
import {useOverlay} from '@sentry/scraps/useOverlay';
import {
  DEFAULT_VIRTUALIZE_THRESHOLD,
  useVirtualCollection,
  VirtualSpacer,
  type VirtualRow,
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
  collection: Array<Node<MenuItemProps>>;
  onClose: DropdownMenuListProps['onClose'];
  separatorProps: ReturnType<typeof useSeparator>['separatorProps'];
  state: TreeState<MenuItemProps>;
  disableTextSelection?: boolean;
  size?: MenuItemProps['size'];
};

interface DropdownMenuCollectionItemProps extends Omit<
  DropdownMenuCollectionProps,
  'collection'
> {
  node: Node<MenuItemProps>;
  /** Measurement props for the item's row when the menu is virtualized. */
  rowProps?: VirtualRowProps;
}

function DropdownMenuCollectionItem({
  node,
  rowProps,
  closeOnSelect,
  disableTextSelection,
  onClose,
  separatorProps,
  size,
  state,
}: DropdownMenuCollectionItemProps): React.ReactNode {
  if (node.type === 'section') {
    return (
      <DropdownMenuSection node={node}>
        <DropdownMenuCollection
          collection={[...node.childNodes]}
          closeOnSelect={closeOnSelect}
          disableTextSelection={disableTextSelection}
          onClose={onClose}
          separatorProps={separatorProps}
          size={size}
          state={state}
        />
      </DropdownMenuSection>
    );
  }

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
  as = 'li',
  separatorProps,
}: {
  as?: 'div' | 'li';
  separatorProps?: DropdownMenuCollectionProps['separatorProps'];
}) {
  return (
    <Stack
      as={as}
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

interface DropdownMenuVirtualRowsProps extends DropdownMenuCollectionProps {
  rows: Array<VirtualRow<MenuItemProps>>;
}

/**
 * Renders the mounted rows of a virtualized menu. Rows are flat, so the items
 * of each section are put back inside their section. The virtualizer keeps a
 * section's own row mounted while any of its items are, so items always
 * follow their section row.
 */
function DropdownMenuVirtualRows({
  rows,
  collection,
  ...itemProps
}: DropdownMenuVirtualRowsProps) {
  const groups: Array<{
    items: Array<VirtualRow<MenuItemProps>>;
    section?: VirtualRow<MenuItemProps>;
  }> = [];
  for (const row of rows) {
    const group = groups.at(-1);
    if (row.node.type === 'section') {
      groups.push({section: row, items: []});
    } else if (group?.section && group.section.node.key === row.node.parentKey) {
      group.items.push(row);
    } else {
      groups.push({items: [row]});
    }
  }

  const renderItem = ({node, props, spaceBefore}: VirtualRow<MenuItemProps>) => (
    <Fragment key={node.key}>
      <VirtualSpacer height={spaceBefore} />
      {/* Same rule as DropdownMenuCollection: a separator between a section
          and the item after it. It is not part of a measured row, but it only
          mounts next to its item and is a few pixels tall, so the scroll
          offsets drift very little. */}
      {collection[collection.indexOf(node) - 1]?.type === 'section' && (
        <DropdownMenuSeparator separatorProps={itemProps.separatorProps} />
      )}
      <DropdownMenuCollectionItem node={node} rowProps={props} {...itemProps} />
    </Fragment>
  );

  return groups.map(({section, items}) => {
    if (!section) {
      return items.map(renderItem);
    }
    return (
      <Fragment key={section.node.key}>
        <VirtualSpacer height={section.spaceBefore} />
        <DropdownMenuSection
          node={section.node}
          rowProps={section.props}
          separator={
            section.node.key !== collection[0]?.key && <DropdownMenuSeparator as="div" />
          }
        >
          {items.map(renderItem)}
        </DropdownMenuSection>
      </Fragment>
    );
  });
}

function DropdownMenuCollection({
  closeOnSelect,
  collection,
  onClose,
  separatorProps,
  state,
  disableTextSelection,
  size,
}: DropdownMenuCollectionProps) {
  return (
    <Fragment>
      {collection.map((node, i) => {
        const isLastNode = collection.length - 1 === i;
        const showSeparator =
          !isLastNode &&
          (node.type === 'section' || collection[i + 1]?.type === 'section');

        return (
          <Fragment key={node.key}>
            <DropdownMenuCollectionItem
              node={node}
              closeOnSelect={closeOnSelect}
              disableTextSelection={disableTextSelection}
              onClose={onClose}
              separatorProps={separatorProps}
              size={size}
              state={state}
            />
            {showSeparator && <DropdownMenuSeparator separatorProps={separatorProps} />}
          </Fragment>
        );
      })}
    </Fragment>
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
  const {rootOverlayState, parentMenuState} = useContext(DropdownMenuContext);
  const safetyTriangle = useSafetyTriangle();
  const state = useTreeState<MenuItemProps>({...props, selectionMode: 'single'});
  const stateCollection = useMemo(() => [...state.collection], [state.collection]);
  // Each section is followed by its items, so a long section is windowed like
  // any other run of items instead of mounting all at once.
  const virtualNodes = useMemo(
    () =>
      stateCollection.flatMap(node =>
        node.type === 'section' ? [node, ...node.childNodes] : [node]
      ),
    [stateCollection]
  );
  const items = useMemo(
    () => virtualNodes.filter(node => node.type !== 'section'),
    [virtualNodes]
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

  const virtual = useVirtualCollection({
    nodes: virtualNodes,
    enabled: virtualized,
    size: size ?? 'md',
    scrollRef: menuRef,
    focusedKey: state.selectionManager.focusedKey,
  });

  // A virtualized menu's width follows the rows that happen to be mounted.
  // Only let it grow, so it does not jitter while scrolling.
  const [virtualizedMinWidth, setVirtualizedMinWidth] = useState(0);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!virtualized || !menu) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setVirtualizedMinWidth(width => Math.max(width, menu.offsetWidth))
    );
    observer.observe(menu);
    return () => observer.disconnect();
  }, [virtualized]);

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
      const focusableKeys = getFocusableKeys(state);
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

  const theme = useTheme();
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
          focusItem(getFocusableKeys(state)[0]);
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
                  maxHeight: calculateMenuMinHeight(
                    maxHeight,
                    overlayPositionProps.style?.maxHeight
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
                  minWidth={virtualized ? `${virtualizedMinWidth}px` : undefined}
                  {...mergeProps(modifiedMenuProps, keyboardProps)}
                >
                  <ReserveLeadingSlot reserve={hasLeadingItems}>
                    {virtualized ? (
                      <Fragment>
                        <DropdownMenuVirtualRows
                          rows={virtual.rows}
                          collection={stateCollection}
                          closeOnSelect={closeOnSelect}
                          disableTextSelection={disableTextSelection}
                          onClose={onClose}
                          separatorProps={separatorProps}
                          size={size}
                          state={state}
                        />
                        <VirtualSpacer height={virtual.spaceAfter} />
                      </Fragment>
                    ) : (
                      <DropdownMenuCollection
                        collection={stateCollection}
                        closeOnSelect={closeOnSelect}
                        disableTextSelection={disableTextSelection}
                        onClose={onClose}
                        separatorProps={separatorProps}
                        size={size}
                        state={state}
                      />
                    )}
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

/**
 * Returns the keys of the items keyboard focus can reach, in order. Disabled
 * items are skipped, so the first and last keys are the first and last
 * focusable items. Matches the rule CompactSelect uses for its ArrowUp/Down
 * region handoff.
 */
function getFocusableKeys(state: TreeState<MenuItemProps>): string[] {
  return [...state.collection]
    .flatMap(node => (node.type === 'section' ? [...node.childNodes] : [node]))
    .filter(node => node.type === 'item' && !state.disabledKeys.has(node.key))
    .map(node => String(node.key));
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
