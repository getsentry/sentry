import {AutofixData} from 'sentry/components/events/autofix/types';

export function AutofixDataFixture(params: Partial<AutofixData>): AutofixData {
  return {
    status: 'PROCESSING',
    completed_at: '',
    created_at: '',
    steps: [],
    ...params,
  };
}
