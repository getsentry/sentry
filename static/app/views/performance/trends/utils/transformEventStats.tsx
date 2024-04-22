import type {Series} from 'sentry/types/echarts';
import type {EventsStatsData} from 'sentry/types/organization';

export default function transformEventStats(
  data: EventsStatsData,
  seriesName?: string
): Series[] {
  return [
    {
      seriesName: seriesName || 'Current',
      data: data.map(([timestamp, countsForTimestamp]) => ({
        name: timestamp * 1000,
        value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
      })),
    },
  ];
}
