import React from 'react';
import PropTypes from 'prop-types';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import OnboardingWizard from 'app/views/onboarding/';
import Project from 'app/views/onboarding/project';

describe('OnboardingWizard', function() {
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

      let wrapper = shallow(<OnboardingWizard {...props} />, {
        organization: {id: '1337', slug: 'testOrg'},
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('should render and respond to click events', function() {
      let props = {
        ...baseProps,
        children: (
          <Project
            next={jest.fn()}
            platform={''}
            setName={jest.fn()}
            name={''}
            setPlatform={jest.fn()}
          />
        ),
      };

      let wrapper = mount(<OnboardingWizard {...props} />, {
        context: {
          organization: {id: '1337', slug: 'testOrg'},
          router: TestStubs.router(),
        },
        childContextTypes: {
          router: PropTypes.object,
          organization: PropTypes.object,
        },
      });

      expect(wrapper).toMatchSnapshot();
      let node = wrapper.find('PlatformCard').first();
      node.simulate('click');
      expect(wrapper).toMatchSnapshot();
    });
  });
});
