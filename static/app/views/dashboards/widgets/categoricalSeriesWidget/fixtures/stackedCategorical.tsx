import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleStackedCategoricalData: [CategoricalSeries, CategoricalSeries] = [
  {
    valueAxis: 'count()',
    groupBy: [{key: 'status', value: 'success'}],
    meta: {
      valueType: 'integer',
      valueUnit: null,
    },
    values: [
      {category: 'Monday', value: 450},
      {category: 'Tuesday', value: 520},
      {category: 'Wednesday', value: 480},
      {category: 'Thursday', value: 390},
      {category: 'Friday', value: 410},
    ],
  },
  {
    valueAxis: 'count()',
    groupBy: [{key: 'status', value: 'error'}],
    meta: {
      valueType: 'integer',
      valueUnit: null,
    },
    values: [
      {category: 'Monday', value: 45},
      {category: 'Tuesday', value: 32},
      {category: 'Wednesday', value: 28},
      {category: 'Thursday', value: 51},
      {category: 'Friday', value: 38},
    ],
  },
];
