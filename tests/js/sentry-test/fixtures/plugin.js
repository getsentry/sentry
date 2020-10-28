export function Plugin(params = {}) {
  return {
    author: {url: 'https://github.com/getsentry/sentry', name: 'Sentry Team'},
    enabled: false,
    isHidden: false,
    id: 'amazon-sqs',
    name: 'Amazon SQS',
    slug: 'amazon-sqs',
    version: '8.23.0.dev0',
    assets: [],
    hasConfiguration: true,
    canDisable: true,
    ...params,
  };
}
