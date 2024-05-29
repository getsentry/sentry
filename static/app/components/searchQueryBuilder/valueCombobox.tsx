import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';
import orderBy from 'lodash/orderBy';

import Checkbox from 'sentry/components/checkbox';
import {getItemsWithKeys} from 'sentry/components/compactSelect/utils';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/combobox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {
  escapeTagValue,
  formatFilterValue,
  unescapeTagValue,
} from 'sentry/components/searchQueryBuilder/utils';
import {Token, type TokenResult} from 'sentry/components/searchSyntax/parser';
import type {SearchGroup} from 'sentry/components/smartSearchBar/types';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types';
import {FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import {type QueryKey, useQuery} from 'sentry/utils/queryClient';

type SearchQueryValueBuilderProps = {
  onCommit: () => void;
  token: TokenResult<Token.FILTER>;
};

function isStringFilterValues(
  tagValues: string[] | SearchGroup[]
): tagValues is string[] {
  return typeof tagValues[0] === 'string';
}

function getPredefinedValues({key}: {key?: Tag}): string[] {
  if (!key) {
    return [];
  }

  const fieldDef = getFieldDefinition(key.key);

  if (key.values && isStringFilterValues(key.values)) {
    return key.values;
  }

  // TODO(malwilley): Add support for grouped values

  switch (fieldDef?.valueType) {
    // TODO(malwilley): Better duration suggestions
    case FieldValueType.DURATION:
      return ['-1d', '-7d', '+14d'];
    case FieldValueType.BOOLEAN:
      return ['true', 'false'];
    // TODO(malwilley): Better date suggestions
    case FieldValueType.DATE:
      return ['-1h', '-24h', '-7d', '-14d', '-30d'];
    default:
      return [];
  }
}

function keySupportsMultipleValues(key?: Tag): boolean {
  if (!key) {
    return true;
  }

  const fieldDef = getFieldDefinition(key.key);

  switch (fieldDef?.valueType) {
    case FieldValueType.STRING:
    case FieldValueType.NUMBER:
    case FieldValueType.INTEGER:
      return true;
    default:
      return false;
  }
}

function getOtherSelectedValues(token: TokenResult<Token.FILTER>): string[] {
  switch (token.value.type) {
    case Token.VALUE_TEXT:
      if (!token.value.value) {
        return [];
      }
      return [unescapeTagValue(token.value.value)];
    case Token.VALUE_NUMBER_LIST:
      return token.value.items.map(item => item.value?.text ?? '');
    case Token.VALUE_TEXT_LIST:
      return token.value.items.map(item => unescapeTagValue(item.value?.value ?? ''));
    default:
      return [];
  }
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
}: SearchQueryValueBuilderProps) {
  const [inputValue, setInputValue] = useState('');

  const {getTagValues, keys, dispatch} = useSearchQueryBuilder();
  const key = keys[token.key.text];
  const shouldFetchValues = key && !key.predefined;
  const canSelectMultipleValues = keySupportsMultipleValues(key);
  const selectedValues = useMemo(
    () =>
      canSelectMultipleValues
        ? orderBy(getOtherSelectedValues(token), 'value', 'asc')
        : [],
    [canSelectMultipleValues, token]
  );

  // TODO(malwilley): Display error states
  const {data} = useQuery<string[]>({
    queryKey: ['search-query-builder', token.key, inputValue] as QueryKey,
    queryFn: () => getTagValues(key, inputValue),
    keepPreviousData: true,
    enabled: shouldFetchValues,
  });

  const createItem = useCallback(
    (value: string, selected = false) => {
      return {
        label: value,
        value: value,
        textValue: value,
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
              value={value}
            />
          );
        },
      };
    },
    [canSelectMultipleValues, token]
  );

  const items = useMemo(() => {
    const values = (shouldFetchValues ? data : getPredefinedValues({key})) ?? [];

    return getItemsWithKeys([
      ...selectedValues.map(value => createItem(value, true)),
      ...values
        .filter(value => !selectedValues.includes(value))
        .map(value => createItem(value)),
    ]);
  }, [createItem, data, key, selectedValues, shouldFetchValues]);

  const handleSelectValue = useCallback(
    (value: string) => {
      if (canSelectMultipleValues) {
        dispatch({
          type: 'TOGGLE_FILTER_VALUE',
          token: token,
          value: escapeTagValue(value),
        });

        // If toggling off a value, keep focus inside the value
        if (!selectedValues.includes(value)) {
          onCommit();
        }
      } else {
        dispatch({
          type: 'UPDATE_TOKEN_VALUE',
          token: token.value,
          value: escapeTagValue(value),
        });
        onCommit();
      }
    },
    [canSelectMultipleValues, dispatch, onCommit, selectedValues, token]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // If at the start of the input and backspace is pressed, delete the last selected value
      if (
        e.key === 'Backspace' &&
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === 0
      ) {
        dispatch({type: 'DELETE_LAST_MULTI_SELECT_FILTER_VALUE', token});
      }
    },
    [dispatch, token]
  );

  return (
    <ValueEditing>
      {selectedValues.map(value => (
        <span key={value}>{value},</span>
      ))}
      <SearchQueryBuilderCombobox
        items={items}
        onOptionSelected={handleSelectValue}
        onCustomValueSelected={handleSelectValue}
        inputValue={inputValue}
        placeholder={canSelectMultipleValues ? '' : formatFilterValue(token)}
        token={token}
        inputLabel={t('Edit filter value')}
        onInputChange={e => setInputValue(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
      >
        <Section>
          {items.map(item => (
            <Item {...item} key={item.key}>
              {item.label}
            </Item>
          ))}
        </Section>
      </SearchQueryBuilderCombobox>
    </ValueEditing>
  );
}

const ValueEditing = styled('div')`
  display: flex;
  height: 100%;
  align-items: center;
  gap: ${space(0.25)};
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
