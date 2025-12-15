import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface EmptyStateProps {
  isLoading?: boolean;
}

function EmptyState({isLoading}: EmptyStateProps) {
  return (
    <Container>
      {isLoading ? (
        <LoadingIndicator size={32} />
      ) : (
        <IconSeer size="xl" animation="waiting" />
      )}
      <Text>{!isLoading && t('Ask Seer anything about your application.')}</Text>
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
  padding: ${space(4)};
  text-align: center;
`;

const Text = styled('div')`
  margin-top: ${space(2)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.4;
  max-width: 300px;
`;
