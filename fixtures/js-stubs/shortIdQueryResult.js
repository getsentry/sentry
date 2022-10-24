const {Group} = require('./group');

module.exports.ShortIdQueryResult = function (params = {}) {
  const group = Group({
    metadata: {
      type: 'group type',
      value: 'group description',
    },
  });
  return {
    organizationSlug: 'org-slug',
    projectSlug: 'project-slug',
    groupId: group.id,
    shortId: 'test-1',
    group,
    ...params,
  };
};
