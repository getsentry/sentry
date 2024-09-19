import { AutofixRootCauseCodeContext } from 'sentry-fixture/autofixRootCauseCodeContext';

import type { AutofixRootCauseData } from 'sentry/components/events/autofix/types';

export function AutofixRootCauseData(
  params: Partial<AutofixRootCauseData> = {}
): AutofixRootCauseData {
  return {
    id: '100',
    title: 'This is the title of a root cause.',
    description: 'This is the description of a root cause.',
    reproduction: 'This is the reproduction of a root cause.',
    code_context: [AutofixRootCauseCodeContext()],
    ...params,
  };
}
