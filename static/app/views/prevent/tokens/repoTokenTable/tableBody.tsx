import styled from '@emotion/styled';

import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import TextCopyInput from 'sentry/components/textCopyInput';
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

  if (key === 'regenerateToken') {
    return (
      <Text align="right">
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
      </Text>
    );
  }

  const value = row[key];

  if (key === 'name') {
    return <Text>{value}</Text>;
  }

  if (key === 'token') {
    return (
      <Text>
        <StyledTextCopyInput>{value}</StyledTextCopyInput>
      </Text>
    );
  }

  return <Text>{value}</Text>;
}

export function renderTableBody(props: TableBodyProps) {
  return <TableBodyCell {...props} />;
}

const StyledButton = styled(Button)`
  max-width: 175px;
`;

const StyledTextCopyInput = styled(TextCopyInput)`
  input {
    padding: 0;
    border: none;
    box-shadow: none;
    &:focus-within {
      border: none;
      box-shadow: none;
    }
  }
`;
