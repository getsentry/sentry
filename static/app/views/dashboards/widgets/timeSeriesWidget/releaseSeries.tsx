import type {Theme} from '@emotion/react';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {escape} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import {formatVersion} from 'sentry/utils/versions/formatVersion';

import type {Release} from '../common/types';

export function ReleaseSeries(
  theme: Theme,
  releases: Release[],
  onClick: (release: Release) => void,
  utc: boolean
): Series {
  return {
    seriesName: t('Releases'),
    color: theme.purple200,
    data: [],
    markLine: MarkLine({
      animation: false,
      lineStyle: {
        color: theme.purple300,
        opacity: 0.3,
        type: 'solid',
      },
      label: {
        show: false,
      },
      data: releases.map(release => ({
        xAxis: new Date(release.timestamp).getTime(),
        name: formatVersion(release.version, true),
        value: formatVersion(release.version, true),
        onClick: () => {
          onClick(release);
        },
        label: {
          formatter: () => formatVersion(release.version, true),
        },
      })),
      tooltip: {
        trigger: 'item',
        formatter: function (params: any) {
          const time = getFormattedDate(params.value, 'MMM D, YYYY LT', {
            local: utc,
          });

          const version = escape(formatVersion(params.name, true));

          return [
            '<div class="tooltip-series">',
            `<div><span class="tooltip-label"><strong>${t(
              'Release'
            )}</strong></span> ${version}</div>`,
            '</div>',
            '<div class="tooltip-footer">',
            time,
            '</div>',
            '<div class="tooltip-arrow"></div>',
          ].join('');
        },
      },
    }),
  };
}
