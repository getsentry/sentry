import React from 'react';
import PropTypes from 'prop-types';
import {shallow, mount} from 'enzyme';
import _ from 'lodash';
import InviteMember from 'app/views/inviteMember/inviteMember';
import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/api');
jest.mock('jquery');

describe('CreateProject', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    sandbox.stub(ConfigStore, 'getConfig').returns({id: 1, invitesEnabled: true});
    Client.clearMockResponses();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    const baseProps = {
      params: {
        orgId: 'testOrg',
      },
    };

    const baseContext = {
      context: {
        organization: {
          id: '1',
          slug: 'testOrg',
          teams: [
            {slug: 'bar', id: '1', name: 'bar', hasAccess: true},
            {slug: 'foo', id: '2', name: 'foo', hasAccess: false},
          ],
        },
        router: TestStubs.router(),
        location: {query: {}},
      },
      childContextTypes: {
        organization: PropTypes.object,
        location: PropTypes.object,
        router: PropTypes.object,
      },
    };

    it('should render loading', function() {
      let wrapper = shallow(<InviteMember {...baseProps} />, baseContext);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render no team select when there is only one option', function() {
      Client.addMockResponse({
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

    it('should use invite/add language based on config', function() {
      sandbox.restore(ConfigStore, 'getConfig');
      sandbox.stub(ConfigStore, 'getConfig').returns({id: 1, invitesEnabled: false});

      let wrapper = shallow(<InviteMember {...baseProps} />, baseContext);
      wrapper.setState({
        loading: false,
      });

      // Lets just target message
      expect(wrapper.find('div > p')).toMatchSnapshot();
    });

    it('should redirect when no roles available', function() {
      Client.addMockResponse({
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

      let handleSubmitStub = sandbox.stub(InviteMember.prototype, 'redirectToMemberPage');
      // 👺 ⚠️ this is a hack to defeat the method auto binding so we can fully stub the method. It would not be neccessary with es6 class components and it relies on react internals so it's fragile - maxbittker
      const index =
        InviteMember.prototype.__reactAutoBindPairs.indexOf('redirectToMemberPage') + 1;
      InviteMember.prototype.__reactAutoBindPairs[index] = handleSubmitStub;

      let wrapper = mount(<InviteMember {...baseProps} />, baseContext);

      expect(handleSubmitStub.callCount).toEqual(1);
      expect(wrapper.state('loading')).toBe(false);
    });

    it('should render roles when available and allowed, and handle submitting', function() {
      Client.addMockResponse({
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

      Client.addMockResponse(inviteRequest);

      let wrapper = mount(<InviteMember {...baseProps} />, baseContext);

      expect(wrapper.state('loading')).toBe(false);

      let node = wrapper.find('.radio').first();
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
      expect(Client.getCallCount(inviteRequest)).toBe(3);
    });
  });
});
