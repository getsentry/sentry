import {Organization} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SessionFieldWithOperation} from 'sentry/types';
import ProjectStabilityScoreCard from 'sentry/views/projectDetail/projectScoreCards/projectStabilityScoreCard';

describe('ProjectDetail > ProjectStability', function () {
  let endpointMock: jest.Mock;
  const organization = Organization();

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

  it('renders crash free users', async function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sessions/`,
      body: {
        groups: [
          {
            totals: {
              [SessionFieldWithOperation.CRASH_FREE_RATE_USERS]: 0.99,
            },
          },
        ],
      },
      status: 200,
    });

    render(
      <ProjectStabilityScoreCard
        field={SessionFieldWithOperation.CRASH_FREE_RATE_USERS}
        hasSessions
        selection={selection}
        isProjectStabilized
        query="test-query"
      />,
      {
        organization,
      }
    );

    expect(endpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/sessions/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: SessionFieldWithOperation.CRASH_FREE_RATE_USERS,
          project: 1,
          interval: '1d',
          statsPeriod: '14d',
          query: 'test-query',
        },
      })
    );

    expect(screen.getByText('Crash Free Users')).toBeInTheDocument();

    expect(await screen.findByText('99%')).toBeInTheDocument();
  });

  it('renders crash free sessions', async function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sessions/`,
      body: {
        groups: [
          {
            totals: {
              [SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS]: 0.99,
            },
          },
        ],
      },
      status: 200,
    });

    render(
      <ProjectStabilityScoreCard
        field={SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS}
        hasSessions
        selection={selection}
        isProjectStabilized
        query="test-query"
      />,
      {
        organization,
      }
    );

    expect(endpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/sessions/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS,
          project: 1,
          interval: '1d',
          statsPeriod: '14d',
          query: 'test-query',
        },
      })
    );

    expect(screen.getByText('Crash Free Sessions')).toBeInTheDocument();

    expect(await screen.findByText('99%')).toBeInTheDocument();
  });

  it('renders without sessions', async function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sessions/`,
      body: {
        detail: 'test error',
      },
      status: 404,
    });

    render(
      <ProjectStabilityScoreCard
        field={SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS}
        hasSessions={false}
        selection={selection}
        isProjectStabilized
        query="test-query"
      />,
      {
        organization,
      }
    );

    expect(endpointMock).not.toHaveBeenCalled();

    expect(screen.getByText('Crash Free Sessions')).toBeInTheDocument();

    expect(await screen.findByText('Start Setup')).toBeInTheDocument();
  });
});
