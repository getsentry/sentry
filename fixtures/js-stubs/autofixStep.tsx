import {AutofixStep} from 'sentry/components/events/autofix/types';

export function AutofixStepFixture(params: Partial<AutofixStep>): AutofixStep {
  return {
    id: '1',
    index: 1,
    title: 'I am processing',
    status: 'PROCESSING',
    progress: [],
    ...params,
  };
}
