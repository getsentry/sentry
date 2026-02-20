import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export function CategoricalSeriesFixture(
  params: Partial<CategoricalSeries> = {}
): CategoricalSeries {
  return {
    valueAxis: 'count()',
    meta: {
      valueType: 'integer',
      valueUnit: null,
    },
    values: [
      {category: 'Category A', value: 100},
      {category: 'Category B', value: 200},
      {category: 'Category C', value: 150},
    ],
    ...params,
  };
}
