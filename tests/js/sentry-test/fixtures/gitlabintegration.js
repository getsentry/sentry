export function GitLabIntegration(params = {}) {
  return {
    domainName: 'gitlab.com/test-integration',
    icon: 'http://example.com/integration_icon.png',
    id: '1',
    name: 'Test Integration',
    provider: {
      name: 'GitLab',
      key: 'gitlab',
      canAdd: true,
      features: [],
    },
    projects: [],
    configOrganization: [],
    configData: {},
    ...params,
  };
}
