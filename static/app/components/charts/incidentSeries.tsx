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

export interface Incident {
  // Useful for generating links
  hostId: string;
  id: number;
  regionId: string;
  severity: Severity;
  start: number;
  title: string;
  end?: number;
}

function getIncidentColor(severity: Severity, theme: Theme): string {
  switch (severity) {
    case 'maintenance':
      return theme.gray300;
    case 'minor':
      return theme.yellow300;
    case 'major':
      return theme.red200;
    case 'critical':
      return theme.red300;
    default:
      return theme.gray300;
  }
}

export function IncidentSeries(
  theme: Theme,
  incidents: Incident[],
  onClick?: (incident: Incident) => void
): SeriesOption[] {
  return incidents.map(incident => {
    // Either incident has a end point, or use the current time to be the end point
    const lastTime = incident.end ?? Date.now();

    const startTime = getFormattedDate(
      incident.start,
      getFormat({timeZone: true, year: true})
    );

    let currentStatus = `${startTime} - `;

    if (incident.end) {
      const endTime = getFormattedDate(
        incident.end,
        getFormat({timeZone: true, year: true})
      );
      currentStatus += `${endTime}`;
    } else {
      currentStatus += t('ongoing');
    }

    const title = escape(incident.title);
    const severity = escape(incident.severity);
    currentStatus = escape(currentStatus);

    return {
      name: incident.title,
      type: 'line',
      data: [],
      symbol: 'none', // Hide the points
      markArea: {
        data: [
          [
            {
              xAxis: incident.start,
              onClick: () => {
                if (onClick) {
                  onClick(incident);
                  return;
                }
                if (incident?.hostId) {
                  window.open(
                    `http://localhost:3001/service/${incident?.hostId}`,
                    '_blank'
                  );
                }
              },
            },
            {
              xAxis: lastTime,
              onClick: () => {
                if (onClick) {
                  onClick(incident);
                  return;
                }
                if (incident?.hostId) {
                  window.open(
                    `http://localhost:3001/service/${incident?.hostId}`,
                    '_blank'
                  );
                }
              },
            },
          ],
        ] as any,
        itemStyle: {
          color: getIncidentColor(incident.severity, theme),
          opacity: 0.3,
          borderColor: getIncidentColor(incident.severity, theme),
          borderWidth: 2,
        },
        tooltip: {
          trigger: 'item',
          formatter: function (_params: any) {
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label"><strong>${title} <br> Click to visit incident page
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
