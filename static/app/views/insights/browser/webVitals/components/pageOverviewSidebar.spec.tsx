import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {PageOverviewSidebar} from 'sentry/views/insights/browser/webVitals/components/pageOverviewSidebar';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

const TRANSACTION_NAME = 'transaction';

describe('PageOverviewSidebar', () => {
  const organization = OrganizationFixture({
    features: ['performance-web-vitals-seer-suggestions'],
  });

  beforeEach(() => {
    jest.mocked(useLocation).mockReturnValue(LocationFixture());

    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

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
    expect(screen.getByText('LCP score needs improvement')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Unoptimized screenshot images are directly embedded, causing large downloads and delaying Largest Contentful Paint on issue detail pages.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('View Suggestion')).toBeInTheDocument();
  });
});
