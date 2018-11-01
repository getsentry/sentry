export function SentryApp(params = {}) {
  return {
    name: 'Sample App',
    slug: 'sample-app',
    scopes: ['project:read'],
    uuid: '123456123456123456123456',
    webhookUrl: 'https://example.com/webhook',
    redirectUrl: 'https://example/com/setup',
    clientID: 'client-id',
    clientSecret: 'client-secret',
    overview: 'This is an app.',
    ...params,
  };
}
