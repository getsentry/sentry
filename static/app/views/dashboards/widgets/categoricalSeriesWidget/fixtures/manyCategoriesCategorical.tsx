import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleManyCategoriesData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'Category 1', value: 234},
    {category: 'Category 2', value: 456},
    {category: 'Category 3', value: 321},
    {category: 'Category 4', value: 567},
    {category: 'Category 5', value: 432},
    {category: 'Category 6', value: 654},
    {category: 'Category 7', value: 345},
    {category: 'Category 8', value: 543},
    {category: 'Category 9', value: 210},
    {category: 'Category 10', value: 678},
    {category: 'Category 11', value: 389},
    {category: 'Category 12', value: 512},
  ],
};
