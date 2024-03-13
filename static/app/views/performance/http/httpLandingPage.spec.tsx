import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HTTPLandingPage} from 'sentry/views/performance/http/httpLandingPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('HTTPLandingPage', function () {
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
    spanListRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.starfish.http-module-landing-domains-list',
        }),
      ],
      body: {
        data: [
          {
            'span.domain': '*.sentry.io',
          },
          {
            'span.domain': '*.github.com',
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
    render(<HTTPLandingPage />);

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
          query: 'span.module:http has:span.domain',
          referrer: 'api.starfish.http-module-landing-throughput-chart',
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
          query: 'span.module:http has:span.domain',
          referrer: 'api.starfish.http-module-landing-duration-chart',
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
            'span.domain',
            'spm()',
            'http_response_rate(2)',
            'http_response_rate(4)',
            'http_response_rate(5)',
            'avg(span.self_time)',
            'sum(span.self_time)',
            'time_spent_percentage()',
          ],
          per_page: 10,
          project: [],
          query: 'span.module:http has:span.domain',
          referrer: 'api.starfish.http-module-landing-domains-list',
          sort: '-time_spent_percentage()',
          statsPeriod: '10d',
        },
      })
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });

  it('renders a list of domains', async function () {
    render(<HTTPLandingPage />);

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('link', {name: '*.sentry.io'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/http/domains/?domain=%2A.sentry.io&statsPeriod=10d'
    );
    expect(screen.getByRole('link', {name: '*.github.com'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/http/domains/?domain=%2A.github.com&statsPeriod=10d'
    );
  });
});
