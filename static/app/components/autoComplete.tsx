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
import {useCallback, useEffect, useRef, useState} from 'react';

import DeprecatedDropdownMenu, {
  GetActorArgs,
  GetMenuArgs,
} from 'sentry/components/deprecatedDropdownMenu';
import {uniqueId} from 'sentry/utils/guid';
import usePrevious from 'sentry/utils/usePrevious';

type Item = {
  'data-test-id'?: string;
  disabled?: boolean;
};

type GetInputArgs<E extends HTMLInputElement> = {
  onBlur?: (event: React.FocusEvent<E>) => void;
  onChange?: (event: React.ChangeEvent<E>) => void;
  onFocus?: (event: React.FocusEvent<E>) => void;
  onKeyDown?: (event: React.KeyboardEvent<E>) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  type?: string;
};

type GetInputOutput<E extends HTMLInputElement> = GetInputArgs<E> &
  GetActorArgs<E> & {
    value?: string;
  };

type GetItemArgs<T> = {
  index: number;
  item: T;
  onClick?: (item: T) => (e: React.MouseEvent) => void;
};

export type AutoCompleteChildrenProps<T> = Parameters<
  DeprecatedDropdownMenu['props']['children']
>[0] & {
  /**
   * Returns props for the input element that handles searching the items
   */
  getInputProps: <E extends HTMLInputElement = HTMLInputElement>(
    args: GetInputArgs<E>
  ) => GetInputOutput<E>;
  /**
   * Returns props for an individual item
   */
  getItemProps: (args: GetItemArgs<T>) => {
    onClick: (e: React.MouseEvent) => void;
  };
  /**
   * The actively highlighted item index
   */
  highlightedIndex: number;
  /**
   * The current value of the input box
   */
  inputValue: string;
  /**
   * Registers the total number of items in the dropdown menu.
   *
   * This must be called for keyboard navigation to work.
   */
  registerItemCount: (count?: number) => void;
  /**
   * Registers an item as being visible in the autocomplete menu. Returns an
   * cleanup function that unregisters the item as visible.
   *
   * This is needed for managing keyboard navigation when using react virtualized.
   *
   * NOTE: Even when NOT using a virtualized list, this must still be called for
   * keyboard navigation to work!
   */
  registerVisibleItem: (index: number, item: T) => () => void;
  /**
   * The current selected item
   */
  selectedItem?: T;
};

export type AutoCompleteState = {
  highlightedIndex: number;
  inputValue: string;
  isOpen: boolean;
};

export type AutoCompleteProps<T> = {
  /**
   * Must be a function that returns a component
   */
  children: (props: AutoCompleteChildrenProps<T>) => React.ReactElement | null;
  closeOnSelect?: boolean;
  defaultHighlightedIndex?: number;
  defaultInputValue?: string;
  disabled?: boolean;

  /**
   * If input should be considered an "actor". If there is another parent actor, then this should be `false`.
   * e.g. You have a button that opens this <AutoComplete> in a dropdown.
   */
  inputIsActor?: boolean;
  inputValue?: string;
  isOpen?: boolean;
  itemToString?: (item?: T) => string;
  onClose?: (...args: Array<any>) => void;
  onInputValueChange?: (value: string) => void;
  onMenuOpen?: () => void;
  onOpen?: (...args: Array<any>) => void;
  onSelect?: (
    item: T,
    state?: AutoCompleteState,
    e?: React.MouseEvent | React.KeyboardEvent
  ) => void;
  /**
   * Resets autocomplete input when menu closes
   */
  resetInputOnClose?: boolean;
  /**
   * Can select autocomplete item with "Enter" key
   */
  shouldSelectWithEnter?: boolean;
  /**
   * Can select autocomplete item with "Tab" key
   */
  shouldSelectWithTab?: boolean;
};

function useIsMounted() {
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

  return isMounted;
}

function useUniqueAutoCompleteId() {
  const idRef = useRef(`autocomplete-${uniqueId()}`);

  return idRef.current;
}

function useItemsMap() {
  const itemsRef = useRef(new Map());

  return itemsRef.current;
}

function useTimeoutRef() {
  const timeoutRef = useRef<number | undefined>();

  useEffect(() => {
    const timer = timeoutRef.current;

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return timeoutRef;
}

function useHighlightedIndex<T>({
  closeOnSelect,
  selectedItem,
  defaultHighlightedIndex,
}: Pick<AutoCompleteProps<T>, 'closeOnSelect' | 'defaultHighlightedIndex'> & {
  selectedItem?: T;
}) {
  const [highlightedIndex, setHighlightedIndex] = useState(defaultHighlightedIndex ?? 0);
  const previousSelectedItem = usePrevious(selectedItem);

  const resetHighlightState = useCallback(() => {
    setHighlightedIndex(defaultHighlightedIndex ?? 0);
  }, [defaultHighlightedIndex]);

  // Resets
  useEffect(() => {
    if (closeOnSelect && selectedItem !== previousSelectedItem) {
      resetHighlightState();
    }
  }, [
    closeOnSelect,
    selectedItem,
    previousSelectedItem,
    defaultHighlightedIndex,
    resetHighlightState,
  ]);

  return {highlightedIndex, setHighlightedIndex, resetHighlightState};
}

function makeItemId(baseId: string, index: number) {
  return `${baseId}-item-${index}`;
}

function defaultItemToString() {
  return '';
}

function AutoComplete<T extends Item>({
  children,
  closeOnSelect = true,
  defaultHighlightedIndex,
  defaultInputValue,
  disabled = false,
  inputValue: incomingInputValue,
  isOpen: incomingIsOpen,
  inputIsActor = true,
  itemToString = defaultItemToString,
  onClose,
  onInputValueChange,
  onMenuOpen,
  onOpen,
  onSelect,
  resetInputOnClose,
  shouldSelectWithEnter = true,
  shouldSelectWithTab = false,
}: AutoCompleteProps<T>) {
  const isMounted = useIsMounted();
  const id = useUniqueAutoCompleteId();
  const items = useItemsMap();
  const blurTimeoutRef = useTimeoutRef();
  const cancelCloseTimeoutRef = useTimeoutRef();

  const [localIsOpen, setIsOpen] = useState(false);
  const [localInputValue, setInputValue] = useState(defaultInputValue ?? '');
  const [selectedItem, setSelectedItem] = useState<T | undefined>();
  const [itemCount, setItemCount] = useState<number | undefined>();
  const inputValueIsControlled = typeof incomingInputValue !== 'undefined';
  const isOpenIsControlled = typeof incomingIsOpen !== 'undefined';

  const isOpen = isOpenIsControlled ? incomingIsOpen : localIsOpen;
  const inputValue = inputValueIsControlled ? incomingInputValue : localInputValue;

  const {highlightedIndex, setHighlightedIndex, resetHighlightState} =
    useHighlightedIndex<T>({
      closeOnSelect,
      selectedItem,
      defaultHighlightedIndex,
    });

  const getItemElement = (index: number) => {
    const itemId = makeItemId(id, index);
    const element = document.getElementById(itemId);

    return element;
  };

  /**
   * Open dropdown menu
   *
   * This is exposed to render function
   */
  const openMenu = (...args: Array<any>) => {
    onOpen?.(...args);

    if (disabled || isOpenIsControlled) {
      return;
    }

    resetHighlightState();
    setIsOpen(true);
  };

  /**
   * Close dropdown menu
   *
   * This is exposed to render function
   */
  const closeMenu = useCallback(
    (...args: Array<any>) => {
      onClose?.(...args);

      if (!isMounted) {
        return;
      }

      setIsOpen(oldIsOpen => (!isOpenIsControlled ? false : oldIsOpen));
      setInputValue(oldInputValue => (resetInputOnClose ? '' : oldInputValue));
    },
    [isMounted, isOpenIsControlled, onClose, resetInputOnClose]
  );

  /**
   * When an item is selected via clicking or using the keyboard (e.g. pressing "Enter")
   */
  const handleSelect = (item: T, e: React.MouseEvent | React.KeyboardEvent) => {
    onSelect?.(item, {highlightedIndex, inputValue, isOpen}, e);

    if (closeOnSelect) {
      closeMenu();

      setInputValue(itemToString(item));
      setSelectedItem(item);
      return;
    }

    setSelectedItem(item);
  };

  const makeHandleInputChange = <E extends HTMLInputElement>(
    onChange: GetInputArgs<E>['onChange']
  ) => {
    // Some inputs (e.g. input) pass in only the event to the onChange listener and
    // others (e.g. TextField) pass in both the value and the event to the onChange listener.
    // This returned function is to accomodate both kinds of input components.
    return (
      valueOrEvent: string | React.ChangeEvent<E>,
      event?: React.ChangeEvent<E>
    ) => {
      const value: string =
        event === undefined
          ? (valueOrEvent as React.ChangeEvent<E>).target.value
          : (valueOrEvent as string);
      const changeEvent: React.ChangeEvent<E> =
        event === undefined ? (valueOrEvent as React.ChangeEvent<E>) : event;

      // We force `isOpen: true` here because:
      // 1) it's possible to have menu closed but input with focus (i.e. hitting "Esc")
      // 2) you select an item, input still has focus, and then change input
      openMenu();

      if (!inputValueIsControlled) {
        setInputValue(value);
      }

      onInputValueChange?.(value);
      onChange?.(changeEvent);
    };
  };

  const makeHandleInputFocus = <E extends HTMLInputElement>(
    onFocus: GetInputArgs<E>['onFocus']
  ) => {
    return (e: React.FocusEvent<E>) => {
      setIsOpen(true);
      // setInputValue('dsfjk');
      onFocus?.(e);
    };
  };

  /**
   * We need this delay because we want to close the menu when input
   * is blurred (i.e. clicking or via keyboard). However we have to handle the
   * case when we want to click on the dropdown and causes focus.
   *
   * Clicks outside should close the dropdown immediately via <DeprecatedDropdownMenu />,
   * however blur via keyboard will have a 200ms delay
   */
  const makeHandleInputBlur = <E extends HTMLInputElement>(
    onBlur: GetInputArgs<E>['onBlur']
  ) => {
    return (e: React.FocusEvent<E>) => {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = window.setTimeout(() => {
        closeMenu();
        onBlur?.(e);
      }, 200);
    };
  };

  // Dropdown detected click outside, we should close
  const handleClickOutside = useCallback(async () => {
    // Otherwise, it's possible that this gets fired multiple times
    // e.g. click outside triggers closeMenu and at the same time input gets blurred, so
    // a timer is set to close the menu
    window.clearTimeout(blurTimeoutRef.current);

    // Wait until the current macrotask completes, in the case that the click
    // happened on a hovercard or some other element rendered outside of the
    // autocomplete, but controlled by the existence of the autocomplete, we
    // need to ensure any click handlers are run.
    await new Promise(resolve => window.setTimeout(resolve));

    closeMenu();
  }, [blurTimeoutRef, closeMenu]);

  const moveHighlightedIndex = (step: number) => {
    let newIndex = highlightedIndex + step;

    // when this component is in virtualized mode, only a subset of items will
    // be passed down, making the map size inaccurate. instead we manually pass
    // the length as itemCount
    const listSize = itemCount ?? items.size;

    // Make sure new index is within bounds
    newIndex = Math.max(0, Math.min(newIndex, listSize - 1));

    setHighlightedIndex(newIndex);

    setTimeout(() => {
      // Scroll the newly highlighted element into view
      const highlightedElement = getItemElement(newIndex);

      if (highlightedElement && typeof highlightedElement.scrollIntoView === 'function') {
        highlightedElement.scrollIntoView({block: 'nearest'});
      }
    });
  };

  const makeHandleInputKeydown = <E extends HTMLInputElement>(
    onKeyDown: GetInputArgs<E>['onKeyDown']
  ) => {
    return (e: React.KeyboardEvent<E>) => {
      const item = items.get(highlightedIndex);

      const isEnter = shouldSelectWithEnter && e.key === 'Enter';
      const isTab = shouldSelectWithTab && e.key === 'Tab';

      if (item !== undefined && (isEnter || isTab)) {
        if (!item.disabled) {
          handleSelect(item, e);
        }

        e.preventDefault();
      }

      if (e.key === 'ArrowUp') {
        moveHighlightedIndex(-1);
        e.preventDefault();
      }

      if (e.key === 'ArrowDown') {
        moveHighlightedIndex(1);
        e.preventDefault();
      }

      if (e.key === 'Escape') {
        closeMenu();
      }

      onKeyDown?.(e);
    };
  };

  const makeHandleItemClick = ({item, index}: GetItemArgs<T>) => {
    return (e: React.MouseEvent) => {
      if (item.disabled) {
        return;
      }

      window.clearTimeout(blurTimeoutRef.current);

      setHighlightedIndex(index);
      handleSelect(item, e);
    };
  };

  const makeHandleMouseEnter = ({item, index}: GetItemArgs<T>) => {
    return (_e: React.MouseEvent) => {
      if (item.disabled) {
        return;
      }

      setHighlightedIndex(index);
    };
  };

  const handleMenuMouseDown = () => {
    window.clearTimeout(cancelCloseTimeoutRef.current);
    // Cancel close menu from input blur (mouseDown event can occur before input blur :()
    cancelCloseTimeoutRef.current = window.setTimeout(() => {
      window.clearTimeout(blurTimeoutRef.current);
    });
  };

  const getInputProps = <E extends HTMLInputElement>(
    inputProps?: GetInputArgs<E>
  ): GetInputOutput<E> => {
    const {onChange, onKeyDown, onFocus, onBlur, ...rest} = inputProps ?? {};
    return {
      ...rest,
      value: inputValue,
      onChange: makeHandleInputChange<E>(onChange),
      onKeyDown: makeHandleInputKeydown<E>(onKeyDown),
      onFocus: makeHandleInputFocus<E>(onFocus),
      onBlur: makeHandleInputBlur<E>(onBlur),
    };
  };

  const getItemProps = (itemProps: GetItemArgs<T>) => {
    const {item, index, ...restItemProps} = itemProps ?? {};

    return {
      ...restItemProps,
      id: makeItemId(id, index),
      role: 'option',
      'data-test-id': item['data-test-id'],
      onClick: makeHandleItemClick(itemProps),
      onMouseEnter: makeHandleMouseEnter(itemProps),
    };
  };

  const registerVisibleItem = (index: number, item: T) => {
    items.set(index, item);
    return () => items.delete(index);
  };

  return (
    <DeprecatedDropdownMenu
      isOpen={isOpen}
      onClickOutside={handleClickOutside}
      onOpen={onMenuOpen}
    >
      {dropdownMenuProps =>
        children({
          ...dropdownMenuProps,
          getMenuProps: <E extends Element = Element>(incomingProps?: GetMenuArgs<E>) =>
            dropdownMenuProps.getMenuProps({
              ...incomingProps,
              onMouseDown: handleMenuMouseDown,
            }),
          getInputProps: <E extends HTMLInputElement = HTMLInputElement>(
            incomingProps?: GetInputArgs<E>
          ): GetInputOutput<E> => {
            const inputProps = getInputProps<E>(incomingProps);

            return inputIsActor
              ? dropdownMenuProps.getActorProps<E>(inputProps as GetActorArgs<E>)
              : inputProps;
          },

          getItemProps,
          registerVisibleItem,
          registerItemCount: setItemCount,
          inputValue,
          selectedItem,
          highlightedIndex,
          actions: {
            open: openMenu,
            close: closeMenu,
          },
        })
      }
    </DeprecatedDropdownMenu>
  );
}

export default AutoComplete;
