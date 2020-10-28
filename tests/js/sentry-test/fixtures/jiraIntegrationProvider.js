export function JiraIntegrationProvider(params = {}) {
  return {
    key: 'jira',
    name: 'Jira',
    canAdd: false,
    config: [],
    features: [],
    metadata: {
      description: '*markdown* formatted Jira _description_',
      features: [{description: '*markdown* feature description'}],
      author: 'Rick',
      noun: 'Instance',
      issue_url: 'http://example.com/jira_integration_issue_url',
      source_url: 'http://example.com/jira_integration_source_url',
      aspects: {
        externalInstall: {
          url: 'http://jira.com',
          buttonText: 'Visit Jira',
          noticeText: 'You must visit jira to install the integration',
        },
      },
    },
    ...params,
  };
}
