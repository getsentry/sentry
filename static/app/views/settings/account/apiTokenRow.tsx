import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';

import {Confirm} from 'sentry/components/confirm';
import {DateTime} from 'sentry/components/dateTime';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {InternalAppApiToken} from 'sentry/types/user';
import {tokenPreview} from 'sentry/views/settings/organizationAuthTokens';

type Props = {
  onRemove: (token: InternalAppApiToken) => void;
  token: InternalAppApiToken;
  canEdit?: boolean;
  onRemoveConfirmMessage?: string;
};

export function ApiTokenRow({
  token,
  onRemove,
  canEdit = false,
  onRemoveConfirmMessage,
}: Props) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        {token.name}
        <TokenPreview aria-label={t('Token preview')}>
          {tokenPreview(token.tokenLastCharacters)}
        </TokenPreview>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <DateTime date={token.dateCreated} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <ScopeList>{token.scopes.join(', ')}</ScopeList>
      </SimpleTable.RowCell>
      <Actions>
        {canEdit && (
          <LinkButton size="sm" to={`/settings/account/api/auth-tokens/${token.id}/`}>
            {t('Edit')}
          </LinkButton>
        )}
        <Confirm
          onConfirm={() => onRemove(token)}
          message={
            onRemoveConfirmMessage ||
            t(
              'Are you sure you want to revoke %s token? It will not be usable anymore, and this cannot be undone.',
              tokenPreview(token.tokenLastCharacters)
            )
          }
        >
          <Button size="sm" icon={<IconDelete />}>
            {t('Revoke')}
          </Button>
        </Confirm>
      </Actions>
    </SimpleTable.Row>
  );
}

const ScopeList = styled('div')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  max-width: 400px;
`;

const Actions = styled(SimpleTable.RowCell)`
  justify-content: flex-end;
  gap: ${p => p.theme.space.md};
`;

const TokenPreview = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
