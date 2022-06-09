import omit from 'lodash/omit';

import {MetricsApiResponse, SessionApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

import {WidgetQuery} from '../types';
import {resolveDerivedStatusFields} from '../widgetCard/releaseWidgetQueries';
import {
  changeObjectValuesToTypes,
  getDerivedMetrics,
  mapDerivedMetricsToFields,
} from '../widgetCard/transformSessionsResponseToTable';

import {DatasetConfig} from './base';

export const ReleasesConfig: DatasetConfig<
  SessionApiResponse | MetricsApiResponse,
  SessionApiResponse | MetricsApiResponse
> = {
  getCustomFieldRenderer: (field, meta) => getFieldRenderer(field, meta, false),
  transformSeries: (_data: SessionApiResponse | MetricsApiResponse) => {
    return [] as Series[];
  },
  transformTable: transformSessionsResponseToTable,
};

export function transformSessionsResponseToTable(
  data: SessionApiResponse | MetricsApiResponse,
  widgetQuery: WidgetQuery
): TableData {
  const useSessionAPI = widgetQuery.columns.includes('session.status');
  const {derivedStatusFields, injectedFields} = resolveDerivedStatusFields(
    widgetQuery.aggregates,
    useSessionAPI
  );
  const rows = data.groups.map((group, index) => ({
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
    ...getDerivedMetrics(group.by, group.totals, derivedStatusFields),
  }));

  const singleRow = rows[0];
  const meta = {
    ...changeObjectValuesToTypes(omit(singleRow, 'id')),
  };
  return {meta, data: rows};
}
