import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

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
