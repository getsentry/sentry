import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleSparseData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'Jan', value: 1200},
    {category: 'Feb', value: null},
    {category: 'Mar', value: 1450},
    {category: 'Apr', value: null},
    {category: 'May', value: 980},
    {category: 'Jun', value: 1100},
  ],
};
