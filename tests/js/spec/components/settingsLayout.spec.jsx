import React from 'react';

import {shallow} from 'sentry-test/enzyme';

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
    const wrapper = shallow(<SettingsLayout route={{}} routes={[]} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('can render navigation', function() {
    const Navigation = () => <div>Navigation</div>;
    const wrapper = shallow(
      <SettingsLayout route={{}} routes={[]} renderNavigation={() => <Navigation />} />
    );

    expect(wrapper.find('Navigation')).toHaveLength(1);
  });
});
