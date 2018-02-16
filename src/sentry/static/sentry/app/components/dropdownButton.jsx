import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import styled from 'react-emotion';
import AutoComplete from './autoComplete';
import Button from './buttons/button';
import InlineSvg from './inlineSvg';
import Input from '../views/settings/components/forms/styled/input.jsx';

const FakeComponent = ({text, emoji}) => (
  <div>
    <span style={{marginRight: '.25em'}}>{emoji}</span>
    {text}
  </div>
);

FakeComponent.propTypes = {
  text: PropTypes.string,
  emoji: PropTypes.string,
};

const fakeItems = [
  {
    groupLabel: 'Countries',
    groupItems: [
      {
        searchKey: 'new zealand',
        content: <FakeComponent text="New Zealand" emoji="🇨🇷" />,
      },
      {
        searchKey: 'australia',
        content: <FakeComponent text="Australia" emoji="🇦🇺" />,
      },
      {
        searchKey: 'brazil',
        content: <FakeComponent text="Brazil" emoji="🇧🇷" />,
      },
    ],
  },
  {
    groupLabel: 'Foods',
    groupItems: [
      {
        searchKey: 'apple',
        content: <FakeComponent text="Apple" emoji="🍎" />,
      },
      {
        searchKey: 'bacon',
        content: <FakeComponent text="Bacon" emoji="🥓" />,
      },
      {
        searchKey: 'corn',
        content: <FakeComponent text="Corn" emoji="🌽" />,
      },
    ],
  },
];

const DropdownAutoComplete = ({items, onBlur}) => {
  const ungroupItems = () => {
    return items.reduce((a, i) => {
      const labelItem = {type: 'label', content: i.groupLabel};
      const groupItems = i.groupItems.map(gi => ({
        type: 'item',
        group: i.groupLabel,
        ...gi,
      }));

      return [...a, labelItem, ...groupItems];
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

    return filteredLabels;
  };

  return (
    <AutoComplete itemToString={item => item.content}>
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
                        key={item.searchKey}
                        highlightedIndex={highlightedIndex}
                        index={index}
                        {...getItemProps({item, index})}
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
};

class DropdownButton extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      closedOnBlur: false,
    };
  }

  toggleOpen = _.throttle(() => {
    this.setState({isOpen: !this.state.isOpen});
  }, 1);

  render() {
    return (
      <div style={{position: 'relative', display: 'inline-block'}}>
        {this.state.isOpen && (
          <StyledMenu>
            <DropdownAutoComplete items={fakeItems} onBlur={this.toggleOpen} />
          </StyledMenu>
        )}
        <div
          style={{pointerEvents: this.state.isOpen ? 'none' : 'auto'}}
          onClick={this.toggleOpen}
          ref={button => (this.button = button)}
        >
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

export default DropdownButton;
