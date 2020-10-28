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
import PropTypes from 'prop-types';
import React from 'react';

import {callIfFunction} from 'app/utils/callIfFunction';
import DropdownMenu from 'app/components/dropdownMenu';

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

    /**
     * Can select autocomplete item with "Enter" key
     */
    shouldSelectWithEnter: PropTypes.bool,

    /**
     * Can select autocomplete item with "Tab" key
     */
    shouldSelectWithTab: PropTypes.bool,

    onSelect: PropTypes.func,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    onMenuOpen: PropTypes.func,
    closeOnSelect: PropTypes.bool,
  };

  static defaultProps = {
    itemToString: i => i,
    inputIsActor: true,
    disabled: false,
    closeOnSelect: true,
    shouldSelectWithEnter: true,
    shouldSelectWithTab: false,
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

  UNSAFE_componentWillReceiveProps(nextProps, nextState) {
    // If we do NOT want to close on select, then we should not reset highlight state
    // when we select an item (when we select an item, `this.state.selectedItem` changes)
    if (!nextProps.closeOnSelect && this.state.selectedItem !== nextState.selectedItem) {
      return;
    }

    this.resetHighlightState();
  }

  UNSAFE_componentWillUpdate() {
    this.items.clear();
  }

  isControlled = () => typeof this.props.isOpen !== 'undefined';

  getOpenState = () => {
    const {isOpen} = this.props;

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
    const value = e.target.value;

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
  handleClickOutside = async () => {
    // Otherwise, it's possible that this gets fired multiple times
    // e.g. click outside triggers closeMenu and at the same time input gets blurred, so
    // a timer is set to close the menu
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
    }

    // Wait until the current macrotask completes, in the case that the click
    // happened on a hovercard or some other element rendered outside of the
    // autocomplete, but controlled by the existence of the autocomplete, we
    // need to ensure any click handlers are run.
    await new Promise(resolve => setTimeout(resolve));

    this.closeMenu();
  };

  handleInputKeyDown = ({onKeyDown} = {}, e) => {
    const hasHighlightedItem =
      this.items.size && this.items.has(this.state.highlightedIndex);
    const canSelectWithEnter = this.props.shouldSelectWithEnter && e.key === 'Enter';
    const canSelectWithTab = this.props.shouldSelectWithTab && e.key === 'Tab';

    if (hasHighlightedItem && (canSelectWithEnter || canSelectWithTab)) {
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
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
    }
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
    const {onSelect, itemToString, closeOnSelect} = this.props;

    callIfFunction(onSelect, item, this.state, e);

    const newState = {
      selectedItem: item,
    };

    if (closeOnSelect) {
      this.closeMenu();
      newState.inputValue = itemToString(item);
    }

    this.setState(newState);
  };

  moveHighlightedIndex = (step, _e) => {
    let newIndex = this.state.highlightedIndex + step;

    // when this component is in virtualized mode, only a subset of items will be passed
    // down, making the array length inaccurate. instead we manually pass the length as itemCount
    const listSize = this.itemCount || this.items.size;

    // Make sure new index is within bounds
    newIndex = Math.max(0, Math.min(newIndex, listSize - 1));

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
    const {onOpen, disabled} = this.props;

    callIfFunction(onOpen, ...args);

    if (disabled || this.isControlled()) {
      return;
    }

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
    const {onClose, resetInputOnClose} = this.props;

    callIfFunction(onClose, ...args);

    if (this.isControlled()) {
      return;
    }

    this.setState(state => ({
      isOpen: false,
      inputValue: resetInputOnClose ? '' : state.inputValue,
    }));
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

    const newIndex = index ?? this.items.size;
    this.items.set(newIndex, item);

    return {
      ...props,
      onClick: this.handleItemClick.bind(this, {item, index: newIndex, ...props}),
    };
  };

  getMenuProps = menuProps => {
    this.itemCount = menuProps.itemCount;

    return {
      ...menuProps,
      onMouseDown: this.handleMenuMouseDown.bind(this, menuProps),
    };
  };

  render() {
    const {children, onMenuOpen} = this.props;
    const isOpen = this.getOpenState();

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
          })
        }
      </DropdownMenu>
    );
  }
}

export default AutoComplete;
