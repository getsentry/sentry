import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';

import type {WidgetQuery} from '../types';
import {transformSeries} from '../widgetCard/widgetQueries';

type SeriesWithOrdering = [order: number, series: Series];

import {
  isEventsStats,
  isGroupedMultiSeriesEventsStats,
  isMultiSeriesEventsStats,
} from './isEventsStats';

export function transformEventsResponseToSeries(
  data: EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  widgetQuery: WidgetQuery
): Series[] {
  const seriesWithOrdering: SeriesWithOrdering[] = [];
  const queryAlias = widgetQuery.name;

  if (isEventsStats(data)) {
    const field = widgetQuery.aggregates[0]!;
    const prefixedName = queryAlias ? `${queryAlias} : ${field}` : field;

    seriesWithOrdering.push([0, transformSeries(data, prefixedName, field)]);
  } else if (isMultiSeriesEventsStats(data)) {
    Object.keys(data).forEach(seriesName => {
      const seriesData = data[seriesName]!;
      const prefixedName = queryAlias ? `${queryAlias} : ${seriesName}` : seriesName;

      seriesWithOrdering.push([
        seriesData.order ?? 0,
        transformSeries(seriesData, prefixedName, seriesName),
      ]);
    });
  } else if (isGroupedMultiSeriesEventsStats(data)) {
    Object.keys(data).forEach(groupName => {
      const groupData = data[groupName] as MultiSeriesEventsStats;

      Object.keys(groupData).forEach(seriesName => {
        if (seriesName === 'order') {
          // `order` is a special key on grouped responses, we can skip over it
          return;
        }

        const seriesData = groupData[seriesName] as EventsStats;
        const prefixedName = queryAlias
          ? `${queryAlias} > ${groupName} : ${seriesName}`
          : `${groupName} : ${seriesName}`;

        seriesWithOrdering.push([
          (groupData.order as unknown as number) ?? 0,
          transformSeries(seriesData, prefixedName, seriesName),
        ]);
      });
    });
  }

  return seriesWithOrdering
    .toSorted((itemA, itemB) => itemA[0] - itemB[0])
    .map(item => item[1]);
}
