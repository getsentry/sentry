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

describe('useRouteAnalyticsHookSetup', () => {
  it('registers callback', () => {
    const {organization} = initializeOrg();
    const setOrganization = jest.fn();
    render(
      <RouteAnalyticsContext
        value={{
          setOrganization,
          setDisableRouteAnalytics: jest.fn(),
          setRouteAnalyticsParams: jest.fn(),
          setEventNames: jest.fn(),
          previousUrl: '',
        }}
      >
        <OrganizationContext value={organization}>
          <TestComponent />
        </OrganizationContext>
      </RouteAnalyticsContext>
    );
    expect(
      HookStore.getCallback('react-hook:route-activated', 'setOrganization')
    ).toEqual(setOrganization);
  });
});
