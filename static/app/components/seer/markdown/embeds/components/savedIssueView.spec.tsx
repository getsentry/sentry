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

    // The block's name is the collapse toggle; the link out is a separate target.
    expect(
      await screen.findByRole('button', {name: view.name}, {timeout: 10_000})
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/views/77/'
    );
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

  it('offers no retry when the issue search is rejected', async () => {
    const view = GroupSearchViewFixture({
      id: '77',
      name: 'Unresolved in checkout',
      query: 'is:unresolved level:error',
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/77/',
      body: view,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      statusCode: 400,
      body: {detail: 'Invalid query'},
    });

    renderEmbed({name: 'savedIssueView', data: {id: view.id}});

    expect(
      await screen.findByTestId('loading-error', {}, {timeout: 10_000})
    ).toBeInTheDocument();
    // A retry can't fix a query the endpoint rejects, so none is offered.
    expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
  });

  it('renders the view query as formatted search tokens', async () => {
    const view = GroupSearchViewFixture({
      id: '77',
      name: 'Unresolved in checkout',
      query: 'is:unresolved level:error',
    });
    const issue = GroupFixture({
      id: '991',
      shortId: 'JAVASCRIPT-991',
      title: 'Checkout request failed',
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/77/',
      body: view,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [issue],
    });

    renderEmbed({name: 'savedIssueView', data: {id: view.id}});

    expect(await screen.findByText(issue.shortId)).toBeInTheDocument();

    expect(screen.getByLabelText('is:unresolved')).toBeInTheDocument();
    expect(screen.getByLabelText('level:error')).toBeInTheDocument();
  });
});
