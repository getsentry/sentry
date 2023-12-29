import {Organization} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {BreadcrumbContextProvider} from 'sentry-test/providers/breadcrumbContextProvider';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import * as OrgActions from 'sentry/actionCreators/organizations';
import ConfigStore from 'sentry/stores/configStore';
import {Organization as TOrganization} from 'sentry/types';
import SettingsIndex from 'sentry/views/settings/settingsIndex';

describe('SettingsIndex', function () {
  const props = {
    router: RouterFixture(),
    location: {} as any,
    routes: [],
    route: {},
    params: {},
    routeParams: {},
  };

  it('renders', function () {
    render(
      <BreadcrumbContextProvider>
        <SettingsIndex {...props} organization={Organization()} />
      </BreadcrumbContextProvider>
    );
  });

  it('has loading when there is no organization', function () {
    render(
      <BreadcrumbContextProvider>
        <SettingsIndex {...props} organization={null} />
      </BreadcrumbContextProvider>
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('has different links for self-hosted users', function () {
    ConfigStore.set('isSelfHosted', true);

    render(
      <BreadcrumbContextProvider>
        <SettingsIndex {...props} organization={Organization()} />
      </BreadcrumbContextProvider>
    );

    const formLink = screen.getByText('Community Forums');

    expect(formLink).toBeInTheDocument();
    expect(formLink).toHaveAttribute('href', 'https://forum.sentry.io/');
  });

  describe('Fetch org details for Sidebar', function () {
    const organization = {
      id: '44',
      name: 'Org Index',
      slug: 'org-index',
      features: [],
    } as unknown as TOrganization;

    const spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    let orgApi: jest.Mock;

    beforeEach(function () {
      ConfigStore.set('isSelfHosted', false);
      MockApiClient.clearMockResponses();
      orgApi = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
      });
    });

    it('fetches org details for SidebarDropdown', function () {
      const {rerender} = render(
        <BreadcrumbContextProvider>
          <SettingsIndex {...props} params={{}} organization={null} />
        </BreadcrumbContextProvider>
      );

      // org from index endpoint, no `access` info
      rerender(
        <BreadcrumbContextProvider>
          <SettingsIndex {...props} organization={organization} />
        </BreadcrumbContextProvider>
      );

      expect(spy).toHaveBeenCalledWith(expect.anything(), organization.slug, {
        setActive: true,
        loadProjects: true,
      });
      expect(orgApi).toHaveBeenCalledTimes(1);
    });

    it('does not fetch org details for SidebarDropdown', function () {
      const {rerender} = render(
        <BreadcrumbContextProvider>
          <SettingsIndex {...props} params={{}} organization={null} />
        </BreadcrumbContextProvider>
      );

      // org already has details
      rerender(
        <BreadcrumbContextProvider>
          <SettingsIndex {...props} organization={Organization()} />
        </BreadcrumbContextProvider>
      );

      expect(spy).not.toHaveBeenCalledWith();
      expect(orgApi).not.toHaveBeenCalled();
    });
  });
});
