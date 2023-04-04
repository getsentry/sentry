import {render} from 'sentry-test/reactTestingLibrary';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import useDisableRouteAnalytics from './useDisableRouteAnalytics';

const TestComponent = () => {
  useDisableRouteAnalytics();
  return <div>hi</div>;
};

describe('useDisableRouteAnalytics', function () {
  it('disables analytics', function () {
    const setDisableRouteAnalytics = jest.fn();
    const getComponent = (extraContext?: Record<string, any>) => (
      <RouteAnalyticsContext.Provider
        value={{
          setDisableRouteAnalytics,
          setRouteAnalyticsParams: jest.fn(),
          setOrganization: jest.fn(),
          setEventNames: jest.fn(),
          previousUrl: '',
          ...extraContext,
        }}
      >
        <TestComponent />
      </RouteAnalyticsContext.Provider>
    );
    const {rerender} = render(getComponent());
    expect(setDisableRouteAnalytics).toHaveBeenCalledWith();
    setDisableRouteAnalytics.mockClear();
    rerender(getComponent());
    // should still be called 0 times because previousURL the same
    expect(setDisableRouteAnalytics).toHaveBeenCalledTimes(0);
    rerender(getComponent({previousUrl: 'something-else'}));
    expect(setDisableRouteAnalytics).toHaveBeenCalledWith();
  });
});
