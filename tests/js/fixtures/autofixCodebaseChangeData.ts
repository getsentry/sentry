import { AutofixDiffFilePatch } from 'sentry-fixture/autofixDiffFilePatch';

import type { AutofixCodebaseChange } from 'sentry/components/events/autofix/types';

export function AutofixCodebaseChangeData(
  params: Partial<AutofixCodebaseChange> = {}
): AutofixCodebaseChange {
  return {
    description: '',
    diff: [AutofixDiffFilePatch()],
    repo_external_id: "100",
    repo_name: 'owner/hello-world',
    title: 'Add error handling',
    pull_request: { pr_number: 200, pr_url: 'https://github.com/owner/hello-world/pull/200' },
    ...params,
  };
}
