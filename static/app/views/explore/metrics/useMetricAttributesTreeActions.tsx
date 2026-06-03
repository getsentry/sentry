import {useCallback} from 'react';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {useAddSearchFilter} from 'sentry/views/explore/queryParams/context';
import {getTypedTagKey} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

export function useMetricAttributesTreeActions() {
  const addSearchFilter = useAddSearchFilter();

  const addAttributeSearchFilter = useCallback(
    (content: AttributesTreeContent, negated?: boolean) => {
      const originalAttribute = content.originalAttribute;
      if (!originalAttribute) {
        return;
      }

      addSearchFilter({
        key: getTypedTagKey(
          originalAttribute.original_attribute_key,
          originalAttribute.type,
          'tracemetric'
        ),
        value: String(content.value),
        negated,
      });
    },
    [addSearchFilter]
  );

  return (content: AttributesTreeContent) => {
    if (!content.originalAttribute) {
      return [];
    }

    const items: MenuItemProps[] = [
      {
        key: 'search-for-value',
        label: t('Add to filter'),
        onAction: () => addAttributeSearchFilter(content),
      },
      {
        key: 'search-for-negated-value',
        label: t('Exclude this value'),
        onAction: () => addAttributeSearchFilter(content, true),
      },
    ];

    return items;
  };
}
