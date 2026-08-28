import {GroupFixture} from 'sentry-fixture/group';
import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';

import {screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {getEmbedLinkHref, renderEmbed} from './resourceEmbedTestUtils';

describe('saved issue view embed', () => {
  it('links a saved issue view to the view route', () => {
    expect(
      getEmbedLinkHref('savedIssueView', 'Unresolved', {id: '77', name: 'Unresolved'})
    ).toBe('/organizations/org-slug/issues/views/77/');
  });

  it('renders issues using the saved view filters', async () => {
    const view = GroupSearchViewFixture({
      id: '77',
      name: 'Unresolved in checkout',
      query: 'is:unresolved level:error',
      projects: [1],
      environments: ['production'],
    });
    const issue = GroupFixture({
      id: '991',
      shortId: 'JAVASCRIPT-991',
      title: 'Checkout request failed',
    });
    const viewRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/77/',
      body: view,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    const issuesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [issue],
    });

    renderEmbed({name: 'savedIssueView', data: {id: view.id}});

    expect(
      await screen.findByRole('link', {name: view.name}, {timeout: 10_000})
    ).toHaveAttribute('href', '/organizations/org-slug/issues/views/77/');
    expect(await screen.findByText(issue.shortId)).toBeInTheDocument();
    expect(viewRequest).toHaveBeenCalled();
    await waitFor(() =>
      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            environment: ['production'],
            limit: 5,
            project: ['1'],
            query: 'is:unresolved level:error',
            sort: view.querySort,
            statsPeriod: '7d',
          }),
        })
      )
    );
  });
});
