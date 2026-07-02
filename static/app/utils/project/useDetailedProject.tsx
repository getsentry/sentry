import type {UseQueryOptions} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {DetailedProject} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';

interface DetailedProjectParameters {
  orgSlug: string;
  projectSlug: string;
}

type DetailedProjectOptions = Omit<
  UseQueryOptions<ApiResponse<DetailedProject>, Error, DetailedProject, ApiQueryKey>,
  'queryKey' | 'queryFn' | 'select'
>;

export const makeDetailedProjectApiOptions = ({
  orgSlug,
  projectSlug,
}: DetailedProjectParameters) =>
  apiOptions.as<DetailedProject>()('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
    path: {organizationIdOrSlug: orgSlug, projectIdOrSlug: projectSlug},
    query: {
      // Skips expensive properties of organization details
      collapse: 'organization',
    },
    staleTime: Infinity,
  });

export const makeDetailedProjectQueryKey = (params: DetailedProjectParameters) =>
  makeDetailedProjectApiOptions(params).queryKey;

export function useDetailedProject(
  params: DetailedProjectParameters,
  options: DetailedProjectOptions = {}
) {
  return useQuery({
    ...makeDetailedProjectApiOptions(params),
    retry: false,
    ...options,
  });
}
