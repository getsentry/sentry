import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import AutoComplete from './autoComplete';
import Input from '../views/settings/components/forms/styled/input';

class DropdownAutoComplete extends React.Component {
  static propTypes = {
    items: PropTypes.array,
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
    };
  }

  toggleMenu = () => this.setState({isOpen: !this.state.isOpen});

  openMenu = e => this.setState({isOpen: true});

  onSelect = selectedItem => {
    this.setState({selectedItem});
    if (this.props.onSelect) this.props.onSelect(selectedItem);
    this.toggleMenu();
  };

  ungroupItems = itemsToUngroup =>
    itemsToUngroup.reduce((accumulator, {group, items}) => {
      return [
        ...accumulator,
        {...group, group: true},
        ...items.map(g => ({...g, groupedWith: group.value})),
      ];
    }, []);

  filterItems = (items, inputValue) =>
    items.filter(
      i => i.group || i.value.toLowerCase().indexOf(inputValue.toLowerCase()) > -1
    );

  removeUnusedGroups = items =>
    items.filter(i => !i.group || (i.group && items.some(g => i.value == g.groupedWith)));

  autocompleteFilter = (items, inputValue) => {
    const transformedItems = items[0].items
      ? this.removeUnusedGroups(this.filterItems(this.ungroupItems(items), inputValue))
      : this.filterItems(items, inputValue);

    let itemCounter = 0;
    return transformedItems.map(i => {
      return !i.group ? {...i, index: itemCounter++} : i;
    });
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
                        {this.autocompleteFilter(this.props.items, inputValue).map(
                          (item, index) =>
                            item.group ? (
                              <StyledLabel key={index}>{item.label}</StyledLabel>
                            ) : (
                              <StyledItem
                                key={index}
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
