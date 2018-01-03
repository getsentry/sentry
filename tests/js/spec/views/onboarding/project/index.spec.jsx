import PropTypes from 'prop-types';
import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import Project from 'app/views/onboarding/project';

describe('Project', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    this.stubbedApiRequest = sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    const baseProps = {
      next: jest.fn(),
      platform: '',
      setName: jest.fn(),
      name: '',
      setPlatform: jest.fn(),
      location: {query: {}},
      params: {
        projectId: '',
        orgId: 'testOrg',
      },
    };

    it('should render NotFound if no matching organization', function() {
      let props = {
        ...baseProps,
        params: {
          orgId: 'my-cool-org',
        },
      };

      let wrapper = shallow(<Project {...props} />, {
        organization: {id: '1337', slug: 'testOrg'},
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('should set required class on empty submit', function() {
      let props = {
        ...baseProps,
      };

      let wrapper = mount(<Project {...props} />, {
        context: {
          organization: {id: '1337', slug: 'testOrg'},
          router: TestStubs.router(),
        },
        childContextTypes: {
          router: PropTypes.object,
          organization: PropTypes.object,
        },
      });

      let submit = wrapper.find('button').last();
      expect(wrapper.state().projectRequired).toBe(false);
      submit.simulate('click');
      expect(wrapper.state().projectRequired).toBe(true);
      wrapper.setProps({name: 'bar'});
      submit.simulate('click');
      expect(wrapper.state().projectRequired).toBe(false);

      expect(wrapper).toMatchSnapshot();
    });
  });
});
