import {IntegrationProvider} from 'sentry/types';

export function JiraIntegrationProvider(
  params: Partial<IntegrationProvider> = {}
): IntegrationProvider {
  return {
    key: 'jira',
    name: 'Jira',
    canAdd: false,
    features: [],
    slug: 'jira',
    canDisable: true,
    setupDialog: {
      url: '/jira-integration-setup-uri/',
      width: 100,
      height: 100,
    },
    metadata: {
      description: '*markdown* formatted Jira _description_',
      features: [
        {description: '*markdown* feature description', featureGate: '', featureId: 3},
      ],
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
