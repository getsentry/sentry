import React from 'react';
import {shallow, mount} from 'enzyme';

import InviteMember from 'app/views/inviteMember/inviteMember';
import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';

jest.mock('app/api');

describe('CreateProject', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    this.sandbox.stub(ConfigStore, 'get').returns({id: 1});
  });

  afterEach(function() {
    this.sandbox.restore();
    Client.clearMockResponses();
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
          teams: [{slug: 'test', id: '1', name: 'test', hasAccess: false}]
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

    it('should render roles when available and allowed', function() {
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
              allowed: true
            }
          ]
        }
      });

      let wrapper = mount(<InviteMember {...baseProps} />, baseContext);

      expect(wrapper.state('loading')).toBe(false);
      expect(wrapper).toMatchSnapshot();
    });
  });
});
