import type {User} from 'sentry/types/user';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {TimeWindowConfig} from 'sentry/views/monitors/components/timeline/types';

export interface RotationPeriod {
  endTime: Date;
  startTime: Date;
  userId: string | null;
  percentage?: number; // Not from API. Only used in UI calculations
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
  users: User[];
}

export interface RotationSchedule {
  coalescedRotationPeriods: RotationPeriod[];
  description: string;
  id: string;
  name: string;
  organizationId: string;
  scheduleLayers: ScheduleLayer[];
  team?: string;
  user?: string;
}
interface FetchRotationSchedulesParams {
  orgSlug: string;
  timeWindowConfig?: TimeWindowConfig;
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
  const resp = useApiQuery<RotationSchedule[]>(makeFetchRotationSchedulesKey(params), {
    staleTime: 0,
    ...options,
  });
  resp.data = resp.data?.map(schedule => {
    schedule.coalescedRotationPeriods = schedule.coalescedRotationPeriods.map(period => {
      period.startTime = new Date(period.startTime);
      period.endTime = new Date(period.endTime);
      return period;
    });
    schedule.scheduleLayers.map(layer => {
      layer.rotationPeriods = layer.rotationPeriods.map(period => {
        period.startTime = new Date(period.startTime);
        period.endTime = new Date(period.endTime);
        return period;
      });
      return layer;
    });
    return schedule;
  });
  return resp;
};
