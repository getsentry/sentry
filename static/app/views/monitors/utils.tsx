import {t, tn} from 'sentry/locale';
import type {Organization, SelectValue} from 'sentry/types';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {CheckInStatus} from 'sentry/views/monitors/types';

export function makeMonitorListQueryKey(
  organization: Organization,
  params: Record<string, any>
) {
  const {query, project, environment, cursor, sort, asc} = params;

  return [
    `/organizations/${organization.slug}/monitors/`,
    {
      query: {
        cursor,
        query,
        project,
        environment,
        includeNew: true,
        per_page: 20,
        sort,
        asc,
      },
    },
  ] as const;
}

export function makeMonitorDetailsQueryKey(
  organization: Organization,
  projectId: string,
  monitorSlug: string,
  query?: Record<string, any>
) {
  return [
    `/projects/${organization.slug}/${projectId}/monitors/${monitorSlug}/`,
    {query},
  ] as const;
}

export const statusToText: Record<CheckInStatus, string> = {
  [CheckInStatus.OK]: t('Okay'),
  [CheckInStatus.ERROR]: t('Failed'),
  [CheckInStatus.IN_PROGRESS]: t('In Progress'),
  [CheckInStatus.MISSED]: t('Missed'),
  [CheckInStatus.TIMEOUT]: t('Timed Out'),
};

interface TickStyle {
  /**
   * The color of the tooltip label
   */
  labelColor: ColorOrAlias;
  /**
   * The color of the tick
   */
  tickColor: ColorOrAlias;
  /**
   * Use a cross hatch fill for the tick instead of a solid color. The tick
   * color will be used as the border color
   */
  hatchTick?: ColorOrAlias;
}

export const tickStyle: Record<CheckInStatus, TickStyle> = {
  [CheckInStatus.ERROR]: {
    labelColor: 'red400',
    tickColor: 'red300',
  },
  [CheckInStatus.TIMEOUT]: {
    labelColor: 'red400',
    tickColor: 'red300',
    hatchTick: 'red200',
  },
  [CheckInStatus.OK]: {
    labelColor: 'green400',
    tickColor: 'green300',
  },
  [CheckInStatus.MISSED]: {
    labelColor: 'yellow400',
    tickColor: 'yellow300',
  },
  [CheckInStatus.IN_PROGRESS]: {
    labelColor: 'disabled',
    tickColor: 'disabled',
  },
};

export const getScheduleIntervals = (n: number): SelectValue<string>[] => [
  {value: 'minute', label: tn('minute', 'minutes', n)},
  {value: 'hour', label: tn('hour', 'hours', n)},
  {value: 'day', label: tn('day', 'days', n)},
  {value: 'week', label: tn('week', 'weeks', n)},
  {value: 'month', label: tn('month', 'months', n)},
  {value: 'year', label: tn('year', 'years', n)},
];
