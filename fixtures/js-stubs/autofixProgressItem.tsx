import {AutofixProgressItem} from 'sentry/components/events/aiAutofix/types';

export function AutofixProgressItemFixture(
  params: Partial<AutofixProgressItem>
): AutofixProgressItem {
  return {
    message: 'Example log message',
    timestamp: '2024-01-01T00:00:00',
    type: 'INFO',
    data: null,
    ...params,
  };
}
