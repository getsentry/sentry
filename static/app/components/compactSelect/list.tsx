import {Fragment, useCallback, useContext, useEffect, useMemo} from 'react';
import {useFocusManager} from '@react-aria/focus';
import {AriaGridListOptions} from '@react-aria/gridlist';
import {AriaListBoxOptions} from '@react-aria/listbox';
import {ListProps, useListState} from '@react-stately/list';

import {defined} from 'sentry/utils';
import domId from 'sentry/utils/domId';
import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from './control';
import {GridList} from './gridList';
import {ListBox} from './listBox';
import {SelectOption, SelectOptionOrSectionWithKey} from './types';
import {getDisabledOptions, getSelectedOptions, HiddenSectionToggle} from './utils';

interface BaseListProps<Value extends React.Key>
  extends ListProps<any>,
    Omit<
      AriaListBoxOptions<any>,
      'disabledKeys' | 'selectedKeys' | 'defaultSelectedKeys' | 'onSelectionChange'
    >,
    Omit<
      AriaGridListOptions<any>,
      'disabledKeys' | 'selectedKeys' | 'defaultSelectedKeys' | 'onSelectionChange'
    > {
  items: SelectOptionOrSectionWithKey<Value>[];
  /**
   * Whether the menu should close upon selection/deselection. In general, only
   * single-selection menus should close on select (this is the default behavior).
   */
  closeOnSelect?: boolean;
  /**
   * This list's index number inside composite select menus.
   */
  compositeIndex?: number;
  /**
   * Whether to render a grid list rather than a list box.
   *
   * Unlike list boxes, grid lists are two-dimensional. Users can press Arrow Up/Down to
   * move between option rows, and Arrow Left/Right to move between columns. This is
   * useful when the selector contains options with smaller, interactive elements
   * (buttons/links) inside. Grid lists allow users to focus on those child elements and
   * interact with them, which isn't possible with list boxes.
   */
  grid?: boolean;
  /**
   * Custom function to determine whether an option is disabled. By default, an option
   * is considered disabled when it has {disabled: true}.
   */
  isOptionDisabled?: (opt: SelectOption<Value>) => boolean;
  /**
   * Text label to be rendered as heading on top of grid list.
   */
  label?: React.ReactNode;
  size?: FormSize;
}

export interface SingleListProps<Value extends React.Key> extends BaseListProps<Value> {
  defaultValue?: Value;
  multiple?: false;
  onChange?: (selectedOption: SelectOption<Value>) => void;
  value?: Value;
}

export interface MultipleListProps<Value extends React.Key> extends BaseListProps<Value> {
  multiple: true;
  defaultValue?: Value[];
  onChange?: (selectedOptions: SelectOption<Value>[]) => void;
  value?: Value[];
}

/**
 * A list containing selectable options. Depending on the `grid` prop, this may be a
 * grid list or list box.
 *
 * In composite selectors, there may be multiple self-contained lists, each
 * representing a select "region".
 */
function List<Value extends React.Key>({
  items,
  value,
  defaultValue,
  onChange,
  grid,
  multiple,
  disallowEmptySelection,
  isOptionDisabled,
  shouldFocusWrap = true,
  shouldFocusOnHover = true,
  compositeIndex = 0,
  closeOnSelect,
  ...props
}: SingleListProps<Value> | MultipleListProps<Value>) {
  const {overlayState, registerListState, saveSelectedOptions, filterOption} =
    useContext(SelectContext);

  /**
   * Props to be passed into useListState()
   */
  const listStateProps = useMemo<Partial<ListProps<any>>>(() => {
    const disabledKeys = [
      ...getDisabledOptions(items, isOptionDisabled),
      // Items that have been filtered out by the search function also needs to be marked
      // as disabled, so they are not reachable via keyboard.
      ...getDisabledOptions(items, (opt: SelectOption<Value>) => !filterOption(opt)),
    ];

    if (multiple) {
      return {
        selectionMode: 'multiple',
        disabledKeys,
        // react-aria turns all keys into strings
        selectedKeys: value?.map(String),
        defaultSelectedKeys: defaultValue?.map(String),
        disallowEmptySelection,
        allowDuplicateSelectionEvents: true,
        onSelectionChange: selection => {
          const selectedOptions = getSelectedOptions<Value>(items, selection);
          // Save selected options in SelectContext, to update the trigger label
          saveSelectedOptions(compositeIndex, selectedOptions);
          onChange?.(selectedOptions);

          // Close menu if closeOnSelect is true
          if (closeOnSelect) {
            overlayState?.close();
          }
        },
      };
    }

    return {
      selectionMode: 'single',
      disabledKeys,
      // react-aria turns all keys into strings
      selectedKeys: defined(value) ? [String(value)] : undefined,
      defaultSelectedKeys: defined(defaultValue) ? [String(defaultValue)] : undefined,
      disallowEmptySelection: disallowEmptySelection ?? true,
      allowDuplicateSelectionEvents: true,
      onSelectionChange: selection => {
        const selectedOption = getSelectedOptions(items, selection)[0] ?? null;
        // Save selected options in SelectContext, to update the trigger label
        saveSelectedOptions(compositeIndex, selectedOption);
        onChange?.(selectedOption);

        // Close menu if closeOnSelect is true or undefined (by default single-selection
        // menus will close on selection)
        if (closeOnSelect || !defined(closeOnSelect)) {
          overlayState?.close();
        }
      },
    };
  }, [
    value,
    defaultValue,
    onChange,
    items,
    isOptionDisabled,
    filterOption,
    multiple,
    disallowEmptySelection,
    compositeIndex,
    saveSelectedOptions,
    closeOnSelect,
    overlayState,
  ]);

  const listState = useListState({
    ...props,
    ...listStateProps,
    items,
  });

  // Register the initialized list state once on mount
  useEffect(() => {
    registerListState(compositeIndex, listState);
    saveSelectedOptions(
      compositeIndex,
      getSelectedOptions(items, listState.selectionManager.selectedKeys)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listState.collection]);

  const filteredItems = useMemo(() => {
    return [...listState.collection].filter(item => {
      // If this is a section
      if (item.type === 'section') {
        // Don't render section if all of its children are filtered out
        return [...item.childNodes].some(child => filterOption(child.props));
      }

      // If this is an option
      return filterOption(item.props);
    });
  }, [listState.collection, filterOption]);

  // In composite selects, focus should seamlessly move from one region (list) to
  // another when the ArrowUp/Down key is pressed
  const focusManager = useFocusManager();
  const firstFocusableKey = useMemo(() => {
    let firstKey = listState.collection.getFirstKey();

    while (
      firstKey &&
      (listState.collection.getItem(firstKey).type === 'section' ||
        listState.selectionManager.isDisabled(firstKey))
    ) {
      firstKey = listState.collection.getKeyAfter(firstKey);
    }

    return firstKey;
  }, [listState.collection, listState.selectionManager]);
  const lastFocusableKey = useMemo(() => {
    let lastKey = listState.collection.getLastKey();

    while (
      lastKey &&
      (listState.collection.getItem(lastKey).type === 'section' ||
        listState.selectionManager.isDisabled(lastKey))
    ) {
      lastKey = listState.collection.getKeyBefore(lastKey);
    }

    return lastKey;
  }, [listState.collection, listState.selectionManager]);

  /**
   * Keyboard event handler to seamlessly move focus from one composite list to another
   * when an arrow key is pressed. Returns a boolean indicating whether the keyboard
   * event was intercepted. If yes, then no further callback function should be run.
   */
  const keyDownHandler = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      // Don't handle ArrowDown/Up key presses if focus already wraps
      if (shouldFocusWrap && !grid) {
        return true;
      }

      // Move focus to next region when ArrowDown is pressed and the last item in this
      // list is currently focused
      if (
        e.key === 'ArrowDown' &&
        listState.selectionManager.focusedKey === lastFocusableKey
      ) {
        focusManager.focusNext({
          wrap: true,
          accept: element =>
            (element.getAttribute('role') === 'option' ||
              element.getAttribute('role') === 'row') &&
            element.getAttribute('aria-disabled') !== 'true',
        });

        return false; // event intercepted, don't run any further callbacks
      }

      // Move focus to previous region when ArrowUp is pressed and the first item in this
      // list is currently focused
      if (
        e.key === 'ArrowUp' &&
        listState.selectionManager.focusedKey === firstFocusableKey
      ) {
        focusManager.focusPrevious({
          wrap: true,
          accept: element =>
            (element.getAttribute('role') === 'option' ||
              element.getAttribute('role') === 'row') &&
            element.getAttribute('aria-disabled') !== 'true',
        });

        return false; // event intercepted, don't run any further callbacks
      }

      return true;
    },
    [
      focusManager,
      firstFocusableKey,
      lastFocusableKey,
      listState.selectionManager.focusedKey,
      shouldFocusWrap,
      grid,
    ]
  );

  const listId = useMemo(() => domId('select-list-'), []);

  return (
    <Fragment>
      {grid ? (
        <GridList
          {...props}
          id={listId}
          listItems={filteredItems}
          listState={listState}
          keyDownHandler={keyDownHandler}
        />
      ) : (
        <ListBox
          {...props}
          id={listId}
          listItems={filteredItems}
          listState={listState}
          shouldFocusWrap={shouldFocusWrap}
          shouldFocusOnHover={shouldFocusOnHover}
          keyDownHandler={keyDownHandler}
        />
      )}

      {multiple &&
        filteredItems.map(item => {
          if (item.type !== 'section' || !item.value.showToggleAllButton) {
            return null;
          }

          return (
            <HiddenSectionToggle
              key={item.key}
              item={item}
              listState={listState}
              listId={listId}
            />
          );
        })}
    </Fragment>
  );
}

export {List};
