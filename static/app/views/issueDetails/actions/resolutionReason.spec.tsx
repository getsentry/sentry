import {CommitFixture} from 'sentry-fixture/commit';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {GroupActivity, ResolvedStatusDetails} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import {ActivityResolutionReason} from 'sentry/views/issueDetails/actions/resolutionReason';

const project = ProjectFixture();
const actor = UserFixture({name: 'David Cramer'});
const release = 'backend@1.2.3';
const repository = RepositoryFixture({
  provider: {id: 'integrations:github', name: 'GitHub'},
  url: 'https://github.com/example/repository',
});
const pullRequest = PullRequestFixture({
  id: '1234',
  externalUrl: 'https://github.com/example/repository/pull/1234',
  repository,
});
const activity = {
  type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
  id: 'resolved-in-release-1',
  dateCreated: '2020-01-01T00:00:00',
  data: {
    version: 'frontend@1.2.3',
    commit: CommitFixture({pullRequest, repository}),
  },
  user: actor,
} satisfies GroupActivity;

function renderReason({
  activities = [activity],
  statusDetails,
}: {
  statusDetails: ResolvedStatusDetails;
  activities?: GroupActivity[];
}) {
  return render(
    <ActivityResolutionReason
      activities={activities}
      project={project}
      statusDetails={statusDetails}
    />,
    {organization: OrganizationFixture()}
  );
}

describe('ResolutionReason', () => {
  it('shows the resolving pull request and canonical release for activity', () => {
    const {container} = renderReason({statusDetails: {actor, inRelease: release}});

    expect(container).toHaveTextContent(
      'David Cramer resolved via #1234 released in 1.2.3'
    );
    expect(screen.getByRole('link', {name: '#1234'})).toHaveAttribute(
      'href',
      pullRequest.externalUrl
    );
  });

  it('shows an exact release without a pull request for activity', () => {
    const {container} = renderReason({
      activities: [
        {
          ...activity,
          data: {version: 'frontend@1.2.3'},
        },
      ],
      statusDetails: {actor, inRelease: release},
    });

    expect(container).toHaveTextContent('David Cramer resolved in 1.2.3');
    expect(screen.queryByRole('link', {name: '#1234'})).not.toBeInTheDocument();
  });

  it('shows the first release that will contain the resolution for activity', () => {
    const {container} = renderReason({
      activities: [
        {
          ...activity,
          data: {current_release_version: 'backend@1.0.0'},
        },
      ],
      statusDetails: {actor, inNextRelease: true},
    });

    expect(container).toHaveTextContent(
      'David Cramer resolved starting with a release after 1.0.0'
    );
  });

  it('shows an upcoming release without a known current release for activity', () => {
    const {container} = renderReason({
      activities: [],
      statusDetails: {actor, inNextRelease: true},
    });

    expect(container).toHaveTextContent(
      'David Cramer set this to resolve in the upcoming release'
    );
  });

  it('shows the resolving commit for activity', () => {
    const commit = CommitFixture({repository});
    const {container} = renderReason({
      activities: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_COMMIT,
          id: 'resolved-in-commit-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {commit},
          user: actor,
        },
      ],
      statusDetails: {inCommit: {commit: commit.id}},
    });

    expect(container).toHaveTextContent('David Cramer resolved via f7f395d');
    expect(screen.getByRole('link', {name: /f7f395d/})).toHaveAttribute(
      'href',
      `${repository.url}/commit/${commit.id}`
    );
  });

  it('prefers the pull request associated with a resolving commit', () => {
    const commit = CommitFixture({pullRequest, repository});
    const {container} = renderReason({
      activities: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_COMMIT,
          id: 'resolved-in-commit-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {commit},
          user: actor,
        },
      ],
      statusDetails: {inCommit: {commit: commit.id}},
    });

    expect(container).toHaveTextContent('David Cramer resolved via #1234');
    expect(screen.getByRole('link', {name: '#1234'})).toHaveAttribute(
      'href',
      pullRequest.externalUrl
    );
  });
});
