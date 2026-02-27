import type {RepositoryWithSettings} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props extends Partial<UseApiQueryOptions<RepositoryWithSettings>> {
  repositoryId: string;
}

export function getRepositoryWithSettingsQueryKey(
  organization: Organization,
  repoId: string
) {
  return [
    getApiUrl(`/organizations/$organizationIdOrSlug/repos/$repoId/`, {
      path: {organizationIdOrSlug: organization.slug, repoId},
    }),
    {query: {expand: 'settings'}},
  ] satisfies ApiQueryKey;
}

export default function useRepositoryWithSettings({repositoryId, ...options}: Props) {
  const organization = useOrganization();

  return useApiQuery<RepositoryWithSettings>(
    getRepositoryWithSettingsQueryKey(organization, repositoryId),
    {
      staleTime: 0,
      ...options,
    }
  );
}
