import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {PageFilters} from 'sentry/types/core';
import {ProjectAnrScoreCard} from 'sentry/views/projectDetail/projectScoreCards/projectAnrScoreCard';

describe('ProjectDetail > ProjectAnr', function () {
  let endpointMock: jest.Mock;
  let endpointMockPreviousPeriod: jest.Mock;

  const {organization, router} = initializeOrg({
    router: {
      location: {
        query: {project: '1', statsPeriod: '7d'},
      },
    },
  });

  const selection = {
    projects: [1],
    environments: [],
    datetime: {
      period: '7d',
      start: null,
      end: null,
      utc: false,
    },
  } as PageFilters;

  beforeEach(function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sessions/`,
      match: [MockApiClient.matchQuery({statsPeriod: '7d'})],
      body: {
        groups: [
          {
            by: {},
            totals: {
              'anr_rate()': 0.11561866125760649,
            },
          },
        ],
      },
      status: 200,
    });

    endpointMockPreviousPeriod = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sessions/`,
      match: [MockApiClient.matchQuery({start: '2017-10-03T02:41:20.000'})], // setup mocks a constant current date, so this works
      body: {
        groups: [
          {
            by: {},
            totals: {
              'anr_rate()': 0.08558558558558559,
            },
          },
        ],
      },
      status: 200,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('calls api with anr rate', async function () {
    render(
      <ProjectAnrScoreCard
        organization={{...organization}}
        selection={selection}
        isProjectStabilized
        query="release:abc"
        location={router.location}
      />
    );

    expect(endpointMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/sessions/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: ['anr_rate()'],
          includeSeries: '0',
          includeTotals: '1',
          interval: '1h',
          project: [1],
          query: 'release:abc',
          statsPeriod: '7d',
        },
      })
    );

    expect(endpointMockPreviousPeriod).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/sessions/`,
      expect.objectContaining({
        query: {
          end: '2017-10-10T02:41:20.000',
          environment: [],
          field: ['anr_rate()'],
          includeSeries: '0',
          includeTotals: '1',
          interval: '1h',
          project: [1],
          query: 'release:abc',
          start: '2017-10-03T02:41:20.000',
        },
      })
    );

    await screen.findByText('11.56%');
    await screen.findByText('3%');
  });

  it('renders open in issues CTA', async function () {
    organization.features = ['discover-basic'];
    render(
      <ProjectAnrScoreCard
        organization={{...organization}}
        selection={selection}
        isProjectStabilized
        query="release:abc"
        location={router.location}
      />,
      {
        router,
      }
    );

    await screen.findByText('11.56%');

    expect(screen.getByRole('button', {name: 'View Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?project=1&query=mechanism%3A%5BANR%2CAppExitInfo%5D%20release%3Aabc&sort=freq&statsPeriod=7d'
    );
  });
});
