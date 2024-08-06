import type { AutofixRootCauseCodeContext } from 'sentry/components/events/autofix/types';

export function AutofixRootCauseCodeContext(
  params: Partial<AutofixRootCauseCodeContext> = {}
): AutofixRootCauseCodeContext {
  return {
    id: '200',
    title: 'This is the title of a relevant code snippet.',
    description: 'This is the description of a relevant code snippet.',
    snippet: {
      file_path: 'src/file.py',
      snippet: 'x = 1 + 1;',
      repo_name: 'owner/repo'
    },
    ...params,
  };
}
