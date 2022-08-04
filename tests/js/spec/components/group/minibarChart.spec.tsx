import {getGroupReleaseChartMarkers} from 'sentry/components/group/releaseChart';
import type {TimeseriesValue} from 'sentry/types';

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
  const markers = getGroupReleaseChartMarkers(data, firstSeen, '2022-08-03T20:23:05Z');
  expect(markers[0].tooltipValue).toBe(new Date(firstSeen).getTime());
  expect(markers[0]).toEqual({
    color: '#F91A8A',
    name: 'First seen',
    tooltipValue: 1659538084000,
    value: 1659533400000,
  });
  expect(markers[1]).toEqual({
    color: '#2BA185',
    name: 'Last seen',
    value: 1659558185000,
  });
});
