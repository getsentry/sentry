import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleManyCommonAffixData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: '/api/v2/organizations/:orgId/projects', value: 1250},
    {category: '/api/v2/organizations/:orgId/teams', value: 890},
    {category: '/api/v2/organizations/:orgId/releases', value: 650},
    {category: '/api/v2/organizations/:orgId/issues', value: 420},
    {category: '/api/v2/organizations/:orgId/members', value: 180},
    {category: '/api/v2/organizations/:orgId/stats', value: 310},
    {category: '/api/v2/organizations/:orgId/alerts', value: 540},
    {category: '/api/v2/organizations/:orgId/dashboards', value: 270},
    {category: '/api/v2/organizations/:orgId/replays', value: 160},
    {category: '/api/v2/organizations/:orgId/monitors', value: 390},
    {category: '/api/v2/organizations/:orgId/feedback', value: 220},
  ],
};
