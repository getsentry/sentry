import {MetricsApiResponse} from 'sentry/types';

import {TableData} from '../discover/discoverQuery';
import {getAggregateArg} from '../discover/fields';

import {METRIC_TO_COLUMN_TYPE} from './fields';

function changeObjectValuesToTypes(
  obj: Record<string, number | string | null> | undefined
) {
  return Object.keys(obj ?? {}).reduce((acc, key) => {
    acc[key] = METRIC_TO_COLUMN_TYPE[getAggregateArg(key) ?? key] ?? 'string';
    return acc;
  }, {});
}

export function transformMetricsResponseToTable(
  response: MetricsApiResponse | null
): TableData {
  const data =
    response?.groups.map((group, index) => ({
      id: String(index),
      ...group.by,
      ...group.totals,
    })) ?? [];

  const singleRow = response?.groups[0];
  // TODO(metrics): these should come from the API in the future
  const meta = {
    ...changeObjectValuesToTypes(singleRow?.by),
    ...changeObjectValuesToTypes(singleRow?.totals),
  };

  return {meta, data};
}
