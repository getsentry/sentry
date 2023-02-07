import {Fragment, useContext, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useFocusManager} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import {AriaListBoxOptions, useListBox} from '@react-aria/listbox';
import {mergeProps} from '@react-aria/utils';
import {ListProps, useListState} from '@react-stately/list';
import {Selection} from '@react-types/shared';

import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from './control';
import {Option} from './option';
import {Section} from './section';
import {SelectOption, SelectOptionOrSection, SelectOptionOrSectionWithKey} from './types';

interface BaseListBoxProps<Value extends React.Key>
  extends ListProps<any>,
    Omit<
      AriaListBoxOptions<any>,
      'disabledKeys' | 'selectedKeys' | 'defaultSelectedKeys' | 'onSelectionChange'
    > {
  items: SelectOptionOrSectionWithKey<Value>[];
  /**
   * Whether the menu should close upon selection/deselection. In general, only
   * single-selection menus should close on select (this is the default behavior).
   */
  closeOnSelect?: boolean;
  /**
   * The index number of this list box inside composite select menus, which contain
   * multiple list boxes (each corresponding to a select region).
   */
  compositeIndex?: number;
  /**
   * Custom function to determine whether an option is disabled. By default, an option
   * is considered disabled when it has {disabled: true}.
   */
  isOptionDisabled?: (opt: SelectOption<Value>) => boolean;
  label?: React.ReactNode;
  size?: FormSize;
}

export interface SingleListBoxProps<Value extends React.Key>
  extends BaseListBoxProps<Value> {
  defaultValue?: Value;
  multiple?: false;
  onChange?: (selectedOption: SelectOption<Value>) => void;
  value?: Value;
}

export interface MultipleListBoxProps<Value extends React.Key>
  extends BaseListBoxProps<Value> {
  multiple: true;
  defaultValue?: Value[];
  onChange?: (selectedOptions: SelectOption<Value>[]) => void;
  value?: Value[];
}

/**
 * A list box wrapper with accessibile behaviors & attributes. In composite selectors,
 * there may be multiple self-contained list boxes, each representing a select "region".
 * https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
function ListBox<Value extends React.Key>({
  items,
  value,
  defaultValue,
  onChange,
  multiple,
  disallowEmptySelection,
  isOptionDisabled,
  size = 'md',
  shouldFocusWrap = true,
  shouldFocusOnHover = true,
  compositeIndex = 0,
  closeOnSelect,
  label,
  ...props
}: SingleListBoxProps<Value> | MultipleListBoxProps<Value>) {
  const ref = useRef<HTMLUListElement>(null);
  const {
    overlayState,
    overlayIsOpen,
    registerListState,
    saveSelectedOptions,
    filterOption,
  } = useContext(SelectContext);

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

  const [hasFocus, setHasFocus] = useState(false);
  const {listBoxProps, labelProps} = useListBox(
    {
      ...props,
      label,
      onFocusChange: setHasFocus,
      shouldFocusWrap,
      shouldFocusOnHover,
      shouldSelectOnPressUp: true,
    },
    listState,
    ref
  );

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

  // In composite selects, focus should seamlessly move from one region (listbox) to
  // another when the ArrowUp/Down key is pressed
  const focusManager = useFocusManager();
  const firstFocusableKey = useMemo(() => {
    let firstKey = listState.collection.getFirstKey();
    while (firstKey && listState.selectionManager.isDisabled(firstKey)) {
      firstKey = listState.collection.getKeyAfter(firstKey);
    }
    return firstKey;
  }, [listState.collection, listState.selectionManager]);
  const lastFocusableKey = useMemo(() => {
    let lastKey = listState.collection.getLastKey();
    while (lastKey && listState.selectionManager.isDisabled(lastKey)) {
      lastKey = listState.collection.getKeyBefore(lastKey);
    }
    return lastKey;
  }, [listState.collection, listState.selectionManager]);
  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
      // Continue propagation, otherwise the overlay won't close on Esc key press
      e.continuePropagation();

      // Don't handle ArrowDown/Up key presses if focus already wraps
      if (shouldFocusWrap) {
        return;
      }

      // Move focus to next region when ArrowDown is pressed and the last item in this
      // list box is currently focused
      if (
        e.key === 'ArrowDown' &&
        listState.selectionManager.focusedKey === lastFocusableKey
      ) {
        focusManager.focusNext({
          wrap: true,
          accept: element =>
            element.getAttribute('role') === 'option' &&
            element.getAttribute('aria-disabled') !== 'true',
        });
      }

      // Move focus to previous region when ArrowUp is pressed and the first item in this
      // list box is currently focused
      if (
        e.key === 'ArrowUp' &&
        listState.selectionManager.focusedKey === firstFocusableKey
      ) {
        focusManager.focusPrevious({
          wrap: true,
          accept: element =>
            element.getAttribute('role') === 'option' &&
            element.getAttribute('aria-disabled') !== 'true',
        });
      }
    },
  });

  return (
    <Fragment>
      {filteredItems.length !== 0 && <Separator role="separator" />}
      {filteredItems.length !== 0 && label && <Label {...labelProps}>{label}</Label>}
      <SelectListBoxWrap {...mergeProps(listBoxProps, keyboardProps)} ref={ref}>
        {overlayIsOpen &&
          filteredItems.map(item => {
            if (item.type === 'section') {
              return (
                <Section
                  key={item.key}
                  item={item}
                  listState={listState}
                  listBoxHasFocus={hasFocus}
                  size={size}
                />
              );
            }

            return (
              <Option
                key={item.key}
                item={item}
                listState={listState}
                listBoxHasFocus={hasFocus}
                size={size}
              />
            );
          })}
      </SelectListBoxWrap>
    </Fragment>
  );
}

export {ListBox};

/**
 * Recursively finds the selected option(s) from an options array. Useful for
 * non-flat arrays that contain sections (groups of options).
 */
function getSelectedOptions<Value extends React.Key>(
  items: SelectOptionOrSectionWithKey<Value>[],
  selection: Selection
): SelectOption<Value>[] {
  return items.reduce<SelectOption<Value>[]>((acc, cur) => {
    // If this is a section
    if ('options' in cur) {
      return acc.concat(getSelectedOptions(cur.options, selection));
    }

    // If this is an option
    if (selection === 'all' || selection.has(String(cur.value))) {
      const {key: _key, ...opt} = cur;
      return acc.concat(opt);
    }
    return acc;
  }, []);
}

/**
 * Recursively finds the selected option(s) from an options array. Useful for
 * non-flat arrays that contain sections (groups of options).
 */
function getDisabledOptions<Value extends React.Key>(
  items: SelectOptionOrSection<Value>[],
  isOptionDisabled?: (opt: SelectOption<Value>) => boolean
): Value[] {
  return items.reduce((acc: Value[], cur) => {
    // If this is a section
    if ('options' in cur) {
      if (cur.disabled) {
        // If the entire section is disabled, then mark all of its children as disabled
        return acc.concat(cur.options.map(opt => opt.value));
      }
      return acc.concat(getDisabledOptions(cur.options, isOptionDisabled));
    }

    // If this is an option
    if (isOptionDisabled?.(cur) ?? cur.disabled) {
      return acc.concat(cur.value);
    }
    return acc;
  }, []);
}

const SelectListBoxWrap = styled('ul')`
  margin: 0;
  padding: ${space(0.5)} 0;

  /* Add 1px to top padding if preceded by menu header, to account for the header's
  shadow border */
  div[data-header] ~ &:first-of-type,
  div[data-header] ~ div > &:first-of-type {
    padding-top: calc(${space(0.5)} + 1px);
  }

  /* Remove top padding if preceded by search input, since search input already has
  vertical padding */
  input ~ &&:first-of-type,
  input ~ div > &&:first-of-type {
    padding-top: 0;
  }

  /* Should scroll if it's in a non-composite select */
  :only-of-type {
    min-height: 0;
    overflow: auto;
  }

  :focus-visible {
    outline: none;
  }
`;

const Label = styled('p')`
  display: inline-block;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  white-space: nowrap;
  margin: ${space(0.5)} ${space(1.5)};
  padding-right: ${space(1)};
`;

const Separator = styled('div')`
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)};

  :first-child {
    display: none;
  }

  ul:empty + & {
    display: none;
  }
`;
