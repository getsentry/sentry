import React from 'react';
import {mount} from 'enzyme';

import ReleaseLanding from 'app/views/projectReleases/releaseLanding';

describe('ReleaseLanding', function() {
  describe('renders and progresses', function() {
    it('should show first card', function() {
      let routerContext = TestStubs.routerContext();
      let wrapper = mount(<ReleaseLanding />, routerContext);

      expect(wrapper.find('ContributorsCard').exists()).toBe(true);
      wrapper
        .find('StyledButton')
        .first()
        .simulate('click');
      expect(wrapper.find('StyledSuggestedAssignees').exists()).toBe(true);
      expect(wrapper.find('ContributorsCard').exists()).toBe(false);
    });
  });
});
