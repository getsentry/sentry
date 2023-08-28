import {IntegrationProvider} from 'sentry/types';

export function VstsIntegrationProvider(
  params: Partial<IntegrationProvider> = {}
): IntegrationProvider {
  return {
    key: 'vsts',
    name: 'VSTS',
    canAdd: true,
    features: [],
    slug: 'vsts',
    canDisable: false,
    metadata: {
      description: '*markdown* formatted VSTS _description_',
      features: [
        {description: '*markdown* feature description', featureGate: '', featureId: 2},
      ],
      author: 'Frank',
      noun: 'Instance',
      issue_url: 'http://example.com/vsts_issue_url',
      source_url: 'http://example.com/vsts_source_url',
      aspects: {},
    },
    setupDialog: {
      url: '/vsts-integration-setup-uri/',
      width: 100,
      height: 100,
    },
    ...params,
  };
}
