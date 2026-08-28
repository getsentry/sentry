import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';
import {OrganizationFeatureFlagsAuditLogTable} from 'sentry/views/settings/featureFlags/changeTracking/organizationFeatureFlagsAuditLogTable';
import {OrganizationFeatureFlagsProviderRow} from 'sentry/views/settings/featureFlags/changeTracking/organizationFeatureFlagsProviderRow';

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

export const makeFetchSecretQueryKey = ({orgSlug}: FetchSecretParameters) =>
  [
    getApiUrl('/organizations/$organizationIdOrSlug/flags/signing-secrets/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
  ] as const;

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

function OrganizationFeatureFlagsChangeTracking() {
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();

  const {
    isPending,
    isError,
    data: secretList,
    refetch: refetchSecretList,
  } = useApiQuery<FetchSecretResponse>(
    makeFetchSecretQueryKey({orgSlug: organization.slug}),
    {
      staleTime: Infinity,
    }
  );

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
      addSuccessMessage(
        t('Removed the provider and signing secret for the organization.')
      );

      setApiQueryData<FetchSecretResponse>(
        queryClient,
        makeFetchSecretQueryKey({orgSlug: organization.slug}),
        oldData => {
          return {data: oldData?.data.filter(oldSecret => oldSecret.id !== id) ?? []};
        }
      );
    },
    onError: error => {
      const message = t('Failed to remove the provider or signing secret.');
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  const addNewProvider = (hasAccess: any) => (
    <Tooltip
      title={t('You must be an organization member to add a provider.')}
      disabled={hasAccess}
    >
      <LinkButton
        variant="primary"
        size="sm"
        to={`/settings/${organization.slug}/feature-flags/change-tracking/new-provider/`}
        data-test-id="create-new-provider"
        disabled={!hasAccess}
      >
        {t('Add New Provider')}
      </LinkButton>
    </Tooltip>
  );

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
        {addNewProvider(hasAccess)}
      </Flex>

      <TextBlock>
        {t(
          'Look below for a list of the webhooks you have set up with external providers. Note that each provider can only have one associated signing secret.'
        )}
      </TextBlock>
      <ResponsiveSimpleTable
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
      </ResponsiveSimpleTable>

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

const ResponsiveSimpleTable = styled(SimpleTable)`
  grid-template-columns: auto auto auto auto;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr 1fr;

    /* Hide "Created" and "Created by"; the flat nth-child(4n + x) form this
       replaced counted cells across the whole grid. */
    [role='columnheader']:nth-child(2),
    [role='columnheader']:nth-child(3),
    [role='cell']:nth-child(2),
    [role='cell']:nth-child(3) {
      display: none;
    }
  }
  margin-bottom: ${p => p.theme.space['2xl']};
`;
