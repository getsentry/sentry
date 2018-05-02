import {shallow} from 'enzyme';
import React from 'react';

import {SettingsIndex} from 'app/views/settings/settingsIndex';
import ConfigStore from 'app/stores/configStore';

describe('SettingsIndex', function() {
  it('renders', function() {
    let wrapper = shallow(<SettingsIndex organization={TestStubs.Organization()} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('has loading when there is no organization', function() {
    let wrapper = shallow(<SettingsIndex organization={null} />);

    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
  });

  it('has different links for on premise users', function() {
    ConfigStore.set('isOnPremise', true);

    let wrapper = shallow(<SettingsIndex organization={TestStubs.Organization()} />);

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
});
