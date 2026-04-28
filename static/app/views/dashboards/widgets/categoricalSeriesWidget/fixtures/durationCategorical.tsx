import {DurationUnit} from 'sentry/utils/discover/fields';
import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleDurationCategoricalData: CategoricalSeries = {
  valueAxis: 'p99(transaction.duration)',
  meta: {
    valueType: 'duration',
    valueUnit: DurationUnit.MILLISECOND,
  },
  values: [
    {category: 'Chrome', value: 245},
    {category: 'Firefox', value: 520},
    {category: 'Safari', value: 180},
    {category: 'Edge', value: 95},
    {category: 'Opera', value: 1200},
  ],
};
