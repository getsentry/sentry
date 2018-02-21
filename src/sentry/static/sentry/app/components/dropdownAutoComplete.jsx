import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import _ from 'lodash';
import AutoComplete from './autoComplete';
import Input from '../views/settings/components/forms/styled/input.jsx';

class DropdownAutoComplete extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: this.props.isOpen || false,
    };
  }

  toggleOpen = _.throttle(() => {
    this.setState({isOpen: !this.state.isOpen});
  }, 1);

  onSelect = selectedItem => {
    if (this.props.onSelect) this.props.onSelect(selectedItem);
    this.toggleOpen();
  };

  ungroupItems = items => {
    return items.reduce((accumulator, item, index) => {
      const labelItem = {type: 'label', content: item.groupLabel};
      const groupItems = item.groupItems.map((gi, i) => ({
        type: 'item',
        group: item.groupLabel,
        ...gi,
      }));

      return [...accumulator, labelItem, ...groupItems];
    }, []);
  };

  applyAutocompleteFilter = (inputValue, items) => {
    const flattenedItems = items[0].groupItems ? this.ungroupItems(items) : items;

    const filteredItems = flattenedItems.filter(
      i =>
        i.type == 'label' ||
        i.searchKey.toLowerCase().indexOf(inputValue.toLowerCase()) > -1
    );

    const filteredLabels = filteredItems.filter(
      l =>
        l.type == 'item' ||
        (l.type == 'label' && filteredItems.filter(i => i.group == l.content).length > 0)
    );

    let itemCounter = 0;
    const filteredLabelsWithIndeces = filteredLabels.map(i => {
      if (i.type == 'item') {
        return {...i, index: itemCounter++};
      }
      return i;
    });

    return filteredLabelsWithIndeces;
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
                        {...getInputProps({onBlur: this.toggleOpen})}
                      />
                    </StyledInputContainer>
                    <div {...getMenuProps()}>
                      <div>
                        {this.applyAutocompleteFilter(inputValue, this.props.items).map(
                          (item, index) =>
                            item.searchKey ? (
                              <StyledItem
                                key={index}
                                highlightedIndex={highlightedIndex}
                                index={item.index}
                                {...getItemProps({item, index: item.index})}
                              >
                                {item.content}
                              </StyledItem>
                            ) : (
                              <StyledLabel key={index}>{item.content}</StyledLabel>
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
        <div onClick={this.toggleOpen}>
          {this.props.children({
            isOpen: this.state.isOpen,
          })}
        </div>
      </div>
    );
  }
}

DropdownAutoComplete.propTypes = {
  items: PropTypes.array,
  isOpen: PropTypes.bool,
  onSelect: PropTypes.func,
  children: PropTypes.func,
};

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
