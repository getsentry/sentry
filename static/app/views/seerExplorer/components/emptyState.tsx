import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

const SUGGESTED_QUESTIONS = [
  t('Which of my open issues are getting worse, not better?'),
  t('What are my slowest DB queries?'),
  t("Walk me through what's on my screen and what I can focus on next."),
];

interface EmptyStateProps {
  displaySlackAgentReminder?: boolean;
  errorStatusCode?: number | null;
  isError?: boolean;
  isLoading?: boolean;
  onSuggestionClick?: (question: string) => void;
  runId?: SeerExplorerRunId | null;
}

export function EmptyState({
  isLoading = false,
  isError = false,
  errorStatusCode = null,
  displaySlackAgentReminder = false,
  runId,
  onSuggestionClick,
}: EmptyStateProps) {
  const runIdDisplay = runId?.toString() ?? 'null';
  return (
    <Flex
      flex={1}
      direction="column"
      align="center"
      justify="center"
      gap="xl"
      padding={{'2xs': 'xl', xs: '3xl'}}
    >
      {isLoading ? (
        <Fragment>
          <LoadingIndicator size={32} />
          <Container maxWidth={300}>
            <Text as="div" variant="muted" size="md" align="center">
              {t('Ask Seer anything about your application.')}
            </Text>
          </Container>
        </Fragment>
      ) : isError ? (
        <Fragment>
          <IconSeer size="xl" />
          <Container maxWidth={300}>
            <Text as="div" variant="muted" size="md" align="center">
              {errorStatusCode === 404
                ? tct('Session not found (run_id=[runIdDisplay]).', {
                    runIdDisplay,
                  })
                : tct(`Error loading this session (run_id=[runIdDisplay]).`, {
                    runIdDisplay,
                  })}
            </Text>
          </Container>
        </Fragment>
      ) : (
        <Fragment>
          <IconSeer size="xl" animation="waiting" />
          <Container maxWidth={300}>
            <Text as="div" variant="muted" size="md" align="center">
              {t('Ask Seer anything about your application.')}
            </Text>
          </Container>
          {onSuggestionClick && (
            <Flex direction="column" align="center" gap="md">
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
          {displaySlackAgentReminder && (
            <Container maxWidth={300}>
              <Text as="div" variant="muted" size="md" align="center">
                {t(
                  'Want to chat in Slack? Just @ Sentry to debug and investigate issues.'
                )}
              </Text>
            </Container>
          )}
        </Fragment>
      )}
    </Flex>
  );
}

const SuggestionButton = styled(Button)`
  height: auto;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  line-height: 16px;

  > span:last-child {
    white-space: normal;
    text-wrap: balance;
  }

  @container seer-explorer-root (max-width: 500px) {
    flex-grow: 1;
    width: 100%;
  }
`;
