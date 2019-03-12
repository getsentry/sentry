import React from 'react';
import PropTypes from 'prop-types';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import OnboardingWizard from 'app/views/onboarding/';
import Project from 'app/views/onboarding/project';

describe('OnboardingWizard', function() {
  beforeEach(function() {
    this.stubbedApiRequest = jest.spyOn(Client.prototype, 'request');
  });

  afterEach(function() {});

  describe('render()', function() {
    const baseProps = {
      location: {query: {}},
      params: {
        projectId: '',
        orgId: 'testOrg',
      },
    };

    it('should render NotFound if no matching organization', function() {
      const props = {
        ...baseProps,
        params: {
          orgId: 'my-cool-org',
        },
      };

      const wrapper = shallow(<OnboardingWizard {...props} />, {
        organization: {id: '1337', slug: 'testOrg', experiments: {}},
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('should render and respond to click events', function() {
      const props = {
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

      const wrapper = mount(<OnboardingWizard {...props} />, {
        context: {
          organization: {id: '1337', slug: 'testOrg', experiments: {}},
          router: TestStubs.router(),
          location: {pathname: 'http://lol/', query: {}},
        },
        childContextTypes: {
          router: PropTypes.object,
          organization: PropTypes.object,
          location: PropTypes.object,
        },
      });

      expect(wrapper).toMatchSnapshot();
      const node = wrapper.find('PlatformCard').first();
      node.simulate('click');
      expect(wrapper).toMatchSnapshot();
    });
  });
});
