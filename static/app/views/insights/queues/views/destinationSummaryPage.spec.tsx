import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import PageWithProviders from 'sentry/views/insights/queues/views/destinationSummaryPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useProjects');

describe('destinationSummaryPage', () => {
  const organization = OrganizationFixture({
    features: ['insights-addon-modules'],
  });

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [],
    },
  });

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d', project: '1'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useProjects).mockReturnValue({
    projects: [],
    onSearch: jest.fn(),
    reloadProjects: jest.fn(),
    placeholders: [],
    fetching: false,
    hasMore: null,
    fetchError: null,
    initiallyLoaded: false,
  });

  let eventsMock, eventsStatsMock, spanFieldTagsMock;

  beforeEach(() => {
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {data: []},
    });

    spanFieldTagsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [
        {
          key: 'api_key',
          name: 'Api Key',
        },
        {
          key: 'bytes.size',
          name: 'Bytes.Size',
        },
      ],
    });
  });

  it('renders', async () => {
    render(<PageWithProviders />, {organization});
    await screen.findByRole('table', {name: 'Transactions'});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    screen.getByText('Avg Latency');
    screen.getByText('Published vs Processed');
    expect(eventsStatsMock).toHaveBeenCalled();
    expect(eventsMock).toHaveBeenCalled();
    expect(spanFieldTagsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/spans/fields/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          project: [],
          environment: [],
          statsPeriod: '1h',
        },
      })
    );
  });
});
