export function SentryAppWebhookRequest(params = {}) {
  return {
    webhook_url: 'https://example.com/webhook',
    sentry_app_slug: 'sample-app',
    event_type: 'issue.assigned',
    date: '2019-09-25T23:54:54.440Z',
    organization: {
      slug: 'test-org',
      name: 'Test Org',
    },
    response_code: 400,

    ...params,
  };
}
