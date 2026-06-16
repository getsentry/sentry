import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/utils/organizationContext';
import {callSetOrganizationCallback} from 'sentry/utils/routeAnalytics/setOrganizationCallback';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import {useRouteAnalyticsHookSetup} from './useRouteAnalyticsHookSetup';

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
    callSetOrganizationCallback(organization);
    expect(setOrganization).toHaveBeenCalledWith(organization);
  });
});
