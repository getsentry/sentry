import type {DiscoverSeries} from 'sentry/views/insights/common/queries/types';

export function renameDiscoverSeries(
  series: DiscoverSeries,
  newName: string
): DiscoverSeries {
  const previousName = series.seriesName;

  return {
    ...series,
    seriesName: newName,
    meta: {
      ...series.meta,
      fields: {
        ...series.meta?.fields,
        [newName]: series.meta?.fields?.[previousName] ?? 'number',
      },
      units: {
        ...series.meta?.units,
        [newName]: series.meta?.units?.[previousName] ?? '',
      },
    },
  };
}
