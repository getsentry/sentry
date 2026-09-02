import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType} from 'sentry/types/group';

import {getLinkedPullRequestActivityIds, LinkedPullRequests} from './linkedPullRequests';

const REPOSITORY_NAME = 'example/widget-app';

describe('LinkedPullRequests', () => {
  const group = GroupFixture();
  const organization = OrganizationFixture();
  const repository = RepositoryFixture({
    id: '42',
    name: REPOSITORY_NAME,
    provider: {id: 'integrations:github', name: 'GitHub'},
  });

  it('renders linked pull requests', async () => {
    const pullRequestsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '123',
              title: 'Fix widget crash on startup',
              repository,
              externalUrl: 'https://github.com/example/widget-app/pull/123',
              author: {name: 'Ada Lovelace', email: 'ada@example.com'},
            }),
            attribution: null,
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
            attribution: {
              type: 'seer',
              id: 'seer',
            },
            dateLinked: '2026-06-08T23:10:32.000000Z',
            status: 'closed',
          },
        ],
      },
    });

    render(<LinkedPullRequests group={group} />, {
      organization,
    });

    const list = await screen.findByRole('list', {name: 'Linked pull requests'});
    const linkedPullRequest = within(list).getByRole('link', {
      name: /Pull request #123 in example\/widget-app/,
    });

    expect(linkedPullRequest).toHaveAttribute(
      'href',
      'https://github.com/example/widget-app/pull/123'
    );
    expect(linkedPullRequest).toHaveAccessibleName(
      `Pull request #123 in ${REPOSITORY_NAME}, Merged, Fix widget crash on startup`
    );
    await userEvent.hover(linkedPullRequest);
    expect(await screen.findAllByText('Fix widget crash on startup')).toHaveLength(1);
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText(`${REPOSITORY_NAME}#123`)).toBeInTheDocument();
    expect(within(list).getByText(`${REPOSITORY_NAME}#124`)).toBeInTheDocument();
    expect(within(list).getByText('Fix widget crash on startup')).toBeInTheDocument();
    expect(within(list).getByText('Remove unused widget fallback')).toBeInTheDocument();
    expect(within(list).getByText('Merged')).toBeInTheDocument();
    expect(within(list).getByText('Closed')).toBeInTheDocument();
    expect(within(linkedPullRequest).getByText('AL')).toBeInTheDocument();
    expect(
      within(linkedPullRequest).getByLabelText('Pull request author: Ada Lovelace')
    ).toHaveAttribute('title', 'Pull request author: Ada Lovelace');
    expect(
      within(list).getByLabelText('Pull request created by Seer')
    ).toBeInTheDocument();
    const mergedStatus = within(list).getByLabelText('Pull request status: Merged');
    const closedStatus = within(list).getByLabelText('Pull request status: Closed');
    expect(mergedStatus).toBeInTheDocument();
    expect(closedStatus).toBeInTheDocument();
    expect(mergedStatus.querySelector('svg')).toBeInTheDocument();
    expect(closedStatus.querySelector('svg')).toBeInTheDocument();
    expect(pullRequestsMock).toHaveBeenCalledTimes(1);
    expect(pullRequestsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: {expand: 'checksAndReview'}})
    );
  });

  it('renders a delegated agent attribution', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({
              id: '123',
              repository,
              author: {name: 'cursor[bot]', email: 'cursor[bot]@localhost'},
            }),
            attribution: {type: 'seer', id: 'seer', agent: 'cursor'},
            dateLinked: '2026-06-08T23:11:32.000000Z',
            status: 'merged',
          },
        ],
      },
    });

    render(<LinkedPullRequests group={group} />, {organization});

    expect(
      await screen.findByRole('img', {
        name: 'Pull request created by Cursor Cloud Agent via Seer',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'cursor'})).toHaveAttribute(
      'src',
      'https://github.com/cursor.png?s=120'
    );
  });

  it('renders checks and review details when available', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/pull-requests/`,
      body: {
        pullRequests: [
          {
            ...PullRequestFixture({id: '123', repository}),
            attribution: null,
            checksStatus: 'failure',
            dateLinked: '2026-06-08T23:11:32.000000Z',
            reviewStatus: 'changes_requested',
            status: 'open',
          },
          {
            ...PullRequestFixture({id: '124', repository}),
            attribution: null,
            checksStatus: null,
            dateLinked: '2026-06-08T23:10:32.000000Z',
            reviewStatus: null,
            status: 'open',
          },
        ],
      },
    });

    render(<LinkedPullRequests group={group} />, {organization});

    const list = await screen.findByRole('list', {name: 'Linked pull requests'});
    const withDetails = within(list).getByRole('link', {name: /Pull request #123/});
    const withoutDetails = within(list).getByRole('link', {name: /Pull request #124/});

    expect(within(withDetails).getByText('Checks failed')).toBeInTheDocument();
    expect(within(withDetails).getByText('Changes requested')).toBeInTheDocument();
    expect(within(withoutDetails).queryByText('Checks failed')).not.toBeInTheDocument();
    expect(
      within(withoutDetails).queryByText('Changes requested')
    ).not.toBeInTheDocument();
  });

  it('deduplicates pull request ids from group activity', () => {
    const activityGroup = GroupFixture({
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
          id: 'activity-1',
          dateCreated: '2026-06-08T23:11:32.000000Z',
          data: {
            pullRequest: PullRequestFixture({id: '123'}),
          },
          user: null,
        },
        {
          type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
          id: 'activity-2',
          dateCreated: '2026-06-08T23:12:32.000000Z',
          data: {
            pullRequest: PullRequestFixture({id: '123'}),
          },
          user: null,
        },
      ],
    });

    expect([...getLinkedPullRequestActivityIds(activityGroup)]).toEqual(['123']);
  });
});
