import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

type InvestigationSummaryCardProps = {
  summary: string | null;
  summaryDescription: string | null;
  className?: string;
  header?: React.ReactNode;
  label?: string | null;
  labelIcon?: React.ReactNode;
  suggestedNextSteps?: string | null;
};

export function InvestigationSummaryCard({
  className,
  header,
  label = t('Current understanding'),
  labelIcon,
  summary,
  summaryDescription,
  suggestedNextSteps = null,
}: InvestigationSummaryCardProps) {
  if (!summary && !summaryDescription && !suggestedNextSteps && !header) {
    return null;
  }

  return (
    <SummaryCard className={className} gap="md" data-test-id="investigation-summary">
      {header}
      {summary || summaryDescription ? (
        <Stack gap="lg">
          <Stack gap="xs">
            {label ? (
              <Flex align="center" gap="sm">
                {labelIcon}
                <Text size="sm" monospace bold>
                  {label}
                </Text>
              </Flex>
            ) : null}
            {summary ? (
              <Text size="lg" bold>
                {summary}
              </Text>
            ) : null}
            {summaryDescription ? (
              <SummaryDescription size="md">{summaryDescription}</SummaryDescription>
            ) : null}
          </Stack>
          {suggestedNextSteps ? (
            <Stack gap="xs" borderTop="primary" paddingTop="lg">
              <Text size="sm" variant="muted">
                {t('Suggested next steps')}
              </Text>
              <Text size="md">{suggestedNextSteps}</Text>
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </SummaryCard>
  );
}

const SummaryCard = styled(Stack)`
  position: relative;
  overflow: hidden;
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.lg};
`;

const SummaryDescription = styled(Text)`
  white-space: pre-line;
`;
