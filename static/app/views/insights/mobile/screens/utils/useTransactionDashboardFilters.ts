import {useQueryState} from 'nuqs';

import {escapeTagValue} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {FieldKind} from 'sentry/utils/fields';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';

export function useTransactionGlobalFilters(): GlobalFilter[] | undefined {
  const [transaction] = useQueryState('transaction');

  if (!transaction) {
    return undefined;
  }

  return [
    {
      dataset: WidgetType.SPANS,
      tag: {key: 'transaction', name: 'transaction', kind: FieldKind.TAG},
      value: `transaction:${escapeTagValue(transaction)}`,
    },
  ];
}
