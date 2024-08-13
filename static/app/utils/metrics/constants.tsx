import {t} from 'sentry/locale';
import type {
  MetricsEquationWidget,
  MetricsQueryWidget,
  SortState,
} from 'sentry/utils/metrics/types';
import {
  MetricChartOverlayType,
  MetricDisplayType,
  MetricExpressionType,
} from 'sentry/utils/metrics/types';

export const METRICS_DOCS_URL = 'https://docs.sentry.io/product/metrics/';
export const SPAN_DURATION_MRI = 'd:spans/duration@millisecond';

export const metricDisplayTypeOptions = [
  {
    value: MetricDisplayType.LINE,
    label: t('Line'),
  },
  {
    value: MetricDisplayType.AREA,
    label: t('Area'),
  },
  {
    value: MetricDisplayType.BAR,
    label: t('Bar'),
  },
];

export const DEFAULT_SORT_STATE: SortState = {
  name: undefined,
  order: 'asc',
};

export const NO_QUERY_ID = -1;

export const emptyMetricsQueryWidget: MetricsQueryWidget = {
  type: MetricExpressionType.QUERY,
  id: NO_QUERY_ID,
  mri: SPAN_DURATION_MRI,
  aggregation: 'avg',
  condition: undefined,
  query: '',
  groupBy: [],
  sort: DEFAULT_SORT_STATE,
  displayType: MetricDisplayType.LINE,
  isHidden: false,
  overlays: [MetricChartOverlayType.SAMPLES],
};

export const emptyMetricsFormulaWidget: MetricsEquationWidget = {
  type: MetricExpressionType.EQUATION,
  id: NO_QUERY_ID,
  formula: '',
  sort: DEFAULT_SORT_STATE,
  displayType: MetricDisplayType.LINE,
  isHidden: false,
  overlays: [MetricChartOverlayType.SAMPLES],
};

export const DEFAULT_AGGREGATES = {
  c: 'sum',
  d: 'avg',
  s: 'count_unique',
  g: 'avg',
};
