import moment from 'moment';

import {t} from 'sentry/locale';
import {Outcome, SeriesApi} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import commonTheme from 'sentry/utils/theme';

import {quantityField} from '.';

export function projectStatsToPredictedSeries(
  projectStats?: SeriesApi,
  client?: number,
  server?: number,
  specifiedClientRate?: number
): Series[] {
  if (!projectStats || !defined(client) || !defined(server)) {
    return [];
  }

  const clientRate = Math.max(Math.min(client, 1), 0);
  let serverRate = Math.max(Math.min(server, 1), 0);

  const commonSeriesConfig = {
    barMinHeight: 0,
    type: 'bar',
    stack: 'predictedUsage',
  };

  const seriesData: Record<
    'indexedAndProcessed' | 'processed' | 'discarded',
    Series['data']
  > = {
    indexedAndProcessed: [],
    processed: [],
    discarded: [],
  };

  (
    projectStats.intervals.map((interval, index) => {
      const result = {
        indexedAndProcessed: 0,
        processed: 0,
        discarded: 0,
      };
      projectStats.groups.forEach(group => {
        switch (group.by.outcome) {
          case Outcome.ACCEPTED:
            result.indexedAndProcessed += group.series[quantityField][index];
            break;
          case Outcome.CLIENT_DISCARD:
            result.discarded += group.series[quantityField][index];
            break;
          case Outcome.FILTERED:
            if (String(group.by.reason).startsWith('Sampled')) {
              result.processed += group.series[quantityField][index];
            }
            break;
          default:
          // We do not take invalid, rate_limited and other filtered into account
        }
      });
      return {
        interval: moment(interval).valueOf(),
        ...result,
      };
    }) as Array<
      Record<'indexedAndProcessed' | 'processed' | 'discarded' | 'interval', number>
    >
  ).forEach((bucket, index) => {
    const {indexedAndProcessed, processed, discarded, interval} = bucket;

    if (clientRate < serverRate!) {
      serverRate = clientRate;
    }

    let total = indexedAndProcessed + processed + discarded;

    if (defined(specifiedClientRate)) {
      // We assume that the clientDiscard is 0 and
      // calculate the discard client (SDK) bucket according to the specified client rate
      const newClientDiscard = total / specifiedClientRate - total;
      total += newClientDiscard;
    }

    const newSentClient = total * clientRate;
    const newDiscarded = total - newSentClient;
    const newIndexedAndProcessed =
      clientRate === 0 ? 0 : newSentClient * (serverRate! / clientRate);
    const newProcessed = newSentClient - newIndexedAndProcessed;

    seriesData.indexedAndProcessed[index] = {
      name: interval,
      value: Math.round(newIndexedAndProcessed),
    };
    seriesData.processed[index] = {
      name: interval,
      value: Math.round(newProcessed),
    };
    seriesData.discarded[index] = {
      name: interval,
      value: Math.round(newDiscarded),
    };
  });

  return [
    {
      seriesName: t('Indexed and Processed'),
      color: commonTheme.green300,
      ...commonSeriesConfig,
      data: seriesData.indexedAndProcessed,
    },
    {
      seriesName: t('Processed'),
      color: commonTheme.yellow300,
      data: seriesData.processed,
      ...commonSeriesConfig,
    },
    {
      seriesName: t('Discarded'),
      color: commonTheme.red300,
      data: seriesData.discarded,
      ...commonSeriesConfig,
    },
  ];
}
