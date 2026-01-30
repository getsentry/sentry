import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleNegativeData: CategoricalSeries = {
  valueAxis: 'change(count())',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'Chrome', value: 150},
    {category: 'Firefox', value: -45},
    {category: 'Safari', value: -120},
    {category: 'Edge', value: 85},
    {category: 'Opera', value: -30},
  ],
};
