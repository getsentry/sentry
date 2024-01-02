import {OrganizationIntegration} from 'sentry/types';

export function OrganizationIntegrations(
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
      aspects: {
        alerts: [
          {
            type: 'info',
            text: 'The Slack integration adds a new Alert Rule action to all projects. To enable automatic notifications sent to Slack you must create a rule using the slack workspace action in your project settings.',
          },
        ],
      },
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
