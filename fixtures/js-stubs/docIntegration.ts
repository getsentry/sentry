import {type DocIntegration as TDocIntegration} from 'sentry/types';

export function DocIntegration(params = {}): TDocIntegration {
  return {
    name: 'Sample Doc',
    slug: 'sample-doc',
    author: 'The Sentry Team',
    url: 'https://example.com/sentry',
    popularity: 10,
    description: 'A helpful tutorial on how to setup this integration with Sentry',
    isDraft: false,
    features: [
      {
        featureId: 5,
        featureGate: 'incident-management',
        description:
          'Manage incidents and outages by sending Sentry notifications to Sample Doc.',
      },
      {
        featureId: 7,
        featureGate: 'alert-rule',
        description:
          'Configure Sentry rules to trigger notifications based on conditions you set through the Sentry webhook integration.',
      },
    ],
    resources: [
      {title: 'Documentation', url: 'https://example.com/sentry/docs'},
      {title: 'Support', url: 'https://example.com/sentry/support'},
      {title: 'Demo', url: 'https://example.com/sentry/demo'},
    ],
    ...params,
  };
}
