import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {isMac} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {KeyboardEvent} from '@react-types/shared';

import Checkbox from 'sentry/components/checkbox';
import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {getItemsWithKeys} from 'sentry/components/compactSelect/utils';
import {
  ItemType,
  type SearchGroup,
  type SearchItem,
} from 'sentry/components/deprecatedSmartSearchBar/types';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {
  type CustomComboboxMenu,
  SearchQueryBuilderCombobox,
} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {parseMultiSelectFilterValue} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/string/parser';
import {replaceCommaSeparatedValue} from 'sentry/components/searchQueryBuilder/tokens/filter/replaceCommaSeparatedValue';
import SpecificDatePicker from 'sentry/components/searchQueryBuilder/tokens/filter/specificDatePicker';
import {
  escapeTagValue,
  formatFilterValue,
  getFilterValueType,
  unescapeTagValue,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {ValueListBox} from 'sentry/components/searchQueryBuilder/tokens/filter/valueListBox';
import {getDefaultAbsoluteDateValue} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/date';
import type {
  SuggestionItem,
  SuggestionSection,
  SuggestionSectionItem,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';
import {
  cleanFilterValue,
  getValueSuggestions,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/utils';
import {getDefaultFilterValue} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {
  isDateToken,
  recentSearchTypeToLabel,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniq} from 'sentry/utils/array/uniq';
import {type FieldDefinition, FieldValueType} from 'sentry/utils/fields';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import {keepPreviousData, type QueryKey, useQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOrganization from 'sentry/utils/useOrganization';

type SearchQueryValueBuilderProps = {
  onCommit: () => void;
  onDelete: () => void;
  token: TokenResult<Token.FILTER>;
  wrapperRef: React.RefObject<HTMLDivElement>;
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

function prepareInputValueForSaving(valueType: FieldValueType, inputValue: string) {
  const parsed = parseMultiSelectFilterValue(inputValue);

  if (!parsed) {
    return '""';
  }

  const values =
    parsed.items
      .map(item =>
        item.value?.quoted
          ? item.value?.text ?? ''
          : cleanFilterValue({valueType, value: item.value?.text ?? ''})
      )
      .filter(text => text?.length) ?? [];

  const uniqueValues = uniq(values);

  return uniqueValues.length > 1
    ? `[${uniqueValues.join(',')}]`
    : uniqueValues[0] ?? '""';
}

function getSelectedValuesFromText(
  text: string,
  {escaped = true}: {escaped?: boolean} = {}
) {
  const parsed = parseMultiSelectFilterValue(text);

  if (!parsed) {
    return [];
  }

  return parsed.items
    .filter(item => item.value?.value)
    .map(item => {
      return (
        (escaped ? item.value?.text : unescapeTagValue(item.value?.value ?? '')) ?? ''
      );
    });
}

function getValueAtCursorPosition(text: string, cursorPosition: number | null) {
  if (cursorPosition === null) {
    return '';
  }

  const items = text.split(',');

  let characterCount = 0;
  for (const item of items) {
    characterCount += item.length + 1;
    if (characterCount > cursorPosition) {
      return item.trim();
    }
  }

  return '';
}

function getSuggestionDescription(group: SearchGroup | SearchItem) {
  const description = group.desc ?? group.documentation;

  if (description !== group.value) {
    return description;
  }

  return undefined;
}

function getPredefinedValues({
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
  if (!key) {
    return null;
  }

  const definedValues = key.values ?? fieldDefinition?.values;
  const valueType = getFilterValueType(token, fieldDefinition);

  if (!definedValues?.length) {
    return getValueSuggestions({
      filterValue,
      token,
      valueType,
    });
  }

  if (isStringFilterValues(definedValues)) {
    return [{sectionText: '', suggestions: definedValues.map(value => ({value}))}];
  }

  const valuesWithoutSection = definedValues
    .filter(group => group.type === ItemType.TAG_VALUE && group.value)
    .map(group => ({
      value: group.value as string,
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
            value: child.value as string,
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

function tokenSupportsMultipleValues(
  token: TokenResult<Token.FILTER>,
  keys: TagCollection,
  fieldDefinition: FieldDefinition | null
): boolean {
  switch (token.filter) {
    case FilterType.TEXT: {
      // The search parser defaults to the text type, so we need to do further
      // checks to ensure that the filter actually supports multiple values
      const key = keys[getKeyName(token.key)];
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

// Filters support wildcards if they are string filters and it is not explicity disallowed
function keySupportsWildcard(fieldDefinition: FieldDefinition | null) {
  const isStringFilter =
    !fieldDefinition || fieldDefinition?.valueType === FieldValueType.STRING;

  return isStringFilter && fieldDefinition?.allowWildcard !== false;
}

function useSelectionIndex({
  inputRef,
  inputValue,
  canSelectMultipleValues,
}: {
  canSelectMultipleValues: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  inputValue: string;
}) {
  const [selectionIndex, setSelectionIndex] = useState<number | null>(
    () => inputValue.length
  );

  useEffect(() => {
    if (canSelectMultipleValues) {
      setSelectionIndex(inputValue.length);
    }
  }, [canSelectMultipleValues, inputValue]);

  const updateSelectionIndex = useCallback(() => {
    if (inputRef.current?.selectionStart !== inputRef.current?.selectionEnd) {
      setSelectionIndex(null);
    } else {
      setSelectionIndex(inputRef.current?.selectionStart ?? null);
    }
  }, [inputRef]);

  return {
    selectionIndex,
    updateSelectionIndex,
  };
}

function useFilterSuggestions({
  token,
  filterValue,
  selectedValues,
  ctrlKeyPressed,
}: {
  ctrlKeyPressed: boolean;
  filterValue: string;
  selectedValues: string[];
  token: TokenResult<Token.FILTER>;
}) {
  const keyName = getKeyName(token.key);
  const {getFieldDefinition, getTagValues, filterKeys} = useSearchQueryBuilder();
  const key: Tag | undefined = filterKeys[keyName];
  const fieldDefinition = getFieldDefinition(keyName);
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
  const shouldFetchValues = key && !key.predefined && predefinedValues === null;
  const canSelectMultipleValues = tokenSupportsMultipleValues(
    token,
    filterKeys,
    fieldDefinition
  );

  const queryKey = useMemo<QueryKey>(
    () => ['search-query-builder-tag-values', keyName, filterValue],
    [filterValue, keyName]
  );

  const debouncedQueryKey = useDebouncedValue(queryKey);

  // TODO(malwilley): Display error states
  const {data, isFetching} = useQuery<string[]>({
    queryKey: debouncedQueryKey,
    queryFn: () => getTagValues(key ? key : {key: keyName, name: keyName}, filterValue),
    placeholderData: keepPreviousData,
    enabled: shouldFetchValues,
  });

  const createItem = useCallback(
    (suggestion: SuggestionItem, selected = false) => {
      return {
        label: suggestion.label ?? suggestion.value,
        value: suggestion.value,
        details: suggestion.description,
        textValue: suggestion.value,
        hideCheck: true,
        selectionMode: canSelectMultipleValues ? 'multiple' : 'single',
        trailingItems: ({isFocused, disabled}: any) => {
          if (!canSelectMultipleValues) {
            return null;
          }

          return (
            <ItemCheckbox
              isFocused={isFocused}
              selected={selected}
              token={token}
              disabled={disabled}
              value={suggestion.value}
              ctrlKeyPressed={ctrlKeyPressed}
            />
          );
        },
      };
    },
    [canSelectMultipleValues, token, ctrlKeyPressed]
  );

  const suggestionGroups: SuggestionSection[] = useMemo(() => {
    return shouldFetchValues
      ? [{sectionText: '', suggestions: data?.map(value => ({value})) ?? []}]
      : predefinedValues ?? [];
  }, [data, predefinedValues, shouldFetchValues]);

  // Grouped sections for rendering purposes
  const suggestionSectionItems = useMemo<SuggestionSectionItem[]>(() => {
    const itemsWithoutSection = suggestionGroups
      .filter(group => group.sectionText === '')
      .flatMap(group => group.suggestions)
      .filter(suggestion => !selectedValues.includes(suggestion.value));
    const sections = suggestionGroups.filter(group => group.sectionText !== '');

    return [
      {
        sectionText: '',
        items: getItemsWithKeys([
          ...selectedValues.map(value => createItem({value}, true)),
          ...itemsWithoutSection.map(suggestion => createItem(suggestion)),
        ]),
      },
      ...sections.map(group => ({
        sectionText: group.sectionText,
        items: getItemsWithKeys(
          group.suggestions
            .filter(suggestion => !selectedValues.includes(suggestion.value))
            .map(suggestion => createItem(suggestion))
        ),
      })),
    ];
  }, [createItem, selectedValues, suggestionGroups]);

  // Flat list used for state management
  const items = useMemo(() => {
    return suggestionSectionItems.flatMap(section => section.items);
  }, [suggestionSectionItems]);

  return {
    items,
    suggestionSectionItems,
    isFetching,
  };
}

function ItemCheckbox({
  token,
  isFocused,
  selected,
  disabled,
  value,
  ctrlKeyPressed,
}: {
  ctrlKeyPressed: boolean;
  disabled: boolean;
  isFocused: boolean;
  selected: boolean;
  token: TokenResult<Token.FILTER>;
  value: string;
}) {
  const {dispatch} = useSearchQueryBuilder();

  return (
    <TrailingWrap
      onPointerUp={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <CheckWrap visible={isFocused || selected || ctrlKeyPressed} role="presentation">
        <Checkbox
          size="sm"
          checked={selected}
          disabled={disabled}
          onChange={() => {
            dispatch({
              type: 'TOGGLE_FILTER_VALUE',
              token,
              value: escapeTagValue(value),
            });
          }}
          aria-label={t('Toggle %s', value)}
          tabIndex={-1}
        />
      </CheckWrap>
    </TrailingWrap>
  );
}

function getInitialInputValue(
  token: TokenResult<Token.FILTER>,
  canSelectMultipleValues: boolean
) {
  if (isDateToken(token)) {
    return token.value.type === Token.VALUE_ISO_8601_DATE ? token.value.text : '';
  }
  if (canSelectMultipleValues) {
    return getMultiSelectInputValue(token);
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
  const organization = useOrganization();
  const {
    getFieldDefinition,
    filterKeys,
    dispatch,
    searchSource,
    recentSearches,
    disallowWildcard,
    wrapperRef: topLevelWrapperRef,
  } = useSearchQueryBuilder();
  const keyName = getKeyName(token.key);
  const fieldDefinition = getFieldDefinition(keyName);
  const canSelectMultipleValues = tokenSupportsMultipleValues(
    token,
    filterKeys,
    fieldDefinition
  );
  const canUseWildard = disallowWildcard ? false : keySupportsWildcard(fieldDefinition);
  const [inputValue, setInputValue] = useState(() =>
    getInitialInputValue(token, canSelectMultipleValues)
  );
  const {selectionIndex, updateSelectionIndex} = useSelectionIndex({
    inputRef,
    inputValue,
    canSelectMultipleValues,
  });

  const [showDatePicker, setShowDatePicker] = useState(() => {
    if (isDateToken(token)) {
      return token.value.type === Token.VALUE_ISO_8601_DATE;
    }
    return false;
  });

  const filterValue = canSelectMultipleValues
    ? getValueAtCursorPosition(inputValue, selectionIndex)
    : inputValue;

  const selectedValuesUnescaped = useMemo(
    () =>
      canSelectMultipleValues
        ? getSelectedValuesFromText(inputValue, {escaped: false})
        : [],
    [canSelectMultipleValues, inputValue]
  );

  const ctrlKeyPressed = useKeyPress(
    isMac() ? 'Meta' : 'Control',
    topLevelWrapperRef.current
  );

  useEffect(() => {
    if (canSelectMultipleValues) {
      setInputValue(getMultiSelectInputValue(token));
    }
    // We want to avoid resetting the input value if the token text doesn't actually change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSelectMultipleValues, token.text]);

  // On mount, scroll to the end of the input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.scrollWidth;
    }
  }, []);

  const {items, suggestionSectionItems, isFetching} = useFilterSuggestions({
    token,
    filterValue,
    selectedValues: selectedValuesUnescaped,
    ctrlKeyPressed,
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

  const updateFilterValue = useCallback(
    (value: string) => {
      const cleanedValue = cleanFilterValue({
        valueType: getFilterValueType(token, fieldDefinition),
        value,
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
        if (selectedValuesUnescaped.includes(value)) {
          const newValue = prepareInputValueForSaving(
            getFilterValueType(token, fieldDefinition),
            selectedValuesUnescaped
              .filter(v => v !== value)
              .map(escapeTagValue)
              .join(',')
          );

          dispatch({
            type: 'UPDATE_TOKEN_VALUE',
            token,
            value: newValue,
          });

          if (newValue && newValue !== '""' && !ctrlKeyPressed) {
            onCommit();
          }

          return true;
        }

        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token,
          value: prepareInputValueForSaving(
            getFilterValueType(token, fieldDefinition),
            replaceCommaSeparatedValue(inputValue, selectionIndex, escapeTagValue(value))
          ),
        });

        if (!ctrlKeyPressed) {
          onCommit();
        }
      } else {
        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token,
          value: cleanedValue,
        });
        onCommit();
      }

      return true;
    },
    [
      token,
      fieldDefinition,
      canSelectMultipleValues,
      analyticsData,
      selectedValuesUnescaped,
      dispatch,
      inputValue,
      selectionIndex,
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

      updateFilterValue(value);
      trackAnalytics('search.value_autocompleted', {
        ...analyticsData,
        filter_value: value,
      });
    },
    [analyticsData, token, updateFilterValue]
  );

  const handleInputValueConfirmed = useCallback(
    (value: string) => {
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

      if (canSelectMultipleValues) {
        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token,
          value: prepareInputValueForSaving(
            getFilterValueType(token, fieldDefinition),
            value
          ),
        });
        onCommit();
        if (!isUnchanged) {
          trackAnalytics('search.value_manual_submitted', {
            ...analyticsData,
            filter_value: value,
            invalid: false,
          });
        }
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
      canSelectMultipleValues,
      dispatch,
      fieldDefinition,
      onCommit,
      token,
      updateFilterValue,
    ]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Default combobox behavior stops events from propagating outside of input
      // Certain keys like ctrl+z should be handled handled in useQueryBuilderGrid()
      // so we need to continue propagation for those.
      if (e.key === 'z' && isCtrlKeyPressed(e)) {
        e.continuePropagation();
      }

      // If there's nothing in the input and we hit a delete key, we should focus the filter
      if ((e.key === 'Backspace' || e.key === 'Delete') && !inputRef.current?.value) {
        onDelete();
      }
    },
    [onDelete]
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

  const customMenu: CustomComboboxMenu<SelectOptionWithKey<string>> | undefined =
    useMemo(() => {
      if (!showDatePicker) {
        return function (props) {
          return (
            <ValueListBox
              {...props}
              isMultiSelect={canSelectMultipleValues}
              items={items}
              isLoading={isFetching}
              canUseWildcard={canUseWildard}
            />
          );
        };
      }

      return function (props) {
        return (
          <SpecificDatePicker
            {...props}
            dateString={inputValue || getDefaultAbsoluteDateValue(token)}
            handleSelectDateTime={newDateTimeValue => {
              setInputValue(newDateTimeValue);
              inputRef.current?.focus();
              trackAnalytics('search.value_autocompleted', {
                ...analyticsData,
                filter_value: newDateTimeValue,
                filter_value_type: 'absolute_date',
              });
            }}
            handleBack={() => {
              setShowDatePicker(false);
              setInputValue('');
              inputRef.current?.focus();
            }}
            handleSave={newDateTimeValue => {
              dispatch({
                type: 'UPDATE_TOKEN_VALUE',
                token,
                value: newDateTimeValue,
              });
              onCommit();
            }}
          />
        );
      };
    }, [
      showDatePicker,
      canSelectMultipleValues,
      items,
      isFetching,
      canUseWildard,
      inputValue,
      token,
      analyticsData,
      dispatch,
      onCommit,
    ]);

  return (
    <ValueEditing ref={ref} data-test-id="filter-value-editing">
      <SearchQueryBuilderCombobox
        ref={inputRef}
        items={items}
        onOptionSelected={handleOptionSelected}
        onCustomValueBlurred={handleInputValueConfirmed}
        onCustomValueCommitted={handleInputValueConfirmed}
        onExit={onCommit}
        inputValue={inputValue}
        filterValue={filterValue}
        placeholder={canSelectMultipleValues ? '' : formatFilterValue(token.value)}
        token={token}
        inputLabel={t('Edit filter value')}
        onInputChange={e => setInputValue(e.target.value)}
        onKeyDown={onKeyDown}
        onKeyUp={updateSelectionIndex}
        onClick={updateSelectionIndex}
        autoFocus
        maxOptions={50}
        openOnFocus
        customMenu={customMenu}
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
    </ValueEditing>
  );
}

const ValueEditing = styled('div')`
  display: flex;
  height: 100%;
  align-items: center;
  max-width: 400px;
`;

const TrailingWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${space(1)};
`;

const CheckWrap = styled('div')<{visible: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: ${p => (p.visible ? 1 : 0)};
  padding: ${space(0.25)} 0 ${space(0.25)} ${space(0.25)};
`;
