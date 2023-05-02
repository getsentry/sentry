export function Project(params = {}) {
  return {
    id: '2',
    slug: 'project-slug',
    name: 'Project Name',
    access: [],
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
