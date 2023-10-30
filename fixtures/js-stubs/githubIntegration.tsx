import {OrganizationIntegration} from 'sentry/types';

export function GitHubIntegration(
  params: Partial<OrganizationIntegration> = {}
): OrganizationIntegration {
  return {
    domainName: 'github.com/test-integration',
    icon: 'http://example.com/integration_icon.png',
    id: '1',
    name: 'Test Integration',
    configOrganization: [],
    configData: {},
    provider: {
      name: 'GitHub',
      key: 'github',
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
    externalId: '',
    gracePeriodEnd: '',
    organizationId: '',
    organizationIntegrationStatus: 'active',
    status: 'active',
    ...params,
  };
}
