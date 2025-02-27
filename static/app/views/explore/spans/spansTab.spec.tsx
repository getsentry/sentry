import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import localStorage from 'sentry/utils/localStorage';
import {SpansTabContent} from 'sentry/views/explore/spans/spansTab';

jest.mock('sentry/utils/analytics');
jest.mock('sentry/utils/localStorage');

const mockGetItem = jest.mocked(localStorage.getItem);

describe('SpansTabContent', function () {
  const {organization, project, router} = initializeOrg({
    organization: {
      features: ['visibility-explore-rpc'],
    },
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    mockGetItem.mockReset();
    // without this the `CompactSelect` component errors with a bunch of async updates
    jest.spyOn(console, 'error').mockImplementation();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {
          period: '7d',
          start: null,
          end: null,
          utc: null,
        },
      },
      new Set()
    );
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
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      method: 'GET',
      body: {},
    });
  });

  it('should fire analytics once per change', async function () {
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
      {disableRouterMocks: true, router, organization}
    );

    await screen.findByText(/No spans found/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace.explorer.metadata',
      expect.objectContaining({
        result_mode: 'span samples',
      })
    );

    (trackAnalytics as jest.Mock).mockClear();
    await userEvent.click(await screen.findByText('Trace Samples'));

    await screen.findByText(/No trace results found/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace.explorer.metadata',
      expect.objectContaining({
        result_mode: 'trace samples',
      })
    );

    (trackAnalytics as jest.Mock).mockClear();
    await userEvent.click(
      within(screen.getByTestId('section-mode')).getByRole('radio', {name: 'Aggregates'})
    );

    await screen.findByText(/No spans found/);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace.explorer.metadata',
      expect.objectContaining({
        result_mode: 'aggregates',
      })
    );
  });

  it('should open the onboarding guide on initial load if the user has not viewed it', function () {
    mockGetItem.mockReturnValue('false');

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
      {disableRouterMocks: true, router, organization}
    );

    expect(screen.getByLabelText('Traces Onboarding Guide')).toBeInTheDocument();
  });
});
