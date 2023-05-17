import {render} from 'sentry-test/reactTestingLibrary';

import ProjectApdexScoreCard from 'sentry/views/projectDetail/projectScoreCards/projectApdexScoreCard';

describe('ProjectDetail > ProjectApdex', function () {
  let endpointMock;
  const organization = TestStubs.Organization();

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
    render(
      <ProjectApdexScoreCard
        organization={{...organization, features: ['discover-basic', 'performance-view']}}
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
