// import type {Theme} from '@emotion/react';
import type {SeriesOption} from 'echarts';

// import {t} from 'sentry/locale';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';

export interface Incident {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  startTime: number;
  title: string;
  url: string;
  endTime?: number;
}

// TODO: fix colours
// function getIncidentColor(severity: Incident['severity'], theme: any): string {
//   switch (severity) {
//     case 'low':
//       return theme.yellow300;
//     case 'medium':
//       return theme.orange300;
//     case 'high':
//       return theme.red300;
//     case 'critical':
//       return theme.red500;
//     default:
//       return theme.gray300;
//   }
// }

export function IncidentSeries(
  // theme: Theme,
  incidents: Incident[],
  onClick?: (incident: Incident) => void
): SeriesOption[] {
  return incidents.map(incident => {
    // Use the later of incident end time or current time for the last data point
    const lastTime = incident.endTime ?? Date.now();

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
          color: 'rgba(255, 34, 34, 1)',
          opacity: 0.3,
          borderColor: 'rgba(255, 34, 34, 1)',
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
              `<div><span class="tooltip-label"><strong>${incident.id}
              </strong></span>${time}</div>`,
              '</div>',
            ].join('');
          },
        },
      },
    };
  });
}
