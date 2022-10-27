import {render} from 'sentry-test/reactTestingLibrary';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import useRouteAnalyticsParams from './useRouteAnalyticsParams';

function TestComponent() {
  useRouteAnalyticsParams({foo: 'bar'});
  return <div>hi</div>;
}

describe('useRouteAnalyticsParams', function () {
  it('calls setRouteAnalyticsParams', function () {
    const setRouteAnalyticsParams = jest.fn();
    render(
      <RouteAnalyticsContext.Provider
        value={{
          setRouteAnalyticsParams,
          setOrganization: jest.fn(),
          setDisableRouteAnalytics: jest.fn(),
        }}
      >
        <TestComponent />
      </RouteAnalyticsContext.Provider>
    );
    expect(setRouteAnalyticsParams).toHaveBeenCalledWith({foo: 'bar'});
  });
});
