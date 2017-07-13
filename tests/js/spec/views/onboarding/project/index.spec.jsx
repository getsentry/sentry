import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import {Client} from 'app/api';
import Project from 'app/views/onboarding/project';

describe('Project', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('render()', function() {
    const baseProps = {
      location: {query: {}},
      params: {
        projectId: '',
        orgId: 'testOrg'
      }
    };

    it('should render NotFound if no matching organization', function() {
      let props = {
        ...baseProps,
        params: {
          orgId: 'my-cool-org'
        }
      };

      let wrapper = shallow(<Project {...props} />, {
        organization: {id: '1337', slug: 'testOrg'}
      });
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
