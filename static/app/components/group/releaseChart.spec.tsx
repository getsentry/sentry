import {getGroupReleaseChartMarkers} from 'sentry/components/group/releaseChart';
import type {TimeseriesValue} from 'sentry/types/core';
import theme from 'sentry/utils/theme';

it('should set marker before first bucket', () => {
  const data: TimeseriesValue[] = [
    [1659524400, 0],
    [1659528000, 0],
    [1659531600, 0],
    [1659535200, 2],
    [1659538800, 10],
    [1659542400, 6],
    [1659546000, 8],
    [1659549600, 0],
    [1659553200, 0],
  ];
  const firstSeen = '2022-08-03T14:48:04Z';
  const lastSeen = '2022-08-03T20:23:05Z';
  // prettier-ignore
  const markers = getGroupReleaseChartMarkers(theme as any, data, firstSeen, lastSeen)!.data!;

  expect((markers[0] as any).displayValue).toBe(new Date(firstSeen).getTime());
  expect(markers[0]!.coord![0]).toBe(1659533400000);
  expect(markers[1]!.coord![0]).toBe(new Date(lastSeen).getTime());
});
