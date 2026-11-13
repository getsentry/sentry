import {IconAdd} from '@sentry/icons/add';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {openConfirmModal} from '@sentry/scraps/confirm';
import {EmptyState} from '@sentry/scraps/emptyState';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {openModal} from '@sentry/scraps/modal';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import {tokenPreview} from 'sentry/views/settings/organizationAuthTokens/tokenUtils';

import {CreateTokenModal} from './createTokenModal';
import {
  serviceAccountTokensOptions,
  useRevokeServiceAccountToken,
} from './mockServiceAccountApi';
import {NewTokenModal} from './newTokenModal';
import {SCOPE_RESOURCES, type ScopeResource} from './serviceAccountData';
import type {ServiceAccount, ServiceAccountToken} from './types';
import {useServiceAccountAccess} from './useServiceAccountAccess';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(0, 1fr)'},
  {key: 'token', width: 'max-content'},
  {key: 'scopes', width: 'minmax(0, 1.5fr)'},
  {key: 'created', width: 'max-content'},
  {key: 'lastUsed', width: 'max-content'},
  {key: 'expires', width: 'max-content'},
  {key: 'actions', width: 'max-content'},
];

const EXPIRING_SOON_DAYS = 7;
const TOKEN_PREFIX = 'sntrym_';

type TokenResourceAccess = {label: string; resource: ScopeResource};

/** Groups scopes by resource, e.g. "Source Maps: Read & Write". */
function describeByResource(scopes: string[]): TokenResourceAccess[] {
  return SCOPE_RESOURCES.flatMap(resource => {
    const granted = resource.scopes.filter(scope => scopes.includes(scope.scope));
    if (granted.length === 0) {
      return [];
    }
    const canRead = granted.some(scope => scope.action === 'read');
    const canWrite = granted.some(scope => scope.action !== 'read');
    const label =
      canRead && canWrite ? t('Read & Write') : canWrite ? t('Write') : t('Read');
    return [{resource, label}];
  });
}

function ResourceAccessList({items}: {items: TokenResourceAccess[]}) {
  return (
    <Stack gap="2xs">
      {items.map(({resource, label}) => (
        <Text key={resource.id} size="sm">
          {t('%s: %s', resource.label, label)}
        </Text>
      ))}
    </Stack>
  );
}

function TokenAccess({
  token,
  accountScopes,
}: {
  accountScopes: string[];
  token: ServiceAccountToken;
}) {
  const usable = token.scopes.filter(scope => accountScopes.includes(scope));
  const revoked = describeByResource(
    token.scopes.filter(scope => !accountScopes.includes(scope))
  );
  const hasFullAccess = accountScopes.every(scope => usable.includes(scope));
  const usableByResource = describeByResource(usable);

  return (
    <Flex gap="sm" align="center" wrap="wrap">
      {hasFullAccess ? (
        <Text>{t('Same as account')}</Text>
      ) : (
        <InfoText title={<ResourceAccessList items={usableByResource} />}>
          {tn(
            'Limited to %s resource',
            'Limited to %s resources',
            usableByResource.length
          )}
        </InfoText>
      )}
      {revoked.length > 0 && (
        <Tooltip
          title={
            <Stack gap="sm">
              <Text size="sm">
                {t("The account no longer has this access, so this token can't use it:")}
              </Text>
              <ResourceAccessList items={revoked} />
            </Stack>
          }
        >
          <Tag variant="warning">{t('Partly outdated')}</Tag>
        </Tooltip>
      )}
    </Flex>
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
    const relative = expires.fromNow();
    return (
      <Tag variant="warning">{relative.charAt(0).toUpperCase() + relative.slice(1)}</Tag>
    );
  }
  return (
    <Text>
      <DateTime date={dateExpires} dateOnly year />
    </Text>
  );
}

export function ServiceAccountTokens({account}: {account: ServiceAccount}) {
  const {canWrite, hasGlobalRole, noWriteReason} = useServiceAccountAccess();
  const {
    data: tokens,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountTokensOptions(account.id));
  const revokeToken = useRevokeServiceAccountToken(account.id);

  const createDisabledReason = canWrite
    ? account.allProjects && !hasGlobalRole
      ? t(
          'This account can access all projects, so only a Manager or Owner can create tokens for it.'
        )
      : null
    : noWriteReason;

  const openCreateToken = () =>
    openModal(deps => (
      <CreateTokenModal
        {...deps}
        account={account}
        onCreated={token =>
          openModal(
            newTokenDeps => <NewTokenModal {...newTokenDeps} token={token.token} />,
            {
              closeEvents: 'none',
            }
          )
        }
      />
    ));

  const confirmRevoke = (token: ServiceAccountToken) =>
    openConfirmModal({
      header: t('Revoke "%s"?', token.name),
      message: (
        <Text as="p">
          {t(
            'Anything using %s will stop working within a few seconds.',
            tokenPreview(token.tokenLastCharacters, TOKEN_PREFIX)
          )}{' '}
          {token.dateLastUsed &&
            moment().diff(moment(token.dateLastUsed), 'days') < EXPIRING_SOON_DAYS &&
            tct('Last used [time].', {
              time: <TimeSince date={token.dateLastUsed} />,
            })}{' '}
          {t("You can't undo this.")}
        </Text>
      ),
      confirmText: t('Revoke Token'),
      priority: 'danger',
      isDangerous: true,
      onConfirm: () =>
        revokeToken.mutateAsync(token.id).then(() => {
          toast.success(t('Token revoked.'));
        }),
    });

  const createButton = (
    <Button
      variant="primary"
      size="sm"
      icon={<IconAdd />}
      onClick={openCreateToken}
      disabled={!!createDisabledReason}
      tooltipProps={createDisabledReason ? {title: createDisabledReason} : undefined}
    >
      {t('Create Token')}
    </Button>
  );

  const hasTokens = !!tokens?.length;

  return (
    <Stack gap="lg">
      <Flex justify="between" align="center" gap="md">
        <Stack gap="xs">
          <Heading as="h3">{t('Access Tokens')}</Heading>
          <Text variant="muted">
            {t(
              'Use tokens to call the Sentry API as this service account. Requests never act as the person who created the token.'
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
            <SimpleTable.HeaderCell>{t('Access')}</SimpleTable.HeaderCell>
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
        {tokens?.map(token => (
          <SimpleTable.Row key={token.id}>
            <SimpleTable.RowCell>
              <Text bold ellipsis>
                {token.name}
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text variant="muted" aria-label={t('Token preview')}>
                {tokenPreview(token.tokenLastCharacters, TOKEN_PREFIX)}
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <TokenAccess token={token} accountScopes={account.scopes} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Stack gap="2xs">
                <Text>
                  <DateTime date={token.dateCreated} dateOnly year />
                </Text>
                <Text size="sm" variant="muted">
                  {token.createdBy.name}
                </Text>
              </Stack>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              {token.dateLastUsed ? (
                <TimeSince
                  date={token.dateLastUsed}
                  tooltipBody={t('Updated about every few minutes.')}
                />
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
                disabled={!canWrite}
                tooltipProps={canWrite ? undefined : {title: noWriteReason}}
                aria-label={t('Revoke %s', token.name)}
              >
                {t('Revoke')}
              </Button>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </SimpleTable>

      {hasTokens && (
        <Text size="sm" variant="muted">
          {t(
            'To rotate, create a new token, switch your tools to it, then revoke the old one.'
          )}
        </Text>
      )}
    </Stack>
  );
}
