import OrganizationStore from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {
  fetchMutation,
  getApiQueryData,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';

interface Variables extends Partial<Organization> {}

export function useUpdateOrganization(organization: Organization) {
  const queryClient = useQueryClient();

  const organizationQueryOptions = (org: Organization) => {
    return apiOptions.as<Organization>()('/organizations/$organizationIdOrSlug/', {
      path: {organizationIdOrSlug: org.slug},
      staleTime: 0,
    });
  };

  const queryOptions = organizationQueryOptions(organization);

  return useMutation({
    onMutate: (data: Variables) => {
      const previousOrganization =
        getApiQueryData(queryClient, queryOptions.queryKey) ||
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
      setApiQueryData(queryClient, queryOptions.queryKey, updatedOrganization);

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
        setApiQueryData(queryClient, queryOptions.queryKey, context.previousOrganization);
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
