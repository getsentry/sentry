import React from 'react';
import {shallow, mount} from 'enzyme';
import _ from 'lodash';
import {InviteMember} from 'app/views/settings/organizationMembers/inviteMember';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/api');
jest.mock('jquery');

describe('CreateProject', function() {
  let sandbox;
  const baseProps = {
    params: {
      orgId: 'testOrg',
    },
    location: {query: {}},
  };

  const baseContext = TestStubs.routerContext([
    {
      organization: {
        id: '1',
        slug: 'testOrg',
        teams: [
          {slug: 'bar', id: '1', name: 'bar', hasAccess: true},
          {slug: 'foo', id: '2', name: 'foo', hasAccess: false},
        ],
      },
      location: {query: {}},
    },
  ]);

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    sandbox.stub(ConfigStore, 'getConfig').returns({id: 1, invitesEnabled: true});
    MockApiClient.clearMockResponses();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('should render loading', function() {
    let wrapper = shallow(<InviteMember {...baseProps} />, baseContext);
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

    let context = _.cloneDeep(baseContext);

    let team = context.context.organization.teams.slice(0, 1);
    context.context.organization.teams = team;

    let wrapper = mount(<InviteMember {...baseProps} />, context);

    expect(wrapper.state('selectedTeams').size).toBe(1);
    expect(wrapper.state('selectedTeams').has(team[0].slug)).toBe(true);
  });

  it('can select and deselect all teams', function() {
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

    let wrapper = mount(<InviteMember {...baseProps} />, baseContext);

    let first = 'TeamSelect Checkbox[id="bar"]';
    let last = 'TeamSelect Checkbox[id="foo"]';
    let selectAllButton = wrapper.find('Button[data-test-id="select-all"]');

    expect(wrapper.state('selectedTeams').size).toBe(0);
    expect(selectAllButton).toHaveLength(1);

    // select and deselect all
    selectAllButton.simulate('click');
    expect(wrapper.state('selectedTeams').size).toBe(2);
    expect(wrapper.find(first).prop('checked')).toBe(true);
    expect(wrapper.find(last).prop('checked')).toBe(true);

    selectAllButton.simulate('click');
    expect(wrapper.state('selectedTeams').size).toBe(0);
    expect(wrapper.find(first).prop('checked')).toBe(false);
    expect(wrapper.find(last).prop('checked')).toBe(false);

    // select one, then select all
    wrapper.find(first).simulate('change');
    expect(wrapper.state('selectedTeams').size).toBe(1);
    selectAllButton.simulate('click');
    expect(wrapper.state('selectedTeams').size).toBe(2);
    selectAllButton.simulate('click');
    expect(wrapper.state('selectedTeams').size).toBe(0);

    // select both, then deselect all
    wrapper.find(first).simulate('change');
    expect(wrapper.state('selectedTeams').size).toBe(1);
    wrapper.find(last).simulate('change');
    expect(wrapper.state('selectedTeams').size).toBe(2);
    selectAllButton.simulate('click');
    expect(wrapper.state('selectedTeams').size).toBe(0);
  });

  it('should use invite/add language based on config', function() {
    sandbox.restore(ConfigStore, 'getConfig');
    sandbox.stub(ConfigStore, 'getConfig').returns({id: 1, invitesEnabled: false});

    let wrapper = shallow(<InviteMember {...baseProps} />, baseContext);
    wrapper.setState({
      loading: false,
    });

    // Lets just target message
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

    let pushMock = jest.fn();
    let wrapper = mount(
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

    wrapper = mount(
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

    let inviteRequest = {
      url: '/organizations/testOrg/members/',
      method: 'POST',
      statusCode: 200,
      body: {},
    };

    let mock = MockApiClient.addMockResponse(inviteRequest);

    let wrapper = mount(<InviteMember {...baseProps} />, baseContext);

    expect(wrapper.state('loading')).toBe(false);

    let node = wrapper.find('RoleSelect PanelItem').first();
    node.props().onClick();

    node = wrapper.find('.team-choices input').first();
    node.props().onChange({preventDefault: () => {}});

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

    let inviteRequest = {
      url: '/organizations/testOrg/members/',
      method: 'POST',
      statusCode: 400,
      body: {
        email: ['Enter a valid email address.'],
      },
    };

    let mock = MockApiClient.addMockResponse(inviteRequest);

    let wrapper = mount(<InviteMember {...baseProps} />, baseContext);

    let node = wrapper.find('RoleSelect PanelItem').first();
    node.props().onClick();

    node = wrapper.find('.team-choices input').first();
    node.props().onChange({preventDefault: () => {}});

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
});
