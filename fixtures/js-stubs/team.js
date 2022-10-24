module.exports.Team = function (params = {}) {
  return {
    id: '1',
    slug: 'team-slug',
    name: 'Team Name',
    isMember: true,
    memberCount: 0,
    ...params,
  };
};
