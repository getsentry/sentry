import React from 'react';
import {shallow} from 'enzyme';

import ReleaseProgress from 'app/views/projectReleases/releaseProgress';

describe('ReleaseProgress', function() {
  describe('renders', function() {
    it('should show progress bar', function() {
      let routerContext = TestStubs.routerContext();
      let wrapper = shallow(<ReleaseProgress />, routerContext);
      expect(wrapper).toMatchSnapshot();
    });
  });
});
