import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PrReviewList} from 'sentry/views/explore/prReview/prReviewList';
import type {CodeReviewPR} from 'sentry/views/explore/prReview/types';

describe('PrReviewList', () => {
  const organization = OrganizationFixture();

  const mockPR: CodeReviewPR = {
    repositoryId: '10',
    repositoryName: 'owner/repo',
    prNumber: 42,
    prTitle: 'Fix the bug',
    prAuthor: 'testuser',
    prUrl: 'https://github.com/owner/repo/pull/42',
    latestStatus: 'review_completed',
    latestTrigger: 'on_ready_for_review',
    prState: 'open',
    eventCount: 2,
    totalComments: 3,
    lastActivity: '2026-01-15T10:00:00Z',
  };

  it('renders PRs in the table', () => {
    render(
      <PrReviewList
        prs={[mockPR]}
        isLoading={false}
        pageLinks={null}
        paginationCaption={null}
      />,
      {organization}
    );

    expect(screen.getByText(/owner\/repo/)).toBeInTheDocument();
    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
    expect(screen.getByText('Review Completed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders empty message when no PRs', () => {
    render(
      <PrReviewList
        prs={[]}
        isLoading={false}
        pageLinks={null}
        paginationCaption={null}
      />,
      {organization}
    );

    expect(screen.getByText('No pull requests found.')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(
      <PrReviewList
        prs={undefined}
        isLoading
        pageLinks={null}
        paginationCaption={null}
      />,
      {organization}
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(
      <PrReviewList
        prs={[mockPR]}
        isLoading={false}
        pageLinks={null}
        paginationCaption={null}
      />,
      {organization}
    );

    expect(screen.getByText('Pull Request')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('Last Activity')).toBeInTheDocument();
  });
});
