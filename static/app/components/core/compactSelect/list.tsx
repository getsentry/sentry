import {createContext, Fragment, useContext, useId, useMemo} from 'react';
import {useFocusManager} from '@react-aria/focus';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import type {ListProps} from '@react-stately/list';
import {useListState} from '@react-stately/list';

import {defined} from 'sentry/utils';
import type {FormSize} from 'sentry/utils/theme';

import {ControlContext} from './control';
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
  shouldCloseOnSelect,
} from './utils';

export const SelectFilterContext = createContext(new Set<SelectKey>());

interface BaseListProps<Value extends SelectKey>
  extends Omit<ListProps<any>, 'disallowEmptySelection'>,
    Omit<
      AriaListBoxOptions<any>,
      | 'disallowEmptySelection'
      | 'disabledKeys'
      | 'selectedKeys'
      | 'defaultSelectedKeys'
      | 'onSelectionChange'
      | 'autoFocus'
      | 'shouldUseVirtualFocus'
      | 'isVirtualized'
    >,
    Omit<
      AriaGridListOptions<any>,
      | 'disallowEmptySelection'
      | 'disabledKeys'
      | 'selectedKeys'
      | 'defaultSelectedKeys'
      | 'onSelectionChange'
      | 'autoFocus'
      | 'shouldUseVirtualFocus'
      | 'isVirtualized'
    > {
  items: Array<SelectOptionOrSectionWithKey<Value>>;
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

  /**
   * If true, virtualization will be enabled for the list
   */
  virtualized?: boolean;
}

/**
 * A single-selection (only one option can be selected at a time) list that allows
 * clearing the selection.
 * `value` can be `undefined` to represent no selection.
 */
interface SingleClearableListProps<Value extends SelectKey> extends BaseListProps<Value> {
  /**
   * If true, there will be a "Clear" button in the menu header.
   */
  clearable: true;
  onChange: (selectedOption: SelectOption<Value> | undefined) => void;
  value: Value | undefined;
  /**
   * Whether to close the menu. Accepts either a boolean value or a callback function
   * that receives the newly selected option and returns whether to close the menu.
   */
  closeOnSelect?:
    | boolean
    | ((selectedOption: SelectOption<Value> | undefined) => boolean);
  multiple?: false;
}

export type SingleListProps<Value extends SelectKey> =
  | SingleClearableListProps<Value>
  | SingleUnclearableListProps<Value>;

interface SingleUnclearableListProps<Value extends SelectKey>
  extends BaseListProps<Value> {
  onChange: (selectedOption: SelectOption<Value>) => void;
  value: Value | undefined;
  clearable?: false;
  /**
   * Whether to close the menu. Accepts either a boolean value or a callback function
   * that receives the newly selected option and returns whether to close the menu.
   */
  closeOnSelect?: boolean | ((selectedOption: SelectOption<Value>) => boolean);
  multiple?: false;
}

export interface MultipleListProps<Value extends SelectKey> extends BaseListProps<Value> {
  multiple: true;
  onChange: (selectedOptions: Array<SelectOption<Value>>) => void;
  value: Value[] | undefined;
  clearable?: boolean; // set to a regular boolean here because the empty type can be represented as an empty array

  /**
   * Whether to close the menu. Accepts either a boolean value or a callback function
   * that receives the newly selected options and returns whether to close the menu.
   */
  closeOnSelect?: boolean | ((selectedOptions: Array<SelectOption<Value>>) => boolean);
}

/**
 * A list containing selectable options. Depending on the `grid` prop, this may be a
 * grid list or list box.
 *
 * In composite selectors, there may be multiple self-contained lists, each
 * representing a select "region".
 */
export function List<Value extends SelectKey>({
  items,
  value,
  onChange,
  grid,
  multiple,
  clearable,
  isOptionDisabled,
  shouldFocusWrap = true,
  shouldFocusOnHover = true,
  sizeLimit,
  sizeLimitMessage,
  closeOnSelect,
  ...props
}: SingleListProps<Value> | MultipleListProps<Value>) {
  const {overlayState, search, overlayIsOpen} = useContext(ControlContext);

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
        selectedKeys: value?.map(getEscapedKey) ?? [],
        allowDuplicateSelectionEvents: true,
        onSelectionChange: selection => {
          const selectedOptions = getSelectedOptions<Value>(items, selection);
          onChange?.(selectedOptions);

          if (shouldCloseOnSelect({multiple, closeOnSelect, selectedOptions})) {
            overlayState?.close();
          }
        },
      };
    }

    return {
      selectionMode: 'single' as const,
      disabledKeys,
      // react-aria turns all keys into strings
      // we're setting selectedKeys to an empty array when value is undefined, because
      // undefined makes react-aria treat it as uncontrolled
      selectedKeys: defined(value) ? [getEscapedKey(value)] : [],
      disallowEmptySelection: !clearable,
      allowDuplicateSelectionEvents: true,
      onSelectionChange: selection => {
        const selectedOption = getSelectedOptions(items, selection)[0]!;
        onChange?.(selectedOption);

        // Close menu if closeOnSelect is true or undefined (by default single-selection
        // menus will close on selection)
        if (
          shouldCloseOnSelect({
            multiple,
            closeOnSelect,
            selectedOptions: [selectedOption],
          })
        ) {
          overlayState?.close();
        }
      },
    };
  }, [
    value,
    onChange,
    items,
    isOptionDisabled,
    hiddenOptions,
    multiple,
    clearable,
    closeOnSelect,
    overlayState,
  ]);

  const listState = useListState({
    ...props,
    ...listStateProps,
    items,
  });

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
  const keyDownHandler = (e: React.KeyboardEvent<HTMLUListElement>) => {
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
  };

  const listId = useId();

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
        <SelectFilterContext value={hiddenOptions}>
          <GridList
            {...props}
            id={listId}
            listState={listState}
            sizeLimitMessage={sizeLimitMessage}
            keyDownHandler={keyDownHandler}
          />
        </SelectFilterContext>
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
