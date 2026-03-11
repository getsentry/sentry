import {Fragment} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

interface EmptyStateProps {
  isError?: boolean;
  isLoading?: boolean;
  runId?: number | null;
}

function EmptyState({isLoading = false, isError = false, runId}: EmptyStateProps) {
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
        </Fragment>
      )}
    </Container>
  );
}

export default EmptyState;

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
