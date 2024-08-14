import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import * as OrgActions from 'sentry/actionCreators/organizations';
import AccountSettingsLayout from 'sentry/views/settings/account/accountSettingsLayout';
import {BreadcrumbProvider} from 'sentry/views/settings/components/settingsBreadcrumb/context';

describe('AccountSettingsLayout', function () {
  let spy: jest.SpyInstance;
  let api: jest.Mock;

  const {routerProps} = initializeOrg();

  const organization = OrganizationFixture({
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

  it('fetches org details for SidebarDropdown', async function () {
    const {rerender} = render(
      <BreadcrumbProvider>
        <AccountSettingsLayout {...routerProps}>content</AccountSettingsLayout>
      </BreadcrumbProvider>
    );

    // org from index endpoint, no `access` info
    rerender(
      <BreadcrumbProvider>
        <AccountSettingsLayout {...routerProps} organization={organization}>
          content
        </AccountSettingsLayout>
      </BreadcrumbProvider>
    );

    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledWith(expect.anything(), organization.slug, {
      setActive: true,
      loadProjects: true,
    });
  });

  it('does not fetch org details for SidebarDropdown', function () {
    const {rerender} = render(
      <BreadcrumbProvider>
        <AccountSettingsLayout {...routerProps}>content</AccountSettingsLayout>
      </BreadcrumbProvider>
    );

    rerender(
      <BreadcrumbProvider>
        <AccountSettingsLayout {...routerProps} organization={OrganizationFixture()}>
          content
        </AccountSettingsLayout>
      </BreadcrumbProvider>
    );

    expect(spy).not.toHaveBeenCalledWith();
    expect(api).not.toHaveBeenCalled();
  });
});
