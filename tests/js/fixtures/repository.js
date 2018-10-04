export function Repository(params = {}) {
  return {
    id: '4',
    name: 'repo-name',
    provider: 'github',
    url: 'https://github.com/example/repo-name',
    status: 'active',
    ...params,
  };
}
