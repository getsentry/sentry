import {t} from 'sentry/locale';
import type {MRI} from 'sentry/types';
import type {
  MetricFormulaWidgetParams,
  MetricQueryWidgetParams,
  SortState,
} from 'sentry/utils/metrics/types';
import {MetricDisplayType, MetricQueryType} from 'sentry/utils/metrics/types';

export const METRICS_DOCS_URL = 'https://docs.sentry.io/product/metrics/';

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

export const emptyMetricsQueryWidget: MetricQueryWidgetParams = {
  type: MetricQueryType.QUERY,
  id: NO_QUERY_ID,
  mri: 'd:transactions/duration@millisecond' satisfies MRI,
  op: 'avg',
  query: '',
  groupBy: [],
  sort: DEFAULT_SORT_STATE,
  displayType: MetricDisplayType.LINE,
  isHidden: false,
};

export const emptyMetricsFormulaWidget: MetricFormulaWidgetParams = {
  type: MetricQueryType.FORMULA,
  id: NO_QUERY_ID,
  formula: '',
  sort: DEFAULT_SORT_STATE,
  displayType: MetricDisplayType.LINE,
  isHidden: false,
};
