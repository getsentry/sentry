import {useCallback, useMemo, useState} from 'react';
import {Item, Section} from '@react-stately/collections';

import {getItemsWithKeys} from 'sentry/components/compactSelect/utils';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/combobox';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {
  escapeTagValue,
  formatFilterValue,
} from 'sentry/components/searchQueryBuilder/utils';
import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';
import type {SearchGroup} from 'sentry/components/smartSearchBar/types';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types';
import {FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import {type QueryKey, useQuery} from 'sentry/utils/queryClient';

type SearchQueryValueBuilderProps = {
  onChange: () => void;
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

export function SearchQueryBuilderValueCombobox({
  token,
  onChange,
}: SearchQueryValueBuilderProps) {
  const [inputValue, setInputValue] = useState('');

  const {getTagValues, keys, dispatch} = useSearchQueryBuilder();
  const key = keys[token.key.text];
  const shouldFetchValues = key && !key.predefined;

  // TODO(malwilley): Display error states
  const {data} = useQuery<string[]>({
    queryKey: ['search-query-builder', token.key, inputValue] as QueryKey,
    queryFn: () => getTagValues(key, inputValue),
    keepPreviousData: true,
    enabled: shouldFetchValues,
  });

  const items = useMemo(() => {
    const values = (shouldFetchValues ? data : getPredefinedValues({key})) ?? [];

    return getItemsWithKeys(
      values.map(value => {
        return {
          label: value,
          value: value,
          textValue: value,
          hideCheck: true,
        };
      })
    );
  }, [data, key, shouldFetchValues]);

  const handleSelectValue = useCallback(
    (value: string) => {
      dispatch({
        type: 'UPDATE_TOKEN_VALUE',
        token: token.value,
        value: escapeTagValue(value),
      });
      onChange();
    },
    [dispatch, onChange, token.value]
  );

  return (
    // TODO(malwilley): Support for multiple values
    <SearchQueryBuilderCombobox
      items={items}
      onOptionSelected={handleSelectValue}
      onCustomValueSelected={handleSelectValue}
      inputValue={inputValue}
      placeholder={formatFilterValue(token)}
      token={token}
      inputLabel={t('Edit filter value')}
      onInputChange={e => setInputValue(e.target.value)}
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
  );
}
