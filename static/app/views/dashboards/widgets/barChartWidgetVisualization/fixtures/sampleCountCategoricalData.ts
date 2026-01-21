import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/types';

export const sampleCountCategoricalData: CategoricalSeries = {
  yAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  data: [
    {label: 'Chrome', value: 1250},
    {label: 'Firefox', value: 890},
    {label: 'Safari', value: 650},
    {label: 'Edge', value: 420},
    {label: 'Opera', value: 180},
  ],
};

export const sampleDurationCategoricalData: CategoricalSeries = {
  yAxis: 'p99(transaction.duration)',
  meta: {
    valueType: 'duration',
    valueUnit: 'millisecond',
  },
  data: [
    {label: '/api/users', value: 245},
    {label: '/api/orders', value: 520},
    {label: '/api/products', value: 180},
    {label: '/api/auth', value: 95},
    {label: '/api/search', value: 1200},
  ],
};

export const sampleStackedCategoricalData: CategoricalSeries[] = [
  {
    yAxis: 'count() by status:success',
    meta: {
      valueType: 'integer',
      valueUnit: null,
    },
    data: [
      {label: 'Monday', value: 450},
      {label: 'Tuesday', value: 520},
      {label: 'Wednesday', value: 480},
      {label: 'Thursday', value: 390},
      {label: 'Friday', value: 410},
    ],
  },
  {
    yAxis: 'count() by status:error',
    meta: {
      valueType: 'integer',
      valueUnit: null,
    },
    data: [
      {label: 'Monday', value: 45},
      {label: 'Tuesday', value: 32},
      {label: 'Wednesday', value: 28},
      {label: 'Thursday', value: 51},
      {label: 'Friday', value: 38},
    ],
  },
];
