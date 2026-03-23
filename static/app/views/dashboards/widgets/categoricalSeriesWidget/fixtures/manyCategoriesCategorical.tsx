import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleManyCategoriesData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'Chrome', value: 234},
    {category: 'Firefox', value: 456},
    {category: 'Safari', value: 321},
    {category: 'Edge', value: 567},
    {category: 'Opera', value: 432},
    {category: 'Brave', value: 654},
    {category: 'Vivaldi', value: 345},
    {category: 'Arc', value: 543},
    {category: 'Tor', value: 210},
    {category: 'Waterfox', value: 678},
    {category: 'Pale Moon', value: 389},
    {category: 'Midori', value: 512},
  ],
};
