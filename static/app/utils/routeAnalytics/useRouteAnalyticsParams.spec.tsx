import {render} from 'sentry-test/reactTestingLibrary';

import useRouteAnalyticsParams from './useRouteAnalyticsParams';

function TestComponent() {
  useRouteAnalyticsParams({foo: 'bar'});
  return <div>hi</div>;
}

describe('useRouteAnalyticsParams', function () {
  it('calls setRouteAnalyticsParams', function () {
    const setRouteAnalyticsParams = jest.fn();
    render(<TestComponent />);
    expect(setRouteAnalyticsParams).toHaveBeenCalledWith({foo: 'bar'});
  });
});
