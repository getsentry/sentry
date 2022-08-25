import {Client} from 'sentry/api';
import {
  CHART_TYPE_TO_YAXIS_MAP,
  Organization,
  PageFilters,
  ReleaseComparisonChartType,
  ReleaseWithHealth,
  SessionApiResponse,
  SessionDisplayTags,
  SessionDisplayYAxis,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import withApi from 'sentry/utils/withApi';
import {transformSessionsResponseToSeries} from 'sentry/views/dashboardsV2/widgetCard/transformSessionsResponseToSeries';

import ReleaseChart from './releaseChart';

type Props = {
  api: Client;
  conditions: string;
  crashRates: SessionApiResponse | null;
  errored: boolean;
  groupBy: SessionDisplayTags;
  loading: boolean;
  organization: Organization;
  release: ReleaseWithHealth;
  releaseSessions: SessionApiResponse | null;
  selectedDisplay: string;
  selection: PageFilters;
};

function ReleaseChartContainer({
  groupBy,
  selectedDisplay,
  selection,
  releaseSessions,
  loading,
  crashRates,
}: Props) {
  const yAxis =
    CHART_TYPE_TO_YAXIS_MAP[selectedDisplay] ?? SessionDisplayYAxis.CRASHED_SESSION_RATE;
  let cachedSeriesResult: Series[] = [];

  const releaseComparisonChart = selectedDisplay as ReleaseComparisonChartType;

  function getRequestedStatus() {
    switch (releaseComparisonChart) {
      case ReleaseComparisonChartType.CRASHED_USERS:
      case ReleaseComparisonChartType.CRASHED_SESSIONS:
        return 'crashed';
      case ReleaseComparisonChartType.ERRORED_SESSIONS:
      case ReleaseComparisonChartType.ERRORED_USERS:
        return 'errored';
      case ReleaseComparisonChartType.ABNORMAL_SESSIONS:
      case ReleaseComparisonChartType.ABNORMAL_USERS:
        return 'abnormal';
      case ReleaseComparisonChartType.HEALTHY_SESSIONS:
      case ReleaseComparisonChartType.HEALTHY_USERS:
      default:
        return 'healthy';
    }
  }

  if (releaseSessions) {
    if (
      [
        ReleaseComparisonChartType.HEALTHY_SESSIONS,
        ReleaseComparisonChartType.ABNORMAL_SESSIONS,
        ReleaseComparisonChartType.ERRORED_SESSIONS,
        ReleaseComparisonChartType.CRASHED_SESSIONS,
        ReleaseComparisonChartType.HEALTHY_USERS,
        ReleaseComparisonChartType.ABNORMAL_USERS,
        ReleaseComparisonChartType.ERRORED_USERS,
        ReleaseComparisonChartType.CRASHED_USERS,
      ].includes(releaseComparisonChart)
    ) {
      const requestedStatus = getRequestedStatus();
      const filteredSessions = {
        ...releaseSessions,
        groups: releaseSessions.groups.filter(
          group => group.by['session.status'] === requestedStatus
        ),
      };
      cachedSeriesResult = transformSessionsResponseToSeries(filteredSessions, [], []);
    } else if (
      [
        ReleaseComparisonChartType.SESSION_COUNT,
        ReleaseComparisonChartType.USER_COUNT,
      ].includes(releaseComparisonChart)
    ) {
      const groupValues = new Set(releaseSessions.groups.map(group => group.by[groupBy]));
      const newGroups: SessionApiResponse['groups'] = [];
      for (const tagValue of groupValues) {
        const newGroup = {
          by: {},
          totals: {},
          series: {},
        };
        newGroup.by[groupBy] = tagValue;
        newGroup.totals[yAxis] = 0;
        newGroup.series[yAxis] = Array(releaseSessions.intervals.length).fill(0);
        for (const group of releaseSessions.groups) {
          if (group.by[groupBy] === tagValue) {
            newGroup.totals[yAxis] = newGroup.totals[yAxis] + group.totals[yAxis];
            newGroup.series[yAxis] = newGroup.series[yAxis].map(
              (x, i) => x + group.series[yAxis][i]
            );
          }
        }
        newGroups.push(newGroup);
      }
      const summedSessions = {
        ...releaseSessions,
        groups: newGroups,
      };
      cachedSeriesResult = transformSessionsResponseToSeries(summedSessions, [], []);
    } else if (releaseComparisonChart === ReleaseComparisonChartType.SESSION_DURATION) {
      const groupValues = new Set(releaseSessions.groups.map(group => group.by[groupBy]));
      const newGroups: SessionApiResponse['groups'] = [];
      for (const tagValue of groupValues) {
        const newGroup = {
          by: {},
          totals: {},
          series: {},
        };
        newGroup.by[groupBy] = tagValue;
        newGroup.totals[yAxis] = 0;
        newGroup.series[yAxis] = Array(releaseSessions.intervals.length).fill(0);
        const counts = {};
        counts[yAxis] = Array(releaseSessions.intervals.length).fill(0);
        for (const group of releaseSessions.groups) {
          if (group.by[groupBy] === tagValue) {
            newGroup.totals[yAxis] = newGroup.totals[yAxis] + group.totals[yAxis];
            counts[yAxis] = counts[yAxis].map(
              (x, i) => x + group.series['sum(session)'][i]
            );
            newGroup.series[yAxis] = newGroup.series[yAxis].map((x, i) => {
              if (group.series['sum(session)'][i] === null) {
                return 0;
              }
              return (
                (x * counts[yAxis][i] +
                  group.series[yAxis][i] * group.series['sum(session)'][i]) /
                  (counts[yAxis][i] + group.series['sum(session)'][i]) ?? 0
              );
            });
          }
        }
        newGroups.push(newGroup);
      }
      const summedSessions = {
        ...releaseSessions,
        groups: newGroups,
      };
      cachedSeriesResult = transformSessionsResponseToSeries(summedSessions, [], []);
    } else if (crashRates) {
      const newGroups: SessionApiResponse['groups'] = [];
      for (const group of crashRates.groups) {
        const newGroup = {
          by: {},
          totals: {},
          series: {},
        };
        newGroup.by = group.by;
        newGroup.totals[yAxis] = group.totals[yAxis];
        newGroup.series[yAxis] = group.series[yAxis];
        newGroups.push(newGroup);
      }
      const crashedSessions = {
        ...crashRates,
        groups: newGroups,
      };
      cachedSeriesResult = transformSessionsResponseToSeries(crashedSessions, [], []);
    }
  }

  return (
    <ReleaseChart
      loading={loading}
      series={cachedSeriesResult ?? []}
      yAxis={yAxis}
      selection={selection}
    />
  );
}

export default withApi(ReleaseChartContainer);
