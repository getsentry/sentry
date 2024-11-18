import type {Plugin} from 'sentry/types/integrations';

export function PluginFixture(params: Partial<Plugin> = {}): Plugin {
  return {
    author: {url: 'https://github.com/getsentry/sentry', name: 'Sentry Team'},
    enabled: false,
    isHidden: false,
    id: 'amazon-sqs',
    name: 'Amazon SQS',
    slug: 'amazon-sqs',
    version: '8.23.0.dev0',
    hasConfiguration: true,
    canDisable: true,
    contexts: [],
    doc: '',
    featureDescriptions: [],
    features: [],
    isDeprecated: false,
    isTestable: false,
    metadata: {},
    shortName: '',
    status: '',
    type: '',
    ...params,
  };
}
