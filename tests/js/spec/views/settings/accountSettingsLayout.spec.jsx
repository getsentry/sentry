import {BreadcrumbContextProvider} from 'sentry-test/providers/breadcrumbContextProvider';
import {render} from 'sentry-test/reactTestingLibrary';

import * as OrgActions from 'sentry/actionCreators/organizations';
import AccountSettingsLayout from 'sentry/views/settings/account/accountSettingsLayout';

describe('AccountSettingsLayout', function () {
  let spy;
  let api;

  const organization = {
    id: '44',
    name: 'Org Index',
    slug: 'org-index',
  };

  beforeEach(function () {
    spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    api = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
    });
  });

  it('fetches org details for SidebarDropdown', function () {
    const {rerender} = render(
      <BreadcrumbContextProvider>
        <AccountSettingsLayout params={{}} />
      </BreadcrumbContextProvider>
    );

    // org from index endpoint, no `access` info
    rerender(
      <BreadcrumbContextProvider>
        <AccountSettingsLayout params={{}} organization={organization} />
      </BreadcrumbContextProvider>
    );

    expect(spy).toHaveBeenCalledWith(organization.slug, {
      setActive: true,
      loadProjects: true,
    });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('does not fetch org details for SidebarDropdown', function () {
    const {rerender} = render(
      <BreadcrumbContextProvider>
        <AccountSettingsLayout params={{}} />
      </BreadcrumbContextProvider>
    );

    rerender(
      <BreadcrumbContextProvider>
        <AccountSettingsLayout params={{}} organization={TestStubs.Organization()} />
      </BreadcrumbContextProvider>
    );

    expect(spy).not.toHaveBeenCalledWith();
    expect(api).not.toHaveBeenCalled();
  });
});
