import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import styled from 'react-emotion';
import AutoComplete from './autoComplete';
import Button from './buttons/button';
import InlineSvg from './inlineSvg';

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
    searchKey: 'russia',
    content: <FakeComponent text="China" emoji="🇨🇳" />,
  },
  {
    searchKey: 'new zealand',
    content: <FakeComponent text="Russia" emoji="🇨🇷" />,
  },
  {
    searchKey: 'australia',
    content: <FakeComponent text="Australia" emoji="🇦🇺" />,
  },
  {
    searchKey: 'brazil',
    content: <FakeComponent text="Brazil" emoji="🇧🇷" />,
  },
];

const StyledChevronDown = styled(props => (
  <InlineSvg src="icon-chevron-down" {...props} />
))`
  margin-right: 0.5em;
`;

const DropdownAutoComplete = ({items, onBlur}) => (
  <AutoComplete itemToString={item => item.content}>
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
        <div {...getRootProps({style: {position: 'relative'}})}>
          <input autoFocus {...getInputProps({})} onBlur={onBlur} />
          {isOpen && (
            <div
              {...getMenuProps({
                style: {
                  boxShadow:
                    '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',
                  position: 'absolute',
                  backgroundColor: 'white',
                  padding: '0',
                  width: '100%',
                },
              })}
            >
              <div>
                {items
                  .filter(
                    item =>
                      item.searchKey.toLowerCase().indexOf(inputValue.toLowerCase()) > -1
                  )
                  .map((item, index) => (
                    <div
                      key={item.searchKey}
                      {...getItemProps({
                        item,
                        index,
                        style: {
                          cursor: 'pointer',
                          padding: '6px 12px',
                          backgroundColor:
                            index === highlightedIndex
                              ? 'rgba(0, 0, 0, 0.02)'
                              : undefined,
                        },
                      })}
                    >
                      {item.content}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      );
    }}
  </AutoComplete>
);

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
          <div style={{position: 'absolute', top: 'calc(100% + 0.25em)', left: 0}}>
            <DropdownAutoComplete items={fakeItems} onBlur={this.toggleOpen} />
          </div>
        )}
        <div
          style={{pointerEvents: this.state.isOpen ? 'none' : 'auto'}}
          onClick={this.toggleOpen}
          ref={button => (this.button = button)}
        >
          <Button>
            <StyledChevronDown />
            Add Something
          </Button>
        </div>
      </div>
    );
  }
}

export default DropdownButton;
