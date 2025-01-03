import {act, render} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

import {getIntervalOptionsForPageFilter, useChartInterval} from './useChartInterval';

describe('useChartInterval', function () {
  beforeEach(() => {
    PageFiltersStore.reset();
    PageFiltersStore.init();
  });

  it('allows changing chart interval', async function () {
    let chartInterval!: ReturnType<typeof useChartInterval>[0];
    let setChartInterval!: ReturnType<typeof useChartInterval>[1];
    let intervalOptions!: ReturnType<typeof useChartInterval>[2];

    function TestPage() {
      [chartInterval, setChartInterval, intervalOptions] = useChartInterval();
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    expect(intervalOptions).toEqual([
      {value: '1h', label: '1 hour'},
      {value: '3h', label: '3 hours'},
      {value: '12h', label: '12 hours'},
      {value: '1d', label: '1 day'},
    ]);
    expect(chartInterval).toEqual('3h'); // default

    await act(() => setChartInterval('1d'));
    expect(chartInterval).toEqual('1d');

    // Update page filters to change interval options
    await act(() =>
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
    await act(() => {
      setChartInterval('1m');
    });
    expect(chartInterval).toEqual('1m');
  });
});

describe('getIntervalOptionsForPageFilter', function () {
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
  ])(
    'returns interval options with resulting in less than 1000 buckets',
    function (period) {
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
    }
  );
});
