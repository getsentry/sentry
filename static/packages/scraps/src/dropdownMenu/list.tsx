import type * as React from 'react';
import {useContext, useMemo, useRef, useState} from 'react';
import {useTheme, css} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import type {AriaMenuOptions} from '@react-aria/menu';
import {useMenu} from '@react-aria/menu';
import {useSeparator} from '@react-aria/separator';
import {mergeProps} from '@react-aria/utils';
import type {TreeProps} from '@react-stately/tree';
import {useTreeState} from '@react-stately/tree';
import type {Key, Node} from '@react-types/shared';

import {Stack} from '@sentry/scraps/layout';
import {
  calculateMenuMinHeight,
  Header,
  ReserveLeadingSlot,
  Title,
} from '@sentry/scraps/menu';
import {Overlay, PositionWrapper} from '@sentry/scraps/overlay';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';
import {flattenSections} from '@sentry/scraps/useVirtualCollection';

import type {OverlayState} from './context';
import {DropdownMenuContext} from './context';
import type {
  DropdownMenuContentSizeOptions,
  DropdownMenuSearchOptions,
  MenuItemProps,
} from './item';
import {DropdownMenuRows} from './rows';
import {DropdownMenuSearch} from './search';
import {useSafetyTriangle} from './useSafetyTriangle';
import {getMenuItemKey} from './utils';

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
   * Whether only the items near the viewport are rendered. Computed by
   * `DropdownMenuContent` from `virtualizeThreshold`, so it is not part of the
   * public API: consumers set the threshold instead.
   */
  isVirtualized?: boolean;
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
export function DropdownMenuList({
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
  isVirtualized: virtualized = false,
  // Only provided to submenus through context, which inherit it.
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
    <DropdownMenuSearch
      ref={searchRef}
      padding={menuTitle ? '0' : undefined}
      aria-label={searchState.placeholder ?? 'Search'}
      placeholder={searchState.placeholder ?? 'Search…'}
      initialValue={searchState.value}
      onSearch={searchState.onChange}
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
