import type {AutofixRootCauseSuggestedFix} from 'sentry/components/events/autofix/types';

export function AutofixRootCauseSuggestedFix(
  params: Partial<AutofixRootCauseSuggestedFix> = {}
): AutofixRootCauseSuggestedFix {
  return {
    id: '200',
    title: 'This is the title of a suggested fix.',
    description: 'This is the description of a suggested fix.',
    elegance: 0.8,
    snippet: {
      file_path: 'src/file.py',
      snippet: 'x = 1 + 1;',
    },
    ...params,
  };
}
