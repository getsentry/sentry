import type {IntegrationProvider} from 'sentry/types/integrations';

export function IntegrationProviderFixture(
  params: Partial<IntegrationProvider> = {}
): IntegrationProvider {
  return {
    key: 'generic-provider',
    slug: 'generic-provider',
    name: 'Generic Provider',
    canAdd: true,
    features: [],
    setupDialog: {
      url: '/generic-provider-setup-uri/',
      width: 100,
      height: 100,
    },
    canDisable: true,
    metadata: {
      description: 'A generic integration provider for testing',
      features: [
        {
          description: 'Feature description',
          featureGate: 'integrations-feature',
          featureId: 1,
        },
      ],
      author: 'Test',
      noun: 'Installation',
      issue_url: 'http://example.com/issue_url',
      source_url: 'http://example.com/source_url',
      aspects: {},
    },
    ...params,
  };
}
