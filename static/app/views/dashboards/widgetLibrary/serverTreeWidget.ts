import {t} from 'sentry/locale';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {WidgetTemplate} from 'sentry/views/dashboards/widgetLibrary/types';

/**
 * Shared widget definitions for Next.js Overview dashboard
 * Used in both the prebuilt Next.js Overview dashboard and the widget library
 */

export const SERVER_TREE_WIDGET_TEMPLATE: WidgetTemplate = {
  id: 'server-tree-widget',
  title: t('SSR File Tree'),
  description: t(
    'Visualizes the file tree of the server-rendered components in your Next.js project.'
  ),
  isCustomizable: false,
  displayType: DisplayType.SERVER_TREE,
  interval: '5m',
  queries: [
    {
      name: '',
      conditions: '',
      aggregates: [],
      columns: [],
      fields: [],
      orderby: '',
    },
  ],
};
