import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import ResolutionBox from 'app/components/resolutionBox';

describe('ResolutionBox', function() {
  describe('render()', function() {
    it('handles inNextRelease', function() {
      const wrapper = shallow(
        <ResolutionBox statusDetails={{inNextRelease: true}} projectId="1" />
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
          projectId="1"
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
          projectId="1"
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
          projectId="1"
        />
      );
      expect(wrapper).toMatchSnapshot();
    });
    it('handles default', function() {
      const wrapper = shallow(<ResolutionBox statusDetails={{}} projectId="1" />);
      expect(wrapper).toMatchSnapshot();
    });
    it('handles inCommit', function() {
      const wrapper = shallow(
        <ResolutionBox
          statusDetails={{
            inCommit: TestStubs.Commit(),
          }}
          projectId="1"
        />
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
