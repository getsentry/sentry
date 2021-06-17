export function SentryAppWebhookRequest(params = {}) {
  return {
    webhookUrl: 'https://example.com/webhook',
    sentryAppSlug: 'sample-app',
    eventType: 'issue.assigned',
    date: '2019-09-25T23:54:54.440Z',
    organization: {
      slug: 'test-org',
      name: 'Test Org',
    },
    responseCode: 400,

    ...params,
  };
}
