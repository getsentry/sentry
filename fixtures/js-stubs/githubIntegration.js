export function GitHubIntegration(params = {}) {
  return {
    domainName: 'github.com/test-integration',
    icon: 'http://example.com/integration_icon.png',
    id: '1',
    name: 'Test Integration',
    provider: {
      name: 'GitHub',
      key: 'github',
      canAdd: true,
      features: [],
    },
    projects: [],
    configOrganization: [],
    configData: {},
    ...params,
  };
}
