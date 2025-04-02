import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import PageWithProviders from 'sentry/views/insights/queues/views/destinationSummaryPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useReleaseStats');

describe('destinationSummaryPage', () => {
  const organization = OrganizationFixture({
    features: ['insights-addon-modules'],
  });
  const project = ProjectFixture({firstTransactionEvent: true});

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
    query: {statsPeriod: '10d', project: project.id},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

  let eventsMock: jest.Mock;
  let eventsStatsMock: jest.Mock;

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        data: [[1699907700, [{count: 0.2}]]],
        meta: {
          fields: {'avg(span.duration)': 'duration'},
          units: {
            'avg(span.duration)': 'millisecond',
          },
        },
      },
    });
  });

  it('renders', async () => {
    render(<PageWithProviders />, {organization});
    await screen.findByRole('table', {name: 'Transactions'});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    screen.getByText('Average Duration');
    screen.getByText('Published vs Processed');
    expect(eventsStatsMock).toHaveBeenCalled();
    expect(eventsMock).toHaveBeenCalled();
  });
});
