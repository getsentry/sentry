import {MetricsApiResponse, SessionApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

import {DatasetConfig} from './base';

export const ReleasesConfig: DatasetConfig<
  SessionApiResponse | MetricsApiResponse,
  SessionApiResponse | MetricsApiResponse
> = {
  customFieldRenderer: (field, meta) => getFieldRenderer(field, meta, false),
  transformSeries: (_data: SessionApiResponse | MetricsApiResponse) => {
    return [] as Series[];
  },
  transformTable: (_data: SessionApiResponse | MetricsApiResponse) => {
    return {data: []} as TableData;
  },
};
