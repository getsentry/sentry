module.exports.Repository = function (params = {}) {
  return {
    id: '4',
    name: 'example/repo-name',
    provider: 'github',
    url: 'https://github.com/example/repo-name',
    status: 'active',
    externalSlug: 'example/repo-name',
    ...params,
  };
};
