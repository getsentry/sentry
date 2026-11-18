import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import {OrganizationApiKeysList} from './organizationApiKeysList';
import type {DeprecatedApiKey} from './types';

/**
 * API Keys are deprecated, but there may be some legacy customers that still use it
 */
function OrganizationApiKeys() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const apiKeysOptions = apiOptions.as<DeprecatedApiKey[]>()(
    '/organizations/$organizationIdOrSlug/api-keys/',
    {path: {organizationIdOrSlug: organization.slug}, staleTime: 0}
  );
  const {data: apiKeys = [], isPending, isError, refetch} = useQuery(apiKeysOptions);

  const removeMutation = useMutation({
    mutationFn: ({removedId}: {removedId: string}) => {
      return fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/api-keys/$apiKeyId/', {
          path: {organizationIdOrSlug: organization.slug, apiKeyId: removedId},
        }),
        method: 'DELETE',
        data: {},
      });
    },
    onMutate: () => {
      toast.loading(t('Removing API key'));
    },
    onSuccess: (_data, {removedId}) => {
      queryClient.setQueryData(apiKeysOptions.queryKey, previous =>
        previous
          ? {
              ...previous,
              json: previous.json.filter(({id}) => id !== removedId),
            }
          : undefined
      );
    },
    onError: () => {
      toast.error(t('Error removing key'));
    },
  });

  const addMutation = useMutation({
    mutationFn: (): Promise<DeprecatedApiKey> => {
      return fetchMutation<DeprecatedApiKey>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/api-keys/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: {},
      });
    },
    onSuccess: data => {
      if (!data) {
        return;
      }

      navigate(`/settings/${organization.slug}/api-keys/${data.id}/`);
      toast.success(t('Created a new API key "%s"', data.label));
    },
    onError: () => {
      toast.error(t('Error creating key'));
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
