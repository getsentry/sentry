import React from 'react';
import {shallow} from 'enzyme';

import OrganizationAuthList from 'app/views/settings/organizationAuth/organizationAuthList';

jest.mock('jquery');

describe('OrganizationAuthList', function() {
  it('renders with no providers', function() {
    let wrapper = shallow(
      <OrganizationAuthList providerList={[]} />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders', function() {
    let wrapper = shallow(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProviders()}
      />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });

  describe('with 2fa warning', function() {
    const require2fa = {require2FA: true};
    const withSAML = {features: ['sso-saml2']};

    it('renders', function() {
      let context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...require2fa, ...withSAML})},
      ]);

      let wrapper = shallow(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
        />,
        context
      );

      expect(wrapper.find('PanelAlert[type="warning"]').exists()).toBe(true);
    });

    it('does not render warning without saml available', function() {
      let context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...require2fa})},
      ]);

      let wrapper = shallow(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
        />,
        context
      );

      expect(wrapper.find('PanelAlert[type="warning"]').exists()).toBe(false);
    });

    it('does not render without require 2fa enabled', function() {
      let context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...withSAML})},
      ]);

      let wrapper = shallow(
        <OrganizationAuthList
          orgId="org-slug"
          onSendReminders={() => {}}
          providerList={TestStubs.AuthProviders()}
        />,
        context
      );

      expect(wrapper.find('PanelAlert[type="warning"]').exists()).toBe(false);
    });
  });
});
