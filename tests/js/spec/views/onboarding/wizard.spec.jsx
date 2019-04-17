import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import OnboardingWizard from 'app/views/onboarding/wizard';

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
  });
});
