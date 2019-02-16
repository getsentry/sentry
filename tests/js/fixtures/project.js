export function Project(params) {
  return {
    id: '2',
    slug: 'project-slug',
    name: 'Project Name',
    hasAccess: true,
    isMember: true,
    isBookmarked: false,
    teams: [],
    environments: [],
    ...params,
  };
}
