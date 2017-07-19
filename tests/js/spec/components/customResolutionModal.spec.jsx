import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import CustomResolutionModal from 'app/components/customResolutionModal';

describe('CustomResolutionModal', function() {
  describe('render()', function() {
    it('renders correctly', function() {
      let wrapper = shallow(
        <CustomResolutionModal
          orgId="org"
          projectId="project"
          onCanceled={() => false}
          onSelected={() => false}
        />
      );
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
