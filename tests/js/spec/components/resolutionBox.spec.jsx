import React from 'react';
import {shallow} from 'sentry-test/enzyme';

import ResolutionBox from 'app/components/resolutionBox';

describe('ResolutionBox', function() {
  describe('render()', function() {
    it('handles inNextRelease', function() {
      const wrapper = shallow(
        <ResolutionBox
          statusDetails={{inNextRelease: true}}
          orgId="org"
          projectId="project"
        />
      );
      expect(wrapper).toMatchSnapshot();
    });
    it('handles inNextRelease with actor', function() {
      const wrapper = shallow(
        <ResolutionBox
          statusDetails={{
            inNextRelease: true,
            actor: {id: '111', name: 'David Cramer', email: 'david@sentry.io'},
          }}
          orgId="org"
          projectId="project"
        />
      );
      expect(wrapper).toMatchSnapshot();
    });
    it('handles inRelease', function() {
      const wrapper = shallow(
        <ResolutionBox
          statusDetails={{
            inRelease: '1.0',
          }}
          orgId="org"
          projectId="project"
        />
      );
      expect(wrapper).toMatchSnapshot();
    });
    it('handles inRelease with actor', function() {
      const wrapper = shallow(
        <ResolutionBox
          statusDetails={{
            inRelease: '1.0',
            actor: {id: '111', name: 'David Cramer', email: 'david@sentry.io'},
          }}
          orgId="org"
          projectId="project"
        />
      );
      expect(wrapper).toMatchSnapshot();
    });
    it('handles default', function() {
      const wrapper = shallow(
        <ResolutionBox statusDetails={{}} orgId="org" projectId="project" />
      );
      expect(wrapper).toMatchSnapshot();
    });
    it('handles inCommit', function() {
      const wrapper = shallow(
        <ResolutionBox
          statusDetails={{
            inCommit: TestStubs.Commit(),
          }}
          orgId="org"
          projectId="project"
        />
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
