import {render} from 'sentry-test/reactTestingLibrary';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import useDisableRouteAnalytics from './useDisableRouteAnalytics';

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
