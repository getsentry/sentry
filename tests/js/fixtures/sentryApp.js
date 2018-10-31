export function SentryApp(params = {}) {
  return {
    name: 'Sample App',
    slug: 'sample-app',
    scopes: [],
    uuid: '123456123456123456123456',
    webhook_url: 'https://example.com/webhook',
    redirect_url: 'https://example/com/setup',
    clientID: 'client-id',
    clientSecret: 'client-secret',
    overview: 'This is an app.',
    ...params,
  };
}
