import type {Theme} from '@emotion/react';
import type {CustomSeriesOption} from 'echarts';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import {escape} from 'sentry/utils';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import type {Release} from 'sentry/views/dashboards/widgets/common/types';

export function ReleaseSeries(
  theme: Theme,
  releases: Release[],
  onClick: (release: Release) => void,
  utc: boolean
): CustomSeriesOption {
  return {
    type: 'custom',
    id: 'release-lines',
    name: t('Releases'),
    renderItem: () => null,
    color: theme.colors.blue200,
    data: [],
    markLine: MarkLine({
      animation: false,
      lineStyle: {
        color: theme.colors.blue400,
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
          const time = getFormattedDate(
            params.value,
            getFormat({timeZone: true, year: true}),
            {
              local: utc,
            }
          );

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
