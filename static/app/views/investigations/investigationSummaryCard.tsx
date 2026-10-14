import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

type InvestigationSummaryCardProps = {
  summary: string | null;
  summaryDescription: string | null;
  className?: string;
};

/**
 * The answer, at the top of a finished investigation. The short summary leads
 * as the first sentence and the description lines follow it in one paragraph,
 * so the conclusion reads as prose rather than a headline over a caption.
 */
export function InvestigationSummaryCard({
  className,
  summary,
  summaryDescription,
}: InvestigationSummaryCardProps) {
  if (!summary || !summaryDescription) {
    return null;
  }

  // Seer writes the description as separate lines, and the summary as a
  // phrase with no closing punctuation.
  const paragraph = [summary, ...summaryDescription.split('\n')]
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .map(sentence => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`))
    .join(' ');

  return (
    <Stack
      as="section"
      className={className}
      gap="lg"
      data-test-id="investigation-summary"
    >
      <Heading as="h2" size="lg">
        {t('Summary')}
      </Heading>
      <Text as="p" size="md" density="comfortable" tabular>
        {paragraph}
      </Text>
    </Stack>
  );
}
