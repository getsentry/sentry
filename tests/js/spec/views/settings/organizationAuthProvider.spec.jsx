import React from 'react';

import {Client} from 'app/api';
import {shallow, mount} from 'enzyme';
import OrganizationAuthProvider from 'app/views/settings/organizationAuth/organizationAuthProvider';

import {findOption, openMenu} from '../../../helpers/select';

jest.mock('jquery');

describe('OrganizationAuthProvider', function() {
  let routerContext = TestStubs.routerContext();

  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/organizations/org-slug/auth-provider/',
      method: 'GET',
      body: TestStubs.AuthProvider(),
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/auth-providers/',
      method: 'GET',
      body: [TestStubs.AuthProvider()],
    });
  });

  it('renders with no provider', function() {
    let wrapper = shallow(
      <OrganizationAuthProvider
        orgId="org-slug"
        onSendReminders={() => {}}
        provider={null}
      />,
      routerContext
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders', function() {
    let wrapper = shallow(
      <OrganizationAuthProvider
        orgId="org-slug"
        onSendReminders={() => {}}
        provider={TestStubs.AuthProvider()}
      />,
      routerContext
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders with Unlinked members ', function() {
    let wrapper = shallow(
      <OrganizationAuthProvider
        orgId="org-slug"
        onSendReminders={() => {}}
        provider={{
          ...TestStubs.AuthProvider(),
          pending_links_count: 4,
        }}
      />,
      routerContext
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders with provider template', function() {
    let wrapper = shallow(
      <OrganizationAuthProvider
        orgId="org-slug"
        onSendReminders={() => {}}
        provider={{
          ...TestStubs.AuthProvider(),
          content: '<strong>Test</strong>',
        }}
      />,
      routerContext
    );

    expect(wrapper.find('.box-content')).toMatchSnapshot();
  });

  it('renders with Require Link and Default Role as admin', function() {
    let wrapper = mount(
      <OrganizationAuthProvider
        orgId="org-slug"
        onSendReminders={() => {}}
        provider={{
          ...TestStubs.AuthProvider(),
          require_link: true,
          default_role: 'admin',
        }}
      />,
      routerContext
    );

    expect(
      wrapper
        .find('BooleanField')
        .find('input')
        .prop('checked')
    ).toBe(true);

    openMenu(wrapper, {selector: 'default_role'});
    expect(
      findOption(wrapper, {label: 'Admin'}, {selector: 'default_role'})
    ).toHaveLength(1);
  });

  it('can disable provider', function() {
    let mock = jest.fn();
    let wrapper = mount(
      <OrganizationAuthProvider
        orgId="org-slug"
        onSendReminders={() => {}}
        onDisableProvider={mock}
        provider={TestStubs.AuthProvider()}
      />,
      routerContext
    );

    let disableButton = wrapper.find('.form-actions').find('Button');

    disableButton.simulate('click');

    expect(mock).toHaveBeenCalledWith('dummy');
  });
});
