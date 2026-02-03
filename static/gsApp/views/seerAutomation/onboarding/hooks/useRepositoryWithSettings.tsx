import type {RepositoryWithSettings} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
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
  repositoryId: string
) {
  return [
    `/organizations/${organization.slug}/repos/${repositoryId}/`,
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
