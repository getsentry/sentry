import {SessionApiResponse} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {SESSIONS_TAGS} from 'sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields';

function changeObjectValuesToTypes(
  obj: Record<string, number | string | null> | undefined
) {
  return Object.keys(obj ?? {}).reduce((acc, key) => {
    acc[key] = SESSIONS_TAGS.includes(key) ? 'string' : aggregateOutputType(key);
    return acc;
  }, {});
}

export function transformSessionsResponseToTable(
  response: SessionApiResponse | null
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
