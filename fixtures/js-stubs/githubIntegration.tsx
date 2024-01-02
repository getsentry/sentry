import {GroupIntegration} from 'sentry/types';

export function GitHubIntegration(
  params: Partial<GroupIntegration> = {}
): GroupIntegration {
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
    externalIssues: [],
    accountType: '',
    gracePeriodEnd: '',
    organizationIntegrationStatus: 'active',
    status: 'active',
    ...params,
  };
}
