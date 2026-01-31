import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import type {TempestCredentials} from 'sentry/views/settings/project/tempest/types';

const makeFetchTempestCredentialsQueryKey = ({
  orgSlug,
  projectSlug,
}: {
  orgSlug: string;
  projectSlug: string;
}) =>
  [
    getApiUrl(`/projects/$organizationIdOrSlug/$projectIdOrSlug/tempest-credentials/`, {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
    }),
  ] as const;

export function useFetchTempestCredentials(organization: Organization, project: Project) {
  const tempestCredentialsQuery = useApiQuery<TempestCredentials[]>(
    makeFetchTempestCredentialsQueryKey({
      orgSlug: organization.slug,
      projectSlug: project.slug,
    }),
    {staleTime: Infinity}
  );

  const queryClient = useQueryClient();

  const invalidateCredentialsCache = () => {
    queryClient.invalidateQueries({
      queryKey: makeFetchTempestCredentialsQueryKey({
        orgSlug: organization.slug,
        projectSlug: project.slug,
      }),
    });
  };

  return {
    ...tempestCredentialsQuery,
    invalidateCredentialsCache,
  };
}
