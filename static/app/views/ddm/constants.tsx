import {SortState} from 'sentry/utils/metrics';

export const DDM_CHART_GROUP = 'ddm_chart_group';

export const MIN_WIDGET_WIDTH = 400;

export const DEFAULT_SORT_STATE: SortState = {
  name: undefined,
  order: 'asc',
};
