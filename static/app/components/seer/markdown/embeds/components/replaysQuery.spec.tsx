import {ProjectFixture} from 'sentry-fixture/project';

import {screen, userEvent, waitFor, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {getEmbedLinkHref, renderEmbed} from './resourceEmbedTestUtils';

/** Shaped as the list endpoint returns it: seconds, and timestamps as strings. */
function rawReplay(overrides: Record<string, unknown> = {}) {
  return {
    id: '346789a703f6454384f1de473b8b9fcc',
    project_id: '2',
    duration: 30,
    started_at: '2022-09-15T06:50:00+00:00',
    finished_at: '2022-09-15T06:54:00+00:00',
    is_archived: false,
    activity: 1,
    count_errors: 4,
    count_dead_clicks: 0,
    count_rage_clicks: 7,
    os: {name: 'Mac OS X', version: '10.15.7'},
    browser: {name: 'Chrome', version: '103.0.0'},
    user: {
      id: '1',
      display_name: 'Test User',
      email: 'user@example.com',
      ip: '127.0.0.1',
      username: 'testuser',
    },
    tags: {},
    urls: [],
    ...overrides,
  };
}

describe('replays query embed', () => {
  beforeEach(() => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '2', slug: 'web'})]);
  });

  it('builds a replays query', () => {
    const href = getEmbedLinkHref('replaysQuery', 'Replay search', {
      query: 'count_rage_clicks:>0',
      statsPeriod: '7d',
    });

    expect(href).toContain('/organizations/org-slug/explore/replays/');
    expect(href).toContain('query=count_rage_clicks%3A%3E0');
    expect(href).toContain('statsPeriod=7d');
  });

  it('previews matching replays, hydrating the raw response', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replays/',
      body: {data: [rawReplay()]},
    });

    renderEmbed({
      name: 'replaysQuery',
      data: {query: 'count_rage_clicks:>0', statsPeriod: '7d'},
    });

    expect(await screen.findByText('Test User')).toBeInTheDocument();

    const row = screen.getByRole('row', {name: /Test User/});
    // `duration` arrives as the number 30 (seconds) and only becomes
    // renderable after `mapResponseToReplayRecord` turns it into a Duration.
    expect(within(row).getByText('00:30')).toBeInTheDocument();
    expect(within(row).getByText('4')).toBeInTheDocument();

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        '/organizations/org-slug/replays/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'count_rage_clicks:>0',
            statsPeriod: '7d',
            // A plain search, not the issue/transaction referrers that force
            // an all-projects override.
            queryReferrer: 'replayList',
            per_page: 5,
          }),
        })
      );
    });
  });

  it('shows platform and activity instead of rage clicks', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replays/',
      body: {data: [rawReplay()]},
    });

    renderEmbed({name: 'replaysQuery', data: {query: ''}});

    expect(await screen.findByText('Test User')).toBeInTheDocument();

    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    // Rage clicks lost its column to these; the count is still queryable, it
    // just isn't one of the five columns the preview has room for.
    expect(screen.queryByText('Rage clicks')).not.toBeInTheDocument();

    // Replay, Platform, Duration, Errors, Activity.
    const cells = within(screen.getByRole('row', {name: /Test User/})).getAllByRole(
      'cell'
    );

    // One cell carries both icons, the OS then the browser it ran in.
    const [os, browser] = within(cells[1]!).getAllByRole('img');

    await userEvent.hover(os!);
    expect(await screen.findByText('Mac OS X 10.15.7')).toBeInTheDocument();

    await userEvent.hover(browser!);
    expect(await screen.findByText('Chrome 103.0.0')).toBeInTheDocument();
  });

  it('renders an archived replay without its measurements', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replays/',
      body: {
        data: [
          rawReplay({
            is_archived: true,
            duration: undefined,
            count_errors: null,
            count_rage_clicks: null,
            user: null,
          }),
        ],
      },
    });

    renderEmbed({name: 'replaysQuery', data: {query: ''}});

    // An archived replay keeps its id but loses everything measured about it.
    expect(await screen.findByText('Deleted Replay')).toBeInTheDocument();
    const row = screen.getByRole('row', {name: /Deleted Replay/});
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows an empty state when nothing matches', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replays/',
      body: {data: []},
    });

    renderEmbed({name: 'replaysQuery', data: {query: 'count_errors:>999'}});

    expect(await screen.findByText('No matching replays')).toBeInTheDocument();
  });
});
