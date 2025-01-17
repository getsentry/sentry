import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
} from 'react';
import {useFocusManager} from '@react-aria/focus';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import type {ListProps} from '@react-stately/list';
import {useListState} from '@react-stately/list';

import {defined} from 'sentry/utils';
import domId from 'sentry/utils/domId';
import type {FormSize} from 'sentry/utils/theme';

import {SelectContext} from './control';
import {GridList} from './gridList';
import {ListBox} from './listBox';
import type {
  SelectKey,
  SelectOption,
  SelectOptionOrSectionWithKey,
  SelectOptionWithKey,
  SelectSection,
} from './types';
import {
  getDisabledOptions,
  getEscapedKey,
  getHiddenOptions,
  getSelectedOptions,
  HiddenSectionToggle,
} from './utils';

export const SelectFilterContext = createContext(new Set<SelectKey>());

interface BaseListProps<Value extends SelectKey>
  extends ListProps<any>,
    Omit<
      AriaListBoxOptions<any>,
      | 'disabledKeys'
      | 'selectedKeys'
      | 'defaultSelectedKeys'
      | 'onSelectionChange'
      | 'autoFocus'
    >,
    Omit<
      AriaGridListOptions<any>,
      | 'disabledKeys'
      | 'selectedKeys'
      | 'defaultSelectedKeys'
      | 'onSelectionChange'
      | 'autoFocus'
    > {
  items: SelectOptionOrSectionWithKey<Value>[];
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
  isOptionDisabled?: (opt: SelectOptionWithKey<Value>) => boolean;
  /**
   * Text label to be rendered as heading on top of grid list.
   */
  label?: React.ReactNode;
  /**
   * To be called when the user toggle-selects a whole section (applicable when sections
   * have `showToggleAllButton` set to true.) Note: this will be called in addition to
   * and before `onChange`.
   */
  onSectionToggle?: (section: SelectSection<SelectKey>) => void;
  size?: FormSize;
  /**
   * Upper limit for the number of options to display in the menu at a time. Users can
   * still find overflowing options by using the search box (if `searchable` is true).
   * If used, make sure to hoist selected options to the top, otherwise they may be
   * hidden from view.
   */
  sizeLimit?: number;
  /**
   * Message to be displayed when some options are hidden due to `sizeLimit`.
   */
  sizeLimitMessage?: string;
}

export interface SingleListProps<Value extends SelectKey> extends BaseListProps<Value> {
  /**
   * Whether to close the menu. Accepts either a boolean value or a callback function
   * that receives the newly selected option and returns whether to close the menu.
   */
  closeOnSelect?: boolean | ((selectedOption: SelectOption<Value>) => boolean);
  defaultValue?: Value;
  multiple?: false;
  onChange?: (selectedOption: SelectOption<Value>) => void;
  value?: Value;
}

export interface MultipleListProps<Value extends SelectKey> extends BaseListProps<Value> {
  multiple: true;
  /**
   * Whether to close the menu. Accepts either a boolean value or a callback function
   * that receives the newly selected options and returns whether to close the menu.
   */
  closeOnSelect?: boolean | ((selectedOptions: SelectOption<Value>[]) => boolean);
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
function List<Value extends SelectKey>({
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
  sizeLimit,
  sizeLimitMessage,
  closeOnSelect,
  ...props
}: SingleListProps<Value> | MultipleListProps<Value>) {
  const {overlayState, registerListState, saveSelectedOptions, search, overlayIsOpen} =
    useContext(SelectContext);

  const hiddenOptions = useMemo(
    () => getHiddenOptions(items, search, sizeLimit),
    [items, search, sizeLimit]
  );

  /**
   * Props to be passed into useListState()
   */
  const listStateProps = useMemo<Partial<ListProps<any>>>(() => {
    const disabledKeys = [
      ...getDisabledOptions(items, isOptionDisabled),
      ...hiddenOptions,
    ];

    if (multiple) {
      return {
        selectionMode: 'multiple' as const,
        disabledKeys,
        // react-aria turns all keys into strings
        selectedKeys: value?.map(getEscapedKey),
        defaultSelectedKeys: defaultValue?.map(getEscapedKey),
        disallowEmptySelection,
        allowDuplicateSelectionEvents: true,
        onSelectionChange: selection => {
          const selectedOptions = getSelectedOptions<Value>(items, selection);
          // Save selected options in SelectContext, to update the trigger label
          saveSelectedOptions(compositeIndex, selectedOptions);
          onChange?.(selectedOptions);

          // Close menu if closeOnSelect is true
          if (
            typeof closeOnSelect === 'function'
              ? closeOnSelect(selectedOptions)
              : closeOnSelect
          ) {
            overlayState?.close();
          }
        },
      };
    }

    return {
      selectionMode: 'single' as const,
      disabledKeys,
      // react-aria turns all keys into strings
      selectedKeys: defined(value) ? [getEscapedKey(value)] : undefined,
      defaultSelectedKeys: defined(defaultValue)
        ? [getEscapedKey(defaultValue)]
        : undefined,
      disallowEmptySelection: disallowEmptySelection ?? true,
      allowDuplicateSelectionEvents: true,
      onSelectionChange: selection => {
        const selectedOption = getSelectedOptions(items, selection)[0]!;
        // Save selected options in SelectContext, to update the trigger label
        saveSelectedOptions(compositeIndex, selectedOption ?? null);
        onChange?.(selectedOption ?? null);

        // Close menu if closeOnSelect is true or undefined (by default single-selection
        // menus will close on selection)
        if (
          !defined(closeOnSelect) ||
          (typeof closeOnSelect === 'function'
            ? closeOnSelect(selectedOption ?? null)
            : closeOnSelect)
        ) {
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
    hiddenOptions,
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
  useLayoutEffect(() => {
    registerListState(compositeIndex, listState);
    saveSelectedOptions(
      compositeIndex,
      getSelectedOptions(items, listState.selectionManager.selectedKeys)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listState.collection]);

  // In composite selects, focus should seamlessly move from one region (list) to
  // another when the ArrowUp/Down key is pressed
  const focusManager = useFocusManager();
  const firstFocusableKey = useMemo(() => {
    let firstKey = listState.collection.getFirstKey();

    while (
      firstKey &&
      (listState.collection.getItem(firstKey)?.type === 'section' ||
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
      (listState.collection.getItem(lastKey)?.type === 'section' ||
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
        focusManager?.focusNext({
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
        focusManager?.focusPrevious({
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

  const sections = useMemo(
    () =>
      [...listState.collection].filter(
        item =>
          // This is a section
          item.type === 'section' &&
          // Options inside the section haven't been all filtered out
          ![...item.childNodes].every(child => hiddenOptions.has(child.key))
      ),

    [listState.collection, hiddenOptions]
  );

  return (
    <Fragment>
      {grid ? (
        <SelectFilterContext.Provider value={hiddenOptions}>
          <GridList
            {...props}
            id={listId}
            listState={listState}
            sizeLimitMessage={sizeLimitMessage}
            keyDownHandler={keyDownHandler}
          />
        </SelectFilterContext.Provider>
      ) : (
        <ListBox
          {...props}
          hasSearch={!!search}
          overlayIsOpen={overlayIsOpen}
          hiddenOptions={hiddenOptions}
          id={listId}
          listState={listState}
          shouldFocusWrap={shouldFocusWrap}
          shouldFocusOnHover={shouldFocusOnHover}
          sizeLimitMessage={sizeLimitMessage}
          keyDownHandler={keyDownHandler}
        />
      )}

      {multiple &&
        sections.map(
          section =>
            section.value.showToggleAllButton && (
              <HiddenSectionToggle
                key={section.key}
                item={section}
                listState={listState}
                listId={listId}
                onToggle={props.onSectionToggle}
              />
            )
        )}
    </Fragment>
  );
}

export {List};
