import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import _ from 'lodash';
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
    alignMenu: PropTypes.oneOf(['left', 'right']),
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
      style,
      css,
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
                    css,
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
                            key={`${item.value}-${item.label}`}
                            highlightedIndex={highlightedIndex}
                            index={item.index}
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

const AutoCompleteRoot = styled(({isOpen, ...props}) => <div {...props} />)`
  position: relative;
  display: inline-block;
`;

const StyledInput = styled(Input)`
  &,
  &:focus {
    border: none;
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
  padding: 4px 8px;
  cursor: pointer;
  &:hover {
    background-color: ${p => p.theme.offWhite};
  }
`;

const StyledLabel = styled('div')`
  padding: 0 8px;
  background-color: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-width: 1px 0;
`;

const StyledMenu = styled(({isOpen, alignMenu, ...props}) => <div {...props} />)`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius}
    ${p => p.theme.borderRadius};
  position: absolute;
  top: calc(100% - 1px);
  min-width: 250px;
  z-index: 1;
  max-height: 300px;
  overflow-y: scroll;
  right: 0;
  border-radius: ${({theme}) =>
    `${theme.borderRadius} 0 ${theme.borderRadius} ${theme.borderRadius}`};

  ${({alignMenu, theme}) =>
    alignMenu === 'left'
      ? `
    left: 0;
    border-radius: 0 ${theme.borderRadius} ${theme.borderRadius} ${theme.borderRadius};
  `
      : ''};
`;

export default DropdownAutoCompleteMenu;
