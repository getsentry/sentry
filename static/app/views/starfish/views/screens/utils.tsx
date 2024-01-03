import Color from 'color';

import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Project} from 'sentry/types';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/starfish/views/screens';

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

export function transformDeviceClassEvents({
  yAxes,
  primaryRelease,
  secondaryRelease,
  data,
}: {
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
    transformedData[YAXIS_COLUMNS[val]] = {};
    if (primaryRelease) {
      transformedData[YAXIS_COLUMNS[val]][primaryRelease] = {
        seriesName: primaryRelease,
        data: Array(['high', 'medium', 'low', 'Unknown'].length).fill(0),
      };
    }
    if (secondaryRelease) {
      transformedData[YAXIS_COLUMNS[val]][secondaryRelease] = {
        seriesName: secondaryRelease,
        data: Array(['high', 'medium', 'low', 'Unknown'].length).fill(0),
      };
    }
  });

  const deviceClassIndex = Object.fromEntries(
    ['high', 'medium', 'low', 'Unknown'].map((e, i) => [e, i])
  );

  if (defined(data)) {
    data.data?.forEach(row => {
      const deviceClass = row['device.class'];
      const index = deviceClassIndex[deviceClass];

      const release = row.release;
      const isPrimary = release === primaryRelease;
      yAxes.forEach(val => {
        if (transformedData[YAXIS_COLUMNS[val]][release]) {
          transformedData[YAXIS_COLUMNS[val]][release].data[index] = {
            name: deviceClass,
            value: row[YAXIS_COLUMNS[val]],
            itemStyle: {
              color: isPrimary ? CHART_PALETTE[3][0] : CHART_PALETTE[3][1],
            },
          } as SeriesDataUnit;
        }
      });
    });
  }

  return transformedData;
}
