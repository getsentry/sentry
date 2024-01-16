import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DatabaseLandingPage} from 'sentry/views/performance/database/databaseLandingPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('DatabaseLandingPage', function () {
  const organization = OrganizationFixture();

  let spanListRequestMock, spanChartsRequestMock;

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
    query: {statsPeriod: '10d'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useOrganization).mockReturnValue(organization);

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'span-metrics'})],
      body: {
        data: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'api.starfish.get-span-actions'})],
      body: {
        data: [{'span.action': 'SELECT', count: 1}],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'api.starfish.get-span-domains'})],
      body: {
        data: [{'span.domain': ['sentry_users'], count: 1}],
      },
    });

    spanListRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({referrer: 'api.starfish.use-span-list'})],
      body: {
        data: [
          {
            'span.group': '271536360c0b6f89',
            'span.description': 'SELECT * FROM users',
          },
          {
            'span.group': '360c0b6f89271536',
            'span.description': 'SELECT * FROM organizations',
          },
        ],
      },
    });

    spanChartsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        'spm()': {
          data: [
            [1699907700, [{count: 7810.2}]],
            [1699908000, [{count: 1216.8}]],
          ],
        },
      },
    });
  });

  afterAll(function () {
    jest.resetAllMocks();
  });

  it('fetches module data', async function () {
    jest.spyOn(console, 'error').mockImplementation(jest.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />);

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events-stats/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          cursor: undefined,
          dataset: 'spansMetrics',
          environment: [],
          excludeOther: 0,
          field: [],
          interval: '30m',
          orderby: undefined,
          partial: 1,
          per_page: 50,
          project: [],
          query: 'span.module:db has:span.description',
          referrer: 'api.starfish.span-landing-page-metrics-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'spm()',
        },
      })
    );

    expect(spanChartsRequestMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${organization.slug}/events-stats/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          cursor: undefined,
          dataset: 'spansMetrics',
          environment: [],
          excludeOther: 0,
          field: [],
          interval: '30m',
          orderby: undefined,
          partial: 1,
          per_page: 50,
          project: [],
          query: 'span.module:db has:span.description',
          referrer: 'api.starfish.span-landing-page-metrics-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'avg(span.self_time)',
        },
      })
    );

    expect(spanListRequestMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'project.id',
            'span.group',
            'span.description',
            'spm()',
            'avg(span.self_time)',
            'sum(span.self_time)',
            'time_spent_percentage()',
          ],
          per_page: 25,
          project: [],
          query: 'span.module:db has:span.description',
          referrer: 'api.starfish.use-span-list',
          sort: '-time_spent_percentage()',
          statsPeriod: '10d',
        },
      })
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });

  it('renders a list of queries', async function () {
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn()); // This silences pointless unique key errors that React throws because of the tokenized query descriptions

    render(<DatabaseLandingPage />);

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('cell', {name: 'SELECT * FROM users'})).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {name: 'SELECT * FROM organizations'})
    ).toBeInTheDocument();
  });
});
