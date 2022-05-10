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
      <SettingsIndex {...props} organization={TestStubs.Organization()} />
    );
    expect(container).toSnapshot();
  });

  it('has loading when there is no organization', function () {
    render(<SettingsIndex {...props} organization={null} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('has different links for self-hosted users', function () {
    ConfigStore.set('isSelfHosted', true);

    render(<SettingsIndex {...props} organization={TestStubs.Organization()} />);

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
        <SettingsIndex {...props} params={{}} organization={null} />
      );

      // org from index endpoint, no `access` info
      rerender(<SettingsIndex {...props} organization={organization} />);

      expect(spy).toHaveBeenCalledWith(organization.slug, {
        setActive: true,
        loadProjects: true,
      });
      expect(api).toHaveBeenCalledTimes(1);
    });

    it('does not fetch org details for SidebarDropdown', function () {
      const {rerender} = render(
        <SettingsIndex {...props} params={{}} organization={null} />
      );

      // org already has details
      rerender(<SettingsIndex {...props} organization={TestStubs.Organization()} />);

      expect(spy).not.toHaveBeenCalledWith();
      expect(api).not.toHaveBeenCalled();
    });
  });
});
