import {OrganizationIntegration} from 'sentry/types';

export function JiraIntegration(
  params: Partial<OrganizationIntegration> = {}
): OrganizationIntegration {
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
    configOrganization: [],
    configData: {},
    accountType: '',
    externalId: '',
    gracePeriodEnd: '',
    organizationId: '',
    organizationIntegrationStatus: 'active',
    status: 'active',
    ...params,
  };
}
