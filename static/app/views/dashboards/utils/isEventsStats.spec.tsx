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

// Top events responses with a group named "order" (e.g., a project slug)
const topEventsWithOnlyGroupNamedOrder: MultiSeriesEventsStats = {
  order: {...singleSeries, order: 0},
};

const topEventsWithGroupNamedOrder: MultiSeriesEventsStats = {
  '/issues': {...singleSeries, order: 0},
  order: {...singleSeries, order: 1},
};

const groupedMultiSeriesWithGroupNamedOrder: GroupedMultiSeriesEventsStats = {
  '/issues': {...multiSeries, order: 0},
  order: {...multiSeries, order: 1},
};

describe('isEventsStats', () => {
  it.each([
    [singleSeries, true],
    [multiSeries, false],
    [groupedMultiSeries, false],
    [topEventsWithOnlyGroupNamedOrder, false],
    [topEventsWithGroupNamedOrder, false],
    [groupedMultiSeriesWithGroupNamedOrder, false],
  ])('marks %s as %s', (obj, expected) => {
    expect(isEventsStats(obj)).toBe(expected);
  });
});

describe('isMultiSeriesEventsStats', () => {
  it.each([
    [singleSeries, false],
    [multiSeries, true],
    [groupedMultiSeries, false],
    [topEventsWithOnlyGroupNamedOrder, true],
    [topEventsWithGroupNamedOrder, true],
    [groupedMultiSeriesWithGroupNamedOrder, false],
  ])('marks %s as %s', (obj, expected) => {
    expect(isMultiSeriesEventsStats(obj)).toBe(expected);
  });
});

describe('isGroupedMultiSeriesEventsStats', () => {
  it.each([
    [singleSeries, false],
    [multiSeries, false],
    [groupedMultiSeries, true],
    [topEventsWithOnlyGroupNamedOrder, false],
    [topEventsWithGroupNamedOrder, false],
    [groupedMultiSeriesWithGroupNamedOrder, true],
  ])('marks %s as %s', (obj, expected) => {
    expect(isGroupedMultiSeriesEventsStats(obj)).toBe(expected);
  });
});
