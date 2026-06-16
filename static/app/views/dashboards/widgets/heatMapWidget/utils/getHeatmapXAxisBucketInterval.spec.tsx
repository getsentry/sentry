import type {PageFilters} from 'sentry/types/core';
import {getIntervalOptionsForPageFilter} from 'sentry/utils/useChartInterval';
import {getHeatmapXAxisBucketInterval} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapXAxisBucketInterval';

function makeSelection(period: string): PageFilters {
  return {
    projects: [],
    environments: [],
    datetime: {period, start: null, end: null, utc: null},
  };
}

function optionValues(period: string) {
  return getIntervalOptionsForPageFilter(makeSelection(period).datetime).map(
    option => option.value
  );
}

describe('getHeatmapXAxisBucketInterval()', () => {
  it('falls back to the largest available interval when the width is 0', () => {
    const options = optionValues('24h');
    expect(getHeatmapXAxisBucketInterval(makeSelection('24h'), 0)).toBe(
      options[options.length - 1]
    );
  });

  it('picks a larger interval as the container gets narrower', () => {
    const options = optionValues('24h');
    const wide = getHeatmapXAxisBucketInterval(makeSelection('24h'), 1200);
    const narrow = getHeatmapXAxisBucketInterval(makeSelection('24h'), 200);
    // A narrower container fits fewer columns, so each bucket spans more time.
    expect(options.indexOf(narrow)).toBeGreaterThanOrEqual(options.indexOf(wide));
  });

  it('only returns intervals available for the selection', () => {
    const options = optionValues('24h');
    const result = getHeatmapXAxisBucketInterval(makeSelection('24h'), 724);
    expect(options).toContain(result);
  });
});
