import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectVelocityScoreCard from './projectVelocityScoreCard';

describe('ProjectDetail > ProjectVelocity', function () {
  let allTimeDataEndpointMock: jest.Mock;
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

  it('renders release count', async function () {
    previousDataEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: Array.from({length: 98}).map((_item, index) => ({
        version: `0.0.${index + 100}`,
      })),
      status: 200,
    });

    currentDataEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: Array.from({length: 202}).map((_item, index) => ({
        version: `0.0.${index + 100}`,
      })),
      status: 200,
      match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
    });

    render(
      <ProjectVelocityScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized
      />
    );

    expect(await screen.findByText('Number of Releases')).toBeInTheDocument();
    expect(await screen.findByText('202')).toBeInTheDocument();
    expect(await screen.findByText('104')).toBeInTheDocument();

    expect(currentDataEndpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/releases/stats/`,
      expect.objectContaining({
        query: {
          environment: [],
          project: 1,
          statsPeriod: '14d',
        },
      })
    );

    expect(previousDataEndpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/releases/stats/`,
      expect.objectContaining({
        query: {
          environment: [],
          project: 1,
          start: '2017-09-19T02:41:20',
          end: '2017-10-03T02:41:20',
        },
      })
    );
  });

  it('renders without releases', async function () {
    allTimeDataEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
      status: 200,
    });

    render(
      <ProjectVelocityScoreCard
        organization={{...organization, features: ['performance-view']}}
        selection={selection}
        isProjectStabilized
      />
    );

    expect(await screen.findByRole('button', {name: 'Start Setup'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Get Tour'})).toBeInTheDocument();

    expect(allTimeDataEndpointMock).toHaveBeenCalled();
  });
});
