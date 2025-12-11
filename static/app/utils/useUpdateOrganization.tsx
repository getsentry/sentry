import OrganizationStore from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';

interface Variables extends Partial<Organization> {}

type Context =
  | {
      previousOrganization: Organization;
      error?: never;
    }
  | {
      error: Error;
      previousOrganization?: never;
    };

function makeDetailedOrganizationQueryKey(organization: Organization): ApiQueryKey {
  return [`/organizations/${organization.slug}/`];
}

export function useUpdateOrganization(organization: Organization) {
  const queryClient = useQueryClient();

  const queryKey = makeDetailedOrganizationQueryKey(organization);

  return useMutation<Organization, Error, Variables, Context>({
    onMutate: (data: Variables) => {
      const previousOrganization =
        queryClient.getQueryData<Organization>(queryKey) ||
        OrganizationStore.get().organization ||
        organization;

      if (!previousOrganization) {
        return {error: new Error('Previous organization not found')};
      }

      const updatedOrganization = {
        ...previousOrganization,
        ...data,
      };

      // Update caches optimistically
      OrganizationStore.onUpdate(updatedOrganization);
      setApiQueryData<Organization>(queryClient, queryKey, updatedOrganization);

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
        OrganizationStore.onUpdate(context.previousOrganization);
        queryClient.setQueryData(queryKey, context.previousOrganization);
      }
    },
    onSettled: () => {
      // Invalidate to refetch and ensure consistency for the queryCache
      // ProjectsStore should've been updated already. It could be out of sync if
      // there are multiple mutations in parallel.
      queryClient.invalidateQueries({queryKey});
    },
  });
}
