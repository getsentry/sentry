import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import ResolutionBox from 'sentry/components/resolutionBox';

describe('ResolutionBox', function () {
  describe('render()', function () {
    it('handles inNextRelease', function () {
      const {container} = mountWithTheme(
        <ResolutionBox statusDetails={{inNextRelease: true}} projectId="1" />
      );
      expect(container).toSnapshot();
    });
    it('handles inNextRelease with actor', function () {
      const {container} = mountWithTheme(
        <ResolutionBox
          statusDetails={{
            inNextRelease: true,
            actor: {
              id: '111',
              name: 'David Cramer',
              username: 'dcramer',
              ip_address: '127.0.0.1',
              email: 'david@sentry.io',
            },
          }}
          projectId="1"
        />
      );
      expect(container).toSnapshot();
    });
    it('handles inRelease', function () {
      const {container} = mountWithTheme(
        <ResolutionBox
          statusDetails={{
            inRelease: '1.0',
          }}
          projectId="1"
        />
      );
      expect(container).toSnapshot();
    });
    it('handles inRelease with actor', function () {
      const {container} = mountWithTheme(
        <ResolutionBox
          statusDetails={{
            inRelease: '1.0',
            actor: {
              id: '111',
              name: 'David Cramer',
              username: 'dcramer',
              ip_address: '127.0.0.1',
              email: 'david@sentry.io',
            },
          }}
          projectId="1"
        />
      );
      expect(container).toSnapshot();
    });
    it('handles default', function () {
      const {container} = mountWithTheme(
        <ResolutionBox statusDetails={{}} projectId="1" />
      );
      expect(container).toSnapshot();
    });
    it('handles inCommit', function () {
      const {container} = mountWithTheme(
        <ResolutionBox
          statusDetails={{
            inCommit: TestStubs.Commit(),
          }}
          projectId="1"
        />
      );
      expect(container).toSnapshot();
    });
  });
});
