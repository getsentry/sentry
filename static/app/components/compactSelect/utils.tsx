import {useCallback, useMemo} from 'react';
import {useFocus, usePress} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {ListState} from '@react-stately/list';
import type {SelectionManager} from '@react-stately/selection';
import type {Node, Selection} from '@react-types/shared';

import {t} from 'sentry/locale';

import {SectionToggleButton} from './styles';
import type {
  SelectKey,
  SelectOption,
  SelectOptionOrSection,
  SelectOptionOrSectionWithKey,
  SelectOptionWithKey,
  SelectSection,
} from './types';

export function getEscapedKey<Value extends SelectKey | undefined>(value: Value): string {
  return CSS.escape(String(value));
}

export function getItemsWithKeys<Value extends SelectKey>(
  options: Array<SelectOption<Value>>
): Array<SelectOptionWithKey<Value>>;
export function getItemsWithKeys<Value extends SelectKey>(
  options: Array<SelectOptionOrSection<Value>>
): Array<SelectOptionOrSectionWithKey<Value>>;
export function getItemsWithKeys<Value extends SelectKey>(
  options: Array<SelectOptionOrSection<Value>>
): Array<SelectOptionOrSectionWithKey<Value>> {
  return options.map((item, i) => {
    if ('options' in item) {
      return {
        ...item,
        key: item.key ?? `options-${i}`,
        options: getItemsWithKeys(item.options),
      };
    }

    const existingKey =
      'key' in item && typeof item.key === 'string' ? item.key : undefined;

    return {...item, key: existingKey ?? getEscapedKey(item.value)};
  });
}

/**
 * Recursively finds the selected option(s) from an options array. Useful for
 * non-flat arrays that contain sections (groups of options).
 */
export function getSelectedOptions<Value extends SelectKey>(
  items: Array<SelectOptionOrSectionWithKey<Value>>,
  selection: Selection
): Array<SelectOption<Value>> {
  return items.reduce<Array<SelectOption<Value>>>((acc, cur) => {
    // If this is a section
    if ('options' in cur) {
      return acc.concat(getSelectedOptions(cur.options, selection));
    }

    // If this is an option
    if (selection === 'all' || selection.has(cur.key)) {
      const {key: _key, ...opt} = cur;
      return acc.concat(opt);
    }
    return acc;
  }, []);
}

/**
 * Recursively finds the selected option(s) from an options array. Useful for non-flat
 * arrays that contain sections (groups of options). Returns the values of options that
 * were removed.
 */
export function getDisabledOptions<Value extends SelectKey>(
  items: Array<SelectOptionOrSectionWithKey<Value>>,
  isOptionDisabled?: (opt: SelectOptionWithKey<Value>) => boolean
): SelectKey[] {
  return items.reduce((acc: SelectKey[], cur) => {
    // If this is a section
    if ('options' in cur) {
      if (cur.disabled) {
        // If the entire section is disabled, then mark all of its children as disabled
        return acc.concat(cur.options.map(opt => opt.key));
      }
      return acc.concat(getDisabledOptions(cur.options, isOptionDisabled));
    }

    // If this is an option
    if (isOptionDisabled?.(cur) ?? cur.disabled) {
      return acc.concat(cur.key);
    }
    return acc;
  }, []);
}

/**
 * Recursively finds the option(s) that don't match the designated search string or are
 * outside the list box's count limit.
 */
export function getHiddenOptions<Value extends SelectKey>(
  items: Array<SelectOptionOrSectionWithKey<Value>>,
  search: string,
  limit = Infinity,
  filterOption?: (opt: SelectOption<Value>, search: string) => boolean
): Set<SelectKey> {
  //
  // First, filter options using `search` value
  //
  const _filterOption =
    filterOption ??
    ((opt: SelectOption<Value>) =>
      `${opt.label ?? ''}${opt.textValue ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()));

  const hiddenOptionsSet = new Set<SelectKey>();
  const remainingItems = items
    .flatMap<SelectOptionOrSectionWithKey<Value> | null>(item => {
      if ('options' in item) {
        const filteredOptions = item.options
          .map(opt => {
            if (_filterOption(opt, search)) {
              return opt;
            }

            hiddenOptionsSet.add(opt.key);
            return null;
          })
          .filter((opt): opt is SelectOptionWithKey<Value> => !!opt);

        return filteredOptions.length > 0 ? {...item, options: filteredOptions} : null;
      }

      if (_filterOption(item, search)) {
        return item;
      }

      hiddenOptionsSet.add(item.key);
      return null;
    })
    .filter((item): item is SelectOptionOrSectionWithKey<Value> => !!item);

  //
  // Then, limit the number of remaining options to `limit`
  //
  let threshold = [Infinity, Infinity];
  let accumulator = 0;
  let currentIndex = 0;

  while (currentIndex < remainingItems.length) {
    const item = remainingItems[currentIndex]!;
    const delta = 'options' in item ? item.options.length : 1;

    if (accumulator + delta > limit) {
      threshold = [currentIndex, limit - accumulator];
      break;
    }

    accumulator += delta;
    currentIndex += 1;
  }

  for (let i = threshold[0]!; i < remainingItems.length; i++) {
    const item = remainingItems[i]!;
    if ('options' in item) {
      const startingIndex = i === threshold[0] ? threshold[1]! : 0;
      for (let j = startingIndex; j < item.options.length; j++) {
        hiddenOptionsSet.add(item.options[j]!.key);
      }
    } else {
      hiddenOptionsSet.add(item.key);
    }
  }

  // Return the values of options that were removed.
  return hiddenOptionsSet;
}

/**
 * Toggles (select/unselect) all provided options. If none/some of the options are
 * selected, then this function selects all of them. If all of the options are selected,
 * then this function unselects all of them.
 */
export function toggleOptions<Value extends SelectKey>(
  optionKeys: Value[],
  selectionManager: SelectionManager
) {
  const {selectedKeys} = selectionManager;
  const newSelectedKeys = new Set(selectedKeys);

  const allOptionsSelected = optionKeys.every(val => selectionManager.isSelected(val));

  optionKeys.forEach(val =>
    allOptionsSelected ? newSelectedKeys.delete(val) : newSelectedKeys.add(val)
  );

  selectionManager.setSelectedKeys(newSelectedKeys);
}

interface SectionToggleProps {
  item: Node<any>;
  listState: ListState<any>;
  listId?: string;
  onToggle?: (section: SelectSection<SelectKey>, type: 'select' | 'unselect') => void;
}

/**
 * A visible toggle button to select/unselect all options within a given section. See
 * also: `HiddenSectionToggle`.
 */
export function SectionToggle({item, listState, onToggle}: SectionToggleProps) {
  const allOptionsSelected = useMemo(
    () => [...item.childNodes].every(n => listState.selectionManager.isSelected(n.key)),
    [item, listState.selectionManager]
  );

  const visible = useMemo(() => {
    const listHasFocus = listState.selectionManager.isFocused;
    const sectionHasFocus = [...item.childNodes].some(
      n => listState.selectionManager.focusedKey === n.key
    );
    return listHasFocus && sectionHasFocus;
  }, [item, listState.selectionManager.focusedKey, listState.selectionManager.isFocused]);

  const toggleAllOptions = useCallback(() => {
    onToggle?.(item.value, allOptionsSelected ? 'unselect' : 'select');
    toggleOptions(
      [...item.childNodes].map(n => n.key),
      listState.selectionManager
    );
  }, [onToggle, allOptionsSelected, item, listState.selectionManager]);

  return (
    <SectionToggleButton
      data-key={item.key}
      visible={visible}
      size="zero"
      borderless
      // Remove this button from keyboard navigation and the accessibility tree, since
      // the outer list component implements a roving `tabindex` system that would be
      // messed up if there was a focusable, non-selectable button in the middle of it.
      // Keyboard users will still be able to toggle-select sections with hidden buttons
      // at the end of the list (see `HiddenSectionToggle` below)
      aria-hidden
      tabIndex={-1}
      onClick={toggleAllOptions}
    >
      {allOptionsSelected ? t('Unselect All') : t('Select All')}
    </SectionToggleButton>
  );
}

/**
 * A visually hidden but keyboard-focusable button to toggle (select/unselect) all
 * options in a given section. We need these hidden buttons because the visible toggle
 * buttons inside ListBox/GridList are not keyboard-focusable (due to them implementing
 * roving `tabindex`).
 */
export function HiddenSectionToggle({
  item,
  listState,
  onToggle,
  listId = '',
  ...props
}: SectionToggleProps) {
  // Highlight this toggle's visible counterpart (rendered inside the list box) on focus
  const {focusProps} = useFocus({
    onFocus: () => {
      const visibleCounterpart = document.querySelector(
        `#${listId} button[aria-hidden][data-key="${item.key}"]`
      );

      if (!visibleCounterpart) {
        return;
      }
      visibleCounterpart.classList.add('focus-visible');
    },
    onBlur: () => {
      const visibleCounterpart = document.querySelector(
        `#${listId} button[aria-hidden][data-key="${item.key}"]`
      );

      if (!visibleCounterpart) {
        return;
      }
      visibleCounterpart.classList.remove('focus-visible');
    },
  });

  /**
   * Whether all options in this section are currently selected
   */
  const allOptionsSelected = useMemo(
    () => [...item.childNodes].every(n => listState.selectionManager.isSelected(n.key)),
    [item, listState.selectionManager]
  );

  const {pressProps} = usePress({
    onPress: () => {
      onToggle?.(item.value, allOptionsSelected ? 'unselect' : 'select');
      toggleOptions(
        [...item.childNodes].map(n => n.key),
        listState.selectionManager
      );
    },
  });

  return (
    <VisuallyHidden role="presentation">
      <button
        {...props}
        {...mergeProps(focusProps, pressProps)}
        aria-controls={listId}
        id={`${listId}-section-toggle-${item.key}`}
      >
        {allOptionsSelected ? t('Unselect All in ') : t('Select All in ')}
        {item.textValue ?? item.rendered}
      </button>
    </VisuallyHidden>
  );
}
