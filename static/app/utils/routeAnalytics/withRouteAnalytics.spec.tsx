import {useEffect} from 'react';

import {render} from 'sentry-test/reactTestingLibrary';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import withRouteAnalytics from './withRouteAnalytics';

function TestComponent({setRouteAnalyticsParams}: any) {
  useEffect(() => {
    setRouteAnalyticsParams({foo: 'bar'});
  }, [setRouteAnalyticsParams]);
  return <div>hi</div>;
}

const WrappedComponent = withRouteAnalytics(TestComponent);

describe('withRouteAnalytics', function () {
  it('passes context to children as props', function () {
    const setRouteAnalyticsParams = vi.fn();
    render(
      <RouteAnalyticsContext.Provider
        value={{
          setRouteAnalyticsParams,
          setDisableRouteAnalytics: vi.fn(),
          setOrganization: vi.fn(),
          setEventNames: vi.fn(),
          previousUrl: '',
        }}
      >
        <WrappedComponent />
      </RouteAnalyticsContext.Provider>
    );
    expect(setRouteAnalyticsParams).toHaveBeenCalledWith({foo: 'bar'});
  });
});
