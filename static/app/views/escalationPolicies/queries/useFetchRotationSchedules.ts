import type {User} from 'sentry/types/user';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

export interface RotationPeriod {
  endTime: string;
  startTime: string;
  userId: string;
}

export interface ScheduleRestrictions {
  Fri?: string[][];
  Mon?: string[][];
  Sat?: string[][];
  Sun?: string[][];
  Thu?: string[][];
  Tue?: string[][];
  Wed?: string[][];
}

export interface ScheduleLayer {
  handoffTime: string;
  rotationPeriods: RotationPeriod[];
  rotationType: string;
  scheduleLayerRestrictions: object;
  startTime: string;
  users: User;
}

export interface RotationSchedule {
  coalescedRotationPeriods: RotationPeriod[];
  id: string;
  name: string;
  organizationId: string;
  scheduleLayers: ScheduleLayer[];
  team?: string;
  user?: string;
}
interface FetchRotationSchedulesParams {
  orgSlug: string;
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
  options: Partial<UseApiQueryOptions<RotationSchedule[]>> = {}
) => {
  return useApiQuery<RotationSchedule[]>(makeFetchRotationSchedulesKey(params), {
    staleTime: 0,
    ...options,
  });
};
