import {useCallback} from 'react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';

import AutoComplete from 'sentry/components/autoComplete';
import DropdownBubble from 'sentry/components/dropdownBubble';
import Input from 'sentry/components/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import defaultAutoCompleteFilter from './autoCompleteFilter';
import List from './list';
import {Item, ItemsBeforeFilter} from './types';

type AutoCompleteChildrenArgs = Parameters<AutoComplete<Item>['props']['children']>[0];
type Actions = AutoCompleteChildrenArgs['actions'];

export type MenuFooterChildProps = {
  actions: Actions;
};

type ListProps = React.ComponentProps<typeof List>;

export interface MenuProps
  extends Pick<
    ListProps,
    'virtualizedHeight' | 'virtualizedLabelHeight' | 'itemSize' | 'onScroll'
  > {
  children: (
    args: Pick<
      AutoCompleteChildrenArgs,
      'getInputProps' | 'getActorProps' | 'actions' | 'isOpen' | 'selectedItem'
    >
  ) => React.ReactNode;
  /** null items indicates loading */
  items: ItemsBeforeFilter | null;

  /**
   * Dropdown menu alignment.
   */
  alignMenu?: 'left' | 'right';
  /**
   * Optionally provide a custom implementation for filtering result items
   * Useful if you want to show items that don't strictly match the input value
   */
  autoCompleteFilter?: typeof defaultAutoCompleteFilter;
  /**
   * Should menu visually lock to a direction (so we don't display a rounded corner)
   */
  blendCorner?: boolean;

  /**
   * Show loading indicator next to input and "Searching..." text in the list
   */
  busy?: boolean;

  /**
   * Show loading indicator next to input but don't hide list items
   */
  busyItemsStillVisible?: boolean;

  /**
   * for passing  styles to the DropdownBubble
   */
  className?: string;

  /**
   * AutoComplete prop
   */
  closeOnSelect?: boolean;

  css?: any;

  'data-test-id'?: string;

  /**
   * If true, the menu will be visually detached from actor.
   */
  detached?: boolean;

  /**
   * Disables padding for the label.
   */
  disableLabelPadding?: boolean;

  /**
   * passed down to the AutoComplete Component
   */
  disabled?: boolean;

  /**
   * Hide's the input when there are no items. Avoid using this when querying
   * results in an async fashion.
   */
  emptyHidesInput?: boolean;

  /**
   * Message to display when there are no items initially
   */
  emptyMessage?: React.ReactNode;

  /**
   * If this is undefined, autocomplete filter will use this value instead of the
   * current value in the filter input element.
   *
   * This is useful if you need to strip characters out of the search
   */
  filterValue?: string;

  /**
   * Hides the default filter input
   */
  hideInput?: boolean;

  /**
   * renderProp for the end (right side) of the search input
   */
  inputActions?: React.ReactElement;

  /**
   * Props to pass to input/filter component
   */
  inputProps?: {style: React.CSSProperties};

  /**
   * Used to control the input value (optional)
   */
  inputValue?: string;

  /**
   * Used to control dropdown state (optional)
   */
  isOpen?: boolean;

  /**
   * Max height of dropdown menu. Units are assumed as `px`
   */
  maxHeight?: ListProps['maxHeight'];

  menuFooter?:
    | React.ReactElement
    | ((props: MenuFooterChildProps) => React.ReactElement | null);

  menuHeader?: React.ReactElement;

  /**
   * Props to pass to menu component
   */
  menuProps?: Parameters<AutoCompleteChildrenArgs['getMenuProps']>[0];

  /**
   * Minimum menu width, defaults to 250
   */
  minWidth?: number;

  /**
   * Message to display when there are no items that match the search
   */
  noResultsMessage?: React.ReactNode;

  /**
   * When AutoComplete input changes
   */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;

  /**
   * Callback for when dropdown menu closes
   */
  onClose?: () => void;

  /**
   * Callback for when the input value changes
   */
  onInputValueChange?: (value: string) => void;

  /**
   * Callback for when dropdown menu opens
   */
  onOpen?: (event?: React.MouseEvent) => void;

  /**
   * When an item is selected (via clicking dropdown, or keyboard navigation)
   */
  onSelect?: (
    item: Item,
    state?: AutoComplete<Item>['state'],
    e?: React.MouseEvent | React.KeyboardEvent
  ) => void;
  /**
   * for passing simple styles to the root container
   */
  rootClassName?: string;

  /**
   * Search input's placeholder text
   */
  searchPlaceholder?: string;
  /**
   * the styles are forward to the Autocomplete's getMenuProps func
   */
  style?: React.CSSProperties;
  /**
   * Optional element to be rendered on the right side of the dropdown menu
   */
  subPanel?: React.ReactNode;
}

function Menu({
  autoCompleteFilter = defaultAutoCompleteFilter,
  maxHeight = 300,
  emptyMessage = t('No items'),
  searchPlaceholder = t('Filter search'),
  blendCorner = true,
  detached = false,
  alignMenu = 'left',
  minWidth = 250,
  hideInput = false,
  disableLabelPadding = false,
  busy = false,
  busyItemsStillVisible = false,
  disabled = false,
  subPanel = null,
  itemSize,
  virtualizedHeight,
  virtualizedLabelHeight,
  menuProps,
  noResultsMessage,
  inputProps,
  children,
  rootClassName,
  className,
  emptyHidesInput,
  menuHeader,
  filterValue,
  items,
  menuFooter,
  style,
  onScroll,
  inputActions,
  onChange,
  onSelect,
  onOpen,
  onClose,
  css,
  closeOnSelect,
  'data-test-id': dataTestId,
  ...props
}: MenuProps) {
  // Can't search if there are no items
  const hasItems = !!items?.length;

  // Items are loading if null
  const itemsLoading = items === null;

  // Hide the input when we have no items to filter, only if
  // emptyHidesInput is set to true.
  const showInput = !hideInput && (hasItems || !emptyHidesInput);

  // Only redefine the autocomplete function if our items list has changed.
  // This avoids producing a new array on every call.
  const stableItemFilter = useCallback(
    (filterValueOrInput: string) => autoCompleteFilter(items, filterValueOrInput),
    [autoCompleteFilter, items]
  );

  // Memoize the filterValueOrInput to the stableItemFilter so that we get the
  // same list every time when the filter value doesn't change.
  const getFilteredItems = memoize(stableItemFilter);

  return (
    <AutoComplete
      onSelect={onSelect}
      inputIsActor={false}
      onOpen={onOpen}
      onClose={onClose}
      disabled={disabled}
      closeOnSelect={closeOnSelect}
      resetInputOnClose
      {...props}
    >
      {({
        getActorProps,
        getRootProps,
        getInputProps,
        getMenuProps,
        getItemProps,
        registerItemCount,
        registerVisibleItem,
        inputValue,
        selectedItem,
        highlightedIndex,
        isOpen,
        actions,
      }) => {
        // This is the value to use to filter (default to value in filter input)
        const filterValueOrInput = filterValue ?? inputValue;

        // Only filter results if menu is open and there are items. Uses
        // `getFilteredItems` to ensure we get a stable items list back.
        const autoCompleteResults =
          isOpen && hasItems ? getFilteredItems(filterValueOrInput) : [];

        // Has filtered results
        const hasResults = !!autoCompleteResults.length;

        // No items to display
        const showNoItems = !busy && !filterValueOrInput && !hasItems;

        // Results mean there was an attempt to search
        const showNoResultsMessage =
          !busy && !busyItemsStillVisible && filterValueOrInput && !hasResults;

        // When virtualization is turned on, we need to pass in the number of
        // selectable items for arrow-key limits
        const itemCount = virtualizedHeight
          ? autoCompleteResults.filter(i => !i.groupLabel).length
          : undefined;

        const renderedFooter =
          typeof menuFooter === 'function' ? menuFooter({actions}) : menuFooter;

        // XXX(epurkhiser): Would be better if this happened in a useEffect,
        // but hooks do not work inside render-prop callbacks.
        registerItemCount(itemCount);

        return (
          <AutoCompleteRoot
            {...getRootProps()}
            className={rootClassName}
            disabled={disabled}
            data-is-open={isOpen}
            data-test-id={dataTestId}
          >
            {children({
              getInputProps,
              getActorProps,
              actions,
              isOpen,
              selectedItem,
            })}
            {isOpen && (
              <StyledDropdownBubble
                className={className}
                {...getMenuProps(menuProps)}
                {...{style, css, blendCorner, detached, alignMenu, minWidth}}
              >
                <DropdownMainContent minWidth={minWidth}>
                  {showInput && (
                    <InputWrapper>
                      <StyledInput
                        autoFocus
                        placeholder={searchPlaceholder}
                        {...getInputProps({...inputProps, onChange})}
                      />
                      <InputLoadingWrapper>
                        {(busy || busyItemsStillVisible) && (
                          <LoadingIndicator size={16} mini />
                        )}
                      </InputLoadingWrapper>
                      {inputActions}
                    </InputWrapper>
                  )}
                  <div>
                    {menuHeader && (
                      <LabelWithPadding disableLabelPadding={disableLabelPadding}>
                        {menuHeader}
                      </LabelWithPadding>
                    )}
                    <ItemList data-test-id="autocomplete-list" maxHeight={maxHeight}>
                      {showNoItems && <EmptyMessage>{emptyMessage}</EmptyMessage>}
                      {showNoResultsMessage && (
                        <EmptyMessage>
                          {noResultsMessage ?? `${emptyMessage} ${t('found')}`}
                        </EmptyMessage>
                      )}
                      {(itemsLoading || busy) && (
                        <BusyMessage>
                          {itemsLoading && <LoadingIndicator mini />}
                          {busy && <EmptyMessage>{t('Searching\u2026')}</EmptyMessage>}
                        </BusyMessage>
                      )}
                      {!busy && (
                        <List
                          items={autoCompleteResults}
                          {...{
                            maxHeight,
                            highlightedIndex,
                            inputValue,
                            onScroll,
                            getItemProps,
                            registerVisibleItem,
                            virtualizedLabelHeight,
                            virtualizedHeight,
                            itemSize,
                          }}
                        />
                      )}
                    </ItemList>
                    {renderedFooter && (
                      <LabelWithPadding disableLabelPadding={disableLabelPadding}>
                        {renderedFooter}
                      </LabelWithPadding>
                    )}
                  </div>
                </DropdownMainContent>
                {subPanel}
              </StyledDropdownBubble>
            )}
          </AutoCompleteRoot>
        );
      }}
    </AutoComplete>
  );
}

export default Menu;

const StyledInput = styled(Input)`
  flex: 1;
  border: 1px solid transparent;
  border-radius: calc(${p => p.theme.panelBorderRadius} - 1px);
  &,
  &:focus,
  &:active,
  &:hover {
    border: 0;
    box-shadow: none;
    font-size: 13px;
    padding: ${space(1)};
    font-weight: normal;
    color: ${p => p.theme.gray300};
  }
`;

const InputLoadingWrapper = styled('div')`
  display: flex;
  background: ${p => p.theme.background};
  align-items: center;
  flex-shrink: 0;
  width: 30px;
  .loading.mini {
    height: 16px;
    margin: 0;
  }
`;

const EmptyMessage = styled('div')`
  color: ${p => p.theme.gray200};
  padding: ${space(2)};
  text-align: center;
  text-transform: none;
`;

export const AutoCompleteRoot = styled('div')<{disabled?: boolean}>`
  position: relative;
  display: inline-block;
  ${p => p.disabled && 'pointer-events: none;'}
`;

const StyledDropdownBubble = styled(DropdownBubble)<{minWidth: number}>`
  display: flex;
  min-width: ${p => p.minWidth}px;

  ${p => p.detached && p.alignMenu === 'left' && 'right: auto;'}
  ${p => p.detached && p.alignMenu === 'right' && 'left: auto;'}
`;

const DropdownMainContent = styled('div')<{minWidth: number}>`
  width: 100%;
  min-width: ${p => p.minWidth}px;
`;

const InputWrapper = styled('div')`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p =>
    `calc(${p.theme.panelBorderRadius} - 1px) calc(${p.theme.panelBorderRadius} - 1px) 0 0`};
  align-items: center;
`;

const LabelWithPadding = styled('div')<{disableLabelPadding: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  border-width: 1px 0;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  &:first-child {
    border-top: none;
  }
  &:last-child {
    border-bottom: none;
  }
  padding: ${p => !p.disableLabelPadding && `${space(0.25)} ${space(1)}`};
`;

const ItemList = styled('div')<{maxHeight: NonNullable<MenuProps['maxHeight']>}>`
  max-height: ${p => `${p.maxHeight}px`};
  overflow-y: auto;
`;

const BusyMessage = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(3)} ${space(1)};
`;
