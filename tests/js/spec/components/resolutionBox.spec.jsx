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
    it('handles inNextRelease with actor', function() {
      let wrapper = shallow(
        <ResolutionBox
          statusDetails={{
            inNextRelease: true,
            actor: {name: 'David Cramer', email: 'david@sentry.io'}
          }}
          params={{orgId: 'org', projectId: 'project'}}
        />
      );
      expect(toJson(wrapper)).toMatchSnapshot();
    });
    it('handles inRelease', function() {
      let wrapper = shallow(
        <ResolutionBox
          statusDetails={{
            inRelease: '1.0'
          }}
          params={{orgId: 'org', projectId: 'project'}}
        />
      );
      expect(toJson(wrapper)).toMatchSnapshot();
    });
    it('handles inRelease with actor', function() {
      let wrapper = shallow(
        <ResolutionBox
          statusDetails={{
            inRelease: '1.0',
            actor: {name: 'David Cramer', email: 'david@sentry.io'}
          }}
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
