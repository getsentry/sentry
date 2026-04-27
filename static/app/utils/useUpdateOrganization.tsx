import {useMutation, useQueryClient} from '@tanstack/react-query';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';

interface Variables extends Partial<Organization> {}

export function useUpdateOrganization(organization: Organization) {
  const queryClient = useQueryClient();

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
      // 1. the cached response
      // 2. then OrganizationStore
      // 3. defaulting to the org we have in props
      const previousOrganization =
        queryClient.getQueryData(queryOptions.queryKey)?.json ||
        OrganizationStore.get().organization ||
        organization;

      if (!previousOrganization) {
        return {error: new Error('Previous organization not found')};
      }

      const updatedOrganization = {
        ...previousOrganization,
        ...data,
      } satisfies Organization;

      // Update caches optimistically
      // 1. update the OrganizationStore
      OrganizationStore.onUpdate(updatedOrganization);

      // 2. update the cache
      queryClient.setQueryData(queryOptions.queryKey, prevApiResponse =>
        prevApiResponse
          ? {
              ...prevApiResponse,
              json: updatedOrganization,
            }
          : prevApiResponse
      );

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

        // 2. rollback the cache
        queryClient.setQueryData(queryOptions.queryKey, prevApiResponse =>
          prevApiResponse
            ? {
                ...prevApiResponse,
                json: context.previousOrganization,
              }
            : prevApiResponse
        );
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
