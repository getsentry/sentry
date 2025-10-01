import {useCallback} from 'react';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsFields,
  useQueryParamsSearch,
  useSetQueryParamsFields,
  useSetQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';

export function useLogAttributesTreeActions({embedded}: {embedded: boolean}) {
  const setLogsSearch = useSetQueryParamsSearch();
  const search = useQueryParamsSearch();
  const fields = useQueryParamsFields();
  const setLogFields = useSetQueryParamsFields();

  const addSearchFilter = useCallback(
    (content: AttributesTreeContent, negated?: boolean) => {
      const originalAttribute = content.originalAttribute;
      if (!originalAttribute) {
        return;
      }
      const newSearch = search.copy();
      newSearch.addFilterValue(
        `${negated ? '!' : ''}${originalAttribute.original_attribute_key}`,
        String(content.value)
      );
      setLogsSearch(newSearch);
    },
    [setLogsSearch, search]
  );

  const addColumn = useCallback(
    (content: AttributesTreeContent) => {
      const originalAttribute = content.originalAttribute;
      if (!originalAttribute) {
        return;
      }
      const newFields = [...fields];
      if (newFields[newFields.length - 1] === OurLogKnownFieldKey.TIMESTAMP) {
        newFields.splice(-1, 0, originalAttribute.original_attribute_key);
      } else {
        newFields.push(originalAttribute.original_attribute_key);
      }
      setLogFields(newFields);
    },
    [setLogFields, fields]
  );

  return (content: AttributesTreeContent) => {
    if (!content.originalAttribute) {
      return [];
    }

    const items: MenuItemProps[] = [
      {
        key: 'search-for-value',
        label: t('Search for this value'),
        onAction: () => addSearchFilter(content),
      },
      {
        key: 'search-for-negated-value',
        label: t('Exclude this value'),
        onAction: () => addSearchFilter(content, true),
      },
      {
        key: 'add-column',
        label: t('Add this as table column'),
        hidden: embedded,
        disabled: fields.includes(content.originalAttribute.original_attribute_key),
        onAction: () => addColumn(content),
      },
    ];

    return items;
  };
}
