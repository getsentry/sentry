import {Commit} from 'sentry-fixture/commit';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {User} from 'sentry-fixture/user';

import {render} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType} from 'sentry/types';

import ResolutionBox from './resolutionBox';

describe('ResolutionBox', function () {
  it('handles default', function () {
    const {container} = render(<ResolutionBox statusDetails={{}} projectId="1" />);
    expect(container).toHaveTextContent('This issue has been marked as resolved.');
  });
  it('handles inNextRelease', function () {
    const {container} = render(
      <ResolutionBox statusDetails={{inNextRelease: true}} projectId="1" />
    );
    expect(container).toHaveTextContent(
      'This issue has been marked as resolved in the upcoming release.'
    );
  });
  it('handles inNextRelease with actor', function () {
    const {container} = render(
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
    expect(container).toHaveTextContent(
      'David Cramer marked this issue as resolved in the upcoming release.'
    );
  });
  it('handles in next release (semver current_release_version)', function () {
    const {container} = render(
      <ResolutionBox
        statusDetails={{
          inNextRelease: true,
          actor: User(),
        }}
        projectId="1"
        activities={[
          {
            id: '1',
            type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
            data: {
              current_release_version: 'frontend@1.0.0',
            },
            dateCreated: new Date().toISOString(),
            project: ProjectFixture(),
          },
        ]}
      />
    );
    expect(container).toHaveTextContent(
      'Foo Bar marked this issue as resolved in versions greater than 1.0.0'
    );
  });
  it('handles inRelease', function () {
    const {container} = render(
      <ResolutionBox
        statusDetails={{
          inRelease: '1.0',
        }}
        projectId="1"
      />
    );
    expect(container).toHaveTextContent(
      'This issue has been marked as resolved in version 1.0.'
    );
  });
  it('handles inRelease with actor', function () {
    const {container} = render(
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
    expect(container).toHaveTextContent(
      'David Cramer marked this issue as resolved in version 1.0.'
    );
  });
  it('handles inCommit', function () {
    const {container} = render(
      <ResolutionBox
        statusDetails={{
          inCommit: Commit(),
        }}
        projectId="1"
      />
    );
    expect(container).toHaveTextContent(
      'This issue has been marked as resolved by f7f395din'
    );
  });
});
