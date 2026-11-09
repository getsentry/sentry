import {IconAdd} from '@sentry/icons/add';
import {IconDelete} from '@sentry/icons/delete';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {DisplayField} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {tokenPreview} from 'sentry/views/settings/organizationAuthTokens/tokenUtils';

import {ScopeSummary} from './index';
import type {ServiceAccount, ServiceAccountToken} from './types';

// Matches AuthTokenType.SERVICE_ACCOUNT in src/sentry/types/token.py.
const SERVICE_ACCOUNT_TOKEN_PREFIX = 'sntrym_';

const TOKEN_COLUMNS: TableColumnConfig[] = [
  {key: 'token', width: 'minmax(0, 1fr)'},
  {key: 'permissions', width: 'max-content'},
  {key: 'created', width: 'max-content'},
  {key: 'lastUsed', width: 'max-content'},
  {key: 'actions', width: 'max-content'},
];

type ServiceAccountParams = {orgSlug: string; serviceAccountId: string};

export const serviceAccountOptions = ({
  orgSlug,
  serviceAccountId,
}: ServiceAccountParams) =>
  apiOptions.as<ServiceAccount>()(
    '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/',
    {
      path: {organizationIdOrSlug: orgSlug, serviceAccountId},
      staleTime: 0,
    }
  );

export const serviceAccountTokensOptions = ({
  orgSlug,
  serviceAccountId,
}: ServiceAccountParams) =>
  apiOptions.as<ServiceAccountToken[]>()(
    '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/tokens/',
    {
      path: {organizationIdOrSlug: orgSlug, serviceAccountId},
      staleTime: 0,
    }
  );

function ProjectAccessList({serviceAccount}: {serviceAccount: ServiceAccount}) {
  const {projects} = useProjects();

  if (serviceAccount.allProjects) {
    return <Text>{t('All projects')}</Text>;
  }
  if (serviceAccount.projectIds.length === 0) {
    return <Text variant="muted">{t('No projects')}</Text>;
  }
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const slugs = serviceAccount.projectIds.map(id => projectsById.get(id)?.slug ?? id);
  return <Text wordBreak="break-word">{slugs.join(', ')}</Text>;
}

function ServiceAccountSummary({serviceAccount}: {serviceAccount: ServiceAccount}) {
  return (
    <Panel>
      <PanelHeader>{t('Service Account')}</PanelHeader>
      <PanelBody>
        <DisplayField.Row label={t('Permissions')} padding="xl">
          <Text wordBreak="break-word">
            {serviceAccount.scopes.length > 0
              ? serviceAccount.scopes.join(', ')
              : t('No permissions')}
          </Text>
        </DisplayField.Row>
        <DisplayField.Row label={t('Project access')} padding="xl">
          <ProjectAccessList serviceAccount={serviceAccount} />
        </DisplayField.Row>
        <DisplayField.Row label={t('Created')} padding="xl">
          <Text>
            <TimeSince date={serviceAccount.dateCreated} />
          </Text>
        </DisplayField.Row>
      </PanelBody>
    </Panel>
  );
}

function TokenRow({
  token,
  canRevoke,
  isRevoking,
  onRevoke,
}: {
  canRevoke: boolean;
  isRevoking: boolean;
  onRevoke: (token: ServiceAccountToken) => void;
  token: ServiceAccountToken;
}) {
  const preview = tokenPreview(token.tokenLastCharacters, SERVICE_ACCOUNT_TOKEN_PREFIX);

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell direction="column" align="start">
        <Text bold wordBreak="break-word">
          {token.name}
        </Text>
        <Text variant="muted" monospace wordBreak="break-word">
          {preview}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <ScopeSummary scopes={token.scopes} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text wrap="nowrap">
          <TimeSince date={token.dateCreated} />
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        {token.dateLastUsed ? (
          <Text wrap="nowrap">
            <TimeSince date={token.dateLastUsed} />
          </Text>
        ) : (
          <Text variant="muted">{t('Never')}</Text>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <Tooltip
          title={t('You need the Manager or Owner role to revoke tokens.')}
          disabled={canRevoke}
        >
          <Confirm
            disabled={!canRevoke || isRevoking}
            onConfirm={() => onRevoke(token)}
            priority="danger"
            confirmText={t('Revoke')}
            message={t(
              'Revoke %s? Anything using it will stop working. This cannot be undone.',
              preview
            )}
          >
            <Button
              size="sm"
              icon={<IconDelete />}
              aria-label={t('Revoke %s', token.name)}
              disabled={!canRevoke || isRevoking}
            >
              {t('Revoke')}
            </Button>
          </Confirm>
        </Tooltip>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function TokensSection({serviceAccount}: {serviceAccount: ServiceAccount}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const canWrite = hasEveryAccess(['service_account:write'], {organization});
  const tokensOptions = serviceAccountTokensOptions({
    orgSlug: organization.slug,
    serviceAccountId: serviceAccount.id,
  });

  const {data: tokens, isPending, isError, refetch} = useQuery(tokensOptions);

  const {mutate: revokeToken, isPending: isRevoking} = useMutation({
    mutationFn: (token: ServiceAccountToken) =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/service-accounts/$serviceAccountId/tokens/$tokenId/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              serviceAccountId: serviceAccount.id,
              tokenId: token.id,
            },
          }
        ),
        method: 'DELETE',
      }),
    onSuccess: (_data, token) => {
      toast.success(t('Revoked token %s.', token.name));
      queryClient.invalidateQueries({queryKey: tokensOptions.queryKey});
    },
    onError: () => {
      toast.error(t('Failed to revoke the token.'));
    },
  });

  return (
    <Stack gap="lg">
      <Flex justify="between" align="end" gap="md">
        <Stack gap="xs">
          <Heading as="h2" size="lg">
            {t('Tokens')}
          </Heading>
          <Text variant="muted">
            {t(
              'Tokens authenticate as this service account. A token can have at most the permissions of the account.'
            )}
          </Text>
        </Stack>
        <LinkButton
          variant="primary"
          size="sm"
          icon={<IconAdd />}
          to={`/settings/${organization.slug}/service-accounts/${serviceAccount.id}/tokens/new/`}
          disabled={!canWrite}
          tooltipProps={{
            title: canWrite
              ? undefined
              : t('You need the Manager or Owner role to create tokens.'),
          }}
        >
          {t('New Token')}
        </LinkButton>
      </Flex>
      <SimpleTable
        columns={TOKEN_COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Token')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Permissions')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Last used')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell />
          </SimpleTable.HeaderRow>
        }
      >
        {isError && (
          <SimpleTable.Error message={t('Failed to load tokens.')} onRetry={refetch} />
        )}
        {!isError && isPending && <SimpleTable.Loading />}
        {!isError && !isPending && tokens.length === 0 && (
          <SimpleTable.Empty>
            {t('No tokens yet. Create one to call the Sentry API as this account.')}
          </SimpleTable.Empty>
        )}
        {!isError &&
          !isPending &&
          tokens.map(token => (
            <TokenRow
              key={token.id}
              token={token}
              canRevoke={canWrite}
              isRevoking={isRevoking}
              onRevoke={revokeToken}
            />
          ))}
      </SimpleTable>
    </Stack>
  );
}

export default function OrganizationServiceAccountDetails() {
  const organization = useOrganization();
  const {serviceAccountId} = useParams<{serviceAccountId: string}>();

  const {
    data: serviceAccount,
    isPending,
    isError,
    refetch,
  } = useQuery(serviceAccountOptions({orgSlug: organization.slug, serviceAccountId}));

  if (isError) {
    return (
      <LoadingError
        message={t('Failed to load the service account.')}
        onRetry={refetch}
      />
    );
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <SentryDocumentTitle title={serviceAccount.name} orgSlug={organization.slug}>
      <SettingsPageHeader title={serviceAccount.name} />
      <ServiceAccountSummary serviceAccount={serviceAccount} />
      <TokensSection serviceAccount={serviceAccount} />
    </SentryDocumentTitle>
  );
}
