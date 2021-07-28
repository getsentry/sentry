import compact from 'lodash/compact';
import moment from 'moment';

import {
  DateTimeObject,
  getDiffInMinutes,
  ONE_WEEK,
  TWO_WEEKS,
} from 'app/components/charts/utils';
import {SessionApiResponse, SessionField, SessionStatus} from 'app/types';
import {SeriesDataUnit} from 'app/types/echarts';
import {defined, percent} from 'app/utils';
import {getCrashFreePercent, getSessionStatusPercent} from 'app/views/releases/utils';

export function getCount(groups: SessionApiResponse['groups'] = [], field: SessionField) {
  return groups.reduce((acc, group) => acc + group.totals[field], 0);
}

export function getCrashFreeRate(
  groups: SessionApiResponse['groups'] = [],
  field: SessionField
) {
  const crashedRate = getSessionStatusRate(groups, field, SessionStatus.CRASHED);

  return defined(crashedRate) ? getCrashFreePercent(100 - crashedRate) : null;
}

export function getSessionStatusRate(
  groups: SessionApiResponse['groups'] = [],
  field: SessionField,
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
  field: SessionField
): SeriesDataUnit[] {
  return compact(
    intervals.map((interval, i) => {
      const intervalTotalSessions = groups.reduce(
        (acc, group) => acc + group.series[field][i],
        0
      );

      const intervalCrashedSessions =
        groups.find(group => group.by['session.status'] === SessionStatus.CRASHED)
          ?.series[field][i] ?? 0;

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
  field: SessionField,
  status: SessionStatus
): SeriesDataUnit[] {
  return compact(
    intervals.map((interval, i) => {
      const intervalTotalSessions = groups.reduce(
        (acc, group) => acc + group.series[field][i],
        0
      );

      const intervalStatusSessions =
        groups.find(group => group.by['session.status'] === status)?.series[field][i] ??
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
  field: SessionField
): SeriesDataUnit[] {
  return intervals.map((interval, i) => {
    const intervalReleaseSessions = releaseGroups.reduce(
      (acc, group) => acc + group.series[field][i],
      0
    );
    const intervalTotalSessions = allGroups.reduce(
      (acc, group) => acc + group.series[field][i],
      0
    );

    const intervalAdoption = percent(intervalReleaseSessions, intervalTotalSessions);

    return {
      name: interval,
      value: Math.round(intervalAdoption),
    };
  });
}

type GetSessionsIntervalOptions = {
  highFidelity?: boolean;
};

export function getSessionsInterval(
  datetimeObj: DateTimeObject,
  {highFidelity}: GetSessionsIntervalOptions = {}
) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes > TWO_WEEKS) {
    return '1d';
  }
  if (diffInMinutes > ONE_WEEK) {
    return '6h';
  }

  // limit on backend for sub-hour session resolution is set to six hours
  if (highFidelity && diffInMinutes < 360) {
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
    const isBetween = moment(interval).isBetween(start, end, undefined, '[]');
    if (isBetween) {
      filteredIndexes.push(index);
    }

    return isBetween;
  });

  const groups = sessions.groups.map(group => {
    const series = {};
    const totals = {};
    Object.keys(group.series).forEach(field => {
      totals[field] = 0;
      series[field] = group.series[field].filter((value, index) => {
        const isBetween = filteredIndexes.includes(index);
        if (isBetween) {
          totals[field] = (totals[field] ?? 0) + value;
        }

        return isBetween;
      });
    });
    return {...group, series, totals};
  });

  return {
    start: intervals[0],
    end: intervals[intervals.length - 1],
    query: sessions.query,
    intervals,
    groups,
  };
}
