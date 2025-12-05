import {Fragment} from 'react';
import styled from '@emotion/styled';

import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {DateTime} from 'sentry/components/dateTime';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {InternalAppApiToken} from 'sentry/types/user';
import {tokenPreview} from 'sentry/views/settings/organizationAuthTokens';

type Props = {
  onRemove: (token: InternalAppApiToken) => void;
  token: InternalAppApiToken;
  canEdit?: boolean;
  onRemoveConfirmMessage?: string;
  tokenPrefix?: string;
};

function ApiTokenRow({
  token,
  onRemove,
  tokenPrefix = '',
  canEdit = false,
  onRemoveConfirmMessage,
}: Props) {
  return (
    <Fragment>
      <div>
        {token.name}
        <TokenPreview aria-label={t('Token preview')}>
          {tokenPreview(token.tokenLastCharacters, tokenPrefix)}
        </TokenPreview>
      </div>
      <div>
        <DateTime date={token.dateCreated} />
      </div>
      <div>
        <ScopeList>{token.scopes.join(', ')}</ScopeList>
      </div>
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
              tokenPreview(token.tokenLastCharacters, tokenPrefix)
            )
          }
        >
          <Button size="sm" icon={<IconDelete />}>
            {t('Revoke')}
          </Button>
        </Confirm>
      </Actions>
    </Fragment>
  );
}

const ScopeList = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  max-width: 400px;
`;

const Actions = styled(ButtonBar)`
  justify-content: flex-end;
`;

const TokenPreview = styled('div')`
  color: ${p => p.theme.subText};
`;

export default ApiTokenRow;
