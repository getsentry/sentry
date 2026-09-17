import {useCallback} from 'react';

import {t} from 'sentry/locale';
import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {useAttributeTreeSearchActions} from 'sentry/views/explore/components/traceItemAttributes/useAttributeTreeSearchActions';
import {useLogsSidebar} from 'sentry/views/explore/logs/logsSidebarContext';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useSetQueryParamsFields,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';

export function useLogAttributesTreeActions({embedded}: {embedded: boolean}) {
  const getSearchActions = useAttributeTreeSearchActions();
  const fields = useQueryParamsFields();
  const setLogFields = useSetQueryParamsFields();
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();
  const sidebar = useLogsSidebar();

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

  const addGroupBy = useCallback(
    (content: AttributesTreeContent) => {
      if (!content.originalAttribute) {
        return;
      }
      const key = content.originalAttribute.original_attribute_key;
      // Drop empty placeholder group bys, dedupe, then append the new key.
      const newGroupBys = groupBys.filter(Boolean);
      if (!newGroupBys.includes(key)) {
        newGroupBys.push(key);
      }
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

    const key = content.originalAttribute.original_attribute_key;
    const items = getSearchActions(content);

    items.push(
      {
        key: 'add-column',
        label: t('Add this as table column'),
        hidden: embedded,
        disabled: fields.includes(key),
        onAction: () => addColumn(content),
      },
      {
        key: 'add-group-by',
        label: t('Group by attribute'),
        hidden: embedded,
        disabled: groupBys.includes(key),
        onAction: () => addGroupBy(content),
      }
    );

    return items;
  };
}
