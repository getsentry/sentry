import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import AutoComplete from 'app/components/autoComplete';
import Input from 'app/views/settings/components/forms/controls/input';
import space from 'app/styles/space';
import LoadingIndicator from 'app/components/loadingIndicator';

class DropdownAutoCompleteMenu extends React.Component {
  static propTypes = {
    items: PropTypes.oneOfType([
      // flat item array
      PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string,
          label: PropTypes.node,
        })
      ),
      // grouped item array
      PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string,
          label: PropTypes.node,
          items: PropTypes.arrayOf(
            PropTypes.shape({
              value: PropTypes.string,
              label: PropTypes.node,
              searchKey: PropTypes.string,
            })
          ),
          // Should hide group label
          hideGroupLabel: PropTypes.bool,
        })
      ),
    ]),
    isOpen: PropTypes.bool,

    /**
     * Show loading indicator next to input
     */
    busy: PropTypes.bool,

    onSelect: PropTypes.func,
    /**
     * When AutoComplete input changes
     */
    onChange: PropTypes.func,

    /**
     * Callback for when dropdown menu opens
     */
    onOpen: PropTypes.func,

    /**
     * Message to display when there are no items initially
     */
    emptyMessage: PropTypes.node,

    /**
     * Message to display when there are no items that match the search
     */
    noResultsMessage: PropTypes.node,

    /**
     * Presentational properties
     */

    /**
     * Dropdown menu alignment.
     */
    alignMenu: PropTypes.oneOf(['left', 'right']),

    /**
     * Should menu visually lock to a direction (so we don't display a rounded corner)
     */
    blendCorner: PropTypes.bool,

    /**
     * Max height of dropdown menu
     */
    maxHeight: PropTypes.number,

    /**
     * Add z-index to menu. Note this is not added by default because some
     * implementations of DropdownAutocomplete DEPEND on no z-index.
     * This is when we want to blend the bottom border of the actor button with the dropdown menu
     * so that it looks a bit more seamless.
     */
    zIndex: PropTypes.number,

    /**
     * Search input's placeholder text
     */
    searchPlaceholder: PropTypes.string,

    /**
     * Padding value for search input (requires the `padding` shortcut value)
     */
    searchPadding: PropTypes.string,

    /**
     * Padding value for dropdown items (requires the `padding` shortcut value)
     */
    itemPadding: PropTypes.string,

    /**
     * Changes the menu style to have an arrow at the top
     */
    menuWithArrow: PropTypes.bool,

    menuFooter: PropTypes.element,
    menuHeader: PropTypes.element,

    /**
     * Props to pass to menu component
     */
    menuProps: PropTypes.object,

    css: PropTypes.object,
    style: PropTypes.object,
  };

  static defaultProps = {
    onSelect: () => {},
    maxHeight: 300,
    blendCorner: true,
    emptyMessage: t('No items'),
    searchPlaceholder: t('Filter search'),
    searchPadding: `${space(1)}`,
    itemPadding: `${space(1)}`,
  };

  filterItems = (items, inputValue) =>
    items.filter(item => {
      return (
        (item.searchKey || `${item.value} ${item.label}`)
          .toLowerCase()
          .indexOf(inputValue.toLowerCase()) > -1
      );
    });

  filterGroupedItems = (groups, inputValue) =>
    groups
      .map(group => {
        return {
          ...group,
          items: this.filterItems(group.items, inputValue),
        };
      })
      .filter(group => group.items.length > 0);

  autoCompleteFilter = (items, inputValue) => {
    let itemCount = 0;

    if (items[0] && items[0].items) {
      //if the first item has children, we assume it is a group
      return _.flatMap(this.filterGroupedItems(items, inputValue), item => {
        return [
          {...item, groupLabel: true},
          ...item.items.map(groupedItem => ({...groupedItem, index: itemCount++})),
        ];
      });
    } else {
      return this.filterItems(items, inputValue).map((item, index) => ({...item, index}));
    }
  };

  render() {
    let {
      onSelect,
      onChange,
      onOpen,
      children,
      items,
      menuProps,
      alignMenu,
      blendCorner,
      maxHeight,
      emptyMessage,
      noResultsMessage,
      style,
      menuHeader,
      menuFooter,
      menuWithArrow,
      searchPlaceholder,
      searchPadding,
      itemPadding,
      busy,
      zIndex,
      ...props
    } = this.props;

    return (
      <AutoComplete
        resetInputOnClose
        itemToString={item => ''}
        onSelect={onSelect}
        inputIsActor={false}
        onOpen={onOpen}
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
          // Only filter results if menu is open
          let autoCompleteResults =
            (isOpen && this.autoCompleteFilter(items, inputValue)) || [];
          let hasItems = items && !!items.length;
          let hasResults = !!autoCompleteResults.length;
          let showNoItems = !busy && !inputValue && !hasItems;
          // Results mean there was a search (i.e. inputValue)
          let showNoResultsMessage = !busy && inputValue && !hasResults;

          return (
            <AutoCompleteRoot {...getRootProps()}>
              {children({
                getActorProps,
                actions,
                isOpen,
                selectedItem,
              })}

              {isOpen && (
                <StyledMenu
                  {...getMenuProps({
                    ...menuProps,
                    style,
                    isStyled: true,
                    css: this.props.css,
                    blendCorner,
                    alignMenu,
                    menuWithArrow,
                    zIndex,
                  })}
                >
                  <Flex>
                    <StyledInput
                      autoFocus
                      placeholder={searchPlaceholder}
                      padding={searchPadding}
                      {...getInputProps({onChange})}
                    />
                    <InputLoadingWrapper>
                      {busy && <LoadingIndicator size={16} mini />}
                    </InputLoadingWrapper>
                  </Flex>
                  <div>
                    {menuHeader && <LabelWithPadding>{menuHeader}</LabelWithPadding>}

                    <StyledItemList maxHeight={maxHeight}>
                      {showNoItems && <EmptyMessage>{emptyMessage}</EmptyMessage>}
                      {showNoResultsMessage && (
                        <EmptyMessage>
                          {noResultsMessage || `${emptyMessage} ${t('found')}`}
                        </EmptyMessage>
                      )}
                      {busy && (
                        <Flex justify="center" p={1}>
                          <EmptyMessage>{t('Searching...')}</EmptyMessage>
                        </Flex>
                      )}
                      {!busy &&
                        autoCompleteResults.map(
                          ({index, ...item}) =>
                            item.groupLabel ? (
                              !item.hideGroupLabel && (
                                <LabelWithBorder key={item.label || item.id}>
                                  {item.label && <GroupLabel>{item.label}</GroupLabel>}
                                </LabelWithBorder>
                              )
                            ) : (
                              <AutoCompleteItem
                                padding={itemPadding}
                                key={`${item.value}-${index}`}
                                index={index}
                                highlightedIndex={highlightedIndex}
                                {...getItemProps({item, index})}
                              >
                                {typeof item.label === 'function'
                                  ? item.label({inputValue})
                                  : item.label}
                              </AutoCompleteItem>
                            )
                        )}
                    </StyledItemList>

                    {menuFooter && <LabelWithPadding>{menuFooter}</LabelWithPadding>}
                  </div>
                </StyledMenu>
              )}
            </AutoCompleteRoot>
          );
        }}
      </AutoComplete>
    );
  }
}

/**
 * If `blendCorner` is false, then we apply border-radius to all corners
 *
 * Otherwise apply radius to opposite side of `alignMenu`
 */
const getMenuBorderRadius = ({blendCorner, alignMenu, theme}) => {
  let radius = theme.borderRadius;
  if (!blendCorner) {
    return css`
      border-radius: ${radius};
    `;
  }

  let hasTopLeftRadius = alignMenu !== 'left';
  let hasTopRightRadius = !hasTopLeftRadius;

  return css`
    border-radius: ${hasTopLeftRadius ? radius : 0} ${hasTopRightRadius ? radius : 0}
      ${radius} ${radius};
  `;
};

const getMenuArrow = ({menuWithArrow, alignMenu}) => {
  if (!menuWithArrow) return '';
  let alignRight = alignMenu === 'right';

  return css`
    top: 32px;

    &::before {
      width: 0;
      height: 0;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-bottom: 9px solid rgba(52, 60, 69, 0.35);
      content: '';
      display: block;
      position: absolute;
      top: -9px;
      left: 10px;
      z-index: -2;
      ${alignRight && 'left: auto;'};
      ${alignRight && 'right: 10px;'};
    }

    &:after {
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid #fff;
      content: '';
      display: block;
      position: absolute;
      top: -8px;
      left: 11px;
      z-index: -1;
      ${alignRight && 'left: auto;'};
      ${alignRight && 'right: 11px;'};
    }
  `;
};

const AutoCompleteRoot = styled(({isOpen, ...props}) => <div {...props} />)`
  position: relative;
  display: inline-block;
`;

const InputLoadingWrapper = styled(Flex)`
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  flex-shrink: 0;
  width: 30px;
`;

const StyledInput = styled(Input)`
  flex: 1;

  &,
  &:focus,
  &:active,
  &:hover {
    border: 1px solid transparent;
    border-bottom: 1px solid ${p => p.theme.borderLight};
    border-radius: ${p => `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`};
    box-shadow: none;
    font-size: 13px;
    padding: ${p => p.padding};
    font-weight: normal;
    color: ${p => p.gray2};
  }
`;

const AutoCompleteItem = styled('div')`
  font-size: 0.9em;
  background-color: ${p =>
    p.index == p.highlightedIndex ? p.theme.offWhite : 'transparent'};
  padding: ${p => p.padding};
  cursor: pointer;
  border-bottom: 1px solid ${p => p.theme.borderLighter};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${p => p.theme.offWhite};
  }
`;

const LabelWithBorder = styled('div')`
  background-color: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-width: 1px 0;

  &:first-child {
    border-top: none;
  }
  &:last-child {
    border-bottom: none;
  }
`;

const LabelWithPadding = styled(LabelWithBorder)`
  padding: ${space(0.25)} ${space(1)};
`;

const GroupLabel = styled('div')`
  padding: ${space(0.25)} ${space(1)};
`;

const StyledMenu = styled('div')`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  position: absolute;
  top: calc(100% - 1px);
  min-width: 250px;
  ${p => (p.zIndex > 0 ? `z-index: ${p.zIndex};` : '')};
  right: 0;
  box-shadow: ${p => p.theme.dropShadowLight};

  ${getMenuBorderRadius};
  ${({alignMenu}) => (alignMenu === 'left' ? 'left: 0;' : '')};

  ${getMenuArrow};
`;

const StyledItemList = styled('div')`
  max-height: ${p => p.maxHeight}px;
  overflow-y: auto;
`;

const EmptyMessage = styled('div')`
  color: ${p => p.theme.gray1};
  padding: ${space(2)};
  text-align: center;
  text-transform: none;
`;

export default DropdownAutoCompleteMenu;

export {StyledMenu};
