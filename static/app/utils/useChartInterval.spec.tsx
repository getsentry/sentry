import {act, render} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

import {
  ChartIntervalUnspecifiedStrategy,
  getIntervalOptionsForPageFilter,
  useChartInterval,
} from './useChartInterval';

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

  it('defaults to the smallest interval with USE_SMALLEST strategy', () => {
    // Default 14d period produces ladder-derived options ['1h', '3h', '6h']
    let chartInterval!: ReturnType<typeof useChartInterval>[0];

    function TestPage() {
      [chartInterval] = useChartInterval({
        unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
      });
      return null;
    }

    render(<TestPage />);
    expect(chartInterval).toBe('1h');
  });

  it('defaults to the largest ladder-derived interval with USE_BIGGEST strategy', () => {
    // Default 14d period produces ladder-derived options ['1h', '3h', '6h'].
    // The '1d' option is appended after the default is computed, so it is not
    // considered when selecting the biggest default.
    let chartInterval!: ReturnType<typeof useChartInterval>[0];
    let intervalOptions!: ReturnType<typeof useChartInterval>[2];

    function TestPage() {
      [chartInterval, , intervalOptions] = useChartInterval({
        unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_BIGGEST,
      });
      return null;
    }

    render(<TestPage />);
    expect(chartInterval).toBe('6h');
    // '1d' is still present as a selectable option even though it was not the default
    expect(intervalOptions.map(o => o.value)).toContain('1d');
  });

  it('defaults to the second-largest interval with USE_SECOND_BIGGEST strategy', () => {
    // Default 14d period produces ladder-derived options ['1h', '3h', '6h'],
    // so the second-biggest is '3h'.
    let chartInterval!: ReturnType<typeof useChartInterval>[0];

    function TestPage() {
      [chartInterval] = useChartInterval({
        unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SECOND_BIGGEST,
      });
      return null;
    }

    render(<TestPage />);
    expect(chartInterval).toBe('3h');
  });

  it('falls back to the only option when USE_SECOND_BIGGEST is used with a single-option period', () => {
    // A 1-minute period produces only ['1m'] as the valid interval option.
    // options[length-2] is undefined, so the fallback is options[length-1] = '1m'.
    let chartInterval!: ReturnType<typeof useChartInterval>[0];

    function TestPage() {
      [chartInterval] = useChartInterval({
        unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SECOND_BIGGEST,
      });
      return null;
    }

    render(<TestPage />);

    act(() =>
      PageFiltersStore.updateDateTime({
        period: '1m',
        start: null,
        end: null,
        utc: true,
      })
    );

    expect(chartInterval).toBe('1m');
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
