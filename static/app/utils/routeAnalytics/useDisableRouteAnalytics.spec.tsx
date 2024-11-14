import {render} from 'sentry-test/reactTestingLibrary';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import useDisableRouteAnalytics from './useDisableRouteAnalytics';

describe('useDisableRouteAnalytics', function () {
  const setDisableRouteAnalytics = jest.fn();
  const otherFns = {
    setRouteAnalyticsParams: jest.fn(),
    setOrganization: jest.fn(),
    setEventNames: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('disables analytics', function () {
    function TestComponent() {
      useDisableRouteAnalytics();
      return <div>hi</div>;
    }
    const getComponent = ({previousUrl = ''}: {previousUrl?: string} = {}) => (
      <RouteAnalyticsContext.Provider
        value={{
          ...otherFns,
          setDisableRouteAnalytics,
          previousUrl,
        }}
      >
        <TestComponent />
      </RouteAnalyticsContext.Provider>
    );
    const {rerender} = render(getComponent({}));
    expect(setDisableRouteAnalytics).toHaveBeenCalledWith(true);
    setDisableRouteAnalytics.mockClear();
    rerender(getComponent());
    // should still be called 0 times because previousURL the same
    expect(setDisableRouteAnalytics).toHaveBeenCalledTimes(0);
    rerender(getComponent({previousUrl: 'something-else'}));
    expect(setDisableRouteAnalytics).toHaveBeenCalledWith(true);
  });

  it('re-enables analytics', function () {
    function TestComponent({disabled}: {disabled: boolean}) {
      useDisableRouteAnalytics(disabled);
      return <div>hi</div>;
    }
    const getComponent = ({disabled}: {disabled: boolean}) => (
      <RouteAnalyticsContext.Provider
        value={{
          ...otherFns,
          setDisableRouteAnalytics,
          previousUrl: '',
        }}
      >
        <TestComponent disabled={disabled} />
      </RouteAnalyticsContext.Provider>
    );
    const {rerender} = render(getComponent({disabled: true}));
    expect(setDisableRouteAnalytics).toHaveBeenCalledWith(true);
    setDisableRouteAnalytics.mockClear();
    rerender(getComponent({disabled: false}));
    expect(setDisableRouteAnalytics).toHaveBeenCalledWith(false);
  });
});
