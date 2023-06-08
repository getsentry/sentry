export function Team(params = {}) {
  return {
    id: '1',
    slug: 'team-slug',
    name: 'Team Name',
    access: ['team:read', 'team:write', 'team:admin'],
    orgRole: null, // TODO(cathy): Rename this
    teamRole: null,
    isMember: true,
    memberCount: 0,
    flags: {
      'idp:provisioned': false,
    },
    ...params,
  };
}
