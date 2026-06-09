import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {LinkedPullRequests} from './linkedPullRequests';

const LINKED_PULL_REQUESTS_FEATURE = 'issue-details-linked-pull-requests';
const REPOSITORY_NAME = 'example/widget-app';

describe('LinkedPullRequests', () => {
  const group = GroupFixture();
  const organizationWithFeature = OrganizationFixture({
    features: [LINKED_PULL_REQUESTS_FEATURE],
  });
  const repository = RepositoryFixture({
    id: '42',
    name: REPOSITORY_NAME,
    provider: {id: 'integrations:github', name: 'GitHub'},
  });

  it('renders linked pull requests when the feature is enabled', async () => {
    const pullRequestsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organizationWithFeature.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '123',
              title: 'Fix widget crash on startup',
              repository,
              externalUrl: 'https://github.com/example/widget-app/pull/123',
            }),
            dateLinked: '2026-06-08T23:11:32.000000Z',
            status: 'merged',
          },
          {
            ...PullRequestFixture({
              id: '124',
              title: 'Remove unused widget fallback',
              repository,
              externalUrl: 'https://github.com/example/widget-app/pull/124',
            }),
            dateLinked: '2026-06-08T23:10:32.000000Z',
            status: 'closed',
          },
        ],
      },
    });

    render(<LinkedPullRequests group={group} />, {
      organization: organizationWithFeature,
    });

    const list = await screen.findByRole('list', {name: 'Linked pull requests'});
    const linkedPullRequest = within(list).getByRole('link', {
      name: /Fix widget crash on startup/,
    });

    expect(linkedPullRequest).toHaveAttribute(
      'href',
      'https://github.com/example/widget-app/pull/123'
    );
    expect(linkedPullRequest).toHaveAccessibleName(
      `Fix widget crash on startup, pull request #123, Merged, repository ${REPOSITORY_NAME}`
    );
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('#123')).toBeInTheDocument();
    expect(within(list).getByText('#124')).toBeInTheDocument();
    expect(within(list).getAllByText(REPOSITORY_NAME)).toHaveLength(2);
    expect(
      within(list).getByTestId('linked-pull-request-status-merged')
    ).toBeInTheDocument();
    expect(
      within(list).getByTestId('linked-pull-request-status-closed')
    ).toBeInTheDocument();
    expect(pullRequestsMock).toHaveBeenCalledTimes(1);
  });
});
