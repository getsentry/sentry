import {css} from 'emotion';
import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AutoComplete from 'app/components/autoComplete';
import Input from 'app/views/settings/components/forms/controls/input';
import space from 'app/styles/space';

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
        })
      ),
    ]),
    isOpen: PropTypes.bool,
    onSelect: PropTypes.func,

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
    menuFooter: PropTypes.element,
    menuHeader: PropTypes.element,

    /**
     * Props to pass to root component
     */
    rootProps: PropTypes.object,
    /**
     * Props to pass to input component
     */
    inputProps: PropTypes.object,
    /**
     * Props to pass to menu component
     */
    menuProps: PropTypes.object,
    /**
     * Render function for Menu
     */
    renderMenu: PropTypes.func,
    /**
     * Max height of menu items, be sure to include units
     */
    maxHeight: PropTypes.string,
    css: PropTypes.object,
    style: PropTypes.object,
  };

  static defaultProps = {
    onSelect: () => {},
    blendCorner: true,
    emptyMessage: t('No items'),
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
      children,
      items,
      menuProps,
      inputProps,
      rootProps,
      alignMenu,
      blendCorner,
      maxHeight,
      emptyMessage,
      noResultsMessage,
      style,
      menuHeader,
      menuFooter,
      renderMenu,
      ...props
    } = this.props;

    // eslint-disable-next-line
    const Menu = renderMenu || StyledMenu;

    return (
      <AutoComplete
        resetInputOnClose
        itemToString={item => ''}
        onSelect={onSelect}
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
          let showNoResultsMessage = inputValue && hasItems && !hasResults;

          return (
            <AutoCompleteRoot {...getRootProps(rootProps)}>
              {children({
                getActorProps,
                actions,
                isOpen,
                selectedItem,
              })}

              {isOpen && (
                <Menu
                  {...getMenuProps({
                    ...menuProps,
                    style,
                    css: this.props.css,
                    blendCorner,
                    alignMenu,
                  })}
                >
                  <StyledInput
                    autoFocus
                    placeholder="Filter search"
                    {...getInputProps(inputProps)}
                  />
                  <MenuContent maxHeight={maxHeight}>
                    {menuHeader && <StyledLabel>{menuHeader}</StyledLabel>}

                    {!hasItems && <EmptyMessage>{emptyMessage}</EmptyMessage>}
                    {showNoResultsMessage && (
                      <EmptyMessage>
                        {noResultsMessage || `${emptyMessage} ${t('found')}`}
                      </EmptyMessage>
                    )}
                    {autoCompleteResults.map(
                      ({index, ...item}) =>
                        item.groupLabel ? (
                          <StyledLabel key={item.value}>{item.label}</StyledLabel>
                        ) : (
                          <AutoCompleteItem
                            key={`${item.value}-${index}`}
                            index={index}
                            highlightedIndex={highlightedIndex}
                            {...getItemProps({item, index})}
                          >
                            {item.label}
                          </AutoCompleteItem>
                        )
                    )}
                    {menuFooter && <StyledLabel>{menuFooter}</StyledLabel>}
                  </MenuContent>
                </Menu>
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

const AutoCompleteRoot = styled('div')`
  position: relative;
  display: inline-block;
`;

const StyledInput = styled(Input)`
  &,
  &:focus {
    border: none;
    border-bottom: 1px solid ${p => p.theme.borderLight};
    border-radius: 0;
    box-shadow: none;
    font-size: 13px;
    padding: ${space(2)} ${space(1)};
    font-weight: normal;
    color: ${p => p.gray2};
  }
`;

const AutoCompleteItem = styled('div')`
  background-color: ${p =>
    p.index == p.highlightedIndex ? p.theme.offWhite : 'transparent'};
  padding: ${space(1)};
  cursor: pointer;
  border-bottom: 1px solid ${p => p.theme.borderLighter};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${p => p.theme.offWhite};
  }
`;

const StyledLabel = styled('div')`
  padding: ${space(0.25)} ${space(1)};
  background-color: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-width: 1px 0;

  &:first-child {
    border-top: none;
  }
`;

const StyledMenu = styled('div')`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  position: absolute;
  top: calc(100% - 1px);
  min-width: 250px;
  z-index: 1;
  max-height: 300px;
  overflow-y: auto;
  right: 0;
  box-shadow: ${p => p.theme.dropShadowLight};

  ${getMenuBorderRadius};
  ${({alignMenu}) => (alignMenu === 'left' ? 'left: 0;' : '')};
`;

const MenuContent = styled('div')`
  overflow-y: auto;
  ${p => p.maxHeight && `max-height: ${p.maxHeight}`};
`;

const EmptyMessage = styled('div')`
  color: ${p => p.theme.gray1};
  padding: ${space(1)} ${space(2)};
  text-align: center;
  font-size: 1.2em;
  text-transform: none;
`;

export default DropdownAutoCompleteMenu;
