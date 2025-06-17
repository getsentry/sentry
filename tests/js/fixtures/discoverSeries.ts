import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

export function TimeSeriesFixture(params: Partial<DiscoverSeries> = {}): DiscoverSeries {
  return {
    seriesName: 'avg(span.duration)',
    data: [
      {
        name: '2025-03-24T15:00:00-04:00',
        value: 100,
      },
      {
        name: '2025-03-24T15:30:00-04:00',
        value: 161,
      },
      {
        name: '2025-03-24T16:00:00-04:00',
        value: 474,
      },
    ],
    meta: {
      fields: {
        'avg(span.duration)': 'duration',
      },
      units: {
        'avg(span.duration)': 'ms',
      },
    },
    ...params,
  };
}
