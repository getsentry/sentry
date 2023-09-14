import {OrganizationIntegration} from 'sentry/types';

export function OpsgenieIntegration(
  params: Partial<OrganizationIntegration> = {}
): OrganizationIntegration {
  return {
    id: '1',
    name: 'hello-world',
    icon: null,
    domainName: 'hello-world.app.opsgenie.com',
    accountType: null,
    status: 'active',
    provider: {
      key: 'opsgenie',
      slug: 'opsgenie',
      name: 'Opsgenie',
      canAdd: true,
      canDisable: false,
      features: ['enterprise-alert-rule', 'enterprise-incident-management'],
      aspects: {},
    },
    configOrganization: [],
    configData: {},
    externalId: 'hello-world',
    organizationId: '',
    organizationIntegrationStatus: 'active',
    gracePeriodEnd: '',
    ...params,
  };
}
