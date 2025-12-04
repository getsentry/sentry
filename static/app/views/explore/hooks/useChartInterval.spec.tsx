import {act, render} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
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
      {value: '12h', label: '12 hours'},
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
      {value: '15m', label: '15 minutes'},
    ]);
    act(() => {
      setChartInterval('15m');
    });
    expect(chartInterval).toBe('15m');
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
