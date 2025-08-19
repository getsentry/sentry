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
      return theme.yellow300;
    case 'minor':
      return theme.yellow400;
    case 'major':
      return theme.red300;
    case 'critical':
      return theme.red400;
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

    let currentStatus = t('Incident is ongoing');
    if (incident.endTime) {
      const time = getFormattedDate(
        incident.endTime,
        getFormat({timeZone: true, year: true})
      );
      currentStatus = `End time: ${time}`;
    }

    return {
      name: incident.title,
      type: 'line' as const,
      data: [],
      // silent: false, // Enable interactions for clicks
      // lineStyle: {opacity: 0}, // Hide the line by making it transparent
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
        // TODO: fix colours
        itemStyle: {
          color: getIncidentColor(incident.severity, theme),
          opacity: 0.3,
          borderColor: getIncidentColor(incident.severity, theme),
          borderWidth: 2,
        },
        // TODO: style tooltip
        tooltip: {
          trigger: 'item',
          formatter: function (_params: any) {
            const time = getFormattedDate(
              incident.startTime,
              getFormat({timeZone: true, year: true})
            );
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label"><strong>${incident.title} <br> Click to visit incident page
              </strong></span>${incident.severity}</div>`,
              `<div class="tooltip-footer">Start time: ${time}
              <br>
              ${currentStatus}
              </div>`,
              '</div>',
            ].join('');
          },
        },
      },
    };
  });
}
