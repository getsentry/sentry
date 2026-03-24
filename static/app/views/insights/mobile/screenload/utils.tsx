import type {Theme} from '@emotion/react';

import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type {YAxis} from 'sentry/views/insights/mobile/screenload/constants';
import {YAXIS_COLUMNS} from 'sentry/views/insights/mobile/screenload/constants';
import type {SpanResponse} from 'sentry/views/insights/types';

export function isCrossPlatform(project: Project) {
  return project.platform && ['react-native', 'flutter'].includes(project.platform);
}

export function transformDeviceClassEvents({
  yAxes,
  primaryRelease,
  data,
  theme,
}: {
  theme: Theme;
  yAxes: YAxis[];
  data?: Array<Partial<SpanResponse> & Pick<SpanResponse, 'device.class'>>;
  primaryRelease?: string;
}): Record<string, Record<string, Series>> {
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
    } else {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      transformedData[YAXIS_COLUMNS[val]].all = {
        seriesName: 'all',
        data: new Array(['high', 'medium', 'low', 'Unknown'].length).fill(0),
      };
    }
  });

  const deviceClassIndex = Object.fromEntries(
    ['high', 'medium', 'low', 'Unknown'].map((e, i) => [e, i])
  );

  if (defined(data)) {
    data?.forEach(row => {
      const deviceClass = row['device.class'];
      const index = deviceClassIndex[deviceClass];

      const release = row.release || 'all';
      const isPrimary = release === 'all' || release === primaryRelease;

      yAxes.forEach(val => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (transformedData[YAXIS_COLUMNS[val]][release]) {
          const colors = theme.chart.getColorPalette(4);
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          transformedData[YAXIS_COLUMNS[val]][release].data[index] = {
            name: deviceClass,
            value: row[YAXIS_COLUMNS[val]],
            itemStyle: {
              color: isPrimary ? colors[0] : colors[1],
            },
          } as SeriesDataUnit;
        }
      });
    });
  }

  return transformedData;
}
