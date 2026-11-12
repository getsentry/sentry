import type * as React from 'react';
import {memo, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {useTheme, css} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import type {AriaMenuOptions} from '@react-aria/menu';
import {useMenu, useMenuTrigger} from '@react-aria/menu';
import {useSeparator} from '@react-aria/separator';
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
  SectionGroup,
  SectionList,
  Title,
} from '@sentry/scraps/menu';
import {Overlay, PositionWrapper} from '@sentry/scraps/overlay';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';
import {useOverlay} from '@sentry/scraps/useOverlay';
import {
  DEFAULT_VIRTUALIZE_THRESHOLD,
  flattenSections,
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
import {DropdownMenuSearch} from './search';
import {DropdownMenuSection} from './section';
import type {DropdownMenuSeparatorProps} from './separator';
import {DropdownMenuSeparator} from './separator';
import {useDropdownMenuKeyboard} from './useDropdownMenuKeyboard';
import {useDropdownMenuRowLayout} from './useDropdownMenuRowLayout';
import {useSafetyTriangle} from './useSafetyTriangle';
import {
  countMenuItems,
  filterMenuItems,
  getDisabledKeys,
  isMenuSection,
  removeHiddenItemsAndSetHref,
} from './utils';

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

type DropdownMenuCollectionProps = {
  closeOnSelect: boolean;
  /** Top-level nodes of the menu, in order. */
  collection: Array<Node<MenuItemProps>>;
  onClose: DropdownMenuListProps['onClose'];
  separatorProps: DropdownMenuSeparatorProps['separatorProps'];
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
  // The virtualizer re-renders the component that calls it on every scroll.
  // Calling it here, rather than in `DropdownMenuList`, keeps those re-renders
  // to the rows: the list's state and handlers keep their identity, so a row
  // that did not change is not re-rendered.
  const {itemsAfterSections, virtual} = useDropdownMenuRowLayout({
    collection,
    focusedKey: itemProps.state.selectionManager.focusedKey,
    isWidthLocked,
    menuRef,
    onLockWidth,
    size: itemProps.size ?? 'md',
    virtualized,
    widestKey,
  });

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

  const {
    focusItem,
    hasFocus,
    menuProps: keyboardMenuProps,
  } = useDropdownMenuKeyboard({
    focusableKeys,
    menuProps,
    menuRef,
    parentMenuState,
    searchRef,
    state,
    stateCollection,
  });

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
  const availableMaxWidth =
    typeof overlayPositionProps.style?.maxWidth === 'number'
      ? `${overlayPositionProps.style.maxWidth}px`
      : (overlayPositionProps.style?.maxWidth ?? '100%');
  const positionedMaxWidth =
    maxWidth === undefined
      ? overlayPositionProps.style?.maxWidth
      : `min(${typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth}, ${availableMaxWidth})`;
  return (
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper
        zIndex={zIndex === undefined ? theme.zIndex.dropdown : Number(zIndex)}
        {...overlayPositionProps}
        style={{...overlayPositionProps.style, maxWidth: positionedMaxWidth}}
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
                  {...keyboardMenuProps}
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

export type DropdownMenuContentProps = Omit<
  DropdownMenuListProps,
  'searchState' | 'isVirtualized'
> & {
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
  // Updated in a transition by the search field, see `DropdownMenuSearch`.
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
  // Counts the items before a search filters them, so a menu keeps
  // virtualizing while it is searched: the matches of a long menu can still be
  // too many to render at once.
  const activeItemCount = useMemo(() => countMenuItems(activeItems), [activeItems]);
  const resolvedVirtualizeThreshold = virtualizeThreshold ?? inheritedVirtualizeThreshold;
  const isVirtualized =
    activeItemCount > (resolvedVirtualizeThreshold ?? DEFAULT_VIRTUALIZE_THRESHOLD);
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
      isVirtualized={isVirtualized}
      virtualizeThreshold={resolvedVirtualizeThreshold}
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
  isVirtualized?: boolean;
  rowProps?: VirtualRowProps;
}

function DropdownSubmenu({
  items,
  node,
  isVirtualized,
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
        isVirtualized={isVirtualized}
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
