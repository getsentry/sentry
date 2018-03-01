import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import _ from 'lodash';
import AutoComplete from './autoComplete';
import Input from '../views/settings/components/forms/controls/input';

class DropdownAutoComplete extends React.Component {
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
            })
          ),
        })
      ),
    ]),
    isOpen: PropTypes.bool,
    onSelect: PropTypes.func,
    children: PropTypes.func,
  };

  static defaultProps = {
    isOpen: false,
  };

  constructor(props) {
    super(props);

    this.state = {
      isOpen: this.props.isOpen,
      selectedItem: undefined,
    };
  }

  toggleMenu = () => this.setState({isOpen: !this.state.isOpen});

  openMenu = e => this.setState({isOpen: true});

  onSelect = selectedItem => {
    this.setState({selectedItem});
    if (this.props.onSelect) this.props.onSelect(selectedItem);
    this.toggleMenu();
  };

  filterItems = (items, inputValue) =>
    items.filter(item => {
      return (
        item.value.toLowerCase().indexOf(inputValue.toLowerCase()) > -1 ||
        item.label.toLowerCase().indexOf(inputValue.toLowerCase()) > -1
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
          {...item.group, groupLabel: true},
          ...item.items.map(groupedItem => ({...groupedItem, index: itemCount++})),
        ];
      });
    } else {
      return this.filterItems(items, inputValue).map((item, index) => ({...item, index}));
    }
  };

  render() {
    return (
      <div style={{position: 'relative', display: 'inline-block'}}>
        {this.state.isOpen && (
          <StyledMenu>
            <AutoComplete itemToString={item => item.searchKey} onSelect={this.onSelect}>
              {({
                getRootProps,
                getInputProps,
                getMenuProps,
                getItemProps,
                inputValue,
                selectedItem,
                highlightedIndex,
                isOpen,
              }) => {
                return (
                  <div {...getRootProps()}>
                    <StyledInputContainer>
                      <StyledInput
                        autoFocus
                        {...getInputProps({onBlur: this.toggleMenu})}
                      />
                    </StyledInputContainer>
                    <div {...getMenuProps()}>
                      <div>
                        {this.autoCompleteFilter(this.props.items, inputValue).map(
                          (item, index) =>
                            item.groupLabel ? (
                              <StyledLabel key={item.value}>{item.label}</StyledLabel>
                            ) : (
                              <StyledItem
                                key={item.value}
                                highlightedIndex={highlightedIndex}
                                index={item.index}
                                {...getItemProps({item, index: item.index})}
                              >
                                {item.label}
                              </StyledItem>
                            )
                        )}
                      </div>
                    </div>
                  </div>
                );
              }}
            </AutoComplete>
          </StyledMenu>
        )}
        <div onClick={this.openMenu}>
          {this.props.children({
            isOpen: this.state.isOpen,
            selectedItem: this.state.selectedItem,
          })}
        </div>
      </div>
    );
  }
}

const StyledInput = styled(Input)`
  height: 1.75em;
  font-size: 0.75em;
`;

const StyledItem = styled('div')`
  background-color: ${p =>
    p.index == p.highlightedIndex ? p.theme.offWhite : 'transparent'};
  padding: 0.25em 0.5em;
  cursor: pointer;
  &:hover {
    background-color: ${p => p.theme.offWhite};
  }
`;

const StyledInputContainer = styled('div')`
  padding: 0.75em 0.5em;
`;

const StyledLabel = styled('div')`
  padding: 0 0.5em;
  background-color: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-width: 1px 0;
`;

const StyledMenu = styled('div')`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius}
    ${p => p.theme.borderRadius};
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  min-width: 250px;
  font-size: 0.9em;
`;

export default DropdownAutoComplete;
