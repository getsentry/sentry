import {useCallback} from 'react';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {extractBaseKey} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useLogsSidebar} from 'sentry/views/explore/logs/logsSidebarContext';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useSetQueryParamsFields,
  useSetQueryParamsGroupBys,
  useSetQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {getTypedTagKey} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

function containsAttributeKey(keys: readonly string[], key: string): boolean {
  const baseKey = extractBaseKey(key);
  return keys.some(existingKey => extractBaseKey(existingKey) === baseKey);
}

export function useLogAttributesTreeActions({embedded}: {embedded: boolean}) {
  const setLogsSearch = useSetQueryParamsSearch();
  const search = useQueryParamsSearch();
  const fields = useQueryParamsFields();
  const setLogFields = useSetQueryParamsFields();
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();
  const sidebar = useLogsSidebar();

  const addSearchFilter = useCallback(
    (content: AttributesTreeContent, negated?: boolean) => {
      const originalAttribute = content.originalAttribute;
      if (!originalAttribute) {
        return;
      }
      const newSearch = search.copy();
      const key = getTypedTagKey(
        originalAttribute.original_attribute_key,
        originalAttribute.type,
        'log'
      );
      newSearch.addFilterValue(`${negated ? '!' : ''}${key}`, String(content.value));
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
      const typedKey = getTypedTagKey(
        originalAttribute.original_attribute_key,
        originalAttribute.type,
        'log'
      );
      if (containsAttributeKey(fields, typedKey)) {
        return;
      }
      const newFields = [...fields];
      if (newFields[newFields.length - 1] === OurLogKnownFieldKey.TIMESTAMP) {
        newFields.splice(-1, 0, typedKey);
      } else {
        newFields.push(typedKey);
      }
      setLogFields(newFields);
    },
    [setLogFields, fields]
  );

  const addGroupBy = useCallback(
    (content: AttributesTreeContent) => {
      if (!content.originalAttribute) {
        return;
      }
      const key = getTypedTagKey(
        content.originalAttribute.original_attribute_key,
        content.originalAttribute.type,
        'log'
      );
      // Drop empty placeholder group bys, dedupe, then append the new key.
      const newGroupBys = groupBys.filter(Boolean);
      if (containsAttributeKey(newGroupBys, key)) {
        return;
      }
      newGroupBys.push(key);
      setGroupBys(newGroupBys, Mode.AGGREGATE);
      // Reveal the Group By controls so the user can see the grouping they just added.
      sidebar?.(true);
    },
    [setGroupBys, groupBys, sidebar]
  );

  return (content: AttributesTreeContent) => {
    if (!content.originalAttribute) {
      return [];
    }

    const typedKey = getTypedTagKey(
      content.originalAttribute.original_attribute_key,
      content.originalAttribute.type,
      'log'
    );

    const items: MenuItemProps[] = [
      {
        key: 'search-for-value',
        label: t('Add to filter'),
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
        disabled: containsAttributeKey(fields, typedKey),
        onAction: () => addColumn(content),
      },
      {
        key: 'add-group-by',
        label: t('Group by attribute'),
        hidden: embedded,
        disabled: containsAttributeKey(groupBys, typedKey),
        onAction: () => addGroupBy(content),
      },
    ];

    return items;
  };
}
