export function Repository(params = {}) {
  return {
    id: '4',
    name: 'example/repo-name',
    provider: 'github',
    url: 'https://github.com/example/repo-name',
    status: 'active',
    externalId: 'example/repo-name',
    ...params,
  };
}
