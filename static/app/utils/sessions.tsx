import type {Theme} from '@emotion/react';
import compact from 'lodash/compact';
import moment from 'moment-timezone';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {
  getDiffInMinutes,
  SIX_HOURS,
  SIXTY_DAYS,
  THIRTY_DAYS,
  TWENTY_FOUR_HOURS,
} from 'sentry/components/charts/utils';
import {getChartColorPalette} from 'sentry/constants/chartPalette';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import type {
  SessionApiResponse,
  SessionFieldWithOperation,
} from 'sentry/types/organization';
import {SessionStatus} from 'sentry/types/organization';
import {defined, percent} from 'sentry/utils';
import {getCrashFreePercent, getSessionStatusPercent} from 'sentry/views/releases/utils';
import {sessionTerm} from 'sentry/views/releases/utils/sessionTerm';

/**
 * If the time window is less than or equal 10, seconds will be displayed on the graphs
 */
export const MINUTES_THRESHOLD_TO_DISPLAY_SECONDS = 10;

export function getCount(
  groups: SessionApiResponse['groups'] = [],
  field: SessionFieldWithOperation
) {
  return groups.reduce((acc, group) => acc + group.totals[field]!, 0);
}

export function getCountAtIndex(
  groups: SessionApiResponse['groups'] = [],
  field: SessionFieldWithOperation,
  index: number
) {
  return groups.reduce((acc, group) => acc + group.series[field]![index]!, 0);
}

export function getCrashFreeRate(
  groups: SessionApiResponse['groups'] = [],
  field: SessionFieldWithOperation
) {
  const crashedRate = getSessionStatusRate(groups, field, SessionStatus.CRASHED);

  return defined(crashedRate) ? getCrashFreePercent(100 - crashedRate) : null;
}

export function getSeriesAverage(
  groups: SessionApiResponse['groups'] = [],
  field: SessionFieldWithOperation
) {
  const totalCount = getCount(groups, field);

  const dataPoints = groups.filter(group => !!group.totals[field]).length;

  return !defined(totalCount) || dataPoints === null || totalCount === 0
    ? null
    : totalCount / dataPoints;
}

export function getSeriesSum(
  groups: SessionApiResponse['groups'] = [],
  field: SessionFieldWithOperation,
  intervals: SessionApiResponse['intervals'] = []
) {
  const dataPointsSums: number[] = Array(intervals.length).fill(0);
  const groupSeries = groups.map(group => group.series[field]);

  groupSeries.forEach(series => {
    series!.forEach((dataPoint, idx) => (dataPointsSums[idx]! += dataPoint));
  });

  return dataPointsSums;
}

export function getSessionStatusRate(
  groups: SessionApiResponse['groups'] = [],
  field: SessionFieldWithOperation,
  status: SessionStatus
) {
  const totalCount = getCount(groups, field);

  const crashedCount = getCount(
    groups.filter(({by}) => by['session.status'] === status),
    field
  );

  return !defined(totalCount) || totalCount === 0
    ? null
    : percent(crashedCount ?? 0, totalCount ?? 0);
}

export function getCrashFreeRateSeries(
  groups: SessionApiResponse['groups'] = [],
  intervals: SessionApiResponse['intervals'] = [],
  field: SessionFieldWithOperation
): SeriesDataUnit[] {
  return compact(
    intervals.map((interval, i) => {
      const intervalTotalSessions = groups.reduce(
        (acc, group) => acc + (group.series[field]?.[i] ?? 0),
        0
      );

      const intervalCrashedSessions =
        groups.find(group => group.by['session.status'] === SessionStatus.CRASHED)
          ?.series[field]?.[i] ?? 0;

      const crashedSessionsPercent = percent(
        intervalCrashedSessions,
        intervalTotalSessions
      );

      if (intervalTotalSessions === 0) {
        return null;
      }

      return {
        name: interval,
        value: getCrashFreePercent(100 - crashedSessionsPercent),
      };
    })
  );
}

export function getSessionStatusRateSeries(
  groups: SessionApiResponse['groups'] = [],
  intervals: SessionApiResponse['intervals'] = [],
  field: SessionFieldWithOperation,
  status: SessionStatus
): SeriesDataUnit[] {
  return compact(
    intervals.map((interval, i) => {
      const intervalTotalSessions = groups.reduce(
        (acc, group) => acc + group.series[field]![i]!,
        0
      );

      const intervalStatusSessions =
        groups.find(group => group.by['session.status'] === status)?.series[field]![i] ??
        0;

      const statusSessionsPercent = percent(
        intervalStatusSessions,
        intervalTotalSessions
      );

      if (intervalTotalSessions === 0) {
        return null;
      }

      return {
        name: interval,
        value: getSessionStatusPercent(statusSessionsPercent),
      };
    })
  );
}

export function getAdoptionSeries(
  releaseGroups: SessionApiResponse['groups'] = [],
  allGroups: SessionApiResponse['groups'] = [],
  intervals: SessionApiResponse['intervals'] = [],
  field: SessionFieldWithOperation
): SeriesDataUnit[] {
  return intervals.map((interval, i) => {
    const intervalReleaseSessions = releaseGroups.reduce(
      (acc, group) => acc + (group.series[field]?.[i] ?? 0),
      0
    );
    const intervalTotalSessions = allGroups.reduce(
      (acc, group) => acc + (group.series[field]?.[i] ?? 0),
      0
    );

    const intervalAdoption = percent(intervalReleaseSessions, intervalTotalSessions);

    return {
      name: interval,
      value: Math.round(intervalAdoption),
    };
  });
}

export function getCountSeries(
  field: SessionFieldWithOperation,
  group?: SessionApiResponse['groups'][0],
  intervals: SessionApiResponse['intervals'] = []
): SeriesDataUnit[] {
  return intervals.map((interval, index) => ({
    name: interval,
    value: group?.series[field]![index] ?? 0,
  }));
}

export function initSessionsChart(theme: Theme) {
  const colors = getChartColorPalette(14);
  return {
    [SessionStatus.HEALTHY]: {
      seriesName: sessionTerm.healthy,
      data: [],
      color: theme.green300,
      areaStyle: {
        color: theme.green300,
        opacity: 1,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    [SessionStatus.ERRORED]: {
      seriesName: sessionTerm.errored,
      data: [],
      color: colors[12]!,
      areaStyle: {
        color: colors[12]!,
        opacity: 1,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    [SessionStatus.ABNORMAL]: {
      seriesName: sessionTerm.abnormal,
      data: [],
      color: colors[15]!,
      areaStyle: {
        color: colors[15]!,
        opacity: 1,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    [SessionStatus.CRASHED]: {
      seriesName: sessionTerm.crashed,
      data: [],
      color: theme.red300,
      areaStyle: {
        color: theme.red300,
        opacity: 1,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
  };
}

type GetSessionsIntervalOptions = {
  dailyInterval?: boolean;
  highFidelity?: boolean;
};

export function getSessionsInterval(
  datetimeObj: DateTimeObject,
  {highFidelity, dailyInterval}: GetSessionsIntervalOptions = {}
) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (moment(datetimeObj.start).isSameOrBefore(moment().subtract(30, 'days'))) {
    // we cannot use sub-hour session resolution on buckets older than 30 days
    highFidelity = false;
  }

  if (dailyInterval === true && diffInMinutes > TWENTY_FOUR_HOURS) {
    return '1d';
  }

  if (diffInMinutes >= SIXTY_DAYS) {
    return '1d';
  }

  if (diffInMinutes >= THIRTY_DAYS) {
    return '4h';
  }

  if (diffInMinutes >= SIX_HOURS) {
    return '1h';
  }

  // limit on backend for sub-hour session resolution is set to six hours
  if (highFidelity) {
    if (diffInMinutes <= MINUTES_THRESHOLD_TO_DISPLAY_SECONDS) {
      // This only works for metrics-based session stats.
      // Backend will silently replace with '1m' for session-based stats.
      return '10s';
    }

    if (diffInMinutes <= 30) {
      return '1m';
    }

    return '5m';
  }

  return '1h';
}

// Sessions API can only round intervals to the closest hour - this is especially problematic when using sub-hour resolution.
// We filter out results that are out of bounds on frontend and recalculate totals.
export function filterSessionsInTimeWindow(
  sessions: SessionApiResponse,
  start?: string,
  end?: string
) {
  if (!start || !end) {
    return sessions;
  }

  const filteredIndexes: number[] = [];

  const intervals = sessions.intervals.filter((interval, index) => {
    const isBetween = moment
      .utc(interval)
      .isBetween(moment.utc(start), moment.utc(end), undefined, '[]');
    if (isBetween) {
      filteredIndexes.push(index);
    }

    return isBetween;
  });

  const groups = sessions.groups.map(group => {
    const series: Record<string, number[]> = {};
    const totals: Record<string, number> = {};
    Object.keys(group.series).forEach(field => {
      totals[field] = 0;
      series[field] = group.series[field]!.filter((value, index) => {
        const isBetween = filteredIndexes.includes(index);
        if (isBetween) {
          totals[field] = (totals[field] ?? 0) + value;
        }

        return isBetween;
      });
      if (field.startsWith('p50')) {
        // Calculate the mean of the current field.
        const base = series[field] ?? [];
        totals[field] = base.reduce((acc, curr) => acc + curr, 0) / base.length;
      }
      if (field.startsWith('count_unique')) {
        // E.g. users
        // We cannot sum here because users would not be unique anymore.
        // User can be repeated and part of multiple buckets in series but it's still that one user so totals would be wrong.
        // This operation is not 100% correct, because we are filtering series in time window but the total is for unfiltered series (it's the closest thing we can do right now)
        totals[field] = group.totals[field]!;
      }
    });
    return {...group, series, totals};
  });

  return {
    start: intervals[0]!,
    end: intervals[intervals.length - 1]!,
    query: sessions.query,
    intervals,
    groups,
  };
}
