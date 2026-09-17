import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

type InvestigationSummaryCardProps = {
  summary: string | null;
  summaryDescription: string | null;
  className?: string;
};

export function InvestigationSummaryCard({
  className,
  summary,
  summaryDescription,
}: InvestigationSummaryCardProps) {
  if (!summary || !summaryDescription) {
    return null;
  }

  return (
    <Stack className={className} gap="xs" data-test-id="investigation-summary">
      <SummaryTitle as="h2" size="xl" tabular>
        {summary}
      </SummaryTitle>
      <Text size="md" density="comfortable" tabular wrap="pre-line">
        {summaryDescription}
      </Text>
    </Stack>
  );
}

const SummaryTitle = styled(Heading)`
  color: ${p => p.theme.tokens.content.headings};
`;
