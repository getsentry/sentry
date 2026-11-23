import {useState} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {openConfirmModal} from '@sentry/scraps/confirm';
import {DateTime} from '@sentry/scraps/dateTime';
import {EmptyState} from '@sentry/scraps/emptyState';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {openModal} from '@sentry/scraps/modal';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tn} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps} from 'sentry/utils/pagination';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useOrganization} from 'sentry/utils/useOrganization';
import {tokenPreview} from 'sentry/views/settings/organizationAuthTokens/tokenUtils';

import {CreateTokenModal} from './createTokenModal';
import {NewTokenModal} from './newTokenModal';
import {
  serviceAccountTokensApiOptions,
  useRevokeServiceAccountToken,
} from './serviceAccountApi';
import type {ServiceAccount, ServiceAccountToken} from './types';
import {useCannotManageReason} from './useServiceAccountAccess';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 1fr)'},
  {key: 'token', width: 'max-content'},
  {key: 'scopes', width: 'max-content'},
  {key: 'created', width: 'max-content'},
  {key: 'lastUsed', width: 'max-content'},
  {key: 'expires', width: 'max-content'},
  {key: 'actions', width: 'max-content'},
];

const EXPIRING_SOON_DAYS = 7;
const SERVICE_ACCOUNT_TOKEN_PREFIX = 'sntrym_';

function TokenScopes({
  token,
  accountScopes,
}: {
  accountScopes: string[];
  token: ServiceAccountToken;
}) {
  const scopeList = (
    <Stack gap="2xs">
      {token.scopes.map(scope => (
        <Text key={scope} size="sm" monospace>
          {scope}
        </Text>
      ))}
    </Stack>
  );
  const hasAccountScopes =
    accountScopes.length === token.scopes.length &&
    accountScopes.every(scope => token.scopes.includes(scope));
  return (
    <InfoText title={scopeList}>
      {hasAccountScopes
        ? t('Same as account')
        : tn('%s scope', '%s scopes', token.scopes.length)}
    </InfoText>
  );
}

function TokenExpiry({dateExpires}: {dateExpires: string | null}) {
  if (!dateExpires) {
    return <Text variant="muted">{t('Never')}</Text>;
  }
  const expires = moment(dateExpires);
  if (expires.isBefore(moment())) {
    return <Tag variant="danger">{t('Expired')}</Tag>;
  }
  if (expires.diff(moment(), 'days') < EXPIRING_SOON_DAYS) {
    return <Tag variant="warning">{capitalize(expires.fromNow())}</Tag>;
  }
  return (
    <Text>
      <DateTime date={dateExpires} mode="date" year="always" />
    </Text>
  );
}

export function ServiceAccountTokens({account}: {account: ServiceAccount}) {
  const organization = useOrganization();
  const cannotManageReason = useCannotManageReason(account);
  const [cursor, setCursor] = useState<string | undefined>();
  const {data, isPending, isError, refetch} = useQuery({
    ...serviceAccountTokensApiOptions(organization, account.id, {cursor}),
    select: selectJsonWithHeaders,
  });
  const tokens = data?.json ?? [];
  const revokeToken = useRevokeServiceAccountToken(organization, account.id);

  const openCreateToken = () =>
    openModal(deps => (
      <CreateTokenModal
        {...deps}
        account={account}
        onCreated={token =>
          // Clicking outside or pressing Escape would lose the only copy of the token.
          openModal(newTokenDeps => <NewTokenModal {...newTokenDeps} token={token} />, {
            closeEvents: 'none',
          })
        }
      />
    ));

  const confirmRevoke = (token: ServiceAccountToken) =>
    openConfirmModal({
      header: t('Revoke %s?', token.name),
      message: t(
        'Anything using %s stops working right away. You can’t undo this.',
        tokenPreview(token.tokenLastCharacters, SERVICE_ACCOUNT_TOKEN_PREFIX)
      ),
      confirmText: t('Revoke Token'),
      priority: 'danger',
      isDangerous: true,
      errorMessage: t('Unable to revoke token. Try again.'),
      onConfirm: () =>
        revokeToken.mutateAsync(token.id).then(() => {
          toast.success(t('Token revoked.'));
        }),
    });

  const disabledProps = cannotManageReason
    ? {disabled: true, tooltipProps: {title: cannotManageReason}}
    : {};

  const createButton = (
    <Button
      variant="primary"
      size="sm"
      icon={<IconAdd />}
      onClick={openCreateToken}
      {...disabledProps}
    >
      {t('Create Token')}
    </Button>
  );

  const hasTokens = tokens.length > 0;

  return (
    <Stack gap="lg">
      <Flex justify="between" align="center" gap="md">
        <Stack gap="xs">
          <Heading as="h3">{t('Access Tokens')}</Heading>
          <Text variant="muted">
            {t(
              'Use a token to call the Sentry API as this service account. A token can’t do more than its account.'
            )}
          </Text>
        </Stack>
        {hasTokens && createButton}
      </Flex>

      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Token')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Scopes')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Last used')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Expires')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell />
          </SimpleTable.HeaderRow>
        }
      >
        {isError && (
          <SimpleTable.Error message={t('Failed to load tokens.')} onRetry={refetch} />
        )}
        {!isError && isPending && <SimpleTable.Loading />}
        {!isError && !isPending && !hasTokens && (
          <SimpleTable.Empty>
            <EmptyState
              title={t('No tokens yet')}
              description={t(
                'Create a token to use this service account from CI, scripts or other tools.'
              )}
              action={createButton}
            />
          </SimpleTable.Empty>
        )}
        {tokens.map(token => (
          <SimpleTable.Row key={token.id}>
            <SimpleTable.RowCell>
              <Text bold ellipsis>
                {token.name}
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text variant="muted" monospace>
                {tokenPreview(token.tokenLastCharacters, SERVICE_ACCOUNT_TOKEN_PREFIX)}
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <TokenScopes token={token} accountScopes={account.scopes} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>
                <DateTime date={token.dateCreated} mode="date" year="always" />
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              {token.dateLastUsed ? (
                <TimeSince date={token.dateLastUsed} />
              ) : (
                <Text variant="muted">{t('Never')}</Text>
              )}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <TokenExpiry dateExpires={token.dateExpires} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Button
                size="sm"
                onClick={() => confirmRevoke(token)}
                aria-label={t('Revoke %s', token.name)}
                {...disabledProps}
              >
                {t('Revoke')}
              </Button>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </SimpleTable>
      <Pagination
        {...getPaginationProps(data?.headers.Link)}
        onCursor={nextCursor => setCursor(nextCursor)}
      />

      {hasTokens && (
        <Text size="sm" variant="muted">
          {t(
            'To rotate a token, create a new one, switch your tools to it, then revoke the old one.'
          )}
        </Text>
      )}
    </Stack>
  );
}
