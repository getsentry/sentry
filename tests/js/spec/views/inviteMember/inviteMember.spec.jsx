import React from 'react';
import cloneDeep from 'lodash/cloneDeep';

import {shallow, mountWithTheme} from 'sentry-test/enzyme';

import {InviteMember} from 'app/views/settings/organizationMembers/inviteMember';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/api');
jest.mock('jquery');

describe('InviteMember', function() {
  let organization, baseProps, teams, baseContext;

  beforeEach(function() {
    organization = TestStubs.Organization({
      id: '1',
      slug: 'testOrg',
      teams: [
        {slug: 'bar', id: '1', name: 'bar', hasAccess: true},
        {slug: 'foo', id: '2', name: 'foo', hasAccess: false},
      ],
    });

    baseProps = {
      api: new MockApiClient(),
      params: {
        orgId: 'testOrg',
      },
      organization,
      location: {query: {}},
    };

    teams = [
      {slug: 'bar', id: '1', name: 'bar', hasAccess: true},
      {slug: 'foo', id: '2', name: 'foo', hasAccess: false},
    ];

    baseContext = TestStubs.routerContext([
      {
        organization,
        location: {query: {}},
      },
    ]);

    jest.spyOn(ConfigStore, 'getConfig').mockImplementation(() => ({
      id: 1,
      invitesEnabled: true,
    }));
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/teams/',
      body: teams,
    });
  });

  it('should render loading', function() {
    const wrapper = shallow(<InviteMember {...baseProps} />, {
      ...baseContext,
      disableLifecycleMethods: true,
    });
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });

  it('should render no team select when there is only one option', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {
            id: '1',
            name: 'member',
            desc: 'a normal member',
            allowed: true,
          },
        ],
      },
    });

    const context = cloneDeep(baseContext);

    const team = organization.teams.slice(0, 1);
    organization.teams = team;

    const wrapper = mountWithTheme(<InviteMember {...baseProps} />, context);

    expect(wrapper.state('selectedTeams').size).toBe(1);
    expect(wrapper.state('selectedTeams').has(team[0].slug)).toBe(true);
  });

  it('should use invite/add language based on config', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {
            id: '1',
            name: 'member',
            desc: 'a normal member',
            allowed: true,
          },
        ],
      },
    });
    jest.spyOn(ConfigStore, 'getConfig').mockImplementation(() => ({
      id: 1,
      invitesEnabled: false,
    }));

    const wrapper = shallow(<InviteMember {...baseProps} />, {
      ...baseContext,
    });
    wrapper.setState({
      loading: false,
    });

    // Lets just target message
    expect(wrapper.find('TextBlock')).toSnapshot();
    expect(wrapper.find('TextBlock')).toMatchSnapshot();
  });

  it('should redirect when no roles available', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {
            id: '1',
            name: 'member',
            desc: 'a normal member',
            allowed: false,
          },
        ],
      },
    });

    const pushMock = jest.fn();
    let wrapper = mountWithTheme(
      <InviteMember
        router={{
          push: pushMock,
          location: {
            pathname: '/settings/testOrg/members/new/',
          },
        }}
        {...baseProps}
      />,
      baseContext
    );

    expect(pushMock).toHaveBeenCalledWith('/settings/testOrg/members/');
    expect(wrapper.state('loading')).toBe(false);

    wrapper = mountWithTheme(
      <InviteMember
        router={{
          push: pushMock,
          location: {
            pathname: '/organizations/testOrg/members/new/',
          },
        }}
        {...baseProps}
      />,
      baseContext
    );

    expect(pushMock).toHaveBeenCalledWith('/organizations/testOrg/members/');
  });

  it('should render roles when available and allowed, and handle submitting', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {id: '1', name: 'member', desc: 'a normal member', allowed: true},
          {id: '2', name: 'bar', desc: 'another role', allowed: true},
        ],
      },
    });

    const inviteRequest = {
      url: '/organizations/testOrg/members/',
      method: 'POST',
      statusCode: 200,
      body: {},
    };

    const mock = MockApiClient.addMockResponse(inviteRequest);

    const wrapper = mountWithTheme(<InviteMember {...baseProps} />, baseContext);

    expect(wrapper.state('loading')).toBe(false);

    let node = wrapper.find('RoleSelect PanelItem').first();
    node.props().onClick();

    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();

    node = wrapper.find('.invite-member-submit').first();
    node.props().onClick({preventDefault: () => {}});
    expect(wrapper.state('busy')).toBe(false);

    wrapper.setState({email: 'test@email.com, test2@email.com, test3@email.com, '});

    node.props().onClick({preventDefault: () => {}});
    expect(wrapper.state('busy')).toBe(true);
    expect(wrapper.state('error')).toBe(undefined);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it('shows an error when submitting an invalid email', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {id: '1', name: 'member', desc: 'a normal member', allowed: true},
          {id: '2', name: 'bar', desc: 'another role', allowed: true},
        ],
      },
    });

    const inviteRequest = {
      url: '/organizations/testOrg/members/',
      method: 'POST',
      statusCode: 400,
      body: {
        email: ['Enter a valid email address.'],
      },
    };

    const mock = MockApiClient.addMockResponse(inviteRequest);

    const wrapper = mountWithTheme(<InviteMember {...baseProps} />, baseContext);

    let node = wrapper.find('RoleSelect PanelItem').first();
    node.props().onClick();

    node = wrapper.find('.invite-member-submit').first();
    node.props().onClick({preventDefault: () => {}});
    expect(wrapper.state('busy')).toBe(false);

    wrapper.setState({email: 'invalid-email'});

    node.props().onClick({preventDefault: () => {}});
    expect(wrapper.state('busy')).toBe(true);
    expect(wrapper.state('error')).toBe(undefined);
    expect(mock).toHaveBeenCalledTimes(1);

    await tick();
    wrapper.update();
    expect(wrapper.state('error')).toBeDefined();
    expect(wrapper.find('.has-error')).toHaveLength(1);
    expect(wrapper.find('.has-error #id-email')).toHaveLength(1);
    expect(wrapper.find('.has-error .error').text()).toBe('Enter a valid email address.');
  });

  it('allows teams to be removed', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {id: '1', name: 'member', desc: 'a normal member', allowed: true},
          {id: '2', name: 'bar', desc: 'another role', allowed: true},
        ],
      },
    });
    const inviteRequest = MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/',
      method: 'POST',
      statusCode: 200,
    });

    const wrapper = mountWithTheme(<InviteMember {...baseProps} />, baseContext);
    // Wait for team list to load
    await tick();

    // set the email address
    wrapper.find('input[name="email"]').simulate('change', {
      target: {value: 'test@example.com'},
    });

    // Select new team to join
    // Open the dropdown
    wrapper.find('TeamSelect DropdownButton').simulate('click');

    // Click the first item
    wrapper
      .find('TeamSelect TeamDropdownElement')
      .first()
      .simulate('click');

    // Remove our one team
    const button = wrapper.find('TeamSelect TeamRow Button');
    expect(button).toHaveLength(1);
    button.simulate('click');

    // Save Member
    wrapper.find('Button[priority="primary"]').simulate('click');

    expect(inviteRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          teams: [],
        }),
      })
    );
  });

  it('allows teams to be added', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/me/',
      body: {
        roles: [
          {id: '1', name: 'member', desc: 'a normal member', allowed: true},
          {id: '2', name: 'bar', desc: 'another role', allowed: true},
        ],
      },
    });
    const inviteRequest = MockApiClient.addMockResponse({
      url: '/organizations/testOrg/members/',
      method: 'POST',
      statusCode: 200,
    });
    const wrapper = mountWithTheme(<InviteMember {...baseProps} />, baseContext);

    // Wait for team list to fetch.
    await wrapper.update();

    // set the email address
    wrapper.find('input[name="email"]').simulate('change', {
      target: {value: 'test@example.com'},
    });

    // Select new team to join
    // Open the dropdown
    wrapper.find('TeamSelect DropdownButton').simulate('click');

    // Click the first item
    wrapper
      .find('TeamSelect TeamDropdownElement')
      .first()
      .simulate('click');

    // Save Member
    wrapper.find('Button[priority="primary"]').simulate('click');

    expect(inviteRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          teams: ['bar'],
        }),
      })
    );
  });
});
