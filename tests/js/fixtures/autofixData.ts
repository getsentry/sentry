import {AutofixData} from 'sentry/components/events/autofix/types';

export function AutofixDataFixture(params: Partial<AutofixData>): AutofixData {
  return {
    run_id: '1',
    status: 'PROCESSING',
    completed_at: '',
    created_at: '',
    steps: [],
    ...params,
  };
}
