import {BreadcrumbContextProvider} from 'sentry-test/providers/breadcrumbContextProvider';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import * as OrgActions from 'sentry/actionCreators/organizations';
import ConfigStore from 'sentry/stores/configStore';
import {Organization} from 'sentry/types';
import SettingsIndex from 'sentry/views/settings/settingsIndex';

describe('SettingsIndex', function () {
  const props = {
    router: TestStubs.router(),
    location: {} as any,
    routes: [],
    route: {},
    params: {},
    routeParams: {},
  };

  it('renders', function () {
    const {container} = render(
      <BreadcrumbContextProvider>
        <SettingsIndex {...props} organization={TestStubs.Organization()} />
      </BreadcrumbContextProvider>
    );
    expect(container).toSnapshot();
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
        <SettingsIndex {...props} organization={TestStubs.Organization()} />
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
    } as Organization;

    const spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    const api = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
    });

    beforeEach(function () {
      ConfigStore.set('isSelfHosted', false);
      spy.mockClear();
      api.mockClear();
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

      expect(spy).toHaveBeenCalledWith(organization.slug, {
        setActive: true,
        loadProjects: true,
      });
      expect(api).toHaveBeenCalledTimes(1);
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
          <SettingsIndex {...props} organization={TestStubs.Organization()} />
        </BreadcrumbContextProvider>
      );

      expect(spy).not.toHaveBeenCalledWith();
      expect(api).not.toHaveBeenCalled();
    });
  });
});
