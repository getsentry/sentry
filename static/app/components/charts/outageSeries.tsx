import type {SeriesOption} from 'echarts';

import {t} from 'sentry/locale';
import {escape} from 'sentry/utils';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import type {Theme} from 'sentry/utils/theme';

export enum Severity {
  MAINTENANCE = 'maintenance',
  MINOR = 'minor',
  MAJOR = 'major',
  CRITICAL = 'critical',
}

export interface Outage {
  // Useful for generating links
  hostId: string;
  id: number;
  regionId: string;
  severity: Severity;
  start: number;
  title: string;
  end?: number;
}

function getOutageColor(severity: Severity, theme: Theme): string {
  switch (severity) {
    case 'maintenance':
      return theme.outageSeries.maintenance;
    case 'minor':
      return theme.outageSeries.minor;
    case 'major':
      return theme.outageSeries.major;
    case 'critical':
      return theme.outageSeries.critical;
    default:
      return theme.outageSeries.maintenance;
  }
}

export function OutageSeries(
  theme: Theme,
  outages: Outage[],
  onClick?: (outage: Outage) => void
): SeriesOption[] {
  return outages.map(outage => {
    // Either outage has a end point, or use the current time to be the end point
    const lastTime = outage.end ?? Date.now();

    const startTime = getFormattedDate(
      outage.start,
      getFormat({timeZone: true, year: true})
    );

    let currentStatus = `${startTime} - `;

    if (outage.end) {
      const endTime = getFormattedDate(
        outage.end,
        getFormat({timeZone: true, year: true})
      );
      currentStatus += `${endTime}`;
    } else {
      currentStatus += t('ongoing');
    }

    const title = escape(outage.title);
    const severity = escape(outage.severity);
    currentStatus = escape(currentStatus);

    return {
      name: outage.title,
      type: 'line',
      data: [],
      symbol: 'none', // Hide the points
      markArea: {
        data: [
          [
            {
              xAxis: outage.start,
              onClick: () => {
                if (onClick) {
                  onClick(outage);
                  return;
                }
                if (outage?.hostId) {
                  window.open(
                    `http://localhost:3001/service/${outage?.hostId}`,
                    '_blank'
                  );
                }
              },
            },
            {
              xAxis: lastTime,
              onClick: () => {
                if (onClick) {
                  onClick(outage);
                  return;
                }
                if (outage?.hostId) {
                  window.open(
                    `http://localhost:3001/service/${outage?.hostId}`,
                    '_blank'
                  );
                }
              },
            },
          ],
        ] as any,
        itemStyle: {
          color: getOutageColor(outage.severity, theme),
          opacity: 0.3,
          borderColor: getOutageColor(outage.severity, theme),
          borderWidth: 2,
        },
        tooltip: {
          trigger: 'item',
          formatter: function (_params: any) {
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label"><strong>${title} <br> Click to visit outage page
              </strong></span>${severity}</div>`,
              `<div class="tooltip-footer">${currentStatus}</div>`,
              '</div>',
            ].join('');
          },
        },
      },
    };
  });
}
