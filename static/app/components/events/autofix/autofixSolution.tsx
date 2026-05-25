import type {AutofixSolutionTimelineEvent} from 'sentry/components/events/autofix/types';

export function formatSolutionText(
  solution: AutofixSolutionTimelineEvent[],
  customSolution?: string
) {
  if (!solution && !customSolution) {
    return '';
  }

  if (customSolution) {
    return `# Solution Plan\n\n${customSolution}`;
  }

  if (!solution || solution.length === 0) {
    return '';
  }

  const parts = ['# Solution Plan'];

  parts.push(
    solution
      .filter(event => event.is_active)
      .map((event, index) => {
        const eventParts = [`### ${index + 1}. ${event.title}`];

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

  return parts.join('\n\n');
}
