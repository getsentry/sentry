import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {RotationSchedule} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';

interface FetchRotationScheduleDetailsParams {
  orgSlug: string;
  rotationScheduleId: string;
}

interface FetchRotationScheduleDetailsResponse {
  rotationSchedule: RotationSchedule;
}

export const makeFetchRotationScheduleDetailsKey = ({
  orgSlug,
  rotationScheduleId,
}: FetchRotationScheduleDetailsParams): ApiQueryKey => [
  `/organizations/${orgSlug}/rotation-schedules/${rotationScheduleId}`,
  {
    query: {},
  },
];

export const useFetchRotationScheduleDetails = (
  params: FetchRotationScheduleDetailsParams,
  options: Partial<UseApiQueryOptions<FetchRotationScheduleDetailsResponse>> = {}
) => {
  return useApiQuery<FetchRotationScheduleDetailsResponse>(
    makeFetchRotationScheduleDetailsKey(params),
    {
      staleTime: 0,
      ...options,
    }
  );
};
