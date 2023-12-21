import Color from 'color';

import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/starfish/views/screens';

export function transformReleaseEvents({
  yAxes,
  primaryRelease,
  secondaryRelease,
  topTransactions,
  colorPalette,
  releaseEvents,
}: {
  colorPalette: string[];
  releaseEvents: any;
  topTransactions: any;
  yAxes: YAxis[];
  primaryRelease?: string;
  secondaryRelease?: string;
}): {
  [yAxisName: string]: {
    [releaseVersion: string]: Series;
  };
} {
  const topTransactionsIndex = Object.fromEntries(topTransactions.map((e, i) => [e, i]));
  const transformedReleaseEvents = yAxes.reduce(
    (acc, yAxis) => ({...acc, [YAXIS_COLUMNS[yAxis]]: {}}),
    {}
  );

  yAxes.forEach(val => {
    [primaryRelease, secondaryRelease].filter(defined).forEach(release => {
      transformedReleaseEvents[YAXIS_COLUMNS[val]][release] = {
        seriesName: release,
        data: Array(topTransactions.length).fill(0),
      };
    });
  });

  if (defined(releaseEvents) && defined(primaryRelease)) {
    releaseEvents.data?.forEach(row => {
      const release = row.release;
      const isPrimary = release === primaryRelease;
      const transaction = row.transaction;
      const index = topTransactionsIndex[transaction];
      yAxes.forEach(val => {
        if (transformedReleaseEvents[YAXIS_COLUMNS[val]][release]) {
          transformedReleaseEvents[YAXIS_COLUMNS[val]][release].data[index] = {
            name: row.transaction,
            value: row[YAXIS_COLUMNS[val]],
            itemStyle: {
              color: isPrimary
                ? colorPalette[index]
                : Color(colorPalette[index]).lighten(0.3).string(),
            },
          } as SeriesDataUnit;
        }
      });
    });
  }

  return transformedReleaseEvents;
}
