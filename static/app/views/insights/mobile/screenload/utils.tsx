import type {Theme} from '@emotion/react';
import Color from 'color';

import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {YAxis} from 'sentry/views/insights/mobile/screenload/constants';
import {YAXIS_COLUMNS} from 'sentry/views/insights/mobile/screenload/constants';

export function isCrossPlatform(project: Project) {
  return project.platform && ['react-native', 'flutter'].includes(project.platform);
}

export function transformReleaseEvents({
  yAxes,
  primaryRelease,
  secondaryRelease,
  topTransactions,
  colorPalette,
  releaseEvents,
}: {
  colorPalette: string[] | readonly string[];
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
  const topTransactionsIndex = Object.fromEntries(
    topTransactions.map((e: any, i: any) => [e, i])
  );
  const transformedReleaseEvents = yAxes.reduce(
    (acc, yAxis) => ({...acc, [YAXIS_COLUMNS[yAxis]]: {}}),
    {}
  );

  yAxes.forEach(val => {
    [primaryRelease, secondaryRelease].filter(defined).forEach(release => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      transformedReleaseEvents[YAXIS_COLUMNS[val]][release] = {
        seriesName: release,
        data: new Array(topTransactions.length).fill(0),
      };
    });
  });

  if (defined(releaseEvents) && defined(primaryRelease)) {
    releaseEvents.data?.forEach((row: any) => {
      const release = row.release;
      const isPrimary = release === primaryRelease;
      const transaction = row.transaction;
      const index = topTransactionsIndex[transaction];
      yAxes.forEach(val => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (transformedReleaseEvents[YAXIS_COLUMNS[val]][release]) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

export function transformDeviceClassEvents({
  yAxes,
  primaryRelease,
  secondaryRelease,
  data,
  theme,
}: {
  theme: Theme;
  yAxes: YAxis[];
  data?: TableData;
  primaryRelease?: string;
  secondaryRelease?: string;
}): {
  [yAxisName: string]: {
    [releaseVersion: string]: Series;
  };
} {
  const transformedData = yAxes.reduce(
    (acc, yAxis) => ({...acc, [YAXIS_COLUMNS[yAxis]]: {}}),
    {}
  );

  yAxes.forEach(val => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    transformedData[YAXIS_COLUMNS[val]] = {};
    if (primaryRelease) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      transformedData[YAXIS_COLUMNS[val]][primaryRelease] = {
        seriesName: primaryRelease,
        data: new Array(['high', 'medium', 'low', 'Unknown'].length).fill(0),
      };
    }
    if (secondaryRelease) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      transformedData[YAXIS_COLUMNS[val]][secondaryRelease] = {
        seriesName: secondaryRelease,
        data: new Array(['high', 'medium', 'low', 'Unknown'].length).fill(0),
      };
    }
  });

  const deviceClassIndex = Object.fromEntries(
    ['high', 'medium', 'low', 'Unknown'].map((e, i) => [e, i])
  );

  if (defined(data)) {
    data.data?.forEach(row => {
      const deviceClass = row['device.class']!;
      const index = deviceClassIndex[deviceClass];

      const release = row.release;
      const isPrimary = release === primaryRelease;
      yAxes.forEach(val => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (transformedData[YAXIS_COLUMNS[val]][release]) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          transformedData[YAXIS_COLUMNS[val]][release].data[index] = {
            name: deviceClass,
            value: row[YAXIS_COLUMNS[val]],
            itemStyle: {
              color: isPrimary ? theme.chart.colors[3][0] : theme.chart.colors[3][1],
            },
          } as SeriesDataUnit;
        }
      });
    });
  }

  return transformedData;
}
