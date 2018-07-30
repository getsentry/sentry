import {mount} from 'enzyme';
import React from 'react';

import OrganizationSettingsNavigation from 'app/views/settings/organization/organizationSettingsNavigation.jsx';

describe('OrganizationSettingsNavigation', function() {
  it('renders', function() {
    let wrapper = mount(<OrganizationSettingsNavigation />, TestStubs.routerContext());

    expect(wrapper).toMatchSnapshot();
  });

  //These next three are related to the SSOPaywallExperiment and should be taken down when that is phased out
  it('renders without auth nav item for control', function() {
    let wrapper = mount(
      <OrganizationSettingsNavigation />,
      TestStubs.routerContext([
        {
          organization: TestStubs.Organization({
            access: ['org:admin'],
            experiments: {SSOPaywallExperiment: 0},
          }),
        },
      ])
    );

    expect(
      wrapper.find('SettingsNavItem').findWhere(el => el.prop('label') === 'Auth')
    ).toHaveLength(0);
  });

  it('renders with auth nav item for treatment', function() {
    let wrapper = mount(
      <OrganizationSettingsNavigation />,
      TestStubs.routerContext([
        {
          organization: TestStubs.Organization({
            // features: ['sso'],
            access: ['org:admin'],
            experiments: {SSOPaywallExperiment: 1},
          }),
        },
      ])
    );

    expect(
      wrapper.find('SettingsNavItem').findWhere(el => el.prop('label') === 'Auth')
    ).toHaveLength(1);
  });

  it('renders with auth nav item for those not in experiment', function() {
    let wrapper = mount(
      <OrganizationSettingsNavigation />,
      TestStubs.routerContext([
        {
          organization: TestStubs.Organization({
            features: ['sso'],
            access: ['org:admin'],
            experiments: {SSOPaywallExperiment: null},
          }),
        },
      ])
    );

    expect(
      wrapper.find('SettingsNavItem').findWhere(el => el.prop('label') === 'Auth')
    ).toHaveLength(1);
  });
});
