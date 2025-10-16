import {render} from 'sentry-test/reactTestingLibrary';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import useRouteAnalyticsParams from './useRouteAnalyticsParams';

function TestComponent() {
  useRouteAnalyticsParams({foo: 'bar'});
  return <div>hi</div>;
}

describe('useRouteAnalyticsParams', () => {
  it('calls setRouteAnalyticsParams', () => {
    const setRouteAnalyticsParams = jest.fn();
    const getComponent = (extraContext?: Record<string, any>) => (
      <RouteAnalyticsContext
        value={{
          setRouteAnalyticsParams,
          setOrganization: jest.fn(),
          setDisableRouteAnalytics: jest.fn(),
          setEventNames: jest.fn(),
          previousUrl: '',
          ...extraContext,
        }}
      >
        <TestComponent />
      </RouteAnalyticsContext>
    );

    const {rerender} = render(getComponent());
    expect(setRouteAnalyticsParams).toHaveBeenCalledWith({foo: 'bar'});
    setRouteAnalyticsParams.mockClear();
    rerender(getComponent());
    // should still be called 0 times because previousURL the same
    expect(setRouteAnalyticsParams).toHaveBeenCalledTimes(0);
    rerender(getComponent({previousUrl: 'something-else'}));
    expect(setRouteAnalyticsParams).toHaveBeenCalledWith({foo: 'bar'});
  });
});
