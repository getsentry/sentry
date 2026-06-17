import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {getHeatmapXAxisBucketInterval} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapXAxisBucketInterval';

function makeSelection(period: string) {
  return PageFiltersFixture({datetime: {period, start: null, end: null, utc: null}});
}

const INTERVAL_OPTIONS = [
  {value: '1m', label: '1 minute'},
  {value: '5m', label: '5 minutes'},
  {value: '1h', label: '1 hour'},
  {value: '12h', label: '12 hours'},
  {value: '1d', label: '1 day'},
];

describe('getHeatmapXAxisBucketInterval()', () => {
  it('snaps to a wider interval as the container gets narrower', () => {
    const values = INTERVAL_OPTIONS.map(option => option.value);
    const wide = getHeatmapXAxisBucketInterval(
      makeSelection('24h'),
      '1h',
      1200,
      INTERVAL_OPTIONS
    );
    const narrow = getHeatmapXAxisBucketInterval(
      makeSelection('24h'),
      '1h',
      200,
      INTERVAL_OPTIONS
    );
    // A narrower container fits fewer columns, so each bucket spans more time.
    expect(values.indexOf(narrow)).toBeGreaterThanOrEqual(values.indexOf(wide));
  });

  it('only returns one of the provided interval options', () => {
    const result = getHeatmapXAxisBucketInterval(
      makeSelection('24h'),
      '1h',
      724,
      INTERVAL_OPTIONS
    );
    expect(INTERVAL_OPTIONS.map(option => option.value)).toContain(result);
  });

  it('falls back to the given interval before the container has been measured', () => {
    // Width 0 yields no finite bucket size, so there is nothing to snap to and
    // the currently selected interval is kept.
    expect(
      getHeatmapXAxisBucketInterval(makeSelection('24h'), '1h', 0, INTERVAL_OPTIONS)
    ).toBe('1h');
  });
});
