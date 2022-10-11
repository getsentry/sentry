import {render} from 'sentry-test/reactTestingLibrary';

import useDisableRouteAnalytics from 'sentry/utils/useDisableRouteAnalytics';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

function TestComponent() {
  useDisableRouteAnalytics();
  return <div>hi</div>;
}

describe('useDisableRouteAnalytics', function () {
  it('disables analytics', function () {
    const setDisableRouteAnalytics = jest.fn();
    render(
      <RouteAnalyticsContext.Provider value={{setDisableRouteAnalytics}}>
        <TestComponent />
      </RouteAnalyticsContext.Provider>
    );
    expect(setDisableRouteAnalytics).toHaveBeenCalledWith();
  });
});
