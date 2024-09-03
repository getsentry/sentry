import {createMemoryHistory, Route, Router, RouterContext} from 'react-router';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {ChartType} from 'sentry/views/insights/common/components/chart';
import {RouteContext} from 'sentry/views/routeContext';

import {useChartType} from './useChartType';

describe('useChartType', function () {
  it('allows changing chart type', function () {
    let chartType, setChartType;

    function TestPage() {
      [chartType, setChartType] = useChartType();
      return null;
    }

    const memoryHistory = createMemoryHistory();

    render(
      <Router
        history={memoryHistory}
        render={props => {
          return (
            <RouteContext.Provider value={props}>
              <RouterContext {...props} />
            </RouteContext.Provider>
          );
        }}
      >
        <Route path="/" component={TestPage} />
      </Router>
    );

    expect(chartType).toEqual(ChartType.LINE); // default

    act(() => setChartType(ChartType.BAR));
    expect(chartType).toEqual(ChartType.BAR);

    act(() => setChartType(ChartType.LINE));
    expect(chartType).toEqual(ChartType.LINE);
  });
});
