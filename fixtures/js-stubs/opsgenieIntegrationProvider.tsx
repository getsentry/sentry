import {IntegrationProvider} from 'sentry/types';

export function OpsgenieIntegrationProvider(
  params: Partial<IntegrationProvider> = {}
): IntegrationProvider {
  return {
    key: 'opsgenie',
    slug: 'opsgenie',
    name: 'Opsgenie (Integration)',
    metadata: {
      description: 'hi',
      features: [
        {description: '*markdown* feature description', featureGate: '', featureId: 3},
      ],
      author: 'The Sentry Team',
      noun: 'Installation',
      issue_url:
        'https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Integration%20Problem',
      source_url:
        'https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/opsgenie',
      aspects: {},
    },
    canAdd: true,
    canDisable: false,
    features: ['alert-rule', 'incident-management'],
    setupDialog: {
      url: '/organizations/sentry/integrations/opsgenie/setup/',
      width: 600,
      height: 600,
    },
    ...params,
  };
}
