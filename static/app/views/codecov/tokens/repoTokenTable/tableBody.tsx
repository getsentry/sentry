import styled from '@emotion/styled';

import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {t, tct} from 'sentry/locale';
import {
  type Column,
  type Row,
} from 'sentry/views/codecov/tokens/repoTokenTable/repoTokenTable';

interface TableBodyProps {
  column: Column;
  row: Row;
}

export function renderTableBody({column, row}: TableBodyProps) {
  const key = column.key;
  const alignment = ['regenerateToken', 'token'].includes(key) ? 'right' : 'left';

  if (key === 'regenerateToken') {
    return (
      <AlignmentContainer alignment={alignment}>
        <Confirm
          onConfirm={() => {}}
          header={<h5>{t('Generate new token')}</h5>}
          cancelText={t('Return')}
          confirmText={t('Generate new token')}
          isDangerous
          message={tct(
            `Are you sure you want to generate a new token for [repoName]? [break][break] If you create a new token, make sure to update the repository secret in GitHub. [break] [break]`,
            {
              repoName: <strong>{row.name}</strong>,
              break: <br />,
            }
          )}
        >
          <StyledButton priority="default" size="sm" aria-label="regenerate token">
            {t('Regenerate token')}
          </StyledButton>
        </Confirm>
      </AlignmentContainer>
    );
  }

  const value = row[key];

  if (key === 'name') {
    return <AlignmentContainer alignment={alignment}>{value}</AlignmentContainer>;
  }

  if (key === 'token') {
    return <AlignmentContainer alignment={alignment}>{value}</AlignmentContainer>;
  }

  if (key === 'createdAt') {
    return <DateContainer>{value}</DateContainer>;
  }

  return <AlignmentContainer alignment={alignment}>{value}</AlignmentContainer>;
}

const StyledButton = styled(Button)`
  max-width: 175px;
`;

export const AlignmentContainer = styled('div')<{alignment: string}>`
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
`;

const DateContainer = styled('div')`
  color: ${p => p.theme.tokens.content.muted};
  text-align: 'left';
`;
