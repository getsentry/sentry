import moment from 'moment';

import {t} from 'sentry/locale';
import {SeriesApi} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import commonTheme from 'sentry/utils/theme';
import {Outcome} from 'sentry/views/organizationStats/types';
import {
  COLOR_DROPPED,
  COLOR_TRANSACTIONS,
} from 'sentry/views/organizationStats/usageChart';

import {quantityField} from '.';

export function projectStatsToPredictedSeries(
  projectStats?: SeriesApi,
  clientRate?: number,
  serverRate?: number
): Series[] {
  if (!projectStats || !defined(clientRate) || !defined(serverRate)) {
    return [];
  }

  const commonSeriesConfig = {
    barMinHeight: 1,
    type: 'bar',
    stack: 'predictedUsage',
  };

  const seriesData: Record<string, Series['data']> = {
    accepted: [],
    droppedServer: [],
    droppedClient: [],
  };

  (
    projectStats.intervals.map((interval, index) => {
      const result = {};
      projectStats.groups.forEach(group => {
        result[group.by.outcome] = group.series[quantityField][index];
      });
      return {
        interval,
        ...result,
      };
    }) as Array<Record<Partial<Outcome>, number> & {interval: string}>
  ).forEach((bucket, index) => {
    const {
      accepted = 0,
      filtered = 0,
      invalid = 0,
      dropped = 0,
      rate_limited: rateLimited = 0,
      client_discard: clientDiscard = 0,
      interval,
    } = bucket;

    const total = accepted + filtered + invalid + dropped + rateLimited + clientDiscard;
    const newSentClient = clientRate * total;
    const droppedClient = total - newSentClient;
    const validEvents = newSentClient - (filtered + invalid + rateLimited);
    const newAccepted = serverRate * validEvents;
    const droppedServer = newSentClient - newAccepted;

    const name = moment(interval).valueOf();
    seriesData.accepted[index] = {
      name,
      value: Math.round(newAccepted),
    };
    seriesData.droppedServer[index] = {
      name,
      value: Math.round(droppedServer),
    };
    seriesData.droppedClient[index] = {
      name,
      value: Math.round(droppedClient),
    };
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
