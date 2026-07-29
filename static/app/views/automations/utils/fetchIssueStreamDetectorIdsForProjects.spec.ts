import {IssueStreamDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';

import {fetchIssueStreamDetectorIdsForProjects} from './fetchIssueStreamDetectorIdsForProjects';

describe('fetchIssueStreamDetectorIdsForProjects', () => {
  const organization = OrganizationFixture();
  const endpoint = `/organizations/${organization.slug}/detectors/`;
  const queryClient = makeTestQueryClient();

  afterEach(() => {
    MockApiClient.clearMockResponses();
    queryClient.clear();
  });

  it('fetches every selected project when more than 100 are selected', async () => {
    const projectIds = Array.from({length: 101}, (_, index) => String(index + 1));
    const detectors = projectIds.map(projectId =>
      IssueStreamDetectorFixture({id: projectId, projectId})
    );

    const firstRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'GET',
      body: detectors.slice(0, 100),
      match: [
        MockApiClient.matchQuery({
          project: projectIds.slice(0, 100).map(Number),
          query: 'type:issue_stream',
        }),
      ],
    });
    const secondRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'GET',
      body: detectors.slice(100),
      match: [
        MockApiClient.matchQuery({
          project: projectIds.slice(100).map(Number),
          query: 'type:issue_stream',
        }),
      ],
    });

    const detectorIds = await fetchIssueStreamDetectorIdsForProjects({
      organization,
      projectIds,
      queryClient,
    });

    expect(detectorIds).toEqual(detectors.map(detector => detector.id));
    expect(firstRequest).toHaveBeenCalledTimes(1);
    expect(secondRequest).toHaveBeenCalledTimes(1);
  });
});
