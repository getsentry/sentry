import {AutoSizer, List} from 'react-virtualized';
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

const ItemObjectPropType = {
  value: PropTypes.any,
  searchKey: PropTypes.string,
  label: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
};
const ItemShapePropType = PropTypes.shape(ItemObjectPropType);

class DropdownAutoCompleteMenu extends React.Component {
  static propTypes = {
    items: PropTypes.oneOfType([
      // flat item array
      PropTypes.arrayOf(ItemShapePropType),

      // grouped item array
      PropTypes.arrayOf(
        PropTypes.shape({
          ...ItemObjectPropType,
          items: PropTypes.arrayOf(ItemShapePropType),
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

    /**
     * Hide's the input when there are no items. Avoid using this when querying
     * results in an async fashion.
     */
    emptyHidesInput: PropTypes.bool,

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
     * Max height of dropdown menu. Units are assumed as `px` if number, otherwise will assume string has units
     */
    maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    /**
     * Supplying this height will force the dropdown menu to be a virtualized list.
     * This is very useful (and probably required) if you have a large list. e.g. Project selector with many projects.
     *
     * Currently, our implementation of the virtualized list requires a fixed height.
     */
    virtualizedHeight: PropTypes.number,

    /**
     * Search input's placeholder text
     */
    searchPlaceholder: PropTypes.string,

    /**
     * Size for dropdown items
     */
    itemSize: PropTypes.oneOf(['zero', 'small', '']),

    /**
     * Changes the menu style to have an arrow at the top
     */
    menuWithArrow: PropTypes.bool,

    menuFooter: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
    menuHeader: PropTypes.node,

    /**
     * Props to pass to menu component
     */
    menuProps: PropTypes.object,

    /**
     * Props to pass to input/filter component
     */
    inputProps: PropTypes.object,

    css: PropTypes.object,
    style: PropTypes.object,
  };

  static defaultProps = {
    onSelect: () => {},
    maxHeight: 300,
    blendCorner: true,
    emptyMessage: t('No items'),
    searchPlaceholder: t('Filter search'),
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

    if (!items) return [];

    if (items[0] && items[0].items) {
      //if the first item has children, we assume it is a group
      return _.flatMap(this.filterGroupedItems(items, inputValue), item => {
        return [
          {...item, groupLabel: true},
          ...item.items.map(groupedItem => ({...groupedItem, index: itemCount++})),
        ];
      });
    }

    return this.filterItems(items, inputValue).map((item, index) => ({...item, index}));
  };

  renderList = ({items, ...otherProps}) => {
    const {maxHeight, virtualizedHeight} = this.props;

    // If `virtualizedHeight` is defined, use a virtualized list
    if (typeof virtualizedHeight !== 'undefined') {
      return (
        <AutoSizer disableHeight>
          {({width}) => (
            <List
              width={width}
              height={Math.min(items.length * virtualizedHeight, maxHeight)}
              rowCount={items.length}
              rowHeight={virtualizedHeight}
              rowRenderer={({key, index, style}) => {
                const item = items[index];
                return this.renderRow({
                  item,
                  style,
                  key,
                  ...otherProps,
                });
              }}
            />
          )}
        </AutoSizer>
      );
    }

    return items.map(item => {
      const {index} = item;
      const key = `${item.value}-${index}`;

      return this.renderRow({item, key, ...otherProps});
    });
  };

  renderRow = ({
    item,
    style,
    itemSize,
    key,
    highlightedIndex,
    inputValue,
    getItemProps,
  }) => {
    const {index} = item;

    return item.groupLabel ? (
      !item.hideGroupLabel && (
        <LabelWithBorder style={style} key={item.label || item.id}>
          {item.label && <GroupLabel>{item.label}</GroupLabel>}
        </LabelWithBorder>
      )
    ) : (
      <AutoCompleteItem
        size={itemSize}
        key={key}
        index={index}
        highlightedIndex={highlightedIndex}
        {...getItemProps({item, index, style})}
      >
        {typeof item.label === 'function' ? item.label({inputValue}) : item.label}
      </AutoCompleteItem>
    );
  };

  render() {
    let {
      onSelect,
      onChange,
      onOpen,
      children,
      items,
      menuProps,
      inputProps,
      alignMenu,
      blendCorner,
      maxHeight,
      emptyMessage,
      noResultsMessage,
      style,
      rootClassName,
      menuHeader,
      menuFooter,
      menuWithArrow,
      searchPlaceholder,
      itemSize,
      busy,
      emptyHidesInput,
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
          // Only filter results if menu is open and there are items
          let autoCompleteResults =
            (isOpen && items && this.autoCompleteFilter(items, inputValue)) || [];

          // Can't search if there are no items
          let hasItems = items && !!items.length;

          // Items are loading if null
          let itemsLoading = items === null;
          let hasResults = !!autoCompleteResults.length;
          let showNoItems = !busy && !inputValue && !hasItems;
          // Results mean there was a search (i.e. inputValue)
          let showNoResultsMessage = !busy && inputValue && !hasResults;

          // Hide the input when we have no items to filter, only if
          // emptyHidesInput is set to true.
          let showInput = hasItems || !emptyHidesInput;

          let renderedFooter =
            typeof menuFooter === 'function' ? menuFooter({actions}) : menuFooter;

          return (
            <AutoCompleteRoot {...getRootProps()} className={rootClassName}>
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
                  })}
                >
                  {itemsLoading && <LoadingIndicator mini />}
                  {showInput && (
                    <Flex>
                      <StyledInput
                        autoFocus
                        placeholder={searchPlaceholder}
                        {...getInputProps({...inputProps, onChange})}
                      />
                      <InputLoadingWrapper>
                        {busy && <LoadingIndicator size={16} mini />}
                      </InputLoadingWrapper>
                    </Flex>
                  )}
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
                        this.renderList({
                          items: autoCompleteResults,
                          itemSize,
                          highlightedIndex,
                          inputValue,
                          getItemProps,
                        })}
                    </StyledItemList>

                    {renderedFooter && (
                      <LabelWithPadding>{renderedFooter}</LabelWithPadding>
                    )}
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
    padding: ${space(1)};
    font-weight: normal;
    color: ${p => p.gray2};
  }
`;

const getItemPaddingForSize = size => {
  if (size === 'small') return `${space(0.5)} ${space(1)}`;
  if (size === 'zero') return '0';

  return space(1);
};

const AutoCompleteItem = styled('div')`
  /* needed for virtualized lists that do not fill parent height */
  /* e.g. breadcrumbs (org height > project, but want same fixed height for both) */
  display: flex;
  flex-direction: column;
  justify-content: center;

  font-size: 0.9em;
  background-color: ${p =>
    p.index == p.highlightedIndex ? p.theme.offWhite : 'transparent'};
  padding: ${p => getItemPaddingForSize(p.size)};
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
  z-index: ${p =>
    p.theme.zIndex.dropdownAutocomplete
      .menu}; /* This is needed to be able to cover e.g. pagination buttons, but also be below dropdown actor button's zindex */
  right: 0;
  box-shadow: ${p => p.theme.dropShadowLight};

  ${getMenuBorderRadius};
  ${({alignMenu}) => (alignMenu === 'left' ? 'left: 0;' : '')};

  ${getMenuArrow};
`;

const StyledItemList = styled('div')`
  max-height: ${p =>
    typeof p.maxHeight === 'number' ? `${p.maxHeight}px` : p.maxHeight};
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
