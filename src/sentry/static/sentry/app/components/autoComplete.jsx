/**
 * Inspired by [Downshift](https://github.com/paypal/downshift)
 *
 * Implemented with a stripped-down, compatible API for our use case.
 * May be worthwhile to switch if we find we need more features
 *
 * Basic idea is that we call `children` with props necessary to render with any sort of component structure.
 * This component handles logic like when the dropdown menu should be displayed, as well as handling keyboard input, how
 * it is rendered should be left to the child.
 */
import React from 'react';
import PropTypes from 'prop-types';

import DropdownMenu from './dropdownMenu';

// Checks if `fn` is a function and calls it with `args`
const callIfFunction = (fn, ...args) => typeof fn === 'function' && fn(...args);

class AutoComplete extends React.Component {
  static propTypes = {
    /**
     * Must be a function that returns a component
     */
    children: PropTypes.func.isRequired,
    itemToString: PropTypes.func.isRequired,
    defaultHighlightedIndex: PropTypes.number,
    defaultInputValue: PropTypes.string,
    isOpen: PropTypes.bool,
    onSelect: PropTypes.func,
  };

  static defaultProps = {
    itemToString: i => i,
  };

  constructor(props) {
    super(props);

    this.state = {
      isOpen: !!props.isOpen,
      highlightedIndex: props.defaultHighlightedIndex || 0,
      inputValue: props.defaultInputValue || '',
    };

    this.items = new Map();
  }

  componentWillReceiveProps() {
    this.resetHighlightState();
  }

  componentWillUpdate() {
    this.items.clear();
  }

  /**
   * Resets `this.items` and `this.state.highlightedIndex`.
   * Should be called whenever `inputValue` changes.
   */
  resetHighlightState = () => {
    // reset items and expect `getInputProps` in child to give us a list of new items
    this.setState({
      highlightedIndex: this.props.defaultHighlightedIndex || 0,
    });
  };

  handleInputChange = ({onChange} = {}, e) => {
    let value = e.target.value;

    // We force `isOpen: true` here because:
    // 1) it's possible to have menu closed but input with focus (i.e. hitting "Esc")
    // 2) you select an item, input still has focus, and then change input
    this.setState({
      inputValue: value,
      isOpen: true,
    });

    callIfFunction(onChange, e);
  };

  handleInputFocus = ({onFocus} = {}, e) => {
    this.openMenu();

    callIfFunction(onFocus, e);
  };

  /**
   *
   * We need this delay because we want to close the menu when input
   * is blurred (i.e. clicking or via keyboard). However we have to handle the
   * case when we want to click on the dropdown and causes focus.
   *
   * Clicks outside should close the dropdown immediately via <DropdownMenu />,
   * however blur via keyboard will have a 200ms delay
   */
  handleInputBlur = ({onBlur} = {}, e) => {
    this.blurTimer = setTimeout(() => {
      this.closeMenu();
      callIfFunction(onBlur, e);
    }, 200);
  };

  handleInputKeyDown = ({onKeyDown} = {}, e) => {
    let shouldSelectWithEnter =
      e.key === 'Enter' && this.items.size && this.items.has(this.state.highlightedIndex);

    if (shouldSelectWithEnter) {
      this.handleSelect(this.items.get(this.state.highlightedIndex));
      e.preventDefault();
    }

    if (e.key === 'ArrowUp') {
      this.moveHighlightedIndex(-1);
      e.preventDefault();
    }

    if (e.key === 'ArrowDown') {
      this.moveHighlightedIndex(1);
      e.preventDefault();
    }

    if (e.key === 'Escape') {
      this.closeMenu();
    }

    callIfFunction(onKeyDown, e);
  };

  handleItemClick = ({onClick, item, index} = {}, e) => {
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.setState({highlightedIndex: index});
    this.handleSelect(item, e);
    callIfFunction(onClick, item, e);
  };

  /**
   * When an item is selected via clicking or using the keyboard (e.g. pressing "Enter")
   */
  handleSelect = item => {
    let {onSelect, itemToString} = this.props;

    callIfFunction(onSelect, item);

    this.closeMenu();
    this.setState({inputValue: itemToString(item)});
  };

  moveHighlightedIndex = (step, e) => {
    let listSize = this.items.size - 1;
    let newIndex = this.state.highlightedIndex + step;

    // Make sure new index is within bounds
    newIndex = Math.max(0, Math.min(newIndex, listSize));

    this.setState({
      highlightedIndex: newIndex,
    });
  };

  openMenu = () => {
    this.setState({
      isOpen: true,
    });
  };

  closeMenu = () => {
    this.setState({
      isOpen: false,
    });
  };

  getInputProps = inputProps => ({
    ...inputProps,
    value: this.state.inputValue,
    onChange: this.handleInputChange.bind(this, inputProps),
    onKeyDown: this.handleInputKeyDown.bind(this, inputProps),
    onFocus: this.handleInputFocus.bind(this, inputProps),
    onBlur: this.handleInputBlur.bind(this, inputProps),
  });

  getItemProps = ({item, index, ...props} = {}) => {
    if (!item) {
      // eslint-disable-next-line no-console
      console.warn('getItemProps requires an object with an `item` key');
    }

    let newIndex = index || this.items.size;
    this.items.set(newIndex, item);

    return {
      ...props,
      onClick: this.handleItemClick.bind(this, {item, index: newIndex, ...props}),
    };
  };

  getMenuProps = props => ({
    ...props,
  });

  render() {
    let {children} = this.props;

    return (
      <DropdownMenu
        isOpen={this.state.isOpen}
        onClickOutside={() => this.setState({isOpen: false})}
      >
        {dropdownMenuProps =>
          children({
            ...dropdownMenuProps,
            getInputProps: props => {
              return dropdownMenuProps.getActorProps(this.getInputProps(props));
            },
            getItemProps: this.getItemProps,
            inputValue: this.state.inputValue,
            highlightedIndex: this.state.highlightedIndex,
          })}
      </DropdownMenu>
    );
  }
}

export default AutoComplete;
