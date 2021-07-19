import color from 'color';

import {DateTimeObject, getDiffInMinutes, TWO_WEEKS} from 'app/components/charts/utils';
import CHART_PALETTE from 'app/constants/chartPalette';
import {t} from 'app/locale';
import {GlobalSelection, NewQuery, Organization, SessionApiResponse} from 'app/types';
import {Series} from 'app/types/echarts';
import {escapeDoubleQuotes, percent} from 'app/utils';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {formatVersion} from 'app/utils/formatters';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {Theme} from 'app/utils/theme';
import {QueryResults} from 'app/utils/tokenizeSearch';
import {getCrashFreePercent} from 'app/views/releases/utils';
import {sessionTerm} from 'app/views/releases/utils/sessionTerm';

import {EventType, YAxis} from './releaseChartControls';

type ChartData = Record<string, Series>;

type GetIntervalOptions = {
  highFidelity?: boolean;
};

export function getInterval(
  datetimeObj: DateTimeObject,
  {highFidelity}: GetIntervalOptions = {}
) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (
    highFidelity &&
    diffInMinutes < 360 // limit on backend is set to six hour
  ) {
    return '5m';
  }

  if (diffInMinutes > TWO_WEEKS) {
    return '6h';
  } else {
    return '1h';
  }
}

export function getReleaseEventView(
  selection: GlobalSelection,
  version: string,
  yAxis?: YAxis,
  eventType: EventType = EventType.ALL,
  vitalType: WebVital = WebVital.LCP,
  organization?: Organization,
  /**
   * Indicates that we're only interested in the current release.
   * This is useful for the event meta end point where we don't want
   * to include the other releases.
   */
  currentOnly?: boolean
): EventView {
  const {projects, environments, datetime} = selection;
  const {start, end, period} = datetime;
  const releaseFilter = currentOnly ? `release:${version}` : '';
  const toOther = `to_other(release,"${escapeDoubleQuotes(version)}",others,current)`;
  // this orderby ensures that the order is [others, current]
  const toOtherAlias = getAggregateAlias(toOther);

  const baseQuery: Omit<NewQuery, 'query'> = {
    id: undefined,
    version: 2,
    name: `${t('Release')} ${formatVersion(version)}`,
    fields: [`count()`, toOther],
    orderby: toOtherAlias,
    range: period,
    environment: environments,
    projects,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
  };

  switch (yAxis) {
    case YAxis.FAILED_TRANSACTIONS:
      const statusFilters = ['ok', 'cancelled', 'unknown'].map(
        s => `!transaction.status:${s}`
      );
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: new QueryResults(
          ['event.type:transaction', releaseFilter, ...statusFilters].filter(Boolean)
        ).formatString(),
      });
    case YAxis.COUNT_VITAL:
    case YAxis.COUNT_DURATION:
      const column = yAxis === YAxis.COUNT_DURATION ? 'transaction.duration' : vitalType;
      const threshold =
        yAxis === YAxis.COUNT_DURATION
          ? organization?.apdexThreshold
          : WEB_VITAL_DETAILS[vitalType].poorThreshold;
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: new QueryResults(
          [
            'event.type:transaction',
            releaseFilter,
            threshold ? `${column}:>${threshold}` : '',
          ].filter(Boolean)
        ).formatString(),
      });
    case YAxis.EVENTS:
      const eventTypeFilter =
        eventType === EventType.ALL ? '' : `event.type:${eventType}`;
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: new QueryResults(
          [releaseFilter, eventTypeFilter].filter(Boolean)
        ).formatString(),
      });
    default:
      return EventView.fromSavedQuery({
        ...baseQuery,
        fields: ['issue', 'title', 'count()', 'count_unique(user)', 'project'],
        query: new QueryResults([
          `release:${version}`,
          '!event.type:transaction',
        ]).formatString(),
        orderby: '-count',
      });
  }
}

export function initSessionsBreakdownChartData(theme: Theme): ChartData {
  const colors = theme.charts.getColorPalette(14);
  return {
    healthy: {
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
    errored: {
      seriesName: sessionTerm.errored,
      data: [],
      color: colors[12],
      areaStyle: {
        color: colors[12],
        opacity: 1,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    abnormal: {
      seriesName: sessionTerm.abnormal,
      data: [],
      color: colors[15],
      areaStyle: {
        color: colors[15],
        opacity: 1,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    crashed: {
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

export function initOtherSessionsBreakdownChartData(theme: Theme): ChartData {
  const colors = theme.charts.getColorPalette(14);
  return {
    healthy: {
      seriesName: sessionTerm.otherHealthy,
      data: [],
      color: theme.green300,
      areaStyle: {
        color: theme.green300,
        opacity: 0.3,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    errored: {
      seriesName: sessionTerm.otherErrored,
      data: [],
      color: colors[12],
      areaStyle: {
        color: colors[12],
        opacity: 0.3,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    abnormal: {
      seriesName: sessionTerm.otherAbnormal,
      data: [],
      color: colors[15],
      areaStyle: {
        color: colors[15],
        opacity: 0.3,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    crashed: {
      seriesName: sessionTerm.otherCrashed,
      data: [],
      color: theme.red300,
      areaStyle: {
        color: theme.red300,
        opacity: 0.3,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    ...initOtherReleasesChartData(),
  };
}

export function initCrashFreeChartData(): ChartData {
  return {
    users: {
      seriesName: sessionTerm['crash-free-users'],
      data: [],
      color: CHART_PALETTE[1][0],
      lineStyle: {
        color: CHART_PALETTE[1][0],
      },
    },
    sessions: {
      seriesName: sessionTerm['crash-free-sessions'],
      data: [],
      color: CHART_PALETTE[1][1],
      lineStyle: {
        color: CHART_PALETTE[1][1],
      },
    },
  };
}

export function initOtherCrashFreeChartData(): ChartData {
  return {
    ...initOtherReleasesChartData(),
    users: {
      seriesName: sessionTerm.otherCrashFreeUsers,
      data: [],
      z: 0,
      color: color(CHART_PALETTE[1][0]).lighten(0.9).alpha(0.9).string(),
      lineStyle: {
        color: CHART_PALETTE[1][0],
        opacity: 0.1,
      },
    },
    sessions: {
      seriesName: sessionTerm.otherCrashFreeSessions,
      data: [],
      z: 0,
      color: color(CHART_PALETTE[1][1]).lighten(0.5).alpha(0.9).string(),
      lineStyle: {
        color: CHART_PALETTE[1][1],
        opacity: 0.3,
      },
    },
  };
}

export function initSessionDurationChartData(): ChartData {
  return {
    0: {
      seriesName: sessionTerm.duration,
      data: [],
      color: CHART_PALETTE[0][0],
      areaStyle: {
        color: CHART_PALETTE[0][0],
        opacity: 1,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
  };
}

export function initOtherSessionDurationChartData(): ChartData {
  return {
    0: {
      seriesName: sessionTerm.otherReleases,
      data: [],
      z: 0,
      color: color(CHART_PALETTE[0][0]).alpha(0.4).string(),
      areaStyle: {
        color: CHART_PALETTE[0][0],
        opacity: 0.3,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
  };
}

// this series will never be filled with data - we use it to act as an alias in legend (we don't display other healthy, other crashes, etc. there)
// if you click on it, we toggle all "other" series (other healthy, other crashed, ...)
function initOtherReleasesChartData(): ChartData {
  return {
    otherReleases: {
      seriesName: sessionTerm.otherReleases,
      data: [],
      color: color(CHART_PALETTE[0][0]).alpha(0.4).string(),
    },
  };
}

export function isOtherSeries(series: Series) {
  return [
    sessionTerm.otherCrashed,
    sessionTerm.otherAbnormal,
    sessionTerm.otherErrored,
    sessionTerm.otherHealthy,
    sessionTerm.otherCrashFreeUsers,
    sessionTerm.otherCrashFreeSessions,
  ].includes(series.seriesName);
}

const seriesOrder = [
  sessionTerm.healthy,
  sessionTerm.errored,
  sessionTerm.crashed,
  sessionTerm.abnormal,
  sessionTerm.otherHealthy,
  sessionTerm.otherErrored,
  sessionTerm.otherCrashed,
  sessionTerm.otherAbnormal,
  sessionTerm.duration,
  sessionTerm['crash-free-sessions'],
  sessionTerm['crash-free-users'],
  sessionTerm.otherCrashFreeSessions,
  sessionTerm.otherCrashFreeUsers,
  sessionTerm.otherReleases,
];

export function sortSessionSeries(a: Series, b: Series) {
  return seriesOrder.indexOf(a.seriesName) - seriesOrder.indexOf(b.seriesName);
}

type GetTotalsFromSessionsResponseProps = {
  response: SessionApiResponse;
  field: string;
};

export function getTotalsFromSessionsResponse({
  response,
  field,
}: GetTotalsFromSessionsResponseProps) {
  return response.groups.reduce((acc, group) => {
    return acc + group.totals[field];
  }, 0);
}

type FillChartDataFromSessionsResponseProps = {
  response: SessionApiResponse;
  field: string;
  groupBy: string | null;
  chartData: ChartData;
  valueFormatter?: (value: number) => number;
};

export function fillChartDataFromSessionsResponse({
  response,
  field,
  groupBy,
  chartData,
  valueFormatter,
}: FillChartDataFromSessionsResponseProps) {
  response.intervals.forEach((interval, index) => {
    response.groups.forEach(group => {
      const value = group.series[field][index];

      chartData[groupBy === null ? 0 : group.by[groupBy]].data.push({
        name: interval,
        value: typeof valueFormatter === 'function' ? valueFormatter(value) : value,
      });
    });
  });

  return chartData;
}

type FillCrashFreeChartDataFromSessionsReponseProps = {
  response: SessionApiResponse;
  field: string;
  entity: 'sessions' | 'users';
  chartData: ChartData;
};

export function fillCrashFreeChartDataFromSessionsReponse({
  response,
  field,
  entity,
  chartData,
}: FillCrashFreeChartDataFromSessionsReponseProps) {
  response.intervals.forEach((interval, index) => {
    const intervalTotalSessions = response.groups.reduce(
      (acc, group) => acc + group.series[field][index],
      0
    );

    const intervalCrashedSessions =
      response.groups.find(group => group.by['session.status'] === 'crashed')?.series[
        field
      ][index] ?? 0;

    const crashedSessionsPercent = percent(
      intervalCrashedSessions,
      intervalTotalSessions
    );

    chartData[entity].data.push({
      name: interval,
      value:
        intervalTotalSessions === 0
          ? (null as any)
          : getCrashFreePercent(100 - crashedSessionsPercent),
    });
  });

  return chartData;
}
