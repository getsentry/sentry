import trimStart from 'lodash/trimStart';

import {isEquation} from 'sentry/utils/discover/fields';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {getNumEquations} from 'sentry/views/dashboards/utils';

/**
 * A generic orderby reset helper function that updates the query's
 * orderby based on new selected fields.
 */
export function handleOrderByReset(
  widgetQuery: WidgetQuery,
  newFields: string[]
): WidgetQuery {
  const rawOrderby = trimStart(widgetQuery.orderby, '-');
  const isDescending = widgetQuery.orderby.startsWith('-');
  const orderbyPrefix = isDescending ? '-' : '';

  if (!newFields.includes(rawOrderby) && widgetQuery.orderby !== '') {
    const isFromAggregates = widgetQuery.aggregates.includes(rawOrderby);
    const isCustomEquation = isEquation(rawOrderby);
    const isUsedInGrouping = widgetQuery.columns.includes(rawOrderby);

    const keepCurrentOrderby = isFromAggregates || isCustomEquation || isUsedInGrouping;
    const firstAggregateAlias = isEquation(widgetQuery.aggregates[0] ?? '')
      ? `equation[${getNumEquations(widgetQuery.aggregates) - 1}]`
      : newFields[0];

    widgetQuery.orderby =
      (keepCurrentOrderby && widgetQuery.orderby) ||
      `${orderbyPrefix}${firstAggregateAlias}`;
  }
  return widgetQuery;
}
