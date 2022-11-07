import {render} from 'sentry-test/reactTestingLibrary';

import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import useRouteAnalyticsEventNames from './useRouteAnalyticsEventNames';

function TestComponent({eventKey, eventName}: {eventKey: string; eventName: string}) {
  useRouteAnalyticsEventNames(eventKey, eventName);
  return <div>hi</div>;
}

describe('useRouteAnalyticsEventNames', function () {
  it('disables analytics', function () {
    const setEventNames = jest.fn();
    const getComponent = (
      eventKey: string,
      eventName: string,
      extraContext?: Record<string, any>
    ) => (
      <RouteAnalyticsContext.Provider
        value={{
          setDisableRouteAnalytics: jest.fn(),
          setRouteAnalyticsParams: jest.fn(),
          setOrganization: jest.fn(),
          setEventNames,
          previousUrl: '',
          ...extraContext,
        }}
      >
        <TestComponent {...{eventKey, eventName}} />
      </RouteAnalyticsContext.Provider>
    );
    const {rerender} = render(getComponent('a', 'b'));
    expect(setEventNames).toHaveBeenCalledWith('a', 'b');
    setEventNames.mockClear();
    rerender(getComponent('a', 'b'));
    // should still be called 0 times because previousURL the same
    expect(setEventNames).toHaveBeenCalledTimes(0);
    rerender(getComponent('a', 'b', {previousUrl: 'something-else'}));
    expect(setEventNames).toHaveBeenCalledWith('a', 'b');
  });
});
