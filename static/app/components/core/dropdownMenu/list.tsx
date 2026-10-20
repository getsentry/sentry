import {Fragment, useCallback, useContext, useMemo, useRef, useState} from 'react';
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
import type {Node} from '@react-types/shared';
import type {LocationDescriptor} from 'history';

import {minHeight} from '@sentry/scraps/compactSelect/utils';
import {Container, Stack} from '@sentry/scraps/layout';
import {Menu} from '@sentry/scraps/menu';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOverlay} from 'sentry/utils/useOverlay';

import type {OverlayState} from './context';
import {DropdownMenuContext} from './context';
import type {MenuItemProps} from './item';
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
    TreeProps<MenuItemProps> {
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
  menuWidth?: number | string;
  minMenuHeight?: number | string;
  search?: {
    onChange: (value: string) => void;
    value: string;
    placeholder?: string;
    showIcon?: boolean;
    size?: 'xs' | 'sm' | 'md';
  };
  size?: MenuItemProps['size'];
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
                <Menu.SectionSeparator />
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
  emptyMessage,
  onClose,
  size,
  menuTitle,
  menuFooter,
  menuWidth,
  minMenuHeight,
  search,
  disableTextSelection,
  overlayState,
  overlayPositionProps,
  zIndex,
  ...props
}: DropdownMenuListProps) {
  const {t} = useTranslation();
  const {rootOverlayState, parentMenuState} = useContext(DropdownMenuContext);
  const safetyTriangle = useSafetyTriangle();
  const state = useTreeState<MenuItemProps>({...props, selectionMode: 'single'});
  const stateCollection = useMemo(() => [...state.collection], [state.collection]);

  // Implement focus states, keyboard navigation, aria-label,...
  const menuRef = useRef<HTMLUListElement>(null);
  const {menuProps} = useMenu({...props, selectionMode: 'single'}, state, menuRef);
  const {separatorProps} = useSeparator({elementType: 'li'});

  // If this is a submenu, pressing arrow left should close it (but not the
  // root menu).
  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
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
    }),
    [rootOverlayState, overlayState, state, safetyTriangle]
  );
  return (
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper
        zIndex={zIndex === undefined ? theme.zIndex.dropdown : Number(zIndex)}
        {...overlayPositionProps}
      >
        <DropdownMenuContext value={contextValue}>
          <StyledOverlay
            minMenuHeight={minMenuHeight}
            menuWidth={menuWidth}
            maxWidthProp={overlayPositionProps.style?.maxWidth}
          >
            {(menuTitle || search) && (
              <Menu.Header>
                {menuTitle && <Menu.Title padding="sm lg">{menuTitle}</Menu.Title>}
                {search && (
                  <Menu.Search
                    showIcon={search.showIcon}
                    size={search.size}
                    aria-label={search.placeholder ?? 'Search'}
                    placeholder={search.placeholder ?? 'Search…'}
                    value={search.value}
                    onChange={event => search.onChange(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        menuRef.current
                          ?.querySelector<HTMLElement>('[role^="menuitem"]')
                          ?.focus();
                      }
                    }}
                  />
                )}
              </Menu.Header>
            )}
            <DropdownMenuListWrap
              as="ul"
              ref={menuRef}
              flex={search?.value.trim() && stateCollection.length === 0 ? 1 : undefined}
              hasTitle={!!menuTitle}
              disableTextSelection={disableTextSelection}
              {...mergeProps(modifiedMenuProps, keyboardProps)}
              style={{
                maxHeight: overlayPositionProps.style?.maxHeight,
              }}
            >
              <DropdownMenuCollection
                collection={stateCollection}
                closeOnSelect={closeOnSelect}
                disableTextSelection={disableTextSelection}
                onClose={onClose}
                separatorProps={separatorProps}
                size={size}
                state={state}
              />
              {search?.value.trim() && stateCollection.length === 0 && (
                <Stack
                  as="li"
                  role="presentation"
                  align="center"
                  justify="center"
                  flex={1}
                  padding="md lg"
                >
                  <Text variant="muted">{emptyMessage ?? t('No results found')}</Text>
                </Stack>
              )}
            </DropdownMenuListWrap>
            {menuFooter}
          </StyledOverlay>
        </DropdownMenuContext>
      </PositionWrapper>
    </FocusScope>
  );
}

// react-aria uses the href prop on item state to determine if the item is a link
// and will navigate there when selected
function makeItemHref(item: MenuItemProps): LocationDescriptor | undefined {
  if (item.to) {
    // This matches the behavior of the Link component
    return normalizeUrl(item.to);
  }

  return item.externalHref;
}

/**
 * Recursively removes hidden items, including those nested in submenus
 * Apply href to items that have a to or externalHref prop
 */
function removeHiddenItemsAndSetHref(source: MenuItemProps[]): MenuItemProps[] {
  return source
    .filter(item => !item.hidden)
    .map(item => {
      const href = makeItemHref(item);

      return {
        ...item,
        ...(href === undefined ? {} : {href}),
        ...(item.children ? {children: removeHiddenItemsAndSetHref(item.children)} : {}),
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

type DropdownMenuContentProps = DropdownMenuListProps & {items: MenuItemProps[]};

export function DropdownMenuContent({
  items,
  disabledKeys,
  size,
  search,
  ...props
}: DropdownMenuContentProps) {
  const activeItems = useMemo(() => removeHiddenItemsAndSetHref(items), [items]);
  const visibleItems = useMemo(
    () => (search?.value ? filterMenuItems(activeItems, search.value) : activeItems),
    [activeItems, search]
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
      search={search}
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

function SearchableDropdownSubmenuContent({
  searchOptions,
  ...props
}: Omit<DropdownMenuContentProps, 'search'> & {
  searchOptions?: {
    placeholder?: string;
    showIcon?: boolean;
    size?: 'xs' | 'sm' | 'md';
  };
}) {
  const [search, setSearch] = useState('');
  return (
    <DropdownMenuContent
      {...props}
      search={
        searchOptions ? {...searchOptions, value: search, onChange: setSearch} : undefined
      }
    />
  );
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
    flipOptions: {
      boundary: document.body,
      altAxis: false,
      ...(options.position
        ? {}
        : {fallbackPlacements: ['bottom-start', 'left-start', 'top-start']}),
    },
    preventOverflowOptions: {
      boundary: document.body,
      altAxis: true,
    },
  });
  const {menuTriggerProps, menuProps} = useMenuTrigger(
    {type: 'menu', isDisabled},
    {...overlayState, focusStrategy: 'first'},
    triggerRef
  );
  const isFocused = state.selectionManager.focusedKey === node.key;
  const maxHeight = minHeight(options.maxMenuHeight, overlayProps.style?.maxHeight);
  const minimumHeight =
    options.minMenuHeight === undefined
      ? undefined
      : minHeight(options.minMenuHeight, maxHeight);

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
        state={state}
        closeOnSelect={false}
      />
      {isOpen && (
        <SearchableDropdownSubmenuContent
          onClose={onClose}
          closeOnSelect={closeOnSelect}
          disableTextSelection={disableTextSelection}
          menuTitle={options.title}
          emptyMessage={options.emptyMessage}
          minMenuHeight={minimumHeight}
          menuWidth={options.menuWidth}
          searchOptions={options.search}
          size={size}
          {...menuProps}
          items={items}
          autoFocus={false}
          overlayState={overlayState}
          overlayPositionProps={{
            ...overlayProps,
            style: {
              ...overlayProps.style,
              maxHeight,
            },
          }}
        />
      )}
    </Container>
  );
}

const StyledOverlay = styled(Overlay, {
  shouldForwardProp: prop =>
    !['minMenuHeight', 'menuWidth', 'maxWidthProp'].includes(prop),
})<{
  maxWidthProp?: number | string;
  menuWidth?: number | string;
  minMenuHeight?: number | string;
}>`
  display: flex;
  flex-direction: column;
  max-height: inherit;
  min-height: ${p => p.minMenuHeight && withUnits(p.minMenuHeight)};
  width: ${p => p.menuWidth && withUnits(p.menuWidth)};
  max-width: ${p =>
    p.menuWidth && (p.maxWidthProp ? withUnits(p.maxWidthProp) : 'calc(100vw - 16px)')};
`;

const withUnits = (value: string | number) =>
  typeof value === 'number' ? `${value}px` : value;

const DropdownMenuListWrap = styled(Stack)<{
  hasTitle: boolean;
  disableTextSelection?: boolean;
}>`
  margin: 0;
  padding: ${p => p.theme.space.xs} 0;
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

  ${p =>
    p.hasTitle &&
    css`
      padding-top: ${p.theme.space.xs};
    `}

  &:focus {
    outline: none;
  }
`;
