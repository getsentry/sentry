import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

interface EmptyStateProps {
  isError?: boolean;
  isLoading?: boolean;
  isTimedOut?: boolean;
  runId?: number | null;
}

export function EmptyState({
  isLoading = false,
  isError = false,
  isTimedOut = false,
  runId,
}: EmptyStateProps) {
  const runIdDisplay = runId?.toString() ?? 'null';
  return (
    <Container>
      {isTimedOut ? (
        <Fragment>
          <IconSeer size="xl" />
          <Text>{t('The request timed out. Please try again.')}</Text>
        </Fragment>
      ) : isError ? (
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

const Text = styled('div')`
  margin-top: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
  max-width: 300px;
`;
