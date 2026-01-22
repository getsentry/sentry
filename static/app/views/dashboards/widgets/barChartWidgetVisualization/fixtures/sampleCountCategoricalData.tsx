import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
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
    valueUnit: DurationUnit.MILLISECOND,
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

/**
 * Long category labels to demonstrate truncation behavior
 */
export const sampleLongLabelData: CategoricalSeries = {
  yAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  data: [
    {label: '/api/v2/organizations/:orgId/projects/:projectId/issues', value: 450},
    {label: '/api/v2/users/:userId/preferences/notifications', value: 320},
    {label: '/api/v2/teams/:teamId/members/:memberId/roles', value: 280},
    {label: '/api/v2/dashboards/:dashboardId/widgets/:widgetId', value: 195},
    {label: '/api/v2/releases/:releaseId/commits/:commitId', value: 150},
  ],
};

/**
 * Percentage data (values between 0 and 1)
 */
export const samplePercentageData: CategoricalSeries = {
  yAxis: 'crash_free_rate()',
  meta: {
    valueType: 'percentage',
    valueUnit: null,
  },
  data: [
    {label: 'iOS', value: 0.9945},
    {label: 'Android', value: 0.9823},
    {label: 'React Native', value: 0.9756},
    {label: 'Flutter', value: 0.9912},
    {label: 'Unity', value: 0.9634},
  ],
};

/**
 * Size data in bytes
 */
export const sampleSizeData: CategoricalSeries = {
  yAxis: 'avg(http.response_content_length)',
  meta: {
    valueType: 'size',
    valueUnit: SizeUnit.BYTE,
  },
  data: [
    {label: '/api/assets', value: 2_500_000},
    {label: '/api/images', value: 8_750_000},
    {label: '/api/videos', value: 45_000_000},
    {label: '/api/documents', value: 1_250_000},
    {label: '/api/thumbnails', value: 125_000},
  ],
};

/**
 * Rate data (requests per second)
 */
export const sampleRateData: CategoricalSeries = {
  yAxis: 'spm()',
  meta: {
    valueType: 'rate',
    valueUnit: RateUnit.PER_SECOND,
  },
  data: [
    {label: 'GET /users', value: 125.5},
    {label: 'POST /orders', value: 45.2},
    {label: 'GET /products', value: 89.7},
    {label: 'PUT /cart', value: 32.1},
    {label: 'DELETE /sessions', value: 12.8},
  ],
};

/**
 * Data with null values to demonstrate sparse data handling
 */
export const sampleSparseData: CategoricalSeries = {
  yAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  data: [
    {label: 'Jan', value: 1200},
    {label: 'Feb', value: null},
    {label: 'Mar', value: 1450},
    {label: 'Apr', value: null},
    {label: 'May', value: 980},
    {label: 'Jun', value: 1100},
  ],
};

/**
 * Data with negative values (useful for showing deltas/changes)
 */
export const sampleNegativeData: CategoricalSeries = {
  yAxis: 'change(count())',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  data: [
    {label: 'Chrome', value: 150},
    {label: 'Firefox', value: -45},
    {label: 'Safari', value: -120},
    {label: 'Edge', value: 85},
    {label: 'Opera', value: -30},
  ],
};

/**
 * Large values to demonstrate Y-axis scaling
 */
export const sampleLargeValueData: CategoricalSeries = {
  yAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  data: [
    {label: 'United States', value: 12_500_000},
    {label: 'European Union', value: 8_200_000},
    {label: 'Asia Pacific', value: 15_800_000},
    {label: 'Latin America', value: 3_400_000},
    {label: 'Middle East', value: 1_200_000},
  ],
};

/**
 * Many categories to demonstrate X-axis scaling
 */
export const sampleManyCategoriesData: CategoricalSeries = {
  yAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  data: [
    {label: 'Category 1', value: 234},
    {label: 'Category 2', value: 456},
    {label: 'Category 3', value: 321},
    {label: 'Category 4', value: 567},
    {label: 'Category 5', value: 432},
    {label: 'Category 6', value: 654},
    {label: 'Category 7', value: 345},
    {label: 'Category 8', value: 543},
    {label: 'Category 9', value: 210},
    {label: 'Category 10', value: 678},
    {label: 'Category 11', value: 389},
    {label: 'Category 12', value: 512},
  ],
};

/**
 * Multiple series for demonstrating many series with auto coloring
 */
export const sampleMultiSeriesData: CategoricalSeries[] = [
  {
    yAxis: 'count() by browser:chrome',
    meta: {valueType: 'integer', valueUnit: null},
    data: [
      {label: 'Mon', value: 450},
      {label: 'Tue', value: 520},
      {label: 'Wed', value: 480},
      {label: 'Thu', value: 390},
      {label: 'Fri', value: 410},
    ],
  },
  {
    yAxis: 'count() by browser:firefox',
    meta: {valueType: 'integer', valueUnit: null},
    data: [
      {label: 'Mon', value: 280},
      {label: 'Tue', value: 310},
      {label: 'Wed', value: 295},
      {label: 'Thu', value: 260},
      {label: 'Fri', value: 275},
    ],
  },
  {
    yAxis: 'count() by browser:safari',
    meta: {valueType: 'integer', valueUnit: null},
    data: [
      {label: 'Mon', value: 180},
      {label: 'Tue', value: 195},
      {label: 'Wed', value: 170},
      {label: 'Thu', value: 165},
      {label: 'Fri', value: 190},
    ],
  },
  {
    yAxis: 'count() by browser:edge',
    meta: {valueType: 'integer', valueUnit: null},
    data: [
      {label: 'Mon', value: 120},
      {label: 'Tue', value: 135},
      {label: 'Wed', value: 125},
      {label: 'Thu', value: 110},
      {label: 'Fri', value: 130},
    ],
  },
  {
    yAxis: 'count() by browser:opera',
    meta: {valueType: 'integer', valueUnit: null},
    data: [
      {label: 'Mon', value: 45},
      {label: 'Tue', value: 52},
      {label: 'Wed', value: 48},
      {label: 'Thu', value: 42},
      {label: 'Fri', value: 50},
    ],
  },
];
