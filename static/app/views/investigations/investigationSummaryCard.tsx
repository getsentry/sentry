import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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
    <SummaryCard className={className} gap="xs" data-test-id="investigation-summary">
      <Text size="md" variant="muted">
        {t('Current understanding')}
      </Text>
      <Text size="lg" bold>
        {summary}
      </Text>
      <SummaryDescription size="md">{summaryDescription}</SummaryDescription>
    </SummaryCard>
  );
}

const SummaryCard = styled(Stack)`
  position: relative;
  overflow: hidden;
  padding: ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.tokens.border.accent.muted};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.shadow.low};

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: ${p => p.theme.tokens.background.accent.vibrant};
  }
`;

const SummaryDescription = styled(Text)`
  white-space: pre-line;
`;
