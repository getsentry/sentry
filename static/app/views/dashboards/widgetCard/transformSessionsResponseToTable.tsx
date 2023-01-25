import omit from 'lodash/omit';

import {MetricsApiResponse, SessionApiResponse} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {
  DERIVED_STATUS_METRICS_PATTERN,
  SESSIONS_TAGS,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';

import {derivedMetricsToField} from './releaseWidgetQueries';

export function changeObjectValuesToTypes(
  obj: Record<string, number | string | null> | undefined
) {
  return Object.keys(obj ?? {}).reduce((acc, key) => {
    acc[key] = SESSIONS_TAGS.includes(key) ? 'string' : aggregateOutputType(key);
    return acc;
  }, {});
}

export function mapDerivedMetricsToFields(results: Record<string, number | null>) {
  const mappedResults: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(results)) {
    mappedResults[derivedMetricsToField(key)] = value;
  }
  return mappedResults;
}

export function getDerivedMetrics(groupBy, totals, requestedStatusMetrics) {
  const derivedTotals = {};
  if (!requestedStatusMetrics.length) {
    return derivedTotals;
  }
  if (groupBy['session.status'] === undefined) {
    return derivedTotals;
  }
  requestedStatusMetrics.forEach(status => {
    const result = status.match(DERIVED_STATUS_METRICS_PATTERN);
    if (result) {
      if (groupBy['session.status'] === result[1]) {
        if (result[2] === 'session') {
          derivedTotals[status] = totals['sum(session)'];
        } else if (result[2] === 'user') {
          derivedTotals[status] = totals['count_unique(user)'];
        }
      } else {
        derivedTotals[status] = 0;
      }
    }
  });
  return derivedTotals;
}

export function transformSessionsResponseToTable(
  response: SessionApiResponse | MetricsApiResponse | null,
  requestedStatusMetrics: string[],
  injectedFields: string[]
): TableData {
  const data =
    response?.groups.map((group, index) => ({
      id: String(index),
      ...mapDerivedMetricsToFields(group.by),
      // if `sum(session)` or `count_unique(user)` are not
      // requested as a part of the payload for
      // derived status metrics through the Sessions API,
      // they are injected into the payload and need to be
      // stripped.
      ...omit(mapDerivedMetricsToFields(group.totals), injectedFields),
      // if session.status is a groupby, some post processing
      // is needed to calculate the status derived metrics
      // from grouped results of `sum(session)` or `count_unique(user)`
      ...getDerivedMetrics(group.by, group.totals, requestedStatusMetrics),
    })) ?? [];

  const singleRow = data[0];
  // TODO(metrics): these should come from the API in the future
  const meta = {
    ...changeObjectValuesToTypes(omit(singleRow, 'id')),
  };

  return {meta, data};
}
