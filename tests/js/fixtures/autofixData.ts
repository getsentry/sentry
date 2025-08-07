import type {AutofixData} from 'sentry/components/events/autofix/types';
import {AutofixStatus} from 'sentry/components/events/autofix/types';

export function AutofixDataFixture(params: Partial<AutofixData>): AutofixData {
  return {
    run_id: '1',
    status: AutofixStatus.PROCESSING,
    completed_at: '',
    last_triggered_at: '',
    steps: [],
    request: {
      repos: [],
    },
    codebases: {},
    ...params,
  };
}
