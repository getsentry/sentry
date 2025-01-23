import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {SpansTabContent} from 'sentry/views/explore/spans/spansTab';

jest.mock('sentry/utils/analytics');

describe('SpansTabContent', function () {
  const {organization, router} = initializeOrg({
    organization: {
      features: ['visibility-explore-rpc'],
    },
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });
  });

  it('should fire analytics once', async function () {
    render(
      <SpansTabContent
        defaultPeriod="7d"
        maxPickableDays={7}
        relativeOptions={{
          '1h': 'Last hour',
          '24h': 'Last 24 hours',
          '7d': 'Last 7 days',
        }}
      />,
      {router, organization}
    );
    await screen.findByText(/Extrapolated from/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
  });
});
