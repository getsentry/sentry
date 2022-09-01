import {OrgRoleList, TeamRoleList} from './roleList';

export function Organization(params = {}) {
  return {
    id: '3',
    slug: 'org-slug',
    name: 'Organization Name',
    links: {
      organizationUrl: 'https://org-slug.sentry.io',
      regionUrl: 'https://us.sentry.io',
    },
    access: [
      'org:read',
      'org:write',
      'org:admin',
      'org:integrations',
      'project:read',
      'project:write',
      'project:releases',
      'project:admin',
      'team:read',
      'team:write',
      'team:admin',
      'alerts:read',
      'alerts:write',
    ],
    status: {
      id: 'active',
      name: 'active',
    },
    experiments: {},
    scrapeJavaScript: true,
    features: [],
    onboardingTasks: [],
    teams: [],
    projects: [],
    ...params,

    orgRoleList: OrgRoleList(),
    teamRoleList: TeamRoleList(),
  };
}
