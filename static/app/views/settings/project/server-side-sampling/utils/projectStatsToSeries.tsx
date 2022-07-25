import cloneDeep from 'lodash/cloneDeep';
import moment from 'moment';

import {t} from 'sentry/locale';
import {SeriesApi} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import commonTheme from 'sentry/utils/theme';
import {Outcome} from 'sentry/views/organizationStats/types';
import {
  COLOR_DROPPED,
  COLOR_TRANSACTIONS,
} from 'sentry/views/organizationStats/usageChart';

import {quantityField} from '.';

export function projectStatsToSeries(projectStats: SeriesApi | undefined): Series[] {
  if (!projectStats) {
    return [];
  }

  const commonSeriesConfig = {
    barMinHeight: 1,
    type: 'bar',
    stack: 'usage',
  };

  const emptySeries = projectStats.intervals.map(interval => ({
    name: moment(interval).valueOf(),
    value: 0,
  }));

  const seriesData: Record<string, Series['data']> = {
    accepted: cloneDeep(emptySeries),
    droppedServer: cloneDeep(emptySeries),
    droppedClient: cloneDeep(emptySeries),
  };

  projectStats.intervals.forEach((_interval, index) => {
    projectStats.groups.forEach(group => {
      switch (group.by.outcome) {
        case Outcome.ACCEPTED:
          seriesData.accepted[index].value += group.series[quantityField][index];
          break;
        case Outcome.CLIENT_DISCARD:
          seriesData.droppedClient[index].value += group.series[quantityField][index];
          break;
        case Outcome.DROPPED:
        case Outcome.FILTERED:
        case Outcome.INVALID:
        case Outcome.RATE_LIMITED:
          seriesData.droppedServer[index].value += group.series[quantityField][index];
          break;
        default:
        // We do not care about other outcomes (right now there no other outcomes)
      }
    });
  });

  return [
    {
      seriesName: t('Indexed'),
      color: COLOR_TRANSACTIONS,
      ...commonSeriesConfig,
      data: seriesData.accepted,
    },
    {
      seriesName: t('Processed'),
      color: COLOR_DROPPED,
      data: seriesData.droppedServer,
      ...commonSeriesConfig,
    },
    {
      seriesName: t('Dropped'),
      color: commonTheme.yellow300,
      data: seriesData.droppedClient,
      ...commonSeriesConfig,
    },
  ];
}
