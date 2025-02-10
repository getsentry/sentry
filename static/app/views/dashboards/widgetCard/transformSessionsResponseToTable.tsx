import omit from 'lodash/omit';

import type {SessionApiResponse} from 'sentry/types/organization';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
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
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

export function getDerivedMetrics(
  groupBy: any,
  totals: any,
  requestedStatusMetrics: any
) {
  const derivedTotals = {};
  if (!requestedStatusMetrics.length) {
    return derivedTotals;
  }
  if (groupBy['session.status'] === undefined) {
    return derivedTotals;
  }
  requestedStatusMetrics.forEach((status: any) => {
    const result = status.match(DERIVED_STATUS_METRICS_PATTERN);
    if (result) {
      if (groupBy['session.status'] === result[1]) {
        if (result[2] === 'session') {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          derivedTotals[status] = totals['sum(session)'];
        } else if (result[2] === 'user') {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          derivedTotals[status] = totals['count_unique(user)'];
        }
      } else {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        derivedTotals[status] = 0;
      }
    }
  });
  return derivedTotals;
}

export function transformSessionsResponseToTable(
  response: SessionApiResponse | null,
  requestedStatusMetrics: string[],
  injectedFields: string[]
): TableData {
  const data =
    response?.groups.map((group, index) => ({
      id: String(index),
      // @ts-expect-error TS(2345): Argument of type 'Record<string, string> | Record<... Remove this comment to see the full error message
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
