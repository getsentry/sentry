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

import DropdownMenu, {GetActorArgs, GetMenuArgs} from 'app/components/dropdownMenu';

const defaultProps = {
  itemToString: () => '',
  /**
   * If input should be considered an "actor". If there is another parent actor, then this should be `false`.
   * e.g. You have a button that opens this <AutoComplete> in a dropdown.
   */
  inputIsActor: true,
  disabled: false,
  closeOnSelect: true,
  /**
   * Can select autocomplete item with "Enter" key
   */
  shouldSelectWithEnter: true,
  /**
   * Can select autocomplete item with "Tab" key
   */
  shouldSelectWithTab: false,
};

type GetInputArgs = {
  type?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
};

type GetInputOutput = GetInputArgs &
  Omit<GetActorArgs, 'onChange'> & {
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    value?: string;
  };

export type GetItemArgs<T> = {
  item: T;
  index: number;
  onClick?: (item: T) => (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
};

type ChildrenProps<T> = Parameters<DropdownMenu['props']['children']>[0] & {
  highlightedIndex: number;
  getInputProps: (args: GetInputArgs) => GetInputOutput;
  getItemProps: (
    args: GetItemArgs<T>
  ) => Pick<GetItemArgs<T>, 'style'> & {
    onClick: (e: React.MouseEvent) => void;
  };
  inputValue: string;
  selectedItem?: T;
};

type State<T> = {
  isOpen: boolean;
  highlightedIndex: number;
  inputValue: string;
  selectedItem?: T;
};

type Props<T> = typeof defaultProps & {
  /**
   * Must be a function that returns a component
   */
  children: (props: ChildrenProps<T>) => React.ReactElement;
  disabled: boolean;
  itemToString?: (item?: T) => string;
  /**
   * Resets autocomplete input when menu closes
   */
  resetInputOnClose?: boolean;
  /**
   * Currently, this does not act as a "controlled" prop, only for initial state of dropdown
   */
  isOpen?: boolean;
  defaultHighlightedIndex?: number;
  defaultInputValue?: string;
  onOpen?: (...args: Array<any>) => void;
  onClose?: (...args: Array<any>) => void;
  onSelect?: (
    item: T,
    state?: State<T>,
    e?: React.MouseEvent | React.KeyboardEvent
  ) => void;
  onMenuOpen?: () => void;
};

class AutoComplete<T> extends React.Component<Props<T>, State<T>> {
  static defaultProps = defaultProps;

  state: State<T> = this.getInitialState();

  getInitialState() {
    const {defaultHighlightedIndex, isOpen, defaultInputValue} = this.props;
    return {
      isOpen: !!isOpen,
      highlightedIndex: defaultHighlightedIndex || 0,
      inputValue: defaultInputValue || '',
      selectedItem: undefined,
    };
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

  items = new Map();
  blurTimer: any;
  itemCount?: number;

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

  handleInputChange = ({onChange}: Pick<GetInputArgs, 'onChange'>) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;

    // We force `isOpen: true` here because:
    // 1) it's possible to have menu closed but input with focus (i.e. hitting "Esc")
    // 2) you select an item, input still has focus, and then change input
    this.openMenu();
    this.setState({
      inputValue: value,
    });

    onChange?.(e);
  };

  handleInputFocus = ({onFocus}: Pick<GetInputArgs, 'onFocus'>) => (
    e: React.FocusEvent
  ) => {
    this.openMenu();
    onFocus?.(e);
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
  handleInputBlur = ({onBlur}: Pick<GetInputArgs, 'onBlur'>) => (e: React.FocusEvent) => {
    this.blurTimer = setTimeout(() => {
      this.closeMenu();
      onBlur?.(e);
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

  handleInputKeyDown = ({onKeyDown}: Pick<GetInputArgs, 'onKeyDown'>) => (
    e: React.KeyboardEvent
  ) => {
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

    onKeyDown?.(e);
  };

  handleItemClick = ({onClick, item, index}: GetItemArgs<T>) => (e: React.MouseEvent) => {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
    }
    this.setState({highlightedIndex: index});
    this.handleSelect(item, e);
    onClick?.(item)(e);
  };

  handleMenuMouseDown = () => {
    // Cancel close menu from input blur (mouseDown event can occur before input blur :()
    setTimeout(() => {
      if (this.blurTimer) {
        clearTimeout(this.blurTimer);
      }
    });
  };

  /**
   * When an item is selected via clicking or using the keyboard (e.g. pressing "Enter")
   */
  handleSelect = (item: T, e: React.MouseEvent | React.KeyboardEvent) => {
    const {onSelect, itemToString, closeOnSelect} = this.props;

    onSelect?.(item, this.state, e);

    if (closeOnSelect) {
      this.closeMenu();

      this.setState({
        inputValue: itemToString(item),
        selectedItem: item,
      });
      return;
    }

    this.setState({selectedItem: item});
  };

  moveHighlightedIndex(step: number) {
    let newIndex = this.state.highlightedIndex + step;

    // when this component is in virtualized mode, only a subset of items will be passed
    // down, making the array length inaccurate. instead we manually pass the length as itemCount
    const listSize = this.itemCount || this.items.size;

    // Make sure new index is within bounds
    newIndex = Math.max(0, Math.min(newIndex, listSize - 1));

    this.setState({highlightedIndex: newIndex});
  }

  /**
   * Open dropdown menu
   *
   * This is exposed to render function
   */
  openMenu = (...args: Array<any>) => {
    const {onOpen, disabled} = this.props;

    onOpen?.(...args);

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
  closeMenu = (...args: Array<any>) => {
    const {onClose, resetInputOnClose} = this.props;

    onClose?.(...args);

    if (this.isControlled()) {
      return;
    }

    this.setState(state => ({
      isOpen: false,
      inputValue: resetInputOnClose ? '' : state.inputValue,
    }));
  };

  getInputProps = (inputProps?: GetInputArgs): GetInputOutput => {
    const {onChange, onKeyDown, onFocus, onBlur, ...rest} = inputProps ?? {};
    return {
      ...rest,
      value: this.state.inputValue,
      onChange: this.handleInputChange({onChange}),
      onKeyDown: this.handleInputKeyDown({onKeyDown}),
      onFocus: this.handleInputFocus({onFocus}),
      onBlur: this.handleInputBlur({onBlur}),
    };
  };

  getItemProps = (itemProps: GetItemArgs<T>) => {
    const {item, index, ...props} = itemProps ?? {};

    if (!item) {
      // eslint-disable-next-line no-console
      console.warn('getItemProps requires an object with an `item` key');
    }

    const newIndex = index ?? this.items.size;
    this.items.set(newIndex, item);

    return {
      ...props,
      onClick: this.handleItemClick({item, index: newIndex, ...props}),
    };
  };

  getMenuProps = (props?: GetMenuArgs): GetMenuArgs => {
    this.itemCount = props?.itemCount;

    return {
      ...(props ?? {}),
      onMouseDown: this.handleMenuMouseDown,
    };
  };

  render() {
    const {children, onMenuOpen, inputIsActor} = this.props;
    const {selectedItem, inputValue, highlightedIndex} = this.state;
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
            getMenuProps: (props?: GetMenuArgs) =>
              dropdownMenuProps.getMenuProps(this.getMenuProps(props)),
            getInputProps: (props?: GetInputArgs) => {
              const inputProps = this.getInputProps(props);

              if (!inputIsActor) {
                return inputProps;
              }

              return dropdownMenuProps.getActorProps(inputProps as GetActorArgs);
            },
            getItemProps: this.getItemProps,
            inputValue,
            selectedItem,
            highlightedIndex,
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
