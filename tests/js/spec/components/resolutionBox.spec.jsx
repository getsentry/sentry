import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import ResolutionBox from 'app/components/resolutionBox';

describe('ResolutionBox', function() {
  describe('render()', function() {
    it('handles inNextRelease', function() {
      let wrapper = shallow(
        <ResolutionBox
          statusDetails={{inNextRelease: true}}
          params={{orgId: 'org', projectId: 'project'}}
        />
      );
      expect(toJson(wrapper)).toMatchSnapshot();
    });
    it('handles inRelease', function() {
      let wrapper = shallow(
        <ResolutionBox
          statusDetails={{inRelease: '1.0'}}
          params={{orgId: 'org', projectId: 'project'}}
        />
      );
      expect(toJson(wrapper)).toMatchSnapshot();
    });
    it('handles default', function() {
      let wrapper = shallow(
        <ResolutionBox statusDetails={{}} params={{orgId: 'org', projectId: 'project'}} />
      );
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
