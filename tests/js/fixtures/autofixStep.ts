import {
  AutofixDefaultStep,
  AutofixStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';

export function AutofixStepFixture(params: Partial<AutofixStep> = {}): AutofixStep {
  return {
    type: AutofixStepType.DEFAULT,
    id: '1',
    index: 1,
    title: 'I am processing',
    status: 'PROCESSING',
    progress: [],
    insights: [],
    ...params,
  } as AutofixDefaultStep;
}
