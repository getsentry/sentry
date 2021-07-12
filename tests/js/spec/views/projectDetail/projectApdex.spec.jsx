import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectApdexScoreCard from 'app/views/projectDetail/projectScoreCards/projectApdexScoreCard';

describe('ProjectDetail > ProjectApdex', function () {
  let endpointMock;
  const {organization} = initializeOrg({
    organization: {
      apdexThreshold: 500,
    },
  });

  const selection = {
    projects: [1],
    environments: [],
    datetime: {
      period: '14d',
    },
  };

  beforeEach(function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/eventsv2/`,
      body: {
        data: [],
      },
      status: 200,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('makes api calls with the correct params', function () {
    organization.features = ['discover-basic', 'performance-view'];
    mountWithTheme(
      <ProjectApdexScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized
        hasTransactions
        query="release.version:1.0.0"
      />
    );

    expect(endpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/eventsv2/`,
      expect.objectContaining({
        query: {
          environment: [],
          field: ['apdex(500)'],
          project: ['1'],
          query: 'event.type:transaction count():>0 release.version:1.0.0',
          statsPeriod: '14d',
        },
      })
    );
  });

  it('calls api with new apdex if feature flag is enabled', function () {
    organization.features = [
      'discover-basic',
      'performance-view',
      'project-transaction-threshold',
    ];
    mountWithTheme(
      <ProjectApdexScoreCard
        organization={organization}
        selection={selection}
        isProjectStabilized
        hasTransactions
      />
    );

    expect(endpointMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/eventsv2/`,
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
  });
});
