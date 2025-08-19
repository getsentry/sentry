import type {SeriesOption} from 'echarts';

import {t} from 'sentry/locale';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import type {Theme} from 'sentry/utils/theme';

export interface Incident {
  severity: 'maintenance' | 'minor' | 'major' | 'critical';
  startTime: number;
  title: string;
  endTime?: number;
}

// TODO: fix colours
function getIncidentColor(severity: Incident['severity'], theme: Theme): string {
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
    // Use the later of incident end time or current time for the last data point
    const lastTime = incident.endTime ?? Date.now();

    const startTime = getFormattedDate(
      incident.startTime,
      getFormat({timeZone: true, year: true})
    );

    let currentStatus = `${startTime} - `;

    if (incident.endTime) {
      const endTime = getFormattedDate(
        incident.endTime,
        getFormat({timeZone: true, year: true})
      );
      currentStatus += `${endTime}`;
    } else {
      currentStatus += t('ongoing');
    }

    return {
      name: incident.title,
      type: 'line',
      data: [],
      symbol: 'none', // Hide the points
      markArea: {
        data: [
          [
            {
              xAxis: incident.startTime,
              onClick: () => {
                onClick?.(incident);
              },
            },
            {
              xAxis: lastTime,
              onClick: () => {
                onClick?.(incident);
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
              `<div><span class="tooltip-label"><strong>${incident.title} <br> Click to visit incident page
              </strong></span>${incident.severity}</div>`,
              `<div class="tooltip-footer">${currentStatus}</div>`,
              '</div>',
            ].join('');
          },
        },
      },
    };
  });
}
