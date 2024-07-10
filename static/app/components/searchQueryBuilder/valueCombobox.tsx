import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';
import type {KeyboardEvent} from '@react-types/shared';

import Checkbox from 'sentry/components/checkbox';
import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {getItemsWithKeys} from 'sentry/components/compactSelect/utils';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/combobox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {parseFilterValueDate} from 'sentry/components/searchQueryBuilder/filterValueParser/date/parser';
import SpecificDatePicker from 'sentry/components/searchQueryBuilder/specificDatePicker';
import {
  escapeTagValue,
  formatFilterValue,
  isDateToken,
  unescapeTagValue,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {
  ItemType,
  type SearchGroup,
  type SearchItem,
} from 'sentry/components/smartSearchBar/types';
import {IconArrow} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types/group';
import {uniq} from 'sentry/utils/array/uniq';
import {FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import {type QueryKey, useQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

type SearchQueryValueBuilderProps = {
  onCommit: () => void;
  token: TokenResult<Token.FILTER>;
  wrapperRef: React.RefObject<HTMLDivElement>;
};

type SuggestionItem = {
  value: string;
  description?: ReactNode;
  label?: ReactNode;
};

type SuggestionSection = {
  sectionText: string;
  suggestions: SuggestionItem[];
};

type SuggestionSectionItem = {
  items: SelectOptionWithKey<string>[];
  sectionText: string;
};

const NUMERIC_REGEX = /^-?\d+(\.\d+)?$/;
const FILTER_VALUE_NUMERIC = /^-?\d+(\.\d+)?[kmb]?$/i;
const FILTER_VALUE_INT = /^-?\d+[kmb]?$/i;

const RELATIVE_DATE_INPUT_REGEX = /^(\d+)\s*([mhdw]?)/;

function isNumeric(value: string) {
  return NUMERIC_REGEX.test(value);
}

function isStringFilterValues(
  tagValues: string[] | SearchGroup[]
): tagValues is string[] {
  return typeof tagValues[0] === 'string';
}

const NUMERIC_UNITS = ['k', 'm', 'b'] as const;
const RELATIVE_DATE_UNITS = ['m', 'h', 'd', 'w'] as const;
const DURATION_UNITS = ['ms', 's', 'm', 'h', 'd', 'w'] as const;

const DEFAULT_NUMERIC_SUGGESTIONS: SuggestionSection[] = [
  {
    sectionText: '',
    suggestions: [{value: '100'}, {value: '100k'}, {value: '100m'}, {value: '100b'}],
  },
];

const DEFAULT_DURATION_SUGGESTIONS: SuggestionSection[] = [
  {
    sectionText: '',
    suggestions: [{value: '100'}, {value: '100k'}, {value: '100m'}, {value: '100b'}],
  },
];

const DEFAULT_BOOLEAN_SUGGESTIONS: SuggestionSection[] = [
  {
    sectionText: '',
    suggestions: [{value: 'true'}, {value: 'false'}],
  },
];

function getDefaultAbsoluteDateValue(token: TokenResult<Token.FILTER>) {
  if (token.value.type === Token.VALUE_ISO_8601_DATE) {
    return token.value.text;
  }

  return '';
}

function getMultiSelectInputValue(token: TokenResult<Token.FILTER>) {
  if (
    token.value.type !== Token.VALUE_TEXT_LIST &&
    token.value.type !== Token.VALUE_NUMBER_LIST
  ) {
    const value = token.value.value;
    return value ? value + ',' : '';
  }

  const items = token.value.items.map(item => item.value.value);

  if (items.length === 0) {
    return '';
  }

  return items.join(',') + ',';
}

function prepareInputValueForSaving(
  token: TokenResult<Token.FILTER>,
  inputValue: string
) {
  const values = uniq(
    inputValue
      .split(',')
      .map(v => cleanFilterValue(token.key.text, v.trim()))
      .filter(v => v.length > 0)
  );

  return values.length > 1 ? `[${values.join(',')}]` : values[0] ?? '""';
}

function getSelectedValuesFromText(text: string) {
  return text
    .split(',')
    .map(v => unescapeTagValue(v.trim()))
    .filter(v => v.length > 0);
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
/**
 * Replaces the focused filter value (at cursorPosition) with the new value.
 *
 * Example:
 * replaceValueAtPosition('foo,bar,baz', 5, 'new') => 'foo,new,baz'
 */
function replaceValueAtPosition(
  value: string,
  cursorPosition: number | null,
  replacement: string
) {
  const items = value.split(',');

  let characterCount = 0;
  for (let i = 0; i < items.length; i++) {
    characterCount += items[i].length + 1;
    if (characterCount > (cursorPosition ?? value.length + 1)) {
      const newItems = [...items.slice(0, i), replacement, ...items.slice(i + 1)];
      return newItems.map(item => item.trim()).join(',');
    }
  }

  return value;
}

function getRelativeDateSign(token: TokenResult<Token.FILTER>) {
  if (token.value.type === Token.VALUE_ISO_8601_DATE) {
    switch (token.operator) {
      case TermOperator.LESS_THAN:
      case TermOperator.LESS_THAN_EQUAL:
        return '+';
      default:
        return '-';
    }
  }

  if (token.value.type === Token.VALUE_RELATIVE_DATE) {
    return token.value.sign;
  }

  return '-';
}

function makeRelativeDateDescription(value: number, unit: string) {
  switch (unit) {
    case 's':
      return tn('%s second ago', '%s seconds ago', value);
    case 'm':
      return tn('%s minute ago', '%s minutes ago', value);
    case 'h':
      return tn('%s hour ago', '%s hours ago', value);
    case 'd':
      return tn('%s day ago', '%s days ago', value);
    case 'w':
      return tn('%s week ago', '%s weeks ago', value);
    default:
      return '';
  }
}

function makeDefaultDateSuggestions(
  token: TokenResult<Token.FILTER>
): SuggestionSection[] {
  const sign = getRelativeDateSign(token);

  return [
    {
      sectionText: '',
      suggestions: [
        {value: `${sign}1h`, label: makeRelativeDateDescription(1, 'h')},
        {value: `${sign}24h`, label: makeRelativeDateDescription(24, 'h')},
        {value: `${sign}7d`, label: makeRelativeDateDescription(7, 'd')},
        {value: `${sign}14d`, label: makeRelativeDateDescription(14, 'd')},
        {value: `${sign}30d`, label: makeRelativeDateDescription(30, 'd')},
        {
          value: 'absolute_date',
          label: (
            <AbsoluteDateOption>
              {t('Absolute date')}
              <IconArrow direction="right" size="xs" />
            </AbsoluteDateOption>
          ),
        },
      ],
    },
  ];
}

function getNumericSuggestions(inputValue: string): SuggestionSection[] {
  if (!inputValue) {
    return DEFAULT_NUMERIC_SUGGESTIONS;
  }

  if (isNumeric(inputValue)) {
    return [
      {
        sectionText: '',
        suggestions: NUMERIC_UNITS.map(unit => ({
          value: `${inputValue}${unit}`,
        })),
      },
    ];
  }

  // If the value is not numeric, don't show any suggestions
  return [];
}

function getDurationSuggestions(inputValue: string): SuggestionSection[] {
  if (!inputValue) {
    return DEFAULT_DURATION_SUGGESTIONS;
  }

  if (isNumeric(inputValue)) {
    return [
      {
        sectionText: '',
        suggestions: DURATION_UNITS.map(unit => ({
          value: `${inputValue}${unit}`,
        })),
      },
    ];
  }

  // If the value is not numeric, don't show any suggestions
  return [];
}

function getRelativeDateSuggestions(
  inputValue: string,
  token: TokenResult<Token.FILTER>
): SuggestionSection[] {
  const match = inputValue.match(RELATIVE_DATE_INPUT_REGEX);

  if (!match) {
    return makeDefaultDateSuggestions(token);
  }

  const [, value] = match;
  const intValue = parseInt(value, 10);

  if (isNaN(intValue)) {
    return makeDefaultDateSuggestions(token);
  }

  const sign = token.value.type === Token.VALUE_RELATIVE_DATE ? token.value.sign : '-';

  return [
    {
      sectionText: '',
      suggestions: RELATIVE_DATE_UNITS.map(unit => {
        return {
          value: `${sign}${intValue}${unit}`,
          label: makeRelativeDateDescription(intValue, unit),
        };
      }),
    },
  ];
}

function getSuggestionDescription(group: SearchGroup | SearchItem) {
  const description = group.desc ?? group.documentation;

  if (description !== group.value) {
    return description;
  }

  return undefined;
}

function getPredefinedValues({
  key,
  filterValue,
  token,
}: {
  filterValue: string;
  token: TokenResult<Token.FILTER>;
  key?: Tag;
}): SuggestionSection[] {
  if (!key) {
    return [];
  }

  const fieldDef = getFieldDefinition(key.key);

  if (!key.values?.length) {
    switch (fieldDef?.valueType) {
      case FieldValueType.NUMBER:
        return getNumericSuggestions(filterValue);
      case FieldValueType.DURATION:
        return getDurationSuggestions(filterValue);
      case FieldValueType.BOOLEAN:
        return DEFAULT_BOOLEAN_SUGGESTIONS;
      // TODO(malwilley): Better date suggestions
      case FieldValueType.DATE:
        return getRelativeDateSuggestions(filterValue, token);
      default:
        return [];
    }
  }

  if (isStringFilterValues(key.values)) {
    return [{sectionText: '', suggestions: key.values.map(value => ({value}))}];
  }

  const valuesWithoutSection = key.values
    .filter(group => group.type === ItemType.TAG_VALUE && group.value)
    .map(group => ({
      value: group.value as string,
      description: getSuggestionDescription(group),
    }));
  const sections = key.values
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
  keys: TagCollection
): boolean {
  switch (token.filter) {
    case FilterType.TEXT:
      // The search parser defaults to the text type, so we need to do further
      // checks to ensure that the filter actually supports multiple values
      const key = keys[token.key.text];
      if (!key) {
        return true;
      }

      const fieldDef = getFieldDefinition(key.key);

      return [
        FieldValueType.STRING,
        FieldValueType.NUMBER,
        FieldValueType.INTEGER,
      ].includes(fieldDef?.valueType ?? FieldValueType.STRING);
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

function cleanFilterValue(key: string, value: string): string {
  const fieldDef = getFieldDefinition(key);
  if (!fieldDef) {
    return escapeTagValue(value);
  }

  switch (fieldDef.valueType) {
    case FieldValueType.NUMBER:
      if (FILTER_VALUE_NUMERIC.test(value)) {
        return value;
      }
      return '';
    case FieldValueType.INTEGER:
      if (FILTER_VALUE_INT.test(value)) {
        return value;
      }
      return '';
    case FieldValueType.DATE:
      const parsed = parseFilterValueDate(value);

      if (!parsed) {
        return '';
      }
      return value;
    default:
      return escapeTagValue(value).trim();
  }
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
}: {
  filterValue: string;
  selectedValues: string[];
  token: TokenResult<Token.FILTER>;
}) {
  const {getTagValues, filterKeys} = useSearchQueryBuilder();
  const key = filterKeys[token.key.text];
  const predefinedValues = useMemo(
    () => getPredefinedValues({key, filterValue, token}),
    [key, filterValue, token]
  );
  const shouldFetchValues = key && !key.predefined && !predefinedValues.length;
  const canSelectMultipleValues = tokenSupportsMultipleValues(token, filterKeys);

  const queryKey = useMemo<QueryKey>(
    () => ['search-query-builder-tag-values', token.key.text, filterValue],
    [filterValue, token.key]
  );

  const debouncedQueryKey = useDebouncedValue(queryKey);

  // TODO(malwilley): Display error states
  const {data, isFetching} = useQuery<string[]>({
    queryKey: debouncedQueryKey,
    queryFn: () => getTagValues(key, filterValue),
    keepPreviousData: true,
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
        trailingItems: ({isFocused, disabled}) => {
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
            />
          );
        },
      };
    },
    [canSelectMultipleValues, token]
  );

  const suggestionGroups: SuggestionSection[] = useMemo(() => {
    return shouldFetchValues
      ? [{sectionText: '', suggestions: data?.map(value => ({value})) ?? []}]
      : predefinedValues;
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
}: {
  disabled: boolean;
  isFocused: boolean;
  selected: boolean;
  token: TokenResult<Token.FILTER>;
  value: string;
}) {
  const {dispatch} = useSearchQueryBuilder();

  return (
    <TrailingWrap onPointerUp={e => e.stopPropagation()}>
      <CheckWrap visible={isFocused || selected} role="presentation">
        <Checkbox
          size="sm"
          checked={selected}
          disabled={disabled}
          onChange={() => {
            dispatch({
              type: 'TOGGLE_FILTER_VALUE',
              token: token,
              value: escapeTagValue(value),
            });
          }}
          aria-label={t('Select %s', value)}
          tabIndex={-1}
        />
      </CheckWrap>
    </TrailingWrap>
  );
}

export function SearchQueryBuilderValueCombobox({
  token,
  onCommit,
  wrapperRef,
}: SearchQueryValueBuilderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {filterKeys, dispatch} = useSearchQueryBuilder();
  const canSelectMultipleValues = tokenSupportsMultipleValues(token, filterKeys);
  const [inputValue, setInputValue] = useState(() => {
    if (isDateToken(token)) {
      return token.value.type === Token.VALUE_ISO_8601_DATE ? token.value.text : '';
    }
    if (canSelectMultipleValues) {
      return getMultiSelectInputValue(token);
    }
    return '';
  });
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

  const selectedValues = useMemo(
    () => (canSelectMultipleValues ? getSelectedValuesFromText(inputValue) : []),
    [canSelectMultipleValues, inputValue]
  );

  useEffect(() => {
    if (canSelectMultipleValues) {
      setInputValue(getMultiSelectInputValue(token));
    }
  }, [canSelectMultipleValues, token]);

  // On mount, scroll to the end of the input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.scrollWidth;
    }
  }, []);

  const {items, suggestionSectionItems, isFetching} = useFilterSuggestions({
    token,
    filterValue,
    selectedValues,
  });

  const handleOptionSelected = useCallback(
    (value: string) => {
      if (isDateToken(token) && value === 'absolute_date') {
        setShowDatePicker(true);
        setInputValue('');
        return;
      }

      const cleanedValue = cleanFilterValue(token.key.text, value);

      // TODO(malwilley): Add visual feedback for invalid values
      if (!cleanedValue) {
        return;
      }

      if (canSelectMultipleValues) {
        if (selectedValues.includes(value)) {
          const newValue = prepareInputValueForSaving(
            token,
            selectedValues.filter(v => v !== value).join(',')
          );
          dispatch({
            type: 'UPDATE_TOKEN_VALUE',
            token: token,
            value: newValue,
          });

          if (newValue && newValue !== '""') {
            onCommit();
          }

          return;
        }

        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token: token,
          value: prepareInputValueForSaving(
            token,
            replaceValueAtPosition(inputValue, selectionIndex, value)
          ),
        });
        onCommit();
      } else {
        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token: token,
          value: cleanedValue,
        });
        onCommit();
      }
    },
    [
      canSelectMultipleValues,
      dispatch,
      inputValue,
      onCommit,
      selectedValues,
      selectionIndex,
      token,
    ]
  );

  const handleInputValueConfirmed = useCallback(
    (value: string) => {
      if (canSelectMultipleValues) {
        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token,
          value: prepareInputValueForSaving(token, value),
        });
        onCommit();
      } else {
        handleOptionSelected(value);
      }
    },
    [canSelectMultipleValues, dispatch, handleOptionSelected, onCommit, token]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Default combobox behavior stops events from propagating outside of input
      // Certain keys like ctrl+z should be handled handled in useQueryBuilderGrid()
      // so we need to continue propagation for those.
      if (e.key === 'z' && isCtrlKeyPressed(e)) {
        e.continuePropagation();
      }

      // If at the start of the input and backspace is pressed, delete the last selected value
      if (
        e.key === 'Backspace' &&
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === 0 &&
        canSelectMultipleValues
      ) {
        dispatch({type: 'DELETE_LAST_MULTI_SELECT_FILTER_VALUE', token});
      }
    },
    [canSelectMultipleValues, dispatch, token]
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

  const customMenu = useMemo(() => {
    if (!showDatePicker) return undefined;

    return function ({popoverRef, isOpen}) {
      return (
        <SpecificDatePicker
          popoverRef={popoverRef}
          dateString={inputValue || getDefaultAbsoluteDateValue(token)}
          handleSelectDateTime={newDateTimeValue => {
            setInputValue(newDateTimeValue);
            inputRef.current?.focus();
          }}
          handleBack={() => {
            setShowDatePicker(false);
            setInputValue('');
            inputRef.current?.focus();
          }}
          handleSave={newDateTimeValue => {
            dispatch({
              type: 'UPDATE_TOKEN_VALUE',
              token: token,
              value: newDateTimeValue,
            });
            onCommit();
          }}
          isOpen={isOpen}
        />
      );
    };
  }, [dispatch, inputValue, onCommit, showDatePicker, token]);

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
        isLoading={isFetching}
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

const AbsoluteDateOption = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;

  svg {
    color: ${p => p.theme.gray300};
  }
`;
