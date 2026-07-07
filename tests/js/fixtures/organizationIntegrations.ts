import type {OrganizationIntegration} from 'sentry/types/integrations';

export function OrganizationIntegrationsFixture(
  params: Partial<OrganizationIntegration> = {}
): OrganizationIntegration {
  return {
    id: '15',
    name: 'hb-testing',
    icon: 'https://a.slack-edge.com/80588/img/avatars-teams/ava_0012-132.png',
    domainName: 'hb-testing.slack.com',
    accountType: null,
    status: 'active',
    provider: {
      key: 'slack',
      slug: 'slack',
      name: 'Slack',
      canAdd: true,
      canDisable: false,
      features: ['alert-rule', 'chat-unfurl'],
      aspects: {},
    },
    configOrganization: [],
    configData: {
      installationType: 'born_as_bot',
    },
    externalId: 'TA99AB9CD',
    gracePeriodEnd: '',
    organizationId: '',
    organizationIntegrationStatus: 'active',
    ...params,
  };
}
