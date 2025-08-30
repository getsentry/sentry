import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {PageFilters} from 'sentry/types/core';
import {PageOverviewSidebar} from 'sentry/views/insights/browser/webVitals/components/pageOverviewSidebar';

const TRANSACTION_NAME = 'transaction';

describe('PageOverviewSidebar', () => {
  const organization = OrganizationFixture({
    features: ['performance-web-vitals-seer-suggestions'],
  });

  beforeEach(() => {
    // Initialize the page filters store instead of mocking hooks
    const pageFilters: PageFilters = {
      projects: [1],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    };
    PageFiltersStore.onInitializeUrlState(pageFilters, new Set());

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {
        data: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{trace: '123'}],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/page-web-vitals-summary/`,
      body: {
        suggestedInvestigations: [
          {
            explanation: 'Seer Suggestion 1',
            referenceUrl: 'https://example.com/seer-suggestion-1',
            spanId: '123',
            spanOp: 'ui.interaction.click',
            suggestions: ['Suggestion 1', 'Suggestion 2'],
          },
        ],
      },
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [
        {
          id: '123',
          shortId: '123',
          title: 'LCP score needs improvement',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/123/autofix/`,
      body: {
        autofix: {
          steps: [
            {
              causes: [
                {
                  description:
                    'Unoptimized screenshot images are directly embedded, causing large downloads and delaying Largest Contentful Paint on issue detail pages.',
                },
              ],
              type: 'root_cause_analysis',
            },
          ],
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render', () => {
    render(<PageOverviewSidebar transaction={TRANSACTION_NAME} />, {organization});

    expect(screen.getByText('Performance Score')).toBeInTheDocument();
    expect(screen.getByText('Page Loads')).toBeInTheDocument();
    expect(screen.getByText('Interactions')).toBeInTheDocument();
  });

  it('should render seer suggestions for LCP', async () => {
    render(<PageOverviewSidebar transaction={TRANSACTION_NAME} />, {organization});

    // Wait for the Seer Suggestions section to appear
    expect(await screen.findByText('Seer Suggestions')).toBeInTheDocument();

    // Wait for the issue title to appear (this depends on both issues and autofix data)
    await waitFor(() => {
      expect(screen.getByText('LCP score needs improvement')).toBeInTheDocument();
    });

    // Wait for the root cause description to appear
    await waitFor(() => {
      expect(
        screen.getByText(
          'Unoptimized screenshot images are directly embedded, causing large downloads and delaying Largest Contentful Paint on issue detail pages.'
        )
      ).toBeInTheDocument();
    });

    // Wait for the view suggestion button to appear
    await waitFor(() => {
      expect(screen.getByText('View Suggestion')).toBeInTheDocument();
    });
  });
});
