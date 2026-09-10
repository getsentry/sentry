import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {isNumericAttribute} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {useAddSearchFilter} from 'sentry/views/explore/queryParams/context';

export function useAttributeTreeSearchActions() {
  const addSearchFilter = useAddSearchFilter();

  return (content: AttributesTreeContent) => {
    if (!content.originalAttribute) {
      return [];
    }

    const key = content.originalAttribute.original_attribute_key;
    const value = content.value;
    const isNumeric = isNumericAttribute({
      value,
      type: content.originalAttribute.type,
      key,
    });

    const items: MenuItemProps[] = [
      {
        key: 'search-for-value',
        label: t('Add to filter'),
        onAction: () => addSearchFilter({key, value: String(value)}),
      },
      {
        key: 'search-for-negated-value',
        label: t('Exclude this value'),
        onAction: () => addSearchFilter({key, value: String(value), negated: true}),
      },
    ];

    if (isNumeric && value !== null) {
      items.push(
        {
          key: 'search-for-greater-than',
          label: t('Show values greater than'),
          onAction: () => addSearchFilter({key, value, op: '>'}),
        },
        {
          key: 'search-for-less-than',
          label: t('Show values less than'),
          onAction: () => addSearchFilter({key, value, op: '<'}),
        }
      );
    }

    return items;
  };
}
