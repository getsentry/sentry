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

  it('renders require 2fa warning', function() {
    let wrapper = shallow(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProvidersSaml()}
      />,
      {
        context: {
          organization: TestStubs.Organization({require2FA: true}),
        },
      }
    );

    expect(wrapper.find('PanelAlert[type="warning"]')).toHaveLength(1);
  });

  it('does not render warning without saml available', function() {
    let wrapper = shallow(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProviders()}
      />,
      {
        context: {
          organization: TestStubs.Organization({require2FA: true}),
        },
      }
    );

    expect(wrapper.find('PanelAlert[type="warning"]')).toHaveLength(0);
  });

  it('does not render warning without require 2fa enabled', function() {
    let wrapper = shallow(
      <OrganizationAuthList
        orgId="org-slug"
        onSendReminders={() => {}}
        providerList={TestStubs.AuthProvidersSaml()}
      />,
      {
        context: {
          organization: TestStubs.Organization({require2FA: false}),
        },
      }
    );

    expect(wrapper.find('PanelAlert[type="warning"]')).toHaveLength(0);
  });
});
