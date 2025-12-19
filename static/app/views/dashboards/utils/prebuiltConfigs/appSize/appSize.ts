import {t} from 'sentry/locale';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {type PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';

export const DASHBOARD_TITLE = t('App Size Monitoring');

const FIRST_ROW_WIDGETS: Widget[] = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'install-size-chart',
      title: t('Install Size Over Time'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.MOBILE_APP_SIZE,
      interval: '1d',
      queries: [
        {
          name: t('Install Size'),
          conditions: '',
          fields: ['max(max_install_size)'],
          aggregates: ['max(max_install_size)'],
          columns: [],
          orderby: '',
        },
      ],
    },
    {
      id: 'download-size-chart',
      title: t('Download Size Over Time'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.MOBILE_APP_SIZE,
      interval: '1d',
      queries: [
        {
          name: t('Download Size'),
          conditions: '',
          fields: ['max(max_download_size)'],
          aggregates: ['max(max_download_size)'],
          columns: [],
          orderby: '',
        },
      ],
    },
  ],
  0
);

const SIZE_COMPARISON_WIDGET: Widget = {
  id: 'size-comparison-chart',
  title: t('Install vs Download Size'),
  displayType: DisplayType.LINE,
  widgetType: WidgetType.MOBILE_APP_SIZE,
  interval: '1d',
  queries: [
    {
      name: t('Install Size'),
      conditions: '',
      fields: ['max(max_install_size)'],
      aggregates: ['max(max_install_size)'],
      columns: [],
      orderby: '',
    },
    {
      name: t('Download Size'),
      conditions: '',
      fields: ['max(max_download_size)'],
      aggregates: ['max(max_download_size)'],
      columns: [],
      orderby: '',
    },
  ],
  layout: {
    x: 0,
    y: 2,
    minH: 2,
    h: 4,
    w: 6,
  },
};

export const MOBILE_APP_SIZE_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  filters: {},
  widgets: [...FIRST_ROW_WIDGETS, SIZE_COMPARISON_WIDGET],
};
