import {DurationUnit} from 'sentry/utils/discover/fields';
import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleDurationCategoricalData: CategoricalSeries = {
  valueAxis: 'p99(transaction.duration)',
  meta: {
    valueType: 'duration',
    valueUnit: DurationUnit.MILLISECOND,
  },
  values: [
    {category: '/api/users', value: 245},
    {category: '/api/orders', value: 520},
    {category: '/api/products', value: 180},
    {category: '/api/auth', value: 95},
    {category: '/api/search', value: 1200},
  ],
};
