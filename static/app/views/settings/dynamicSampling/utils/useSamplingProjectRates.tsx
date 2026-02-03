import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface SamplingProjectRate {
  id: number;
  sampleRate: number;
}

function getEndpoint(organization: Organization) {
  return getApiUrl('/organizations/$organizationIdOrSlug/sampling/project-rates/', {
    path: {organizationIdOrSlug: organization.slug},
  });
}

function getQueryKey(organization: Organization): ApiQueryKey {
  return [getEndpoint(organization)];
}

/**
 * Fetches all sampling rates for the organization by looping through
 * the paginated results.
 */
const fetchAllSamplingRates = async (
  api: Client,
  organization: Organization
): Promise<SamplingProjectRate[]> => {
  const endpoint = getEndpoint(organization);
  let cursor: string | null = '';
  let result: SamplingProjectRate[] = [];

  while (cursor !== null) {
    const [data, _, response] = await api.requestPromise(endpoint, {
      method: 'GET',
      includeAllArgs: true,
      query: {cursor},
    });

    result = result.concat(data);

    cursor = null;
    const linkHeader = response?.getResponseHeader('Link');

    if (linkHeader) {
      const links = parseLinkHeader(linkHeader);
      cursor = (links.next!.results && links.next!.cursor) || null;
    }
  }

  return result;
};

export function useGetSamplingProjectRates() {
  const api = useApi();
  const organization = useOrganization();
  return useQuery<SamplingProjectRate[]>({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: getQueryKey(organization),
    queryFn: () => fetchAllSamplingRates(api, organization),
    staleTime: 0,
  });
}

export function useUpdateSamplingProjectRates() {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useMutation<SamplingProjectRate[], RequestError, SamplingProjectRate[]>({
    mutationFn: variables => {
      return api.requestPromise(getEndpoint(organization), {
        method: 'PUT',
        data: variables,
      });
    },
    onSuccess: data => {
      const queryKey = getQueryKey(organization);
      const previous = queryClient.getQueryData<SamplingProjectRate[]>(queryKey);
      if (!previous) {
        return;
      }

      const newDataById = data.reduce(
        (acc, item) => {
          acc[item.id] = item;
          return acc;
        },
        {} as Record<number, SamplingProjectRate>
      );

      queryClient.setQueryData(
        queryKey,
        previous.map(item => {
          const newItem = newDataById[item.id];
          if (newItem) {
            return newItem;
          }
          return item;
        })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: getQueryKey(organization)});
    },
  });
}
