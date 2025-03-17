import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import LoadingError from 'sentry/components/loadingError';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import OrganizationApiKeysList from './organizationApiKeysList';
import type {DeprecatedApiKey} from './types';

/**
 * API Keys are deprecated, but there may be some legacy customers that still use it
 */
function OrganizationApiKeys() {
  const api = useApi();
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: apiKeys = [],
    isPending,
    isError,
    refetch,
  } = useApiQuery<DeprecatedApiKey[]>([`/organizations/${organization.slug}/api-keys/`], {
    staleTime: 0,
  });

  const removeMutation = useMutation({
    mutationFn: ({removedId}: {removedId: string}) => {
      return api.requestPromise(
        `/organizations/${organization.slug}/api-keys/${removedId}/`,
        {
          method: 'DELETE',
          data: {},
        }
      );
    },
    onMutate: () => {
      addLoadingMessage(t('Removing API key'));
    },
    onSuccess: (_data, {removedId}) => {
      setApiQueryData<DeprecatedApiKey[]>(
        queryClient,
        [`/organizations/${organization.slug}/api-keys/`],
        oldData => {
          if (!oldData) {
            return oldData;
          }

          return oldData.filter(({id}) => id !== removedId);
        }
      );
    },
    onError: () => {
      addErrorMessage(t('Error removing key'));
    },
  });

  const addMutation = useMutation({
    mutationFn: (): Promise<DeprecatedApiKey> => {
      return api.requestPromise(`/organizations/${organization.slug}/api-keys/`, {
        method: 'POST',
        data: {},
      });
    },
    onSuccess: data => {
      if (!data) {
        return;
      }

      navigate(`/settings/${organization.slug}/api-keys/${data.id}/`);
      addSuccessMessage(t('Created a new API key "%s"', data.label));
    },
    onError: () => {
      addErrorMessage(t('Error creating key'));
    },
  });

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <SentryDocumentTitle title={t('Api Keys')} orgSlug={organization.slug}>
      <OrganizationApiKeysList
        organization={organization}
        loading={isPending}
        busy={addMutation.isPending}
        keys={apiKeys}
        onRemove={id => removeMutation.mutateAsync({removedId: id})}
        onAddApiKey={addMutation.mutateAsync}
      />
    </SentryDocumentTitle>
  );
}

export default OrganizationApiKeys;
