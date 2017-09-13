import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import InviteMember from 'app/views/inviteMember/inviteMember';

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
  });
});
