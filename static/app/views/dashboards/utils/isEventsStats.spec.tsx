import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';

import {
  isEventsStats,
  isGroupedMultiSeriesEventsStats,
  isMultiSeriesEventsStats,
} from './isEventsStats';

const singleSeries: EventsStats = {
  data: [],
};

const multiSeries: MultiSeriesEventsStats = {
  'epm()': singleSeries,
  'avg(span.duration)': singleSeries,
};

const groupedMultiSeries: GroupedMultiSeriesEventsStats = {
  '/issues': {...multiSeries, order: 0},
};

// Top events response where the only group is named "order" (e.g., a project slug)
const topEventsWithGroupNamedOrder: MultiSeriesEventsStats = {
  order: {...singleSeries, order: 0},
};

describe('isEventsStats', () => {
  it.each([
    [singleSeries, true],
    [multiSeries, false],
    [groupedMultiSeries, false],
    [topEventsWithGroupNamedOrder, false],
  ])('marks %s as %s', (obj, expected) => {
    expect(isEventsStats(obj)).toBe(expected);
  });
});

describe('isMultiSeriesEventsStats', () => {
  it.each([
    [singleSeries, false],
    [multiSeries, true],
    [groupedMultiSeries, false],
    [topEventsWithGroupNamedOrder, true],
  ])('marks %s as %s', (obj, expected) => {
    expect(isMultiSeriesEventsStats(obj)).toBe(expected);
  });
});

describe('isGroupedMultiSeriesEventsStats', () => {
  it.each([
    [singleSeries, false],
    [multiSeries, false],
    [groupedMultiSeries, true],
    [topEventsWithGroupNamedOrder, false],
  ])('marks %s as %s', (obj, expected) => {
    expect(isGroupedMultiSeriesEventsStats(obj)).toBe(expected);
  });
});
