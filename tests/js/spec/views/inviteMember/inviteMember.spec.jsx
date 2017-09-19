import React from 'react';
import {shallow, mount} from 'enzyme';

import InviteMember from 'app/views/inviteMember/inviteMember';
import {Client} from 'app/api';

jest.mock('app/api');

describe('CreateProject', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request');
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

    it('should render', function() {
      let props = {
        ...baseProps
      };

      let wrapper = shallow(<InviteMember {...props} />, {
        context: {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: false}]
          },
          location: {query: {}}
        },
        childContextTypes: {
          organization: React.PropTypes.object,
          location: React.PropTypes.object
        }
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('should redirect on zero teams', function() {
      Client.addMockResponse({
        url: '/organizations/test/members/',
        body: {
          entries: 'test'
        }
      });

      let props = {
        ...baseProps
      };

      let wrapper = mount(<InviteMember {...props} />, {
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
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});
