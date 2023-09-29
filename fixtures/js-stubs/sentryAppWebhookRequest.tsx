import {SentryAppWebhookRequest as SentryAppWebhookRequestType} from 'sentry/types';

export function SentryAppWebhookRequest(
  params: Partial<SentryAppWebhookRequestType> = {}
): SentryAppWebhookRequestType {
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
