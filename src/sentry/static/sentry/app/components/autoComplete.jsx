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

import DropdownMenu from 'app/components/dropdownMenu';

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
    disabled: PropTypes.bool,
    /**
     * Resets autocomplete input when menu closes
     */
    resetInputOnClose: PropTypes.bool,
    /**
     * Currently, this does not act as a "controlled" prop, only for initial state of dropdown
     */
    isOpen: PropTypes.bool,
    /**
     * If input should be considered an "actor". If there is another parent actor, then this should be `false`.
     * e.g. You have a button that opens this <AutoComplete> in a dropdown.
     */
    inputIsActor: PropTypes.bool,
    onSelect: PropTypes.func,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    onMenuOpen: PropTypes.func,
  };

  static defaultProps = {
    itemToString: i => i,
    inputIsActor: true,
    disabled: false,
  };

  constructor(props) {
    super(props);

    this.state = {
      isOpen: !!props.isOpen,
      highlightedIndex: props.defaultHighlightedIndex || 0,
      inputValue: props.defaultInputValue || '',
      selectedItem: null,
    };

    this.items = new Map();
  }

  componentWillReceiveProps() {
    this.resetHighlightState();
  }

  componentWillUpdate() {
    this.items.clear();
  }

  isControlled = () => typeof this.props.isOpen !== 'undefined';

  getOpenState = () => {
    let {isOpen} = this.props;

    return this.isControlled() ? isOpen : this.state.isOpen;
  };

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
    this.openMenu();
    this.setState({
      inputValue: value,
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

  // Dropdown detected click outside, we should close
  handleClickOutside = () => {
    // Otherwise, it's possible that this gets fired multiple times
    // e.g. click outside triggers closeMenu and at the same time input gets blurred, so
    // a timer is set to close the menu
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
    }

    this.closeMenu();
  };

  handleInputKeyDown = ({onKeyDown} = {}, e) => {
    let shouldSelectWithEnter =
      e.key === 'Enter' && this.items.size && this.items.has(this.state.highlightedIndex);

    if (shouldSelectWithEnter) {
      this.handleSelect(this.items.get(this.state.highlightedIndex), e);
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

  handleMenuMouseDown = () => {
    // Cancel close menu from input blur (mouseDown event can occur before input blur :()
    setTimeout(() => this.blurTimer && clearTimeout(this.blurTimer));
  };

  /**
   * When an item is selected via clicking or using the keyboard (e.g. pressing "Enter")
   */
  handleSelect = (item, e) => {
    let {onSelect, itemToString} = this.props;

    callIfFunction(onSelect, item, this.state, e);

    this.closeMenu();
    this.setState({
      selectedItem: item,
      inputValue: itemToString(item),
    });
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

  /**
   * Open dropdown menu
   *
   * This is exposed to render function
   */
  openMenu = (...args) => {
    let {onOpen, disabled} = this.props;

    callIfFunction(onOpen, ...args);

    if (disabled || this.isControlled()) return;

    this.resetHighlightState();
    this.setState({
      isOpen: true,
    });
  };

  /**
   * Close dropdown menu
   *
   * This is exposed to render function
   */
  closeMenu = (...args) => {
    let {onClose, resetInputOnClose} = this.props;

    callIfFunction(onClose, ...args);

    if (this.isControlled()) return;

    this.setState(state => {
      return {
        isOpen: false,
        inputValue: resetInputOnClose ? '' : state.inputValue,
      };
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

  getMenuProps = menuProps => ({
    ...menuProps,
    onMouseDown: this.handleMenuMouseDown.bind(this, menuProps),
  });

  render() {
    let {children, onMenuOpen} = this.props;
    let isOpen = this.getOpenState();

    return (
      <DropdownMenu
        isOpen={isOpen}
        onClickOutside={this.handleClickOutside}
        onOpen={onMenuOpen}
      >
        {dropdownMenuProps =>
          children({
            ...dropdownMenuProps,
            getMenuProps: props =>
              dropdownMenuProps.getMenuProps(this.getMenuProps(props)),
            getInputProps: props => {
              const inputProps = this.getInputProps(props);

              if (!this.props.inputIsActor) {
                return inputProps;
              }

              return dropdownMenuProps.getActorProps(inputProps);
            },
            getItemProps: this.getItemProps,
            inputValue: this.state.inputValue,
            selectedItem: this.state.selectedItem,
            highlightedIndex: this.state.highlightedIndex,
            actions: {
              open: this.openMenu,
              close: this.closeMenu,
            },
          })}
      </DropdownMenu>
    );
  }
}

export default AutoComplete;
