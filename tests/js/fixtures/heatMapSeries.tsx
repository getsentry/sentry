import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';

export function HeatMapSeriesFixture(params: Partial<HeatMapSeries> = {}): HeatMapSeries {
  const {meta, values, ...rest} = params;

  return {
    values: values ?? [],
    meta: {
      xAxis: {
        name: 'time',
        start: 0,
        end: 0,
        bucketCount: 0,
        bucketSize: 3600,
        ...meta?.xAxis,
      },
      yAxis: {
        name: 'value',
        start: 0,
        end: 100,
        bucketCount: 2,
        bucketSize: 50,
        valueType: 'number',
        valueUnit: null,
        ...meta?.yAxis,
      },
      zAxis: {name: 'count()', start: 0, end: 0, ...meta?.zAxis},
    },
    ...rest,
  };
}
