import type {Organization} from 'sentry/types/organization';
import {useQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationDetails({
  organization,
}: {
  organization?: OrganizationWithRegion;
}) {
  const api = useApi();

  return useQuery<Organization, RequestError>({
    queryKey: [`/organizations/${organization?.slug}/`],
    queryFn: () => {
      return api.requestPromise(`/organizations/${organization?.slug}/`, {
        host: organization?.region.url,
        query: {
          include_feature_flags: 1,
        },
      });
    },
    enabled: !!organization,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
