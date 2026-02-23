import {FieldKind} from 'sentry/utils/fields';
import {WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  BACKEND_OVERVIEW_FIRST_ROW_WIDGETS,
  BACKEND_OVERVIEW_SECOND_ROW_WIDGETS,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/backendOverview/backendOverview';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/laravelOverview/settings';
import {SpanFields} from 'sentry/views/insights/types';

export const LARAVEL_OVERVIEW_PREBUILT_CONFIG: PrebuiltDashboard = {
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.TRANSACTION,
          name: SpanFields.TRANSACTION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  widgets: [
    ...BACKEND_OVERVIEW_FIRST_ROW_WIDGETS,
    ...BACKEND_OVERVIEW_SECOND_ROW_WIDGETS,
  ],
};
