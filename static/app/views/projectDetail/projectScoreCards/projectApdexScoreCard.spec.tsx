import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectApdexScoreCard from 'sentry/views/projectDetail/projectScoreCards/projectApdexScoreCard';

describe('ProjectDetail > ProjectApdex', function () {
  let currentDataEndpointMock: jest.Mock;
  let previousDataEndpointMock: jest.Mock;
  const organization = OrganizationFixture();

  const selection = {
    projects: [1],
    environments: [],
    datetime: {
      start: null,
      end: null,
      period: '14d',
      utc: null,
    },
  };

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders apdex', async function () {
    previousDataEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'apdex()': 0.678,
          },
        ],
      },
      status: 200,
    });

    currentDataEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'apdex()': 0.781,
          },
        ],
      },
      status: 200,
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });

    render(
      <ProjectApdexScoreCard
        organization={{...organization, features: ['discover-basic', 'performance-view']}}
        selection={selection}
        isProjectStabilized
        hasTransactions
      />
    );

    expect(await screen.findByText('Apdex')).toBeInTheDocument();
    expect(await screen.findByText('0.781')).toBeInTheDocument();
    expect(await screen.findByText('0.103')).toBeInTheDocument();

    expect(currentDataEndpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: ['apdex()'],
          project: ['1'],
          query: 'event.type:transaction count():>0',
          statsPeriod: '14d',
        },
      })
    );

    expect(previousDataEndpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: ['apdex()'],
          project: ['1'],
          query: 'event.type:transaction count():>0',
          start: '2017-09-19T02:41:20',
          end: '2017-10-03T02:41:20',
        },
      })
    );
  });

  it('renders without performance', async function () {
    const endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        detail: 'test error',
      },
      status: 404,
    });

    render(
      <ProjectApdexScoreCard
        organization={{...organization, features: ['performance-view']}}
        hasTransactions={false}
        selection={selection}
        isProjectStabilized
        query="test-query"
      />
    );

    expect(await screen.findByText('Apdex')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Start Setup'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Get Tour'})).toBeInTheDocument();

    expect(endpointMock).not.toHaveBeenCalled();
  });
});
