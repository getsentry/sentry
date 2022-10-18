import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

import useRouteAnalyticsOrgSetter from './useRouteAnalyticsOrgSetter';

function TestComponent() {
  useRouteAnalyticsOrgSetter();
  return <div>hi</div>;
}

describe('useRouteAnalyticsOrgSetter', function () {
  it('disables analytics', function () {
    const {organization} = initializeOrg();
    const setOrganization = jest.fn();
    render(
      <RouteAnalyticsContext.Provider
        value={{
          setOrganization,
          setDisableRouteAnalytics: jest.fn(),
          setRouteAnalyticsParams: jest.fn(),
        }}
      >
        <OrganizationContext.Provider value={organization}>
          <TestComponent />
        </OrganizationContext.Provider>
      </RouteAnalyticsContext.Provider>
    );
    expect(setOrganization).toHaveBeenCalledWith(organization);
  });
});
