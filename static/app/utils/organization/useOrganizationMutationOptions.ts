import {mutationOptions, useQueryClient} from '@tanstack/react-query';

import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, getApiQueryData, setApiQueryData} from 'sentry/utils/queryClient';

interface Variables extends Partial<Organization> {}

function updateOrganizationsStore(org: Organization) {
  try {
    OrganizationsStore.onUpdate(org);
  } catch {
    // OrganizationsStore throws if the org isn't loaded yet
  }
}

export function useOrganizationMutationOptions(organization: Organization) {
  const queryClient = useQueryClient();

  const v1QueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
  ] as const;
  const queryOptions = apiOptions.as<Organization>()(
    '/organizations/$organizationIdOrSlug/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    }
  );

  return mutationOptions({
    onMutate: (data: Variables) => {
      // Prefer to read:
      // 1. the cached v2 response
      // 2. falling back to the v1 response
      // 3. then OrganizationStore
      // 4. defaulting to the org we have in props
      const previousOrganization =
        queryClient.getQueryData(queryOptions.queryKey)?.json ||
        getApiQueryData<Organization>(queryClient, v1QueryKey) ||
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
      updateOrganizationsStore(updatedOrganization);

      // 2. update the v1 cache
      setApiQueryData(queryClient, v1QueryKey, updatedOrganization);

      // 3. update the v2 cache
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
    onSuccess: (responseOrg: Organization) => {
      OrganizationStore.onUpdate(responseOrg);
      updateOrganizationsStore(responseOrg);
    },
    onError: (_error, _variables, context) => {
      if (context?.previousOrganization) {
        // Rollback optimistic update
        // 1. rollback the OrganizationStore
        OrganizationStore.onUpdate(context.previousOrganization);
        updateOrganizationsStore(context.previousOrganization);

        // 2. rollback the v1 cache
        setApiQueryData(queryClient, v1QueryKey, context.previousOrganization);

        // 3. rollback the v2 cache
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
      queryClient.invalidateQueries({queryKey: v1QueryKey});
      queryClient.invalidateQueries({queryKey: queryOptions.queryKey});
    },
  });
}
