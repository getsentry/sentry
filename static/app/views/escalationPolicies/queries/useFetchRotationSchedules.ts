import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

export interface RotationSchedule {
  id: string;
  name: string;
  organization: string;
  userId: string;
  team?: string;
}
interface FetchRotationSchedulesParams {
  orgSlug: string;
}

interface FetchRotationSchedulesResponse {
  rotationSchedules: RotationSchedule[];
}

export const makeFetchRotationSchedulesKey = ({
  orgSlug,
}: FetchRotationSchedulesParams): ApiQueryKey => [
  `/organizations/${orgSlug}/rotation-schedules/`,
  {
    query: {},
  },
];

export const useFetchRotationSchedules = (
  params: FetchRotationSchedulesParams,
  options: Partial<UseApiQueryOptions<FetchRotationSchedulesResponse>> = {}
) => {
  return useApiQuery<FetchRotationSchedulesResponse>(
    makeFetchRotationSchedulesKey(params),
    {
      staleTime: 0,
      ...options,
    }
  );
};
