import {MetricsApiResponse, SessionApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableData} from 'sentry/utils/discover/discoverQuery';

import {DatasetConfig} from './base';

export const ReleasesConfig: DatasetConfig<
  SessionApiResponse | MetricsApiResponse,
  SessionApiResponse | MetricsApiResponse
> = {
  transformSeries: (_data: SessionApiResponse | MetricsApiResponse) => {
    return [] as Series[];
  },
  transformTable: (_data: SessionApiResponse | MetricsApiResponse) => {
    return {data: []} as TableData;
  },
};
