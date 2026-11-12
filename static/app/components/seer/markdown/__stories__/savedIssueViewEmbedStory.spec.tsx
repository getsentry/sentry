import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SavedIssueViewEmbedStory} from './savedIssueViewEmbedStory';

describe('SavedIssueViewEmbedStory', () => {
  it('uses an organization-shared view when the current user owns none', async () => {
    const view = GroupSearchViewFixture({id: '42', name: 'Shared issue view'});
    const ownedViewsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      body: [],
      match: [MockApiClient.matchQuery({createdBy: 'me'})],
    });
    const sharedViewsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      body: [view],
      match: [MockApiClient.matchQuery({createdBy: 'others'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/group-search-views/${view.id}/`,
      body: view,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });

    render(<SavedIssueViewEmbedStory />);

    expect(
      (await screen.findAllByRole('link', {name: view.name}, {timeout: 10_000})).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText('No saved issue view is available for this organization.')
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(ownedViewsRequest).toHaveBeenCalled();
      expect(sharedViewsRequest).toHaveBeenCalled();
    });
  });
});
