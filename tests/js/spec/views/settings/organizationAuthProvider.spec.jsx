import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import OrganizationAuthProvider from 'app/views/settings/organizationAuth/organizationAuthProvider';

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
    expect(
      wrapper
        .find('Select2Field')
        .find('select')
        .prop('value')
    ).toBe('admin');
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
