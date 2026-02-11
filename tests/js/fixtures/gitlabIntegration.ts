import type {GroupIntegration} from 'sentry/types/integrations';

export function GitLabIntegrationFixture(
  params: Partial<GroupIntegration> = {}
): GroupIntegration {
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
      aspects: {
        alerts: [
          {
            variant: 'warning',
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
