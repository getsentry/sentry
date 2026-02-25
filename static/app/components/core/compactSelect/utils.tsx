import {useCallback, useMemo} from 'react';
import {useFocus, usePress} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {ListState} from '@react-stately/list';
import type {Node, Selection} from '@react-types/shared';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {fzf} from 'sentry/utils/search/fzf';

import type {SelectProps} from './compactSelect';
import {SectionToggleButton} from './styles';
import type {
  SearchConfig,
  SearchMatchResult,
  SelectKey,
  SelectOption,
  SelectOptionOrSection,
  SelectOptionOrSectionWithKey,
  SelectOptionWithKey,
  SelectSection,
  SelectSectionWithKey,
} from './types';

/**
 * Normalises the `search` prop into a plain config object (or `undefined` if
 * search is disabled). Accepts `true` as shorthand for `{}` and treats
 * `false`/`undefined` as "no search".
 */
export function getSearchConfig<Value extends SelectKey>(
  search: boolean | SearchConfig<Value> | undefined
): SearchConfig<Value> | undefined {
  if (!search) return undefined;
  if (search === true) return {};
  return search;
}

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
      acc.push(opt);
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
  return items.reduce<SelectKey[]>((acc, cur) => {
    // If this is a section
    if ('options' in cur) {
      if (cur.disabled) {
        // If the entire section is disabled, then mark all of its children as disabled
        for (const opt of cur.options) {
          acc.push(opt.key);
        }
        return acc;
      }

      return acc.concat(getDisabledOptions(cur.options, isOptionDisabled));
    }

    // If this is an option
    if (isOptionDisabled?.(cur) ?? cur.disabled) {
      acc.push(cur.key);
      return acc;
    }
    return acc;
  }, []);
}

function defaultSearchMatcher<Value extends SelectKey>(
  option: SelectOptionWithKey<Value>,
  search: string
): SearchMatchResult {
  const text = option.textValue ?? (typeof option.label === 'string' ? option.label : '');
  if (!text) {
    return {score: 0};
  }
  const result = fzf(text, search.toLowerCase(), false);
  // fzf returns end=-1 when no subsequence match exists (score is also 0).
  // For valid matches fzf may return negative scores due to gap penalties, so we
  // cannot rely on score > 0 to detect a match. Use end !== -1 instead and clamp
  // the score so getHiddenOptions always sees score > 0 for any real match.
  if (result.end === -1) {
    return {score: 0};
  }
  return {score: Math.max(1, result.score)};
}

/**
 * Recursively finds the option(s) that don't match the designated search string or are
 * outside the list box's count limit. Also collects match scores for use in sorting.
 *
 * An option is considered a match when its score is greater than 0. The default matcher
 * uses fzf and always returns a positive score for any subsequence match, 0 when there
 * is no match. Custom matchers can return any positive score to influence sort order —
 * higher scores appear first.
 *
 * Returns both the set of hidden option keys and a map of key → score for matched
 * options.
 */
export function getHiddenOptions<Value extends SelectKey>(
  items: Array<SelectOptionOrSectionWithKey<Value>>,
  search: string,
  limit = Infinity,
  searchMatcher?: (
    option: SelectOptionWithKey<Value>,
    search: string
  ) => SearchMatchResult
): {hidden: Set<SelectKey>; scores: Map<SelectKey, number>} {
  const scores = new Map<SelectKey, number>();
  const matcher = searchMatcher ?? defaultSearchMatcher;

  //
  // First, filter options using `search` value
  //
  const filterOption = (opt: SelectOptionWithKey<Value>) => {
    // When there is no active search query, all options match. Do not call the
    // searchMatcher — a custom matcher may return score 0 for an empty query,
    // which would incorrectly hide all options.
    if (!search) {
      return true;
    }
    const result = matcher(opt, search);
    if (result.score > 0) {
      scores.set(opt.key, result.score);
      return true;
    }
    return false;
  };

  const hiddenOptionsSet = new Set<SelectKey>();
  const remainingItems = items
    .flatMap<SelectOptionOrSectionWithKey<Value> | null>(item => {
      if ('options' in item) {
        const filteredOptions = item.options
          .map(opt => {
            if (filterOption(opt)) {
              return opt;
            }

            hiddenOptionsSet.add(opt.key);
            return null;
          })
          .filter((opt): opt is SelectOptionWithKey<Value> => !!opt);

        return filteredOptions.length > 0 ? {...item, options: filteredOptions} : null;
      }

      if (filterOption(item)) {
        return item;
      }

      hiddenOptionsSet.add(item.key);
      return null;
    })
    .filter((item): item is SelectOptionOrSectionWithKey<Value> => !!item);

  //
  // Sort remaining items by score before applying the size limit, so that higher-scored
  // (more relevant) items are kept visible when the limit is reached.
  //
  const orderedRemainingItems =
    scores.size > 0 ? getSortedItems(remainingItems, scores) : remainingItems;

  //
  // Then, limit the number of remaining options to `limit`
  //
  let threshold = [Infinity, Infinity];
  let accumulator = 0;
  let currentIndex = 0;

  while (currentIndex < orderedRemainingItems.length) {
    const item = orderedRemainingItems[currentIndex]!;
    const delta = 'options' in item ? item.options.length : 1;

    if (accumulator + delta > limit) {
      threshold = [currentIndex, limit - accumulator];
      break;
    }

    accumulator += delta;
    currentIndex += 1;
  }

  for (let i = threshold[0]!; i < orderedRemainingItems.length; i++) {
    const item = orderedRemainingItems[i]!;
    if ('options' in item) {
      const startingIndex = i === threshold[0] ? threshold[1]! : 0;
      for (let j = startingIndex; j < item.options.length; j++) {
        hiddenOptionsSet.add(item.options[j]!.key);
      }
    } else {
      hiddenOptionsSet.add(item.key);
    }
  }

  return {hidden: hiddenOptionsSet, scores};
}

/**
 * Sorts items by their match scores (descending). Options with higher scores appear
 * first. Options without a score entry maintain their original relative order.
 *
 * For sectioned lists, options are sorted within each section. For flat lists, all
 * options are sorted globally.
 */
export function getSortedItems<Value extends SelectKey>(
  items: Array<SelectOptionOrSectionWithKey<Value>>,
  scores: Map<SelectKey, number>
): Array<SelectOptionOrSectionWithKey<Value>> {
  const hasSections = items.some(item => 'options' in item);

  if (hasSections) {
    return items.map(item => {
      if ('options' in item) {
        return {
          ...item,
          options: [...item.options].sort(
            (a, b) => (scores.get(b.key) ?? 0) - (scores.get(a.key) ?? 0)
          ),
        };
      }
      return item;
    });
  }

  return [...items].sort(
    (a, b) =>
      (scores.get((b as SelectOptionWithKey<Value>).key) ?? 0) -
      (scores.get((a as SelectOptionWithKey<Value>).key) ?? 0)
  );
}

/**
 * Toggles (select/unselect) all provided options. If none/some of the options are
 * selected, then this function selects all of them. If all of the options are selected,
 * then this function unselects all of them.
 */
function toggleOptions<Value extends SelectKey>(
  optionKeys: Value[],
  selectionManager: ListState<any>['selectionManager']
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
      priority="transparent"
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
      const visibleCounterpart = document
        .getElementById(listId)
        ?.querySelector(`button[aria-hidden][data-key="${item.key}"]`);

      if (!visibleCounterpart) {
        return;
      }
      visibleCounterpart.classList.add('focus-visible');
    },
    onBlur: () => {
      const visibleCounterpart = document
        .getElementById(listId)
        ?.querySelector(`button[aria-hidden][data-key="${item.key}"]`);

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
        {item.textValue || item.rendered}
      </button>
    </VisuallyHidden>
  );
}

export function itemIsSectionWithKey<T extends SelectKey>(
  item: SelectOptionOrSectionWithKey<T>
): item is SelectSectionWithKey<T> {
  return 'options' in item;
}

export function shouldCloseOnSelect({
  multiple,
  closeOnSelect,
  selectedOptions,
}: Pick<SelectProps<any>, 'multiple' | 'closeOnSelect'> & {
  selectedOptions: Array<SelectOption<any>>;
}) {
  if (typeof closeOnSelect === 'function') {
    // type assertions are necessary here because we don't have the discriminated union anymore
    return closeOnSelect((multiple ? selectedOptions : selectedOptions[0]) as never);
  }
  if (defined(closeOnSelect)) {
    return closeOnSelect;
  }
  // By default, single-selection lists close on select, while multiple-selection
  // lists stay open
  return !multiple;
}

export function getDuplicateOptionKeysInfo<Value extends SelectKey>(
  items: Array<SelectOptionOrSectionWithKey<Value>>
): {duplicateOptionKeys: string[]; hasSections: boolean; optionCount: number} {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let optionCount = 0;
  let hasSections = false;

  const collect = (list: Array<SelectOptionOrSectionWithKey<Value>>) => {
    for (const item of list) {
      if ('options' in item) {
        hasSections = true;
        collect(item.options);
        continue;
      }

      optionCount += 1;
      const key = String(item.key);
      if (duplicates.has(key)) continue;

      if (seen.has(key)) {
        duplicates.add(key);
      } else {
        seen.add(key);
      }
    }
  };

  collect(items);
  return {duplicateOptionKeys: [...duplicates], hasSections, optionCount};
}
