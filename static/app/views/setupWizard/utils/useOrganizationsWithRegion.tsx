import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {Region} from 'sentry/types/system';
import {useQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

export function useOrganizationsWithRegion() {
  const api = useApi();

  return useQuery<(Organization & {region: Region})[], RequestError>({
    queryKey: ['/organizations/'],
    queryFn: async () => {
      const regions = ConfigStore.get('memberRegions');
      const results = await Promise.all(
        regions.map(async region => [
          region,
          await api.requestPromise(`/organizations/`, {
            host: region.url,
            // Authentication errors can happen as we span regions.
            allowAuthError: true,
          }),
        ])
      );
      return results.reduce((acc, [region, response]) => {
        // Don't append error results to the org list.
        if (response[0]) {
          acc = acc.concat(response.map(org => ({...org, region: region.name})));
        }
        return acc;
      }, []);
    },
    refetchOnWindowFocus: false,
    retry: false,
  });
}
