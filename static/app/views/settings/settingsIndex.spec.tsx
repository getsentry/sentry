import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as OrgActions from 'sentry/actionCreators/organizations';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import SettingsIndex from 'sentry/views/settings/settingsIndex';

import {BreadcrumbProvider} from './components/settingsBreadcrumb/context';

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
      <BreadcrumbProvider>
        <SettingsIndex {...props} organization={OrganizationFixture()} />
      </BreadcrumbProvider>
    );
  });

  it('has loading when there is no organization', function () {
    render(
      <BreadcrumbProvider>
        <SettingsIndex {...props} organization={null} />
      </BreadcrumbProvider>
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('has different links for self-hosted users', function () {
    ConfigStore.set('isSelfHosted', true);

    render(
      <BreadcrumbProvider>
        <SettingsIndex {...props} organization={OrganizationFixture()} />
      </BreadcrumbProvider>
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
    } as unknown as Organization;

    const spy = jest.spyOn(OrgActions, 'fetchOrganizationDetails');
    let orgApi: jest.Mock;

    beforeEach(function () {
      ConfigStore.set('isSelfHosted', false);
      MockApiClient.clearMockResponses();
      orgApi = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
      });
    });

    it('fetches org details for SidebarDropdown', async function () {
      const {rerender} = render(
        <BreadcrumbProvider>
          <SettingsIndex {...props} params={{}} organization={null} />
        </BreadcrumbProvider>
      );

      // org from index endpoint, no `access` info
      rerender(
        <BreadcrumbProvider>
          <SettingsIndex {...props} organization={organization} />
        </BreadcrumbProvider>
      );

      await waitFor(() => expect(orgApi).toHaveBeenCalledTimes(1));
      expect(spy).toHaveBeenCalledWith(expect.anything(), organization.slug, {
        setActive: true,
        loadProjects: true,
      });
    });

    it('does not fetch org details for SidebarDropdown', function () {
      const {rerender} = render(
        <BreadcrumbProvider>
          <SettingsIndex {...props} params={{}} organization={null} />
        </BreadcrumbProvider>
      );

      // org already has details
      rerender(
        <BreadcrumbProvider>
          <SettingsIndex {...props} organization={OrganizationFixture()} />
        </BreadcrumbProvider>
      );

      expect(spy).not.toHaveBeenCalledWith();
      expect(orgApi).not.toHaveBeenCalled();
    });
  });
});
