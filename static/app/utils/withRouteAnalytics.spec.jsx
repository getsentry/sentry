import {useEffect} from 'react';

import {render} from 'sentry-test/reactTestingLibrary';

import withRouteAnalytics from 'sentry/utils/withRouteAnalytics';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

function TestComponent({setRouteAnalyticsParams}) {
  useEffect(() => {
    setRouteAnalyticsParams({foo: 'bar'});
  }, [setRouteAnalyticsParams]);
  return <div>hi</div>;
}

const WrappedComponent = withRouteAnalytics(TestComponent);

describe('withRouteAnalytics', function () {
  it('passes context to children as props', function () {
    const setRouteAnalyticsParams = jest.fn();
    render(
      <RouteAnalyticsContext.Provider value={{setRouteAnalyticsParams}}>
        <WrappedComponent />
      </RouteAnalyticsContext.Provider>
    );
    expect(setRouteAnalyticsParams).toHaveBeenCalledWith({foo: 'bar'});
  });
});
