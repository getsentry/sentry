import {act, render} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';

import {useChartInterval} from './useChartInterval';

describe('useChartInterval', function () {
  beforeEach(() => {
    PageFiltersStore.reset();
    PageFiltersStore.init();
  });

  it('allows changing chart interval', async function () {
    let chartInterval, setChartInterval, intervalOptions;

    function TestPage() {
      [chartInterval, setChartInterval, intervalOptions] = useChartInterval();
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    expect(intervalOptions).toEqual([
      {value: '1h', label: '1 hour'},
      {value: '4h', label: '4 hours'},
      {value: '1d', label: '1 day'},
      {value: '1w', label: '1 week'},
    ]);
    expect(chartInterval).toEqual('1h'); // default

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
