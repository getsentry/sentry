import React from 'react';
import {shallow, mount} from 'enzyme';

import ReleaseLanding from 'app/views/projectReleases/releaseLanding';
import ReleaseProgress from 'app/views/projectReleases/releaseProgress';

describe('ReleaseLanding', function() {
  describe('renders and progresses', function() {
    it('should show first card', function() {
      let routerContext = TestStubs.routerContext();
      let wrapper = mount(<ReleaseLanding />, routerContext);
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('ContributorsCard').exists()).toBe(true);
      wrapper
        .find('StyledButton')
        .first()
        .simulate('click');
      expect(wrapper.find('StyledSuggestedAssignees').exists()).toBe(true);
    });
  });
});

describe('ReleaseProgress', function() {
  describe('renders', function() {
    it('should show progress bar', function() {
      let routerContext = TestStubs.routerContext();
      let wrapper = shallow(<ReleaseProgress />, routerContext);
      expect(wrapper).toMatchSnapshot();
    });
  });
});
