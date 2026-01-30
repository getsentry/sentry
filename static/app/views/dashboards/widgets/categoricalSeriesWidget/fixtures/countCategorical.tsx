import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleCountCategoricalData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'Chrome', value: 1250},
    {category: 'Firefox', value: 890},
    {category: 'Safari', value: 650},
    {category: 'Edge', value: 420},
    {category: 'Opera', value: 180},
  ],
};
