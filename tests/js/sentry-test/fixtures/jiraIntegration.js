export function JiraIntegration(params = {}) {
  return {
    domainName: 'jira.com/test-integration',
    icon: 'http://jira.example.com/integration_icon.png',
    id: '2',
    name: 'Jira Test Integration',
    provider: {
      name: 'Jira',
      key: 'jira',
      canAdd: true,
      features: [],
    },
    projects: [],
    configOrganization: [],
    configData: {},
    ...params,
  };
}
