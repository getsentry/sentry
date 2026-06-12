import type {PageFilters} from 'sentry/types/core';
import {getHeatmapXAxisBucketInterval} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapXAxisBucketInterval';

const INTERVAL_OPTIONS = [
  {label: '1 minute', value: '1m'},
  {label: '5 minutes', value: '5m'},
  {label: '10 minutes', value: '10m'},
  {label: '30 minutes', value: '30m'},
  {label: '1 hour', value: '1h'},
  {label: '3 hours', value: '3h'},
  {label: '6 hours', value: '6h'},
  {label: '12 hours', value: '12h'},
];

function makeSelection(period: string): PageFilters {
  return {
    projects: [],
    environments: [],
    datetime: {period, start: null, end: null, utc: null},
  };
}

describe('getHeatmapXAxisBucketInterval()', () => {
  it('falls back to the provided interval when the width is 0', () => {
    expect(
      getHeatmapXAxisBucketInterval(makeSelection('24h'), '12h', 0, INTERVAL_OPTIONS)
    ).toBe('12h');
  });

  it('picks a larger interval as the container gets narrower', () => {
    const wide = getHeatmapXAxisBucketInterval(
      makeSelection('24h'),
      '12h',
      1200,
      INTERVAL_OPTIONS
    );
    const narrow = getHeatmapXAxisBucketInterval(
      makeSelection('24h'),
      '12h',
      300,
      INTERVAL_OPTIONS
    );
    // A narrower container fits fewer 15px columns, so each bucket spans more time.
    const toMs = (interval: string) =>
      INTERVAL_OPTIONS.findIndex(option => option.value === interval);
    expect(toMs(narrow)).toBeGreaterThan(toMs(wide));
  });

  it('only returns intervals from the provided options', () => {
    const result = getHeatmapXAxisBucketInterval(
      makeSelection('24h'),
      '12h',
      724,
      INTERVAL_OPTIONS
    );
    expect(INTERVAL_OPTIONS.map(option => option.value)).toContain(result);
  });
});
