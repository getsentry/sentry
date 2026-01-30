import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleMultiSeriesData: CategoricalSeries[] = [
  {
    valueAxis: 'count()',
    groupBy: [{key: 'browser', value: 'chrome'}],
    meta: {valueType: 'integer', valueUnit: null},
    values: [
      {category: 'Mon', value: 450},
      {category: 'Tue', value: 520},
      {category: 'Wed', value: 480},
      {category: 'Thu', value: 390},
      {category: 'Fri', value: 410},
    ],
  },
  {
    valueAxis: 'count()',
    groupBy: [{key: 'browser', value: 'firefox'}],
    meta: {valueType: 'integer', valueUnit: null},
    values: [
      {category: 'Mon', value: 280},
      {category: 'Tue', value: 310},
      {category: 'Wed', value: 295},
      {category: 'Thu', value: 260},
      {category: 'Fri', value: 275},
    ],
  },
  {
    valueAxis: 'count()',
    groupBy: [{key: 'browser', value: 'safari'}],
    meta: {valueType: 'integer', valueUnit: null},
    values: [
      {category: 'Mon', value: 180},
      {category: 'Tue', value: 195},
      {category: 'Wed', value: 170},
      {category: 'Thu', value: 165},
      {category: 'Fri', value: 190},
    ],
  },
  {
    valueAxis: 'count()',
    groupBy: [{key: 'browser', value: 'edge'}],
    meta: {valueType: 'integer', valueUnit: null},
    values: [
      {category: 'Mon', value: 120},
      {category: 'Tue', value: 135},
      {category: 'Wed', value: 125},
      {category: 'Thu', value: 110},
      {category: 'Fri', value: 130},
    ],
  },
  {
    valueAxis: 'count()',
    groupBy: [{key: 'browser', value: 'opera'}],
    meta: {valueType: 'integer', valueUnit: null},
    values: [
      {category: 'Mon', value: 45},
      {category: 'Tue', value: 52},
      {category: 'Wed', value: 48},
      {category: 'Thu', value: 42},
      {category: 'Fri', value: 50},
    ],
  },
];
