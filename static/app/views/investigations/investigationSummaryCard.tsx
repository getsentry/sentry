import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

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
    <Stack className={className} gap="md" data-test-id="investigation-summary">
      <Text size="sm" variant="muted" bold>
        {t('Investigation conclusion')}
      </Text>
      <Stack gap="xs">
        <SummaryTitle as="h2" size="xl" tabular>
          {summary}
        </SummaryTitle>
        <Text size="md" density="comfortable" tabular>
          {summaryDescription}
        </Text>
      </Stack>
    </Stack>
  );
}

const SummaryTitle = styled(Heading)`
  color: ${p => p.theme.tokens.content.headings};
`;
