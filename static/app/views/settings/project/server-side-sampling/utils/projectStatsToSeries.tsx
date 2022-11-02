import cloneDeep from 'lodash/cloneDeep';
import moment from 'moment';

import {t} from 'sentry/locale';
import {Outcome, SeriesApi} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import commonTheme from 'sentry/utils/theme';

import {quantityField} from '.';

export function projectStatsToSeries(
  projectStats: SeriesApi | undefined,
  specifiedClientRate?: number
): Series[] {
  if (!projectStats) {
    return [];
  }

  const commonSeriesConfig = {
    barMinHeight: 0,
    type: 'bar',
    stack: 'usage',
  };

  const emptySeries = projectStats.intervals.map(interval => ({
    name: moment(interval).valueOf(),
    value: 0,
  }));

  const seriesData: Record<
    'indexedAndProcessed' | 'processed' | 'discarded',
    Series['data']
  > = {
    indexedAndProcessed: cloneDeep(emptySeries),
    processed: cloneDeep(emptySeries),
    discarded: cloneDeep(emptySeries),
  };

  projectStats.intervals.forEach((_interval, index) => {
    projectStats.groups.forEach(group => {
      switch (group.by.outcome) {
        case Outcome.ACCEPTED:
          seriesData.indexedAndProcessed[index].value +=
            group.series[quantityField][index];
          break;
        case Outcome.CLIENT_DISCARD:
          seriesData.discarded[index].value += group.series[quantityField][index];
          break;
        case Outcome.FILTERED:
          if (String(group.by.reason).startsWith('Sampled')) {
            seriesData.processed[index].value += group.series[quantityField][index];
          }
          break;
        default:
        // We do not take invalid, rate_limited and other filtered into account
      }
    });
  });

  if (defined(specifiedClientRate)) {
    // We assume that the clientDiscard is 0 and
    // calculate the discard client (SDK) bucket according to the specified client rate
    seriesData.discarded = seriesData.discarded.map((bucket, index) => {
      const totalHitServer =
        seriesData.indexedAndProcessed[index].value + seriesData.processed[index].value;

      return {
        ...bucket,
        value: totalHitServer / specifiedClientRate - totalHitServer,
      };
    });
  }

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
