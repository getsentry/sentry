import {mountWithTheme} from 'sentry-test/enzyme';

import * as OrgActions from 'sentry/actionCreators/organizations';
import ConfigStore from 'sentry/stores/configStore';
import {SettingsIndex} from 'sentry/views/settings/settingsIndex';

describe('SettingsIndex', function () {
  let wrapper;

  it('renders', function () {
    wrapper = mountWithTheme(
      <SettingsIndex
        router={TestStubs.router()}
        organization={TestStubs.Organization()}
      />
    );
    expect(wrapper).toSnapshot();
  });

  it('has loading when there is no organization', function () {
    wrapper = mountWithTheme(
      <SettingsIndex router={TestStubs.router()} organization={null} />
    );

    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
  });

  it('has different links for self-hosted users', function () {
    ConfigStore.set('isSelfHosted', true);

    wrapper = mountWithTheme(
      <SettingsIndex
        router={TestStubs.router()}
        organization={TestStubs.Organization()}
      />
    );

    expect(
      wrapper.find(
        'HomePanelHeader SupportLinkComponent[href="https://forum.sentry.io/"]'
      )
    ).toHaveLength(1);

    expect(
      wrapper
        .find('HomePanelBody SupportLinkComponent[href="https://forum.sentry.io/"]')
        .prop('children')
    ).toBe('Community Forums');
  });

  describe('Fetch org details for Sidebar', function () {
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
      ConfigStore.config.isSelfHosted = false;
      wrapper = mountWithTheme(<SettingsIndex router={TestStubs.router()} params={{}} />);
    });

    it('fetches org details for SidebarDropdown', function () {
      // org from index endpoint, no `access` info
      wrapper.setProps({organization});
      wrapper.update();

      expect(spy).toHaveBeenCalledWith(organization.slug, {
        setActive: true,
        loadProjects: true,
      });
      expect(api).toHaveBeenCalledTimes(1);
    });

    it('does not fetch org details for SidebarDropdown', function () {
      // org already has details
      wrapper.setProps({organization: TestStubs.Organization()});
      wrapper.update();

      expect(spy).not.toHaveBeenCalledWith();
      expect(api).not.toHaveBeenCalled();
    });
  });
});
