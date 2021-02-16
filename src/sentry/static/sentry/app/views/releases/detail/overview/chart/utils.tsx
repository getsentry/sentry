import {DateTimeObject, getDiffInMinutes, TWO_WEEKS} from 'app/components/charts/utils';
import CHART_PALETTE from 'app/constants/chartPalette';
import {t} from 'app/locale';
import {GlobalSelection, NewQuery, Organization} from 'app/types';
import {Series} from 'app/types/echarts';
import {escapeDoubleQuotes} from 'app/utils';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {formatVersion} from 'app/utils/formatters';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {WEB_VITAL_DETAILS} from 'app/views/performance/transactionVitals/constants';
import {sessionTerm} from 'app/views/releases/utils/sessionTerm';

import {EventType, YAxis} from './releaseChartControls';

type ChartData = Record<string, Series>;

export function getInterval(datetimeObj: DateTimeObject) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

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
        query: stringifyQueryObject(
          new QueryResults(
            ['event.type:transaction', releaseFilter, ...statusFilters].filter(Boolean)
          )
        ),
      });
    case YAxis.COUNT_VITAL:
    case YAxis.COUNT_DURATION:
      const column = yAxis === YAxis.COUNT_DURATION ? 'transaction.duration' : vitalType;
      const threshold =
        yAxis === YAxis.COUNT_DURATION
          ? organization?.apdexThreshold
          : WEB_VITAL_DETAILS[vitalType].failureThreshold;
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: stringifyQueryObject(
          new QueryResults(
            [
              'event.type:transaction',
              releaseFilter,
              threshold ? `${column}:>${threshold}` : '',
            ].filter(Boolean)
          )
        ),
      });
    case YAxis.EVENTS:
      const eventTypeFilter =
        eventType === EventType.ALL ? '' : `event.type:${eventType}`;
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: stringifyQueryObject(
          new QueryResults([releaseFilter, eventTypeFilter].filter(Boolean))
        ),
      });
    default:
      return EventView.fromSavedQuery({
        ...baseQuery,
        fields: ['title', 'count()', 'event.type', 'issue', 'last_seen()'],
        query: stringifyQueryObject(
          new QueryResults([`release:${version}`, '!event.type:transaction'])
        ),
        orderby: '-last_seen',
      });
  }
}

export function initSessionsBreakdownChartData(): ChartData {
  return {
    crashed: {
      seriesName: sessionTerm.crashed,
      data: [],
      color: CHART_PALETTE[3][2],
      areaStyle: {
        color: CHART_PALETTE[3][2],
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
      color: CHART_PALETTE[3][1],
      areaStyle: {
        color: CHART_PALETTE[3][1],
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
      color: CHART_PALETTE[3][0],
      areaStyle: {
        color: CHART_PALETTE[3][0],
        opacity: 1,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
    healthy: {
      seriesName: sessionTerm.healthy,
      data: [],
      color: CHART_PALETTE[3][3],
      areaStyle: {
        color: CHART_PALETTE[3][3],
        opacity: 1,
      },
      lineStyle: {
        opacity: 0,
        width: 0.4,
      },
    },
  };
}

export function initCrashFreeChartData(): ChartData {
  return {
    users: {
      seriesName: sessionTerm['crash-free-users'],
      data: [],
      color: CHART_PALETTE[1][0],
    },
    sessions: {
      seriesName: sessionTerm['crash-free-sessions'],
      data: [],
      color: CHART_PALETTE[1][1],
    },
  };
}

export function initSessionDurationChartData(): ChartData {
  return {
    duration: {
      seriesName: t('Session Duration'),
      data: [],
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
