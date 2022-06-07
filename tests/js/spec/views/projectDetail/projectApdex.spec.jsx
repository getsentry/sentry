import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectApdexScoreCard from 'sentry/views/projectDetail/projectScoreCards/projectApdexScoreCard';

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
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
      },
      status: 200,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('calls api with apdex', function () {
    organization.features = ['discover-basic', 'performance-view'];
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
  });
});
