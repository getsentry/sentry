import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

const SUGGESTED_QUESTIONS = [
  t('Which of my open issues are getting worse, not better?'),
  t('Are there any critical issues without an assigned owner or team?'),
  t('What are my slowest DB queries?'),
];

interface EmptyStateProps {
  isError?: boolean;
  isLoading?: boolean;
  onSuggestionClick?: (question: string) => void;
  runId?: number | null;
}

export function EmptyState({
  isLoading = false,
  isError = false,
  runId,
  onSuggestionClick,
}: EmptyStateProps) {
  const runIdDisplay = runId?.toString() ?? 'null';
  return (
    <Container>
      {isError ? (
        <Fragment>
          <IconSeer size="xl" />
          <Text>
            {tct('Error loading this session (ID=[runIdDisplay]).', {runIdDisplay})}
          </Text>
        </Fragment>
      ) : isLoading ? (
        <Fragment>
          <LoadingIndicator size={32} />
          <Text>{t('Ask Seer anything about your application.')}</Text>
        </Fragment>
      ) : (
        <Fragment>
          <IconSeer size="xl" animation="waiting" />
          <Text>{t('Ask Seer anything about your application.')}</Text>
          {onSuggestionClick && (
            <Flex direction="column" align="center" gap="md" paddingTop="2xl">
              {SUGGESTED_QUESTIONS.map(question => (
                <SuggestionButton
                  key={question}
                  size="sm"
                  onClick={() => onSuggestionClick(question)}
                >
                  {question}
                </SuggestionButton>
              ))}
            </Flex>
          )}
        </Fragment>
      )}
    </Container>
  );
}

const Container = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space['3xl']};
  text-align: center;
`;

const SuggestionButton = styled(Button)`
  height: 28px;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  line-height: 16px;
`;

const Text = styled('div')`
  margin-top: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
  max-width: 300px;
`;
