import {
  DateTimeObject,
  getDiffInMinutes,
  ONE_WEEK,
  TWO_WEEKS,
} from 'app/components/charts/utils';
import {SessionApiResponse, SessionField} from 'app/types';
import {SeriesDataUnit} from 'app/types/echarts';
import {defined, percent} from 'app/utils';
import {getCrashFreePercent} from 'app/views/releases/utils';

export function getCount(groups: SessionApiResponse['groups'] = [], field: SessionField) {
  return groups.reduce((acc, group) => acc + group.totals[field], 0);
}

export function getCrashCount(
  groups: SessionApiResponse['groups'] = [],
  field: SessionField
) {
  return getCount(
    groups.filter(({by}) => by['session.status'] === 'crashed'),
    field
  );
}

export function getCrashFreeRate(
  groups: SessionApiResponse['groups'] = [],
  field: SessionField
) {
  const totalCount = groups.reduce((acc, group) => acc + group.totals[field], 0);

  const crashedCount = getCrashCount(groups, field);

  return !defined(totalCount) || totalCount === 0
    ? null
    : getCrashFreePercent(100 - percent(crashedCount ?? 0, totalCount ?? 0));
}

export function getCrashFreeSeries(
  groups: SessionApiResponse['groups'] = [],
  intervals: SessionApiResponse['intervals'] = [],
  field: SessionField
): SeriesDataUnit[] {
  return intervals.map((interval, i) => {
    const intervalTotalSessions = groups.reduce(
      (acc, group) => acc + group.series[field][i],
      0
    );

    const intervalCrashedSessions =
      groups.find(group => group.by['session.status'] === 'crashed')?.series[field][i] ??
      0;

    const crashedSessionsPercent = percent(
      intervalCrashedSessions,
      intervalTotalSessions
    );

    return {
      name: interval,
      value:
        intervalTotalSessions === 0
          ? (null as any)
          : getCrashFreePercent(100 - crashedSessionsPercent),
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
