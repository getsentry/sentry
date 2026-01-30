import {RateUnit} from 'sentry/utils/discover/fields';
import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleRateData: CategoricalSeries = {
  valueAxis: 'spm()',
  meta: {
    valueType: 'rate',
    valueUnit: RateUnit.PER_SECOND,
  },
  values: [
    {category: 'GET /users', value: 125.5},
    {category: 'POST /orders', value: 45.2},
    {category: 'GET /products', value: 89.7},
    {category: 'PUT /cart', value: 32.1},
    {category: 'DELETE /sessions', value: 12.8},
  ],
};
