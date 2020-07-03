export function Organization(params = {}) {
  return {
    id: '3',
    slug: 'org-slug',
    name: 'Organization Name',
    access: [
      'org:read',
      'org:write',
      'org:admin',
      'org:integrations',
      'project:read',
      'project:write',
      'project:admin',
      'team:read',
      'team:write',
      'team:admin',
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
