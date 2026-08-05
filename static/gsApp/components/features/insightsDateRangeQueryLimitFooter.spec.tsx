import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InsightsDateRangeQueryLimitFooter} from 'getsentry/components/features/insightsDateRangeQueryLimitFooter';

describe('InsightsDateRangeQueryLimitFooter', () => {
  const DESCRIPTION =
    'To view more trends for your Performance data, upgrade to Business.';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    // The nested footer is withSubscription-wrapped and loads the subscription.
    MockApiClient.addMockResponse({
      url: '/customers/org-slug/',
      body: {},
    });
  });

  it('renders if the org has the feature', async () => {
    render(<InsightsDateRangeQueryLimitFooter />, {
      organization: OrganizationFixture({
        features: ['insights-query-date-range-limit'],
      }),
    });

    expect(await screen.findByText(DESCRIPTION)).toBeInTheDocument();
  });

  it('does not render if the org lacks the feature', () => {
    render(<InsightsDateRangeQueryLimitFooter />, {
      organization: OrganizationFixture({features: []}),
    });

    expect(screen.queryByText(DESCRIPTION)).not.toBeInTheDocument();
  });
});
