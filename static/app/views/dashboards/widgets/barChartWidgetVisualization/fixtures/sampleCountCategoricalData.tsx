import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleCountCategoricalData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'Chrome', value: 1250},
    {category: 'Firefox', value: 890},
    {category: 'Safari', value: 650},
    {category: 'Edge', value: 420},
    {category: 'Opera', value: 180},
  ],
};

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

export const sampleStackedCategoricalData: CategoricalSeries[] = [
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

/**
 * Long category labels to demonstrate truncation behavior
 */
export const sampleLongLabelData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: '/api/v2/organizations/:orgId/projects/:projectId/issues', value: 450},
    {category: '/api/v2/users/:userId/preferences/notifications', value: 320},
    {category: '/api/v2/teams/:teamId/members/:memberId/roles', value: 280},
    {category: '/api/v2/dashboards/:dashboardId/widgets/:widgetId', value: 195},
    {category: '/api/v2/releases/:releaseId/commits/:commitId', value: 150},
  ],
};

/**
 * Percentage data (values between 0 and 1)
 */
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

/**
 * Size data in bytes
 */
export const sampleSizeData: CategoricalSeries = {
  valueAxis: 'avg(http.response_content_length)',
  meta: {
    valueType: 'size',
    valueUnit: SizeUnit.BYTE,
  },
  values: [
    {category: '/api/assets', value: 2_500_000},
    {category: '/api/images', value: 8_750_000},
    {category: '/api/videos', value: 45_000_000},
    {category: '/api/documents', value: 1_250_000},
    {category: '/api/thumbnails', value: 125_000},
  ],
};

/**
 * Rate data (requests per second)
 */
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

/**
 * Data with null values to demonstrate sparse data handling
 */
export const sampleSparseData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'Jan', value: 1200},
    {category: 'Feb', value: null},
    {category: 'Mar', value: 1450},
    {category: 'Apr', value: null},
    {category: 'May', value: 980},
    {category: 'Jun', value: 1100},
  ],
};

/**
 * Data with negative values (useful for showing deltas/changes)
 */
export const sampleNegativeData: CategoricalSeries = {
  valueAxis: 'change(count())',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'Chrome', value: 150},
    {category: 'Firefox', value: -45},
    {category: 'Safari', value: -120},
    {category: 'Edge', value: 85},
    {category: 'Opera', value: -30},
  ],
};

/**
 * Large values to demonstrate Y-axis scaling
 */
export const sampleLargeValueData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'United States', value: 12_500_000},
    {category: 'European Union', value: 8_200_000},
    {category: 'Asia Pacific', value: 15_800_000},
    {category: 'Latin America', value: 3_400_000},
    {category: 'Middle East', value: 1_200_000},
  ],
};

/**
 * Many categories to demonstrate X-axis scaling
 */
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

/**
 * Multiple series for demonstrating many series with auto coloring
 */
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
