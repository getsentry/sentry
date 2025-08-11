import type {DocIntegration as DocIntegrationType} from 'sentry/types/integrations';

export function DocIntegrationFixture(
  params: Partial<DocIntegrationType>
): DocIntegrationType {
  return {
    name: 'hellboy',
    slug: 'hellboy',
    author: 'hellboy',
    description: 'no work just meow meow',
    url: 'https://www.meow.com',
    popularity: 8,
    isDraft: false,
    features: [
      {
        description:
          "Organizations can **open a line to Sentry's stack trace** in another service.",
        featureGate: 'integrations-stacktrace-link',
        featureId: 23,
      },
    ],
    ...params,
  };
}
