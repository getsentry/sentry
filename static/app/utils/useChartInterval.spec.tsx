import {act, render} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

import {getIntervalOptionsForPageFilter, useChartInterval} from './useChartInterval';

describe('useChartInterval', () => {
  beforeEach(() => {
    PageFiltersStore.reset();
    PageFiltersStore.init();
  });

  it('allows changing chart interval', () => {
    let chartInterval!: ReturnType<typeof useChartInterval>[0];
    let setChartInterval!: ReturnType<typeof useChartInterval>[1];
    let intervalOptions!: ReturnType<typeof useChartInterval>[2];

    function TestPage() {
      [chartInterval, setChartInterval, intervalOptions] = useChartInterval();
      return null;
    }

    render(<TestPage />);

    expect(intervalOptions).toEqual([
      {value: '1h', label: '1 hour'},
      {value: '3h', label: '3 hours'},
      {value: '6h', label: '6 hours'},
      {value: '1d', label: '1 day'},
    ]);
    expect(chartInterval).toBe('1h'); // default

    act(() => setChartInterval('3h'));
    expect(chartInterval).toBe('3h');

    // Update page filters to change interval options
    act(() =>
      PageFiltersStore.updateDateTime({
        period: '1h',
        start: null,
        end: null,
        utc: true,
      })
    );

    expect(intervalOptions).toEqual([
      {value: '1m', label: '1 minute'},
      {value: '5m', label: '5 minutes'},
    ]);
    act(() => {
      setChartInterval('5m');
    });
    expect(chartInterval).toBe('5m');
  });

  it('offers 7d interval when period is >= 30d', () => {
    let intervalOptions!: ReturnType<typeof useChartInterval>[2];

    function TestPage() {
      [, , intervalOptions] = useChartInterval();
      return null;
    }

    act(() =>
      PageFiltersStore.updateDateTime({
        period: '30d',
        start: null,
        end: null,
        utc: true,
      })
    );

    render(<TestPage />);

    expect(intervalOptions).toContainEqual({value: '7d', label: '7 days'});
    expect(intervalOptions).toContainEqual({value: '1d', label: '1 day'});
  });

  it('does not offer 7d interval below the 30d threshold', () => {
    let intervalOptions!: ReturnType<typeof useChartInterval>[2];

    function TestPage() {
      [, , intervalOptions] = useChartInterval();
      return null;
    }

    act(() =>
      PageFiltersStore.updateDateTime({
        period: '29d',
        start: null,
        end: null,
        utc: true,
      })
    );

    render(<TestPage />);

    expect(intervalOptions).not.toContainEqual({value: '7d', label: '7 days'});
    // 1d is still offered for periods >= 14d
    expect(intervalOptions).toContainEqual({value: '1d', label: '1 day'});
  });

  it('falls back to default when URL interval is 7d but the period dropped below 30d', () => {
    let chartInterval!: ReturnType<typeof useChartInterval>[0];
    let intervalOptions!: ReturnType<typeof useChartInterval>[2];

    function TestPage() {
      [chartInterval, , intervalOptions] = useChartInterval();
      return null;
    }

    act(() =>
      PageFiltersStore.updateDateTime({
        period: '14d',
        start: null,
        end: null,
        utc: true,
      })
    );

    render(<TestPage />, {
      initialRouterConfig: {location: {pathname: '/foo/', query: {interval: '7d'}}},
    });

    expect(intervalOptions).not.toContainEqual({value: '7d', label: '7 days'});
    expect(chartInterval).not.toBe('7d');
  });
});

describe('getIntervalOptionsForPageFilter', () => {
  it.each([
    '1h',
    '23h',
    '1d',
    '6d',
    '7d',
    '13d',
    '14d',
    '29d',
    '30d',
    '59d',
    '60d',
    '89d',
    '90d',
  ])('returns interval options with resulting in less than 1000 buckets', period => {
    const periodInHours = parsePeriodToHours(period);
    const options = getIntervalOptionsForPageFilter({
      period,
      start: null,
      end: null,
      utc: null,
    });
    options.forEach(({value}) => {
      const intervalInHours = parsePeriodToHours(value);
      expect(periodInHours / intervalInHours).toBeLessThan(1000);
    });
  });
});
