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
        data: [],
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
  });

  it('should render', () => {
    render(<PageOverviewSidebar transaction={TRANSACTION_NAME} />);

    expect(screen.getByText('Performance Score')).toBeInTheDocument();
    expect(screen.getByText('Page Loads')).toBeInTheDocument();
    expect(screen.getByText('Interactions')).toBeInTheDocument();
  });

  it('should render seer suggestions', async () => {
    render(<PageOverviewSidebar transaction={TRANSACTION_NAME} />, {organization});

    expect(screen.getByText('Seer Suggestions')).toBeInTheDocument();
    expect(await screen.findByText('- Seer Suggestion 1')).toBeInTheDocument();
    expect(screen.getByText('ui.interaction.click')).toBeInTheDocument();
    expect(screen.getByText('Suggestion 1')).toBeInTheDocument();
    expect(screen.getByText('Suggestion 2')).toBeInTheDocument();
  });
});
