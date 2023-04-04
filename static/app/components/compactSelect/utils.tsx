import {useCallback, useMemo} from 'react';
import {useFocus, usePress} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {ListState} from '@react-stately/list';
import {SelectionManager} from '@react-stately/selection';
import {Node, Selection} from '@react-types/shared';

import {t} from 'sentry/locale';

import {SectionToggleButton} from './styles';
import {SelectOption, SelectOptionOrSection, SelectOptionOrSectionWithKey} from './types';

/**
 * Recursively finds the selected option(s) from an options array. Useful for
 * non-flat arrays that contain sections (groups of options).
 */
export function getSelectedOptions<Value extends React.Key>(
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
 * Recursively finds the selected option(s) from an options array. Useful for non-flat
 * arrays that contain sections (groups of options). Returns the values of options that
 * were removed.
 */
export function getDisabledOptions<Value extends React.Key>(
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

/**
 * Recursively finds the option(s) that don't match the designated search string or are
 * outside the list box's count limit.
 */
export function getHiddenOptions<Value extends React.Key>(
  items: SelectOptionOrSection<Value>[],
  search: string,
  limit: number = Infinity
): Set<Value> {
  //
  // First, filter options using `search` value
  //
  const filterOption = (opt: SelectOption<Value>) =>
    String(opt.label ?? '')
      .toLowerCase()
      .includes(search.toLowerCase());

  const itemsToHide: Value[] = [];
  const remainingItems = items
    .map<SelectOptionOrSection<Value> | null>(item => {
      if ('options' in item) {
        const filteredOptions = item.options
          .map(opt => {
            if (filterOption(opt)) {
              return opt;
            }

            itemsToHide.push(opt.value);
            return null;
          })
          .filter((opt): opt is SelectOption<Value> => !!opt);

        return filteredOptions.length > 0 ? {...item, options: filteredOptions} : null;
      }

      if (filterOption(item)) {
        return item;
      }

      itemsToHide.push(item.value);
      return null;
    })
    .flat()
    .filter((item): item is SelectOptionOrSection<Value> => !!item);

  //
  // Then, limit the number of remaining options to `limit`
  //
  let threshold = [Infinity, Infinity];
  let accumulator = 0;
  let currentIndex = 0;

  while (currentIndex < remainingItems.length) {
    const item = remainingItems[currentIndex];
    const delta = 'options' in item ? item.options.length : 1;

    if (accumulator + delta > limit) {
      threshold = [currentIndex, limit - accumulator];
      break;
    }

    accumulator += delta;
    currentIndex += 1;
  }

  // Return the values of options that were removed.
  return new Set([
    ...itemsToHide,
    ...remainingItems.slice(threshold[0]).reduce((acc: Value[], cur, index) => {
      if ('options' in cur) {
        return acc.concat(
          index === 0
            ? cur.options.slice(threshold[1]).map(o => o.value)
            : cur.options.map(o => o.value)
        );
      }

      return acc.concat(cur.value);
    }, []),
  ]);
}

/**
 * Toggles (select/unselect) all provided options. If none/some of the options are
 * selected, then this function selects all of them. If all of the options are selected,
 * then this function unselects all of them.
 */
export function toggleOptions<Value extends React.Key>(
  optionValues: Value[],
  selectionManager: SelectionManager
) {
  const {selectedKeys} = selectionManager;
  const newSelectedKeys = new Set(selectedKeys);

  const allOptionsSelected = optionValues.every(val => selectionManager.isSelected(val));

  optionValues.forEach(val =>
    allOptionsSelected ? newSelectedKeys.delete(val) : newSelectedKeys.add(val)
  );

  selectionManager.setSelectedKeys(newSelectedKeys);
}

interface SectionToggleProps {
  item: Node<any>;
  listState: ListState<any>;
  listId?: string;
}

/**
 * A visible toggle button to select/unselect all options within a given section. See
 * also: `HiddenSectionToggle`.
 */
export const SectionToggle = ({item, listState}: SectionToggleProps) => {
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

  const toggleAllOptions = useCallback(
    () =>
      toggleOptions(
        [...item.childNodes].map(n => n.key),
        listState.selectionManager
      ),
    [item, listState.selectionManager]
  );

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
};

/**
 * A visually hidden but keyboard-focusable button to toggle (select/unselect) all
 * options in a given section. We need these hidden buttons because the visible toggle
 * buttons inside ListBox/GridList are not keyboard-focusable (due to them implementing
 * roving `tabindex`).
 */
export const HiddenSectionToggle = ({
  item,
  listState,
  listId = '',
  ...props
}: SectionToggleProps) => {
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
    onPress: () =>
      toggleOptions(
        [...item.childNodes].map(n => n.key),
        listState.selectionManager
      ),
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
};
