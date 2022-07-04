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

import {field} from '.';

export function projectStatsToSeries(projectStats: SeriesApi | undefined): Series[] {
  if (!projectStats) {
    return [];
  }

  const commonSeriesConfig = {
    barMinHeight: 1,
    type: 'bar',
    stack: 'usage',
  };

  const seriesData: Record<string, Series['data']> = {
    accepted: [],
    droppedServer: [],
    droppedClient: [],
  };

  projectStats.intervals.forEach((interval, index) => {
    projectStats.groups.forEach(group => {
      switch (group.by.outcome) {
        case Outcome.ACCEPTED:
          seriesData.accepted[index] = {
            name: moment(interval).valueOf(),
            value: (seriesData.accepted[index]?.value ?? 0) + group.series[field][index],
          };
          break;
        case Outcome.CLIENT_DISCARD:
          seriesData.droppedClient[index] = {
            name: moment(interval).valueOf(),
            value:
              (seriesData.droppedClient[index]?.value ?? 0) + group.series[field][index],
          };
          break;
        case Outcome.DROPPED:
        case Outcome.FILTERED:
        case Outcome.INVALID:
        case Outcome.RATE_LIMITED:
          seriesData.droppedServer[index] = {
            name: moment(interval).valueOf(),
            value:
              (seriesData.droppedServer[index]?.value ?? 0) + group.series[field][index],
          };
          break;
        default:
        //
      }
    });
  });

  return [
    {
      seriesName: t('Accepted'),
      color: COLOR_TRANSACTIONS,
      ...commonSeriesConfig,
      data: seriesData.accepted,
    },
    {
      seriesName: t('Dropped (Server)'),
      color: COLOR_DROPPED,
      data: seriesData.droppedServer,
      ...commonSeriesConfig,
    },
    {
      seriesName: t('Dropped (Client)'),
      color: commonTheme.yellow300,
      data: seriesData.droppedClient,
      ...commonSeriesConfig,
    },
  ];
}
