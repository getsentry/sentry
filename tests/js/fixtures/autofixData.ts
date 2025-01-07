import { AutofixData, AutofixStatus } from 'sentry/components/events/autofix/types';

export function AutofixDataFixture(params: Partial<AutofixData>): AutofixData {
  return {
    run_id: '1',
    status: AutofixStatus.PROCESSING,
    completed_at: '',
    created_at: '',
    steps: [],
    repositories: [],
    ...params,
  };
}
