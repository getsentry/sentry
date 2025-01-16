import {CommitFixture} from 'sentry-fixture/commit';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType} from 'sentry/types/group';

import ResolutionBox from './resolutionBox';

describe('ResolutionBox', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  it('handles default', function () {
    const {container} = render(
      <ResolutionBox statusDetails={{}} project={project} organization={organization} />
    );
    expect(container).toHaveTextContent('This issue has been marked as resolved.');
  });
  it('handles inNextRelease', function () {
    const {container} = render(
      <ResolutionBox
        statusDetails={{inNextRelease: true}}
        project={project}
        organization={organization}
      />
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
        project={project}
        organization={organization}
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
          actor: UserFixture(),
        }}
        project={project}
        organization={organization}
        activities={[
          {
            id: '1',
            type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
            data: {
              current_release_version: 'frontend@1.0.0',
            },
            dateCreated: new Date().toISOString(),
            project,
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
        project={project}
        organization={organization}
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
        project={project}
        organization={organization}
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
          inCommit: CommitFixture(),
        }}
        project={project}
        organization={organization}
      />
    );
    expect(container).toHaveTextContent(
      'This issue has been marked as resolved by f7f395din'
    );
  });

  it('handles inUpcomingRelease', function () {
    const {container} = render(
      <ResolutionBox
        statusDetails={{
          inUpcomingRelease: true,
          actor: {
            id: '111',
            name: 'David Cramer',
            username: 'dcramer',
            ip_address: '127.0.0.1',
            email: 'david@sentry.io',
          },
        }}
        project={project}
        organization={organization}
      />
    );
    expect(container).toHaveTextContent(
      'David Cramer marked this issue as resolved in the upcoming release.'
    );
  });
});
