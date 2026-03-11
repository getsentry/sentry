import OrganizationStore from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  getApiQueryData,
  setApiQueryData,
  useMutation,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';

interface Variables extends Partial<Organization> {}

export function useUpdateOrganization(organization: Organization) {
  const queryClient = useQueryClient();

  const v1QueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
  ] as ApiQueryKey;
  const queryOptions = apiOptions.as<Organization>()(
    '/organizations/$organizationIdOrSlug/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    }
  );

  return useMutation({
    onMutate: (data: Variables) => {
      // Prefer to read:
      // 1. the cached v2 response
      // 2. falling back to the v1 response
      // 3. then OrganizationStore
      // 4. defaulting to the org we have in props
      const previousOrganization =
        queryClient.getQueryData<ApiResponse<Organization>>(queryOptions.queryKey)
          ?.json ||
        getApiQueryData<Organization>(queryClient, v1QueryKey) ||
        OrganizationStore.get().organization ||
        organization;

      if (!previousOrganization) {
        return {error: new Error('Previous organization not found')};
      }

      const updatedOrganization = {
        ...previousOrganization,
        ...data,
      } as Organization;

      // Update caches optimistically
      // 1. update the OrganizationStore
      OrganizationStore.onUpdate(updatedOrganization);

      // 2. update the v1 cache
      setApiQueryData(queryClient, v1QueryKey, updatedOrganization);

      // 3. update the v2 cache
      const prevApiResponse = queryClient.getQueryData<ApiResponse<Organization>>(
        queryOptions.queryKey
      );
      queryClient.setQueryData(queryOptions.queryKey, {
        headers: prevApiResponse?.headers ?? {
          Link: undefined,
          'X-Hits': undefined,
          'X-Max-Hits': undefined,
        },
        json: updatedOrganization,
      });

      return {previousOrganization};
    },
    mutationFn: (data: Variables) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data,
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousOrganization) {
        // Rollback optimistic update
        // 1. rollback the OrganizationStore
        OrganizationStore.onUpdate(context.previousOrganization);

        // 2. rollback the v1 cache
        setApiQueryData(queryClient, v1QueryKey, context.previousOrganization);

        // 3. rollback the v2 cache
        const prevApiResponse = queryClient.getQueryData<ApiResponse<Organization>>(
          queryOptions.queryKey
        );
        queryClient.setQueryData(queryOptions.queryKey, {
          headers: prevApiResponse?.headers ?? {
            Link: undefined,
            'X-Hits': undefined,
            'X-Max-Hits': undefined,
          },
          json: context.previousOrganization,
        });
      }
    },
    onSettled: () => {
      // Invalidate to refetch and ensure consistency for the queryCache
      // ProjectsStore should've been updated already. It could be out of sync if
      // there are multiple mutations in parallel.
      queryClient.invalidateQueries({queryKey: queryOptions.queryKey});
    },
  });
}
