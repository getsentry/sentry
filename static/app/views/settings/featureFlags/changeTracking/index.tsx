import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {toast} from '@sentry/scraps/toast';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

import {OrganizationFeatureFlagsAuditLogTable} from './organizationFeatureFlagsAuditLogTable';
import {OrganizationFeatureFlagsProviderRow} from './organizationFeatureFlagsProviderRow';

export type Secret = {
  createdAt: string;
  createdBy: number;
  id: number;
  provider: string;
  secret: string;
};

type FetchSecretResponse = {data: Secret[]};

type FetchSecretParameters = {
  orgSlug: string;
};

type RemoveSecretQueryVariables = {
  id: number;
};

export const makeFetchSecretOptions = ({orgSlug}: FetchSecretParameters) =>
  apiOptions.as<FetchSecretResponse>()(
    '/organizations/$organizationIdOrSlug/flags/signing-secrets/',
    {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: Infinity,
    }
  );

function SecretList({
  secretList,
  isRemoving,
  removeSecret,
}: {
  isRemoving: boolean;
  secretList: Secret[];
  removeSecret?: (data: {id: number}) => void;
}) {
  return (
    <Fragment>
      {secretList.map(secret => {
        return (
          <OrganizationFeatureFlagsProviderRow
            key={secret.id}
            secret={secret}
            isRemoving={isRemoving}
            removeSecret={removeSecret ? () => removeSecret({id: secret.id}) : undefined}
          />
        );
      })}
    </Fragment>
  );
}

function AddNewProvider({
  hasAccess,
  organizationSlug,
}: {
  hasAccess: boolean;
  organizationSlug: string;
}) {
  return (
    <Tooltip
      title={t('You must be an organization member to add a provider.')}
      disabled={hasAccess}
    >
      <LinkButton
        variant="primary"
        size="sm"
        to={`/settings/${organizationSlug}/feature-flags/change-tracking/new-provider/`}
        data-test-id="create-new-provider"
        disabled={!hasAccess}
      >
        {t('Add New Provider')}
      </LinkButton>
    </Tooltip>
  );
}

function OrganizationFeatureFlagsChangeTracking() {
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();

  const {
    isPending,
    isError,
    data: secretList,
    refetch: refetchSecretList,
  } = useQuery(makeFetchSecretOptions({orgSlug: organization.slug}));

  const {mutate: handleRemoveSecret, isPending: isRemoving} = useMutation<
    unknown,
    RequestError,
    RemoveSecretQueryVariables
  >({
    mutationFn: ({id}) =>
      api.requestPromise(
        getApiUrl(
          '/organizations/$organizationIdOrSlug/flags/signing-secrets/$signingSecretId/',
          {path: {organizationIdOrSlug: organization.slug, signingSecretId: id}}
        ),
        {
          method: 'DELETE',
        }
      ),

    onSuccess: (_data, {id}) => {
      toast.success(t('Removed the provider and signing secret for the organization.'));

      queryClient.setQueryData(
        makeFetchSecretOptions({orgSlug: organization.slug}).queryKey,
        oldData => {
          return {
            ...oldData,
            headers: oldData?.headers ?? {},
            json: {
              data: oldData?.json.data.filter(oldSecret => oldSecret.id !== id) ?? [],
            },
          };
        }
      );
    },
    onError: error => {
      const message = t('Failed to remove the provider or signing secret.');
      handleXhrErrorResponse(message, error);
      toast.error(message);
    },
  });

  const canRead = hasEveryAccess(['org:read'], {organization});
  const canWrite = hasEveryAccess(['org:write'], {organization});
  const canAdmin = hasEveryAccess(['org:admin'], {organization});
  const hasAccess = canRead || canWrite || canAdmin;
  const hasDeleteAccess = canWrite || canAdmin;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Change Tracking')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Change Tracking')}
        subtitle={tct(
          'Integrating Sentry with your feature flag provider enables Sentry to correlate feature flag changes with new error events and mark certain changes as suspicious. Learn more about how to interact with feature flag insights within the Sentry UI by reading the [link:documentation].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/explore/feature-flags/#change-tracking" />
            ),
          }
        )}
      />

      <Flex justify="between">
        <h5>{t('Providers')}</h5>
        <AddNewProvider hasAccess={hasAccess} organizationSlug={organization.slug} />
      </Flex>

      <TextBlock>
        {t(
          'Look below for a list of the webhooks you have set up with external providers. Note that each provider can only have one associated signing secret.'
        )}
      </TextBlock>
      <StyledSimpleTable
        columns={SECRET_COLUMNS}
        data-test-id="secrets-table"
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Provider')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Created by')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell />
          </SimpleTable.HeaderRow>
        }
      >
        {isError && (
          <SimpleTable.Error
            message={t('Failed to load secrets and providers for the organization.')}
            onRetry={refetchSecretList}
          />
        )}
        {!isError && isPending && <SimpleTable.Loading />}
        {!isError && !isPending && !secretList?.data?.length && (
          <SimpleTable.Empty>
            {t("You haven't linked any providers yet.")}
          </SimpleTable.Empty>
        )}
        {!isError && !isPending && !!secretList?.data?.length && (
          <SecretList
            secretList={secretList.data}
            isRemoving={isRemoving}
            removeSecret={hasDeleteAccess ? handleRemoveSecret : undefined}
          />
        )}
      </StyledSimpleTable>

      <OrganizationFeatureFlagsAuditLogTable />
    </Fragment>
  );
}

export default function OrganizationFeatureFlagsChangeTrackingRoute() {
  return (
    <AnalyticsArea name="feature_flag_org_settings">
      <OrganizationFeatureFlagsChangeTracking />
    </AnalyticsArea>
  );
}

const SECRET_COLUMNS: TableColumnConfig[] = [
  {key: 'provider', width: {zero: '1fr', xl: 'auto'}},
  {key: 'created', visible: {xl: true}, width: 'auto'},
  {key: 'createdBy', visible: {xl: true}, width: 'auto'},
  {key: 'actions', width: {zero: '1fr', xl: 'auto'}},
];

const StyledSimpleTable = styled(SimpleTable)`
  margin-bottom: ${p => p.theme.space['2xl']};
`;
