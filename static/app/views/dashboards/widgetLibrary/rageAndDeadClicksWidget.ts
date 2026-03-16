import {t} from 'sentry/locale';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {WidgetTemplate} from 'sentry/views/dashboards/widgetLibrary/types';

export const RAGE_AND_DEAD_CLICKS_WIDGET_TEMPLATE: WidgetTemplate = {
  id: 'rage-and-dead-clicks-widget',
  title: t('Rage and Dead Clicks'),
  description: t('Visualizes the rage and dead clicks in your frontend project.'),
  isCustomizable: false,
  displayType: DisplayType.RAGE_AND_DEAD_CLICKS,
  interval: '5m',
  queries: [
    {
      name: '',
      conditions: '',
      aggregates: [],
      columns: [],
      orderby: '',
      fields: [],
    },
  ],
};
