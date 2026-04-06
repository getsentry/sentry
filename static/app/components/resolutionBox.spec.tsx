import {CommitFixture} from 'sentry-fixture/commit';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {UserFixture} from 'sentry-fixture/user';

import {render} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType} from 'sentry/types/group';

import {ResolutionBox} from './resolutionBox';

describe('ResolutionBox', () => {
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

  it('handles inNextRelease', () => {
    const {container} = render(
      <ResolutionBox
        statusDetails={{inNextRelease: true}}
        project={project}
        activities={[]}
      />
    );
    expect(container).toHaveTextContent(
      'This issue has been marked as resolved in the upcoming release.'
    );
  });
  it('handles inNextRelease with actor', () => {
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
        activities={[]}
      />
    );
    expect(container).toHaveTextContent(
      'David Cramer marked this issue as resolved in the upcoming release.'
    );
  });
  it('handles inRelease with sentry app activity (prefers integration name over proxy actor)', () => {
    const releaseVersion = 'frontend@424ff35513ab';
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${releaseVersion}/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/${releaseVersion}/deploys/`,
      method: 'GET',
      body: [],
    });

    const {container} = render(
      <ResolutionBox
        statusDetails={{
          inRelease: releaseVersion,
          actor: {
            id: '999',
            name: 'linear-app-abc123@proxy-user.sentry.io',
            username: 'linear-app-abc123@proxy-user.sentry.io',
            ip_address: '127.0.0.1',
            email: 'linear-app-abc123@proxy-user.sentry.io',
          },
        }}
        project={project}
        activities={[
          {
            id: '1',
            type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
            data: {version: releaseVersion},
            sentry_app: {
              name: 'Linear',
              slug: 'linear',
              uuid: 'abc-123',
            },
            dateCreated: new Date().toISOString(),
          },
        ]}
      />
    );
    expect(container).toHaveTextContent(
      'Linear marked this issue as resolved in version'
    );
    expect(container).toHaveTextContent('424ff35513ab');
    expect(container).not.toHaveTextContent('proxy-user.sentry.io');
  });
  it('handles inRelease with semver current_release_version)', () => {
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
          inRelease: currentReleaseVersion,
          actor: UserFixture(),
        }}
        project={project}
        activities={[
          {
            id: '1',
            type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
            data: {
              current_release_version: currentReleaseVersion,
            },
            dateCreated: new Date().toISOString(),
          },
        ]}
      />
    );
    expect(container).toHaveTextContent(
      'Foo Bar marked this issue as resolved in versions greater than 1.2.0'
    );
  });
  it('handles inNextRelease with semver current_release_version)', () => {
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
        activities={[
          {
            id: '1',
            type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
            data: {
              current_release_version: currentReleaseVersion,
            },
            dateCreated: new Date().toISOString(),
          },
        ]}
      />
    );
    expect(container).toHaveTextContent(
      'Foo Bar marked this issue as resolved in versions greater than 1.2.0'
    );
  });
  it('handles inRelease', () => {
    const {container} = render(
      <ResolutionBox
        statusDetails={{
          inRelease: release.version,
        }}
        project={project}
        activities={[]}
      />
    );
    expect(container).toHaveTextContent(
      `This issue has been marked as resolved in version ${release.version}.`
    );
  });
  it('handles inRelease with actor', () => {
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
        activities={[]}
      />
    );
    expect(container).toHaveTextContent(
      `David Cramer marked this issue as resolved in version ${release.version}.`
    );
  });
  it('handles inCommit', () => {
    const {container} = render(
      <ResolutionBox
        statusDetails={{
          inCommit: CommitFixture(),
        }}
        project={project}
        activities={[]}
      />
    );
    expect(container).toHaveTextContent(
      'This issue has been marked as resolved by f7f395d(in a year)'
    );
  });
});
