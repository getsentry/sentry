import {createContext, Fragment, useCallback, useMemo, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import {AriaPositionProps} from '@react-aria/overlays';
import {mergeProps} from '@react-aria/utils';
import {ListState} from '@react-stately/list';
import {OverlayTriggerState} from '@react-stately/overlays';

import Badge from 'sentry/components/badge';
import {Button} from 'sentry/components/button';
import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {FormSize} from 'sentry/utils/theme';
import useOverlay, {UseOverlayProps} from 'sentry/utils/useOverlay';

import {SelectOption} from './types';

export interface SelectContextValue {
  /**
   * Filter function to determine whether an option should be rendered in the list box.
   * A true return value means the option should be rendered. This function is
   * automatically updated based on the current search string.
   */
  filterOption: (opt: SelectOption<React.Key>) => boolean;
  overlayIsOpen: boolean;
  /**
   * Function to be called once when a list box is initialized, to register its list
   * state in SelectContext. In composite selectors, where there can be multiple list
   * boxes, the `index` parameter is the list box's index number (the order in which it
   * appears). In non-composite selectors, where there's only one list box, that list
   * box's index is 0.
   */
  registerListState: (index: number, listState: ListState<any>) => void;
  /**
   * Function to be called when a list box's selection state changes. We need a complete
   * list of all selected options to label the trigger button. The `index` parameter
   * indentifies the list box, in the same way as in `registerListState`.
   */
  saveSelectedOptions: (
    index: number,
    newSelectedOptions: SelectOption<React.Key> | SelectOption<React.Key>[]
  ) => void;
  /**
   * The control's overlay state. Useful for opening/closing the menu from inside the
   * selector.
   */
  overlayState?: OverlayTriggerState;
}

export const SelectContext = createContext<SelectContextValue>({
  registerListState: () => {},
  saveSelectedOptions: () => {},
  filterOption: () => true,
  overlayIsOpen: false,
});

export interface ControlProps extends UseOverlayProps {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /**
   * If true, there will be a "Clear" button in the menu header.
   */
  isClearable?: boolean;
  /**
   * If true, there will be a loading indicator in the menu header.
   */
  isLoading?: boolean;
  /**
   * If true, there will be a search box on top of the menu, useful for quickly finding
   * menu items.
   */
  isSearchable?: boolean;
  maxMenuHeight?: number | string;
  maxMenuWidth?: number | string;
  /**
   * Title to display in the menu's header. Keep the title as short as possible.
   */
  menuTitle?: React.ReactNode;
  menuWidth?: number | string;
  /**
   * Called when the clear button is clicked (applicable only when `isClearable` is
   * true).
   */
  onClear?: () => void;
  /**
   * Called when the search input's value changes (applicable only when `isSearchable`
   * is true).
   */
  onInputChange?: (value: string) => void;
  /**
   * The search input's placeholder text (applicable only when `isSearchable` is true).
   */
  placeholder?: string;
  /**
   * Position of the overlay menu relative to the trigger button. Allowed for backward
   * compatibility only. Use the `position` prop instead.
   * @deprecated
   */
  placement?: AriaPositionProps['placement'];
  size?: FormSize;
  /**
   * Optional replacement for the default trigger button. Note that the replacement must
   * forward `props` and `ref` its outer wrap, otherwise many accessibility features
   * won't work correctly.
   */
  trigger?: (args: {
    props: Omit<DropdownButtonProps, 'children'>;
    ref: React.RefObject<HTMLButtonElement>;
  }) => React.ReactNode;
  /**
   * Label text inside the default trigger button. This is optional — by default the
   * selected option's label will be used.
   */
  triggerLabel?: React.ReactNode;
  /**
   * Props to be passed to the default trigger button.
   */
  triggerProps?: DropdownButtonProps;
}

/**
 * Controls Select's open state and exposes SelectContext to all chidlren.
 */
export function Control({
  // Control props
  trigger,
  triggerLabel: triggerLabelProp,
  triggerProps,
  isOpen,
  onClose,
  disabled,
  position = 'bottom-start',
  placement,
  offset,
  menuTitle,
  maxMenuHeight = '32rem',
  maxMenuWidth,
  menuWidth,

  // Select props
  size = 'md',
  isSearchable = false,
  placeholder = 'Search…',
  onInputChange,
  isClearable = false,
  onClear,
  isLoading = false,
  children,
  ...wrapperProps
}: ControlProps) {
  // Set up list states (in composite selects, each region has its own state, that way
  // selection values are contained within each region).
  const [listStates, setListStates] = useState<ListState<any>[]>([]);
  const registerListState = useCallback<SelectContextValue['registerListState']>(
    (index, listState) => {
      setListStates(current => [
        ...current.slice(0, index),
        listState,
        ...current.slice(index + 1),
      ]);
    },
    []
  );

  /**
   * Search/filter value, used to filter out the list of displayed elements
   */
  const [search, setSearch] = useState('');
  const updateSearch = useCallback(
    (newValue: string) => {
      setSearch(newValue);
      onInputChange?.(newValue);
    },
    [onInputChange]
  );
  const filterOption = useCallback<SelectContextValue['filterOption']>(
    opt =>
      String(opt.label ?? '')
        .toLowerCase()
        .includes(search.toLowerCase()),
    [search]
  );

  const {keyboardProps: searchKeyboardProps} = useKeyboard({
    onKeyDown: e => {
      // When the search input is focused, and the user presses Arrow Down,
      // we should move the focus to the menu items list.
      if (e.key === 'ArrowDown') {
        e.preventDefault(); // Prevent scroll action
        overlayRef.current?.querySelector<HTMLLIElement>('li[role="option"]')?.focus();
      }

      // Continue propagation, otherwise the overlay won't close on Esc key press
      e.continuePropagation();
    },
  });

  /**
   * Clears selection values across all list box states
   */
  const clearSelection = useCallback(() => {
    listStates.forEach(listState => listState.selectionManager.clearSelection());
    onClear?.();
  }, [onClear, listStates]);

  // Get overlay props. We need to support both the `position` and `placement` props for
  // backward compatibility. TODO: convert existing usages from `placement` to `position`
  const overlayPosition = useMemo(
    () =>
      position ??
      placement
        ?.split(' ')
        .map(key => {
          switch (key) {
            case 'right':
              return 'end';
            case 'left':
              return 'start';
            default:
              return key;
          }
        })
        .join('-'),
    [position, placement]
  );
  const {
    isOpen: overlayIsOpen,
    state: overlayState,
    triggerRef,
    triggerProps: overlayTriggerProps,
    overlayRef,
    overlayProps,
  } = useOverlay({
    type: 'listbox',
    position: overlayPosition,
    offset,
    isOpen,
    onOpenChange: async open => {
      // On open
      if (open) {
        // Wait for overlay to appear/disappear
        await new Promise(resolve => resolve(null));

        const firstSelectedOption = overlayRef.current?.querySelector<HTMLLIElement>(
          'li[role="option"][aria-selected="true"]'
        );

        // Focus on first selected item
        if (firstSelectedOption) {
          firstSelectedOption.focus();
          return;
        }

        // If no item is selected, focus on first item instead
        overlayRef.current?.querySelector<HTMLLIElement>('li[role="option"]')?.focus();
        return;
      }

      // On close
      onClose?.();
      setSearch(''); // Clear search string

      // Wait for overlay to appear/disappear
      await new Promise(resolve => resolve(null));
      triggerRef.current?.focus();
    },
  });

  /**
   * A list of selected options across all select regions, to be used to generate the
   * trigger label.
   */
  const [selectedOptions, setSelectedOptions] = useState<
    Array<SelectOption<React.Key> | SelectOption<React.Key>[]>
  >([]);
  const saveSelectedOptions = useCallback<SelectContextValue['saveSelectedOptions']>(
    (index, newSelectedOptions) => {
      setSelectedOptions(current => [
        ...current.slice(0, index),
        newSelectedOptions,
        ...current.slice(index + 1),
      ]);
    },
    []
  );

  /**
   * Trigger label, generated from current selection values. If more than one option is
   * selected, then a count badge will appear.
   */
  const triggerLabel: React.ReactNode = useMemo(() => {
    if (defined(triggerLabelProp)) {
      return triggerLabelProp;
    }

    const options = selectedOptions.flat().filter(Boolean);

    if (options.length === 0) {
      return <TriggerLabel>{t('None')}</TriggerLabel>;
    }

    return (
      <Fragment>
        <TriggerLabel>{options[0]?.label}</TriggerLabel>
        {options.length > 1 && <StyledBadge text={`+${options.length - 1}`} />}
      </Fragment>
    );
  }, [triggerLabelProp, selectedOptions]);

  const {keyboardProps: triggerKeyboardProps} = useKeyboard({
    onKeyDown: e => {
      // Open the select menu when user presses Arrow Up/Down.
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); // Prevent scroll
        overlayState.open();
      }
    },
  });

  const contextValue = useMemo(
    () => ({
      registerListState,
      saveSelectedOptions,
      overlayState,
      overlayIsOpen,
      filterOption,
    }),
    [registerListState, saveSelectedOptions, overlayState, overlayIsOpen, filterOption]
  );

  const theme = useTheme();
  return (
    <SelectContext.Provider value={contextValue}>
      <ControlWrap {...wrapperProps}>
        {trigger ? (
          trigger(
            mergeProps(triggerProps, triggerKeyboardProps, overlayTriggerProps, {
              size,
              disabled,
              isOpen: overlayIsOpen,
            })
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
          zIndex={theme.zIndex.tooltip}
          visible={overlayIsOpen}
          {...overlayProps}
        >
          <StyledOverlay
            width={menuWidth}
            maxWidth={maxMenuWidth}
            maxHeight={overlayProps.style.maxHeight}
            maxHeightProp={maxMenuHeight}
          >
            <FocusScope contain={overlayIsOpen}>
              {(menuTitle || isClearable) && (
                <MenuHeader size={size} data-header>
                  <MenuTitle>{menuTitle}</MenuTitle>
                  <MenuHeaderTrailingItems>
                    {isLoading && <StyledLoadingIndicator size={12} mini />}
                    {isClearable && (
                      <ClearButton onClick={clearSelection} size="zero" borderless>
                        {t('Clear')}
                      </ClearButton>
                    )}
                  </MenuHeaderTrailingItems>
                </MenuHeader>
              )}
              {isSearchable && (
                <SearchInput
                  placeholder={placeholder}
                  value={search}
                  onChange={e => updateSearch(e.target.value)}
                  visualSize={size}
                  {...searchKeyboardProps}
                />
              )}
              <OptionsWrap>{children}</OptionsWrap>
            </FocusScope>
          </StyledOverlay>
        </StyledPositionWrapper>
      </ControlWrap>
    </SelectContext.Provider>
  );
}

const ControlWrap = styled('div')`
  position: relative;
  width: max-content;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  text-align: left;
`;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
  top: auto;
`;

const headerVerticalPadding: Record<FormSize, string> = {
  xs: space(0.25),
  sm: space(0.5),
  md: space(0.75),
};
const MenuHeader = styled('div')<{size: FormSize}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => headerVerticalPadding[p.size]} ${space(1)}
    ${p => headerVerticalPadding[p.size]} ${space(1.5)};
  box-shadow: 0 1px 0 ${p => p.theme.translucentInnerBorder};
  line-height: ${p => p.theme.text.lineHeightBody};
  z-index: 2;

  font-size: ${p =>
    p.size !== 'xs' ? p.theme.fontSizeSmall : p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.headingColor};
`;

const MenuHeaderTrailingItems = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
`;

const MenuTitle = styled('span')`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: 600;
  white-space: nowrap;
  margin-right: ${space(2)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: ${space(0.5)} ${space(0.5)} ${space(0.5)} ${space(1)};
    height: ${space(1)};
    width: ${space(1)};
  }
`;

const ClearButton = styled(Button)`
  font-size: inherit; /* Inherit font size from MenuHeader */
  color: ${p => p.theme.subText};
  padding: 0 ${space(0.25)};
  margin: 0 -${space(0.25)};
`;

const searchVerticalPadding: Record<FormSize, string> = {
  xs: space(0.25),
  sm: space(0.5),
  md: space(0.5),
};
const SearchInput = styled('input')<{visualSize: FormSize}>`
  appearance: none;
  width: calc(100% - ${space(0.5)} * 2);
  border: solid 1px ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundSecondary};
  font-size: ${p =>
    p.visualSize !== 'xs' ? p.theme.fontSizeMedium : p.theme.fontSizeSmall};

  /* Subtract 1px to account for border width */
  padding: ${p => searchVerticalPadding[p.visualSize]} calc(${space(1)} - 1px);
  margin: ${space(0.5)} ${space(0.5)};

  /* Add 1px to top margin if immediately preceded by menu header, to account for the
  header's shadow border */
  div[data-header] + & {
    margin-top: calc(${space(0.5)} + 1px);
  }

  &:focus,
  &.focus-visible {
    outline: none;
    border-color: ${p => p.theme.focusBorder};
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px;
    background: transparent;
  }
`;

const withUnits = value => (typeof value === 'string' ? value : `${value}px`);

const StyledOverlay = styled(Overlay, {
  shouldForwardProp: prop => isPropValid(prop),
})<{
  maxHeightProp: string | number;
  maxHeight?: string | number;
  maxWidth?: string | number;
  width?: string | number;
}>`
  /* Should be a flex container so that when maxHeight is set (to avoid page overflow),
  ListBoxWrap will also shrink to fit */
  display: flex;
  flex-direction: column;
  overflow: hidden;

  max-height: ${p =>
    p.maxHeight
      ? `min(${withUnits(p.maxHeight)}, ${withUnits(p.maxHeightProp)})`
      : withUnits(p.maxHeightProp)};
  ${p => p.width && `width: ${withUnits(p.width)};`}
  ${p => p.maxWidth && `max-width: ${withUnits(p.maxWidth)};`}
`;

const StyledPositionWrapper = styled(PositionWrapper, {
  shouldForwardProp: prop => isPropValid(prop),
})<{visible?: boolean}>`
  min-width: 100%;
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const OptionsWrap = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 0;
`;
