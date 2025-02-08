import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SessionFieldWithOperation} from 'sentry/types/organization';
import ProjectStabilityScoreCard from 'sentry/views/projectDetail/projectScoreCards/projectStabilityScoreCard';

describe('ProjectDetail > ProjectStability', function () {
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

  it('renders crash free users', async function () {
    const endpointMock = MockApiClient.addMockResponse({
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
      />
    );

    expect(await screen.findByText('Crash Free Users')).toBeInTheDocument();
    expect(await screen.findByText('99%')).toBeInTheDocument();

    expect(endpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/sessions/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: SessionFieldWithOperation.CRASH_FREE_RATE_USERS,
          project: 1,
          interval: '1h',
          statsPeriod: '14d',
          query: 'test-query',
        },
      })
    );
  });

  it('renders crash free sessions', async function () {
    const endpointMock = MockApiClient.addMockResponse({
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
      />
    );

    expect(await screen.findByText('Crash Free Sessions')).toBeInTheDocument();
    expect(await screen.findByText('99%')).toBeInTheDocument();

    expect(endpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/sessions/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS,
          project: 1,
          interval: '1h',
          statsPeriod: '14d',
          query: 'test-query',
        },
      })
    );
  });

  it('renders without sessions', async function () {
    const endpointMock = MockApiClient.addMockResponse({
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
      />
    );

    expect(await screen.findByText('Crash Free Sessions')).toBeInTheDocument();
    expect(await screen.findByText('Start Setup')).toBeInTheDocument();

    expect(endpointMock).not.toHaveBeenCalled();
  });
});
