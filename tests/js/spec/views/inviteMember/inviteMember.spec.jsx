import React from 'react';
import {shallow, mount} from 'enzyme';
import _ from 'lodash';
import InviteMember from 'app/views/inviteMember/inviteMember';
import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/api');

describe('CreateProject', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    this.sandbox.stub(ConfigStore, 'get').returns({id: 1});
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
      let context = _.cloneDeep(baseContext);

      context.context.organization.teams = context.context.organization.teams.slice(0, 1);

      let wrapper = shallow(<InviteMember {...baseProps} />, context);

      expect(wrapper).toMatchSnapshot();
    });

    it('should redirect when no roles available', function() {
      Client.addMockResponse({
        url: '/organizations/testOrg/members/1/',
        body: {
          role_list: [
            {
              role: {
                id: 1,
                name: 'member',
                desc: 'a normal member'
              },
              allowed: false
            }
          ],
          is_invite: true
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
        url: '/organizations/testOrg/members/1/',
        body: {
          role_list: [
            {
              role: {id: 1, name: 'member', desc: 'a normal member'},
              allowed: true
            },
            {
              role: {id: 2, name: 'bar', desc: 'another role'},
              allowed: true
            }
          ],
          is_invite: true
        }
      });

      Client.addMockResponse({
        url: '/organizations/testOrg/members/',
        method: 'POST',
        statusCode: 200,
        body: {}
      });

      let wrapper;

      // 👺 ⚠️ this is a hack to defeat the method auto binding so we can fully stub the method. It would not be neccessary with es6 class components and it relies on react internals so it's fragile - maxbittker
      const index =
        InviteMember.prototype.__reactAutoBindPairs.indexOf('redirectToMemberPage') + 1;
      InviteMember.prototype.__reactAutoBindPairs[index] = () => {
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

      node = wrapper.find('.submit-new-team').first();
      node.props().onClick({preventDefault: () => {}});
      expect(wrapper.state('loading')).toBe(false);

      wrapper.setState({email: 'test@email.com'});
      node.props().onClick({preventDefault: () => {}});
    });
  });
});
