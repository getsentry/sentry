import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import {LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {OrganizationFeatureFlagsProviderRow} from 'sentry/views/settings/featureFlags/organizationFeatureFlagsProviderRow';

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
  [`/organizations/${orgSlug}/flags/signing-secrets/`] as const;

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

export function OrganizationFeatureFlagsIndex({
  organization,
}: {
  organization: Organization;
}) {
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
    {},
    RequestError,
    RemoveSecretQueryVariables
  >({
    mutationFn: ({id}) =>
      api.requestPromise(
        `/organizations/${organization.slug}/flags/signing-secrets/${id}/`,
        {
          method: 'DELETE',
        }
      ),

    onSuccess: (_data, {id}) => {
      addSuccessMessage(
        t('Removed the provider and signing secret for the organization.')
      );

      setApiQueryData(
        queryClient,
        makeFetchSecretQueryKey({orgSlug: organization.slug}),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.filter(oldSecret => oldSecret.id !== id);
        }
      );
    },
    onError: error => {
      const message = t('Failed to remove the provider or signing secret.');
      handleXhrErrorResponse(message, error);
      addErrorMessage(message);
    },
  });

  const addNewProvider = (
    <LinkButton
      priority="primary"
      size="sm"
      to={`/settings/${organization.slug}/feature-flags/new-provider/`}
      data-test-id="create-new-provider"
    >
      {t('Add New Provider')}
    </LinkButton>
  );

  return (
    <Access access={['org:write']}>
      {({hasAccess}) => (
        <Fragment>
          <SentryDocumentTitle title={t('Feature Flags')} />
          <SettingsPageHeader title={t('Feature Flags')} action={addNewProvider} />

          <TextBlock>
            {t(
              'Integrating Sentry with your feature flag provider enables Sentry to correlate feature flag changes with new error events and mark certain changes as suspicious. This page lists the webhooks you have set up with external providers. Note that each provider can only have one associated signing secret.'
            )}
          </TextBlock>
          <TextBlock>
            {tct(
              'Learn more about how to interact with feature flag insights within the Sentry UI by reading the [link:documentation].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/#feature-flags" />
                ),
              }
            )}
          </TextBlock>

          <ResponsivePanelTable
            isLoading={isPending || isError}
            isEmpty={!isPending && !secretList?.data?.length}
            loader={
              isError ? (
                <LoadingError
                  message={t(
                    'Failed to load secrets and providers for the organization.'
                  )}
                  onRetry={refetchSecretList}
                />
              ) : undefined
            }
            emptyMessage={t("You haven't linked any providers yet.")}
            headers={[t('Provider'), t('Created'), t('Created by'), '']}
          >
            {!isError && !isPending && !!secretList?.data?.length && (
              <SecretList
                secretList={secretList.data}
                isRemoving={isRemoving}
                removeSecret={hasAccess ? handleRemoveSecret : undefined}
              />
            )}
          </ResponsivePanelTable>
        </Fragment>
      )}
    </Access>
  );
}

export default withOrganization(OrganizationFeatureFlagsIndex);

const ResponsivePanelTable = styled(PanelTable)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr 1fr;

    > *:nth-child(4n + 2),
    *:nth-child(4n + 3) {
      display: none;
    }
  }
`;
