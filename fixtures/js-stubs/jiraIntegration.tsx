import type {GroupIntegration} from 'sentry/types/integrations';

export function JiraIntegrationFixture(
  params: Partial<GroupIntegration> = {}
): GroupIntegration {
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
      aspects: {
        alerts: [
          {
            type: 'warning',
            text: 'This is a an alert example',
          },
        ],
      },
      canDisable: false,
      slug: '',
    },
    accountType: '',
    gracePeriodEnd: '',
    organizationIntegrationStatus: 'active',
    status: 'active',
    externalIssues: [],
    ...params,
  };
}
