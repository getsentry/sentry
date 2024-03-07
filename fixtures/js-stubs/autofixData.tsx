import {AutofixData} from 'sentry/components/events/aiAutofix/types';

export function AutofixDataFixture(params: Partial<AutofixData>): AutofixData {
  return {
    status: 'PROCESSING',
    completed_at: '',
    created_at: '',
    steps: [],
    ...params,
  };
}
