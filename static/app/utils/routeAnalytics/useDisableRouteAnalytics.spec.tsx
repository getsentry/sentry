import {render} from 'sentry-test/reactTestingLibrary';

import useDisableRouteAnalytics from './useDisableRouteAnalytics';

function TestComponent() {
  useDisableRouteAnalytics();
  return <div>hi</div>;
}

describe('useDisableRouteAnalytics', function () {
  it('disables analytics', function () {
    const setDisableRouteAnalytics = jest.fn();
    render(<TestComponent />);
    expect(setDisableRouteAnalytics).toHaveBeenCalledWith();
  });
});
