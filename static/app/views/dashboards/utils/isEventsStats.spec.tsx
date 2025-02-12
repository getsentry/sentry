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
  'spm()': singleSeries,
  'avg(span.duration)': singleSeries,
};

const groupedMultiSeries: GroupedMultiSeriesEventsStats = {
  '/issues': {...multiSeries, order: 0},
};

describe('isEventsStats', () => {
  it.each([
    [singleSeries, true],
    [multiSeries, false],
    [groupedMultiSeries, false],
  ])('marks %s as %s', (obj, expected) => {
    expect(isEventsStats(obj)).toBe(expected);
  });
});

describe('isMultiSeriesEventsStats', () => {
  it.each([
    [singleSeries, false],
    [multiSeries, true],
    [groupedMultiSeries, false],
  ])('marks %s as %s', (obj, expected) => {
    expect(isMultiSeriesEventsStats(obj)).toBe(expected);
  });
});

describe('isGroupedMultiSeriesEventsStats', () => {
  it.each([
    [singleSeries, false],
    [multiSeries, false],
    [groupedMultiSeries, true],
  ])('marks %s as %s', (obj, expected) => {
    expect(isGroupedMultiSeriesEventsStats(obj)).toBe(expected);
  });
});
