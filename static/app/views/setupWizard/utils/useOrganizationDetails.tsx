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

  const queryParams = {
    host: organization?.region.url,
    query: {
      include_feature_flags: 1,
    },
  };

  return useQuery<Organization, RequestError>({
    queryKey: [`/organizations/${organization?.slug}/`, queryParams],
    queryFn: () => {
      return api.requestPromise(`/organizations/${organization?.slug}/`, queryParams);
    },
    enabled: !!organization,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
