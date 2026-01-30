import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleLargeValueData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'United States', value: 12_500_000},
    {category: 'European Union', value: 8_200_000},
    {category: 'Asia Pacific', value: 15_800_000},
    {category: 'Latin America', value: 3_400_000},
    {category: 'Middle East', value: 1_200_000},
  ],
};
