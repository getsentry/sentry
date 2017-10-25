import React from 'react';
import {shallow, mount} from 'enzyme';
import _ from 'lodash';
import InviteMember from 'app/views/inviteMember/inviteMember';
import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/api');
jest.mock('jquery');

describe('CreateProject', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    this.sandbox.stub(ConfigStore, 'getConfig').returns({id: 1, invitesEnabled: true});
    Client.clearMockResponses();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('render()', function() {
    const baseProps = {
      params: {
        orgId: 'testOrg'
      }
    };

    const baseContext = {
      context: {
        organization: {
          id: '1',
          slug: 'testOrg',
          teams: [
            {slug: 'bar', id: '1', name: 'bar', hasAccess: true},
            {slug: 'foo', id: '2', name: 'foo', hasAccess: false}
          ]
        },
        router: TestStubs.router(),
        location: {query: {}}
      },
      childContextTypes: {
        organization: React.PropTypes.object,
        location: React.PropTypes.object,
        router: React.PropTypes.object
      }
    };

    it('should render', function() {
      let wrapper = shallow(<InviteMember {...baseProps} />, baseContext);
      expect(wrapper).toMatchSnapshot();
    });

    it('should render no team select when there is only one option', function() {
      Client.addMockResponse({
        url: '/organizations/testOrg/members/me/',
        body: {
          allowed_roles: [
            {
              role: {
                id: '1',
                name: 'member',
                desc: 'a normal member'
              },
              allowed: true
            }
          ]
        }
      });

      let context = _.cloneDeep(baseContext);

      context.context.organization.teams = context.context.organization.teams.slice(0, 1);

      let wrapper = mount(<InviteMember {...baseProps} />, context);

      expect(wrapper).toMatchSnapshot();
    });

    it('should use invite/add language based on config', function() {
      this.sandbox.restore(ConfigStore, 'getConfig');
      this.sandbox.stub(ConfigStore, 'getConfig').returns({id: 1, invitesEnabled: false});

      let wrapper = shallow(<InviteMember {...baseProps} />, baseContext);

      expect(wrapper).toMatchSnapshot();
    });

    it('should redirect when no roles available', function() {
      Client.addMockResponse({
        url: '/organizations/testOrg/members/me/',
        body: {
          allowed_roles: [
            {
              role: {
                id: '1',
                name: 'member',
                desc: 'a normal member'
              },
              allowed: false
            }
          ]
        }
      });

      let handleSubmitStub = this.sandbox.stub(
        InviteMember.prototype,
        'redirectToMemberPage'
      );
      // 👺 ⚠️ this is a hack to defeat the method auto binding so we can fully stub the method. It would not be neccessary with es6 class components and it relies on react internals so it's fragile - maxbittker
      const index =
        InviteMember.prototype.__reactAutoBindPairs.indexOf('redirectToMemberPage') + 1;
      InviteMember.prototype.__reactAutoBindPairs[index] = handleSubmitStub;

      let wrapper = mount(<InviteMember {...baseProps} />, baseContext);

      expect(handleSubmitStub.callCount).toEqual(1);
      expect(wrapper.state('loading')).toBe(false);
    });

    it('should render roles when available and allowed, and handle submitting', function(
      done
    ) {
      Client.addMockResponse({
        url: '/organizations/testOrg/members/me/',
        body: {
          allowed_roles: [
            {
              role: {id: '1', name: 'member', desc: 'a normal member'},
              allowed: true
            },
            {
              role: {id: '2', name: 'bar', desc: 'another role'},
              allowed: true
            }
          ]
        }
      });

      let inviteRequest = {
        url: '/organizations/testOrg/members/',
        method: 'POST',
        statusCode: 200,
        body: {}
      };

      Client.addMockResponse(inviteRequest);

      let wrapper;

      // 👺 ⚠️ this is a hack to defeat the method auto binding so we can fully stub the method. It would not be neccessary with es6 class components and it relies on react internals so it's fragile - maxbittker
      const index =
        InviteMember.prototype.__reactAutoBindPairs.indexOf('redirectToMemberPage') + 1;

      InviteMember.prototype.__reactAutoBindPairs[index] = () => {
        expect(Client.getCallCount(inviteRequest)).toBe(3);
        expect(wrapper.state('loading')).toBe(true);
        done();
      };

      wrapper = mount(<InviteMember {...baseProps} />, baseContext);

      expect(wrapper.state('loading')).toBe(false);

      let node = wrapper.find('.radio').first();
      node.props().onClick();

      node = wrapper.find('.team-choices > div').first();
      node.props().onClick({preventDefault: () => {}});

      expect(wrapper).toMatchSnapshot();

      node = wrapper.find('.invite-member-submit').first();
      node.props().onClick({preventDefault: () => {}});
      expect(wrapper.state('loading')).toBe(false);

      wrapper.setState({email: 'test@email.com, test2@email.com, test3@email.com, '});

      node.props().onClick({preventDefault: () => {}});
    });
  });
});
