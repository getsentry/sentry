export function SentryApp(params = {}) {
  return {
    name: 'Sample App',
    author: 'Sentry',
    slug: 'sample-app',
    scopes: ['project:read'],
    events: [],
    status: 'unpublished',
    uuid: '123456123456123456123456',
    webhookUrl: 'https://example.com/webhook',
    redirectUrl: 'https://example/com/setup',
    isAlertable: false,
    clientId: 'client-id',
    clientSecret: 'client-secret',
    overview: 'This is an app.',
    schema: {},
    ...params,
  };
}
