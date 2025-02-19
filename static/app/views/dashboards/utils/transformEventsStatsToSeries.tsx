import type {Series} from 'sentry/types/echarts';
import type {EventsStats} from 'sentry/types/organization';
import {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'sentry/utils/discover/fields';

export function transformEventsStatsToSeries(
  stats: EventsStats,
  seriesName: string,
  field: string
): Series {
  const unit = stats.meta?.units?.[getAggregateAlias(field)];
  // Scale series values to milliseconds or bytes depending on units from meta
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const scale = (unit && (DURATION_UNITS[unit] ?? SIZE_UNITS[unit])) ?? 1;
  return {
    seriesName,
    data:
      stats?.data?.map(([timestamp, counts]) => {
        return {
          name: timestamp * 1000,
          value: counts.reduce((acc, {count}) => acc + count, 0) * scale,
        };
      }) ?? [],
  };
}
