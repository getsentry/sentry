import styled from '@emotion/styled';

import {openTokenRegenerationConfirmationModal} from 'sentry/actionCreators/modal';
import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {t, tct} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  type Column,
  type Row,
} from 'sentry/views/codecov/tokens/repoTokenTable/repoTokenTable';

interface TableBodyProps {
  column: Column;
  row: Row;
}

async function regenerateRepositoryToken(
  api: ReturnType<typeof useApi>,
  orgSlug: string,
  integratedOrgId: string | undefined,
  repository: string | undefined
): Promise<string> {
  const result = await api.requestPromise(
    `/organizations/${orgSlug}/prevent/owner/${integratedOrgId}/repository/${repository}/token/regenerate/`,
    {
      method: 'POST',
    }
  );

  return result.token;
}

function TableBodyCell({column, row}: TableBodyProps) {
  const api = useApi();
  const organization = useOrganization();
  const {integratedOrgId, repository} = useCodecovContext();

  const key = column.key;
  const alignment = ['regenerateToken', 'token'].includes(key) ? 'right' : 'left';

  if (key === 'regenerateToken') {
    return (
      <AlignmentContainer alignment={alignment}>
        <Confirm
          onConfirm={async () => {
            try {
              // Trigger the regeneration
              const newToken = await regenerateRepositoryToken(
                api,
                organization.slug,
                integratedOrgId,
                repository
              );

              // Open modal with the new token
              openTokenRegenerationConfirmationModal({token: newToken});
            } catch (error) {
              // TODO: Handle error (show toast notification, etc.)
              // eslint-disable-next-line no-console
              console.error('Failed to regenerate token:', error);
            }
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

export const AlignmentContainer = styled('div')<{alignment: string}>`
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
`;
