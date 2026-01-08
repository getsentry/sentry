import {
  createContext,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {OverlayTriggerState} from '@react-stately/overlays';

import {useBoundaryContext} from '@sentry/scraps/boundaryContext';
import {Stack} from '@sentry/scraps/layout';

import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import DropdownButton from 'sentry/components/dropdownButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {FormSize} from 'sentry/utils/theme';
import type {UseOverlayProps} from 'sentry/utils/useOverlay';
import useOverlay from 'sentry/utils/useOverlay';
import usePrevious from 'sentry/utils/usePrevious';

import type {SingleListProps} from './list';
import {type ButtonTriggerProps, type SelectTriggerProps} from './trigger';
import type {SelectKey, SelectOptionOrSection} from './types';

// autoFocus react attribute is sync called on render, this causes
// layout thrashing and is bad for performance. This thin wrapper function
// will defer the focus call until the next frame, after the browser and react
// have had a chance to update the DOM, splitting the perf cost across frames.
function nextFrameCallback(cb: () => void) {
  if ('requestAnimationFrame' in window) {
    window.requestAnimationFrame(() => cb());
  } else {
    setTimeout(() => {
      cb();
    }, 1);
  }
}

interface SelectContextValue {
  overlayIsOpen: boolean;
  /**
   * Search string to determine whether an option should be rendered in the select list.
   */
  search: string;
  disabled?: boolean;
  /**
   * The control's overlay state. Useful for opening/closing the menu from inside the
   * selector.
   */
  overlayState?: OverlayTriggerState;
  size?: FormSize;
}

export const SelectContext = createContext<SelectContextValue>({
  overlayIsOpen: false,
  search: '',
});

export interface ControlProps
  extends Omit<
      React.BaseHTMLAttributes<HTMLDivElement>,
      // omit keys from SingleListProps because those will be passed to <List /> instead
      | keyof Omit<SingleListProps<SelectKey>, 'children' | 'items' | 'grid' | 'label'>
      | 'defaultValue'
    >,
    Pick<
      UseOverlayProps,
      | 'isOpen'
      | 'onClose'
      | 'offset'
      | 'position'
      | 'isDismissable'
      | 'shouldCloseOnBlur'
      | 'shouldCloseOnInteractOutside'
      | 'onInteractOutside'
      | 'preventOverflowOptions'
      | 'flipOptions'
      | 'strategy'
    > {
  children?: React.ReactNode;
  className?: string;
  /**
   * If true, there will be a "Clear" button in the menu header.
   */
  clearable?: boolean;
  /**
   * Whether to disable the search input's filter function (applicable only when
   * `searchable` is true). This is useful for implementing custom search behaviors,
   * like fetching new options on search (via the onSearch() prop).
   */
  disableSearchFilter?: boolean;
  disabled?: boolean;
  /**
   * Message to be displayed when all options have been filtered out (via search).
   */
  emptyMessage?: React.ReactNode;
  /**
   * Whether to render a grid list rather than a list box.
   *
   * Unlike list boxes, grid lists are two-dimensional. Users can press Arrow Up/Down to
   * move between rows (options), and Arrow Left/Right to move between "columns". This
   * is useful when the select options have smaller, interactive elements
   * (buttons/links) inside. Grid lists allow users to focus on those child elements
   * using the Arrow Left/Right keys and interact with them, which isn't possible with
   * list boxes.
   */
  grid?: boolean;
  /**
   * If true, all select options will be hidden. This should only be used on a temporary
   * basis in conjunction with `menuBody` to display special views/states (e.g. a
   * secondary date range selector).
   */
  hideOptions?: boolean;
  /**
   * If true, there will be a loading indicator in the menu header.
   */
  loading?: boolean;
  maxMenuHeight?: number | string;
  /**
   * Optional content to display below the menu's header and above the options.
   */
  menuBody?:
    | React.ReactNode
    | ((actions: {closeOverlay: () => void}) => React.JSX.Element);
  /**
   * Footer to be rendered at the bottom of the menu.
   */
  menuFooter?:
    | React.ReactNode
    | ((actions: {closeOverlay: () => void; resetSearch: () => void}) => React.ReactNode);
  /**
   * Items to be displayed in the trailing (right) side of the menu's header.
   */
  menuHeaderTrailingItems?:
    | React.ReactNode
    | ((actions: {closeOverlay: () => void}) => React.ReactNode);
  menuHeight?: number | string;
  /**
   * Title to display in the menu's header. Keep the title as short as possible.
   */
  menuTitle?: React.ReactNode;
  menuWidth?: number | string;
  /**
   * Called when the clear button is clicked (applicable only when `clearable` is
   * true).
   */
  onClear?: (props: {overlayState: OverlayTriggerState}) => void;
  /**
   * Called when the menu is opened or closed.
   */
  onOpenChange?: (newOpenState: boolean) => void;
  /**
   * Called when the search input's value changes (applicable only when `searchable`
   * is true).
   */
  onSearch?: (value: string) => void;
  /**
   * The search input's placeholder text (applicable only when `searchable` is true).
   */
  searchPlaceholder?: string;
  /**
   * If true, there will be a search box on top of the menu, useful for quickly finding
   * menu items.
   */
  searchable?: boolean;
  size?: FormSize;

  /**
   * Optional replacement for the default trigger button. Note that the replacement must
   * forward `props` and `ref` its outer wrap, otherwise many accessibility features
   * won't work correctly.
   */
  trigger?: (props: SelectTriggerProps, isOpen: boolean) => React.ReactNode;

  /**
   * Props to be passed to the default trigger button.
   */
  triggerProps?: Partial<ButtonTriggerProps>;
}

/**
 * Controls Select's open state and exposes SelectContext to all chidlren.
 */
export function Control({
  // Control props
  autoFocus,
  trigger,
  triggerProps: {children: triggerLabelProp, ...triggerProps} = {},
  isOpen,
  onClose,
  isDismissable,
  onInteractOutside,
  shouldCloseOnInteractOutside,
  shouldCloseOnBlur,
  preventOverflowOptions,
  flipOptions,
  disabled,
  position = 'bottom-start',
  strategy = 'absolute',
  offset,
  hideOptions,
  menuTitle,
  maxMenuHeight = '32rem',
  menuWidth,
  menuHeight,
  menuHeaderTrailingItems,
  menuBody,
  menuFooter,
  onOpenChange,
  items = [],
  value,

  // Select props
  size = 'md',
  searchable = false,
  searchPlaceholder = 'Search…',
  disableSearchFilter = false,
  onSearch,
  clearable = false,
  onClear,
  loading = false,
  grid = false,
  children,
  menuRef,
  ...wrapperProps
}: ControlProps & {
  items?: Array<SelectOptionOrSection<SelectKey>>;
  menuRef?: React.Ref<HTMLDivElement>;
  value?: SelectKey | SelectKey[] | undefined;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  /**
   * Search/filter value, used to filter out the list of displayed elements
   */
  const [search, setSearch] = useState('');
  const [searchInputValue, setSearchInputValue] = useState(search);
  const searchRef = useRef<HTMLInputElement>(null);
  const updateSearch = (newValue: string) => {
    onSearch?.(newValue);

    setSearchInputValue(newValue);
    if (!disableSearchFilter) {
      setSearch(newValue);
      return;
    }
  };

  const {keyboardProps: searchKeyboardProps} = useKeyboard({
    onKeyDown: e => {
      // When the search input is focused, and the user presses Arrow Down,
      // we should move the focus to the menu items list.
      if (e.key === 'ArrowDown') {
        e.preventDefault(); // Prevent scroll action
        overlayRef.current
          ?.querySelector<HTMLLIElement>(`li[role="${grid ? 'row' : 'option'}"]`)
          ?.focus();
      }

      // Prevent form submissions on Enter key press in search box
      if (e.key === 'Enter') {
        e.preventDefault();
      }

      // Continue propagation, otherwise the overlay won't close on Esc key press
      e.continuePropagation();
    },
  });

  const overflowBoundaryId = useBoundaryContext();
  const overflowBoundary = overflowBoundaryId
    ? document.getElementById(overflowBoundaryId)
    : null;

  // Manage overlay position
  const {
    isOpen: overlayIsOpen,
    state: overlayState,
    update: updateOverlay,
    triggerRef,
    triggerProps: overlayTriggerProps,
    overlayRef,
    overlayProps,
  } = useOverlay({
    disableTrigger: disabled,
    type: grid ? 'menu' : 'listbox',
    position,
    offset,
    isOpen,
    isDismissable,
    onInteractOutside,
    shouldCloseOnInteractOutside,
    shouldCloseOnBlur,
    preventOverflowOptions: {
      ...preventOverflowOptions,
      boundary:
        preventOverflowOptions?.boundary ??
        overflowBoundary ??
        document.querySelector('main') ??
        document.getElementById('main') ??
        undefined,
    },
    flipOptions,
    strategy,
    onOpenChange: open => {
      onOpenChange?.(open);

      nextFrameCallback(() => {
        if (open) {
          // Force a overlay update, as sometimes the overlay is misaligned when opened
          updateOverlay?.();
          // Focus on search box if present
          if (searchable) {
            searchRef.current?.focus();
            return;
          }

          const firstSelectedOption = overlayRef.current?.querySelector<HTMLLIElement>(
            `li[role="${grid ? 'row' : 'option'}"][aria-selected="true"]`
          );

          // Focus on first selected item
          if (firstSelectedOption) {
            firstSelectedOption.focus();
            return;
          }

          // If no item is selected, focus on first item instead
          overlayRef.current
            ?.querySelector<HTMLLIElement>(`li[role="${grid ? 'row' : 'option'}"]`)
            ?.focus();
          return;
        }

        // On close
        onClose?.();

        // Clear search string
        setSearchInputValue('');
        setSearch('');

        // Only restore focus if it's already here or lost to the body.
        // This prevents focus from being stolen from other elements.
        if (
          document.activeElement === document.body ||
          wrapperRef.current?.contains(document.activeElement)
        ) {
          triggerRef.current?.focus();
        }
      });
    },
  });

  // Recalculate overlay position when its main content changes
  const prevMenuBody = usePrevious(menuBody);
  const prevHideOptions = usePrevious(hideOptions);
  useEffect(() => {
    if (
      // Don't update when the content inside `menuBody` changes. We should only update
      // when `menuBody` itself appears/disappears.
      ((!prevMenuBody && !menuBody) || (!!prevMenuBody && !!menuBody)) &&
      prevHideOptions === hideOptions
    ) {
      return;
    }

    updateOverlay?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuBody, hideOptions]);

  const wasRefAvailable = useRef(false);
  useEffect(() => {
    // Trigger ref is set by a setState in useOverlay, so we need to wait for it to be available
    // We also need to make sure we only focus once
    if (!triggerRef.current || wasRefAvailable.current) {
      return;
    }
    wasRefAvailable.current = true;

    if (autoFocus && !disabled) {
      triggerRef.current.focus();
    }
  }, [autoFocus, disabled, triggerRef]);

  /**
   * The menu's full width, before any option has been filtered out. Used to maintain a
   * constant width while the user types into the search box.
   */
  const [menuFullWidth, setMenuFullWidth] = useState<number>();
  // When search box is focused, read the menu's width and lock it at that value to
  // prevent visual jumps during search
  const onSearchFocus = useCallback(
    () => setMenuFullWidth(overlayRef.current?.offsetWidth),
    [overlayRef]
  );
  // When search box is blurred, release the lock the menu's width
  const onSearchBlur = useCallback(
    () => !search && setMenuFullWidth(undefined),
    [search]
  );

  /**
   * Trigger label, generated from current selection values. If more than one option is
   * selected, then a count badge will appear.
   */
  const triggerLabel: React.ReactNode = useMemo(() => {
    if (defined(triggerLabelProp)) {
      return triggerLabelProp;
    }

    const values = Array.isArray(value) ? value : [value];
    const options = items
      .flatMap(item => {
        if ('options' in item) return item.options;
        return item;
      })
      .filter(item => values.includes(item.value));

    if (options.length === 0) {
      return <TriggerLabel>{t('None')}</TriggerLabel>;
    }

    return (
      <Fragment>
        <TriggerLabel>{options[0]?.label}</TriggerLabel>
        {options.length > 1 && (
          <StyledBadge variant="muted">{`+${options.length - 1}`}</StyledBadge>
        )}
      </Fragment>
    );
  }, [triggerLabelProp, value, items]);

  const {keyboardProps: triggerKeyboardProps} = useKeyboard({
    onKeyDown: e => {
      // Open the select menu when user presses Arrow Up/Down.
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); // Prevent scroll
        overlayState.open();
      } else {
        e.continuePropagation();
      }
    },
  });

  const hasSelection = useMemo(() => {
    if (value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }, [value]);

  const contextValue = useMemo(() => {
    return {
      overlayState,
      overlayIsOpen,
      search,
      size,
      disabled,
    };
  }, [overlayState, overlayIsOpen, search, size, disabled]);

  const theme = useTheme();

  return (
    <SelectContext value={contextValue}>
      <ControlWrap {...wrapperProps}>
        {trigger ? (
          trigger(
            mergeProps({id: triggerProps.id}, triggerKeyboardProps, overlayTriggerProps),
            overlayIsOpen
          )
        ) : (
          <DropdownButton
            size={size}
            {...mergeProps(triggerProps, triggerKeyboardProps, overlayTriggerProps)}
            isOpen={overlayIsOpen}
            disabled={disabled}
          >
            {triggerLabel}
          </DropdownButton>
        )}
        <StyledPositionWrapper
          visible={overlayIsOpen}
          zIndex={theme.zIndex?.dropdown}
          {...overlayProps}
        >
          {overlayIsOpen && (
            <StyledOverlay
              ref={menuRef}
              width={menuWidth ?? menuFullWidth}
              height={menuHeight}
              minWidth={overlayProps.style!.minWidth}
              maxWidth={
                overlayProps.style?.maxWidth
                  ? `calc(${withUnits(overlayProps.style.maxWidth)} * 0.9)`
                  : undefined
              }
              maxHeight={overlayProps.style!.maxHeight}
              maxHeightProp={maxMenuHeight}
              data-menu-has-header={!!menuTitle || clearable}
              data-menu-has-search={searchable}
              data-menu-has-footer={!!menuFooter}
            >
              <FocusScope contain>
                {(menuTitle ||
                  menuHeaderTrailingItems ||
                  (clearable && hasSelection)) && (
                  <MenuHeader size={size}>
                    <MenuTitle>{menuTitle}</MenuTitle>
                    <MenuHeaderTrailingItems>
                      {loading && <StyledLoadingIndicator size={12} />}
                      {typeof menuHeaderTrailingItems === 'function'
                        ? menuHeaderTrailingItems({closeOverlay: overlayState.close})
                        : menuHeaderTrailingItems}
                      {clearable && hasSelection && (
                        <ClearButton
                          onClick={() => onClear?.({overlayState})}
                          size="zero"
                          borderless
                        >
                          {t('Clear')}
                        </ClearButton>
                      )}
                    </MenuHeaderTrailingItems>
                  </MenuHeader>
                )}
                {searchable && (
                  <SearchInput
                    ref={searchRef}
                    placeholder={searchPlaceholder}
                    value={searchInputValue}
                    onFocus={onSearchFocus}
                    onBlur={onSearchBlur}
                    onChange={e => updateSearch(e.target.value)}
                    size="xs"
                    {...searchKeyboardProps}
                  />
                )}
                {typeof menuBody === 'function'
                  ? menuBody({closeOverlay: overlayState.close})
                  : menuBody}
                {!hideOptions && <Stack minHeight="0">{children}</Stack>}
                {menuFooter && (
                  <MenuFooter>
                    {typeof menuFooter === 'function'
                      ? menuFooter({
                          closeOverlay: overlayState.close,
                          resetSearch: () => updateSearch(''),
                        })
                      : menuFooter}
                  </MenuFooter>
                )}
              </FocusScope>
            </StyledOverlay>
          )}
        </StyledPositionWrapper>
      </ControlWrap>
    </SelectContext>
  );
}

const ControlWrap = styled('div')`
  position: relative;
  width: max-content;
`;

export const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  text-align: left;
`;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
  top: auto;
`;

const headerVerticalPadding: Record<NonNullable<ControlProps['size']>, string> = {
  xs: space(0.25),
  sm: space(0.5),
  md: space(0.75),
};
const MenuHeader = styled('div')<{size: NonNullable<ControlProps['size']>}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => headerVerticalPadding[p.size]} ${space(1.5)};
  box-shadow: 0 1px 0 ${p => p.theme.tokens.border.transparent.neutral.muted};

  [data-menu-has-search='true'] > & {
    padding-bottom: 0;
    box-shadow: none;
  }

  line-height: ${p => p.theme.font.lineHeight.comfortable};
  z-index: 2;

  font-size: ${p => (p.size === 'xs' ? p.theme.fontSize.xs : p.theme.fontSize.sm)};
  color: ${p => p.theme.tokens.content.primary};
`;

const MenuHeaderTrailingItems = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
`;

const MenuTitle = styled('span')`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: ${p => p.theme.font.weight.sans.medium};
  white-space: nowrap;
  margin-right: ${space(2)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: flex;
  align-items: center;
  && {
    margin: 0;
  }
`;

const ClearButton = styled(Button)`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.subText};
  padding: 0 ${space(0.5)};
  margin: -${space(0.25)} -${space(0.5)};
`;

const SearchInput = styled(Input)`
  appearance: none;
  width: calc(100% - ${space(0.5)} * 2);
  margin: ${space(0.5)} ${space(0.5)};

  /* Add 1px to top margin if immediately preceded by menu header, to account for the
  header's shadow border */
  [data-menu-has-header='true'] > & {
    margin-top: calc(${space(0.5)} + 1px);
  }
`;
const withUnits = (value: unknown) => (typeof value === 'string' ? value : `${value}px`);

const StyledOverlay = styled(Overlay, {
  shouldForwardProp: prop => isPropValid(prop),
})<{
  maxHeightProp: string | number;
  height?: string | number;
  maxHeight?: string | number;
  maxWidth?: string | number;
  minWidth?: string | number;
  width?: string | number;
}>`
  /* Should be a flex container so that when maxHeight is set (to avoid page overflow),
  ListBoxWrap/GridListWrap will also shrink to fit */
  display: flex;
  flex-direction: column;
  overflow: hidden;

  ${p => p.width && `width: ${withUnits(p.width)};`}
  ${p => p.height && `height: ${withUnits(p.height)};`}
  ${p => p.minWidth && `min-width: ${withUnits(p.minWidth)};`}
  max-width: ${p => (p.maxWidth ? `min(${withUnits(p.maxWidth)}, 100%)` : `100%`)};
  max-height: ${p =>
    p.maxHeight
      ? `min(${withUnits(p.maxHeight)}, ${withUnits(p.maxHeightProp)})`
      : withUnits(p.maxHeightProp)};
`;

const StyledPositionWrapper = styled(PositionWrapper, {
  shouldForwardProp: prop => isPropValid(prop),
})<{visible?: boolean; zIndex?: number}>`
  min-width: 100%;
  display: ${p => (p.visible ? 'block' : 'none')};
  z-index: ${p => p?.zIndex};
`;

const MenuFooter = styled('div')`
  box-shadow: 0 -1px 0 ${p => p.theme.tokens.border.transparent.neutral.muted};
  padding: ${space(1)} ${space(1.5)};
  z-index: 2;
`;
