export function Organization(params = {}) {
  return {
    id: '3',
    slug: 'org-slug',
    organizationUrl: 'https://org-slug.us.sentry.io',
    name: 'Organization Name',
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
  };
}
