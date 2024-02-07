import {t} from 'sentry/locale';
import type {MRI} from 'sentry/types';
import type {MetricWidgetQueryParams, SortState} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';

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

export const emptyWidget: MetricWidgetQueryParams = {
  mri: 'd:transactions/duration@millisecond' satisfies MRI,
  op: 'avg',
  query: '',
  groupBy: [],
  sort: DEFAULT_SORT_STATE,
  displayType: MetricDisplayType.LINE,
  title: undefined,
};
