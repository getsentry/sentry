import type {Organization} from 'sentry/types/organization';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface SamplingProjectRate {
  id: number;
  sampleRate: number;
}

function getEndpoint(organization: Organization) {
  return `/organizations/${organization.slug}/sampling/project-rates/`;
}

function getQueryKey(organization: Organization): ApiQueryKey {
  return [getEndpoint(organization), {query: {perPage: 10000}}];
}

export function useGetSamplingProjectRates() {
  const organization = useOrganization();
  return useApiQuery<SamplingProjectRate[]>(getQueryKey(organization), {staleTime: 0});
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
      setApiQueryData<SamplingProjectRate[]>(
        queryClient,
        getQueryKey(organization),
        previous => {
          if (!previous) {
            return data;
          }
          const newDataById = data.reduce(
            (acc, item) => {
              acc[item.id] = item;
              return acc;
            },
            {} as Record<number, SamplingProjectRate>
          );

          return previous.map(item => {
            const newItem = newDataById[item.id];
            if (newItem) {
              return newItem;
            }
            return item;
          });
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: getQueryKey(organization)});
    },
  });
}
