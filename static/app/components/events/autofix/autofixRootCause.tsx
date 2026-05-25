import type {AutofixRootCauseData} from 'sentry/components/events/autofix/types';

export function formatRootCauseText(
  cause: AutofixRootCauseData | undefined,
  customRootCause?: string
) {
  if (!cause && !customRootCause) {
    return '';
  }

  if (customRootCause) {
    return `# Root Cause of the Issue\n\n${customRootCause}`;
  }

  if (!cause) {
    return '';
  }

  const parts: string[] = ['# Root Cause of the Issue'];

  if (cause.description) {
    parts.push(cause.description);
  }

  if (cause.root_cause_reproduction) {
    parts.push(
      cause.root_cause_reproduction
        .map(event => {
          const eventParts = [`### ${event.title}`];

          if (event.code_snippet_and_analysis) {
            eventParts.push(event.code_snippet_and_analysis);
          }

          if (event.relevant_code_file) {
            eventParts.push(`(See @${event.relevant_code_file.file_path})`);
          }

          return eventParts.join('\n');
        })
        .join('\n\n')
    );
  }

  return parts.join('\n\n');
}
