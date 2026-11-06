import {useQuery, useQueryClient} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {TempestCredentials} from 'sentry/views/settings/project/tempest/types';

const tempestCredentialsOptions = ({
  orgSlug,
  projectSlug,
}: {
  orgSlug: string;
  projectSlug: string;
}) =>
  apiOptions.as<TempestCredentials[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/tempest-credentials/',
    {
      path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
      staleTime: Infinity,
    }
  );

export function useFetchTempestCredentials(organization: Organization, project: Project) {
  const tempestCredentialsQuery = useQuery(
    tempestCredentialsOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
    })
  );

  const queryClient = useQueryClient();

  const invalidateCredentialsCache = () => {
    queryClient.invalidateQueries({
      queryKey: tempestCredentialsOptions({
        orgSlug: organization.slug,
        projectSlug: project.slug,
      }).queryKey,
    });
  };

  return {
    data: tempestCredentialsQuery.data,
    isLoading: tempestCredentialsQuery.isLoading,
    invalidateCredentialsCache,
  };
}
