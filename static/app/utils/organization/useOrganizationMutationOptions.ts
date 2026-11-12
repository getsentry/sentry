import {mutationOptions, useQueryClient} from '@tanstack/react-query';

import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

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

  const queryOptions = apiOptions.as<Organization>()(
    '/organizations/$organizationIdOrSlug/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    }
  );

  return mutationOptions({
    onMutate: (data: Variables) => {
      const previousOrganization =
        queryClient.getQueryData(queryOptions.queryKey)?.json ||
        OrganizationStore.getState().organization ||
        organization;

      if (!previousOrganization) {
        return {error: new Error('Previous organization not found')};
      }

      const updatedOrganization = {
        ...previousOrganization,
        ...data,
      } satisfies Organization;

      OrganizationStore.onUpdate(updatedOrganization);
      updateOrganizationsStore(updatedOrganization);

      queryClient.setQueryData(queryOptions.queryKey, previous => ({
        json: updatedOrganization,
        headers: previous?.headers ?? {},
      }));

      return {previousOrganization};
    },
    mutationFn: (data: Variables) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data,
      });
    },
    onSuccess: (responseOrg: Organization) => {
      OrganizationStore.onUpdate(responseOrg);
      updateOrganizationsStore(responseOrg);
    },
    onError: (_error, _variables, context) => {
      if (context?.previousOrganization) {
        OrganizationStore.onUpdate(context.previousOrganization);
        updateOrganizationsStore(context.previousOrganization);

        queryClient.setQueryData(queryOptions.queryKey, previous => ({
          json: context.previousOrganization,
          headers: previous?.headers ?? {},
        }));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: queryOptions.queryKey});
    },
  });
}
