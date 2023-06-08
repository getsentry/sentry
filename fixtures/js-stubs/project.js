export function Project(params = {}) {
  return {
    id: '2',
    slug: 'project-slug',
    name: 'Project Name',
    access: [
      'project:read',
      'project:write',
      'project:releases',
      'project:admin',
      'alerts:read',
      'alerts:write',
    ],
    hasAccess: true,
    isMember: true,
    isBookmarked: false,
    teams: [],
    environments: [],
    features: [],
    eventProcessing: {
      symbolicationDegraded: false,
    },
    ...params,
  };
}
