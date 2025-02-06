import type { AutofixRootCauseData } from 'sentry/components/events/autofix/types';

export function AutofixRootCauseData(
  params: Partial<AutofixRootCauseData> = {}
): AutofixRootCauseData {
  return {
    id: '100',
    root_cause_reproduction: [
      {
        code_snippet_and_analysis: 'This is the code snippet and analysis of a root cause.',
        relevant_code_file: {
          file_path: 'src/file.py',
          repo_name: 'owner/repo',
        },
        timeline_item_type: 'internal_code',
        title: 'This is the title of a root cause.',
        is_most_important_event: true,
      },
    ],
    ...params,
  };
}
