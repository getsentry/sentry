export function Team(params = {}) {
  return {
    id: '1',
    slug: 'team-slug',
    name: 'Team Name',
    orgRole: null,
    isMember: true,
    memberCount: 0,
    flags: {
      'idp:provisioned': false,
    },
    ...params,
  };
}
