import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

type InvestigationSummaryCardProps = {
  summary: string | null;
  summaryDescription: string | null;
  className?: string;
};

/**
 * The investigation's conclusion: the summary as the first sentence, followed
 * by the description, in one paragraph.
 */
export function InvestigationSummaryCard({
  className,
  summary,
  summaryDescription,
}: InvestigationSummaryCardProps) {
  if (!summary || !summaryDescription) {
    return null;
  }

  // Seer writes the summary without a closing period and the description as
  // separate lines.
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
