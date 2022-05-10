import {MetricsApiResponse, SessionApiResponse} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {SESSIONS_TAGS} from 'sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields';

import {derivedMetricsToField} from './releaseWidgetQueries';

function changeObjectValuesToTypes(
  obj: Record<string, number | string | null> | undefined
) {
  return Object.keys(obj ?? {}).reduce((acc, key) => {
    acc[key] = SESSIONS_TAGS.includes(key) ? 'string' : aggregateOutputType(key);
    return acc;
  }, {});
}

function mapDerivedMetricsToFields(results: Record<string, number | null>) {
  const mappedResults: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(results)) {
    mappedResults[derivedMetricsToField(key)] = value;
  }
  return mappedResults;
}

export function transformSessionsResponseToTable(
  response: SessionApiResponse | MetricsApiResponse | null
): TableData {
  const data =
    response?.groups.map((group, index) => ({
      id: String(index),
      ...group.by,
      ...mapDerivedMetricsToFields(group.totals),
    })) ?? [];

  const singleRow = response?.groups[0];
  // TODO(metrics): these should come from the API in the future
  const meta = {
    ...changeObjectValuesToTypes(singleRow?.by),
    ...changeObjectValuesToTypes(
      singleRow?.totals ? mapDerivedMetricsToFields(singleRow?.totals) : undefined
    ),
  };

  return {meta, data};
}
