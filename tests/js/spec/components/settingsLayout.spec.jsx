import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import SettingsLayout from 'app/views/settings/components/settingsLayout';

describe('SettingsLayout', function() {
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    Client.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization()],
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 401,
      body: {
        sudoRequired: true,
      },
    });
    Client.addMockResponse({
      url: '/authenticators/',
      body: [],
    });
  });

  it('renders', function() {
    const wrapper = mountWithTheme(
      <SettingsLayout router={TestStubs.router()} route={{}} routes={[]} />
    );

    expect(wrapper).toSnapshot();
  });

  it('can render navigation', function() {
    const Navigation = () => <div>Navigation</div>;
    const wrapper = mountWithTheme(
      <SettingsLayout
        router={TestStubs.router()}
        route={{}}
        routes={[]}
        renderNavigation={() => <Navigation />}
      />
    );

    expect(wrapper.find('Navigation')).toHaveLength(1);
  });

  it('can toggle mobile navigation', function() {
    const Navigation = () => <div>Navigation</div>;
    const wrapper = mountWithTheme(
      <SettingsLayout
        router={TestStubs.router()}
        route={{}}
        routes={[]}
        renderNavigation={() => <Navigation />}
      />
    );

    expect(wrapper.find('NavMask').prop('isVisible')).toBeFalsy();
    expect(wrapper.find('SidebarWrapper').prop('isVisible')).toBeFalsy();

    wrapper.find('NavMenuToggle').simulate('click');

    expect(wrapper.find('NavMask').prop('isVisible')).toBeTruthy();
    expect(wrapper.find('SidebarWrapper').prop('isVisible')).toBeTruthy();
  });
});
