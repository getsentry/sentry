import {IntegrationProvider} from 'sentry/types';

export function VercelProvider(): IntegrationProvider {
  return {
    setupDialog: {
      url: '/organizations/sentry/integrations/vercel/setup/',
      width: 600,
      height: 600,
    },
    canAdd: true,
    canDisable: false,
    name: 'Vercel',
    key: 'vercel',
    features: ['deployment'],
    slug: 'vercel',
    metadata: {
      description: 'VERCEL DESC',
      features: [
        {
          featureGate: 'integrations-deployment',
          description: 'DEPLOYMENT DESCRIPTION',
          featureId: 2,
        },
      ],
      author: 'The Sentry Team',
      noun: 'Installation',
      issue_url:
        'https://github.com/getsentry/sentry/issues/new?template=bug.yml&title=Vercel%20Integration:%20&labels=Component%3A%20Integrations',
      source_url:
        'https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vercel',
      aspects: {},
    },
  };
}
