import {render} from 'sentry-test/reactTestingLibrary';

import useRouteAnalyticsParams from 'sentry/utils/useRouteAnalyticsParams';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

function TestComponent() {
  useRouteAnalyticsParams({foo: 'bar'});
  return <div>hi</div>;
}

describe('useRouteAnalyticsParams', function () {
  it('calls setRouteAnalyticsParams', function () {
    const setRouteAnalyticsParams = jest.fn();
    render(
      <RouteAnalyticsContext.Provider value={{setRouteAnalyticsParams}}>
        <TestComponent />
      </RouteAnalyticsContext.Provider>
    );
    expect(setRouteAnalyticsParams).toHaveBeenCalledWith({foo: 'bar'});
  });
});
