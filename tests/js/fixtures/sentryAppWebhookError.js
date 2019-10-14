export function SentryAppWebhookError(params = {}) {
  return {
    app: {
      slug: 'sample-app',
      name: 'Sample App',
      uuid: 'b468fed3-afba-4917-80d6-bdac99c1ec05',
    },
    date: '2019-09-25T23:54:54.440Z',
    organization: {
      slug: 'test-org',
      name: 'Test Org',
    },
    errorId: null,
    request: {
      body: {},
      headers: {},
    },
    eventType: 'issue.assigned',
    webhookUrl: 'https://example.com/webhook',
    response: {
      body: 'This is an error',
      statusCode: 400,
    },
    ...params,
  };
}
