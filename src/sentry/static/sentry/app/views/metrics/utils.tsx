import {PlainRoute} from 'react-router/lib/Route';

export enum MetricsTab {
  EXPLORER = 'explorer',
  DASHBOARDS = 'dashboards',
}

export function getCurrentMetricsTab(
  routes: Array<PlainRoute>
): {currentTab: MetricsTab} {
  // All the routes under /organizations/:orgId/metrics/ have a defined props
  const {currentTab} = routes[routes.length - 1].props as {
    currentTab: MetricsTab;
  };

  return {currentTab};
}
