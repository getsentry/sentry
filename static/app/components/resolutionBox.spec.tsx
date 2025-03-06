import {CommitFixture} from 'sentry-fixture/commit';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {UserFixture} from 'sentry-fixture/user';

import {render} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType} from 'sentry/types/group';

import ResolutionBox from './resolutionBox';

describe('ResolutionBox', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const release = ReleaseFixture({version: '1.0'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${release.version}/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/${release.version}/deploys/`,
      method: 'GET',
      body: [],
    });
  });

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
    const currentReleaseVersion = '1.2.0';
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${currentReleaseVersion}/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/${currentReleaseVersion}/deploys/`,
      method: 'GET',
      body: [],
    });

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
              current_release_version: currentReleaseVersion,
            },
            dateCreated: new Date().toISOString(),
            project,
          },
        ]}
      />
    );
    expect(container).toHaveTextContent(
      'Foo Bar marked this issue as resolved in versions greater than 1.2.0'
    );
  });
  it('handles inRelease', function () {
    const {container} = render(
      <ResolutionBox
        statusDetails={{
          inRelease: release.version,
        }}
        project={project}
        organization={organization}
      />
    );
    expect(container).toHaveTextContent(
      `This issue has been marked as resolved in version ${release.version}.`
    );
  });
  it('handles inRelease with actor', function () {
    const {container} = render(
      <ResolutionBox
        statusDetails={{
          inRelease: release.version,
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
      `David Cramer marked this issue as resolved in version ${release.version}.`
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
