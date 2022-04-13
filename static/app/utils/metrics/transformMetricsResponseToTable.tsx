import {MetricsApiResponse, SessionApiResponse} from 'sentry/types';
import {SESSION_TAGS} from 'sentry/views/dashboardsV2/widgetBuilder/metricWidget/fields';

import {TableData} from '../discover/discoverQuery';
import {aggregateOutputType} from '../discover/fields';

function changeObjectValuesToTypes(
  obj: Record<string, number | string | null> | undefined
) {
  return Object.keys(obj ?? {}).reduce((acc, key) => {
    acc[key] = SESSION_TAGS.includes(key) ? 'string' : aggregateOutputType(key);
    return acc;
  }, {});
}

export function transformMetricsResponseToTable(
  response: MetricsApiResponse | SessionApiResponse | null
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
