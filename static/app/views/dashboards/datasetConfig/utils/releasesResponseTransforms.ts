import omit from 'lodash/omit';

import type {SessionApiResponse} from 'sentry/types/organization';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {resolveDerivedStatusFields} from 'sentry/views/dashboards/datasetConfig/utils/releaseQueryFields';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {transformSessionsResponseToSeries} from 'sentry/views/dashboards/utils/transformSessionsResponseToSeries';
import {
  changeObjectValuesToTypes,
  getDerivedMetrics,
  mapDerivedMetricsToFields,
} from 'sentry/views/dashboards/utils/transformSessionsResponseToTable';

export function transformSessionsResponseToTable(
  data: SessionApiResponse,
  widgetQuery: WidgetQuery
): TableData {
  const useSessionAPI = widgetQuery.columns.includes('session.status');
  const {derivedStatusFields, injectedFields} = resolveDerivedStatusFields(
    widgetQuery.aggregates,
    widgetQuery.orderby,
    useSessionAPI
  );
  const rows = data.groups.map((group, index) => ({
    id: String(index),
    // @ts-expect-error TS(2345): Argument of type 'Record<string, string | number> ... Remove this comment to see the full error message
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
    ...getDerivedMetrics(group.by, group.totals, derivedStatusFields),
  }));

  const singleRow = rows[0];
  const meta = {
    ...changeObjectValuesToTypes(omit(singleRow, 'id')),
    fields: changeObjectValuesToTypes(omit(singleRow, 'id')),
  };
  return {meta, data: rows};
}

export const releasesResponseTransforms: Pick<
  DatasetConfig<SessionApiResponse, SessionApiResponse>,
  'transformSeries' | 'transformTable'
> = {
  transformSeries: transformSessionsResponseToSeries,
  transformTable: transformSessionsResponseToTable,
};
