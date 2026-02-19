import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PrReviewContent from 'sentry/views/explore/prReview/content';

describe('PrReviewContent', () => {
  const organization = OrganizationFixture({
    features: ['pr-review-dashboard'],
  });

  const mockStats = {
    repositories: [{id: '10', name: 'owner/repo'}],
    stats: {
      totalPrs: 10,
      totalReviews: 15,
      totalComments: 25,
      skippedPrs: 2,
      totalAuthors: 3,
      topAuthors: [
        {author: 'testuser', prCount: 5},
        {author: 'otheruser', prCount: 3},
      ],
    },
    timeSeries: [],
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the page title and header', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-review-prs/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-review-stats/`,
      body: mockStats,
    });

    render(<PrReviewContent />, {organization});

    expect(await screen.findByText('Seer PR Reviews')).toBeInTheDocument();
  });

  it('renders PRs from the API', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-review-prs/`,
      body: [
        {
          repositoryId: '10',
          repositoryName: 'owner/repo',
          prNumber: 42,
          prTitle: 'Fix the bug',
          prAuthor: 'testuser',
          prUrl: 'https://github.com/owner/repo/pull/42',
          latestStatus: 'review_completed',
          latestTrigger: 'on_ready_for_review',
          eventCount: 2,
          totalComments: 3,
          lastActivity: '2026-01-15T10:00:00Z',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-review-stats/`,
      body: mockStats,
    });

    render(<PrReviewContent />, {organization});

    expect(await screen.findByText('Fix the bug')).toBeInTheDocument();
    expect(screen.getByText('owner/repo#42')).toBeInTheDocument();
    expect(screen.getByText('by testuser')).toBeInTheDocument();
  });

  it('renders empty state when no PRs', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-review-prs/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-review-stats/`,
      body: mockStats,
    });

    render(<PrReviewContent />, {organization});

    expect(await screen.findByText('No pull requests found.')).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-review-prs/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-review-stats/`,
      body: mockStats,
    });

    render(<PrReviewContent />, {organization});

    expect(await screen.findByText('10')).toBeInTheDocument();
    expect(screen.getByText('Total PRs')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('2 skipped')).toBeInTheDocument();
  });
});
