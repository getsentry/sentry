import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {BreadcrumbContextProvider} from 'sentry-test/providers/breadcrumbContextProvider';
import {render} from 'sentry-test/reactTestingLibrary';

import * as OrgActions from 'sentry/actionCreators/organizations';
import AccountSettingsLayout from 'sentry/views/settings/account/accountSettingsLayout';

describe('AccountSettingsLayout', function () {
  let spy: jest.SpyInstance;
  let api: jest.Mock;

  const {routerProps} = initializeOrg();

  const organization = Organization({
    id: '44',
    name: 'Org Index',
    slug: 'org-index',
    access: undefined,
  });

  beforeEach(function () {
    spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    api = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
    });
  });

  it('fetches org details for SidebarDropdown', function () {
    const {rerender} = render(
      <BreadcrumbContextProvider>
        <AccountSettingsLayout {...routerProps}>content</AccountSettingsLayout>
      </BreadcrumbContextProvider>
    );

    // org from index endpoint, no `access` info
    rerender(
      <BreadcrumbContextProvider>
        <AccountSettingsLayout {...routerProps} organization={organization}>
          content
        </AccountSettingsLayout>
      </BreadcrumbContextProvider>
    );

    expect(spy).toHaveBeenCalledWith(expect.anything(), organization.slug, {
      setActive: true,
      loadProjects: true,
    });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('does not fetch org details for SidebarDropdown', function () {
    const {rerender} = render(
      <BreadcrumbContextProvider>
        <AccountSettingsLayout {...routerProps}>content</AccountSettingsLayout>
      </BreadcrumbContextProvider>
    );

    rerender(
      <BreadcrumbContextProvider>
        <AccountSettingsLayout {...routerProps} organization={Organization()}>
          content
        </AccountSettingsLayout>
      </BreadcrumbContextProvider>
    );

    expect(spy).not.toHaveBeenCalledWith();
    expect(api).not.toHaveBeenCalled();
  });
});
