import type * as React from 'react';
import {Fragment, useContext, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTheme, css} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import type {AriaMenuOptions} from '@react-aria/menu';
import {useMenu, useSubmenuTrigger} from '@react-aria/menu';
import {useSeparator} from '@react-aria/separator';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {RootMenuTriggerState} from '@react-stately/menu';
import {useSubmenuTriggerState} from '@react-stately/menu';
import type {TreeProps, TreeState} from '@react-stately/tree';
import {useTreeState} from '@react-stately/tree';
import type {Node} from '@react-types/shared';

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

import {DropdownMenuContext} from './context';
import type {
  DropdownMenuContentSizeOptions,
  DropdownMenuSearchOptions,
  MenuItemProps,
} from './item';
import {DropdownMenuItem} from './item';
import {DropdownMenuSection} from './section';

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
   * Ref for the menu element. A submenu trigger passes one, so it can move
   * focus into its submenu.
   */
  menuRef?: React.RefObject<HTMLUListElement | null>;
  /**
   * Title to display on top of the menu
   */
  menuTitle?: React.ReactNode;
  /**
   * State of the root menu trigger. Only the root menu passes it. Submenus read
   * it from context.
   */
  rootMenuState?: RootMenuTriggerState;
  /** Controlled input state supplied by DropdownMenuContent. */
  searchState?: DropdownMenuSearchOptions & {
    onChange: (value: string) => void;
    value: string;
  };
  size?: MenuItemProps['size'];
  /**
   * Set when this list is a submenu.
   */
  submenu?: {
    /** Closes this submenu and returns focus to its trigger. */
    close: () => void;
    /** Whether the submenu was opened from the keyboard and should take focus. */
    shouldAutoFocus: boolean;
  };
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
}

function DropdownMenuCollectionItem({
  node,
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
      state={state}
      onClose={onClose}
      closeOnSelect={closeOnSelect}
    />
  );
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
            {showSeparator && (
              <Stack
                as="li"
                justify="center"
                height="8px"
                padding="0 lg 0 xl"
                {...separatorProps}
                role="presentation"
              >
                <SectionSeparator />
              </Stack>
            )}
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
  overlayPositionProps,
  zIndex,
  menuRef: menuRefProp,
  rootMenuState: rootMenuStateProp,
  submenu,
  autoFocus,
  ...props
}: DropdownMenuListProps) {
  const {t} = useTranslation();
  const context = useContext(DropdownMenuContext);
  const rootMenuState = rootMenuStateProp ?? context.rootMenuState;
  const state = useTreeState<MenuItemProps>({...props, selectionMode: 'single'});
  const stateCollection = useMemo(() => [...state.collection], [state.collection]);
  const hasLeadingItems = useMemo(
    () =>
      stateCollection
        .flatMap(node => (node.type === 'section' ? [...node.childNodes] : [node]))
        .some(node => node.value?.leadingItems || node.value?.isSelected !== undefined),
    [stateCollection]
  );

  // Implement focus states, keyboard navigation, aria-label,...
  const ownMenuRef = useRef<HTMLUListElement>(null);
  const menuRef = menuRefProp ?? ownMenuRef;
  const searchRef = useRef<HTMLInputElement>(null);
  const {menuProps} = useMenu(
    {
      ...props,
      // A searchable menu focuses its search field instead (see FocusScope below).
      autoFocus: searchState ? false : autoFocus,
      selectionMode: 'single',
    },
    state,
    menuRef
  );
  const {separatorProps} = useSeparator({elementType: 'li'});

  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
      // Submenus are portaled, but React still bubbles their events through
      // this menu. Only handle events from this menu's own items.
      if (!menuRef.current?.contains(e.target as HTMLElement)) {
        e.continuePropagation();
        return;
      }
      const enabledMenuItems = getEnabledMenuItems(menuRef.current);
      // When keyboard navigation wraps past the last item, show the top of the
      // list again so the search field and first item are visible.
      if (
        e.key === 'ArrowDown' &&
        searchRef.current &&
        e.target === enabledMenuItems.at(-1)
      ) {
        menuRef.current.scrollTop = 0;
      }
      // Move from the first enabled item back to search before leaving the submenu.
      if (
        e.key === 'ArrowUp' &&
        searchRef.current &&
        document.activeElement === enabledMenuItems[0]
      ) {
        e.preventDefault();
        menuRef.current.scrollTop = 0;
        searchRef.current.focus();
        return;
      }
      e.continuePropagation();
    },
  });

  // Submenus render into this element. It sits inside the root overlay, but
  // outside every menu element.
  const [ownPortalContainer, setOwnPortalContainer] = useState<HTMLElement | null>(null);
  const portalContainer = context.portalContainer ?? ownPortalContainer;

  const theme = useTheme();
  const contextValue = useMemo(
    () => ({rootMenuState, parentMenuRef: menuRef, portalContainer}),
    [rootMenuState, menuRef, portalContainer]
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
          getEnabledMenuItems(menuRef.current)[0]?.focus();
        }
      }}
    />
  );
  const showEmptyMessage = Boolean(
    searchState?.value.trim() && stateCollection.length === 0
  );
  return (
    // A root menu, and a submenu opened from the keyboard, take focus. A
    // searchable submenu always does, so typing filters it right away. A
    // submenu opened by hover leaves focus on its trigger.
    <FocusScope
      restoreFocus
      autoFocus={!submenu || submenu.shouldAutoFocus || Boolean(searchState)}
    >
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
                  // Escape closes only this submenu. Handle it before React Aria
                  // closes the entire menu tree. This also covers the search
                  // field, which sits outside the menu element. Deeper submenus
                  // are portaled out of this overlay, so they handle their own.
                  if (
                    event.key === 'Escape' &&
                    submenu &&
                    event.currentTarget.contains(event.target as HTMLElement)
                  ) {
                    event.stopPropagation();
                    // Let the IME cancel composition without dismissing the submenu.
                    if (event.nativeEvent.isComposing) {
                      return;
                    }
                    event.preventDefault();
                    submenu.close();
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
                  {...mergeProps(menuProps, keyboardProps)}
                >
                  <ReserveLeadingSlot reserve={hasLeadingItems}>
                    <DropdownMenuCollection
                      collection={stateCollection}
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
          {!context.portalContainer && (
            <Container display="contents" ref={setOwnPortalContainer} />
          )}
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
 * Returns the menu items keyboard focus can reach. Disabled items are skipped,
 * so the first and last of these are the first and last focusable items.
 * Matches the rule CompactSelect uses for its ArrowUp/Down region handoff.
 */
function getEnabledMenuItems(menu: HTMLElement | null): HTMLElement[] {
  return Array.from(
    menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []
  ).filter(item => item.getAttribute('aria-disabled') !== 'true');
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
  ...props
}: DropdownMenuContentProps) {
  const [searchValue, setSearchValue] = useState('');
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
      searchState={
        search ? {...search, value: searchValue, onChange: setSearchValue} : undefined
      }
    >
      {(item: MenuItemProps) => {
        const {onAction: _onAction, ...itemProps} = item;

        if (item.children && item.children.length > 0 && !item.submenu) {
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
}

function DropdownSubmenu({
  items,
  node,
  state,
  closeOnSelect,
  disableTextSelection,
  onClose,
  size,
}: DropdownSubmenuProps) {
  const {rootMenuState, parentMenuRef, portalContainer} = useContext(DropdownMenuContext);
  if (!rootMenuState || !parentMenuRef) {
    throw new Error('DropdownSubmenu must be rendered inside a DropdownMenu');
  }
  const submenu = node.value?.submenu;
  const options = typeof submenu === 'object' ? submenu : {};
  const isDisabled = state.disabledKeys.has(node.key) || items.length === 0;
  const submenuState = useSubmenuTriggerState({triggerKey: node.key}, rootMenuState);
  const submenuRef = useRef<HTMLUListElement>(null);
  const {
    isOpen,
    triggerRef,
    triggerProps: {ref: setTriggerElement},
    overlayProps,
  } = useOverlay({
    isOpen: submenuState.isOpen,
    onClose: rootMenuState.close,
    disableTrigger: isDisabled,
    // The submenu handles Escape itself, closing only this level.
    isKeyboardDismissDisabled: true,
    position: options.position ?? 'right-start',
    offset: -4,
    preventOverflowOptions: {
      boundary: document.body,
      crossAxis: true,
    },
  });
  const {submenuTriggerProps, submenuProps} = useSubmenuTrigger<MenuItemProps>(
    {parentMenuRef, submenuRef, isDisabled, type: 'menu'},
    submenuState,
    triggerRef
  );
  const {
    submenuLevel: _submenuLevel,
    onClose: _closeAll,
    autoFocus,
    ...submenuMenuProps
  } = submenuProps;

  return (
    <Container as="li" display="contents" role="presentation">
      <DropdownMenuItem
        menuItemRef={setTriggerElement}
        submenuTriggerProps={submenuTriggerProps}
        renderAs="div"
        node={node}
        state={state}
        closeOnSelect={false}
      />
      {isOpen &&
        portalContainer &&
        createPortal(
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
            {...submenuMenuProps}
            autoFocus={autoFocus}
            menuRef={submenuRef}
            submenu={{
              shouldAutoFocus: Boolean(autoFocus),
              close: () => {
                submenuState.close();
                triggerRef.current?.focus();
              },
            }}
            items={items}
            overlayPositionProps={overlayProps}
          />,
          portalContainer
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
