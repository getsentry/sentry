import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {SavedQueryType} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useReorderStarredSavedQueries} from 'sentry/views/explore/hooks/useReorderStarredSavedQueries';

describe('useReorderStarredSavedQueries', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('useReorderStarredSavedQueries', async () => {
    const reorderMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/all-queries/starred/order/',
      method: 'PUT',
      match: [
        MockApiClient.matchData({
          queries: [
            {type: SavedQueryType.EXPLORE, query_id: 2},
            {type: SavedQueryType.DISCOVER, query_id: 1},
          ],
        }),
      ],
    });

    const {result} = renderHookWithProviders(() => useReorderStarredSavedQueries(), {
      organization: OrganizationFixture({
        slug: 'org-slug',
        features: ['discover-queries-in-all-queries'],
      }),
    });

    act(() => {
      result.current([
        {queryId: 2, queryType: SavedQueryType.EXPLORE},
        {queryId: 1, queryType: SavedQueryType.DISCOVER},
      ]);
    });

    await waitFor(() => expect(reorderMock).toHaveBeenCalled());
  });
});
