import * as React from 'react';
import styled from '@emotion/styled';

import AutoComplete from 'sentry/components/autoComplete';
import DropdownBubble from 'sentry/components/dropdownBubble';
import Input from 'sentry/components/forms/controls/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import autoCompleteFilter from './autoCompleteFilter';
import List from './list';
import {Item, ItemsBeforeFilter} from './types';

type AutoCompleteChildrenArgs = Parameters<AutoComplete<Item>['props']['children']>[0];
type Actions = AutoCompleteChildrenArgs['actions'];

export type MenuFooterChildProps = {
  actions: Actions;
};

type ListProps = React.ComponentProps<typeof List>;

type Props = {
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
   * Changes the menu style to have an arrow at the top
   */
  menuWithArrow?: boolean;

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
} & Pick<
  ListProps,
  'virtualizedHeight' | 'virtualizedLabelHeight' | 'itemSize' | 'onScroll'
>;

const Menu = ({
  maxHeight = 300,
  emptyMessage = t('No items'),
  searchPlaceholder = t('Filter search'),
  blendCorner = true,
  alignMenu = 'left',
  hideInput = false,
  busy = false,
  busyItemsStillVisible = false,
  menuWithArrow = false,
  disabled = false,
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
}: Props) => (
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
      inputValue,
      selectedItem,
      highlightedIndex,
      isOpen,
      actions,
    }) => {
      // This is the value to use to filter (default to value in filter input)
      const filterValueOrInput = filterValue ?? inputValue;

      // Can't search if there are no items
      const hasItems = !!items?.length;

      // Only filter results if menu is open and there are items
      const autoCompleteResults =
        (isOpen && hasItems && autoCompleteFilter(items, filterValueOrInput)) || [];

      // Items are loading if null
      const itemsLoading = items === null;

      // Has filtered results
      const hasResults = !!autoCompleteResults.length;

      // No items to display
      const showNoItems = !busy && !filterValueOrInput && !hasItems;

      // Results mean there was an attempt to search
      const showNoResultsMessage =
        !busy && !busyItemsStillVisible && filterValueOrInput && !hasResults;

      // Hide the input when we have no items to filter, only if
      // emptyHidesInput is set to true.
      const showInput = !hideInput && (hasItems || !emptyHidesInput);

      // When virtualization is turned on, we need to pass in the number of
      // selecteable items for arrow-key limits
      const itemCount = virtualizedHeight
        ? autoCompleteResults.filter(i => !i.groupLabel).length
        : undefined;

      const renderedFooter =
        typeof menuFooter === 'function' ? menuFooter({actions}) : menuFooter;

      return (
        <AutoCompleteRoot
          {...getRootProps()}
          className={rootClassName}
          disabled={disabled}
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
            <BubbleWithMinWidth
              className={className}
              {...getMenuProps({
                ...menuProps,
                itemCount,
              })}
              style={style}
              css={css}
              blendCorner={blendCorner}
              alignMenu={alignMenu}
              menuWithArrow={menuWithArrow}
            >
              {itemsLoading && <LoadingIndicator mini />}
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
                {menuHeader && <LabelWithPadding>{menuHeader}</LabelWithPadding>}
                <ItemList data-test-id="autocomplete-list" maxHeight={maxHeight}>
                  {showNoItems && <EmptyMessage>{emptyMessage}</EmptyMessage>}
                  {showNoResultsMessage && (
                    <EmptyMessage>
                      {noResultsMessage ?? `${emptyMessage} ${t('found')}`}
                    </EmptyMessage>
                  )}
                  {busy && (
                    <BusyMessage>
                      <EmptyMessage>{t('Searching\u2026')}</EmptyMessage>
                    </BusyMessage>
                  )}
                  {!busy && (
                    <List
                      items={autoCompleteResults}
                      maxHeight={maxHeight}
                      highlightedIndex={highlightedIndex}
                      inputValue={inputValue}
                      onScroll={onScroll}
                      getItemProps={getItemProps}
                      virtualizedLabelHeight={virtualizedLabelHeight}
                      virtualizedHeight={virtualizedHeight}
                      itemSize={itemSize}
                    />
                  )}
                </ItemList>
                {renderedFooter && <LabelWithPadding>{renderedFooter}</LabelWithPadding>}
              </div>
            </BubbleWithMinWidth>
          )}
        </AutoCompleteRoot>
      );
    }}
  </AutoComplete>
);

export default Menu;

const StyledInput = styled(Input)`
  flex: 1;
  border: 1px solid transparent;
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

export const AutoCompleteRoot = styled(({isOpen: _isOpen, ...props}) => (
  <div {...props} />
))`
  position: relative;
  display: inline-block;
  ${p => p.disabled && 'pointer-events: none;'}
`;

const BubbleWithMinWidth = styled(DropdownBubble)`
  min-width: 250px;
`;

const InputWrapper = styled('div')`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`};
  align-items: center;
`;

const LabelWithPadding = styled('div')`
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
  padding: ${space(0.25)} ${space(1)};
`;

const ItemList = styled('div')<{maxHeight: NonNullable<Props['maxHeight']>}>`
  max-height: ${p => `${p.maxHeight}px`};
  overflow-y: auto;
`;

const BusyMessage = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(1)};
`;
