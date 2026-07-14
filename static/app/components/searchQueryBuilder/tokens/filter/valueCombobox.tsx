import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {isMac} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {KeyboardEvent} from '@react-types/shared';
import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {Checkbox} from '@sentry/scraps/checkbox';
import {HighlightText, type SelectOptionWithKey} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DeviceName} from 'sentry/components/deviceName';
import {
  ItemType,
  type SearchGroup,
  type SearchItem,
} from 'sentry/components/searchBar/types';
import {ASK_SEER_CONSENT_ITEM_KEY} from 'sentry/components/searchQueryBuilder/askSeer/askSeerConsentOption';
import {ASK_SEER_ITEM_KEY} from 'sentry/components/searchQueryBuilder/askSeer/askSeerOption';
import {
  useSearchQueryBuilderConfig,
  useSearchQueryBuilderLayout,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import {getMultiSelectValueState} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {
  SearchQueryBuilderCombobox,
  type CustomComboboxMenu,
  type CustomComboboxMenuProps,
} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {parseMultiSelectFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/string/parser';
import {SpecificDatePicker} from 'sentry/components/searchQueryBuilder/tokens/filter/specificDatePicker';
import {useFrozenSuggestionSectionItems} from 'sentry/components/searchQueryBuilder/tokens/filter/useFrozenSuggestionSectionItems';
import {
  escapeTagValueForSearch,
  formatFilterValue,
  getFilterValueType,
  unescapeAsteriskSearchValue,
  unescapeTagValue,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {
  useValueComboboxContext,
  useValueComboboxMenuContext,
  ValueComboboxContext,
  ValueComboboxMenuContext,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueComboboxContext';
import {ValueListBox} from 'sentry/components/searchQueryBuilder/tokens/filter/valueListBox';
import {getDefaultAbsoluteDateValue} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/date';
import {shouldUseDefaultNumericSuggestions} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/numeric';
import {SeverityValueIndicator} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/severity/severityValueIndicator';
import {isSeverityFilterKey} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/severity/utils';
import type {
  SuggestionItem,
  SuggestionSection,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';
import {
  cleanFilterValue,
  getValueSuggestions,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/utils';
import {
  getDefaultFilterValue,
  resolveFilterKey,
} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {
  isDateToken,
  isNumericFilterToken,
  recentSearchTypeToLabel,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Tag, TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniq} from 'sentry/utils/array/uniq';
import {
  FieldKey,
  FieldValueType,
  prettifyTagKey,
  type FieldDefinition,
} from 'sentry/utils/fields';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import {fzf} from 'sentry/utils/search/fzf';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useKeyPress} from 'sentry/utils/useKeyPress';
import {useOrganization} from 'sentry/utils/useOrganization';
type SearchQueryValueBuilderProps = {
  onCommit: () => void;
  onDelete: () => void;
  token: TokenResult<Token.FILTER>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
};

function isStringFilterValues(
  tagValues: string[] | SearchGroup[]
): tagValues is string[] {
  return typeof tagValues[0] === 'string';
}

function getMultiSelectInputValue(token: TokenResult<Token.FILTER>) {
  // Even if this is a multi-select filter, it won't be parsed as such if only a single value is provided
  if (
    token.value.type !== Token.VALUE_TEXT_LIST &&
    token.value.type !== Token.VALUE_NUMBER_LIST
  ) {
    if (!token.value.value) {
      return '';
    }

    return token.value.text + ',';
  }

  const items = token.value.items.map(item => item.value?.text ?? '');

  if (items.length === 0) {
    return '';
  }

  return items.join(',') + ',';
}

// Inserts an edited chip back at its original position, or appends it when not
// editing (or when the index no longer fits the committed values).
function insertMultiSelectValue(texts: string[], value: string, index?: number) {
  if (index === undefined || index < 0 || index >= texts.length) {
    return [...texts, value];
  }
  const next = [...texts];
  next.splice(index, 0, value);
  return next;
}

// Splits `text` on commas that aren't inside quotes (a comma inside `"a,b"` is
// part of the value, not a delimiter). The final segment is whatever is still
// being typed; earlier segments are completed values (possibly empty, e.g. from
// consecutive commas — callers drop those).
function splitUnquotedCommas(text: string) {
  const segments: string[] = [];
  let start = 0;
  let insideQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\\') {
      i++;
      continue;
    }
    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }
    if (char === ',' && !insideQuotes) {
      segments.push(text.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(text.slice(start));
  return segments;
}

export function prepareInputValueForSaving(
  valueType: FieldValueType,
  inputValue: string
) {
  const parsed = parseMultiSelectFilterValue(inputValue);

  if (!parsed) {
    return '""';
  }

  const values =
    parsed.items
      .map(item =>
        item.value?.quoted
          ? (item.value?.text ?? '')
          : cleanFilterValue({valueType, value: item.value?.text ?? ''})
      )
      .filter(text => text?.length) ?? [];

  const uniqueValues = uniq(values);

  return uniqueValues.length > 1
    ? `[${uniqueValues.join(',')}]`
    : (uniqueValues[0] ?? '""');
}

export function getSelectedValuesFromText(text: string) {
  const parsed = parseMultiSelectFilterValue(text);

  if (!parsed) {
    return [];
  }

  return parsed.items
    .filter(item => item.value?.value)
    .map(item => {
      const valueText = item.value?.text ?? '';
      const value = unescapeAsteriskSearchValue(
        unescapeTagValue(item.value?.value ?? '')
      );

      // Check if this value is selected by looking at the character after the value in
      // the text. If there's a comma after the value, it means this value is selected.
      // We need to check the text content to ensure that we account for any quotes the
      // user may have added.
      const selected = text.charAt(text.indexOf(valueText) + valueText.length) === ',';

      return {value, text: valueText, selected};
    });
}

function getSuggestionDescription(group: SearchGroup | SearchItem) {
  const description = group.desc ?? group.documentation;

  if (description !== group.value) {
    return description;
  }

  return;
}

export function getPredefinedValues({
  fieldDefinition,
  key,
  filterValue,
  token,
}: {
  fieldDefinition: FieldDefinition | null;
  filterValue: string;
  token: TokenResult<Token.FILTER>;
  key?: Tag;
}): SuggestionSection[] | null {
  if (!key && !fieldDefinition) {
    return null;
  }

  const keyValues = Array.isArray(key?.values) ? key.values : undefined;
  const definedValues = keyValues ?? fieldDefinition?.values;
  const valueType = getFilterValueType(token, fieldDefinition);

  if (!definedValues?.length) {
    return getValueSuggestions({
      filterValue,
      token,
      valueType,
    });
  }

  if (isStringFilterValues(definedValues)) {
    return [
      {
        sectionText: '',
        suggestions: definedValues.map(value => ({
          label: token.filter === FilterType.HAS ? prettifyTagKey(value) : undefined,
          value,
        })),
      },
    ];
  }

  const valuesWithoutSection = definedValues
    .filter(group => group.type === ItemType.TAG_VALUE && group.value)
    .map(group => ({
      value: group.value!,
      description: getSuggestionDescription(group),
    }));
  const sections = definedValues
    .filter(group => group.type === 'header')
    .map(group => {
      return {
        sectionText: group.title,
        suggestions: group.children
          .filter(child => child.value)
          .map(child => ({
            value: child.value!,
            description: getSuggestionDescription(child),
          })),
      };
    });

  return [
    ...(valuesWithoutSection.length > 0
      ? [{sectionText: '', suggestions: valuesWithoutSection}]
      : []),
    ...sections,
  ];
}

export function tokenSupportsMultipleValues(
  token: TokenResult<Token.FILTER>,
  keys: TagCollection,
  fieldDefinition: FieldDefinition | null
): boolean {
  if (fieldDefinition?.allowMultipleValues === false) {
    return false;
  }

  switch (token.filter) {
    case FilterType.TEXT: {
      // The search parser defaults to the text type, so we need to do further
      // checks to ensure that the filter actually supports multiple values
      const keyName = getKeyName(token.key);
      const key = Object.hasOwn(keys, keyName) ? keys[keyName] : undefined;
      if (!key) {
        return true;
      }

      const valueType = getFilterValueType(token, fieldDefinition);
      return valueType === FieldValueType.STRING;
    }
    case FilterType.NUMERIC:
      if (token.operator === TermOperator.DEFAULT) {
        return true;
      }
      return false;
    case FilterType.TEXT_IN:
    case FilterType.NUMERIC_IN:
      return true;
    default:
      return false;
  }
}

// Filters support wildcards if they are string filters and it is not explicitly disallowed
function keySupportsWildcard(
  fieldDefinition: FieldDefinition | null,
  valueType: FieldValueType
) {
  return valueType === FieldValueType.STRING && fieldDefinition?.allowWildcard !== false;
}

function sortSuggestionsByFzf(
  suggestions: SuggestionItem[],
  filterValue: string
): SuggestionItem[] {
  const query = filterValue.trim().toLowerCase();
  if (!query) {
    return suggestions;
  }

  return suggestions
    .map((suggestion, index) => {
      const text =
        typeof suggestion.label === 'string' ? suggestion.label : suggestion.value;
      const result = fzf(text, query, false);
      return {
        suggestion,
        score: result.end === -1 ? 0 : Math.max(1, result.score),
        index,
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({suggestion}) => suggestion);
}

function useFilterSuggestions({
  token,
  filterValue,
  selectedValues,
}: {
  filterValue: string;
  selectedValues: Array<{selected: boolean; value: string}>;
  token: TokenResult<Token.FILTER>;
}) {
  const keyName = getKeyName(token.key);
  const {
    filterKeyRegistryQueryKey,
    filterKeys,
    getFieldDefinition,
    getTagKeys,
    getTagValues,
  } = useSearchQueryBuilderConfig();
  const key = Object.hasOwn(filterKeys, keyName) ? filterKeys[keyName] : undefined;
  const fieldDefinition = getFieldDefinition(keyName);
  const valueType = getFilterValueType(token, fieldDefinition);
  const predefinedValues = useMemo(
    () =>
      getPredefinedValues({
        key,
        filterValue,
        token,
        fieldDefinition,
      }),
    [key, filterValue, token, fieldDefinition]
  );
  // Only keys that explicitly have predefined values should skip the fetch.
  // This is because the way keys are fetched doesn't guarantee that we have
  // every key loaded. So we should try to fetch values for it even if it
  // doesn't exist in the list of available keys.
  const shouldFetchTagKeys = token.filter === FilterType.HAS && !!getTagKeys;
  const shouldFetchValues =
    !shouldFetchTagKeys && predefinedValues === null && (key ? !key.predefined : true);
  const shouldUseDefaultSuggestionOrder = shouldUseDefaultNumericSuggestions(
    filterValue,
    valueType
  );
  const canSelectMultipleValues = tokenSupportsMultipleValues(
    token,
    filterKeys,
    fieldDefinition
  );

  const queryParams = useMemo(
    () =>
      [
        key
          ? {key: key.key, name: key.name, kind: key.kind}
          : {key: keyName, name: keyName, kind: undefined},
        filterValue,
      ] as const,
    [filterValue, key, keyName]
  );

  const baseQueryKey = useMemo(
    () => ['search-query-builder-tag-values', queryParams] as const,
    [queryParams]
  );
  const queryKey = useDebouncedValue(baseQueryKey);
  const isDebouncing = baseQueryKey !== queryKey;

  const tagKeysBaseQueryKey = useMemo(
    () =>
      ['search-query-builder-tag-keys', filterKeyRegistryQueryKey, filterValue] as const,
    [filterKeyRegistryQueryKey, filterValue]
  );
  const tagKeysQueryKey = useDebouncedValue(tagKeysBaseQueryKey);
  const isDebouncingTagKeys = tagKeysBaseQueryKey !== tagKeysQueryKey;

  // TODO(malwilley): Display error states
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const {data, isFetching} = useQuery({
    queryKey,
    queryFn: ctx =>
      getTagValues({tag: ctx.queryKey[1][0], searchQuery: ctx.queryKey[1][1]}),
    placeholderData: keepPreviousData,
    enabled: shouldFetchValues,
  });

  // TODO(malwilley): Display error states
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const {data: asyncKeys, isFetching: isFetchingTagKeys} = useQuery({
    queryKey: tagKeysQueryKey,
    queryFn: ctx => {
      const searchQuery = ctx.queryKey[2];
      return getTagKeys?.(typeof searchQuery === 'string' ? searchQuery : '') ?? [];
    },
    placeholderData: keepPreviousData,
    enabled: shouldFetchTagKeys,
  });

  const createItem = useCallback(
    (suggestion: SuggestionItem) => {
      const label = suggestion.label ?? suggestion.value;

      return {
        label:
          typeof label === 'string' && valueType === FieldValueType.STRING ? (
            <HighlightText text={label} query={filterValue} />
          ) : (
            label
          ),
        value: suggestion.value,
        tag: suggestion.tag,
        details: suggestion.description,
        textValue: typeof label === 'string' ? label : suggestion.value,
        hideCheck: true,
        leadingItems: isSeverityFilterKey(keyName) ? (
          <SeverityValueIndicator value={suggestion.value} />
        ) : undefined,
        selectionMode: canSelectMultipleValues ? 'multiple' : 'single',
        trailingItems: ({disabled}: any) => {
          const count =
            suggestion.count === undefined ? null : (
              <ValueCount>{formatAbbreviatedNumber(suggestion.count)}</ValueCount>
            );

          if (!canSelectMultipleValues) {
            return count;
          }

          return (
            <Fragment>
              {count}
              <ItemCheckbox disabled={disabled} value={suggestion.value} />
            </Fragment>
          );
        },
      };
    },
    [canSelectMultipleValues, filterValue, keyName, valueType]
  );

  const suggestionGroups = useMemo(() => {
    let groups: SuggestionSection[];
    if (shouldFetchTagKeys) {
      const suggestions =
        asyncKeys?.map(tag => ({
          label: prettifyTagKey(tag.key),
          value: tag.key,
          tag,
        })) ?? [];
      groups = [{sectionText: '', suggestions}];
    } else if (shouldFetchValues) {
      const suggestions = data?.map(item => {
        const value = typeof item === 'string' ? item : item.value;
        const count = typeof item === 'string' ? undefined : item.count;
        return {
          value,
          count,
          description:
            // When the key is device, we can help users by displaying the readable name
            key?.key === FieldKey.DEVICE ? (
              <DeviceName value={value}>
                {/* Prevent the same value from being displayed twice */}
                {name => (name === value ? null : name)}
              </DeviceName>
            ) : undefined,
        };
      });

      groups = [{sectionText: '', suggestions: suggestions ?? []}];
    } else {
      groups = predefinedValues ?? [];
    }

    return groups.map(group => ({
      ...group,
      suggestions: shouldUseDefaultSuggestionOrder
        ? group.suggestions
        : sortSuggestionsByFzf(group.suggestions, filterValue),
    }));
  }, [
    data,
    asyncKeys,
    predefinedValues,
    shouldFetchTagKeys,
    shouldFetchValues,
    key?.key,
    filterValue,
    shouldUseDefaultSuggestionOrder,
  ]);

  const suggestionSectionItems = useFrozenSuggestionSectionItems({
    createItem,
    selectedValues,
    suggestionGroups,
  });

  // Flat list used for state management
  const items = useMemo(() => {
    return suggestionSectionItems.flatMap(section => section.items);
  }, [suggestionSectionItems]);

  return {
    items,
    suggestionSectionItems,
    isFetching: isFetching || isDebouncing || isFetchingTagKeys || isDebouncingTagKeys,
  };
}

function ItemCheckbox({disabled, value}: {disabled: boolean; value: string}) {
  const {analyticsData, selectedValueMap, token} = useValueComboboxContext();
  const {dispatch} = useSearchQueryBuilderState();
  const selected = selectedValueMap.get(value) ?? false;

  return (
    <TrailingWrap
      onPointerUp={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <CheckWrap role="presentation">
        <Checkbox
          size="sm"
          checked={selected}
          disabled={disabled}
          onChange={() => {
            const escapedValue = escapeTagValueForSearch(value);

            dispatch({
              type: 'TOGGLE_FILTER_VALUE',
              token,
              value: escapedValue,
            });

            const {selected: currentlySelected, selectedCount} = getMultiSelectValueState(
              token,
              escapedValue
            );

            trackAnalytics('search.multi_value_selected', {
              ...analyticsData,
              selected: !currentlySelected,
              selected_count: currentlySelected ? selectedCount - 1 : selectedCount + 1,
            });
          }}
          aria-label={t('Toggle %s', value)}
          tabIndex={-1}
        />
      </CheckWrap>
    </TrailingWrap>
  );
}

function ValueComboboxCustomMenu(
  props: CustomComboboxMenuProps<SelectOptionWithKey<string>>
) {
  const {
    canSelectMultipleValues,
    canUseWildcard,
    inputValue,
    isFetching,
    items,
    onBackFromAbsoluteDate,
    onSaveAbsoluteDate,
    onSelectAbsoluteDate,
    showDatePicker,
    token,
    wrapperRef,
  } = useValueComboboxMenuContext();

  if (showDatePicker) {
    return (
      <SpecificDatePicker
        {...props}
        dateString={inputValue || getDefaultAbsoluteDateValue(token)}
        handleSelectDateTime={onSelectAbsoluteDate}
        handleBack={onBackFromAbsoluteDate}
        handleSave={onSaveAbsoluteDate}
      />
    );
  }

  // Remove Ask Seer items from the value list box since they are not shown here.
  const hiddenOptions = new Set(props.hiddenOptions);
  hiddenOptions.delete(ASK_SEER_ITEM_KEY);
  hiddenOptions.delete(ASK_SEER_CONSENT_ITEM_KEY);

  return (
    <ValueListBox
      {...props}
      portalTarget={
        canSelectMultipleValues
          ? (props.portalTarget ?? wrapperRef.current)
          : props.portalTarget
      }
      hiddenOptions={hiddenOptions}
      wrapperRef={wrapperRef}
      isMultiSelect={canSelectMultipleValues}
      items={items}
      isLoading={isFetching}
      canUseWildcard={canUseWildcard}
      token={token}
    />
  );
}

export function getInitialInputValue(
  token: TokenResult<Token.FILTER>,
  canSelectMultipleValues: boolean
) {
  if (isDateToken(token)) {
    return token.value.type === Token.VALUE_ISO_8601_DATE ? token.value.text : '';
  }
  if (canSelectMultipleValues) {
    return getMultiSelectInputValue(token);
  }
  if (isNumericFilterToken(token)) {
    return token.value.text;
  }
  return '';
}

export function SearchQueryBuilderValueCombobox({
  token,
  onDelete,
  onCommit,
  wrapperRef,
}: SearchQueryValueBuilderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Caret position to apply after the next controlled value update (used to keep
  // the caret at the split boundary when a comma splits the input). Tagged with
  // the value it belongs to so a change that never renders (setInputValue to the
  // same value) can't leave it to misfire on a later, unrelated update.
  const pendingCaretRef = useRef<{pos: number; value: string} | null>(null);
  const organization = useOrganization();
  const {dispatch} = useSearchQueryBuilderState();
  const {
    getFieldDefinition,
    getSuggestedFilterKey,
    filterKeys,
    searchSource,
    recentSearches,
    disallowWildcard,
  } = useSearchQueryBuilderConfig();
  const {wrapperRef: topLevelWrapperRef} = useSearchQueryBuilderLayout();
  const keyName = getKeyName(token.key);
  const fieldDefinition = getFieldDefinition(keyName);
  const canSelectMultipleValues = tokenSupportsMultipleValues(
    token,
    filterKeys,
    fieldDefinition
  );
  const valueType = getFilterValueType(token, fieldDefinition);
  const canUseWildcard = disallowWildcard
    ? false
    : keySupportsWildcard(fieldDefinition, valueType);
  // Multi-select renders committed values as chips, so the input starts empty
  // and only holds the value being typed.
  const [inputValue, setInputValue] = useState(() =>
    canSelectMultipleValues ? '' : getInitialInputValue(token, canSelectMultipleValues)
  );
  // Tracks where the input sits within the chip row. `value` is the lifted chip's
  // text (so it can be restored on Escape and reinserted where it was rather than
  // at the end), or null for a bare insertion point — a mid-row position the input
  // keeps after a comma split so the remaining text isn't shoved to the end. A bare
  // point instead carries `after`, the value it sits behind, so it can re-anchor
  // when the token shifts underneath it.
  const [editingChip, setEditingChip] = useState<{
    index: number;
    value: string | null;
    after?: string;
  } | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(() => {
    if (isDateToken(token)) {
      return token.value.type === Token.VALUE_ISO_8601_DATE;
    }
    return false;
  });

  const filterValue = unescapeAsteriskSearchValue(inputValue);

  const selectedValues = useMemo(
    () =>
      canSelectMultipleValues
        ? getSelectedValuesFromText(getMultiSelectInputValue(token))
        : [],
    [canSelectMultipleValues, token]
  );

  // A chip being edited is lifted into the input but left in the token until the
  // edit is committed, so it is hidden from the rendered chips and excluded when
  // rebuilding the value. Canceling simply clears the edit and it reappears.
  // Excluding by index (not value) keeps duplicate values distinct.
  const committedValues = useMemo(
    () =>
      selectedValues
        .map((v, index) => ({...v, index}))
        // Only a lifted chip (value !== null) is hidden; a bare insertion point
        // leaves every committed chip visible.
        .filter(
          v =>
            !(editingChip && editingChip.value !== null && v.index === editingChip.index)
        ),
    [selectedValues, editingChip]
  );

  // Keep an in-progress edit anchored to the token as it changes underneath the
  // input (dropdown checkbox toggles, undo, etc. shift indices without going
  // through removeValue). A lifted chip tracks its own value; a bare insertion
  // point tracks the value it sits behind.
  useEffect(() => {
    if (editingChip === null) {
      return;
    }
    const oldIndex = editingChip.index;
    // A value can appear more than once, so re-anchor to the occurrence nearest
    // the previous index — an external change shifts the edited position by a
    // small offset rather than moving it to the first match.
    const nearestOccurrence = (needle: string, target: number) => {
      let nearest = -1;
      selectedValues.forEach((v, i) => {
        if (v.value !== needle) {
          return;
        }
        if (nearest === -1 || Math.abs(i - target) < Math.abs(nearest - target)) {
          nearest = i;
        }
      });
      return nearest;
    };

    const liftedValue = editingChip.value;
    if (liftedValue !== null) {
      // Re-point the lifted chip to its value's current slot so a commit updates
      // the right chip; cancel the edit if the value is gone so stale input isn't
      // re-added on blur.
      if (selectedValues[oldIndex]?.value === liftedValue) {
        return;
      }
      const newIndex = nearestOccurrence(liftedValue, oldIndex);
      if (newIndex === -1) {
        setEditingChip(null);
        setInputValue('');
      } else {
        setEditingChip(prev => (prev ? {...prev, index: newIndex} : prev));
      }
      return;
    }

    // A bare insertion point has no value of its own, so keep it just past the
    // value it sits behind. Without this, toggling an earlier value off (or an
    // undo) leaves the raw index stale and the trailing partial commits at the
    // end of the row instead of staying adjacent.
    const {after} = editingChip;
    if (after === undefined) {
      return;
    }
    const anchorIndex = nearestOccurrence(after, oldIndex - 1);
    const newIndex =
      anchorIndex === -1 ? Math.min(oldIndex, selectedValues.length) : anchorIndex + 1;
    if (newIndex !== oldIndex) {
      setEditingChip(prev => (prev ? {...prev, index: newIndex} : prev));
    }
  }, [editingChip, selectedValues]);

  const ctrlKeyPressed = useKeyPress(
    isMac() ? 'Meta' : 'Control',
    topLevelWrapperRef.current
  );
  const selectedValueMap = useMemo(
    () => new Map(selectedValues.map(v => [v.value, v.selected] as const)),
    [selectedValues]
  );

  // Keep the active input in view within the horizontally-scrolling chip row.
  const scrollInputIntoView = useCallback(() => {
    const input = inputRef.current;
    const container = ref.current;
    if (!input) {
      return;
    }
    // Show the tail (and caret) of a long value inside the input itself.
    input.scrollLeft = input.scrollWidth;
    if (!container) {
      return;
    }
    // Scroll the row just enough to bring the input into view wherever it sits —
    // at the end when adding a value, or in a chip's slot when editing one — so
    // a long neighbouring chip can't keep it off-screen.
    const containerRect = container.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    if (inputRect.right > containerRect.right) {
      container.scrollLeft += inputRect.right - containerRect.right;
    } else if (inputRect.left < containerRect.left) {
      container.scrollLeft -= containerRect.left - inputRect.left;
    }
  }, []);

  // Re-run as the value changes (typing, or lifting a chip into the input).
  useEffect(() => {
    scrollInputIntoView();
    const pendingCaret = pendingCaretRef.current;
    if (pendingCaret === null) {
      return;
    }
    pendingCaretRef.current = null;
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (input.value !== pendingCaret.value) {
      return;
    }
    input.setSelectionRange(pendingCaret.pos, pendingCaret.pos);
    // scrollInputIntoView pins the tail of a long value into view, but a caret
    // just placed at the start (after a mid-value comma split) has to win, or
    // the remaining text keeps scrolling off-screen as the user types.
    if (pendingCaret.pos === 0) {
      input.scrollLeft = 0;
    }
  }, [inputValue, scrollInputIntoView]);

  // While typing, surface the typed text as a custom option so results rank by
  // relevance; committed chips are pinned to the top only at rest. Checkbox
  // checked-state comes from `selectedValueMap`, not this list.
  const suggestionSelectedValues = useMemo(
    () =>
      canSelectMultipleValues && filterValue
        ? [{value: filterValue, selected: false}]
        : selectedValues,
    [canSelectMultipleValues, filterValue, selectedValues]
  );

  const {items, suggestionSectionItems, isFetching} = useFilterSuggestions({
    token,
    filterValue,
    selectedValues: suggestionSelectedValues,
  });

  const analyticsData = useMemo(
    () => ({
      organization,
      search_type: recentSearchTypeToLabel(recentSearches),
      search_source: searchSource,
      filter_key: keyName,
      filter_operator: token.operator,
      filter_value_type: getFilterValueType(token, fieldDefinition),
      new_experience: true,
    }),
    [organization, recentSearches, searchSource, keyName, token, fieldDefinition]
  );

  const valueComboboxContextValue = useMemo(
    () => ({token, selectedValueMap, analyticsData}),
    [token, selectedValueMap, analyticsData]
  );

  const handleSelectAbsoluteDate = useCallback(
    (newDateTimeValue: string) => {
      setInputValue(newDateTimeValue);
      inputRef.current?.focus();
      trackAnalytics('search.value_autocompleted', {
        ...analyticsData,
        filter_value: newDateTimeValue,
        filter_value_type: 'absolute_date',
      });
    },
    [analyticsData]
  );

  const handleBackFromAbsoluteDate = useCallback(() => {
    setShowDatePicker(false);
    setInputValue('');
    inputRef.current?.focus();
  }, []);

  const handleSaveAbsoluteDate = useCallback(
    (newDateTimeValue: string) => {
      dispatch({
        type: 'UPDATE_TOKEN_VALUE',
        token,
        value: newDateTimeValue,
      });
      onCommit();
    },
    [dispatch, onCommit, token]
  );

  const menuContextValue = useMemo(
    () => ({
      canSelectMultipleValues,
      canUseWildcard,
      inputValue,
      isFetching,
      items,
      onBackFromAbsoluteDate: handleBackFromAbsoluteDate,
      onSaveAbsoluteDate: handleSaveAbsoluteDate,
      onSelectAbsoluteDate: handleSelectAbsoluteDate,
      showDatePicker,
      token,
      wrapperRef: topLevelWrapperRef,
    }),
    [
      canSelectMultipleValues,
      canUseWildcard,
      inputValue,
      isFetching,
      items,
      handleBackFromAbsoluteDate,
      handleSaveAbsoluteDate,
      handleSelectAbsoluteDate,
      showDatePicker,
      token,
      topLevelWrapperRef,
    ]
  );

  const updateFilterValue = useCallback(
    (
      value: string,
      op?: TermOperator,
      {escapeSearchValue = false}: {escapeSearchValue?: boolean} = {}
    ) => {
      if (token.filter === FilterType.HAS) {
        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token,
          value: resolveFilterKey({
            key: value,
            filterKeys,
            getSuggestedFilterKey,
            loadedItems: items,
          }),
        });
        onCommit();
        return true;
      }

      const valueForSaving =
        escapeSearchValue && valueType === FieldValueType.STRING
          ? escapeTagValueForSearch(value)
          : value;

      const cleanedValue = cleanFilterValue({
        valueType,
        value: valueForSaving,
        token,
      });

      // TODO(malwilley): Add visual feedback for invalid values
      if (cleanedValue === null) {
        trackAnalytics('search.value_manual_submitted', {
          ...analyticsData,
          filter_value: value,
          invalid: true,
        });
        return false;
      }

      if (canSelectMultipleValues) {
        // UPDATE_TOKEN_VALUE (rather than TOGGLE_FILTER_VALUE) so the operator
        // switch (e.g. contains -> is) can ride along via `op`.
        //
        // Clicking an already-selected value toggles it off — but only when not
        // mid-edit. While editing, selecting a value commits the lifted chip to
        // it; if it matches another chip they merge (deduped on save) rather
        // than that other chip being toggled off.
        const deselecting =
          editingChip === null && committedValues.some(v => v.value === value);
        const newCommaSeparatedValue = deselecting
          ? committedValues
              .filter(v => v.value !== value)
              .map(v => v.text)
              .join(',')
          : insertMultiSelectValue(
              committedValues.map(v => v.text),
              valueForSaving,
              editingChip?.index
            ).join(',');

        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token,
          value: prepareInputValueForSaving(
            getFilterValueType(token, fieldDefinition),
            newCommaSeparatedValue
          ),
          op,
        });
        setInputValue('');
        setEditingChip(null);

        if (!ctrlKeyPressed) {
          onCommit();
        }
      } else {
        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token,
          value: cleanedValue,
          op,
        });
        onCommit();
      }

      return true;
    },
    [
      token,
      fieldDefinition,
      valueType,
      getSuggestedFilterKey,
      filterKeys,
      items,
      canSelectMultipleValues,
      analyticsData,
      committedValues,
      editingChip,
      dispatch,
      ctrlKeyPressed,
      onCommit,
    ]
  );

  const handleOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      const value = option.value;

      if (isDateToken(token)) {
        if (value === 'absolute_date') {
          setShowDatePicker(true);
          setInputValue('');
          return;
        }

        updateFilterValue(value);
        trackAnalytics('search.value_autocompleted', {
          ...analyticsData,
          filter_value: value,
          filter_value_type: 'relative_date',
        });
        return;
      }

      // When selecting from dropdown with no existing value, switch from "contains" to "is"
      let newOp: TermOperator | undefined;
      if (
        token.operator === TermOperator.CONTAINS &&
        token.value.type === Token.VALUE_TEXT &&
        !token.value.value
      ) {
        newOp = token.negated ? TermOperator.NOT_EQUAL : TermOperator.DEFAULT;
      }

      updateFilterValue(value, newOp, {escapeSearchValue: true});
      trackAnalytics('search.value_autocompleted', {
        ...analyticsData,
        filter_value: value,
      });
    },
    [analyticsData, token, updateFilterValue]
  );

  const addTypedValue = useCallback(
    (rawValue: string) => {
      const value = rawValue.trim();
      if (!value) {
        return;
      }
      // The raw input is left unescaped: prepareInputValueForSaving splits on
      // unquoted commas and quotes any value containing spaces/special chars, so
      // both pasted multi-values (`foo,bar`) and edited chips lifted in their
      // unescaped form (`foo bar`) round-trip correctly without escaping here.
      dispatch({
        type: 'UPDATE_TOKEN_VALUE',
        token,
        value: prepareInputValueForSaving(
          getFilterValueType(token, fieldDefinition),
          insertMultiSelectValue(
            committedValues.map(v => v.text),
            value,
            editingChip?.index
          ).join(',')
        ),
      });
      setInputValue('');
      setEditingChip(null);
    },
    [committedValues, dispatch, editingChip, fieldDefinition, token]
  );

  // Splitting on unquoted commas happens on input change (rather than on the
  // comma keypress) so it also covers a comma typed in the middle of a value and
  // a pasted multi-value string. Completed (non-empty) segments commit as chips —
  // empty ones are dropped so consecutive commas don't create blank chips — and
  // the trailing partial stays in the input. While editing, an insertion point
  // keeps the input where the edit was so the remaining text isn't shoved to the
  // end of the row.
  const handleMultiSelectInputChange = (value: string) => {
    const segments = splitUnquotedCommas(value);
    if (segments.length === 1) {
      setInputValue(value);
      return;
    }
    const partial = segments.pop() ?? '';
    // Canonicalize each completed segment the way committed values are stored
    // (parsed + unescaped), so a duplicate of an existing chip — even one that is
    // quoted or contains special characters — is recognized and dropped rather
    // than counted. Empty segments (consecutive commas) parse to nothing and drop
    // out here too. All of these collapse away on save via uniq, so counting them
    // would push the tracked insertion index (and the trailing partial) past
    // where the chips actually land.
    const seen = new Set(committedValues.map(v => v.value));
    const completed: string[] = [];
    let lastCanonical: string | undefined;
    for (const segment of segments) {
      const canonical = getSelectedValuesFromText(`${segment},`)[0]?.value;
      if (canonical === undefined || seen.has(canonical)) {
        continue;
      }
      seen.add(canonical);
      completed.push(segment);
      lastCanonical = canonical;
    }
    const editIndex = editingChip?.index;
    if (completed.length) {
      addTypedValue(completed.join(','));
      if (editIndex !== undefined) {
        // The partial now sits just after the last value committed above; anchor
        // the bare insertion point to that value (canonical, to match the token)
        // so it survives later index shifts.
        setEditingChip({
          index: editIndex + completed.length,
          value: null,
          after: lastCanonical,
        });
      }
    }
    pendingCaretRef.current = {pos: 0, value: partial};
    setInputValue(partial);
  };

  const handleInputValueConfirmed = useCallback(
    (value: string) => {
      if (canSelectMultipleValues) {
        if (value.trim()) {
          addTypedValue(value);
          trackAnalytics('search.value_manual_submitted', {
            ...analyticsData,
            filter_value: value,
            invalid: false,
          });
        } else {
          setEditingChip(null);
        }
        onCommit();
        return;
      }

      const isUnchanged = value === getInitialInputValue(token, canSelectMultipleValues);

      // If there's no user input and the token has no value, set a default one
      if (!value && !token.value.text) {
        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token,
          value: getDefaultFilterValue({fieldDefinition}),
        });
        onCommit();
        return;
      }

      if (isUnchanged) {
        onCommit();
        return;
      }

      const invalid = updateFilterValue(value);
      trackAnalytics('search.value_manual_submitted', {
        ...analyticsData,
        filter_value: value,
        invalid,
      });
    },
    [
      analyticsData,
      addTypedValue,
      canSelectMultipleValues,
      dispatch,
      fieldDefinition,
      onCommit,
      token,
      updateFilterValue,
    ]
  );

  const removeValue = useCallback(
    (index: number) => {
      const next = selectedValues
        .filter((_, i) => i !== index)
        .map(v => v.text)
        .join(',');
      dispatch({
        type: 'UPDATE_TOKEN_VALUE',
        token,
        value: prepareInputValueForSaving(
          getFilterValueType(token, fieldDefinition),
          next
        ),
      });
      // Removing a chip before the lifted one shifts its position down, so keep
      // editingChip.index aligned with the rebuilt token. Otherwise committedValues
      // hides the wrong chip and the commit reinserts at a stale index, dropping
      // remaining values. A bare insertion point re-anchors via its `after` value
      // in the effect above, so leave it untouched here to avoid a double shift.
      setEditingChip(prev =>
        prev && prev.value !== null && index < prev.index
          ? {...prev, index: prev.index - 1}
          : prev
      );
      inputRef.current?.focus();
    },
    [dispatch, fieldDefinition, selectedValues, token]
  );

  const editValue = (index: number) => {
    const target = selectedValues[index];
    if (!target) {
      return;
    }

    if (inputValue.trim()) {
      addTypedValue(inputValue);
    }

    setInputValue(target.value);
    setEditingChip({index, value: target.value});
    inputRef.current?.focus();
  };

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Default combobox behavior stops events from propagating outside of input
      // Certain keys like ctrl+z should be handled handled in useQueryBuilderGrid()
      // so we need to continue propagation for those.
      if (e.key === 'z' && isCtrlKeyPressed(e)) {
        e.continuePropagation();
      }

      const currentValue = inputRef.current?.value ?? '';

      if ((e.key === 'Backspace' || e.key === 'Delete') && !currentValue) {
        // Mid-edit (or at an insertion point) with an emptied input: don't remove
        // an unrelated chip.
        if (canSelectMultipleValues && editingChip !== null) {
          return;
        }
        const lastValue = committedValues.at(-1);
        if (canSelectMultipleValues && lastValue) {
          removeValue(lastValue.index);
          return;
        }
        onDelete();
      }
    },
    [canSelectMultipleValues, committedValues, editingChip, onDelete, removeValue]
  );

  // Ensure that the menu stays open when clicking on the selected items
  const shouldCloseOnInteractOutside = useCallback(
    (el: Element) => {
      if (wrapperRef.current?.contains(el)) {
        return false;
      }
      return true;
    },
    [wrapperRef]
  );

  // The combobox re-runs ariaHideOutside when the custom menu identity changes.
  // Only recreate it when switching between the listbox and the date picker.
  const customMenu = useMemo<CustomComboboxMenu<SelectOptionWithKey<string>>>(() => {
    const menuMode = showDatePicker ? 'date-picker' : 'list-box';
    return function (props) {
      return <ValueComboboxCustomMenu key={menuMode} {...props} />;
    };
  }, [showDatePicker]);

  const placeholder =
    token.filter === FilterType.HAS
      ? prettifyTagKey(token.value.text)
      : canSelectMultipleValues
        ? ''
        : valueType === FieldValueType.CURRENCY
          ? '$0.00'
          : formatFilterValue({
              token: token.value,
              valueType,
            });

  const chips = committedValues.map(({value, index}) => (
    <ValueChip key={`${index}-${value}`}>
      <Tooltip title={value} showOnlyOnOverflow skipWrapper>
        <ValueChipLabel
          type="button"
          aria-label={t('Edit value: %s', value)}
          onClick={() => editValue(index)}
        >
          {value}
        </ValueChipLabel>
      </Tooltip>
      <ValueChipRemove
        type="button"
        aria-label={t('Remove value: %s', value)}
        onClick={() => removeValue(index)}
      >
        <IconClose legacySize="8px" />
      </ValueChipRemove>
    </ValueChip>
  ));

  const valueInput = (
    <ValueInputContainer key="value-input">
      <SearchQueryBuilderCombobox
        ref={inputRef}
        items={items}
        onOptionSelected={handleOptionSelected}
        onCustomValueBlurred={handleInputValueConfirmed}
        onCustomValueCommitted={handleInputValueConfirmed}
        onExit={() => {
          setEditingChip(null);
          setInputValue('');
          onCommit();
        }}
        inputValue={inputValue}
        filterValue={filterValue}
        placeholder={placeholder}
        token={token}
        inputLabel={t('Edit filter value')}
        keepVisibleRef={ref}
        onFocus={scrollInputIntoView}
        onInputChange={e =>
          canSelectMultipleValues
            ? handleMultiSelectInputChange(e.target.value)
            : setInputValue(e.target.value)
        }
        onKeyDown={onKeyDown}
        autoFocus
        maxOptions={50}
        openOnFocus
        customMenu={customMenu}
        shouldFilterResults={!shouldUseDefaultNumericSuggestions(filterValue, valueType)}
        shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
      >
        {suggestionSectionItems.map(section => (
          <Section key={section.sectionText} title={section.sectionText}>
            {section.items.map(item => (
              <Item {...item} key={item.key}>
                {item.label}
              </Item>
            ))}
          </Section>
        ))}
      </SearchQueryBuilderCombobox>
    </ValueInputContainer>
  );

  // Render the input where the edited chip was, so the value stays in place
  // instead of jumping to the end of the row. committedValues keep their
  // ascending index order, so the slot is the count of chips before the edited
  // index; with no edit in progress the input stays at the end. The input keeps
  // a stable key so React repositions the same node (preserving focus and the
  // open popover) rather than remounting it.
  const inputSlot = editingChip
    ? committedValues.filter(v => v.index < editingChip.index).length
    : chips.length;
  const chipRow = [...chips.slice(0, inputSlot), valueInput, ...chips.slice(inputSlot)];

  return (
    <ValueComboboxContext.Provider value={valueComboboxContextValue}>
      <ValueComboboxMenuContext.Provider value={menuContextValue}>
        <ValueEditingChips
          align="center"
          gap="2xs"
          minWidth="0"
          height="100%"
          ref={ref}
          data-test-id="filter-value-editing"
        >
          {chipRow}
        </ValueEditingChips>
      </ValueComboboxMenuContext.Provider>
    </ValueComboboxContext.Provider>
  );
}

const ValueEditingChips = styled(Flex)`
  max-width: 100%;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

// Wraps the single combobox input. It sizes to its content while editing a chip
// in place (so it doesn't push later chips around), but grows to fill the
// trailing space when it sits at the end of the row (the add-a-value state). The
// base min-width keeps a mid-row insertion point visible and clickable even when
// its input is momentarily empty (e.g. right after a comma split).
const ValueInputContainer = styled('div')`
  display: flex;
  width: auto;
  min-width: ${p => p.theme.space.lg};
  flex: 0 0 auto;

  &:last-child {
    flex: 1 1 0%;
  }
`;

const ValueChip = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space['2xs']};
  border-radius: ${p => p.theme.radius['2xs']};
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
  color: ${p => p.theme.tokens.content.accent};
  padding: 0 ${p => p.theme.space['2xs']};
  white-space: nowrap;
`;

const chipButton = (p: {theme: Theme}) => css`
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  outline: none;

  &:focus-visible {
    border-radius: ${p.theme.radius['2xs']};
    box-shadow: 0 0 0 1px ${p.theme.tokens.focus.default};
  }
`;

const ValueChipLabel = styled('button')`
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
  font: inherit;
  ${chipButton}
`;

const ValueChipRemove = styled('button')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  ${chipButton}
`;

const TrailingWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const ValueCount = styled('span')`
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.tokens.content.secondary};
`;

const CheckWrap = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: ${p => p.theme.space['2xs']};
  padding-right: 0;
  padding-bottom: ${p => p.theme.space['2xs']};
  padding-left: ${p => p.theme.space['2xs']};
`;
