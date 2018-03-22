import {css} from 'emotion';
import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import styled from 'react-emotion';

import AutoComplete from './autoComplete';
import Input from '../views/settings/components/forms/controls/input';

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
     * Props to pass to menu component
     */
    menuProps: PropTypes.object,
    css: PropTypes.object,
    style: PropTypes.object,
  };

  static defaultProps = {
    onSelect: () => {},
    blendCorner: true,
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
      alignMenu,
      blendCorner,
      style,
      menuHeader,
      menuFooter,
      ...props
    } = this.props;

    return (
      <AutoComplete itemToString={item => ''} onSelect={onSelect} {...props}>
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
                    css: this.props.css,
                    blendCorner,
                    alignMenu,
                  })}
                >
                  <StyledInput
                    autoFocus
                    placeholder="Filter search"
                    {...getInputProps()}
                  />
                  <div>
                    {menuHeader && <StyledLabel>{menuHeader}</StyledLabel>}
                    {this.autoCompleteFilter(items, inputValue).map(
                      (item, index) =>
                        item.groupLabel ? (
                          <StyledLabel key={index}>{item.label}</StyledLabel>
                        ) : (
                          <AutoCompleteItem
                            key={`${item.value}-${index}`}
                            index={index}
                            highlightedIndex={highlightedIndex}
                            {...getItemProps({item, index: item.index})}
                          >
                            {item.label}
                          </AutoCompleteItem>
                        )
                    )}
                    {menuFooter && <StyledLabel>{menuFooter}</StyledLabel>}
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

const AutoCompleteRoot = styled(({isOpen, ...props}) => <div {...props} />)`
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
    padding: 12px 8px;
    font-weight: normal;
    color: ${p => p.gray2};
  }
`;

const AutoCompleteItem = styled('div')`
  background-color: ${p =>
    p.index == p.highlightedIndex ? p.theme.offWhite : 'transparent'};
  padding: 10px;
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
  padding: 2px 8px;
  background-color: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-width: 1px 0;

  &:first-child {
    border-top: none;
  }
`;

const StyledMenu = styled(({isOpen, blendCorner, alignMenu, ...props}) => (
  <div {...props} />
))`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  position: absolute;
  top: calc(100% - 1px);
  min-width: 250px;
  z-index: 1;
  max-height: 300px;
  overflow-y: auto;
  right: 0;
  box-shadow ${p => p.theme.dropShadowLight};

  ${getMenuBorderRadius};
  ${({alignMenu}) => (alignMenu === 'left' ? 'left: 0;' : '')};
`;

export default DropdownAutoCompleteMenu;
