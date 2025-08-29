import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageOverviewSidebar} from 'sentry/views/insights/browser/webVitals/components/pageOverviewSidebar';

const TRANSACTION_NAME = 'transaction';

describe('PageOverviewSidebar', () => {
  const organization = OrganizationFixture({
    features: ['performance-web-vitals-seer-suggestions'],
  });

  beforeEach(() => {
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

    expect(await screen.findByText('Seer Suggestions')).toBeInTheDocument();
    expect(await screen.findByText('LCP score needs improvement')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Unoptimized screenshot images are directly embedded, causing large downloads and delaying Largest Contentful Paint on issue detail pages.'
      )
    ).toBeInTheDocument();
    expect(await screen.findByText('View Suggestion')).toBeInTheDocument();
  });
});
