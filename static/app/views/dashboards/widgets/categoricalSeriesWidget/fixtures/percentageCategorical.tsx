import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const samplePercentageData: CategoricalSeries = {
  valueAxis: 'crash_free_rate()',
  meta: {
    valueType: 'percentage',
    valueUnit: null,
  },
  values: [
    {category: 'iOS', value: 0.9945},
    {category: 'Android', value: 0.9823},
    {category: 'React Native', value: 0.9756},
    {category: 'Flutter', value: 0.9912},
    {category: 'Unity', value: 0.9634},
  ],
};
