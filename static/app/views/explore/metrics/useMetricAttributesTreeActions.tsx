import {useCallback} from 'react';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {useTraceMetricItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useAddSearchFilter} from 'sentry/views/explore/queryParams/context';
import {resolveAttributeFilterKey} from 'sentry/views/explore/utils';

export function useMetricAttributesTreeActions() {
  const addSearchFilter = useAddSearchFilter();
  const {attributes: numberAttributes} = useTraceMetricItemAttributes({}, 'number');
  const {attributes: booleanAttributes} = useTraceMetricItemAttributes({}, 'boolean');

  const addAttributeSearchFilter = useCallback(
    (content: AttributesTreeContent, negated?: boolean) => {
      const originalAttribute = content.originalAttribute;
      if (!originalAttribute) {
        return;
      }

      addSearchFilter({
        key: resolveAttributeFilterKey({
          name: originalAttribute.attribute_key,
          fallbackKey: originalAttribute.original_attribute_key,
          type: originalAttribute.attribute_type,
          numberAttributes,
          booleanAttributes,
        }),
        value: String(content.value),
        negated,
      });
    },
    [addSearchFilter, numberAttributes, booleanAttributes]
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
