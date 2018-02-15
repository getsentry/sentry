import PropTypes from 'prop-types';
import React from 'react';
import AutoComplete from './autoComplete';

const fakeItems = [
  {
    name: 'Cat',
  },
  {
    name: 'Birb',
  },
  {
    name: 'Pupy',
  },
  {
    name: 'Doge',
  },
];

const DropdownAutoComplete = ({items, onBlur}) => (
  <AutoComplete itemToString={item => item.name}>
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
          <input autoFocus {...getInputProps({})} onBlur={onBlur()} />
          {isOpen && (
            <div
              {...getMenuProps({
                style: {
                  boxShadow:
                    '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',
                  position: 'absolute',
                  backgroundColor: 'white',
                  padding: '0',
                },
              })}
            >
              <div>
                {items
                  .filter(
                    item => item.name.toLowerCase().indexOf(inputValue.toLowerCase()) > -1
                  )
                  .map((item, index) => (
                    <div
                      key={item.name}
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
                      {item.name}
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

  onClick(e) {
    this.setState({isOpen: true});
    console.log('click');
  }

  onBlur(e) {
    this.setState({isOpen: false});
    console.log('blur');
  }

  render() {
    return (
      <div style={{position: 'relative'}}>
        {this.state.isOpen && (
          <div style={{position: 'fixed', top: 0, left: 0}}>
            <DropdownAutoComplete
              items={fakeItems}
              onBlur={() => this.onBlur.bind(this)}
            />
          </div>
        )}
        <div
          style={{pointerEvents: this.state.isOpen ? 'none' : 'auto'}}
          onClick={e => this.onClick(e)}
          ref={button => (this.button = button)}
        >
          Click Me!
        </div>
      </div>
    );
  }
}

export default DropdownButton;
