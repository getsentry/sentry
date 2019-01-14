import React from 'react';
import {shallow, mount} from 'enzyme';

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

  it('renders for members', function() {
    let wrapper = mount(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProviders()}
        activeProvider={TestStubs.AuthProviders()[0]}
      />,
      TestStubs.routerContext([
        {
          organization: TestStubs.Organization({access: ['org:read']}),
        },
      ])
    );

    expect(wrapper.find('ProviderItem ActiveIndicator')).toHaveLength(1);
  });

  describe('with 2fa warning', function() {
    const require2fa = {require2FA: true};
    const withSSO = {features: ['sso-basic']};
    const withSAML = {features: ['sso-saml2']};

    it('renders', function() {
      let context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...require2fa, ...withSSO})},
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

    it('renders with saml available', function() {
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

    it('does not render without sso available', function() {
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

    it('does not render with sso and require 2fa disabled', function() {
      let context = TestStubs.routerContext([
        {organization: TestStubs.Organization({...withSSO})},
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

    it('does not render with saml and require 2fa disabled', function() {
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
