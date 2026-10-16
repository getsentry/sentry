import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconSeer} from '@sentry/icons/seer';

import {Button} from '@sentry/scraps/button';
import {Container as LayoutContainer, Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {ChatSuggestionsState} from 'sentry/views/seerExplorer/hooks/useChatSuggestions';
import type {ChatSuggestion, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

const SUGGESTION_PLACEHOLDER_COUNT = 3;

interface EmptyStateProps {
  displaySlackAgentReminder?: boolean;
  errorStatusCode?: number | null;
  /** The conversation could not be loaded: the request failed, or it came back errored. */
  isError?: boolean;
  isLoading?: boolean;
  /** Resets to a fresh session. Rendered as the recovery action on error states. */
  onStartNewChat?: () => void;
  onSuggestionClick?: (suggestion: ChatSuggestion, position: number) => void;
  runId?: SeerExplorerRunId | null;
  suggestions?: ChatSuggestionsState;
}

export function EmptyState({
  isLoading = false,
  isError = false,
  errorStatusCode = null,
  displaySlackAgentReminder = false,
  runId,
  onStartNewChat,
  onSuggestionClick,
  suggestions,
}: EmptyStateProps) {
  const theme = useTheme();
  const runIdDisplay = runId?.toString() ?? 'null';
  return (
    <Container
      flex="1"
      align="center"
      justify="center"
      padding={{zero: 'xl', '2xs': '3xl'}}
    >
      {isError ? (
        // Checked before `isLoading`: a failed load can still be polling with
        // backoff, and a spinner there would sit next to a disabled composer
        // with no way out.
        <Fragment>
          <IconSeer size="xl" />
          <Text>
            {errorStatusCode === 404
              ? tct('Session not found (run_id=[runIdDisplay]).', {
                  runIdDisplay,
                })
              : t('There was a problem loading the conversation.')}
          </Text>
          {onStartNewChat && (
            // The composer is disabled on this screen: sending would post into the
            // run that just failed rather than open a fresh one, so this is the way out.
            <Text>
              <Button variant="link" size="zero" onClick={onStartNewChat}>
                {t('Start a new chat')}
              </Button>
            </Text>
          )}
        </Fragment>
      ) : isLoading ? (
        <Fragment>
          <LoadingIndicator size={32} />
          <Text>{t('Ask Seer anything about your application.')}</Text>
        </Fragment>
      ) : (
        <Fragment>
          <IconSeer size="xl" animation="idle" />
          <Text>{t('Ask Seer anything about your application.')}</Text>
          {onSuggestionClick && suggestions && (
            <Stack
              align="center"
              gap="md"
              paddingTop="2xl"
              aria-hidden={suggestions.isLoading || undefined}
            >
              {suggestions.isLoading
                ? Array.from({length: SUGGESTION_PLACEHOLDER_COUNT}, (_, index) => (
                    <Placeholder
                      key={index}
                      width="240px"
                      height={theme.form.sm.height}
                      testId="suggestion-placeholder"
                    />
                  ))
                : suggestions.suggestions.map((suggestion, index) => (
                    <LayoutContainer
                      key={index}
                      flexGrow={{zero: 1, sm: 0}}
                      width={{zero: '100%', sm: 'auto'}}
                    >
                      <SuggestionButton
                        size="sm"
                        onClick={() => onSuggestionClick(suggestion, index)}
                      >
                        {suggestion.text}
                      </SuggestionButton>
                    </LayoutContainer>
                  ))}
            </Stack>
          )}
          {displaySlackAgentReminder && (
            <Text>
              {t('Want to chat in Slack? Just @ Sentry to debug and investigate issues.')}
            </Text>
          )}
        </Fragment>
      )}
    </Container>
  );
}

const Container = styled(Stack)`
  text-align: center;
`;

const SuggestionButton = styled(Button)`
  width: 100%;
  height: auto;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  line-height: 16px;

  > span:last-child {
    white-space: normal;
    text-wrap: balance;
  }
`;

const Text = styled('div')`
  margin-top: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
  max-width: 300px;
`;
