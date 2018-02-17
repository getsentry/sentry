import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import styled from 'react-emotion';
import AutoComplete from './autoComplete';
import Button from './buttons/button';
import InlineSvg from './inlineSvg';
import Input from '../views/settings/components/forms/styled/input.jsx';

const DropdownAutoComplete = ({items, onBlur, onSelect}) => {
  const ungroupItems = () => {
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

  const applyAutocompleteFilter = inputValue => {
    const flattenedItems = items[0].groupItems ? ungroupItems() : items;

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

  return (
    <AutoComplete itemToString={item => item.searchKey} onSelect={onSelect}>
      {({
        getRootProps,
        getInputProps,
        getMenuProps,
        getItemProps,
        inputValue,
        highlightedIndex,
      }) => {
        return (
          <div {...getRootProps()}>
            <StyledInputContainer>
              <StyledInput autoFocus {...getInputProps({})} onBlur={onBlur} />
            </StyledInputContainer>
            <div {...getMenuProps()}>
              <div>
                {applyAutocompleteFilter(inputValue).map(
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
  );
};

DropdownAutoComplete.propTypes = {
  items: PropTypes.array,
  onBlur: PropTypes.func,
  onSelect: PropTypes.func,
};

class DropdownButton extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(PropTypes.object),
    onSelect: PropTypes.func,
  };

  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
    };
  }

  toggleOpen = _.throttle(() => {
    this.setState({isOpen: !this.state.isOpen});
  }, 1);

  onSelect = selectedItem => {
    this.toggleOpen();
    if (this.props.onSelect) this.props.onSelect(selectedItem);
  };

  render() {
    return (
      <div style={{position: 'relative', display: 'inline-block'}}>
        {this.state.isOpen && (
          <StyledMenu>
            <DropdownAutoComplete
              items={this.props.items}
              onBlur={this.toggleOpen}
              onSelect={this.onSelect}
            />
          </StyledMenu>
        )}
        <div onClick={this.toggleOpen} ref={button => (this.button = button)}>
          <StyledButton isOpen={this.state.isOpen}>
            <StyledChevronDown />
            Add Something
          </StyledButton>
        </div>
      </div>
    );
  }
}

const StyledChevronDown = styled(props => (
  <InlineSvg src="icon-chevron-down" {...props} />
))`
  margin-right: 0.5em;
`;

const StyledMenu = styled('div')`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  min-width: 250px;
  font-size: 0.9em;
`;

const StyledButton = styled(props => <Button {...props} />)`
  border-bottom-color: ${p => (p.isOpen ? 'transparent' : p.theme.borderLight)};
  border-bottom-right-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  border-bottom-left-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  position: relative;
  z-index; 1;
  box-shadow: none;
`;

const StyledInput = styled(Input)`
  height: 1.75em;
  font-size: 0.75em;
`;

const StyledItem = styled('div')`
  background-color: ${p =>
    p.index == p.highlightedIndex ? p.theme.offWhite : 'transparent'};
  padding: 0.25em 0.5em;
  &:hover {
    cursor: pointer;
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

export default DropdownButton;
