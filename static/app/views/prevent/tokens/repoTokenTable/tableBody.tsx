import styled from '@emotion/styled';

import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useRegenerateRepositoryToken} from 'sentry/views/prevent/tokens/repoTokenTable/hooks/useRegenerateRepositoryToken';
import {
  type Column,
  type Row,
} from 'sentry/views/prevent/tokens/repoTokenTable/repoTokenTable';

interface TableBodyProps {
  column: Column;
  row: Row;
}

function TableBodyCell({column, row}: TableBodyProps) {
  const organization = useOrganization();
  const {integratedOrgId} = usePreventContext();

  const {mutate: regenerateToken} = useRegenerateRepositoryToken();

  const key = column.key;
  const alignment = ['regenerateToken', 'token'].includes(key) ? 'right' : 'left';

  if (key === 'regenerateToken') {
    return (
      <AlignmentContainer alignment={alignment}>
        <Confirm
          onConfirm={() => {
            regenerateToken({
              orgSlug: organization.slug,
              integratedOrgId: integratedOrgId!,
              repository: row.name,
            });
          }}
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

  return <AlignmentContainer alignment={alignment}>{value}</AlignmentContainer>;
}

export function renderTableBody(props: TableBodyProps) {
  return <TableBodyCell {...props} />;
}

const StyledButton = styled(Button)`
  max-width: 175px;
`;

const AlignmentContainer = styled('div')<{alignment: string}>`
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
`;
