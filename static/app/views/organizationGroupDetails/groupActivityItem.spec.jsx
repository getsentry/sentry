import {render} from 'sentry-test/reactTestingLibrary';

import PullRequestLink from 'sentry/components/pullRequestLink';
import {GroupActivityType} from 'sentry/types';
import GroupActivityItem from 'sentry/views/organizationGroupDetails/groupActivityItem';

describe('GroupActivityItem', () => {
  it('shows correct message for pull request', async function () {
    const repository = TestStubs.Repository();

    const pullRequest = TestStubs.PullRequest({message: 'Fixes ISSUE-1'});

    const component = render(
      <GroupActivityItem
        activity={{
          type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
          id: 'pr-1',
          data: {
            pullRequest: {
              author: 'Test User',
              version: (
                <PullRequestLink
                  inline
                  pullRequest={pullRequest}
                  repository={pullRequest.repository}
                />
              ),
              repository: {repository},
            },
          },
          user: TestStubs.User(),
        }}
        orgSlug="test-org"
        projectId="1"
        author="Test User"
      />
    );

    expect(
      await component.findByText('has created a PR for this issue:')
    ).toBeInTheDocument();
    expect(
      component.queryByText('marked this issue as resolved in')
    ).not.toBeInTheDocument();
  });
});
