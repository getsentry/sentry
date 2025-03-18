import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import HookStore from 'sentry/stores/hookStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import useRouteAnalyticsHookSetup from './useRouteAnalyticsHookSetup';

function TestComponent() {
  useRouteAnalyticsHookSetup();
  return <div>hi</div>;
}

describe('useRouteAnalyticsHookSetup', function () {
  it('registers callback', function () {
    const {organization} = initializeOrg();
    const setOrganization = vi.fn();
    render(
      <RouteAnalyticsContext.Provider
        value={{
          setOrganization,
          setDisableRouteAnalytics: vi.fn(),
          setRouteAnalyticsParams: vi.fn(),
          setEventNames: vi.fn(),
          previousUrl: '',
        }}
      >
        <OrganizationContext.Provider value={organization}>
          <TestComponent />
        </OrganizationContext.Provider>
      </RouteAnalyticsContext.Provider>
    );
    expect(
      HookStore.getCallback('react-hook:route-activated', 'setOrganization')
    ).toEqual(setOrganization);
  });
});
