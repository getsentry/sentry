import {GroupFixture} from 'sentry-fixture/group';

import {screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {getEmbedLinkHref, renderEmbed} from './resourceEmbedTestUtils';

describe('issues query embed', () => {
  it('carries the search string and page filters into the issue stream', () => {
    const href = getEmbedLinkHref('issuesQuery', 'Unresolved errors', {
      query: 'is:unresolved level:error',
      statsPeriod: '7d',
      projects: ['1', '2'],
      title: 'Unresolved errors',
    });

    expect(href).toContain('/organizations/org-slug/issues/');
    expect(href).toContain('query=is%3Aunresolved%20level%3Aerror');
    expect(href).toContain('statsPeriod=7d');
    expect(href).toContain('project=1');
    expect(href).toContain('project=2');
  });

  it('uses a generic label when Seer supplies no title', () => {
    renderEmbed({
      name: 'issuesQuery',
      data: {query: 'is:unresolved'},
      level: 'inline',
    });
    expect(screen.getByRole('link', {name: 'Issue search'})).toBeInTheDocument();
  });

  it('renders matching issues in a collapsible block', async () => {
    const issue = GroupFixture({
      id: '991',
      shortId: 'JAVASCRIPT-991',
      title: 'Checkout request failed',
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    const issuesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [issue],
    });

    renderEmbed({
      name: 'issuesQuery',
      data: {
        query: 'is:unresolved level:error',
        sort: 'date',
        statsPeriod: '7d',
        projects: ['1', '2'],
        environments: ['production'],
        title: 'Unresolved errors',
      },
    });

    const toggle = await screen.findByRole(
      'button',
      {name: 'Unresolved errors'},
      {timeout: 10_000}
    );
    expect(screen.getByRole('link', {name: 'View Issues'})).toHaveAttribute(
      'href',
      expect.stringContaining('/organizations/org-slug/issues/')
    );
    expect(await screen.findByText(issue.shortId)).toBeInTheDocument();
    expect(screen.getByLabelText('is:unresolved')).toBeInTheDocument();
    expect(screen.getByLabelText('level:error')).toBeInTheDocument();

    await waitFor(() =>
      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            environment: ['production'],
            limit: 5,
            project: ['1', '2'],
            query: 'is:unresolved level:error',
            sort: 'date',
            statsPeriod: '7d',
          }),
        })
      )
    );

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(issue.shortId)).not.toBeVisible();
  });
});
