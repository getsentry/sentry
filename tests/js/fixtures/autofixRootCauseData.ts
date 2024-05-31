import {AutofixRootCauseSuggestedFix} from 'sentry-fixture/autofixRootCauseSuggestedFix';

import type {AutofixRootCauseData} from 'sentry/components/events/autofix/types';

export function AutofixRootCauseData(
  params: Partial<AutofixRootCauseData> = {}
): AutofixRootCauseData {
  return {
    id: '100',
    title: 'This is the title of a root cause.',
    description: 'This is the description of a root cause.',
    actionability: 0.8,
    likelihood: 0.9,
    suggested_fixes: [AutofixRootCauseSuggestedFix()],
    ...params,
  };
}
